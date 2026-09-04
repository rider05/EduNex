#!/bin/bash
# Route to scripts/build-apk.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/scripts/build-apk.sh" "$@"
