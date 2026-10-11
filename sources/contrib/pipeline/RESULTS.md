# Track: pipeline (work in progress)

Patches apply on top of `patches/0001-0006` (start = `b6c0783`, "perf(sumcheck): skip fold multiply…").

| Patch | Change                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0001  | `ChonkAPI::prove` parses each step's ACIR bytecode on a background thread, in step order, while earlier steps are accumulated. |
| 0002  | `prove --write_vk` writes the hiding-kernel VK the IVC already holds instead of rebuilding the circuit and recomputing the VK. |

Status: both patches pass `check_identical.sh` (11/11 IDENTICAL, proof and VK). Full write-up to follow.
