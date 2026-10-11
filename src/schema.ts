import { z } from "zod";

/** The 11 pinned Chonk IVC flows (aztec-packages bb15fcb, `bb-chonk-inputs-20ce85424dd7a73d`). */
export const FLOWS = [
  "deploy_ecdsar1+sponsored_fpc",
  "deploy_schnorr+sponsored_fpc",
  "ecdsar1+amm_add_liquidity_1_recursions+sponsored_fpc",
  "ecdsar1+deploy_tokenContract_with_registration+sponsored_fpc",
  "ecdsar1+storage_proof_7_layers+sponsored_fpc",
  "ecdsar1+token_bridge_claim_private+sponsored_fpc",
  "ecdsar1+transfer_0_recursions+private_fpc",
  "ecdsar1+transfer_0_recursions+sponsored_fpc",
  "ecdsar1+transfer_1_recursions+private_fpc",
  "ecdsar1+transfer_1_recursions+sponsored_fpc",
  "schnorr+deploy_tokenContract_with_registration+sponsored_fpc",
] as const;
export const FLOW_COUNT = FLOWS.length;
export const PINNED_AZTEC_COMMIT = "bb15fcbbe969f11a892272715fe59f0976b086ca";
export const PINNED_BBJS = "@aztec-foundation/bb.js@7.0.0-nightly.20261009";

export const flowName = z.enum(FLOWS);

/**
 * aztec-standards Token flows captured with aztec-standards' own 6.0.0-rc.1 toolchain
 * (flows-standards/README.md). The first is the headline benchmark the leaderboard ranks by.
 */
export const STANDARDS_FLOWS = [
  "standards_token_transfer_private_to_private",
  "standards_token_mint_to_private",
  "standards_token_transfer_private_to_public",
] as const;
export const HEADLINE_FLOW = STANDARDS_FLOWS[0];
export const HEADLINE_LABEL = "Token transfer (private → private)";
export const standardsFlowName = z.enum(STANDARDS_FLOWS);

/** A number that was measured, or `null` when the source did not report it. Never invent values. */
const num = z.number().finite().nonnegative().nullable();
const count = z.number().int().min(0).max(FLOW_COUNT).nullable();

const metricsShape = {
  /** Min wall-clock seconds of the reference build (`against`) over `reps` interleaved runs. */
  baseline_wall_s: num,
  /** Min wall-clock seconds of this submission over `reps` interleaved runs. */
  wall_s: num,
  /** Max peak RSS (MiB) of the reference build's `bb` process. */
  baseline_peak_rss_mib: num,
  /** Max peak RSS (MiB) of this submission's `bb` process. */
  peak_rss_mib: num,
  /** Repetitions per binary (interleaved). */
  reps: z.number().int().positive().nullable(),
  /** Published wall-time ratio (wall / baseline); preferred over recomputing from rounded seconds. */
  wall_ratio: z.number().positive().nullable().optional(),
};

export const flowMetrics = z.object({ flow: flowName, ...metricsShape }).strict();
export const standardsFlowMetrics = z.object({ flow: standardsFlowName, ...metricsShape }).strict();

export const patch = z
  .object({
    /** File name of the patch, e.g. `0001-perf-…patch`. */
    name: z.string().min(1),
    /** Link to the patch file in this repo (or anywhere public). */
    url: z.url().nullable(),
    /** One-line description. */
    summary: z.string().nullable().optional(),
  })
  .strict();

