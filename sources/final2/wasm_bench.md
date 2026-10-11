| flow | A min/med s | B min/med s | B/A (min) | A peak RSS MiB (med) | B peak RSS MiB (med) | B/A |
|---|---|---|---|---|---|---|
| ecdsar1+transfer_0_recursions+private_fpc | 22.74/23.81 | 18.65/19.57 | 0.820 | 638.1 | 643.2 | 1.008 |
| ecdsar1+transfer_1_recursions+private_fpc | 23.56/25.80 | 19.04/21.09 | 0.808 | 649.0 | 652.8 | 1.006 |
| standards_token_mint_to_private | 15.16/16.02 | 12.79/13.80 | 0.843 | 587.7 | 569.4 | 0.969 |
| standards_token_transfer_private_to_private | 14.99/16.29 | 13.43/13.48 | 0.896 | 579.2 | 576.2 | 0.995 |
| standards_token_transfer_private_to_public | 14.43/14.84 | 12.05/12.36 | 0.835 | 588.4 | 567.7 | 0.965 |

TOTAL min time A 90.89 s, B 75.96 s, ratio 0.836
all runs verified by the prover build, by stock bb.js's bundled WASM, tampered rejected: True
