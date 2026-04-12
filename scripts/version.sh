#!/bin/bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: pnpm run version <new-version>"
  echo "Example: pnpm run version 1.1.0"
  exit 1
fi

VERSION="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Update version in a JSON file
set_version() {
  local file="$1"
  node -e "
    const fs = require('fs');
    const raw = fs.readFileSync('$file', 'utf8');
    const pkg = JSON.parse(raw);
    pkg.version = '$VERSION';
    fs.writeFileSync('$file', JSON.stringify(pkg, null, 2) + '\n');
  "
  echo "  $file → $VERSION"
}

set_version "$ROOT/package.json"
set_version "$ROOT/packages/chrome/package.json"
set_version "$ROOT/packages/pi/package.json"
set_version "$ROOT/packages/claude/.claude-plugin/plugin.json"

echo "All packages updated to $VERSION"
