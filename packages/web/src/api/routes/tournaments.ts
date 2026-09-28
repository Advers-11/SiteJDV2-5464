import { ORPCError } from "@orpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database";
import * as schema from "../database/schema";
import { authed, withUser } from "../middleware/auth";
import {
  hashPassword,
  signEditToken,
  slugify,
  verifyEditToken,
  verifyPassword,
} from "../lib/access";
import {
  bracketSize,
  canUseLosersGroupStage,
  defaultConfig,
  formatLabel,
  generateBracket,
  resolveBracket,
  type GroupSpec,
  type Slot,
  type StoredMatch,
  type TournamentConfig,
  type TournamentFormat,
} from "../lib/bracket";

const formatEnum = z.enum(["single", "double", "groups", "league"]);

const configSchema = z.object({
  losersGroupStage: z.boolean().default(false),
  groupCount: z.number().int().min(1).max(8).default(2),
  qualifiersPerGroup: z.number().int().min(1).max(8).default(2),
  playoff: z.boolean().default(true),
  pointsWin: z.number().int().min(1).max(5).default(3),
  pointsDraw: z.number().int().min(0).max(3).default(1),
  /** league: gera returno com o mando invertido */
  doubleRound: z.boolean().default(true),
  /** league: tabela explicita de rodadas em seeds 1-based; nula = tabela padrao */
  schedule: z.array(z.array(z.tuple([z.number().int(), z.number().int()]))).nullish(),
});

type StoredConfig = TournamentConfig & { groups: GroupSpec[] };

function parseConfig(raw: string): StoredConfig {
  const parsed = JSON.parse(raw) as Partial<StoredConfig>;
  return { ...defaultConfig, groups: [], ...parsed } as StoredConfig;
}

async function loadTournament(slug: string) {
  const [t] = await db
    .select()
    .from(schema.tournaments)
    .where(eq(schema.tournaments.slug, slug));
  if (!t) throw new ORPCError("NOT_FOUND", { message: "Chaveamento não encontrado" });
  return t;
}

export async function loadFull(slug: string) {
  const t = await loadTournament(slug);
  const [ps, ms] = await Promise.all([
    db.select().from(schema.participants).where(eq(schema.participants.tournamentId, t.id)),
    db.select().from(schema.matches).where(eq(schema.matches.tournamentId, t.id)),
  ]);
  const config = parseConfig(t.config);
  const participants = ps
    .map((p) => ({ id: p.id, seed: p.seed, name: p.name }))
    .sort((a, b) => a.seed - b.seed);
  const stored: StoredMatch[] = ms.map((m) => ({
    id: m.id,
    stage: m.stage as StoredMatch["stage"],
    roundIndex: m.roundIndex,
    slotIndex: m.slotIndex,
    code: m.code,
    groupKey: m.groupKey,
    srcA: JSON.parse(m.srcA) as Slot,
    srcB: JSON.parse(m.srcB) as Slot,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
  }));
  return { t, config, participants, stored };
}

export function canEditTournament(
  t: { id: string; ownerId: string; editPasswordHash: string | null },
  userId: string | null,
  editToken: string | null | undefined,
) {
  if (userId && t.ownerId === userId) return true;
  return verifyEditToken(t.id, editToken);
}

export async function assertCanEdit(
  slug: string,
  userId: string | null,
  editToken: string | null | undefined,
) {
  const full = await loadFull(slug);
  if (!canEditTournament(full.t, userId, editToken)) {
    throw new ORPCError("FORBIDDEN", {
      message: "Você precisa da senha de edição deste chaveamento.",
    });
  }
  return full;
}

function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

async function touch(id: string) {
  await db
    .update(schema.tournaments)
    .set({ updatedAt: new Date() })
    .where(eq(schema.tournaments.id, id));
}

