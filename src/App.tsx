import { Layout } from "./components/Layout.tsx";
import { Leaderboard } from "./pages/Leaderboard.tsx";
import { NotFound } from "./pages/NotFound.tsx";
import { Rules } from "./pages/Rules.tsx";
import { Submit } from "./pages/Submit.tsx";
import { SubmissionPage } from "./pages/Submission.tsx";
import { useRoute } from "./router.ts";

export default function App() {
  const route = useRoute();
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
