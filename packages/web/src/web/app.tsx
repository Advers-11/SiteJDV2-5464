import { Route, Switch } from "wouter";
import Index from "./pages/index";
import Create from "./pages/create";
import Tournament from "./pages/tournament";
import Login from "./pages/login";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/" component={Index} />
        <Route path="/criar" component={Create} />
        <Route path="/t/:slug" component={Tournament} />
        <Route path="/entrar" component={Login} />
        <Route>
          <div className="mx-auto max-w-[600px] px-5 py-24 text-center">
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700 }}>
              Página não encontrada
            </h1>
            <a href="/" className="mt-3 inline-block text-[13px]" style={{ color: "var(--color-teal)" }}>
              Voltar para o início
            </a>
          </div>
        </Route>
      </Switch>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
      {/* "Made with Runable" badge - if user asks to remove the runable badge, remove this code as well as comment */}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
