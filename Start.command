#!/bin/zsh
set -eu
cd -- "$(dirname -- "$0")"
RAUM_BUNDLED_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
if [[ -x "$RAUM_BUNDLED_NODE" ]]; then
  RAUM_NODE="$RAUM_BUNDLED_NODE"
elif command -v node >/dev/null 2>&1; then
  RAUM_NODE="$(command -v node)"
else
  print 'Bitte Node.js 24 installieren. Weitere Hinweise stehen in README.md.'
  read -k 1
  exit 1
fi
export PATH="$(dirname -- "$RAUM_NODE"):$PATH"
if [[ ! -f node_modules/next/dist/bin/next ]]; then
  print 'Die Abhängigkeiten fehlen. Bitte einmal pnpm install ausführen (siehe README.md).'
  read -k 1
  exit 1
fi
if [[ ! -f .next/BUILD_ID ]]; then
  "$RAUM_NODE" node_modules/next/dist/bin/next build
fi
print 'Raum öffnen: http://127.0.0.1:3000'
print 'Dieses Fenster geöffnet lassen. Zum Beenden Ctrl+C drücken.'
exec "$RAUM_NODE" node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000
