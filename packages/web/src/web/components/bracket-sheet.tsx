import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Column,
  ResolvedBracket,
  ResolvedGroup,
  ResolvedMatch,
  ResolvedSide,
  Slot,
} from "../../api/lib/bracket";
import {
  COL_GAP,
  COL_W,
  HEADER_H,
  MATCH_GAP,
  MATCH_H,
  PANEL_GAP,
  PANEL_HEADER_H,
  PANEL_PAD,
  PANEL_ROW_H,
  ROW_GAP,
  SLOT_GAP,
  SLOT_H,
  colX,
  hLine,
  panelRankY,
  slotCenterY,
  vLine,
  type PlacedMatch,
  type PlacedPanel,
  type Segment,
  type SheetLayout,
} from "../lib/layout";

const SUBLABEL_H = 16;
const PANEL_FOOT_H = 28;
const GUTTER = 26;

function computeLayout(bracket: ResolvedBracket): SheetLayout {
  const matches = new Map<string, PlacedMatch>();
  const panels = new Map<string, PlacedPanel>();
  const columns: SheetLayout["columns"] = [];
  const groupByKey = new Map(bracket.groups.map((g) => [g.key, g]));

  let rowTop = 0;
  let maxBottom = 0;
  let maxRight = 0;

  bracket.columns.forEach((row, rowIndex) => {
    const hasSub = row.some((c) => c.sublabel);
    const contentTop = rowTop + HEADER_H + (hasSub ? SUBLABEL_H : 0);
    let rowBottom = contentTop;

    row.forEach((col, colIndex) => {
      const x = colX(colIndex);
      columns.push({
        key: col.key,
        label: col.label,
        sublabel: col.sublabel,
        x,
        y: rowTop,
      });
      maxRight = Math.max(maxRight, x + COL_W);

      const visible = col.matches.filter((m) => !m.isBye);
      let prevBottom = Number.NEGATIVE_INFINITY;

      for (const m of visible) {
        const refCenters: number[] = [];
        for (const slot of [m.srcA, m.srcB]) {
          if (slot.t !== "winner" && slot.t !== "loser") continue;
          const src = matches.get(slot.m);
          if (src && src.row === rowIndex) refCenters.push(src.y + MATCH_H / 2);
        }
        const desired =
          refCenters.length > 0
            ? refCenters.reduce((a, b) => a + b, 0) / refCenters.length - MATCH_H / 2
            : null;
        const floor =
          prevBottom === Number.NEGATIVE_INFINITY ? contentTop : prevBottom + MATCH_GAP;
        const y = Math.max(desired ?? floor, floor);
        matches.set(m.id, { id: m.id, row: rowIndex, col: colIndex, x, y, w: COL_W, h: MATCH_H });
        prevBottom = y + MATCH_H;
        rowBottom = Math.max(rowBottom, prevBottom);
      }

      if (col.groupKey) {
        const group = groupByKey.get(col.groupKey);
        if (group) {
          const rowCount = group.standings.length;
          const h = PANEL_HEADER_H + rowCount * PANEL_ROW_H + PANEL_PAD + PANEL_FOOT_H;
          const y =
            (prevBottom === Number.NEGATIVE_INFINITY ? contentTop : prevBottom) + PANEL_GAP;
          panels.set(col.groupKey, {
            groupKey: col.groupKey,
            row: rowIndex,
            col: colIndex,
            x,
            y,
            w: COL_W,
            h,
            rowCount,
          });
          rowBottom = Math.max(rowBottom, y + h);
        }
      }
    });

    maxBottom = Math.max(maxBottom, rowBottom);
    rowTop = rowBottom + ROW_GAP;
  });

  /* ---------------- conectores ---------------- */
  const segments: Segment[] = [];
  const allMatches = new Map(bracket.matches.map((m) => [m.id, m]));
  const gutterX = maxRight + GUTTER;
  let usesGutter = false;

  const drawInto = (target: PlacedMatch, side: "a" | "b", fromX: number, fromY: number) => {
    const toY = slotCenterY(target, side);
    const mid = fromX + (target.x - fromX) / 2;
    segments.push(hLine(fromX, mid, fromY));
    if (Math.abs(toY - fromY) > 1) segments.push(vLine(mid, fromY, toY));
    segments.push(hLine(mid, target.x, toY));
  };

  for (const m of bracket.matches) {
    if (m.isBye) continue;
    const target = matches.get(m.id);
    if (!target) continue;

    (["a", "b"] as const).forEach((side) => {
      const slot: Slot = side === "a" ? m.srcA : m.srcB;

      if (slot.t === "winner" || slot.t === "loser") {
        const srcMatch = allMatches.get(slot.m);
        const src = matches.get(slot.m);
        if (!src || !srcMatch || srcMatch.isBye) return;

        if (src.row === target.row) {
          drawInto(target, side, src.x + src.w, src.y + MATCH_H / 2);
          return;
        }
        // Faixas diferentes: só a promoção da chave de perdedores para a Final
        // ganha linha, roteada pela lateral direita. O resto fica como rótulo.
        if (slot.t !== "winner") return;
        usesGutter = true;
        const fromY = src.y + MATCH_H / 2;
        const toY = slotCenterY(target, side);
        segments.push(hLine(src.x + src.w, gutterX, fromY));
        segments.push(vLine(gutterX, fromY, toY));
        segments.push(hLine(target.x + target.w, gutterX, toY));
        return;
      }

      if (slot.t === "groupRank") {
        const panel = panels.get(slot.g);
        // so liga a coluna imediatamente anterior; senao a linha atravessaria
        // os paineis dos outros grupos.
        if (!panel || panel.row !== target.row || panel.col !== target.col - 1) return;
        drawInto(target, side, panel.x + panel.w, panelRankY(panel, slot.rank));
      }
    });
  }

  return {
    matches,
    panels,
    columns,
    segments,
    width: (usesGutter ? gutterX + 2 : maxRight) + 2,
    height: maxBottom + 2,
  };
}

