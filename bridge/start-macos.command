#!/bin/zsh
cd "${0:A:h}/.." || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js。正在打开官方下载页，安装完成后请重新双击本文件。"
  open "https://nodejs.org/zh-cn/download"
  read "?按回车退出…"
  exit 1
fi

echo ""
echo "BabyLink 电脑助手"
echo "1) QQ / NapCat"
echo "2) 小红书非官方适配器"
read "platform_choice?请选择 1 或 2："

if [[ "$platform_choice" == "2" ]]; then
  export BABYLINK_BRIDGE_PLATFORM="xiaohongshu"
  read "adapter_url?请输入小红书适配器本机地址（默认 http://127.0.0.1:8790）："
  export XHS_ADAPTER_URL="${adapter_url:-http://127.0.0.1:8790}"
else
  export BABYLINK_BRIDGE_PLATFORM="qq"
  read "onebot_url?请输入 OneBot 本机地址（默认 http://127.0.0.1:3000）："
  export QQ_ONEBOT_URL="${onebot_url:-http://127.0.0.1:3000}"
fi

while true; do
  read "public_url?请输入你的 HTTPS 电脑助手地址（例如 https://bridge.example.com）："
  if [[ "$public_url" == https://* ]]; then
    export BABYLINK_BRIDGE_PUBLIC_URL="${public_url%/}"
    break
  fi
  echo "地址必须以 https:// 开头。"
done

token_file="$PWD/bridge/.babylink-bridge-token"
if [[ -s "$token_file" ]]; then
  export BABYLINK_BRIDGE_TOKEN="$(cat "$token_file")"
else
  umask 077
  export BABYLINK_BRIDGE_TOKEN="$(openssl rand -hex 32)"
  print -r -- "$BABYLINK_BRIDGE_TOKEN" > "$token_file"
fi
export BABYLINK_BRIDGE_OPEN_DASHBOARD="1"
echo "正在启动电脑助手。请保持此窗口开启。"
node bridge/babylink-bridge.mjs
read "?电脑助手已停止，按回车关闭…"
