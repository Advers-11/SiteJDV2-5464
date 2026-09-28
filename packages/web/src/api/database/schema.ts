import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export * from "./auth-schema";

/** Torneio. A estrutura (matches) é gerada na criação; só os placares mudam depois. */
export const tournaments = sqliteTable(
  "tournaments",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    /** "single" | "double" | "groups" */
    format: text("format").notNull(),
    /** JSON: TournamentConfig */
    config: text("config").notNull(),
    /** hash scrypt da senha de edição (salt:hash) */
    editPasswordHash: text("edit_password_hash"),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("tournaments_owner_idx").on(t.ownerId)],
);

export const participants = sqliteTable(
  "participants",
  {
    id: text("id").primaryKey(),
    tournamentId: text("tournament_id").notNull(),
    /** posição de seed, 1-based */
    seed: integer("seed").notNull(),
    name: text("name").notNull(),
  },
  (t) => [index("participants_tournament_idx").on(t.tournamentId)],
);

export const matches = sqliteTable(
  "matches",
  {
    id: text("id").primaryKey(),
    tournamentId: text("tournament_id").notNull(),
    /** "winners" | "losers" | "group" | "final" | "playoff" */
    stage: text("stage").notNull(),
    /** rodada dentro do stage, 1-based */
    roundIndex: integer("round_index").notNull(),
    /** posição na rodada, 0-based */
    slotIndex: integer("slot_index").notNull(),
    /** código curto exibido/referenciado: R2-1, LR3-2, G-A-1, FINAL */
    code: text("code").notNull(),
    /** chave do grupo quando stage = "group" */
    groupKey: text("group_key"),
    /** JSON: Slot */
    srcA: text("src_a").notNull(),
    /** JSON: Slot */
    srcB: text("src_b").notNull(),
    scoreA: integer("score_a"),
    scoreB: integer("score_b"),
  },
  (t) => [index("matches_tournament_idx").on(t.tournamentId)],
);
