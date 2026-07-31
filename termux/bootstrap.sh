#!/data/data/com.termux/files/usr/bin/sh
set -eu

ARCHIVE_URL="${BABYLINK_MCP_ARCHIVE_URL:-https://babylink.top/termux/termux.tar.gz}"
WORK_DIR="${TMPDIR:-$PREFIX/tmp}/babylink-mcp-bootstrap-$$"
ARCHIVE="$WORK_DIR/source.tar.gz"

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT INT TERM

printf '%s\n' '正在准备 BabyLink Termux MCP 一键安装…'
pkg install -y curl tar
mkdir -p "$WORK_DIR/source"
curl --fail --location --silent --show-error \
  "$ARCHIVE_URL" \
  --output "$ARCHIVE"
tar -xzf "$ARCHIVE" -C "$WORK_DIR/source" --strip-components=1

if [ ! -f "$WORK_DIR/source/install.sh" ]; then
  printf '%s\n' '下载内容中没有找到 Termux 安装器。' >&2
  exit 1
fi

sh "$WORK_DIR/source/install.sh"