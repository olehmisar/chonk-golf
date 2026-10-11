import { useEffect } from "react";
import { BY_ID } from "./data.ts";
import { Layout } from "./components/Layout.tsx";
import { Leaderboard } from "./pages/Leaderboard.tsx";
import { NotFound } from "./pages/NotFound.tsx";
import { Rules } from "./pages/Rules.tsx";
import { Submit } from "./pages/Submit.tsx";
import { SubmissionPage } from "./pages/Submission.tsx";
import { useRoute, type Route } from "./router.ts";

function title(route: Route): string {
  switch (route.name) {
    case "board":
      return "chonk.golf";
    case "submission":
      return `${BY_ID.get(route.id)?.s.title ?? route.id} · chonk.golf`;
    case "rules":
      return "Rules · chonk.golf";
    case "submit":
      return "Submit · chonk.golf";
    default:
      return "Out of bounds · chonk.golf";
  }
}

export default function App() {
  const route = useRoute();
  useEffect(() => {
    document.title = title(route);
  }, [route]);
  return (
    <Layout route={route}>
      {route.name === "board" && <Leaderboard />}
      {route.name === "submission" && <SubmissionPage id={route.id} />}
      {route.name === "rules" && <Rules />}
      {route.name === "submit" && <Submit />}
      {route.name === "notfound" && <NotFound />}
    </Layout>
  );
}
