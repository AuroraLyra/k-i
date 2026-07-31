# BabyLink 生产部署

生产环境由 Caddy、Fastify 和 PostgreSQL 三个容器组成。Caddy 是唯一公网入口；PostgreSQL、Fastify 容器端口和 NapCat 均不直接暴露。

## 1. 域名与防火墙

1. 将 `babylink.top` 和可选的 `www.babylink.top` A 记录指向服务器 IPv4。DNS 记录只填写 IP，不填写 `/24`。
2. 云安全组和服务器防火墙只向公网开放 TCP 80、TCP 443 和 UDP 443。
3. SSH 仅允许固定管理 IP，或改用 Tailscale/WireGuard；不要开放 3000、5432 和 NapCat 端口。
4. 如果服务器位于中国大陆，需要先完成 ICP 备案，并根据实际运营要求处理公安备案和隐私告知。

## 2. 环境变量

在服务器仓库根目录执行：

```bash
cd deploy
cp .env.example .env
```

必须替换以下值：

- `POSTGRES_PASSWORD`：仅使用 URL 安全的长随机字符，例如字母、数字、`_`、`-`。
- `CHALLENGE_SECRET`：至少 32 个随机字符，用于散列登录口令和签名短时下载票据。
- `ADMIN_TOKEN`：管理员 API 和安装包上传凭据。
- `NAPCAT_ACCESS_TOKEN`：NapCat 反向 WebSocket 独立凭据，不得与管理员 Token 相同。
- `NAPCAT_ACCOUNT`：专用机器人 QQ 号；首次扫码后用于容器重启时快速登录。
- `NAPCAT_MAC_ADDRESS`：固定的本地管理 MAC；首次登录后不要修改，避免 QQ 将容器识别为新设备。
- `NAPCAT_QUICK_PASSWORD`：可选的机器人 QQ 密码，仅保存在服务器 `.env`；用于失效后自动重登。不要提交、截图或写入日志。
- `NAPCAT_QUICK_PASSWORD_MD5`：仅在不能使用明文变量时作为备用，两项只填写一项；MD5 仍等同登录凭据。
- `ALLOWED_QQ_GROUPS`：逗号分隔的全部授权 QQ 群号。

生成随机值时可使用 `openssl rand -base64 48 | tr -d '\n'`。不要把 `deploy/.env`、数据库密码、NapCat Token 或 Android keystore 提交到 Git。

首次启动前创建专用于 NapCat 的稳定 machine-id；此文件已被 Git 忽略，首次扫码登录后不得删除或重新生成：

```bash
mkdir -p private
umask 077
test -s private/napcat-machine-id || openssl rand -hex 16 > private/napcat-machine-id
```

## 3. 首次启动

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app caddy
```

服务启动时会自动创建数据库表，并把 `ALLOWED_QQ_GROUPS` 写入授权群表。确认以下检查通过：

```bash
curl -fsS https://babylink.top/health
curl -I https://babylink.top/access
```

应用静态资源默认需要登录；未登录浏览器会跳转到 `/access`。健康检查、登录口令接口和 NapCat 入口是最小公开面。

## 4. NapCat 配置

使用专用 QQ 作为机器人，并让它加入 `ALLOWED_QQ_GROUPS` 中的全部群。NapCat 配置 OneBot 11 反向 WebSocket：

生产 Compose 固定了 NapCat 镜像摘要、hostname、MAC 和 machine-id。升级 NapCat 时应先备份 `napcat_qq`、`napcat_config` 卷及 `private/napcat-machine-id`，再显式更新镜像摘要；不要改回浮动的 `latest` 标签。

NapCat WebUI 只绑定服务器 `127.0.0.1:6099`，在本机建立 SSH 隧道后访问，禁止直接开放公网端口：

```bash
ssh -L 6099:127.0.0.1:6099 root@149.104.26.54
```

随后打开 `http://127.0.0.1:6099/webui`，首次 Token 可从 `docker-compose logs napcat` 查看并在页面中完成机器人 QQ 扫码登录。

