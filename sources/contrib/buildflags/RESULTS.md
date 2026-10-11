# buildflags track — results (work in progress)

Start point: bb15fcb + patches 0001-0006, `cmake --preset default -DAVM=OFF`, system clang 18, 4 vCPU.

## 0001 — `BB_ALLOCATOR` CMake option (tcmalloc)

`cmake/allocator.cmake` adds `-DBB_ALLOCATOR=system|tcmalloc|mimalloc|jemalloc` (default `system`), linked into
`bb`/`bb-avm` only, never WASM. With `tcmalloc` the static `libtcmalloc_minimal.a` is linked, so the binary gains no
runtime dependency. Output-identical: the allocator only decides where heap memory lives. check_identical.sh: 11/11
IDENTICAL.

Allocator screen (LD_PRELOAD on the start binary, 5 interleaved reps, min, all 11 flows, `bench_allocators_11flows.txt`):

| allocator                                       | total (min) vs start                              |
| ----------------------------------------------- | ------------------------------------------------- |
| tcmalloc_minimal 2.15                           | **0.947** (every flow ≤ 1.0, storage_proof 0.898) |
| mimalloc 2.1 + `PURGE_DELAY=-1`                 | 0.958                                             |
| glibc + `mmap_threshold`/`trim_threshold` = max | 0.966                                             |
| jemalloc 5.3 default                            | 1.088 (slower)                                    |
| mimalloc 2.1 default                            | 1.031 (slower)                                    |
