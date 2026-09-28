import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../database";
import * as schema from "../database/schema";
import { withUser } from "../middleware/auth";
import { resolveBracket, type TournamentFormat } from "../lib/bracket";
import { assertCanEdit } from "./tournaments";

const scoreInput = z.object({
  slug: z.string(),
  editToken: z.string().nullish(),
  matchId: z.string(),
  scoreA: z.number().int().min(0).max(999),
  scoreB: z.number().int().min(0).max(999),
});

export const matches = {
  setScore: withUser.input(scoreInput).handler(async ({ input, context }) => {
    const { t, config, participants, stored } = await assertCanEdit(
      input.slug,
      context.user?.id ?? null,
      input.editToken,
    );
    const resolved = resolveBracket(
      t.format as TournamentFormat,
      config,
      participants,
      stored,
      config.groups,
    );
    const match = resolved.matches.find((m) => m.id === input.matchId);
    if (!match) throw new ORPCError("NOT_FOUND", { message: "Partida não encontrada." });
    if (!match.playable) {
      throw new ORPCError("BAD_REQUEST", {
        message: "Esta partida ainda não tem os dois jogadores definidos.",
      });
    }
    if (input.scoreA === input.scoreB && match.stage !== "group") {
      throw new ORPCError("BAD_REQUEST", {
        message: "Empate não é permitido em partida eliminatória.",
      });
    }

    await db
      .update(schema.matches)
      .set({ scoreA: input.scoreA, scoreB: input.scoreB })
      .where(and(eq(schema.matches.id, input.matchId), eq(schema.matches.tournamentId, t.id)));
    await db
      .update(schema.tournaments)
      .set({ updatedAt: new Date() })
      .where(eq(schema.tournaments.id, t.id));
    return { ok: true };
  }),

  clearScore: withUser
    .input(z.object({ slug: z.string(), editToken: z.string().nullish(), matchId: z.string() }))
    .handler(async ({ input, context }) => {
      const { t } = await assertCanEdit(input.slug, context.user?.id ?? null, input.editToken);
      await db
        .update(schema.matches)
        .set({ scoreA: null, scoreB: null })
        .where(and(eq(schema.matches.id, input.matchId), eq(schema.matches.tournamentId, t.id)));
      await db
        .update(schema.tournaments)
        .set({ updatedAt: new Date() })
        .where(eq(schema.tournaments.id, t.id));
      return { ok: true };
    }),

  /** Zera todos os placares do torneio. */
  resetAll: withUser
    .input(z.object({ slug: z.string(), editToken: z.string().nullish() }))
    .handler(async ({ input, context }) => {
      const { t } = await assertCanEdit(input.slug, context.user?.id ?? null, input.editToken);
      await db
        .update(schema.matches)
        .set({ scoreA: null, scoreB: null })
        .where(eq(schema.matches.tournamentId, t.id));
      await db
        .update(schema.tournaments)
        .set({ updatedAt: new Date() })
        .where(eq(schema.tournaments.id, t.id));
      return { ok: true };
    }),
};