function SideRow({
  side,
  editable,
  dimmed,
}: {
  side: ResolvedSide;
  editable: boolean;
  dimmed: boolean;
}) {
  const named = !!side.name;
  return (
    <div
      className={`flex items-center rounded-[5px] px-2 ${side.isWinner ? "slot slot-win" : "slot"}`}
      style={{ height: SLOT_H }}
    >
      {side.isWinner && (
        <span
          className="mr-1.5 -ml-1 shrink-0 rounded-full"
          style={{ width: 3, height: SLOT_H - 10, background: "var(--color-paper-win-bar)" }}
        />
      )}
      {named && side.seed !== null && (
        <span
          className="mr-1.5 shrink-0 font-semibold"
          style={{ fontSize: 9.5, color: "#96a1ad" }}
        >
          #{side.seed}
        </span>
      )}
      <span
        className="truncate"
        style={{
          fontSize: 11.5,
          fontWeight: named ? 500 : 400,
          fontStyle: named ? "normal" : "italic",
          color: named ? "var(--color-paper-ink)" : "var(--color-paper-muted)",
        }}
      >
        {named ? side.name : side.sourceLabel}
      </span>
      <span
        className="ml-auto shrink-0 tabular-nums"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 12.5,
          fontWeight: 700,
          color: side.score === null ? "#c3cad2" : side.isWinner ? "#0d7f72" : "#5a6472",
        }}
      >
        {side.score === null ? (editable && !dimmed ? "·" : "") : side.score}
      </span>
    </div>
  );
}

function MatchBox({
  match,
  canEdit,
  onPick,
}: {
  match: ResolvedMatch;
  canEdit: boolean;
  onPick: (m: ResolvedMatch) => void;
}) {
  const clickable = canEdit && match.playable;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onPick(match)}
      title={clickable ? `Lançar placar · ${match.code}` : match.code}
      className={`group block w-full text-left ${clickable ? "cursor-pointer" : "cursor-default"}`}
      style={{ height: MATCH_H }}
    >
      <div
        className={`rounded-md transition-shadow ${clickable ? "group-hover:shadow-[0_0_0_2px_rgba(18,165,148,0.35)]" : ""}`}
        style={{ display: "grid", gap: SLOT_GAP }}
      >
        <SideRow side={match.a} editable={clickable} dimmed={!match.playable} />
        <SideRow side={match.b} editable={clickable} dimmed={!match.playable} />
      </div>
    </button>
  );
}

function StandingsPanel({ group, panel }: { group: ResolvedGroup; panel: PlacedPanel }) {
  return (
    <div
      className="overflow-hidden rounded-md border"
      style={{
        borderColor: "var(--color-paper-line)",
        background: "#fbfcfd",
        padding: `${PANEL_PAD / 2}px 9px`,
        height: panel.h,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          height: PANEL_HEADER_H - PANEL_PAD / 2,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#55616f",
          display: "flex",
          alignItems: "center",
        }}
      >
        {group.isLeague
          ? "Pontos corridos"
          : `Classificação ${group.label === "Fase de Grupos" ? "do grupo" : `· ${group.label}`}`}
      </div>
      {group.standings.map((r) => (
        <div
          key={`${r.pid ?? "x"}-${r.position}`}
          className="flex items-center gap-2"
          style={{ height: PANEL_ROW_H, fontSize: 10.5 }}
        >
          <span
            className="shrink-0 font-bold tabular-nums"
            style={{
              color: r.qualified ? "#0d7f72" : group.isLeague ? "#7c8794" : "#c2464f",
              width: 16,
            }}
          >
            {r.position}º
          </span>
          <span
            className="truncate"
            style={{
              color: r.name === "—" ? "var(--color-paper-muted)" : "var(--color-paper-ink)",
              fontWeight: 500,
              minWidth: 0,
              flex: "1 1 auto",
            }}
          >
            {r.name === "—" ? (r.destination ?? "") : r.name}
          </span>
          {r.name !== "—" && (
            <span className="shrink-0 tabular-nums" style={{ color: "#7c8794", fontSize: 9.5 }}>
              {group.isLeague && `${r.played}j · `}
              {r.points}pt · {r.diff >= 0 ? "+" : ""}
              {r.diff}
            </span>
          )}
        </div>
      ))}
      <div
        style={{ fontSize: 8.5, color: "var(--color-paper-muted)", paddingTop: 3, lineHeight: 1.4 }}
      >
        {group.standings
          .filter((r) => r.qualified && r.destination)
          .map((r) => `${r.position}º ${r.destination}`)
          .join(" · ")}
      </div>
      <span className="sr-only">{panel.rowCount} linhas</span>
    </div>
  );
}