- 地址：`wss://babylink.top/api/napcat/onebot`
- Access Token：与 `NAPCAT_ACCESS_TOKEN` 一致
- 如果 NapCat 配置界面不能发送 Authorization Header，可使用 `wss://babylink.top/api/napcat/onebot?access_token=<token>`
- 开启群消息、群成员增加和群成员减少事件。

同一 Compose 网络中也可以使用内部地址 `ws://app:3000/api/napcat/onebot?access_token=<token>`，避免经过公网；生产部署默认推荐该地址。

不要启用公网 OneBot HTTP Server。NapCat 应主动向 BabyLink 发起 WSS 连接。

用户注册流程：

1. 用户在 `/access` 输入 QQ。
2. 页面生成 `/link 绑定 XXXXXXXX`。
3. 用户必须用同一 QQ 在任一授权群发送该命令。
4. 服务器核对事件中的 `user_id`、`group_id` 和一次性口令后创建设备会话。

用户需要远程退出全部设备时，可用自己的 QQ 在任一授权群发送 `/link 清空设备`。机器人只接受授权群内发送者对自身 QQ 执行该命令，并撤销全部设备、会话和未完成登录请求；重新使用时必须再次验证。

机器人连接后会自动同步所有群成员，之后每 `GROUP_SYNC_MINUTES` 分钟全量校准。退群事件会立即更新成员状态；当用户不再属于任何授权群时，其全部会话被撤销。
服务端每 30 秒调用 OneBot `get_status` 检查真实 QQ 在线状态。仅 WebSocket 存活但 QQ 已下线时，访问页会暂停生成验证码，避免用户发送无法处理的绑定命令。

需要免重复扫码时，在服务器终端运行 `sh configure-napcat-quick-login.sh`，仅在隐藏输入提示中键入机器人 QQ 密码。脚本只把密码 MD5 写入权限为 0600 的 `.env`，随后重建 NapCat；MD5 仍是可复用登录凭据，必须按密码同等级保护。安装 watchdog：

```bash
cp systemd/babylink-napcat-watchdog.* /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now babylink-napcat-watchdog.timer
```

watchdog 每分钟读取公开 Bot 在线状态；服务器完成过真实状态检测并连续离线至少 2 分钟后才尝试重启一次，让快速登录凭据接管。恢复在线会自动清除恢复锁；若腾讯要求验证码、设备解锁或冻结账号，watchdog 不会循环重试，不能通过增加重试频率绕过风控。云服务器仍频繁触发风控时，应把 NapCat 迁移到固定住宅网络设备，并继续使用现有 `wss://babylink.top/api/napcat/onebot` 反向连接。

手动触发同步：

```bash
curl -X POST https://babylink.top/api/admin/napcat/sync -H "Authorization: Bearer $ADMIN_TOKEN"
```

## 5. 管理接口

管理员接口只接受 `Authorization: Bearer <ADMIN_TOKEN>`：

- `GET /api/admin/overview`：用户、活跃会话和授权群概览。
- `PUT /api/admin/groups/:groupId`：新增、改名或停用授权群。
- `PUT /api/admin/users/:qq/status`：将用户设为 `active` 或 `banned`。
- `POST /api/admin/napcat/sync`：立即全量同步群成员。
- `PUT /api/admin/releases/upload`：上传 APK、IPA、macOS DMG 或 Windows NSIS EXE 并发布版本。

管理员 Token 只在受控终端使用，不放入网页、客户端、截图或群文件。

## 6. 用户数据与备份

- 聊天、角色、世界书、消息和 API 配置保存在用户设备 IndexedDB。
- Fastify/PostgreSQL 只保存 QQ、授权群成员状态、设备、会话、发布版本和安全审计。
- 云备份在设备内通过 PBKDF2-SHA-256 派生密钥并使用 AES-256-GCM 加密；Google Drive、OneDrive、Dropbox 使用用户账号自带免费空间并由设备直传，LINK 服务端不接收、不存储、不转发备份内容、Token 或恢复密钥。
- 云端自动备份仅在应用运行或重新回到前台时执行，移动系统不会保证网页真正后台运行。
- 用户必须离线保存恢复密钥；密钥丢失后管理员也无法恢复备份。

