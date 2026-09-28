import { useState } from "react";
import { Link, useParams } from "wouter";
import { Shell } from "../components/shell";
import { BracketSheet } from "../components/bracket-sheet";
import { ScoreDialog } from "../components/score-dialog";
import type { ResolvedMatch } from "../../api/lib/bracket";
import { getEditToken } from "../lib/edit-token";
import { useResetAll } from "../queries/matches";
import {
  useRenameParticipant,
  useSetEditPassword,
  useShuffleSeeds,
  useTournament,
  useUnlock,
} from "../queries/tournaments";

const panelStyle: React.CSSProperties = {
  borderColor: "var(--color-ink-600)",
  background: "var(--color-ink-800)",
};

const inputStyle: React.CSSProperties = {
  borderColor: "var(--color-ink-500)",
  background: "var(--color-ink-900)",
  color: "var(--color-hi)",
};

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="rounded-full border px-2.5 py-1 text-[11.5px] font-semibold"
      style={{ borderColor: "var(--color-ink-600)", color: color ?? "var(--color-mid)" }}
    >
      {children}
    </span>
  );
}

function UnlockBox({ slug }: { slug: string }) {
  const unlock = useUnlock(slug);
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="no-print rounded-xl border p-4" style={panelStyle}>
      <h3 className="text-[14px] font-semibold">Modo somente leitura</h3>
      <p className="mt-1 text-[12.5px]" style={{ color: "var(--color-low)" }}>
        Tem a senha de edição? Digite para lançar placares neste navegador.
      </p>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await unlock.mutateAsync({ slug, password: pw });
            setPw("");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Senha incorreta.");
          }
        }}
      >
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="senha de edição"
          className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-[13px] outline-none focus:border-[var(--color-teal)]"
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={unlock.isPending}
          className="rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-60"
          style={{ background: "var(--color-teal)", color: "#04211d" }}
        >
          Liberar
        </button>
      </form>
      {error && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--color-coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function ParticipantsPanel({
  slug,
  participants,
  canShuffle,
}: {
  slug: string;
  participants: { id: string; seed: number; name: string }[];
  canShuffle: boolean;
}) {
  const rename = useRenameParticipant(slug);
  const shuffleSeeds = useShuffleSeeds(slug);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = async (id: string) => {
    const name = draft.trim();
    setEditing(null);
    if (!name) return;
    try {
      await rename.mutateAsync({ slug, editToken: getEditToken(slug), participantId: id, name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível renomear.");
    }
  };

  return (
    <div className="no-print rounded-xl border p-4" style={panelStyle}>
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold">Participantes</h3>
        <button
          type="button"
          disabled={shuffleSeeds.isPending}
          onClick={async () => {
            setError(null);
            try {
              await shuffleSeeds.mutateAsync({ slug, editToken: getEditToken(slug) });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Não foi possível sortear.");
            }
          }}
          className="rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold disabled:opacity-50"
          style={{ borderColor: "var(--color-ink-500)", color: "var(--color-mid)" }}
          title={canShuffle ? "Redistribui os nomes entre as posições" : "Zere os placares para sortear"}
        >
          Sortear
        </button>
      </div>
      <p className="mt-1 text-[12px]" style={{ color: "var(--color-low)" }}>
        Clique em um nome para renomear.
      </p>
      <ul className="mt-3 grid gap-1">
        {participants.map((p) => (
          <li key={p.id} className="flex items-center gap-2">
            <span
              className="w-7 shrink-0 text-right text-[11.5px] font-bold tabular-nums"
              style={{ color: "var(--color-low)" }}
            >
              #{p.seed}
            </span>
            {editing === p.id ? (
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => save(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save(p.id);
                  if (e.key === "Escape") setEditing(null);
                }}
                className="w-full rounded-md border px-2 py-1.5 text-[13px] outline-none"
                style={inputStyle}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditing(p.id);
                  setDraft(p.name);
                }}
                className="w-full truncate rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-[var(--color-ink-700)]"
              >
                {p.name}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--color-coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function OwnerPanel({ slug, hasPassword }: { slug: string; hasPassword: boolean }) {
  const setPassword = useSetEditPassword(slug);
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const link = `${window.location.origin}/t/${slug}`;

  return (
    <div className="no-print rounded-xl border p-4" style={panelStyle}>
      <h3 className="text-[14px] font-semibold">Compartilhar</h3>
      <div className="mt-2.5 flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-[12px] outline-none"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setMsg("Link copiado.");
            } catch {
              setMsg("Copie manualmente o link acima.");
            }
          }}
          className="rounded-lg border px-3 py-2 text-[12.5px] font-semibold"
          style={{ borderColor: "var(--color-ink-500)", color: "var(--color-mid)" }}
        >
          Copiar
        </button>
      </div>

      <h3 className="mt-4 text-[14px] font-semibold">
        Senha de edição {hasPassword ? "(ativa)" : "(não definida)"}
      </h3>
      <div className="mt-2.5 flex gap-2">
        <input
          type="text"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="nova senha (mín. 3)"
          className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-[12.5px] outline-none"
          style={inputStyle}
        />
        <button
          type="button"
          disabled={setPassword.isPending || pw.trim().length < 3}
          onClick={async () => {
            try {
              await setPassword.mutateAsync({ slug, password: pw.trim() });
              setPw("");
              setMsg("Senha atualizada.");
            } catch (err) {
              setMsg(err instanceof Error ? err.message : "Erro ao salvar senha.");
            }
          }}
          className="rounded-lg px-3 py-2 text-[12.5px] font-semibold disabled:opacity-50"
          style={{ background: "var(--color-teal)", color: "#04211d" }}
        >
          Salvar
        </button>
      </div>
      {hasPassword && (
        <button
          type="button"
          className="mt-2 text-[12px]"
          style={{ color: "var(--color-coral)" }}
          onClick={async () => {
            await setPassword.mutateAsync({ slug, password: null });
            setMsg("Senha removida — agora só você edita.");
          }}
        >
          Remover senha
        </button>
      )}
      {msg && (
        <p className="mt-2 text-[12px]" style={{ color: "var(--color-mid)" }}>
          {msg}
        </p>
      )}
    </div>
  );
}

function Tournament() {
  const params = useParams();
  const slug = params.slug ?? "";
  const q = useTournament(slug);
  const resetAll = useResetAll();
  const [picked, setPicked] = useState<ResolvedMatch | null>(null);

  if (q.isLoading) {
    return (
      <Shell>
        <div className="py-24 text-center text-[13px]" style={{ color: "var(--color-low)" }}>
          Carregando chaveamento…
        </div>
      </Shell>
    );
  }

  if (q.isError || !q.data) {
    return (
      <Shell>
        <div className="py-24 text-center">
          <p className="text-[15px] font-semibold">Chaveamento não encontrado</p>
          <Link href="/" className="mt-3 inline-block text-[13px]" style={{ color: "var(--color-teal)" }}>
            Voltar para o início
          </Link>
        </div>
      </Shell>
    );
  }

  const { tournament, participants, bracket, canEdit, isOwner } = q.data;
  const played = bracket.playedCount;
  const total = bracket.totalCount;
  const champion = bracket.championId
    ? (participants.find((p) => p.id === bracket.championId)?.name ?? null)
    : null;
  const hasScores = played > 0;
  const leagueRounds = bracket.matches.reduce((acc, m) => Math.max(acc, m.roundIndex), 0);
  const pickedLive = picked ? (bracket.matches.find((m) => m.id === picked.id) ?? picked) : null;

  return (
    <Shell>
      <div className="no-print mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="text-[12.5px]" style={{ color: "var(--color-low)" }}>
            ← Meus chaveamentos
          </Link>
          <h1
            className="mt-1.5"
            style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}
          >
            {tournament.name}
          </h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Chip>{tournament.formatLabel}</Chip>
            <Chip>{participants.length} participantes</Chip>
            {tournament.format === "league" ? (
              <Chip>{leagueRounds} rodadas</Chip>
            ) : (
              <Chip>chave de {tournament.bracketSize}</Chip>
            )}
            {tournament.losersGroupStage && <Chip color="var(--color-violet)">fase de grupos nos perdedores</Chip>}
            <Chip color={played === total ? "var(--color-teal)" : undefined}>
              {played}/{total} partidas
            </Chip>
            {champion && <Chip color="var(--color-amber)">campeão: {champion}</Chip>}
            {!canEdit && <Chip color="var(--color-coral)">somente leitura</Chip>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg px-4 py-2.5 text-[13px] font-semibold"
            style={{ background: "var(--color-hi)", color: "#14171c" }}
          >
            Imprimir / PDF A4
          </button>
          {canEdit && (
            <button
              type="button"
              disabled={!hasScores || resetAll.isPending}
              onClick={() => {
                if (confirm("Zerar todos os placares deste chaveamento?")) {
                  resetAll.mutate({ slug, editToken: getEditToken(slug) });
                }
              }}
              className="rounded-lg border px-4 py-2.5 text-[13px] font-semibold disabled:opacity-40"
              style={{ borderColor: "var(--color-ink-500)", color: "var(--color-mid)" }}
            >
              Zerar placares
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_270px]">
        <div className="min-w-0">
          <BracketSheet
            printId="print-area"
            title={tournament.name}
            subtitle={
              tournament.note ??
              `${tournament.formatLabel} · ${participants.length} participantes${
                tournament.losersGroupStage ? " · fase de grupos entre os perdedores da R1" : ""
              }`
            }
            footnote={`Placar em cada linha · vencedor destacado${champion ? ` · campeão: ${champion}` : ""}`}
            bracket={bracket}
            canEdit={canEdit}
            onPick={(m) => setPicked(m)}
          />
          {canEdit && (
            <p className="no-print mt-3 text-[12.5px]" style={{ color: "var(--color-low)" }}>
              Clique em uma partida com os dois jogadores definidos para lançar o placar.
            </p>
          )}
        </div>

        <aside className="grid content-start gap-4">
          {!canEdit && tournament.hasEditPassword && <UnlockBox slug={slug} />}
          {canEdit && (
            <ParticipantsPanel slug={slug} participants={participants} canShuffle={!hasScores} />
          )}
          {isOwner && <OwnerPanel slug={slug} hasPassword={tournament.hasEditPassword} />}
        </aside>
      </div>

      {pickedLive && canEdit && (
        <ScoreDialog
          slug={slug}
          match={pickedLive}
          allowDraw={pickedLive.stage === "group"}
          onClose={() => setPicked(null)}
        />
      )}
    </Shell>
  );
}

export default Tournament;
