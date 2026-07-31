#!/data/data/com.termux/files/usr/bin/sh
set -e

APP_DIR="$HOME/.local/share/babylink-mcp/app"
CONFIG_FILE="$HOME/.config/babylink-mcp/config.json"
if [ ! -f "$APP_DIR/gateway.mjs" ] || [ ! -f "$CONFIG_FILE" ]; then
  printf '%s\n' '请先运行 install.sh。' >&2
  exit 1
fi

termux-wake-lock >/dev/null 2>&1 || true
cd "$APP_DIR"
BABYLINK_MCP_CONFIG="$CONFIG_FILE" exec node gateway.mjs