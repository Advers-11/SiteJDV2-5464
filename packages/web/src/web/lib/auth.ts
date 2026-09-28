import { createAuthClient } from "better-auth/react";

const TOKEN_KEY = "cf_bearer";

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage bloqueado — a sessão vive só nesta aba */
  }
}

function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* noop */
  }
}

/**
 * O preview roda em iframe cross-origin, onde cookies de sessão podem ser
 * bloqueados. Por isso guardamos o bearer token devolvido pelo Better Auth
 * e o reenviamos em toda requisição.
 */
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: "/api/auth",
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: () => getToken(),
    },
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get("set-auth-token");
      if (token) setToken(token);
    },
  },
});

export async function signOut() {
  try {
    await authClient.signOut();
  } finally {
    clearToken();
  }
}
