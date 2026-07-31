# BabyLink Termux MCP 网关

这个网关在 Android 手机的 Termux 中运行。BabyLink APK 通过受限的 Android 原生回环中继访问 `http://127.0.0.1:8765/mcp`，不需要电脑，也不需要把应用的全局明文流量开关打开。

QQ 不在这个网关中实现，继续使用电脑上的 BabyLink Bridge + NapCat / OneBot。

## 安装

建议从 F-Droid 安装 Termux、Termux:API 和可选的 Termux:Boot；不要混用不同来源的 Termux 插件。

已有 Termux 时，直接复制这一条命令：

```sh
curl -fsSL https://babylink.top/termux/bootstrap.sh | sh
```

安装文件由 `babylink.top` 提供，不依赖 GitHub。若下载失败，检查网络是否能访问本站 HTTPS 地址；无需也不要粘贴 GitHub Token。自托管镜像可设置 `BABYLINK_MCP_ARCHIVE_URL` 指向自己的 `termux.tar.gz`。

安装器会：

- 从 `babylink.top` 下载当前版本的 `termux` 安装包，不要求先克隆完整仓库。
- 安装 Node.js、OpenSSL 命令行工具、curl 和 Termux:API 命令行包。
- 将网关复制到 `~/.local/share/babylink-mcp/app`。
- 在 `~/.config/babylink-mcp/config.json` 生成权限为 `0600` 的随机 64 位十六进制 Bearer Token。
- 创建 `~/.termux/boot/babylink-mcp`，配合 Termux:Boot 在开机后启动网关。
- 自动后台启动网关，并直接打印可以粘贴到 BabyLink 的配对 JSON。

Termux:API 命令行包还需要手机安装并授权 Termux:API App；否则只有系统通知工具不可用，其他连接器不受影响。

## 同机连接

安装后用统一命令管理网关：

```sh
babylink-mcp status
babylink-mcp restart
babylink-mcp logs
```

重新生成导入配置：

```sh
babylink-mcp pair
```

复制输出的整个 JSON，然后打开 BabyLink → Services → MCP Studio → 连接 → 导入配置。导入后应显示“Termux · Android 本机网关”，自动检测会发现内置工具。

也可以点击 Studio 中的“BabyLink Termux 网关”手动添加：地址保持 `http://127.0.0.1:8765/mcp`，API Key 填 `config.json` 中的 `token`。

## 可选 HTTPS 隧道

同一手机上的 BabyLink 不需要隧道。只有网页/PWA、另一台手机或跨设备客户端需要公开 HTTPS 时才运行：

```sh
babylink-mcp tunnel
```

Cloudflare Quick Tunnel 输出域名后，在另一个会话生成对应配对信息：

```sh
babylink-mcp pair https://随机域名.trycloudflare.com/mcp
```

Quick Tunnel 地址每次会变化，不适合长期固定连接。公开地址仍受 Bearer Token 保护；不要截图、分享或提交配对 JSON 和 `config.json`。

## 配置

主配置位于 `~/.config/babylink-mcp/config.json`。修改后重启网关。

推荐运行交互式向导，不需要手改 JSON：

```sh
babylink-mcp setup
babylink-mcp restart
```

| 配置 | 用途 | 是否必需 |
| --- | --- | --- |
| `connectors.amapWebKey` | 高德 POI 和步行/骑行/驾车路线 | 仅地图能力需要 |
| `connectors.kuaidi100Customer` / `kuaidi100Key` | 快递100企业查询 | 仅快递能力需要 |
| `connectors.bilibiliCookie` | 当前 B 站账号收藏夹 | 仅收藏夹需要；公开搜索/详情/评论/字幕不需要 |
| `connectors.taobao` | 淘宝开放平台 App Key/Secret、Session、联盟 PID/adzone_id | 仅淘宝真实搜索、优惠券和联盟链接需要 |
| `connectors.douyin` | 抖音 Cookie 文件路径、社区 MCP 目录和可选 ASR 配置 | 仅抖音实验能力需要 |
| `priceCheckIntervalMinutes` | 后台价格检查周期 | 默认 180 分钟；设为 0 可关闭 |
| `allowedOrigins` | 浏览器跨域来源白名单 | APK 原生回环中继不依赖 CORS；公开网页连接时需要 |

