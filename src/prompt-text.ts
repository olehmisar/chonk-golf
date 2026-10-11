import { ALL } from "./data.ts";
import template from "./prompt-template.md?raw";
import { fillPrompt, pickLeader } from "./prompt.ts";

/** The participant prompt, filled from the bundled data (same text as /prompt.md, which the build emits). */
export const PROMPT = fillPrompt(
  template,
  ALL.map((x) => x.s),
);
export const PROMPT_LEADER = pickLeader(ALL);
