#!/data/data/com.termux/files/usr/bin/sh
set -e

SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INSTALL_DIR="$HOME/.local/share/babylink-mcp/app"
CONFIG_DIR="$HOME/.config/babylink-mcp"
BOOT_DIR="$HOME/.termux/boot"
BIN_DIR="$PREFIX/bin"

printf '%s\n' '正在安装 BabyLink Termux MCP 网关…'
pkg update -y
pkg install -y nodejs-lts openssl curl termux-api
mkdir -p "$INSTALL_DIR" "$CONFIG_DIR" "$BOOT_DIR"
cp -R "$SOURCE_DIR/package.json" "$SOURCE_DIR/gateway.mjs" "$SOURCE_DIR/pairing.mjs" "$SOURCE_DIR/setup.mjs" "$SOURCE_DIR/start.sh" "$SOURCE_DIR/manage.sh" "$SOURCE_DIR/tunnel.sh" "$SOURCE_DIR/lib" "$INSTALL_DIR/"
chmod 700 "$INSTALL_DIR/start.sh" "$INSTALL_DIR/manage.sh" "$INSTALL_DIR/tunnel.sh"

if [ ! -f "$CONFIG_DIR/config.json" ]; then
  TOKEN=$(openssl rand -hex 32)
  sed "s/\${BABYLINK_MCP_TOKEN}/$TOKEN/g" "$SOURCE_DIR/config.example.json" > "$CONFIG_DIR/config.json"
  chmod 600 "$CONFIG_DIR/config.json"
fi

cat > "$BOOT_DIR/babylink-mcp" <<EOF
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
cd "$INSTALL_DIR"
BABYLINK_MCP_CONFIG="$CONFIG_DIR/config.json" nohup node gateway.mjs >> "$CONFIG_DIR/gateway.log" 2>&1 &
EOF
chmod 700 "$BOOT_DIR/babylink-mcp"
ln -sf "$INSTALL_DIR/manage.sh" "$BIN_DIR/babylink-mcp"

printf '\n%s\n' '安装完成。'
printf '%s\n' "配置：$CONFIG_DIR/config.json"
"$INSTALL_DIR/manage.sh" restart
printf '%s\n' '管理命令：babylink-mcp status|restart|setup|logs|tunnel'
printf '%s\n' '安装 Termux:Boot 后可在重启时自动启动。'
printf '\n%s\n' '复制下面整个 JSON 到 BabyLink → MCP Studio → 导入配置：'
"$INSTALL_DIR/manage.sh" pair