所有平台 Key、Cookie 和上游请求头只保存在权限为 `0600` 的 Termux 配置/独立 Cookie 文件中，不会作为工具结果、审计日志或配对 JSON 返回给 BabyLink。价格状态和购物清单保存在 `~/.local/share/babylink-mcp/state.json`。

## 内置能力

- 淘宝：使用用户自己的淘宝开放平台/TOP + TBK 授权进行关键词搜索、商品详情、券后价、销量、店铺、对比、联盟链接、预算推荐和本地购物清单。未配置授权时明确报错，不回退成普通网页搜索。
- 分享链接：统一解析短链，覆盖淘宝、拼多多、京东、闲鱼、B站、微博、知乎、快手、微信、美团、大众点评、携程、饿了么和得物等常见域名；提取清洗后的正文、多图、JSON-LD 商品字段和页面明确公开的结构化评论。
- 公开网页：Bing RSS 搜索，返回真实来源 URL。
- B 站：公开视频/UP 主搜索、视频详情、热门评论、公开字幕；配置 Cookie 后可读收藏夹。
- 豆瓣：限制到豆瓣域名的电影、书籍和综合公开搜索。
- 音乐：Apple iTunes Search 的歌曲、专辑、封面和试听 URL；BabyLink Reality 工具可将试听结果加入一起听播放队列。
- 地图：高德 POI、附近搜索和真实路线。
- 快递：快递100企业查询。
- 菜谱：TheMealDB 菜谱、步骤、食材和购物清单；BabyLink 可创建烹饪计时提醒。
- 价格追踪：仅抓取用户提供的公开 HTTPS 商品页，不访问私网；保留历史并在达到目标价时发送 Termux 通知。
- 通知：通过 Termux:API 发送当前手机的系统通知。

通知收件箱、剪贴板分析和 App 使用报告由 BabyLink Android 原生 Reality MCP 提供，不经过 Termux。通知监听和用时访问都必须由用户在系统设置中单独授权。

## 小红书上游

运行 `babylink-mcp setup` 可配置 `xpzouying/xiaohongshu-mcp` 的 Streamable HTTP 地址，默认是 `http://127.0.0.1:18060/mcp`。网关为工具增加 `xhs__` 前缀，并用白名单只暴露登录状态、推荐、搜索、详情/评论和用户资料；不暴露发布、发表评论、点赞、收藏和删除等写操作。

`xpzouying/xiaohongshu-mcp` 是社区开源项目，不是小红书官方接口或官方 MCP。它需要浏览器自动化和扫码登录；当前稳定发布不提供 Linux ARM64/Android 二进制，因此不能承诺直接在 Termux 原生运行。可行方式是：

1. 若上游未来提供可工作的 Android/Linux ARM64 构建，在同机启动后把示例项 `enabled` 改为 `true`。
2. 在用户自己的电脑或服务器运行上游，再把 `url` 改为带独立鉴权的 HTTPS MCP 地址。

无论哪种方式，登录 Cookie 只应保存在上游所在设备。BabyLink 和 Termux 网关不会把普通网页搜索或 Deep Link 冒充小红书平台搜索。

## 抖音实验适配器

`babylink-mcp setup` 支持两种真实抖音 MCP：

1. 自动尝试安装 `pazwusimple-netizen/douyin-mcp`，通过 stdio 聚合。
2. 连接用户自己部署的带鉴权 HTTPS MCP。

网关白名单暴露 Cookie 登录状态、关键词搜索、视频详情、作者、评论/回复、分享短链解析、媒体下载、OCR 和 ASR。Cookie 默认单独保存到 `~/.config/douyinmcp/cookies.txt`，不会进入 BabyLink 配置。

