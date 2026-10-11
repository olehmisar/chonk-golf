# Track: fields (`ecc/fields/` native arithmetic)

**Status: no patch in this track.** The one win found here, batched Bernstein-Yang divsteps, duplicates
`integrated/0007` (MSM track, msm/0001), which landed first. Re-checked on top of `integrated/0007`: the two
Native5x64 kernels are the same algorithm. They return bit-identical matrices on 30M random inputs and identical
inverses on 200k Fq inputs, and run at the same speed on this VM (1.11 µs per Fq inversion each). So there is no
delta to contribute, and `contrib/fields/0001` was withdrawn. The measurements below are kept because they show
what `integrated/0007` buys on this VM.

## (withdrawn, = integrated/0007) Bernstein-Yang: batched divsteps (ctz + multi-bit cancellation)

File: `ecc/fields/bernstein_yang_inverse.hpp`, only `Native5x64::compute_divstep_matrix` (the WASM `Wasm9x29`
kernel is untouched).

`field::invert()` (used once per batch in every MSM bucket drain, batch-affine add, batch_invert, ...) spends most
of its time in the 62-divstep inner loop, which took one divstep per iteration with a data-dependent three-way
branch. The new loop performs the _same_ 62 divsteps several at a time, following libsecp256k1's
`divsteps_62_var` (written with η = −δ):

- a run of z even-g steps is one `ctz` + shifts (a sentinel bit caps it at the steps left in the batch);
- a run of odd-g non-swap steps adds f·2^j for each odd bit j, i.e. g += w·f with w = −g/f mod 2^k, cancelling
  k ≤ min(η+1, 4) bits (6 right after a swap) per iteration; k ≤ η+1 guarantees no swap would have happened
  inside the run.

**Why the output is identical:** the function returns exactly the same transition matrix (u, v, q, r) and the same
updated δ as the step-at-a-time loop, so `apply_divstep_matrix`, the iteration count and the returned inverse are
unchanged (and an inverse mod p is unique anyway). Checked bit-for-bit on 30M random (f, g, δ) inputs (including
g = 0, sparse g, large |δ|) and on 200k full BN254-Fq inversions against the original header
(`by_divstep_equivalence.cpp`; the same harness compares any two versions of the header). A branchless (cmov) variant of the swap was also tried and was slower
(133 vs 98 ns/batch: longer loop-carried dependency), so the branchy form is kept.

Microbench (this VM, -O3 -march=skylake):

|                                            | before  | after   |
| ------------------------------------------ | ------- | ------- |
| one 62-divstep batch                       | 245 ns  | 97 ns   |
| `invert_vartime` (BN254 Fq, avg 9 batches) | 2.39 µs | 1.11 µs |

Profile share of `invert_vartime` (perf, transfer_1_recursions+private_fpc): 4.9% → 2.2% of CPU.

### End-to-end (`ab.sh bb-start bb-fields 3 .`, min of 3, interleaved)

```
deploy_ecdsar1+sponsored_fpc                               A min   3.78 med   3.79 | B min   3.64 med   3.70 | B/A(min) 0.964
deploy_schnorr+sponsored_fpc                               A min   3.45 med   3.52 | B min   3.37 med   3.42 | B/A(min) 0.977
ecdsar1+amm_add_liquidity_1_recursions+sponsored_fpc       A min   5.67 med   5.70 | B min   5.49 med   5.57 | B/A(min) 0.968
ecdsar1+deploy_tokenContract_with_registration+sponsored_f A min   4.35 med   4.37 | B min   4.25 med   4.34 | B/A(min) 0.977
ecdsar1+storage_proof_7_layers+sponsored_fpc               A min  10.65 med  10.66 | B min  10.35 med  10.44 | B/A(min) 0.972
ecdsar1+token_bridge_claim_private+sponsored_fpc           A min   3.86 med   3.96 | B min   3.69 med   3.77 | B/A(min) 0.956
ecdsar1+transfer_0_recursions+private_fpc                  A min   4.88 med   4.89 | B min   4.70 med   4.75 | B/A(min) 0.963
ecdsar1+transfer_0_recursions+sponsored_fpc                A min   3.29 med   3.33 | B min   3.17 med   3.22 | B/A(min) 0.963
ecdsar1+transfer_1_recursions+private_fpc                  A min   5.14 med   5.25 | B min   4.98 med   5.02 | B/A(min) 0.969
ecdsar1+transfer_1_recursions+sponsored_fpc                A min   3.57 med   3.66 | B min   3.44 med   3.47 | B/A(min) 0.964
schnorr+deploy_tokenContract_with_registration+sponsored_f A min   4.18 med   4.20 | B min   3.97 med   4.01 | B/A(min) 0.950
TOTAL(min) A 52.82 B 51.06 ratio 0.967
```

