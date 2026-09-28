import { useState } from "react";
import { Link, useLocation } from "wouter";
import { authClient, signOut } from "../lib/auth";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span
        className="grid place-items-center rounded-[9px]"
        style={{
          width: 30,
          height: 30,
          background: "linear-gradient(140deg, var(--color-teal), #0b7f71)",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M1 3h4.2v3.2h3.4M1 9.8h4.2V13h3.4M8.6 6.2v3.6M8.6 8h6.4"
            stroke="#04211d"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 16.5,
          letterSpacing: "-0.01em",
        }}
      >
        Chaveamento Fácil
      </span>
    </Link>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const [menu, setMenu] = useState(false);
  const [, navigate] = useLocation();

  const user = session?.user;

  return (
    <div className="min-h-screen">
      <header
        className="no-print sticky top-0 z-40 border-b backdrop-blur"
        style={{
          height: 64,
          borderColor: "var(--color-ink-600)",
          background: "color-mix(in srgb, var(--color-ink-900) 88%, transparent)",
        }}
      >
        <div className="mx-auto flex h-full max-w-[1180px] items-center gap-4 px-5">
          <Brand />
          <nav className="ml-auto flex items-center gap-1.5">
            {user && (
              <Link
                href="/criar"
                className="rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors"
                style={{ background: "var(--color-coral)", color: "#fff" }}
              >
                Novo chaveamento
              </Link>
            )}
            {isPending ? null : user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenu((v) => !v)}
                  className="grid size-9 place-items-center rounded-full text-[13px] font-bold"
                  style={{ background: "var(--color-ink-600)", color: "var(--color-hi)" }}
                  title={user.email}
                >
                  {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
                </button>
                {menu && (
                  <div
                    className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border py-1.5 shadow-2xl"
                    style={{
                      borderColor: "var(--color-ink-600)",
                      background: "var(--color-ink-800)",
                    }}
                  >
                    <div
                      className="truncate px-3.5 pt-1 pb-2 text-[12px]"
                      style={{ color: "var(--color-low)" }}
                    >
                      {user.email}
                    </div>
                    <button
                      type="button"
                      className="block w-full px-3.5 py-2 text-left text-[13px] hover:bg-[var(--color-ink-700)]"
                      onClick={() => {
                        setMenu(false);
                        navigate("/");
                      }}
                    >
                      Meus chaveamentos
                    </button>
                    <button
                      type="button"
                      className="block w-full px-3.5 py-2 text-left text-[13px] hover:bg-[var(--color-ink-700)]"
                      style={{ color: "var(--color-coral)" }}
                      onClick={async () => {
                        setMenu(false);
                        await signOut();
                        navigate("/");
                      }}
                    >
                      Sair
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/entrar"
                className="rounded-lg border px-3.5 py-2 text-[13px] font-semibold"
                style={{ borderColor: "var(--color-ink-500)", color: "var(--color-hi)" }}
              >
                Entrar
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1180px] px-5 py-8">{children}</main>
      <footer
        className="no-print mx-auto max-w-[1180px] px-5 pt-4 pb-10 text-[12px]"
        style={{ color: "var(--color-low)" }}
      >
        Chaveamento Fácil · monte, atualize os placares e imprima em A4.
      </footer>
    </div>
  );
}
