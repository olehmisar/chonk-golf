import { ALL } from "./data.ts";
import { pickLeader } from "./prompt.ts";
import template from "./prompt-template.md?raw";

/** The participant prompt, verbatim (same text as /prompt.md, which the build emits). */
export const PROMPT = template;
export const PROMPT_LEADER = pickLeader(ALL);