运营中心可把这些小红书/抖音只读连接绑定为“用户账号”，授权指定角色查询账号资料、作品、内容和评论；Termux 的默认白名单不会将它们作为角色点赞、评论、发帖或私信账号。角色写入仍需要另一个实际提供写工具的角色账号连接。

## 用户本人手动互动（点赞、评论、私信）

运营中心的“我的账号”标签提供单独的“手动互动”入口。它与角色账号、角色队列完全隔离：只有用户亲手打开弹窗、填写目标和内容、并再次确认后，才会调用平台工具；角色、聊天模型和定时任务不能借用此入口。

Termux 默认仍然是只读，因而默认不能评论或私信。只有同时满足以下条件，才可在 `babylink-mcp setup` 中启用：

1. 用户已经在自己的 Termux、电脑 Bridge 或 HTTPS 上游完成合法登录。
2. 上游真实提供了对应的写工具，并且能在当前 Android/ARM64 环境运行。
3. 在向导的“开启手动点赞、评论、私信等写入工具”确认中选择开启，并逐项填写上游**实际**工具名；向导会把它们加入精确 `allowedTools` 白名单，而不是放开全部工具。
4. 重启网关，重新在 MCP Studio 检测连接，并将连接的工具策略设为“全部允许”。

例如自有适配器常见的工具名可能是 `like_note`、`comment_note`、`send_direct_message`（小红书）或 `like_video`、`comment_video`、`send_direct_message`（抖音），但必须以 MCP Studio 实际发现的工具为准。社区上游若没有这些工具、登录失效、平台要求验证码或 Android ARM64 不兼容，应用会显示真实错误，不会伪造发送成功。

不要将 Cookie、密码或平台 Token 粘贴到 BabyLink 的账号展示 ID、草稿、评论正文或聊天中；它们只应存放在上游自己的 `0600` 本地配置或独立登录流程内。使用前也应确认操作符合平台规则与账号授权范围。

该社区项目使用 Python、本地 V8 签名、ffmpeg，并可选 Chromium/Playwright。Android ARM64 上的 Python 原生依赖与 Chromium 支持因机型和 Termux 版本而异，因此这是轻量实验能力：安装器会真实尝试构建；失败时保持上游禁用并给出错误，不会用普通网页搜索冒充抖音 API。ASR 还需要用户自己的服务商 Key。

## 淘宝开放平台

向导需要用户自己的淘宝开放平台/TBK 授权：App Key、App Secret、Session、PID/adzone_id。内置连接器实现淘宝 TOP 的 MD5 签名，并调用用户账号有权限的方法。不同开发者应用能调用的方法可能不同；接口返回无权限时会原样说明平台错误。

联盟链接由用户自己的 PID 生成。BabyLink 不自动下单，也不会把推广链接伪装成原始链接；工具结果同时保留 `originalUrl` 和 `affiliateUrl`。

## 自定义 MCP 上游

`httpServers` 支持公开 HTTPS 或同机回环 HTTP 的 Streamable HTTP MCP；`stdioServers` 可启动能在 Termux ARM64 环境运行的本地进程。每个上游都可配置：

- `prefix`：避免不同服务工具重名。
- `headers`：只保存在本地的上游鉴权头。
- `readOnly`：默认开启；开启时过滤已标记或命名上明显属于写操作的工具。
- `allowedTools`：可选明确工具白名单；适合社区平台 MCP，优先于启发式只读判断。
- `timeoutMs`：3 秒到 120 秒。

## 故障排查

- BabyLink 显示连接失败：确认网关会话仍在运行、地址是 `127.0.0.1`、Token 与配对 JSON 一致，并重新检测。
- 通知失败：确认 Termux:API App 和命令行包来自同一来源，且系统已授予通知权限。
- 开机没有启动：打开一次 Termux:Boot，并取消系统对 Termux 和 Termux:Boot 的电池优化限制。
- 地图或快递提示未配置：补齐对应服务商 Key 后重启网关。
- 小红书工具没有出现：网关会在日志中记录上游发现错误；检查上游是否已登录、HTTP MCP 是否可达，以及 `enabled` 是否为 `true`。