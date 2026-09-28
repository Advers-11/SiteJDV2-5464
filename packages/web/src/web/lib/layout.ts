/**
 * Geometria da folha de chaveamento.
 *
 * Tudo é posicionado em um único sistema de coordenadas absoluto, o que permite
 * desenhar conectores entre colunas e também entre as duas faixas (chave de
 * vencedores e chave de perdedores) — como a linha que liga a Losers Final à Final.
 */

export const SLOT_H = 26;
export const SLOT_GAP = 3;
export const MATCH_H = SLOT_H * 2 + SLOT_GAP;
export const COL_W = 200;
export const COL_GAP = 46;
export const MATCH_GAP = 16;
export const ROW_GAP = 54;
export const HEADER_H = 34;
export const PANEL_GAP = 22;
export const PANEL_HEADER_H = 30;
export const PANEL_ROW_H = 21;
export const PANEL_PAD = 10;

export type Rect = { x: number; y: number; w: number; h: number };

export type PlacedMatch = Rect & {
  id: string;
  row: number;
  col: number;
};

export type PlacedPanel = Rect & {
  groupKey: string;
  row: number;
  col: number;
  rowCount: number;
};

export type Segment = { x: number; y: number; w: number; h: number };

export type SheetLayout = {
  matches: Map<string, PlacedMatch>;
  panels: Map<string, PlacedPanel>;
  columns: { key: string; label: string; sublabel: string | null; x: number; y: number }[];
  segments: Segment[];
  width: number;
  height: number;
};

export const colX = (col: number) => col * (COL_W + COL_GAP);

export function slotCenterY(m: Rect, side: "a" | "b") {
  return side === "a" ? m.y + SLOT_H / 2 : m.y + SLOT_H + SLOT_GAP + SLOT_H / 2;
}

export function panelRankY(p: PlacedPanel, rank: number) {
  return p.y + PANEL_HEADER_H + (rank - 0.5) * PANEL_ROW_H;
}

/** Linha horizontal (espessura 1). */
export function hLine(x1: number, x2: number, y: number): Segment {
  return { x: Math.min(x1, x2), y: Math.round(y), w: Math.abs(x2 - x1), h: 1 };
}

/** Linha vertical (espessura 1). */
export function vLine(x: number, y1: number, y2: number): Segment {
  return { x: Math.round(x), y: Math.min(y1, y2), w: 1, h: Math.abs(y2 - y1) };
}
