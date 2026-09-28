import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Shell } from "../components/shell";
import { authClient } from "../lib/auth";
import { useCreateTournament } from "../queries/tournaments";
import { bracketSize, canUseLosersGroupStage, realFirstRoundLosers } from "../../api/lib/bracket";

type Format = "single" | "double" | "groups" | "league";

const FORMATS: { id: Format; label: string; desc: string; accent: string }[] = [
  {
    id: "single",
    label: "Eliminação simples",
    desc: "Quem perde está fora. Rodadas até a final.",
    accent: "var(--color-teal)",
  },
  {
    id: "double",
    label: "Dupla eliminação",
    desc: "Quem perde cai na chave de perdedores e ainda pode voltar.",
    accent: "var(--color-coral)",
  },
  {
    id: "groups",
    label: "Fase de grupos + playoff",
    desc: "Todos jogam contra todos no grupo, os melhores vão ao mata-mata.",
    accent: "var(--color-violet)",
  },
  {
    id: "league",
    label: "Liga de pontos corridos",
    desc: "Turno e returno, uma rodada por vez, folga para quem sobra. Campeão é o líder da tabela.",
    accent: "var(--color-amber)",
  },
];

function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rise relative pl-12" style={{ animationDelay: `${n * 0.05}s` }}>
      <span
        className="absolute left-0 top-0 grid size-8 place-items-center rounded-full border text-[13px] font-bold"
        style={{
          borderColor: "var(--color-ink-500)",
          background: "var(--color-ink-800)",
          color: "var(--color-mid)",
          fontFamily: "var(--font-display)",
        }}
      >
        {n}
      </span>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700 }}>{title}</h2>
      {hint && (
        <p className="mt-1 text-[12.5px]" style={{ color: "var(--color-low)" }}>
          {hint}
        </p>
      )}
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  borderColor: "var(--color-ink-500)",
  background: "var(--color-ink-900)",
  color: "var(--color-hi)",
};

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function Create() {
  const { data: session, isPending } = authClient.useSession();
  const [, navigate] = useLocation();
  const create = useCreateTournament();

  const [name, setName] = useState("");
  const [format, setFormat] = useState<Format>("double");
  const [count, setCount] = useState(7);
  const [names, setNames] = useState<string[]>(Array.from({ length: 7 }, () => ""));
  const [losersGroupStage, setLosersGroupStage] = useState(true);
  const [groupCount, setGroupCount] = useState(2);
  const [qualifiersPerGroup, setQualifiersPerGroup] = useState(2);
  const [doubleRound, setDoubleRound] = useState(true);
  const [pointsWin, setPointsWin] = useState(3);
  const [pointsDraw, setPointsDraw] = useState(1);
  const [editPassword, setEditPassword] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setCountSafe = (raw: number) => {
    const n = Math.max(3, Math.min(32, Math.trunc(raw) || 3));
    setCount(n);
    setNames((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? ""));
  };

  const filled = names.filter((n) => n.trim().length > 0).length;
  const groupEligible = format === "double" && canUseLosersGroupStage(count);
  const losersInR1 = useMemo(() => realFirstRoundLosers(count), [count]);
  const leagueRounds = (count % 2 === 1 ? count : count - 1) * (doubleRound ? 2 : 1);
  const leagueGames = ((count * (count - 1)) / 2) * (doubleRound ? 2 : 1);

  const submit = async () => {
    setError(null);
    const clean = names.map((n, i) => (n.trim() ? n.trim() : `Jogador ${i + 1}`));
    if (!name.trim()) {
      setError("Dê um nome ao chaveamento.");
      return;
    }
    if (format === "groups" && groupCount * 2 > count) {
      setError("Grupos demais para essa quantidade de participantes.");
      return;
    }
    try {
      const res = await create.mutateAsync({
        name: name.trim(),
        format,
        participants: clean,
        note: note.trim() || null,
        editPassword: editPassword.trim().length >= 3 ? editPassword.trim() : null,
        config: {
          losersGroupStage: groupEligible && losersGroupStage,
          doubleRound,
          schedule: null,
          groupCount,
          qualifiersPerGroup,
          playoff: true,
          pointsWin,
          pointsDraw,
        },
      });
      navigate(`/t/${res.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o chaveamento.");
    }
  };

  if (!isPending && !session?.user) {
    return (
      <Shell>
        <div className="py-20 text-center">
          <p className="text-[15px] font-semibold">Entre para criar um chaveamento</p>
          <button
            type="button"
            onClick={() => navigate("/entrar")}
            className="mt-4 rounded-lg px-5 py-2.5 text-[13.5px] font-semibold"
            style={{ background: "var(--color-coral)", color: "#fff" }}
          >
            Entrar
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-[720px]">
        <h1
          className="rise"
          style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em" }}
        >
          Novo chaveamento
        </h1>
        <p className="rise mt-1.5 text-[13.5px]" style={{ color: "var(--color-low)" }}>
          Depois de criar, você pode renomear participantes e lançar placares a qualquer momento.
        </p>

        <div className="mt-9 grid gap-9">
          <Step n={1} title="Nome do torneio">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Copa da Firma 2026"
              className="w-full rounded-lg border px-3.5 py-2.5 text-[14.5px] outline-none focus:border-[var(--color-teal)]"
              style={inputStyle}
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Subtítulo opcional (data, local, modalidade)"
              className="mt-2.5 w-full rounded-lg border px-3.5 py-2.5 text-[13px] outline-none focus:border-[var(--color-teal)]"
              style={inputStyle}
            />
          </Step>

          <Step n={2} title="Formato">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {FORMATS.map((f) => {
                const on = format === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id)}
                    className="rounded-xl border p-3.5 text-left transition-colors"
                    style={{
                      borderColor: on ? f.accent : "var(--color-ink-600)",
                      background: on ? "var(--color-ink-700)" : "var(--color-ink-800)",
                    }}
                  >
                    <span className="block rounded-full" style={{ width: 24, height: 3, background: f.accent }} />
                    <div className="mt-2.5 text-[13.5px] font-semibold">{f.label}</div>
                    <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: "var(--color-low)" }}>
                      {f.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </Step>

          <Step
            n={3}
            title="Participantes"
            hint={
              format === "league"
                ? `${leagueRounds} rodadas · ${leagueGames} jogos · ${count % 2 === 1 ? "1 folga por rodada" : "sem folga"}`
                : `Chave de ${bracketSize(count)} posições · ${bracketSize(count) - count} bye(s) · ${losersInR1} perdedor(es) na 1ª rodada`
            }
          >
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setCountSafe(count - 1)}
                className="size-9 rounded-lg border text-[16px]"
                style={{ borderColor: "var(--color-ink-500)" }}
              >
                −
              </button>
              <input
                type="number"
                min={3}
                max={32}
                value={count}
                onChange={(e) => setCountSafe(Number(e.target.value))}
                className="w-20 rounded-lg border py-2 text-center text-[15px] font-semibold outline-none"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setCountSafe(count + 1)}
                className="size-9 rounded-lg border text-[16px]"
                style={{ borderColor: "var(--color-ink-500)" }}
              >
                +
              </button>
              <span className="ml-2 text-[12.5px]" style={{ color: "var(--color-low)" }}>
                {filled}/{count} nomes preenchidos
              </span>
              <button
                type="button"
                onClick={() => setNames((prev) => shuffle(prev))}
                className="ml-auto rounded-lg border px-3 py-2 text-[12.5px] font-semibold"
                style={{ borderColor: "var(--color-ink-500)", color: "var(--color-mid)" }}
              >
                Sortear ordem
              </button>
            </div>

            <div className="mt-3.5 grid gap-2 sm:grid-cols-2">
              {names.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className="w-7 shrink-0 text-right text-[11.5px] font-bold tabular-nums"
                    style={{ color: "var(--color-low)" }}
                  >
                    #{i + 1}
                  </span>
                  <input
                    value={v}
                    onChange={(e) =>
                      setNames((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))
                    }
                    placeholder={`Jogador ${i + 1}`}
                    className="w-full rounded-lg border px-3 py-2 text-[13.5px] outline-none focus:border-[var(--color-teal)]"
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[11.5px]" style={{ color: "var(--color-low)" }}>
              {format === "league"
                ? "A ordem define a tabela de rodadas. Nomes em branco viram “Jogador N”."
                : "A posição #1 é o primeiro seed e enfrenta o último. Nomes em branco viram “Jogador N”."}
            </p>
          </Step>

          {format === "double" && (
            <Step
              n={4}
              title="Fase de grupos entre os perdedores"
              hint="Igual à folha impressa: os perdedores da 1ª rodada jogam todos contra todos e os melhores seguem na chave de perdedores."
            >
              <button
                type="button"
                disabled={!groupEligible}
                onClick={() => setLosersGroupStage((v) => !v)}
                className="flex w-full items-center gap-3 rounded-xl border p-3.5 text-left disabled:opacity-50"
                style={{
                  borderColor: groupEligible && losersGroupStage ? "var(--color-teal)" : "var(--color-ink-600)",
                  background: "var(--color-ink-800)",
                }}
              >
                <span
                  className="grid size-5 shrink-0 place-items-center rounded-[6px] border"
                  style={{
                    borderColor: groupEligible && losersGroupStage ? "var(--color-teal)" : "var(--color-ink-500)",
                    background: groupEligible && losersGroupStage ? "var(--color-teal)" : "transparent",
                    color: "#04211d",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {groupEligible && losersGroupStage ? "✓" : ""}
                </span>
                <span className="text-[13.5px]">
                  {groupEligible
                    ? `Usar fase de grupos com os ${losersInR1} perdedores da 1ª rodada`
                    : `Indisponível para ${count} participantes (precisa de 3 perdedores na 1ª rodada)`}
                </span>
              </button>
            </Step>
          )}

          {format === "league" && (
            <Step
              n={4}
              title="Turno, returno e pontuação"
              hint={`Tabela de ${leagueRounds} rodadas${count % 2 === 1 ? " com uma folga por rodada" : ""}. Cada rodada vira uma coluna da folha.`}
            >
              <button
                type="button"
                onClick={() => setDoubleRound((v) => !v)}
                className="flex w-full items-center gap-3 rounded-xl border p-3.5 text-left"
                style={{
                  borderColor: doubleRound ? "var(--color-teal)" : "var(--color-ink-600)",
                  background: "var(--color-ink-800)",
                }}
              >
                <span
                  className="grid size-5 shrink-0 place-items-center rounded-[6px] border"
                  style={{
                    borderColor: doubleRound ? "var(--color-teal)" : "var(--color-ink-500)",
                    background: doubleRound ? "var(--color-teal)" : "transparent",
                    color: "#04211d",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {doubleRound ? "✓" : ""}
                </span>
                <span className="text-[13.5px]">
                  Jogar returno com o mando invertido ({leagueGames} jogos no total)
                </span>
              </button>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px]" style={{ color: "var(--color-mid)" }}>
                    Pontos por vitória
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={pointsWin}
                    onChange={(e) => setPointsWin(Math.max(1, Math.min(5, Number(e.target.value) || 3)))}
                    className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px]" style={{ color: "var(--color-mid)" }}>
                    Pontos por empate
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={3}
                    value={pointsDraw}
                    onChange={(e) => setPointsDraw(Math.max(0, Math.min(3, Number(e.target.value) || 0)))}
                    className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none"
                    style={inputStyle}
                  />
                </label>
              </div>
            </Step>
          )}

          {format === "groups" && (
            <Step n={4} title="Grupos e pontuação">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px]" style={{ color: "var(--color-mid)" }}>
                    Quantidade de grupos
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={groupCount}
                    onChange={(e) => setGroupCount(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
                    className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px]" style={{ color: "var(--color-mid)" }}>
                    Classificados por grupo
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={qualifiersPerGroup}
                    onChange={(e) =>
                      setQualifiersPerGroup(Math.max(1, Math.min(8, Number(e.target.value) || 1)))
                    }
                    className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px]" style={{ color: "var(--color-mid)" }}>
                    Pontos por vitória
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={pointsWin}
                    onChange={(e) => setPointsWin(Math.max(1, Math.min(5, Number(e.target.value) || 3)))}
                    className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px]" style={{ color: "var(--color-mid)" }}>
                    Pontos por empate
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={3}
                    value={pointsDraw}
                    onChange={(e) => setPointsDraw(Math.max(0, Math.min(3, Number(e.target.value) || 0)))}
                    className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none"
                    style={inputStyle}
                  />
                </label>
              </div>
            </Step>
          )}

          <Step
            n={5}
            title="Senha de edição (opcional)"
            hint="Quem tiver o link vê o chaveamento. Com a senha, também pode lançar placares."
          >
            <input
              type="text"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="Ex: copa2026 (mínimo 3 caracteres)"
              className="w-full rounded-lg border px-3.5 py-2.5 text-[14px] outline-none focus:border-[var(--color-teal)]"
              style={inputStyle}
            />
          </Step>
        </div>

        {error && (
          <p className="mt-6 text-[13px]" style={{ color: "var(--color-coral)" }}>
            {error}
          </p>
        )}

        <div className="sticky bottom-0 mt-9 flex items-center gap-3 py-5" style={{ background: "linear-gradient(to top, var(--color-ink-900) 60%, transparent)" }}>
          <button
            type="button"
            disabled={create.isPending}
            onClick={submit}
            className="rounded-lg px-6 py-3 text-[14px] font-semibold disabled:opacity-60"
            style={{ background: "var(--color-coral)", color: "#fff" }}
          >
            {create.isPending ? "Gerando chaveamento…" : "Gerar chaveamento"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="text-[13px]"
            style={{ color: "var(--color-low)" }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </Shell>
  );
}

export default Create;
