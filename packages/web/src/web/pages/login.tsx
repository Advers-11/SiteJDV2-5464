import { useState } from "react";
import { useLocation } from "wouter";
import { Shell } from "../components/shell";
import { authClient } from "../lib/auth";

type Mode = "in" | "up";

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: "var(--color-mid)" }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3.5 py-2.5 text-[14px] outline-none focus:border-[var(--color-teal)]"
        style={{
          borderColor: "var(--color-ink-500)",
          background: "var(--color-ink-900)",
          color: "var(--color-hi)",
        }}
      />
    </label>
  );
}

function Login() {
  const [mode, setMode] = useState<Mode>("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, navigate] = useLocation();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res =
        mode === "in"
          ? await authClient.signIn.email({ email: email.trim(), password })
          : await authClient.signUp.email({
              email: email.trim(),
              password,
              name: name.trim() || email.trim().split("@")[0],
            });
      if (res.error) {
        setError(
          res.error.message ??
            (mode === "in" ? "E-mail ou senha incorretos." : "Não foi possível criar a conta."),
        );
        return;
      }
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="mx-auto max-w-[420px] py-6">
        <div
          className="rise rounded-2xl border p-6"
          style={{ borderColor: "var(--color-ink-600)", background: "var(--color-ink-800)" }}
        >
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700 }}>
            {mode === "in" ? "Entrar" : "Criar conta"}
          </h1>
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-low)" }}>
            Sua conta guarda todos os seus chaveamentos e placares.
          </p>

          <form className="mt-5 grid gap-3.5" onSubmit={submit}>
            {mode === "up" && (
              <Field label="Nome" type="text" value={name} onChange={setName} placeholder="Como te chamam" autoComplete="name" />
            )}
            <Field
              label="E-mail"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="voce@email.com"
              autoComplete="email"
            />
            <Field
              label="Senha"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="mínimo 8 caracteres"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
            />

            {error && (
              <p className="text-[12.5px]" style={{ color: "var(--color-coral)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="rounded-lg py-3 text-[14px] font-semibold disabled:opacity-60"
              style={{ background: "var(--color-coral)", color: "#fff" }}
            >
              {busy ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <button
            type="button"
            className="mt-4 text-[12.5px]"
            style={{ color: "var(--color-mid)" }}
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setError(null);
            }}
          >
            {mode === "in" ? "Não tenho conta — criar uma" : "Já tenho conta — entrar"}
          </button>
        </div>

        <p className="mt-4 text-center text-[12px]" style={{ color: "var(--color-low)" }}>
          Para só ver um chaveamento compartilhado você não precisa de conta.
        </p>
      </div>
    </Shell>
  );
}

export default Login;
