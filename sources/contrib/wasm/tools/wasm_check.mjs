// Prove every pinned flow with bb.js BackendType.Wasm (WASM=<wasm under test>), then:
//  (a) VK sha256 must equal reference/proof_vk_sha256.txt (native unmodified prover),
//  (b) proof must verify with the unmodified native bb (VERIFIER_BB) and a tampered copy must be rejected.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { join } from "node:path";
const requireFromBbjs = createRequire(join(process.env.BBJS_DIR, "package.json"));
const { Decoder, Encoder } = requireFromBbjs("msgpackr");
const { ungzip } = requireFromBbjs("pako");
const { AztecClientBackend, BackendType, Barretenberg } = await import(
  join(process.env.BBJS_DIR, "dest/node/index.js")
);
const flowsDir = process.env.FLOWS_DIR;
const ref = Object.fromEntries(
  readFileSync(process.env.REF, "utf8")
    .trim()
    .split("\n")
    .map((l) => l.split(/\s+/))
    .map(([p, v, f]) => [f, v]),
);
const flows = readdirSync(flowsDir)
  .filter(
    (f) => existsSync(join(flowsDir, f, "ivc-inputs.msgpack")) && f.includes(process.argv[2] ?? ""),
  )
  .sort();
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
const prover = await Barretenberg.new({
  backend: BackendType.Wasm,
  threads: 4,
  wasmPath: process.env.WASM,
});
const out = [];
for (const flow of flows) {
  const f = loadFlow(join(flowsDir, flow));
  const t0 = Date.now();
  const { proof, vk } = await new AztecClientBackend(f.bytecodes, prover, f.names, f.kinds).prove(
    f.witnesses,
    f.vks,
  );
  out.push({ flow, proof, vk, ms: Date.now() - t0 });
}
await prover.destroy();
const vapi = await Barretenberg.new({
  backend: BackendType.NativeUnixSocket,
  bbPath: process.env.VERIFIER_BB,
  threads: 4,
});
const verifier = new AztecClientBackend([], vapi);
let fails = 0;
for (const { flow, proof, vk, ms } of out) {
  const vkSha = createHash("sha256").update(vk).digest("hex");
  const ok = await verifier.verify(proof, vk);
  const dec = new Decoder({ useRecords: false }).decode(proof);
  const seg = dec[Object.keys(dec).at(-1)];
  const tf = new Uint8Array(seg[seg.length - 1]);
  tf[31] ^= 1;
  seg[seg.length - 1] = tf;
  let tok;
  try {
    tok = await verifier.verify(new Encoder({ useRecords: false }).encode(dec), vk);
  } catch {
    tok = false;
  }
  const pass = ok === true && tok === false && vkSha === ref[flow];
  if (!pass) fails++;
  console.log(
    `${pass ? "PASS" : "FAIL"} ${flow}: vk=${vkSha === ref[flow] ? "IDENTICAL" : "DIFFERENT " + vkSha} verify=${ok} tampered=${tok} (wasm prove ${ms} ms)`,
  );
}
await vapi.destroy();
console.log(fails ? `${fails} FAILURES` : `ALL ${out.length} FLOWS PASS`);
process.exit(fails ? 1 : 0);
