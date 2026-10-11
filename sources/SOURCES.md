# Sources

Snapshot of the bb-chonk-prover-opt results that the seed cards in `data/submissions/` were transcribed from,
kept here so every patch and source link on the site resolves inside this repository.

| Path               | What                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| `README.md`        | the bb-chonk-prover-opt overview (method, first optimisations 0003-0006)               |
| `patches/`         | harness 0001-0002 and optimisations 0003-0006                                          |
| `integrated/`      | integrated `git am` series 0001-0033 and `STATUS.md` (integ1-integ3 results, peak RSS) |
| `integ4/` | the integ4 linear series 0001-0043 and its `STATUS.md` (time, per-flow peak RSS, RSS bisect); patches 0001-0033 were refreshed in it, so integ1-3 keep linking to `integrated/` |
| `integ5/` | the integ5 series 0001-0058 (current) and its `STATUS.md` (per-flow seconds and peak RSS) |
| `contrib/<track>/` | each track's patches and `RESULTS.md` at the version the card was made from            |

Files are copied verbatim; branch names mentioned inside them refer to where the work was originally developed.
`scripts/seed-from-results.py` regenerates the cards from this directory.
