/**
 * Motor de chaveamento.
 *
 * A estrutura (lista de partidas + de onde vem cada lado) é gerada uma única vez
 * na criação do torneio. Depois disso, o único estado mutável são os placares.
 * Toda a resolução (quem está em cada slot, quem venceu, classificação de grupo)
 * é recalculada a partir dos placares — assim editar um resultado antigo nunca
 * deixa dados inconsistentes rodada abaixo.
 */

export type Stage = "winners" | "losers" | "group" | "final" | "playoff";

export type Slot =
  | { t: "seed"; pid: string }
  | { t: "empty" }
  | { t: "winner"; m: string }
  | { t: "loser"; m: string }
  | { t: "groupRank"; g: string; rank: number };

export type MatchPlan = {
  id: string;
  stage: Stage;
  roundIndex: number;
  slotIndex: number;
  code: string;
  groupKey: string | null;
  srcA: Slot;
  srcB: Slot;
};

export type TournamentFormat = "single" | "double" | "groups" | "league";

export type TournamentConfig = {
  participantCount: number;
  /** double: troca a Losers Round 1 por uma fase de grupos entre os perdedores do R1 */
  losersGroupStage: boolean;
  /** groups: quantidade de grupos */
  groupCount: number;
  /** groups: classificados por grupo */
  qualifiersPerGroup: number;
  /** groups: gerar playoff eliminatório com os classificados */
  playoff: boolean;
  pointsWin: number;
  pointsDraw: number;
  /** league: gera returno com o mando invertido */
  doubleRound: boolean;
  /**
   * league: tabela de rodadas explicita. Cada rodada e uma lista de duplas
   * [seedCasa, seedFora] em seeds 1-based. Quando nula, usa o metodo do circulo.
   */
  schedule: number[][][] | null;
};

export const defaultConfig: TournamentConfig = {
  participantCount: 8,
  losersGroupStage: false,
  groupCount: 2,
  qualifiersPerGroup: 2,
  playoff: true,
  pointsWin: 3,
  pointsDraw: 1,
  doubleRound: true,
  schedule: null,
};

const uid = () => crypto.randomUUID();

export function bracketSize(n: number): number {
  let s = 2;
  while (s < n) s *= 2;
  return s;
}

/** Ordem clássica de seeds: size 8 => [1,8,4,5,2,7,3,6] */
export function seedOrder(size: number): number[] {
  let arr = [1, 2];
  while (arr.length < size) {
    const n = arr.length * 2;
    const next: number[] = [];
    for (const s of arr) {
      next.push(s);
      next.push(n + 1 - s);
    }
    arr = next;
  }
  return arr;
}

/** Quantos perdedores reais o R1 produz (partidas sem bye). */
export function realFirstRoundLosers(n: number): number {
  return Math.max(0, n - bracketSize(n) / 2);
}

/** A fase de grupos dos perdedores só faz sentido se ela eliminar alguém. */
export function canUseLosersGroupStage(n: number): boolean {
  const size = bracketSize(n);
  return n >= 4 && realFirstRoundLosers(n) >= size / 4 + 1;
}

export const GROUP_LABEL_KEYS = "ABCDEFGH".split("");

type Ctx = { ids: string[]; matches: MatchPlan[] };

function push(ctx: Ctx, m: Omit<MatchPlan, "id"> & { id?: string }): MatchPlan {
  const full = { ...m, id: m.id ?? uid() } as MatchPlan;
  ctx.matches.push(full);
  return full;
}

/** Chave eliminatória simples sobre uma lista ordenada de slots de entrada. */
function buildElimination(
  ctx: Ctx,
  stage: Stage,
  entrySlots: Slot[],
  codePrefix: string,
): { rounds: MatchPlan[][] } {
  const size = entrySlots.length;
  const rounds: MatchPlan[][] = [];
  const first: MatchPlan[] = [];
  for (let i = 0; i < size / 2; i++) {
    first.push(
      push(ctx, {
        stage,
        roundIndex: 1,
        slotIndex: i,
        code: `${codePrefix}1-${i + 1}`,
        groupKey: null,
        srcA: entrySlots[2 * i],
        srcB: entrySlots[2 * i + 1],
      }),
    );
  }
  rounds.push(first);
  let r = 2;
  while (rounds[rounds.length - 1].length > 1) {
    const prev = rounds[rounds.length - 1];
    const cur: MatchPlan[] = [];
    for (let i = 0; i < prev.length / 2; i++) {
      cur.push(
        push(ctx, {
          stage,
          roundIndex: r,
          slotIndex: i,
          code: `${codePrefix}${r}-${i + 1}`,
          groupKey: null,
          srcA: { t: "winner", m: prev[2 * i].id },
          srcB: { t: "winner", m: prev[2 * i + 1].id },
        }),
      );
    }
    rounds.push(cur);
    r++;
  }
  return { rounds };
}

