import { Link } from "wouter";
import { Shell } from "../components/shell";
import { TournamentCard } from "../components/tournament-card";
import { authClient } from "../lib/auth";
import { useDeleteTournament, useTournaments } from "../queries/tournaments";

const FEATURES = [
  {
    t: "Placar de verdade",
    d: "Lance 3 x 1 em cada partida. O vencedor avança sozinho e o perdedor cai na chave de perdedores.",
    c: "var(--color-teal)",
  },
  {
    t: "Três formatos",
    d: "Eliminação simples, dupla eliminação (com fase de grupos entre os perdedores) ou grupos + playoff.",
    c: "var(--color-coral)",
  },
  {
    t: "Impressão A4",
    d: "A folha na tela é a folha impressa: uma página A4 paisagem, limpa, pronta para colar na parede.",
    c: "var(--color-violet)",
  },
  {
    t: "Link para a galera",
    d: "Compartilhe o link público. Quem tiver a senha de edição também lança placares.",
    c: "var(--color-amber)",
  },
];

function Hero({ logged }: { logged: boolean }) {
  return (
    <section className="rise pt-6 pb-10">
      <span
        className="inline-block rounded-full border px-3 py-1 text-[11.5px] font-semibold tracking-wide uppercase"
        style={{ borderColor: "var(--color-ink-600)", color: "var(--color-mid)" }}
      >
        Chaveamentos de torneio
      </span>
      <h1
        className="mt-5 max-w-[19ch]"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(38px, 6vw, 62px)",
          lineHeight: 1.02,
          fontWeight: 800,
          letterSpacing: "-0.025em",
        }}
      >
        Monte o chaveamento.{" "}
        <span style={{ color: "var(--color-coral)" }}>Lance o placar.</span> Imprima.
      </h1>
      <p className="mt-5 max-w-[58ch] text-[15.5px] leading-relaxed" style={{ color: "var(--color-mid)" }}>
        Crie chaveamentos que se atualizam sozinhos conforme os resultados entram, com sorteio
        automático, fase de grupos para os perdedores e exportação em A4 para impressão.
      </p>
      <div className="mt-7 flex flex-wrap items-center gap-2.5">
        <Link
          href={logged ? "/criar" : "/entrar"}
          className="rounded-lg px-5 py-3 text-[14px] font-semibold"
          style={{ background: "var(--color-coral)", color: "#fff" }}
        >
          {logged ? "Criar chaveamento" : "Começar agora"}
        </Link>
        {!logged && (
          <Link
            href="/entrar"
            className="rounded-lg border px-5 py-3 text-[14px] font-semibold"
            style={{ borderColor: "var(--color-ink-500)", color: "var(--color-hi)" }}
          >
            Já tenho conta
          </Link>
        )}
      </div>

      <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <div
            key={f.t}
            className="rise rounded-xl border p-4"
            style={{
              borderColor: "var(--color-ink-600)",
              background: "var(--color-ink-800)",
              animationDelay: `${0.06 * i + 0.1}s`,
            }}
          >
            <span className="block rounded-full" style={{ width: 26, height: 3, background: f.c }} />
            <h3 className="mt-3 text-[14.5px] font-semibold">{f.t}</h3>
            <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--color-low)" }}>
              {f.d}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MyTournaments() {
  const list = useTournaments(true);
  const del = useDeleteTournament();

  return (
    <section className="rise">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700 }}>
            Meus chaveamentos
          </h2>
          <p className="mt-1 text-[13px]" style={{ color: "var(--color-low)" }}>
            Clique para abrir, lançar placares e imprimir.
          </p>
        </div>
        <Link
          href="/criar"
          className="rounded-lg px-4 py-2.5 text-[13px] font-semibold"
          style={{ background: "var(--color-coral)", color: "#fff" }}
        >
          Novo
        </Link>
      </div>

      {list.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[168px] animate-pulse rounded-xl border"
              style={{ borderColor: "var(--color-ink-600)", background: "var(--color-ink-800)" }}
            />
          ))}
        </div>
      ) : list.isError ? (
        <p className="text-[13px]" style={{ color: "var(--color-coral)" }}>
          Não foi possível carregar seus chaveamentos.
        </p>
      ) : (list.data?.length ?? 0) === 0 ? (
        <div
          className="rounded-xl border border-dashed p-10 text-center"
          style={{ borderColor: "var(--color-ink-500)" }}
        >
          <p className="text-[14.5px] font-semibold">Nenhum chaveamento ainda</p>
          <p className="mx-auto mt-1.5 max-w-[46ch] text-[13px]" style={{ color: "var(--color-low)" }}>
            Comece com o formato de dupla eliminação e fase de grupos entre os perdedores — o mesmo
            modelo da folha impressa.
          </p>
          <Link
            href="/criar"
            className="mt-5 inline-block rounded-lg px-5 py-2.5 text-[13.5px] font-semibold"
            style={{ background: "var(--color-teal)", color: "#04211d" }}
          >
            Criar o primeiro
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.data?.map((t) => (
            <TournamentCard
              key={t.id}
              t={t}
              deleting={del.isPending}
              onDelete={(slug) => del.mutate({ slug })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Index() {
  const { data: session, isPending } = authClient.useSession();
  const logged = !!session?.user;

  return (
    <Shell>
      {isPending ? (
        <div className="py-20 text-center text-[13px]" style={{ color: "var(--color-low)" }}>
          Carregando…
        </div>
      ) : logged ? (
        <MyTournaments />
      ) : (
        <Hero logged={false} />
      )}
    </Shell>
  );
}

export default Index;
