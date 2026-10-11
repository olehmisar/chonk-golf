#!/usr/bin/env bash
# Unpack the aztec-standards token flows into $WORK/flows-standards/<flow>/ivc-inputs.msgpack.
set -eu
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST=${WORK:-$HOME/bbwork}/flows-standards
for d in "$HERE"/standards_*/; do
  f=$(basename "$d"); mkdir -p "$DEST/$f"
  gunzip -c "$d/ivc-inputs.msgpack.gz" > "$DEST/$f/ivc-inputs.msgpack"
done
echo "unpacked to $DEST"
