# BabyLink Bridge

BabyLink Bridge 在用户自己的电脑运行，只连接用户自己登录的 QQ/NapCat/OneBot 或小红书适配器。手机通过 Bridge 的 MCP 地址调用工具；BabyLink 云端不代理 QQ、小红书登录和平台流量，也不包含微信适配器。

## 普通用户流程

1. 在手机 BabyLink → Services → MCP Studio → 连接的“电脑助手”中下载 macOS 或 Windows 安装包，并在电脑完成安装。
2. 电脑先安装并登录 QQ 的 NapCat/OneBot，或自行选择并登录非官方小红书适配器。
3. 打开 BabyLink 电脑助手，选择 QQ、小红书或两者，确认适配器本机地址后点击启动。默认 Quick Tunnel 会自动下载 Cloudflare 官方 `cloudflared` 并建立临时 HTTPS 地址；也可以填写自己的固定 HTTPS 地址。
4. 电脑助手显示“可以扫码配对”后，打开配对与体检页，扫描二维码或复制配对信息。
5. 手机打开 BabyLink → Services → MCP Studio → 连接，选择“配对 QQ”或“配对小红书”，粘贴后点击“配对并自动检测”。
6. 手机显示“连接正常”即完成。以后保持电脑、平台适配器和 Bridge 运行即可；Quick Tunnel 地址会在每次重启后变化，需要重新配对，固定 HTTPS 地址不变时无需重复配对。

普通用户不需要安装 Node.js，也不需要在手机手填 URL、Key、请求头或工具列表。macOS/Windows 安装包必须由管理员构建并发布；未签名的测试包可能被系统安全策略拦截，正式分发应配置 Apple Developer ID 与 Windows 代码签名证书。

## 桌面助手开发与打包

- `npm run bridge:desktop`：开发环境启动 Electron 助手。
- `npm run bridge:desktop:dir`：生成当前系统的未压缩测试包。
- `npm run bridge:desktop:dist`：生成当前系统安装包；macOS 输出 DMG/ZIP，Windows 输出 NSIS EXE，Linux 输出 AppImage。
- 产物位于 `bridge-dist/`，文件名格式为 `BabyLink-Bridge-<version>-<os>-<arch>.<ext>`。
- Electron 助手会在应用数据目录保存配置、随机访问令牌、`cloudflared` 和脱敏审计日志，不会写入仓库。

仓库中的 `bridge/start-macos.command` 与 `bridge/start-windows.cmd` 仅作为需要 Node.js 的开发/故障排查回退。

## QQ / NapCat

1. 在电脑安装并登录 NapCat，启用 OneBot HTTP API。
2. 让 OneBot HTTP API 只监听本机地址，例如 `http://127.0.0.1:3000`。
3. 双击启动脚本，或在开发环境终端运行 Bridge：

```sh
BABYLINK_BRIDGE_PLATFORM=qq \
QQ_ONEBOT_URL=http://127.0.0.1:3000 \
BABYLINK_BRIDGE_PUBLIC_URL=https://你的电脑助手域名 \
BABYLINK_BRIDGE_TOKEN=请生成一串随机长令牌 \
node bridge/babylink-bridge.mjs
```

4. 用自己的 HTTPS 反向代理或隧道转发电脑端口，例如 Caddy、Cloudflare Tunnel 或 Tailscale Funnel。公网只暴露 Bridge，不要直接暴露 NapCat 端口。
5. 在电脑控制页点击“复制配对信息”，回到手机 QQ 电脑助手向导粘贴并配对。
6. 配对后 BabyLink 会检测 `qq_get_login_status`、好友、群和消息工具，并开启真实操作权限；角色可直接通过用户自己的 QQ 发送消息，不显示逐条预览。

## 小红书适配器

Bridge 不假装内置某个第三方小红书实现。用户在电脑自行安装并登录非官方适配器，适配器需要提供以下 HTTP 合约：

- `POST ${XHS_ADAPTER_URL}/call`
- 请求体：`{"tool":"search_notes","arguments":{"keyword":"..."}}`
- 返回任意 JSON；错误使用非 `2xx` 状态码
- 支持的工具名：`status`、`search_notes`、`get_note`、`like_note`、`comment_note`、`publish_note`、`save_draft`、`list_drafts`、`delete_draft`、`publish_draft`、`schedule_note`、`get_creator_metrics`

