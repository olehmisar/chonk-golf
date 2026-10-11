// Adapted from bb-chonk-prover-opt/ts-verify/stock_bbjs_verify.mjs for the chonk.golf harness.
// Verifies proofs from a candidate prover with STOCK @aztec-foundation/bb.js from npm (no local builds).
//
//   cd <dir with `npm install @aztec-foundation/bb.js@7.0.0-nightly.20261009 msgpackr pako`>
//   FLOWS_DIR=<pinned flows> PROVER_BB=<candidate bb> REF_DIR=<dir with <flow>/vk> \
//     node stock_bbjs_verify.mjs [flow-substring...]
//
// Proving: stock bb.js AztecClientBackend driving the candidate `bb` over its native socket backend, with real
// (non-deterministic) randomness. Verifying: a separate stock bb.js instance using its default backend (the bb that
// ships inside the npm package), which never sees the candidate binary. A one-byte-tampered copy of every proof must
// be rejected and the returned VK must equal the unmodified prover's VK byte-for-byte.
//
// Besides the human-readable lines, prints one `RESULT {json}` line per flow for machine parsing.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(join(process.cwd(), "package.json"));
const { AztecClientBackend, BackendType, Barretenberg } = await import(
  require.resolve("@aztec-foundation/bb.js")
);
const { Decoder, Encoder } = require("msgpackr");
const { ungzip } = require("pako");
const bbjsVersion = JSON.parse(
  readFileSync(join(process.cwd(), "node_modules/@aztec-foundation/bb.js/package.json")),
).version;

const flowsDir = process.env.FLOWS_DIR;
const filters = process.argv.slice(2);
const flows = readdirSync(flowsDir)
  .filter((f) => existsSync(join(flowsDir, f, "ivc-inputs.msgpack")))
  .filter((f) => !filters.length || filters.some((x) => f === x))
  .sort();
const threads = Number(process.env.BBJS_THREADS ?? 4);

function loadFlow(dir) {
  const steps = new Decoder({ useRecords: false }).unpack(
    readFileSync(join(dir, "ivc-inputs.msgpack")),
  );
  return {
    bytecodes: steps.map((s) => ungzip(s.bytecode)),
    witnesses: steps.map((s) => ungzip(s.witness)),
    vks: steps.map((s) => new Uint8Array(s.vk)),
    names: steps.map((s) => s.functionName),
    kinds: steps.map((s) => s.kind),
  };
}

console.log(`BBJS_VERSION ${bbjsVersion}`);
console.log(`stock @aztec-foundation/bb.js ${bbjsVersion}; prover bb: ${process.env.PROVER_BB}`);
const proofs = [];
const prover = await Barretenberg.new({
  backend: BackendType.NativeUnixSocket,
  bbPath: process.env.PROVER_BB,
  threads,
});
for (const flow of flows) {
  const { bytecodes, witnesses, vks, names, kinds } = loadFlow(join(flowsDir, flow));
  const t0 = Date.now();
  try {
    const { proof, vk } = await new AztecClientBackend(bytecodes, prover, names, kinds).prove(
      witnesses,
      vks,
    );
    proofs.push({ flow, proof, vk, ms: Date.now() - t0 });
  } catch (e) {
    proofs.push({ flow, error: String(e), ms: Date.now() - t0 });
  }
}
await prover.destroy();

const verifierApi = await Barretenberg.new({ threads }); // stock default backend selection
const verifier = new AztecClientBackend([], verifierApi);
let failures = 0;
for (const { flow, proof, vk, ms, error } of proofs) {
  let ok = false;
  let tamperedOk = null;
  let vkMatches = null;
  if (!error) {
    ok = await verifier.verify(proof, vk);
    const decoded = new Decoder({ useRecords: false }).decode(proof);
    const seg = decoded[Object.keys(decoded).at(-1)];
    const tamperedField = new Uint8Array(seg[seg.length - 1]);
    tamperedField[31] ^= 1;
    seg[seg.length - 1] = tamperedField;
    try {
      tamperedOk = await verifier.verify(new Encoder({ useRecords: false }).encode(decoded), vk);
    } catch {
      tamperedOk = false;
    }
    if (process.env.REF_DIR) {
      vkMatches =
        Buffer.compare(Buffer.from(vk), readFileSync(join(process.env.REF_DIR, flow, "vk"))) === 0;
    }
  }
  const pass = ok === true && tamperedOk === false && vkMatches !== false;
  if (!pass) failures++;
  console.log(
    `${pass ? "PASS" : "FAIL"} ${flow}: verify=${ok} tampered=${tamperedOk} vk_matches_ref=${vkMatches} (prove ${ms} ms)${error ? ` error=${error}` : ""}`,
  );
  console.log(
    `RESULT ${JSON.stringify({ flow, verify: ok, tampered: tamperedOk, vk_matches_ref: vkMatches, ms, error })}`,
  );
}
await verifierApi.destroy();
console.log(failures === 0 ? `ALL ${proofs.length} FLOWS VERIFIED` : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
