// Captures aztec-standards Token flows as Chonk ivc-inputs.msgpack (see README.md in this folder).
// Copy into aztec-standards/src/ts/test/ and run with vitest against `aztec start --local-network`.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseUnits } from 'viem';
import { serializePrivateExecutionSteps } from '@aztec-labs/stdlib/kernel';
import { describe, it } from 'vitest';

import { TokenContract } from '../../../src/artifacts/Token.js';
import { deployTokenWithMinter, setupTestSuite } from './utils.js';

const OUT = process.env.CAPTURE_IVC_FOLDER ?? '/tmp/standards-captures';
const amt = (x: number) => parseUnits(x.toString(), 18);

// Profile (simulation only: the msgpack needs bytecode, witnesses and VKs, not proofs), write, then send so the
// next step sees the right pre-state.
async function captureThenSend(label: string, interaction: any, opts: any) {
  const dir = join(OUT, label);
  await mkdir(dir, { recursive: true });
  const r = await interaction.profile({ ...opts, profileMode: 'full', skipProofGeneration: true });
  await writeFile(join(dir, 'ivc-inputs.msgpack'), serializePrivateExecutionSteps(r.executionSteps));
  console.log(label, r.executionSteps.map((s: any) => s.functionName).join(' -> '));
  return interaction.send(opts);
}

describe('capture aztec-standards token flows', () => {
  it('captures', async () => {
    const { cleanup, wallet, accounts } = await setupTestSuite(false);
    const [alice, bob] = accounts;
    const deployed = await deployTokenWithMinter(wallet, alice);
    const token = TokenContract.at(deployed.address, wallet);

    await captureThenSend('standards_token_mint_to_private', token.methods.mint_to_private(alice, amt(100)), {
      from: alice,
    });
    await captureThenSend(
      'standards_token_transfer_private_to_private',
      token.methods.transfer_private_to_private(alice, bob, amt(10), 0),
      { from: alice },
    );
    await captureThenSend(
      'standards_token_transfer_private_to_public',
      token.methods.transfer_private_to_public(alice, bob, amt(10), 0),
      { from: alice },
    );
    await cleanup();
  }, 1_800_000);
});
