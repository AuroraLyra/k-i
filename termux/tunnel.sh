#!/data/data/com.termux/files/usr/bin/sh
set -e

if ! command -v cloudflared >/dev/null 2>&1; then
  printf '%s\n' '正在安装 cloudflared…'
  pkg install -y cloudflared
fi

printf '%s\n' '将生成临时 HTTPS 地址。不要公开配置文件中的 Bearer Token。'
exec cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8765