export const tournaments = {
  /** Lista os chaveamentos do usuário logado. */
  list: authed.handler(async ({ context }) => {
    const rows = await db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.ownerId, context.user.id))
      .orderBy(desc(schema.tournaments.updatedAt));

    return Promise.all(
      rows.map(async (t) => {
        const full = await loadFull(t.slug);
        const resolved = resolveBracket(
          t.format as TournamentFormat,
          full.config,
          full.participants,
          full.stored,
          full.config.groups,
        );
        const champion = resolved.championId
          ? (full.participants.find((p) => p.id === resolved.championId)?.name ?? null)
          : null;
        return {
          id: t.id,
          slug: t.slug,
          name: t.name,
          format: t.format as TournamentFormat,
          formatLabel: formatLabel(t.format as TournamentFormat),
          participantCount: full.participants.length,
          hasEditPassword: !!t.editPasswordHash,
          playedCount: resolved.playedCount,
          totalCount: resolved.totalCount,
          champion,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
        };
      }),
    );
  }),

  create: authed
    .input(
      z.object({
        name: z.string().trim().min(1).max(80),
        format: formatEnum,
        participants: z.array(z.string().trim().min(1).max(40)).min(3).max(32),
        config: configSchema,
        editPassword: z.string().min(3).max(64).optional().nullable(),
        note: z.string().max(200).optional().nullable(),
      }),
    )
    .handler(async ({ input, context }) => {
      const names = input.participants.filter((n) => n.length > 0);
      if (names.length < 3) {
        throw new ORPCError("BAD_REQUEST", { message: "Informe pelo menos 3 participantes." });
      }
      if (input.format === "groups" && input.config.groupCount * 2 > names.length) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Grupos demais para a quantidade de participantes.",
        });
      }

      const tournamentId = crypto.randomUUID();
      const participantRows = names.map((name, i) => ({
        id: crypto.randomUUID(),
        tournamentId,
        seed: i + 1,
        name,
      }));

      const config: TournamentConfig = {
        ...defaultConfig,
        ...input.config,
        schedule:
          input.format === "league" && input.config.schedule
            ? input.config.schedule.map((r) => r.map(([a, b]) => [a, b]))
            : null,
        participantCount: names.length,
        losersGroupStage:
          input.format === "double" &&
          input.config.losersGroupStage &&
          canUseLosersGroupStage(names.length),
      };

      const generated = generateBracket(
        input.format,
        config,
        participantRows.map((p) => p.id),
      );

      const slug = slugify(input.name);
      await db.insert(schema.tournaments).values({
        id: tournamentId,
        slug,
        ownerId: context.user.id,
        name: input.name,
        format: input.format,
        config: JSON.stringify({ ...config, groups: generated.groups }),
        editPasswordHash: input.editPassword ? hashPassword(input.editPassword) : null,
        note: input.note ?? null,
      });
      await db.insert(schema.participants).values(participantRows);
      if (generated.matches.length > 0) {
        await db.insert(schema.matches).values(
          generated.matches.map((m) => ({
            id: m.id,
            tournamentId,
            stage: m.stage,
            roundIndex: m.roundIndex,
            slotIndex: m.slotIndex,
            code: m.code,
            groupKey: m.groupKey,
            srcA: JSON.stringify(m.srcA),
            srcB: JSON.stringify(m.srcB),
            scoreA: null,
            scoreB: null,
          })),
        );
      }

      return { slug };
    }),

  /** Leitura pública por slug. Retorna o chaveamento já resolvido. */
  get: withUser
    .input(z.object({ slug: z.string(), editToken: z.string().nullish() }))
    .handler(async ({ input, context }) => {
      const { t, config, participants, stored } = await loadFull(input.slug);
      const resolved = resolveBracket(
        t.format as TournamentFormat,
        config,
        participants,
        stored,
        config.groups,
      );
      return {
        tournament: {
          id: t.id,
          slug: t.slug,
          name: t.name,
          note: t.note,
          format: t.format as TournamentFormat,
          formatLabel: formatLabel(t.format as TournamentFormat),
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          hasEditPassword: !!t.editPasswordHash,
          losersGroupStage: config.losersGroupStage,
          bracketSize: bracketSize(participants.length),
          pointsWin: config.pointsWin,
          pointsDraw: config.pointsDraw,
        },
        participants,
        bracket: resolved,
        isOwner: !!context.user && context.user.id === t.ownerId,
        canEdit: canEditTournament(t, context.user?.id ?? null, input.editToken),
      };
    }),

  /** Troca a senha por um token de edição guardado no navegador. */
  unlock: withUser
    .input(z.object({ slug: z.string(), password: z.string() }))
    .handler(async ({ input }) => {
      const t = await loadTournament(input.slug);
      if (!t.editPasswordHash) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Este chaveamento não tem senha de edição.",
        });
      }
      if (!verifyPassword(input.password, t.editPasswordHash)) {
        throw new ORPCError("UNAUTHORIZED", { message: "Senha incorreta." });
      }
      return { editToken: signEditToken(t.id) };
    }),

  update: withUser
    .input(
      z.object({
        slug: z.string(),
        editToken: z.string().nullish(),
        name: z.string().trim().min(1).max(80).optional(),
        note: z.string().max(200).nullish(),
      }),
    )
    .handler(async ({ input, context }) => {
      const { t } = await assertCanEdit(input.slug, context.user?.id ?? null, input.editToken);
      await db
        .update(schema.tournaments)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.note !== undefined ? { note: input.note ?? null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(schema.tournaments.id, t.id));
      return { ok: true };
    }),

  setEditPassword: authed
    .input(z.object({ slug: z.string(), password: z.string().min(3).max(64).nullable() }))
    .handler(async ({ input, context }) => {
      const t = await loadTournament(input.slug);
      if (t.ownerId !== context.user.id) throw new ORPCError("FORBIDDEN");
      await db
        .update(schema.tournaments)
        .set({
          editPasswordHash: input.password ? hashPassword(input.password) : null,
          updatedAt: new Date(),
        })
        .where(eq(schema.tournaments.id, t.id));
      return { ok: true };
    }),

  remove: authed.input(z.object({ slug: z.string() })).handler(async ({ input, context }) => {
    const t = await loadTournament(input.slug);
    if (t.ownerId !== context.user.id) throw new ORPCError("FORBIDDEN");
    await db.delete(schema.matches).where(eq(schema.matches.tournamentId, t.id));
    await db.delete(schema.participants).where(eq(schema.participants.tournamentId, t.id));
    await db.delete(schema.tournaments).where(eq(schema.tournaments.id, t.id));
    return { ok: true };
  }),

  renameParticipant: withUser
    .input(
      z.object({
        slug: z.string(),
        editToken: z.string().nullish(),
        participantId: z.string(),
        name: z.string().trim().min(1).max(40),
      }),
    )
    .handler(async ({ input, context }) => {
      const { t } = await assertCanEdit(input.slug, context.user?.id ?? null, input.editToken);
      await db
        .update(schema.participants)
        .set({ name: input.name })
        .where(
          and(
            eq(schema.participants.id, input.participantId),
            eq(schema.participants.tournamentId, t.id),
          ),
        );
      await touch(t.id);
      return { ok: true };
    }),

  /** Sorteia os nomes entre as posições de seed (a estrutura não muda). */
  shuffleSeeds: withUser
    .input(z.object({ slug: z.string(), editToken: z.string().nullish() }))
    .handler(async ({ input, context }) => {
      const { t, participants, stored } = await assertCanEdit(
        input.slug,
        context.user?.id ?? null,
        input.editToken,
      );
      if (stored.some((m) => m.scoreA !== null || m.scoreB !== null)) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Zere os placares antes de sortear novamente.",
        });
      }
      const names = shuffled(participants.map((p) => p.name));
      await Promise.all(
        participants.map((p, i) =>
          db
            .update(schema.participants)
            .set({ name: names[i] })
            .where(eq(schema.participants.id, p.id)),
        ),
      );
      await touch(t.id);
      return { ok: true };
    }),
};