function seededEntrySlots(participantIds: string[], size: number): Slot[] {
  const order = seedOrder(size);
  return order.map((seed) =>
    seed <= participantIds.length
      ? ({ t: "seed", pid: participantIds[seed - 1] } as Slot)
      : ({ t: "empty" } as Slot),
  );
}

function roundRobin(
  ctx: Ctx,
  groupKey: string,
  members: Slot[],
  codePrefix: string,
): MatchPlan[] {
  const out: MatchPlan[] = [];
  let i = 0;
  for (let a = 0; a < members.length; a++) {
    for (let b = a + 1; b < members.length; b++) {
      out.push(
        push(ctx, {
          stage: "group",
          roundIndex: 1,
          slotIndex: i,
          code: `${codePrefix}-${i + 1}`,
          groupKey,
          srcA: members[a],
          srcB: members[b],
        }),
      );
      i++;
    }
  }
  return out;
}


/**
 * Tabela de rodadas pelo metodo do circulo. Para n impar entra um "bye"
 * (folga) por rodada. Retorna duplas [seedCasa, seedFora] em seeds 1-based.
 */
/**
 * Tabela pronta para 7 participantes: o #1 pega um adversario novo por rodada
 * e a folga gira sem repetir. E a mesma tabela usada nas ligas de mesa/futebol
 * com 7 times, entao vale mais que a saida crua do metodo do circulo.
 */
const LEAGUE_7: number[][][] = [
  [[1, 2], [3, 4], [5, 6]], // folga 7
  [[1, 3], [2, 5], [4, 7]], // folga 6
  [[1, 4], [3, 6], [5, 7]], // folga 2
  [[1, 5], [4, 6], [2, 7]], // folga 3
  [[5, 4], [2, 3], [6, 7]], // folga 1
  [[1, 7], [6, 2], [3, 5]], // folga 4
  [[6, 1], [7, 3], [4, 2]], // folga 5
];

