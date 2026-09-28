import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { auth } from "../auth";

/** Auth opcional — `context.user` é o usuário da sessão ou null. */
export const withUser = base.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  return next({
    context: { user: session?.user ?? null, session: session?.session ?? null },
  });
});

/** Procedures protegidas — `context.user` nunca é null. */
export const authed = base.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { user: session.user, session: session.session } });
});
