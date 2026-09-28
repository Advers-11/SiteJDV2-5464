import { useEffect, useState } from "react";
import type { ResolvedMatch } from "../../api/lib/bracket";
import { useClearScore, useSetScore } from "../queries/matches";
import { getEditToken } from "../lib/edit-token";

function ScoreField({
  label,
  seed,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  seed: number | null;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-3"
      style={{ borderColor: "var(--color-ink-600)", background: "var(--color-ink-700)" }}
    >
      <div className="min-w-0 flex-1">
        {seed !== null && (
          <div className="text-[11px] font-semibold" style={{ color: "var(--color-low)" }}>
            #{seed}
          </div>
        )}
        <div className="truncate text-[15px] font-semibold">{label}</div>
      </div>
      <input
        type="number"
        min={0}
        max={999}
        inputMode="numeric"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        className="w-[74px] rounded-lg border text-center outline-none focus:border-[var(--color-teal)]"
        style={{
          borderColor: "var(--color-ink-500)",
          background: "var(--color-ink-900)",
          color: "var(--color-hi)",
          fontFamily: "var(--font-display)",
          fontSize: 26,
          fontWeight: 700,
          height: 54,
        }}
      />
    </div>
  );
}

export function ScoreDialog({
  slug,
  match,
  allowDraw,
  onClose,
}: {
  slug: string;
  match: ResolvedMatch;
  allowDraw: boolean;
  onClose: () => void;
}) {
  const [a, setA] = useState(match.a.score === null ? "" : String(match.a.score));
  const [b, setB] = useState(match.b.score === null ? "" : String(match.b.score));
  const [error, setError] = useState<string | null>(null);
  const setScore = useSetScore();
  const clearScore = useClearScore();
  const busy = setScore.isPending || clearScore.isPending;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    const na = Number(a);
    const nb = Number(b);
    if (a === "" || b === "" || !Number.isFinite(na) || !Number.isFinite(nb)) {
      setError("Preencha os dois placares.");
      return;
    }
    if (na === nb && !allowDraw) {
      setError("Empate não vale em partida eliminatória — desempate no placar.");
      return;
    }
    try {
      await setScore.mutateAsync({
        slug,
        editToken: getEditToken(slug),
        matchId: match.id,
        scoreA: Math.max(0, Math.trunc(na)),
        scoreB: Math.max(0, Math.trunc(nb)),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    }
  };

  const clear = async () => {
    try {
      await clearScore.mutateAsync({ slug, editToken: getEditToken(slug), matchId: match.id });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível limpar.");
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "rgba(6,8,11,0.72)" }}
      onClick={onClose}
    >
      <div
        className="rise w-full max-w-[420px] rounded-2xl border p-5 shadow-2xl"
        style={{ borderColor: "var(--color-ink-600)", background: "var(--color-ink-800)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between">
          <h3
            style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700 }}
          >
            Placar da partida
          </h3>
          <span className="text-[12px]" style={{ color: "var(--color-low)" }}>
            {match.code}
          </span>
        </div>

        <div className="grid gap-2.5">
          <ScoreField
            autoFocus
            label={match.a.name ?? match.a.sourceLabel}
            seed={match.a.seed}
            value={a}
            onChange={setA}
          />
          <ScoreField
            label={match.b.name ?? match.b.sourceLabel}
            seed={match.b.seed}
            value={b}
            onChange={setB}
          />
        </div>

        {error && (
          <p className="mt-3 text-[12.5px]" style={{ color: "var(--color-coral)" }}>
            {error}
          </p>
        )}

        <p className="mt-3 text-[12px]" style={{ color: "var(--color-low)" }}>
          {allowDraw
            ? "Fase de grupos: empate é permitido."
            : "O vencedor avança automaticamente para a próxima partida."}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="flex-1 rounded-lg py-2.5 text-[13.5px] font-semibold disabled:opacity-60"
            style={{ background: "var(--color-teal)", color: "#04211d" }}
          >
            {setScore.isPending ? "Salvando…" : "Salvar placar"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={clear}
            className="rounded-lg border px-3.5 py-2.5 text-[13.5px] font-semibold disabled:opacity-60"
            style={{ borderColor: "var(--color-ink-500)", color: "var(--color-mid)" }}
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2.5 text-[13.5px]"
            style={{ color: "var(--color-low)" }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