export const submission = z
  .object({
    $schema: z.string().optional(),
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "kebab-case id"),
    title: z.string().min(1),
    /** Who / which optimisation track produced it. */
    author: z.string().min(1),
    track: z.string().nullable(),
    /** ISO date (YYYY-MM-DD) of the measurement. */
    date: z.iso.date(),
    /**
     * - `reference`: the unmodified prover (par).
     * - `series`: a full patch series measured against the unmodified prover — ranked on the main leaderboard.
     * - `delta`: a track contribution measured against its own start point (marginal gain) — the practice range.
     */
    kind: z.enum(["reference", "series", "delta"]),
    /** Lifecycle of the patches. */
    status: z.enum(["reference", "integrated", "candidate", "withdrawn", "wip"]),
    /** Which integrated series picked it up, if any (e.g. `integ3`). */
    integrated_in: z.string().nullable(),
    /** Native `bb` or the WASM build through bb.js. */
    target: z.enum(["native", "wasm"]),
    aztec_packages_base: z.string().regex(/^[0-9a-f]{7,40}$/),
    /** What the timing/RSS baseline was: the unmodified prover, or another submission (start point). */
    against: z
      .object({
        id: z.string().nullable(),
        description: z.string().min(1),
      })
      .strict(),
    /** Patches this submission adds on top of `against` (the scored delta). */
    patches: z.array(patch),
    /** Where the full series lives, if it is more than the listed patches. */
    series_url: z.url().nullable().optional(),
    description: z.string().min(1),
    /** Source of the numbers (RESULTS.md, STATUS.md, harness output). */
    source_url: z.url().nullable(),
    machine: z
      .object({
        cpu: z.string().nullable(),
        cores: z.number().int().positive().nullable(),
        ram: z.string().nullable(),
        os: z.string().nullable(),
        compiler: z.string().nullable(),
      })
      .strict(),
    correctness: z
      .object({
        /** Flows whose proof+VK sha256 equal reference/proof_vk_sha256.txt with BB_DETERMINISTIC_PROVING=42. */
        identical_flows: count,
        /** Flows whose real-randomness proof verifies under stock npm bb.js. */
        stock_bbjs_verified_flows: count,
        /** Every one-byte-tampered proof was rejected. */
        tampered_rejected: z.boolean().nullable(),
        /** Every VK equals the unmodified prover's VK. */
        vks_match: z.boolean().nullable(),
        notes: z.string().nullable().optional(),
      })
      .strict(),
    /**
     * Headline totals as reported (sum over measured flows of min wall time). Used when per-flow seconds are not
     * available; otherwise totals are recomputed from `flows`.
     */
    summary: z
      .object({
        baseline_wall_s: num,
        wall_s: num,
        wall_ratio: z.number().positive().nullable(),
        flows_measured: count,
        reps: z.number().int().positive().nullable(),
        notes: z.string().nullable().optional(),
      })
      .strict(),
    flows: z.array(flowMetrics),
    /** Results on the aztec-standards Token flows (the headline benchmark). Absent = not measured. */
    standards: z
      .object({
        /** Toolchain the inputs were captured with, e.g. "aztec-standards cdfba94, 6.0.0-rc.1". */
        toolchain: z.string().min(1),
        source_url: z.url().nullable(),
        machine_note: z.string().nullable(),
        flows: z.array(standardsFlowMetrics).min(1),
        correctness: z
          .object({
            flows_total: z.number().int().positive(),
            identical_flows: z.number().int().min(0).nullable(),
            stock_bbjs_verified_flows: z.number().int().min(0).nullable(),
            tampered_rejected: z.boolean().nullable(),
            vks_match: z.boolean().nullable(),
          })
          .strict(),
      })
      .strict()
      .optional(),
    /** Optional peak-RSS bisect along a patch series: where the RAM went. */
    rss_bisect: z
      .object({
        flows: z.array(flowName).min(1),
        baseline_mib: z.array(z.number().positive()),
        steps: z.array(
          z
            .object({
              after_patch: z.number().int().positive(),
              label: z.string().nullable(),
              rss_mib: z.array(z.number().positive()),
            })
            .strict(),
        ),
        note: z.string().nullable(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    const seen = new Set<string>();
    for (const [i, f] of s.flows.entries()) {
      if (seen.has(f.flow)) {
        ctx.addIssue({
          code: "custom",
          path: ["flows", i, "flow"],
          message: `duplicate flow ${f.flow}`,
        });
      }
      seen.add(f.flow);
    }
    const b = s.rss_bisect;
    if (b) {
      const n = b.flows.length;
      if (b.baseline_mib.length !== n || b.steps.some((st) => st.rss_mib.length !== n)) {
        ctx.addIssue({
          code: "custom",
          path: ["rss_bisect"],
          message: "one RSS value per bisect flow",
        });
      }
    }
    if (s.kind === "series" && s.against.id !== "baseline") {
      ctx.addIssue({
        code: "custom",
        path: ["against", "id"],
        message:
          "a `series` submission is measured against the unmodified baseline (id `baseline`)",
      });
    }
  });

export type Submission = z.infer<typeof submission>;
export type FlowMetrics = z.infer<typeof flowMetrics>;
export type StandardsFlowMetrics = z.infer<typeof standardsFlowMetrics>;
export type StandardsFlowName = (typeof STANDARDS_FLOWS)[number];
export type FlowName = (typeof FLOWS)[number];
