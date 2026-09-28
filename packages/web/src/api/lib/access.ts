import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SECRET = process.env.BETTER_AUTH_SECRET ?? "chaveamento-dev-secret";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

/** Token de edição por torneio — guardado no sessionStorage do visitante. */
export function signEditToken(tournamentId: string): string {
  return createHmac("sha256", SECRET).update(`edit:${tournamentId}`).digest("hex");
}

export function verifyEditToken(tournamentId: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const expected = signEditToken(tournamentId);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

/** Remove acentos sem depender de classes unicode no source. */
function stripAccents(input: string): string {
  return input
    .normalize("NFD")
    .split("")
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return !(c >= 0x0300 && c <= 0x036f);
    })
    .join("");
}

const RESERVED = new Set(["criar", "entrar", "api", "t", "novo"]);

export function slugify(name: string): string {
  const base = stripAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const safe = base && !RESERVED.has(base) ? base : "chave";
  const suffix = randomBytes(3).toString("hex");
  return `${safe}-${suffix}`;
}
