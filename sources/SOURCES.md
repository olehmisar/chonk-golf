# Sources

Snapshot of the bb-chonk-prover-opt results that the seed cards in `data/submissions/` were transcribed from,
kept here so every patch and source link on the site resolves inside this repository.

| Path               | What                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| `README.md`        | the bb-chonk-prover-opt overview (method, first optimisations 0003-0006)               |
| `patches/`         | harness 0001-0002 and optimisations 0003-0006                                          |
| `integrated/`      | integrated `git am` series 0001-0033 and `STATUS.md` (integ1-integ3 results, peak RSS) |
| `contrib/<track>/` | each track's patches and `RESULTS.md` at the version the card was made from            |

Files are copied verbatim; branch names mentioned inside them refer to where the work was originally developed.
`scripts/seed-from-results.py` regenerates the cards from this directory.
