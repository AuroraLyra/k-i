#!/data/data/com.termux/files/usr/bin/sh
set -eu

APP_DIR="$HOME/.local/share/babylink-mcp/app"
CONFIG_DIR="$HOME/.config/babylink-mcp"
CONFIG_FILE="$CONFIG_DIR/config.json"
PID_FILE="$CONFIG_DIR/gateway.pid"
LOG_FILE="$CONFIG_DIR/gateway.log"

gateway_pid() {
  if [ ! -f "$PID_FILE" ]; then
    return 1
  fi
  PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    printf '%s' "$PID"
    return 0
  fi
  rm -f "$PID_FILE"
  return 1
}

start_gateway() {
  if PID=$(gateway_pid); then
    printf 'BabyLink Termux MCP 已在运行（PID %s）。\n' "$PID"
    return
  fi
  mkdir -p "$CONFIG_DIR"
  termux-wake-lock >/dev/null 2>&1 || true
  cd "$APP_DIR"
  BABYLINK_MCP_CONFIG="$CONFIG_FILE" nohup node gateway.mjs >> "$LOG_FILE" 2>&1 &
  PID=$!
  printf '%s\n' "$PID" > "$PID_FILE"
  sleep 1
  if ! kill -0 "$PID" 2>/dev/null; then
    rm -f "$PID_FILE"
    printf '%s\n' '网关启动失败，最近日志：' >&2
    tail -n 30 "$LOG_FILE" >&2 || true
    exit 1
  fi
  printf 'BabyLink Termux MCP 已启动（PID %s）。\n' "$PID"
}

stop_gateway() {
  if ! PID=$(gateway_pid); then
    printf '%s\n' 'BabyLink Termux MCP 当前未运行。'
    return
  fi
  kill "$PID" 2>/dev/null || true
  WAIT_COUNT=0
  while kill -0 "$PID" 2>/dev/null && [ "$WAIT_COUNT" -lt 20 ]; do
    sleep 0.1
    WAIT_COUNT=$((WAIT_COUNT + 1))
  done
  if kill -0 "$PID" 2>/dev/null; then
    kill -9 "$PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
  printf '%s\n' 'BabyLink Termux MCP 已停止。'
}

case "${1:-status}" in
  start)
    start_gateway
    ;;
  stop)
    stop_gateway
    ;;
  restart)
    stop_gateway
    start_gateway
    ;;
  status)
    if PID=$(gateway_pid); then
      printf 'BabyLink Termux MCP 正在运行（PID %s）。\n' "$PID"
      curl --fail --silent "http://127.0.0.1:8765/health" || true
      printf '\n'
    else
      printf '%s\n' 'BabyLink Termux MCP 当前未运行。'
      exit 1
    fi
    ;;
  pair)
    exec node "$APP_DIR/pairing.mjs" "${2:-}"
    ;;
  setup)
    exec node "$APP_DIR/setup.mjs"
    ;;
  logs)
    touch "$LOG_FILE"
    exec tail -f "$LOG_FILE"
    ;;
  tunnel)
    exec "$APP_DIR/tunnel.sh"
    ;;
  *)
    printf '%s\n' '用法：babylink-mcp start|stop|restart|status|pair|setup|logs|tunnel' >&2
    exit 2
    ;;
esac