// One WASM proving run through stock @aztec-foundation/bb.js (run from a dir where it is installed).
//   FLOW_DIR=<flow dir> WASM=<barretenberg-threads.wasm[.gz]> THREADS=4 node wasm_prove_once.mjs
// Prints one JSON line: {flow, prove_ms, peak_rss_mib, verified}. Peak RSS is this Node process's max RSS (includes
// the WASM linear memory), read from process.resourceUsage().maxRSS after proving.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';

const require = createRequire(join(process.cwd(), 'package.json'));
const { AztecClientBackend, BackendType, Barretenberg } = await import(require.resolve('@aztec-foundation/bb.js'));
const { Decoder } = require('msgpackr');
const { ungzip } = require('pako');

const flowDir = process.env.FLOW_DIR;
const steps = new Decoder({ useRecords: false }).unpack(readFileSync(join(flowDir, 'ivc-inputs.msgpack')));
const api = await Barretenberg.new({ backend: BackendType.Wasm, wasmPath: process.env.WASM, threads: Number(process.env.THREADS ?? 4) });
const backend = new AztecClientBackend(steps.map(s => ungzip(s.bytecode)), api, steps.map(s => s.functionName), steps.map(s => s.kind));
const witnesses = steps.map(s => ungzip(s.witness));
const vks = steps.map(s => new Uint8Array(s.vk));
const t0 = performance.now();
const { proof, vk } = await backend.prove(witnesses, vks);
const proveMs = performance.now() - t0;
const verified = await backend.verify(proof, vk);
const peakRssMib = process.resourceUsage().maxRSS / 1024;
await api.destroy();
console.log(JSON.stringify({ flow: basename(flowDir), prove_ms: Math.round(proveMs), peak_rss_mib: Math.round(peakRssMib * 10) / 10, verified }));
process.exit(0);