export function leagueSchedule(n: number, doubleRound: boolean): number[][][] {
  if (n === 7) {
    const first = LEAGUE_7.map((g) => g.map(([a, b]) => [a, b]));
    return doubleRound
      ? [...first, ...first.map((g) => g.map(([a, b]) => [b, a]))]
      : first;
  }
  const seeds = Array.from({ length: n }, (_, i) => i + 1);
  const odd = seeds.length % 2 === 1;
  const wheel = odd ? [...seeds, 0] : [...seeds];
  const size = wheel.length;
  const rounds: number[][][] = [];
  for (let r = 0; r < size - 1; r++) {
    const games: number[][] = [];
    for (let i = 0; i < size / 2; i++) {
      const a = wheel[i];
      const b = wheel[size - 1 - i];
      if (a === 0 || b === 0) continue;
      // alterna o mando entre rodadas para nao concentrar em um lado
      games.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(games);
    // roda o circulo mantendo o primeiro fixo
    wheel.splice(1, 0, wheel.pop() as number);
  }
  if (!doubleRound) return rounds;
  return [...rounds, ...rounds.map((g) => g.map(([a, b]) => [b, a]))];
}

export const LEAGUE_KEY = "L";

/*
 * Geometria aproximada da folha (espelha packages/web/src/web/lib/layout.ts).
 * Serve só para escolher em quantas faixas as rodadas da liga são quebradas,
 * de modo que a folha A4 paisagem fique o mais cheia possível.
 */
const A4_W = 1062;
const A4_H = 583;
const COL_PITCH = 246; // COL_W + COL_GAP
const COL_GAP_PX = 46;
const ROW_CHROME = 104; // cabeçalho da coluna + respiro entre faixas
const MATCH_BOX_H = 55;
const MATCH_BOX_GAP = 16;
const PANEL_BOX_H = 68;
const PANEL_ROW = 21;

/** Rodadas por faixa que maximizam a escala de impressão em A4 paisagem. */
export function bestRowSplit(cells: number, rowContentH: number): number {
  let best = cells;
  let bestScale = -1;
  for (let perRow = 1; perRow <= cells; perRow++) {
    const w = perRow * COL_PITCH - COL_GAP_PX;
    const h = Math.ceil(cells / perRow) * (rowContentH + ROW_CHROME);
    const scale = Math.min(1, A4_W / w, A4_H / h);
    if (scale > bestScale + 0.001) {
      bestScale = scale;
      best = perRow;
    }
  }
  return best;
}

export type GroupSpec = {
  key: string;
  label: string;
  qualifiers: number;
  /** liga de pontos corridos: a tabela e o resultado final, sem classificados */
  isLeague?: boolean;
  /** rótulo curto usado nas referências: "Fase de Grupos" ou "Grupo A" */
  refLabel: string;
};

export type GeneratedBracket = { matches: MatchPlan[]; groups: GroupSpec[] };

export function generateBracket(
  format: TournamentFormat,
  config: TournamentConfig,
  participantIds: string[],
): GeneratedBracket {
  const ctx: Ctx = { ids: participantIds, matches: [] };
  const n = participantIds.length;

  if (format === "single") {
    const size = bracketSize(n);
    buildElimination(ctx, "winners", seededEntrySlots(participantIds, size), "R");
    return { matches: ctx.matches, groups: [] };
  }

  if (format === "league") {
    const schedule =
      config.schedule && config.schedule.length > 0
        ? config.schedule
        : leagueSchedule(n, config.doubleRound);
    schedule.forEach((games, r) => {
      games.forEach(([sa, sb], i) => {
        const a = participantIds[sa - 1];
        const b = participantIds[sb - 1];
        if (!a || !b) return;
        push(ctx, {
          stage: "group",
          roundIndex: r + 1,
          slotIndex: i,
          code: `R${r + 1}-${i + 1}`,
          groupKey: LEAGUE_KEY,
          srcA: { t: "seed", pid: a },
          srcB: { t: "seed", pid: b },
        });
      });
    });
    return {
      matches: ctx.matches,
      groups: [
        {
          key: LEAGUE_KEY,
          label: "Classificação",
          qualifiers: 1,
          refLabel: "Liga",
          isLeague: true,
        },
      ],
    };
  }

  if (format === "double") {
    const size = bracketSize(n);
    const R = Math.log2(size);
    const { rounds: wb } = buildElimination(
      ctx,
      "winners",
      seededEntrySlots(participantIds, size),
      "R",
    );

    const groups: GroupSpec[] = [];
    let lbRound = 1;
    let prev: MatchPlan[];
    let prevFromGroup = false;

    const useGroup = config.losersGroupStage && canUseLosersGroupStage(n);
    const lb1Count = Math.max(1, size / 4);

    if (useGroup) {
      // Perdedores reais do R1 (partidas com dois jogadores) disputam todos contra todos.
      const realR1 = wb[0].filter(
        (m) => m.srcA.t !== "empty" && m.srcB.t !== "empty",
      );
      const members: Slot[] = realR1.map((m) => ({ t: "loser", m: m.id }));
      roundRobin(ctx, "A", members, "G");
      groups.push({
        key: "A",
        label: "Fase de Grupos",
        qualifiers: lb1Count,
        refLabel: "Fase de Grupos",
      });
      prev = [];
      prevFromGroup = true;
    } else {
      prev = [];
      for (let i = 0; i < lb1Count; i++) {
        const a = wb[0][2 * i];
        const b = wb[0][2 * i + 1];
        prev.push(
          push(ctx, {
            stage: "losers",
            roundIndex: 1,
            slotIndex: i,
            code: `LR1-${i + 1}`,
            groupKey: null,
            srcA: a ? { t: "loser", m: a.id } : { t: "empty" },
            srcB: b ? { t: "loser", m: b.id } : { t: "empty" },
          }),
        );
      }
    }

    for (let k = 2; k <= R; k++) {
      const count = Math.max(1, size / 2 ** k);
      lbRound++;
      const minor: MatchPlan[] = [];
      const wbLosers = [...wb[k - 1]].reverse(); // cruzado, evita revanche imediata
      for (let i = 0; i < count; i++) {
        const fromPrev: Slot = prevFromGroup
          ? { t: "groupRank", g: "A", rank: i + 1 }
          : { t: "winner", m: prev[i].id };
        minor.push(
          push(ctx, {
            stage: "losers",
            roundIndex: lbRound,
            slotIndex: i,
            code: `LR${lbRound}-${i + 1}`,
            groupKey: null,
            srcA: wbLosers[i]
              ? { t: "loser", m: wbLosers[i].id }
              : { t: "empty" },
            srcB: fromPrev,
          }),
        );
      }
      prev = minor;
      prevFromGroup = false;

      if (count > 1) {
        lbRound++;
        const major: MatchPlan[] = [];
        for (let i = 0; i < count / 2; i++) {
          major.push(
            push(ctx, {
              stage: "losers",
              roundIndex: lbRound,
              slotIndex: i,
              code: `LR${lbRound}-${i + 1}`,
              groupKey: null,
              srcA: { t: "winner", m: prev[2 * i].id },
              srcB: { t: "winner", m: prev[2 * i + 1].id },
            }),
          );
        }
        prev = major;
      }
    }

    push(ctx, {
      stage: "final",
      roundIndex: 1,
      slotIndex: 0,
      code: "FINAL",
      groupKey: null,
      srcA: { t: "winner", m: wb[wb.length - 1][0].id },
      srcB: { t: "winner", m: prev[0].id },
    });

    return { matches: ctx.matches, groups };
  }

  // format === "groups"
  const groupCount = Math.max(1, Math.min(config.groupCount, Math.floor(n / 2)));
  const buckets: string[][] = Array.from({ length: groupCount }, () => []);
  // distribuição em serpentina pelo seed
  participantIds.forEach((pid, idx) => {
    const row = Math.floor(idx / groupCount);
    const col = idx % groupCount;
    const g = row % 2 === 0 ? col : groupCount - 1 - col;
    buckets[g].push(pid);
  });

  const qpg = Math.max(1, Math.min(config.qualifiersPerGroup, Math.min(...buckets.map((b) => b.length))));
  const groups: GroupSpec[] = buckets.map((members, i) => {
    const key = GROUP_LABEL_KEYS[i] ?? String(i + 1);
    roundRobin(
      ctx,
      key,
      members.map((pid) => ({ t: "seed", pid }) as Slot),
      `G${key}`,
    );
    return {
      key,
      label: `Grupo ${key}`,
      qualifiers: qpg,
      refLabel: `Grupo ${key}`,
    };
  });

  if (config.playoff && groupCount * qpg >= 2) {
    // ordem dos classificados: todos os 1ºs, depois os 2ºs... vira seed do playoff
    const qualifierSlots: Slot[] = [];
    for (let rank = 1; rank <= qpg; rank++) {
      for (const g of groups) qualifierSlots.push({ t: "groupRank", g: g.key, rank });
    }
    const size = bracketSize(qualifierSlots.length);
    const order = seedOrder(size);
    const entry: Slot[] = order.map((seed) =>
      seed <= qualifierSlots.length ? qualifierSlots[seed - 1] : ({ t: "empty" } as Slot),
    );
    buildElimination(ctx, "playoff", entry, "P");
  }

  return { matches: ctx.matches, groups };
}

/* ------------------------------------------------------------------ */
/* Resolução                                                           */
/* ------------------------------------------------------------------ */

export type Participant = { id: string; seed: number; name: string };

export type StoredMatch = {
  id: string;
  stage: Stage;
  roundIndex: number;
  slotIndex: number;
  code: string;
  groupKey: string | null;
  srcA: Slot;
  srcB: Slot;
  scoreA: number | null;
  scoreB: number | null;
};

export type ResolvedSide = {
  pid: string | null;
  name: string | null;
  seed: number | null;
  /** rótulo de origem quando ainda não há jogador definido */
  sourceLabel: string;
  score: number | null;
  isWinner: boolean;
};

export type ResolvedMatch = {
  id: string;
  code: string;
  stage: Stage;
  roundIndex: number;
  slotIndex: number;
  groupKey: string | null;
  srcA: Slot;
  srcB: Slot;
  a: ResolvedSide;
  b: ResolvedSide;
  winnerId: string | null;
  loserId: string | null;
  /** os dois lados já têm jogador definido → dá para lançar placar */
  playable: boolean;
  /** partida decidida (com placar ou por W.O.) */
  decided: boolean;
  /** partida fantasma criada por bye — não é exibida */
  isBye: boolean;
  isDraw: boolean;
};

export type StandingRow = {
  pid: string | null;
  name: string;
  seed: number | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  scored: number;
  against: number;
  diff: number;
  points: number;
  position: number;
  qualified: boolean;
  /** rótulo do destino do classificado, ex: "avança para LR2-1" */
  destination: string | null;
};

export type ResolvedGroup = GroupSpec & {
  standings: StandingRow[];
  complete: boolean;
  matchIds: string[];
};

export type Column = {
  key: string;
  label: string;
  sublabel: string | null;
  kind: "matches" | "standings";
  matches: ResolvedMatch[];
  groupKey: string | null;
};

export type ResolvedBracket = {
  columns: Column[][];
  groups: ResolvedGroup[];
  matches: ResolvedMatch[];
  championId: string | null;
  playedCount: number;
  totalCount: number;
};

function ordinal(n: number) {
  return `${n}º`;
}

export function resolveBracket(
  format: TournamentFormat,
  config: TournamentConfig,
  participants: Participant[],
  stored: StoredMatch[],
  groups: GroupSpec[],
): ResolvedBracket {
  const pById = new Map(participants.map((p) => [p.id, p]));
  const byId = new Map(stored.map((m) => [m.id, m]));
  const groupByKey = new Map(groups.map((g) => [g.key, g]));

  type State = {
    aPid: string | null;
    bPid: string | null;
    aKnown: boolean;
    bKnown: boolean;
    winner: string | null;
    loser: string | null;
    decided: boolean;
    isBye: boolean;
    isDraw: boolean;
  };
  const state = new Map<string, State>();
  for (const m of stored) {
    state.set(m.id, {
      aPid: null,
      bPid: null,
      aKnown: false,
      bKnown: false,
      winner: null,
      loser: null,
      decided: false,
      isBye: false,
      isDraw: false,
    });
  }

  const groupMatches = new Map<string, StoredMatch[]>();
  for (const m of stored) {
    if (m.stage === "group" && m.groupKey) {
      const arr = groupMatches.get(m.groupKey) ?? [];
      arr.push(m);
      groupMatches.set(m.groupKey, arr);
    }
  }

  const standingsCache = new Map<string, StandingRow[]>();
  const groupComplete = new Map<string, boolean>();

  const sourceLabel = (slot: Slot): string => {
    switch (slot.t) {
      case "empty":
        return "—";
      case "seed":
        return pById.get(slot.pid)?.name ?? "?";
      case "winner": {
        const m = byId.get(slot.m);
        return m ? `Vencedor de ${m.code}` : "?";
      }
      case "loser": {
        const m = byId.get(slot.m);
        return m ? `Perdedor de ${m.code}` : "?";
      }
      case "groupRank": {
        const g = groupByKey.get(slot.g);
        return `${ordinal(slot.rank)} da ${g?.refLabel ?? "Fase de Grupos"}`;
      }
    }
  };

  const resolveSlot = (slot: Slot): { pid: string | null; known: boolean } => {
    switch (slot.t) {
      case "seed":
        return { pid: slot.pid, known: true };
      case "empty":
        return { pid: null, known: true };
      case "winner": {
        const s = state.get(slot.m);
        if (s?.decided) return { pid: s.winner, known: true };
        return { pid: null, known: false };
      }
      case "loser": {
        const s = state.get(slot.m);
        if (s?.decided) return { pid: s.loser, known: true };
        return { pid: null, known: false };
      }
      case "groupRank": {
        if (!groupComplete.get(slot.g)) return { pid: null, known: false };
        const rows = standingsCache.get(slot.g) ?? [];
        return { pid: rows[slot.rank - 1]?.pid ?? null, known: true };
      }
    }
  };

  const computeStandings = (key: string): { rows: StandingRow[]; complete: boolean } => {
    const ms = groupMatches.get(key) ?? [];
    const memberIds = new Set<string>();
    let allKnown = true;
    let allPlayed = true;
    for (const m of ms) {
      const s = state.get(m.id)!;
      if (s.aKnown && s.aPid) memberIds.add(s.aPid);
      if (s.bKnown && s.bPid) memberIds.add(s.bPid);
      if (!s.aKnown || !s.bKnown) allKnown = false;
      if (!s.decided) allPlayed = false;
    }
    const acc = new Map<string, StandingRow>();
    for (const pid of memberIds) {
      const p = pById.get(pid);
      acc.set(pid, {
        pid,
        name: p?.name ?? "?",
        seed: p?.seed ?? null,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        scored: 0,
        against: 0,
        diff: 0,
        points: 0,
        position: 0,
        qualified: false,
        destination: null,
      });
    }
    const head = new Map<string, number>(); // "a|b" => diff no confronto direto
    for (const m of ms) {
      const s = state.get(m.id)!;
      if (!s.aPid || !s.bPid || m.scoreA === null || m.scoreB === null) continue;
      const A = acc.get(s.aPid);
      const B = acc.get(s.bPid);
      if (!A || !B) continue;
      A.played++;
      B.played++;
      A.scored += m.scoreA;
      A.against += m.scoreB;
      B.scored += m.scoreB;
      B.against += m.scoreA;
      if (m.scoreA > m.scoreB) {
        A.wins++;
        B.losses++;
        A.points += config.pointsWin;
      } else if (m.scoreB > m.scoreA) {
        B.wins++;
        A.losses++;
        B.points += config.pointsWin;
      } else {
        A.draws++;
        B.draws++;
        A.points += config.pointsDraw;
        B.points += config.pointsDraw;
      }
      head.set(`${s.aPid}|${s.bPid}`, m.scoreA - m.scoreB);
      head.set(`${s.bPid}|${s.aPid}`, m.scoreB - m.scoreA);
    }
    const rows = [...acc.values()];
    for (const r of rows) r.diff = r.scored - r.against;
    rows.sort((x, y) => {
      if (y.points !== x.points) return y.points - x.points;
      if (y.wins !== x.wins) return y.wins - x.wins;
      const h = head.get(`${x.pid}|${y.pid}`);
      if (h !== undefined && h !== 0) return h > 0 ? -1 : 1;
      if (y.diff !== x.diff) return y.diff - x.diff;
      if (y.scored !== x.scored) return y.scored - x.scored;
      return (x.seed ?? 99) - (y.seed ?? 99);
    });
    rows.forEach((r, i) => {
      r.position = i + 1;
    });
    return { rows, complete: allKnown && allPlayed && rows.length > 0 };
  };

  // ponto fixo: repete até nada mudar
  for (let pass = 0; pass < 64; pass++) {
    let changed = false;

    for (const m of stored) {
      const s = state.get(m.id)!;
      const ra = resolveSlot(m.srcA);
      const rb = resolveSlot(m.srcB);
      const next: Partial<State> = {
        aPid: ra.pid,
        bPid: rb.pid,
        aKnown: ra.known,
        bKnown: rb.known,
      };
      let winner: string | null = null;
      let loser: string | null = null;
      let decided = false;
      let isBye = false;
      let isDraw = false;

      const bothKnown = ra.known && rb.known;
      if (bothKnown && ra.pid && !rb.pid) {
        winner = ra.pid;
        decided = true;
        isBye = true;
      } else if (bothKnown && !ra.pid && rb.pid) {
        winner = rb.pid;
        decided = true;
        isBye = true;
      } else if (bothKnown && !ra.pid && !rb.pid) {
        decided = true;
        isBye = true;
      } else if (bothKnown && m.scoreA !== null && m.scoreB !== null) {
        if (m.scoreA > m.scoreB) {
          winner = ra.pid;
          loser = rb.pid;
          decided = true;
        } else if (m.scoreB > m.scoreA) {
          winner = rb.pid;
          loser = ra.pid;
          decided = true;
        } else if (m.stage === "group") {
          decided = true;
          isDraw = true;
        }
      }

      if (
        s.aPid !== next.aPid ||
        s.bPid !== next.bPid ||
        s.aKnown !== next.aKnown ||
        s.bKnown !== next.bKnown ||
        s.winner !== winner ||
        s.loser !== loser ||
        s.decided !== decided ||
        s.isBye !== isBye ||
        s.isDraw !== isDraw
      ) {
        changed = true;
        state.set(m.id, {
          aPid: next.aPid!,
          bPid: next.bPid!,
          aKnown: next.aKnown!,
          bKnown: next.bKnown!,
          winner,
          loser,
          decided,
          isBye,
          isDraw,
        });
      }
    }

    for (const g of groups) {
      const { rows, complete } = computeStandings(g.key);
      const prevRows = standingsCache.get(g.key);
      const sig = rows.map((r) => `${r.pid}:${r.points}:${r.diff}`).join(",");
      const prevSig = prevRows?.map((r) => `${r.pid}:${r.points}:${r.diff}`).join(",");
      if (sig !== prevSig || groupComplete.get(g.key) !== complete) changed = true;
      standingsCache.set(g.key, rows);
      groupComplete.set(g.key, complete);
    }

    if (!changed) break;
  }

  const side = (slot: Slot, pid: string | null, score: number | null, isWinner: boolean): ResolvedSide => {
    const p = pid ? pById.get(pid) : null;
    return {
      pid: pid ?? null,
      name: p?.name ?? null,
      seed: p?.seed ?? null,
      sourceLabel: sourceLabel(slot),
      score,
      isWinner,
    };
  };

  const resolved: ResolvedMatch[] = stored.map((m) => {
    const s = state.get(m.id)!;
    return {
      id: m.id,
      code: m.code,
      stage: m.stage,
      roundIndex: m.roundIndex,
      slotIndex: m.slotIndex,
      groupKey: m.groupKey,
      srcA: m.srcA,
      srcB: m.srcB,
      a: side(m.srcA, s.aPid, m.scoreA, !!s.winner && s.winner === s.aPid),
      b: side(m.srcB, s.bPid, m.scoreB, !!s.winner && s.winner === s.bPid),
      winnerId: s.winner,
      loserId: s.loser,
      playable: !!s.aPid && !!s.bPid,
      decided: s.decided,
      isBye: s.isBye,
      isDraw: s.isDraw,
    };
  });

  const resolvedById = new Map(resolved.map((m) => [m.id, m]));

  /* ---- montagem das colunas ---- */
  const wbRounds = maxRound(stored, "winners");
  const lbRounds = maxRound(stored, "losers");
  const poRounds = maxRound(stored, "playoff");

  const mk = (
    key: string,
    label: string,
    sublabel: string | null,
    ms: ResolvedMatch[],
    kind: Column["kind"] = "matches",
    groupKey: string | null = null,
  ): Column => ({ key, label, sublabel, kind, matches: ms, groupKey });

  const pick = (stage: Stage, round: number) =>
    resolved
      .filter((m) => m.stage === stage && m.roundIndex === round)
      .sort((a, b) => a.slotIndex - b.slotIndex);

  const rows: Column[][] = [];

  if (format === "league") {
    const total = maxRound(stored, "group");
    const half = config.doubleRound ? Math.ceil(total / 2) : total;
    const roundCols: Column[] = [];
    for (let r = 1; r <= total; r++) {
      const ms = pick("group", r);
      const playing = new Set<string>();
      for (const m of ms) {
        if (m.a.pid) playing.add(m.a.pid);
        if (m.b.pid) playing.add(m.b.pid);
      }
      const idle = participants.filter((p) => !playing.has(p.id)).map((p) => p.name);
      const turn = config.doubleRound ? (r <= half ? "1º turno" : "2º turno") : null;
      const sub = [turn, idle.length > 0 ? `folga: ${idle.join(", ")}` : null]
        .filter(Boolean)
        .join(" · ");
      roundCols.push(mk(`r-${r}`, `${ordinal(r)} RODADA`, sub || null, ms));
    }
    // A classificacao entra como coluna propria, sem partidas.
    const g = groups[0];
    const cells = g
      ? [...roundCols, mk(`l-${g.key}`, "CLASSIFICAÇÃO", "tabela final", [], "standings", g.key)]
      : roundCols;
    // Quantas rodadas por faixa: escolhe o arranjo que melhor preenche a folha A4.
    const gamesPerRound = Math.floor(participants.length / 2);
    const rowContentH = Math.max(
      gamesPerRound * (MATCH_BOX_H + MATCH_BOX_GAP),
      PANEL_BOX_H + participants.length * PANEL_ROW,
    );
    const perRow = bestRowSplit(cells.length, rowContentH);
    for (let i = 0; i < cells.length; i += perRow) rows.push(cells.slice(i, i + perRow));
  } else if (format === "groups") {
    const groupCols: Column[] = groups.map((g) =>
      mk(
        `g-${g.key}`,
        g.label.toUpperCase(),
        `todos contra todos · ${g.qualifiers} ${g.qualifiers > 1 ? "classificados" : "classificado"}`,
        (groupMatches.get(g.key) ?? []).map((m) => resolvedById.get(m.id)!),
        "matches",
        g.key,
      ),
    );
    const poCols: Column[] = [];
    for (let r = 1; r <= poRounds; r++) {
      const label = r === poRounds ? "FINAL" : r === poRounds - 1 ? "SEMIFINAL" : `PLAYOFF ${r}`;
      poCols.push(mk(`po-${r}`, label, null, pick("playoff", r)));
    }
    // Grupos e mata-mata na mesma faixa: aproveita a largura da folha A4
    // e permite desenhar as linhas da classificacao ate o playoff.
    rows.push([...groupCols, ...poCols]);
  } else {
    const top: Column[] = [];
    for (let r = 1; r <= wbRounds; r++) {
      const isLast = r === wbRounds;
      const label =
        format === "single"
          ? isLast
            ? "FINAL"
            : r === wbRounds - 1
              ? "SEMIFINAL"
              : `ROUND ${r}`
          : `ROUND ${r}`;
      top.push(mk(`w-${r}`, label, null, pick("winners", r)));
    }
    if (format === "double") top.push(mk("final", "FINAL", null, pick("final", 1)));
    rows.push(top);

    if (lbRounds > 0 || groups.length > 0) {
      const bottom: Column[] = [];
      const g = groups[0];
      if (g) {
        bottom.push(
          mk(
            `g-${g.key}`,
            "FASE DE GRUPOS",
            `${(groupMatches.get(g.key) ?? []).length > 0 ? "perdedores do R1 · todos contra todos" : "perdedores do R1"}`,
            (groupMatches.get(g.key) ?? []).map((m) => resolvedById.get(m.id)!),
            "matches",
            g.key,
          ),
        );
      }
      for (let r = g ? 2 : 1; r <= lbRounds; r++) {
        const label = r === lbRounds ? "LOSERS FINAL" : `LOSERS ROUND ${r}`;
        bottom.push(mk(`l-${r}`, label, null, pick("losers", r)));
      }
      rows.push(bottom);
    }
  }

  /* ---- classificação: destino dos classificados ---- */
  const resolvedGroups: ResolvedGroup[] = groups.map((g) => {
    const st = standingsCache.get(g.key) ?? [];
    const dest = new Map<number, string>();
    for (const m of stored) {
      for (const slot of [m.srcA, m.srcB]) {
        if (slot.t === "groupRank" && slot.g === g.key) dest.set(slot.rank, m.code);
      }
    }
    const rowsOut = st.map((r) => ({
      ...r,
      qualified: g.isLeague ? r.position === 1 : r.position <= g.qualifiers,
      destination: g.isLeague
        ? r.position === 1
          ? groupComplete.get(g.key)
            ? "campeão"
            : "líder"
          : null
        : r.position <= g.qualifiers
          ? dest.has(r.position)
            ? `avança para ${dest.get(r.position)}`
            : "classificado"
          : "eliminado",
    }));
    // quando a fase ainda não tem jogadores definidos, mostra placeholders
    if (rowsOut.length === 0) {
      const total = Math.max(g.qualifiers + 1, 3);
      for (let i = 0; i < total; i++) {
        rowsOut.push({
          pid: null,
          name: "—",
          seed: null,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          scored: 0,
          against: 0,
          diff: 0,
          points: 0,
          position: i + 1,
          qualified: i < g.qualifiers,
          destination:
            i < g.qualifiers
              ? dest.has(i + 1)
                ? `avança para ${dest.get(i + 1)}`
                : "classificado"
              : "eliminado",
        });
      }
    }
    return {
      ...g,
      standings: rowsOut,
      complete: !!groupComplete.get(g.key),
      matchIds: (groupMatches.get(g.key) ?? []).map((m) => m.id),
    };
  });

  const leagueChampion =
    format === "league"
      ? (() => {
          const g = groups[0];
          if (!g) return null;
          const rows2 = resolvedGroups.find((x) => x.key === g.key);
          if (!rows2 || !rows2.complete) return null;
          return rows2.standings[0]?.pid ?? null;
        })()
      : null;

  const decisive =
    format === "double"
      ? resolved.find((m) => m.stage === "final")
      : format === "single"
        ? resolved.find((m) => m.stage === "winners" && m.roundIndex === wbRounds)
        : poRounds > 0
          ? resolved.find((m) => m.stage === "playoff" && m.roundIndex === poRounds)
          : undefined;

  const real = resolved.filter((m) => !m.isBye);
  return {
    columns: rows,
    groups: resolvedGroups,
    matches: resolved,
    championId: leagueChampion ?? decisive?.winnerId ?? null,
    playedCount: real.filter((m) => m.decided).length,
    totalCount: real.length,
  };
}

function maxRound(stored: StoredMatch[], stage: Stage): number {
  return stored.reduce((acc, m) => (m.stage === stage ? Math.max(acc, m.roundIndex) : acc), 0);
}

export function formatLabel(format: TournamentFormat): string {
  if (format === "league") return "Liga (Pontos Corridos)";
  if (format === "single") return "Eliminação Simples";
  if (format === "double") return "Dupla Eliminatória";
  return "Fase de Grupos";
}
