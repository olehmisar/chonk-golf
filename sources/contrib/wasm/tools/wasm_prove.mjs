// Time AztecClientBackend.prove through bb.js with BackendType.Wasm (threads 4).
//   BBJS_DIR=... FLOWS_DIR=... WASM=<path to .wasm or .wasm.gz> REPS=n node wasm_prove.mjs <flow-substring> [outdir]
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
const requireFromBbjs = createRequire(join(process.env.BBJS_DIR, "package.json"));
const { Decoder } = requireFromBbjs("msgpackr");
const { ungzip } = requireFromBbjs("pako");
const { AztecClientBackend, BackendType, Barretenberg } = await import(
  join(process.env.BBJS_DIR, "dest/node/index.js")
);
const flowsDir = process.env.FLOWS_DIR;
const filter = process.argv[2] ?? "";
const outDir = process.argv[3];
const reps = Number(process.env.REPS ?? 1);
const flows = readdirSync(flowsDir)
  .filter((f) => existsSync(join(flowsDir, f, "ivc-inputs.msgpack")) && new RegExp(filter).test(f))
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
const api = await Barretenberg.new({
  backend: BackendType.Wasm,
  threads: Number(process.env.THREADS ?? 4),
  wasmPath: process.env.WASM,
});
for (const flow of flows) {
  const f = loadFlow(join(flowsDir, flow));
  for (let r = 0; r < reps; r++) {
    const t0 = performance.now();
    const { proof, vk } = await new AztecClientBackend(f.bytecodes, api, f.names, f.kinds).prove(
      f.witnesses,
      f.vks,
    );
    const ms = performance.now() - t0;
    console.log(`TIME ${flow} ${ms.toFixed(0)}`);
    if (outDir && r === 0) {
      mkdirSync(join(outDir, flow), { recursive: true });
      writeFileSync(join(outDir, flow, "proof"), proof);
      writeFileSync(join(outDir, flow, "vk"), vk);
    }
  }
}
await api.destroy();
