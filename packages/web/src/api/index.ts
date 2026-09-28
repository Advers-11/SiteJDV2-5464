import type { RouterClient } from "@orpc/server";
import { createApp } from "./__core/app";
import { auth } from "./auth";
import { matches } from "./routes/matches";
import { ping } from "./routes/ping";
import { tournaments } from "./routes/tournaments";

export const router = {
  ping,
  tournaments,
  matches,
};

export type AppRouter = typeof router;
/** Typed client for the router — used by the web and mobile api clients. */
export type AppRouterClient = RouterClient<AppRouter>;

const app = createApp(router);
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

export default app;
