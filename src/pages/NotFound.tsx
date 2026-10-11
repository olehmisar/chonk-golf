import { href } from "../router.ts";

export function NotFound({ what = "page" }: { what?: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-display text-6xl font-semibold">OB</p>
      <h1 className="mt-2 font-display text-2xl font-semibold">Out of bounds</h1>
      <p className="mt-2 text-muted">That {what} isn't on the course.</p>
      <a
        href={href.board}
        className="mt-6 inline-block rounded-full bg-fairway px-4 py-2 font-semibold text-fairway-ink no-underline"
      >
        Back to the leaderboard
      </a>
    </div>
  );
}
