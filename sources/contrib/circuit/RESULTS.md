# Track: circuit — results

Area: ACIR deserialisation (`dsl/`), native witness computation and gate creation used during circuit construction.
Five patches, `git am`-able on top of `patches/0001-0006` (verified: applying 0001-0006 + these to `bb15fcb`
reproduces the tested tree exactly).

| Patch | Files                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0001  | `dsl/acir_format/serde/{acir,witness_stack,serde}.hpp` | Generated serde decoders: move each decoded enum variant into the `std::variant` (`value = std::move(v)`) instead of deep-copying it; field-name arguments of the `Helpers` are `std::string_view`, so no temporary `std::string` per field (names > 15 chars, e.g. `linear_combinations` on every `Expression`, hit the heap).                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 0002  | `dsl/acir_format/acir_to_constraint_buf.cpp`           | Streaming msgpack-compact decoders. **Program:** the outer arrays are walked by hand; each opcode is unpacked into a reused `msgpack::zone` (STR/BIN reference the input buffer) and fed straight into an incremental `AcirFormatConverter`. The Brillig functions, function name, private parameters and assert messages (~1/3 of the bytes) are skipped with a `null_visitor` instead of being materialised; no whole-program object tree and no full `Acir::Circuit` are built. `circuit_serde_to_acir_format` uses the same converter. **Witness:** the compact witness map is read directly into the `WitnessVector` (no object tree, no `std::map<Witness, std::vector<uint8_t>>`). Anything that is not the expected layout falls back to the existing generic decoders. |
| 0003  | `numeric/uintx/uintx_impl.hpp`                         | `uintx::operator*` skips cross terms whose factor half is zero (and uses the truncating product for the others); `mul_extended` returns the single low product when both high halves are zero. bigfield's native quotient/remainder computation multiplies ~256-bit values held in uint512/uint1024. `barrett_reduction` now uses a `static constexpr` copy of its class-type template parameter (the template parameter object is not 32-byte aligned, which the vectorised zero test faulted on).                                                                                                                                                                                                                                                                             |
| 0004  | `ecc/fields/field_declarations.hpp`                    | `field::one()` / `neg_one()` return a `constexpr` local, i.e. are computed at compile time. `one()` returned `field(1)`, which performed a full Montgomery multiplication **at runtime on every call**; `stdlib::field_t` calls it in every constructor and in `is_normalized()`. (Touches a shared header outside the strict track area — two functions, no other lines.)                                                                                                                                                                                                                                                                                                                                                                                                      |
| 0005  | `honk/execution_trace/execution_trace_block.hpp`       | Gate tiles are stored in fixed 32-tile chunks (`TileStore`) instead of a `std::vector<GateTile>`: appending never relocates existing tiles (the vector's regrowth copies were the largest `memmove` source during circuit construction). Indexing is one extra shift/mask + pointer load; tiles are still value-initialised on append.                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Why the output is identical

- 0001/0002 change only how the same ACIR/witness bytes are decoded. The converter processes opcodes in the same
  order with the same index, the public inputs are joined in the same order, block constraints come out of the same
  `std::map` in the same order, and `max_witness_index` is a max (order-independent). The fields that are skipped are
  never read by Barretenberg. The witness fast path accepts only uint32 keys in strictly increasing order with 32-byte
  values — validated over the whole map **before** anything is written — and fills holes with `fr::random_element()`
  in the same order as `witness_map_to_witness_vector`, so the RNG draw sequence is unchanged.
- 0003/0004 are exact integer / field arithmetic producing the same values.
- 0005 stores the same tile contents; only the container changes.
- Gates, variable indices and VKs are therefore unchanged; checked end-to-end below.

**`check_identical.sh` with the final binary: all 11 flows IDENTICAL** (proof and VK sha256 equal to
`reference/proof_vk_sha256.txt`). Also checked after 0002, 0004 and 0005 individually on subsets / all flows.

## Measurements (4 vCPU VM, `BB_DETERMINISTIC_PROVING=42`)

End-to-end, `ab.sh bb-start bb-final 3 .` (interleaved, min of 3; start = 0001-0006 applied):

| Flow                                                         | start (s) | final (s) | ratio     |
| ------------------------------------------------------------ | --------- | --------- | --------- |
| deploy_ecdsar1+sponsored_fpc                                 | 6.26      | 5.79      | 0.926     |
| deploy_schnorr+sponsored_fpc                                 | 5.32      | 5.39      | 1.014     |
| ecdsar1+amm_add_liquidity_1_recursions+sponsored_fpc         | 9.00      | 8.65      | 0.961     |
| ecdsar1+deploy_tokenContract_with_registration+sponsored_fpc | 7.01      | 6.51      | 0.928     |
| ecdsar1+storage_proof_7_layers+sponsored_fpc                 | 16.94     | 16.58     | 0.979     |
| ecdsar1+token_bridge_claim_private+sponsored_fpc             | 6.09      | 6.09      | 1.000     |
| ecdsar1+transfer_0_recursions+private_fpc                    | 8.06      | 7.30      | 0.906     |
| ecdsar1+transfer_0_recursions+sponsored_fpc                  | 5.31      | 4.83      | 0.909     |
| ecdsar1+transfer_1_recursions+private_fpc                    | 8.18      | 7.74      | 0.945     |
| ecdsar1+transfer_1_recursions+sponsored_fpc                  | 5.67      | 5.44      | 0.958     |
| schnorr+deploy_tokenContract_with_registration+sponsored_fpc | 6.35      | 6.20      | 0.976     |
| **Total**                                                    | **84.19** | **80.51** | **0.956** |

Per-flow numbers carry the VM's ±3% noise; the serial phases below are the direct effect.

Per phase (`--print_bench`, min of 3, ms):

| Phase                                  | transfer_1_recursions+private_fpc start → final | storage_proof_7_layers start → final |
| -------------------------------------- | ----------------------------------------------- | ------------------------------------ |
| ChonkLoad (ACIR decode, serial)        | 299 → 165 (−45%)                                | 436 → 258 (−41%)                     |
| create_circuit (serial)                | 460 → 382 (−17%)                                | 1290 → 1010 (−22%)                   |
| ↳ acir::ecdsa_r1_constraints           | 135 → 105                                       | —                                    |
| ↳ acir::recursion_constraints          | 118 → 104                                       | 111 → <100                           |
| ↳ Chonk::complete_kernel_circuit_logic | 118 → 103                                       | 111 → <100                           |
| ↳ acir::keccak_permutations            | —                                               | 783 → 596                            |
| ChonkAccumulate (whole)                | 4880 → 4740                                     | 12960 → 12600                        |
| ChonkAPI::prove (whole)                | 7980 → 7540                                     | 16040 → 15570                        |

Step by step on transfer_1_recursions+private_fpc (ChonkLoad): 308 → 238 (streaming program decode) → 191 (serde
moves / string_view) → 166 (opcode-by-opcode conversion). The witness fast path removes ~55 ms/flow of
`witness_buf_to_witness_vector` (inside ChonkAccumulate, not separately timed). create_circuit: ecdsa 138 → 117 (uintx),
create_circuit 447 → 411 (field::one), → ~390 (chunked tiles).

## Tests run

Built and run in `build/` (Release) on the final tree:

- `numeric_tests` 67/67, `ecc_tests` 1071/1071, `stdlib_primitives_tests` 1349/1349 (field, bigfield, biggroup, …),
  `stdlib_poseidon2_tests` 29/29, `stdlib_circuit_builders_tests` 5/5, `honk_tests` 2/2 — all pass.
- `dsl_tests`: 537 pass; the 14 failures were all "bn254 g1 data had 393216 points … download not allowed in this
  context" (the container's CRS cache only had 2^18.5 points). After fetching 2^21 compressed points into
  `~/.bb-crs`, re-running the 35 recursion-constraint tests: 33 pass, the remaining 2
  (`HonkRecursionConstraintTestWithoutPredicate/2.{GenerateVKFromConstraints,PinnedVKRootRollup}`) need 2^23 points
  and still stop at the same CRS check. No test failed for any other reason.

Not built: WASM. The changes use only portable C++ (no intrinsics, no native-only paths); `TileStore` uses aligned
`operator new`, available in wasi-sdk.

## Tried / looked at, not done

- **Native Poseidon2 in in-circuit hashing** (~105 ms/flow of create_circuit incl. transcript hashing): the time is the
  Montgomery arithmetic of the internal/external rounds needed for the witness values; no algorithmic slack found.
- **`uintx::divmod_base`** (bit-serial long division used for the secp256r1 _Fr_ modulus, which has no Barrett path):
  only ~10 ms/flow after 0003, so a Knuth-D rewrite was not worth it.
- **plookup `BasicTable` regeneration per circuit** (`create_basic_table`, ~17 ms/flow): would need a process-wide
  table cache; skipped because of the permanent memory cost in the browser (WASM).
- **`OriginTag` merging** (~22 ms/flow in create_circuit, atomic `tag_id` counter + uint512 provenance per merge): lives
  in `transcript/`, outside this track; enabled in this Release build (`AZTEC_NO_ORIGIN_TAGS` is not defined).
- **ChonkLoad remainder** (~165 ms): ~30% msgpack object parse, ~25% object → `Acir::` struct conversion (one heap
  vector per field coefficient), ~22% AcirFormat conversion. Going further needs a hand-written msgpack → AcirFormat
  decoder covering every opcode type.
- **Instruction-level noise**: the VM's ±3% made single-run comparisons unreliable; every decision above was taken on
  min-of-N interleaved runs and frame-pointer `perf` profiles (a separate `-fno-omit-frame-pointer` build; DWARF
  unwinding lost most deep bigfield stacks).