双击启动脚本，或在开发环境运行 Bridge：

```sh
BABYLINK_BRIDGE_PLATFORM=xiaohongshu \
XHS_ADAPTER_URL=http://127.0.0.1:8790 \
XHS_ADAPTER_TOKEN=适配器令牌（如果需要） \
BABYLINK_BRIDGE_PUBLIC_URL=https://你的电脑助手域名 \
BABYLINK_BRIDGE_TOKEN=请生成一串随机长令牌 \
node bridge/babylink-bridge.mjs
```

小红书适配器和 Bridge 都只运行在用户电脑；适配器的账号登录、Cookie、风控和平台限制由用户自行承担。没有适配器时，Bridge 会明确返回未配置错误，不会伪造搜索、点赞或发布成功。

## 配对与安全

- `BABYLINK_BRIDGE_TOKEN` 是手机访问 Bridge 的唯一令牌，请使用随机长字符串，不要提交到 Git。
- `/pairing` 也需要该令牌；返回的 JSON 包含手机导入所需的 MCP 地址和鉴权 Key。
- Bridge 默认绑定 `127.0.0.1`，必须通过用户自己的 HTTPS 代理或隧道对外提供；网页、APK、IPA 不接受 HTTP、localhost 或局域网 MCP 地址。
- `/` 控制页、`/desktop/public-url`、`/diagnostics` 与 `/audit` 只接受本机连接；Quick Tunnel 无法从公网读取配对令牌、诊断或审计内容。
- 可按 QQ 好友、QQ群和写入工具配置白名单；空白名单表示不额外限制，仍受手机端工具开关和 Bridge 访问令牌约束。
- 读操作与写操作分别限速；每次工具调用都会写入 JSONL 审计，令牌、Cookie 和密码会被移除，消息正文只保留截断预览、长度和短哈希。
- 若不使用代理，也可以设置 `BABYLINK_BRIDGE_TLS_KEY` 与 `BABYLINK_BRIDGE_TLS_CERT` 让 Bridge 直接监听 HTTPS。
- 电脑关机、适配器退出或 QQ 登录失效时，BabyLink 只显示连接错误，不会把外部平台流量转到 BabyLink 云端。

## 环境变量

- `BABYLINK_BRIDGE_PLATFORM`：`qq`、`xiaohongshu` 或 `both`，默认 `qq`
- `BABYLINK_BRIDGE_PORT`：Bridge 端口，默认 `8787`
- `BABYLINK_BRIDGE_HOST`：监听地址，默认 `127.0.0.1`
- `BABYLINK_BRIDGE_PUBLIC_URL`：用户自己的 HTTPS 公网地址，用于配对配置
- `BABYLINK_BRIDGE_TOKEN`：手机访问令牌，必填
- `BABYLINK_BRIDGE_ALLOWED_QQ_USERS`、`BABYLINK_BRIDGE_ALLOWED_QQ_GROUPS`：允许写入的 QQ 号或群号，逗号分隔，可选
- `BABYLINK_BRIDGE_ALLOWED_WRITE_TOOLS`：允许执行的写工具名，逗号分隔，可选
- `BABYLINK_BRIDGE_READS_PER_MINUTE`、`BABYLINK_BRIDGE_WRITES_PER_MINUTE`：每分钟读写调用上限，默认 `120` / `30`
- `BABYLINK_BRIDGE_AUDIT_PATH`：脱敏 JSONL 审计路径
- `QQ_ONEBOT_URL`：OneBot HTTP API 地址，默认 `http://127.0.0.1:3000`
- `QQ_ONEBOT_TOKEN`：OneBot 访问令牌，可选
- `XHS_ADAPTER_URL`：小红书适配器地址，可选
- `XHS_ADAPTER_TOKEN`：小红书适配器令牌，可选
- `BABYLINK_BRIDGE_TLS_KEY`、`BABYLINK_BRIDGE_TLS_CERT`：直接启用 HTTPS，可选