账号数据库仍需每日异地备份：

```bash
docker compose exec -T postgres pg_dump -U link -d link | gzip > "link-auth-$(date +%F).sql.gz"
```

备份文件包含 QQ 号，必须加密保存并设置保留周期。

## 7. Android 固定签名与发布

Android release 更新必须永久使用同一份 keystore。先复制配置：

```bash
cd android
cp keystore.properties.example keystore.properties
```

把 keystore 放在 `android/`，填写真实密码。至少制作三份离线加密备份；丢失后已安装用户无法覆盖升级。
公开证书指纹记录在 `android/release-certificate.sha256`；每次发布前应确认 APK 签名指纹一致，keystore 本体和密码不得提交。

在安装 JDK 21 和 Android SDK 的构建机执行：

```bash
npm run build
npx cap sync android
cd android
./gradlew :app:assembleRelease
```

也可以在仓库 Actions 中手动运行 `Build signed Android APK`。首次使用前，把同一份 keystore 和配置写入以下 Actions Secrets：

- `BABYLINK_ANDROID_KEYSTORE_BASE64`
- `BABYLINK_ANDROID_STORE_PASSWORD`
- `BABYLINK_ANDROID_KEY_ALIAS`
- `BABYLINK_ANDROID_KEY_PASSWORD`

工作流会使用 JDK 21 构建 release，强制验证 APK v2 签名，并将签名证书 SHA-256 与 `android/release-certificate.sha256` 比对后才上传 artifact。

每次发布必须递增 `android/app/build.gradle` 中的 `versionCode`，并同步修改 `versionName`。随后从仓库根目录上传：

```bash
ADMIN_TOKEN='<admin-token>' node scripts/publish-release.mjs android android/app/build/outputs/apk/release/app-release.apk 2 1.1.0 1 '更新说明'
```

Android 原生壳会读取真实 `versionCode` 并从登录接口取得 5 分钟下载票据。1.0.11 起，BabyLink 在应用内下载 APK，依次校验 SHA-256、包名、递增版本号和当前安装包签名证书，再通过 `PackageInstaller` 提交覆盖升级；最终安装仍由 Android 系统界面确认。1.0.10 及更早版本首次升级会回退系统浏览器，升级到 1.0.11 后即可使用应用内更新。

Android 原生保活使用前台服务、低优先级常驻通知和可选的 CPU Wake Lock。首次开启时需要允许通知，并建议在系统弹窗中允许 BabyLink 忽略电池优化；关闭页面中的保活总开关会停止前台服务并释放 Wake Lock。浏览器和旧 APK 会自动回退到静音音频、Service Worker 与 Web Wake Lock。

Themes 全局分栏的全屏开关在 Android 1.0.5 起由 `LinkDisplay` 原生插件持久化，并在 Activity 创建、恢复和重新获得焦点时通过平台与 AndroidX WindowInsetsController、沉浸式兼容 flags 和延迟重试隐藏顶部状态栏与底部导航/手势栏。旧 APK 只能使用 Capacitor SystemBars 回退，部分 Android ROM 可能会自行恢复系统栏。
Android Activity 使用 `adjustResize` 避让软键盘；沉浸模式不设置会阻止窗口缩放的 `FLAG_FULLSCREEN`，聊天输入区按 Visual Viewport 同步可见高度，Stickers 面板作为聊天页 flex 子节点真实占位。

Android 1.0.6 起，角色消息使用带角色头像的原生 MessagingStyle 通知，通知点击会进入对应聊天或 VOOM；聊天与 VOOM 图片通过 `LinkMedia` 写入系统 `Pictures/BabyLink` 相册，不再依赖 WebView 的 `<a download>`。

Android 1.0.7 起，MessagingStyle 会按生成顺序展示本轮全部角色消息，并仅保留消息行左侧的角色头像。Keep Alive、Update、Backup、QQ Access 与 Data 移入 Services 独立子页面；Ringtones 和 Settings 不再承载这些入口。