### Per phase (`--print_bench`, ecdsar1+transfer_1_recursions+private_fpc, ms)

| phase                                       | before | after | ratio |
| ------------------------------------------- | ------ | ----- | ----- |
| ChonkAPI::prove                             | 5120   | 4950  | 0.967 |
| ChonkAccumulate                             | 3170   | 3070  | 0.968 |
| OinkProver::prove                           | 1260   | 1210  | 0.960 |
| MSM_fast::batch_multi_scalar_mul            | 1460   | 1370  | 0.938 |
| MSM_fast::Stage6a_bucket_partials           | 898    | 838   | 0.934 |
| MSM_fast::Stage6b_reduce_cross_thread       | 190    | 177   | 0.930 |
| HypernovaFoldingProver::sumcheck            | 774    | 771   | 0.996 |
| HypernovaDeciderProver::construct_proof     | 354    | 332   | 0.936 |
| ChonkProve                                  | 1740   | 1660  | 0.954 |
| BatchedHonkTranslatorProver::prove          | 809    | 800   | 0.988 |
| Goblin::prove_eccvm                         | 661    | 610   | 0.922 |
| IPA::compute_opening_proof                  | 200    | 191   | 0.956 |
| ECCVMProver::execute_wire_commitments_round | 189    | 159   | 0.841 |

The wins are where inversions sit: MSM bucket drains (Stage6a/6b, one inversion per batch-affine round), ECCVM
wire commitments (Grumpkin MSMs) and the PCS commitments; sumcheck is unchanged.

### Tests

- `ecc_tests` (includes `BernsteinYang*`, field and batch-inversion suites): 1071 passed, 68 skipped, 0 failed.
- `check_identical.sh`: 11/11 IDENTICAL.

## Tried, not kept

- **Field asm constants from a static table instead of stack locals** (`field_impl_x64.hpp`). Every inlined
  mul/add currently re-materialises its constants (modulus, r_inv, 0; ±2p for add/sub) on the stack because they
  are automatic `constexpr` locals bound to `"m"` operands next to a `"memory"` clobber (11 extra instructions per
  mul). A `visibility("hidden")` static table makes them plain RIP-relative operands (a plain `static` local needs a
  GOT register under `-fPIC` and runs out of registers; a single base-pointer register also runs out in
  stack-realigned callers). Result: text +48% from extra inlining, translator sumcheck −10% but Mega sumcheck +10%,
  net **+2.5% slower**. Restricting the table to add/sub/reduce_once only: −0.4% over all 11 flows (mixed per flow),
  i.e. noise; dropped.
- **Precise `"m"` operands instead of the `"memory"` clobber** on the field asm: the extra memory operands need
  address registers and the build fails ("inline assembly requires more registers than available") in
  register-starved callers.
- **Returning mul/add results in r12..r15 register outputs** (to free the output-pointer register): fine on its
  own, only explored as an enabler for the two items above.
- **batch_invert with interleaved accumulator chains**: the callers (grand-product step 2b, log-derivative
  inverses) total ~60 ms of a 5.1 s proof, so at most ~0.3% to gain; not pursued.
- **apply_divstep_matrix limb trimming** (shrink f, g as they converge): apply is ~35% of a 1.1 µs inversion, now
  ~1% of CPU in total; not worth the code.

## Notes for further work on Montgomery mul

Microbench of the existing ADX asm (BN254 Fr, this CPU): throughput 13.0–13.5 ns/mul (independent ops), latency
~26 ns for `x = x * x` (`x *= y` with an independent y is 17 ns because a's limbs are consumed one round at a
time). `sqr()` has the same throughput as `mul` (13.3 ns) and slightly _worse_ latency (27.7 ns): its phases are
serialised through the CF/OF chains. The portable C++ `montgomery_mul` is bit-identical, 24.4 ns latency but
14.7 ns throughput. With ~120 µops per mul and ~80 cycles of latency only ~2–3 muls fit in the ROB, so the
"throughput" figure is really latency-bound: a lower-latency schedule (e.g. product first, then reduction rounds
whose only serial path is r[i] → k_i → k_i·p0/p1 → r[i+1], ≈11 cycles/round) should also raise throughput. Any
Montgomery variant with no final subtraction yields bit-identical limbs (K = −ab·p⁻¹ mod R is unique), so such a
rewrite would not even change the [0, 2p) representation. This was not attempted within the time budget.