export function BracketSheet({
  title,
  subtitle,
  footnote,
  bracket,
  canEdit,
  onPick,
  printId,
}: {
  title: string;
  subtitle: string;
  footnote: string;
  bracket: ResolvedBracket;
  canEdit: boolean;
  onPick: (m: ResolvedMatch) => void;
  printId?: string;
}) {
  const layout = useMemo(() => computeLayout(bracket), [bracket]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapW, setWrapW] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWrapW(e.contentRect.width));
    ro.observe(el);
    setWrapW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  const groupByKey = useMemo(
    () => new Map(bracket.groups.map((g) => [g.key, g])),
    [bracket.groups],
  );
  const matchById = useMemo(
    () => new Map(bracket.matches.map((m) => [m.id, m])),
    [bracket.matches],
  );

  const SHEET_PAD = 30;
  const contentW = layout.width;
  // A4 paisagem a 96dpi, menos margens de 8mm: 1062 x 733 px.
  // Reservamos cabeçalho (~78px) e rodapé (~72px) da folha.
  const printW = 1062;
  const printH = 733 - 150;
  const printScale = Math.min(1, printW / contentW, printH / layout.height);
  const screenScale = wrapW > 0 ? Math.min(1, wrapW / contentW) : 1;

  return (
    <div
      id={printId}
      className="sheet rounded-xl shadow-[0_18px_50px_-24px_rgba(0,0,0,0.7)]"
      style={
        {
          padding: SHEET_PAD,
          "--print-scale": printScale,
          "--print-h": `${Math.ceil(layout.height * printScale)}px`,
          "--print-w": `${Math.ceil(contentW * printScale)}px`,
        } as React.CSSProperties
      }
    >
      <header className="mb-5 text-right">
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 26,
            fontWeight: 700,
            color: "#141a21",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h2>
        <p style={{ fontSize: 11, color: "#6c7784", marginTop: 2 }}>{subtitle}</p>
      </header>

      <div ref={wrapRef} className="sheet-scroll" style={{ overflowX: "auto" }}>
        <div
          className="sheet-scale relative"
          style={{ width: contentW, height: layout.height, zoom: screenScale }}
        >
          {layout.segments.map((s, i) => (
            <span
              key={i}
              className="connector"
              style={{ left: s.x, top: s.y, width: Math.max(1, s.w), height: Math.max(1, s.h) }}
            />
          ))}

          {layout.columns.map((c) => (
            <div key={c.key} style={{ position: "absolute", left: c.x, top: c.y, width: COL_W }}>
              <div className="flex items-center gap-1.5">
                <span className="round-label">{c.label}</span>
                <span style={{ color: "#c3cad2", fontSize: 9 }}>&gt;</span>
              </div>
              <div
                style={{
                  height: 1,
                  background: "var(--color-paper-line)",
                  marginTop: 5,
                  width: COL_W - 32,
                }}
              />
              {c.sublabel && (
                <div style={{ fontSize: 9, color: "#8b95a1", marginTop: 4 }}>{c.sublabel}</div>
              )}
            </div>
          ))}

          {[...layout.matches.values()].map((p) => {
            const m = matchById.get(p.id);
            if (!m) return null;
            return (
              <div key={p.id} style={{ position: "absolute", left: p.x, top: p.y, width: p.w }}>
                <MatchBox match={m} canEdit={canEdit} onPick={onPick} />
              </div>
            );
          })}

          {[...layout.panels.values()].map((p) => {
            const g = groupByKey.get(p.groupKey);
            if (!g) return null;
            return (
              <div key={p.groupKey} style={{ position: "absolute", left: p.x, top: p.y, width: p.w, height: p.h }}>
                <StandingsPanel group={g} panel={p} />
              </div>
            );
          })}
        </div>
      </div>

      <footer
        className="mt-6 border-t pt-3 text-right"
        style={{ borderColor: "var(--color-paper-line)", fontSize: 9.5, color: "#8b95a1" }}
      >
        {footnote}
      </footer>
      <span className="sr-only">{COL_GAP}</span>
    </div>
  );
}

export type { Column, ResolvedMatch };