Android 1.0.8 起，本地 ZIP 备份通过 `LinkBackup` 原生桥接写入系统 `Downloads/BabyLink`，不再依赖 Android WebView 的 `<a download>`。网页端仍使用浏览器原生下载。角色消息迁移到新的高优先级通知通道，并显式启用通知音与震动，以恢复解锁状态下的悬浮横幅。

Android 1.0.11 起，Themes 的全站、线上、线下样式及主页主题 PNG 使用系统原生文件选择器导入，并通过系统分享面板导出；网页端仍使用浏览器文件选择与下载回退。

## 8. iOS 用户自签

普通网页更新不需要重新打包 IPA。只有 Capacitor 插件、原生权限或壳配置改变时才需要新版本：

```bash
npm run build
npx cap sync ios
```

通过 Xcode 或现有 IPA 打包流程生成 IPA 后上传：

```bash
ADMIN_TOKEN='<admin-token>' node scripts/publish-release.mjs ios path/to/BabyLink.ipa 2 1.1.0 1 '更新说明'
```

仓库 Actions 中的 `Build unsigned iOS IPA` 可在 macOS runner 生成不含 Apple 证书或描述文件的 IPA 和相对路径 SHA-256 清单。工作流会先对 App 与嵌套框架执行 ad-hoc 完整性签名并验证 arm64 架构，避免部分外部签名工具漏签动态框架后导致启动即退出；安装前仍必须由 AltStore、SideStore、Sideloadly 等工具使用用户自己的 Apple ID 重新签名。

用户可在 BabyLink 的 Update 页面复制受保护的 AltStore/SideStore Source。更新源使用长期随机令牌，不暴露 QQ 或登录 Cookie；每次刷新 Source 和下载 IPA 时，服务器都会重新检查账号状态与授权群成员资格。外部签名工具会展示新版本并执行覆盖安装，用户也可继续手动下载 IPA。

iOS 仍不能在 BabyLink 内静默自更新。安装、签名和续签由 Apple ID、AltStore、SideStore、Sideloadly 或其他合法外部工具完成；免费 Apple ID 的签名有效期也由 Apple 决定。1.0.3 起，Themes 的全站、线上、线下样式及主页主题 PNG 使用 iOS 系统文件选择器导入，并通过系统分享面板导出。

## 9. 桌面助手发布

桌面助手必须在对应系统构建。macOS 使用 `npm run bridge:desktop:dist` 生成 DMG，Windows 使用同一命令生成 NSIS EXE；正式发布前应分别配置 Apple Developer ID、公证凭据和 Windows 代码签名证书。

生成安装包后，通过现有受保护发布接口上传。`versionCode` 必须按平台递增，`versionName` 应与根 `package.json` 版本一致：

```bash
ADMIN_TOKEN='<admin-token>' node scripts/publish-release.mjs desktop-macos bridge-dist/BabyLink-Bridge-0.1.0-mac-arm64.dmg 1 0.1.0 1 '电脑助手首个 macOS 版本'
ADMIN_TOKEN='<admin-token>' node scripts/publish-release.mjs desktop-windows bridge-dist/BabyLink-Bridge-0.1.0-win-x64.exe 1 0.1.0 1 '电脑助手首个 Windows 版本'
```

发布成功后，登录用户会在 BabyLink → Services → MCP Studio → 连接的电脑助手区域看到版本号、文件大小和下载按钮。下载 URL 使用与 APK/IPA 相同的五分钟签名票据；未发布的平台只显示“暂未发布”，不会生成假链接。

## 10. 更新与回滚

更新代码：

```bash
git pull --ff-only
cd deploy
docker compose up -d --build
docker compose logs --tail=200 app caddy
```

静态网页更新由 PWA Service Worker 拉取。原生壳继续加载 `https://babylink.top`，所以绝大多数 UI 和业务更新无需重新发布 APK/IPA。

回滚时切回上一个经过验证的 Git 提交并重新构建。不要删除 PostgreSQL、Caddy 和 releases volumes。

## 10. 安全边界

登录、短时票据、设备限制、退群撤权和受保护静态资源只能提高二次传播门槛，不能阻止已授权用户截取页面或逆向客户端。不得把长期密钥放入 JavaScript、APK、IPA 或仓库；真正的授权判断始终由服务器完成。