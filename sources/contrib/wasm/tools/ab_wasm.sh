#!/usr/bin/env bash
# ab_wasm.sh <wasmA> <wasmB> <reps> <flow-regex> [reps-per-process]
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
A=$1; B=$2; N=$3; F=$4; R=${5:-1}
export BBJS_DIR=${BBJS_DIR:-$HOME/bbwork/aztec-packages/barretenberg/ts/bb.js} FLOWS_DIR=${FLOWS_DIR:-$HOME/bbwork/flows}
for i in $(seq $N); do for w in A B; do
  p=$A; [ $w = B ] && p=$B
  WASM=$p REPS=$R node $HERE/wasm_prove.mjs "$F" 2>/dev/null | grep TIME | sed "s/^/$w /"
done; done | python3 -c '
import sys,collections,statistics
d=collections.defaultdict(list)
for l in sys.stdin:
    w,_,f,t=l.split(); d[(f,w)].append(float(t))
fl=sorted({k[0] for k in d}); ta=tb=0
for f in fl:
    a=d[(f,"A")]; b=d[(f,"B")]; ta+=min(a); tb+=min(b)
    print(f"{f[:55]:55s} A min {min(a):7.0f} med {statistics.median(a):7.0f} | B min {min(b):7.0f} med {statistics.median(b):7.0f} | B/A {min(b)/min(a):.3f} (med {statistics.median(b)/statistics.median(a):.3f})")
print(f"TOTAL(min) A {ta:.0f} B {tb:.0f} ratio {tb/ta:.3f}")
'
