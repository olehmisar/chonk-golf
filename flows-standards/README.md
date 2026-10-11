# aztec-standards Token flows (headline benchmark)

The **main flow to optimise** is a private→private token transfer from
[AztecProtocol/aztec-standards](https://github.com/AztecProtocol/aztec-standards) (`src/token_contract`,
`transfer_private_to_private`). This folder holds that flow, plus two neighbouring ones, as Chonk inputs
(`ivc-inputs.msgpack`) that the pinned `bb15fcb` prover proves.

| Flow | Chonk steps |
|---|---|
| `standards_token_transfer_private_to_private` (**headline**) | SchnorrInitializerlessAccount:entrypoint → Token:transfer_private_to_private → HandshakeRegistry:non_interactive_handshake → private_kernel_init_3 → private_kernel_reset_tail → hiding_kernel |
| `standards_token_mint_to_private` | entrypoint → Token:mint_to_private → HandshakeRegistry:non_interactive_handshake → private_kernel_init_3 → private_kernel_reset_tail_to_public → hiding_kernel |
| `standards_token_transfer_private_to_public` | entrypoint → Token:transfer_private_to_public → private_kernel_init_2 → private_kernel_reset_tail_to_public → hiding_kernel |

## How they were captured

The capture follows aztec-packages' `.claude/skills/capture-app-flow` recipe.

- **Code:** aztec-standards `main` at `cdfba94`, which pins `@aztec-labs/*` and `@aztec-foundation/bb.js` at
  `6.0.0-rc.1` (noir 1.0.0-rc.3).
- **Toolchain and network:** the matching toolchain, installed with `aztec-up` (Node 24.12; Foundry 1.4.1 taken from
  the GitHub release tarball because the foundryup attestation download is blocked here), running
  `aztec start --local-network`.
- **Contracts:** compiled with `aztec compile` and `aztec codegen`.
- **Capture:** `capture.test.ts`, copied into `aztec-standards/src/ts/test/`, runs the same setup as the repo's
  `benchmarks/token_contract.benchmark.ts`. It deploys the token with `constructor_with_minter` and, for each step,
  calls `profile({profileMode: 'full', skipProofGeneration: true, from: alice})` →
  `serializePrivateExecutionSteps` → `send`, so every capture sees the right chain state. The sender is alice, the
  first funded local-network account; the fee is paid by the account itself in fee juice, not through an FPC.

### Version compatibility

The app is on the v6.0.0-rc.1 line, while the prover we optimise is `next` at `bb15fcb` (v7 line). Between the two
tags, the ACIR serde and the Chonk execution-step format (`chonk/private_execution_steps.*`) are unchanged.

`bb check --scheme chonk` with the `bb15fcb` prover passes on all three flows, meaning the precomputed VKs embedded by
the v6 toolchain equal the ones `bb15fcb` derives. Proving with `bb15fcb` (unmodified + harness) succeeds and
`bb verify` accepts the proofs. So these are exactly the circuits an app on 6.0.0-rc.1 proves, run through our prover.

## Files

- `<flow>/ivc-inputs.msgpack.gz` — the inputs; unpack with `WORK=... ./unpack.sh`, which writes
  `$WORK/flows-standards/<flow>/ivc-inputs.msgpack`.
- `proof_vk_sha256.txt` — proof and VK SHA-256 from the **unmodified** `bb15fcb` prover + harness patches, with
  `BB_DETERMINISTIC_PROVING=42`.
- `capture.test.ts` — the capture script.

```bash
WORK=$HOME/bbwork ./unpack.sh
FLOWS=$HOME/bbwork/flows-standards REF=$PWD/proof_vk_sha256.txt ../scripts/check_identical.sh <bb>
FLOWS=$HOME/bbwork/flows-standards ../scripts/ab.sh <baseline bb> <candidate bb> 7 .
```

## Results (integ5 vs unmodified, 4-vCPU Xeon without IFMA)

The A/B uses `ab.sh`, interleaved, 7 reps; times are min/median.

| Flow | time (s) | ratio | peak RSS (MiB) | ratio |
|---|---|---|---|---|
| **transfer_private_to_private** | 5.94 → **4.04** (med 6.16 → 4.40) | **0.681** | 307.0 → **266.6** | **0.868** |
| mint_to_private | 6.14 → 4.53 | 0.738 | 306.1 → 271.9 | 0.888 |
| transfer_private_to_public | 5.60 → 3.99 | 0.712 | 298.3 → 269.9 | 0.905 |
| total | 17.68 → 12.56 | 0.711 | 911 → 808 | 0.887 |

Correctness of integ5 on these flows:

- `check_identical.sh` reports 3/3 IDENTICAL.
- Stock npm `@aztec-foundation/bb.js@7.0.0-nightly.20261009` (`ts-verify/stock_bbjs_verify.mjs`) verifies all 3 flows,
  rejects all 3 tampered proofs, and every VK equals the unmodified prover's.

### Where integ5 still spends time on the headline flow

This is a single `--print_bench` run (`ChonkAPI::prove`: 6220 ms unmodified, 4405 ms integ5); figures are inclusive ms.

| Component | unmodified | integ5 |
|---|---|---|
| ChonkAccumulate (6 steps: circuit build + Oink + HyperNova fold) | 2913 | 2185 |
| — MSM in Oink commitments (`batch_commit`) | 1641 | 1289 |
| — HyperNova sumcheck | 583 | 410 |
| — create_circuit | 262 | 168 |
| ChonkProve | 2981 | 2094 |
| — BatchedHonkTranslatorProver::prove | 1546 | 1020 |
| — ECCVM prover | 1001 | 692 |
| — HypernovaDecider | 420 | 318 |
| MSM total (`Stage6a_bucket_partials` alone, both call sites) | ~2025 | ~1515 |

MSM is still about 45% of integ5's time on this flow. That figure is for this VM, which has no AVX-512 IFMA; on IFMA
hardware integ5's runtime-dispatched IFMA drain takes a further ~20% off total time.
