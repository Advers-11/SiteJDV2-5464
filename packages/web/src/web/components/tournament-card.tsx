import { Link } from "wouter";

const STRIPES = ["var(--color-teal)", "var(--color-coral)", "var(--color-violet)", "var(--color-amber)"];

function stripeFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 9973;
  return STRIPES[h % STRIPES.length];
}

export type TournamentSummary = {
  id: string;
  slug: string;
  name: string;
  formatLabel: string;
  participantCount: number;
  playedCount: number;
  totalCount: number;
  champion: string | null;
  hasEditPassword: boolean;
};

export function TournamentCard({
  t,
  onDelete,
  deleting,
}: {
  t: TournamentSummary;
  onDelete: (slug: string) => void;
  deleting: boolean;
}) {
  const pct = t.totalCount > 0 ? Math.round((t.playedCount / t.totalCount) * 100) : 0;
  const stripe = stripeFor(t.id);

  return (
    <div
      className="group relative overflow-hidden rounded-xl border transition-colors hover:border-[var(--color-ink-500)]"
      style={{ borderColor: "var(--color-ink-600)", background: "var(--color-ink-800)" }}
    >
      <span className="absolute inset-x-0 top-0" style={{ height: 4, background: stripe }} />
      <Link href={`/t/${t.slug}`} className="block px-5 pt-6 pb-4">
        <h3
          className="truncate"
          style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700 }}
        >
          {t.name}
        </h3>
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--color-low)" }}>
          {t.formatLabel} · {t.participantCount} participantes
          {t.hasEditPassword ? " · senha de edição" : ""}
        </p>

        <div className="mt-4 flex items-center gap-2.5">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ background: "var(--color-ink-600)" }}
          >
            <span
              className="block h-full rounded-full transition-[width] duration-500"
              style={{ width: `${pct}%`, background: stripe }}
            />
          </div>
          <span
            className="tabular-nums text-[11.5px] font-semibold"
            style={{ color: "var(--color-mid)" }}
          >
            {t.playedCount}/{t.totalCount}
          </span>
        </div>

        <p className="mt-3 text-[12.5px]" style={{ color: t.champion ? "var(--color-teal)" : "var(--color-low)" }}>
          {t.champion ? `Campeão: ${t.champion}` : "Em andamento"}
        </p>
      </Link>

      <div
        className="flex items-center justify-between border-t px-5 py-2.5"
        style={{ borderColor: "var(--color-ink-700)" }}
      >
        <Link href={`/t/${t.slug}`} className="text-[12.5px] font-semibold" style={{ color: "var(--color-mid)" }}>
          Abrir chaveamento
        </Link>
        <button
          type="button"
          disabled={deleting}
          onClick={() => {
            if (confirm(`Excluir "${t.name}"? Isso não pode ser desfeito.`)) onDelete(t.slug);
          }}
          className="text-[12.5px] opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-40"
          style={{ color: "var(--color-coral)" }}
        >
          Excluir
        </button>
      </div>
    </div>
  );
}
