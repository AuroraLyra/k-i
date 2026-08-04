# LINK 跨平台稳定性与性能修复方案

> 方案日期：2026-08-02  
> 状态：核心跨端修复已实施并于 2026-08-02 发布网站、Android `1.0.25 (26)` 与 iOS `1.0.25 (26)`；已通过 Web/服务端生产构建、全套现有回归、APK 签名、arm64 无签名 IPA、发布记录、兼容清单和线上健康检查。真实设备、PWA 两连续发布更新和完整登录聊天仍须按本文件的物理验收矩阵完成。  
> 目标：修复 iOS PWA 底部留白/输入异常、Android APK 卡顿，并把 Web PWA、Android APK、iOS IPA 的运行边界变成可验证、可回滚的契约。

## 1. 决策摘要

LINK 不需要推倒重写为三套独立应用。Vue、Vite、PWA、Capacitor、IndexedDB 和 TanStack Virtual 都可继续使用；问题在于同一件事存在多位“所有者”：视口高度、软键盘、系统栏、媒体加载、后台任务和版本更新都由多层逻辑同时处理。

本方案的核心是：

1. **每种运行形态的屏幕与键盘只有一个事实来源。**布局只消费一个标准化运行时快照，不再由 CSS、`visualViewport`、`innerHeight`、键盘事件、猜测高度和多个页面 transform 分别修正。
2. **聊天输入区留在同一个 flex 布局中。**正常情况下靠容器缩小而非“把输入框向上搬”；`VisualViewport` 只作为明确的 overlay 回退和诊断数据，不能成为所有平台的主布局引擎。
3. **本地数据按启动壳、会话索引、按需领域数据三层加载。**不再把全部 IndexedDB 数据和全部媒体在一次启动中装进全局响应式状态。
4. **PWA、APK、IPA 采用明确且可观测的版本协议。**禁止旧内嵌前端、线上前端和 Service Worker 缓存无感混用；更新不打断正在输入、通话或导入的数据。
5. **Themes 保持无限制 DIY。**不对白名单、选择器、`@import`、`position`、`transform`、根元素样式或用户 CSS 文本做过滤、限制、沙箱化、自动改写或强制覆盖。
6. **Theme scale 保留真实根级缩放。**不将现有整体缩放降级为仅改变字号/间距的“视觉近似”；布局运行时必须用统一坐标换算适配缩放后的 iOS 键盘、安全区和全屏几何。
7. **主动消息、保活和自动备份采用可恢复的持久化任务状态。**持久化“应执行什么、执行到哪里、何时重试”，不伪造已被系统终止的后台进程仍在运行。
8. **线上主题获得稳定的消息分组类名。**线上私聊、群聊及其他线上消息渲染器统一提供首条、中间、尾条和单条气泡语义，供用户 CSS 任意 DIY。

本方案追求可控风险，不承诺不存在设备特例。移动浏览器、厂商 WebView、系统键盘和安全区不提供统一的零差异合约；成熟实践是把差异压缩在平台适配层，并用真机矩阵、灰度、指标和可回滚迁移持续管理。

## 2. 当前证据与根因

### 2.1 视口和输入区

当前 `src/app/viewport.ts` 同时读取 `visualViewport`、`innerHeight`、`offsetTop`、原生 Keyboard 事件和 Android 估算键盘高度；再将计算结果写回 CSS 自定义属性。`src/styles/main.css` 同时使用 `vh`、`svh`、`dvh`、固定 `html/body/#app` 高度、安全区、iOS PWA 缩放和键盘特例。私聊、群聊、线下页、选中工具栏和 Composer 又分别消费或覆盖 `--keyboard-inset`。

这会导致以下竞争：

```mermaid
flowchart TD
  A[浏览器或 WebView 布局视口] --> X[页面高度]
  B[VisualViewport] --> X
  C[Capacitor Keyboard 事件] --> X
  D[Android 键盘估算回退] --> X
  E[全屏/SystemBars/WindowInsets] --> X
  X --> F[CSS 变量]
  F --> G[聊天容器]
  F --> H[Composer transform]
  F --> I[各页面补偿规则]
  J[Theme 缩放] --> K[body zoom / transform]
  K --> G
  K --> H
```

对 iOS 主屏 PWA，`interactive-widget=resizes-content` 不能视为可依赖的键盘合约。MDN 的兼容性数据表明该 viewport 提示在 iOS Safari 和 iOS WebView 中不支持；`VisualViewport` 可用，但它代表可视视口而非必然变化的布局视口，并且官方示例明确提示用 transform 模拟 device-fixed 可能在滚动时闪烁。

### 2.2 Android APK

当前 Android 壳同时配置：

- Activity `adjustResize`；
- Capacitor Keyboard 原生 resize 及 `resizeOnFullScreen`；
- Capacitor `SystemBars` CSS inset 策略；
- 自定义 `LinkDisplayPlugin` 的 edge-to-edge、隐藏系统栏和多次延迟重放；
- Web 层的键盘高度推断、`--keyboard-inset` 和滚动定位。

Capacitor v8 的 Keyboard 文档指出：`resize` 是 iOS 的 resize mode；Android 的 `resizeOnFullScreen` 是 StatusBar 覆盖全屏时 WebView 无法正常随键盘缩小的专门 workaround。当前组合不能保证每层都只执行一次，因此出现跳动、双重缩小、底栏留白或输入框移位并不意外。

### 2.3 启动、内存与后台工作

`src/data/db.ts` 的 `loadSnapshot()` 并发 `getAll()` 读取 43 个 store；`src/stores/appStore.ts` 将完整快照归一化后进入全局响应式状态。首次没有 Service Worker controller 时，`hydrateStoredMediaRefs()` 还会递归读取存储媒体并创建 Object URL。

聊天虚拟列表已经降低了 DOM 数量，但完整消息、会话、媒体引用和跨领域数据仍驻留在 Store。根组件还在运行主动消息检查、备份检查、主题 watcher、保活以及可见性/网络恢复监听；启用 Keep Alive 时会以 15 秒周期恢复状态。

### 2.4 版本和更新

Capacitor 直接启动远程 `https://babylink.top/home`，而 Android/iOS 项目又各自带有本地 Web 资源。不要使用 `server.appStartPath` 指向 Vue SPA 路由：Capacitor 8 会先把它当作本地打包文件校验，`/home` 不存在时会在 WebView 初始化前退出。PWA 使用 Workbox `skipWaiting`、`clientsClaim` 和自动更新；`src/main.ts` 在 Service Worker controller 改变时直接刷新页面。这使以下状态可能同时存在：

- 服务端刚发布的新网页；
- 旧 Service Worker precache；
- 已安装 APK/IPA 的旧内嵌资源；
- 正在运行但尚未保存草稿的页面状态。

## 3. 非破坏性 Theme 兼容契约

### 3.1 必须保持的行为

Themes 是产品能力，不是应用样式的受限皮肤。实施任何修复时必须保持以下事实：

| 契约 | 必须保持 |
| --- | --- |
| CSS 能力 | 用户可写任意有效 CSS，包括 `html`、`body`、`#app`、任意组件选择器、自定义属性、媒体查询、动画、`position`、`transform`、`filter` 和 `@import`。 |
| 数据模型 | 现有全局、线上、线下主题预设及其导入/导出格式保持兼容，不重置、不删除、不静默改写。 |
| 注入方式 | 继续按既有全局/线上/线下作用域和层叠顺序注入；不改成 Shadow DOM，不给现有样式套 iframe，不把主题移到受限 CSS parser。 |
| 字体 | 自定义字体、缓存字体和用户选择的整体缩放值继续生效。 |
| 层叠权 | 不新增位于用户主题之后的全局 `!important` 布局覆盖层；正常 CSS 层叠仍由用户控制。 |

禁止采用下列“看似修复、实际破坏 DIY”的方案：

- CSS 白名单、黑名单、属性过滤、选择器过滤或 sanitizer；
- 将主题包裹进 Shadow DOM、`@scope` 或 iframe；
- 禁用用户对根元素、Composer、页面高度、定位、系统栏色彩或动画的修改；
- 为了稳定性把主题样式全部强制置于基础样式之前或之后；
- 自动删除疑似造成问题的主题规则。

### 3.2 无法消除的边界

“任意 DIY”与“任意 CSS 都保证布局不变”在逻辑上不能同时成立。例如用户主动写入 `body { height: 200px }`、`.composer { display: none }` 或 `#app { transform: rotate(90deg) }`，浏览器必须按用户 CSS 渲染。

因此验收边界是：

1. 默认主题、官方预设和不改变功能几何关系的自定义主题必须稳定；
2. 用户的自定义 CSS 继续拥有改变功能几何关系的自由；
3. 应用只提供**非侵入诊断**和用户主动的临时恢复入口，绝不自动修改主题内容、禁用主题或改变层叠顺序；
4. 平台修复本身不能依赖“主题没有覆盖这些属性”才能正常运行。

### 3.3 Theme Health：只报告，不干预

新增可选的本地诊断视图，不改变现有 Themes 编辑器语义：

- 显示当前环境、`visualViewport`、布局容器、Composer、键盘状态和安全区的实际几何值；
- 显示主题预设 ID 与内容 hash，不上传主题原文；
- 当根容器高度为零、Composer 超出可视区域、主题导致 `display:none` 等明显不可用状态时，仅提示“当前主题可能改变了页面几何”；
- 提供“本次会话以默认样式预览”操作，必须由用户点击，刷新后恢复原主题；
- 不写回设置、不删除预设、不限制保存、不阻止导入。

该能力既保护完全 DIY，也让用户能区分“平台布局缺陷”与“主题有意改变布局”的结果。

### 3.4 线上消息气泡分组类名契约

线上主题需要能够对连续消息的圆角、间距、头像、阴影和连接效果完全 DIY。授权实施后，`MessageBubble` 在保留现有 `.message-row`、`.bubble-wrap`、`.bubble-stack` 和 `.bubble` 类名的前提下，新增以下**加性**类名与数据属性：

| 分组位置 | 消息行类名 | 气泡类名 | 数据属性 |
| --- | --- | --- | --- |
| 单条 | `.message-group-single` | `.bubble-group-single` | `data-message-group="single"` |
| 连续首条 | `.message-group-first` | `.bubble-group-first` | `data-message-group="first"` |
| 连续中间 | `.message-group-middle` | `.bubble-group-middle` | `data-message-group="middle"` |
| 连续尾条 | `.message-group-last` | `.bubble-group-last` | `data-message-group="last"` |

示例选择器：

```css
.chat-room .message-row.char.message-group-first .bubble { /* 连续角色消息首条 */ }
.chat-room .message-row.user.message-group-middle .bubble { /* 连续用户消息中段 */ }
.chat-room .bubble.bubble-group-last { /* 连续消息尾条 */ }
```

分组在虚拟列表的**数据层**计算，再通过 `groupPosition` prop 传入 `MessageBubble`；不得用相邻已渲染 DOM 判断，否则向上/向下虚拟滚动时会出现错误圆角。两个线上消息仅在以下条件同时成立时属于同一组：

1. 均为可分组的普通对话气泡；系统消息、时间分隔、旁白、贴纸、图片、通话、转账、交易、MCP 结果及其他独立卡片均为 `single`；
2. 视觉发送者、群聊作者身份和消息方向相同；
3. 两条消息之间没有时间分隔，且时间间隔不超过统一常量 `messageGroupMaxGapMs`；
4. 引用、撤回、编辑、AI 生成、头像隐藏或用户主题不会改变分组判定，只影响其自身既有状态类。

`first` 表示仅与下一条同组，`middle` 表示前后均同组，`last` 表示仅与前一条同组，`single` 表示前后均不属于同组。类名对线上私聊、群聊和复用 `MessageBubble` 的线上页面一视同仁；不会自动注入任何用户主题规则，也不会删除现有主题中的选择器。

## 4. 目标运行时架构

### 4.1 一个 `LayoutRuntime`，一个发布者

新增纯运行时模块（建议 `src/app/layoutRuntime.ts`），将平台检测与几何采样统一为只读快照：

```text
LayoutRuntimeSnapshot
  environment: web | pwa-ios | pwa-android | native-ios | native-android
  viewportOwner: css-dynamic | native-webview-resize | visual-overlay-fallback
  layoutWidth, layoutHeight
  visualWidth, visualHeight, visualOffsetTop, visualScale
  safeTop, safeRight, safeBottom, safeLeft
  keyboardState: hidden | resizing | overlay | unknown
  keyboardOcclusion
  themeScale
  fullscreenState: windowed | pwa-fullscreen | browser-fullscreen | native-fullscreen
  revision, sampledAt
```

规则：

1. 任何一次渲染只采用一个 `viewportOwner`；运行中 owner 不因一次临时事件在多个策略之间来回切换。
2. `LayoutRuntime` 是唯一可以写入 `--app-*` 平台几何变量的模块。
3. 页面、Composer、Sticker 面板和 Modal 只读取标准变量与容器尺寸，不再各自推断键盘高度。
4. 原生 Keyboard 事件、`visualViewport` 事件和 `resize` 事件只作为各环境对应 owner 的输入或日志，不能都触发独立补偿。
5. 采样统一通过 `requestAnimationFrame` 合并；不在每个 `scroll`、`focus`、`resize` 回调中同步测量并写样式。
6. `fullscreenchange`、PWA display mode、原生系统栏恢复和 `link:fullscreen-change` 统一触发下一帧快照；全屏不是页面各自添加 padding 或再次猜测键盘高度的理由。

### 4.2 以正常布局为首选，以回退为例外

核心聊天页面采用单一纵向 flex shell：顶部栏、可滚动消息区、可选 Sticker 区、Composer 都属于同一容器。消息区 `min-block-size: 0; flex: 1`，输入区不使用全局 fixed 定位，也不靠默认的负向 translate 跟随键盘。

```mermaid
flowchart TB
  S[应用 Shell：唯一 block-size] --> H[Header：flex none]
  S --> M[Message scroller：flex 1 + min-block-size 0]
  S --> P[Sticker panel：可选 flex none]
  S --> C[Composer：flex none + safe-bottom]
```

各环境策略如下：

| 环境 | 布局 owner | 键盘策略 | `VisualViewport` 的角色 |
| --- | --- | --- | --- |
| 普通移动网页 / Android PWA | CSS 动态视口为主；`interactive-widget` 仅作浏览器提示 | 由 Shell 缩小，Composer 保持普通 flex 子项 | 记录和 overlay fallback，不与 CSS 高度双算 |
| iOS 主屏 PWA | CSS 动态视口为主；安全区来自 `env()` | 容器缩小优先；若系统仅遮挡可视视口，启用一条专属 overlay fallback | 只对需要避开遮挡的单个浮层计算，不改写整页 root 高度 |
| Android Capacitor | 原生 WebView resize | `adjustResize` 与单一 edge-to-edge owner 决定 WebView 可用高度 | 仅诊断；不再做猜测键盘高度 |
| iOS Capacitor | Capacitor Keyboard 的 iOS Native resize mode | 原生 WebView resize 为唯一键盘事实 | 仅诊断与焦点可见性检查 |

MDN 说明 `dvh` 会随浏览器动态 UI 改变而改变，这可能在滚动时触发界面尺寸变化和性能损耗；因此动态单位适合 Shell 高度，不适合在大量消息项、动画尺寸或每个子组件中反复参与复杂计算。`svh` 可作为不支持 `dvh` 的保守回退，`vh` 不能当作现代移动端的唯一高度语义。

### 4.3 保留真实缩放的输入控件适配

已确认 Theme scale 必须保留现有“真实整体缩放”体验：缩放影响实际页面坐标、组件尺寸与命中区域，不退化为只修改字号、间距和圆角的视觉近似。非 iOS 环境继续使用当前 `zoom` 语义；iOS PWA 继续使用当前根级 transform 缩放语义。Theme scale 的存储值、主题注入顺序和用户自定义 CSS 都不改变。

这项决定意味着 iOS 输入控件仍属于缩放后的根几何链，不能靠临时关闭 transform、替换主题或在键盘打开时切换为另一种视觉模式来“修复”。新 `LayoutRuntime` 必须以未缩放的浏览器/原生原始值采样视口、安全区、系统栏和键盘遮挡，再仅按 `themeScale` 做一次逻辑坐标换算；页面和 Composer 只能读取该换算后的单一结果，禁止在 CSS、页面和组件中再次除以缩放值。

必须用真机验证以下不变量：同一保存的 Theme scale 下，键盘显示与隐藏前后的视觉缩放不跳变；文字可输入；光标、选区、输入法候选栏、点击命中区和 Composer rect 均可见且正确；全屏进出后安全区和键盘换算仍只发生一次。若某一 iOS WebKit 版本在真实根级缩放下仍无法满足这些不变量，应关闭该环境的新布局 feature flag 并保留现有路径，不能静默把用户主题缩放改为视觉近似。

### 4.4 安全区和系统栏

`viewport-fit=cover` 需要配套 `env(safe-area-inset-*)`，不能只扩展到全屏。WebKit 的安全区指南明确要求对重要内容施加安全区 padding，并用 `max()` 保留普通边距。

目标规则：

- 网页/PWA：CSS `env()` 是安全区的权威来源；默认背景必须覆盖安全区，避免把正常 Home Indicator 区误判为“底部空白”。
- Android 原生：只保留一个 native edge-to-edge / SystemBars owner。该 owner 把稳定 WindowInsets 作为 CSS 变量发布，或让 WebView resize；不能由两个插件重复隐藏/显示系统栏。
- iOS 原生：原生控制器与 Keyboard plugin 的职责分开，状态栏和键盘避让不由主题 CSS 或页面脚本推断。
- 全屏是 `windowed`、`pwa-fullscreen`、`browser-fullscreen` 或 `native-fullscreen` 四种显式状态之一，而不是布尔假设。PWA 安装清单、浏览器 Fullscreen API、原生 `SystemBars` 与 `LinkDisplayPlugin` 只负责报告/执行各自状态；`LayoutRuntime` 是唯一把状态转换为布局变量的 owner。
- 用户关闭全屏、手势唤出系统栏、原生 Activity 恢复、分屏、多窗口或旋转时，Shell 都必须仍可用。全屏切换期间保留输入草稿、虚拟列表逻辑锚点和当前 Theme scale，不重建路由或无条件滚到底部。

### 4.5 Modal、Sticker 和滚动锚点

- Modal、Picker、全屏通话、媒体浏览器统一消费 `LayoutRuntimeSnapshot`，不单独读取 `window.innerHeight`。
- Sticker 面板继续是 Composer 上方真实 flex 布局的一部分；其高度由自身容器或 `ResizeObserver` 决定，不根据键盘高度二次补偿。
- 虚拟列表只在“用户位于底部附近”时跟随新消息；键盘打开时保存一个逻辑锚点，布局稳定后最多恢复一次。
- 禁止组件链中叠加多次 `nextTick`、`requestAnimationFrame`、延时滚底来抵消同一布局变化；每种意图只有一个队列。

## 5. 数据、媒体与启动性能设计

### 5.1 数据访问分层

目标 Store 不再以“全库快照”作为默认启动路径：

| 层级 | 启动时加载 | 用途 |
| --- | --- | --- |
| 启动壳 | 设置、当前账号、主题、会话索引、每个会话最后摘要/未读数 | 立即渲染 Home 与主题，不等待全库 |
| 领域缓存 | 当前路由需要的会话、角色、消息首屏、Stickers、当前设置页模型 | 页面进入时按索引或 cursor 获取 |
| 后台索引 | 历史消息、Fanfic 章节、记忆图谱、商城、媒体健康、备份数据 | 空闲、显式搜索或对应页面请求时加载 |

具体要求：

1. 为消息使用既有 `byConversation` 索引增加按时间 cursor 的分页读取；首屏只读最近窗口，向上滚动再加载历史窗口。
2. Home 只读会话列表投影，不扫描 `messages` 全表计算每项最后消息。
3. `appStore` 按领域拆分为数据 repository、会话缓存、消息缓存、设置与跨域协调器；跨领域操作保留显式事务接口。
4. 仍可保存完整备份，但导出使用 repository 流式读取，而不是要求 UI Store 已装载所有实体。
5. 冷启动快照继续存在，但只保存允许快速恢复的轻量投影；主题、字体、会话摘要和草稿优先。

#### 已实施：核心启动快照与独立领域快照分离

`loadAppStartupSnapshot()` 现在只读取主应用首屏和聊天协调器实际拥有的数据：账号、角色、会话、消息、主题、记忆、音乐、世界书、贴纸、收藏和设置。Fanfic、商城与角色运营继续由各自 Store 在对应页面或功能首次使用时调用独立快照读取；这三类数据不再在应用启动时被主 Store 重复读取、递归媒体物化并创建响应式副本。

完整备份、导入和恢复仍调用 `loadSnapshot()`。该入口先完成数据库初始化与旧数据清理，再组合核心快照与 Fanfic、商城、角色运营的全部独立快照，因此不改变备份文件的覆盖范围、导入后的数据完整性或媒体清理的全量引用边界。

该步骤是可回滚的读取路径优化，不删除记录、不改变 Theme 数据和 CSS 注入顺序。启动快照现为“每个会话最后一条预览 + 两类全局状态例外”：所有 `incoming/ringing` 来电与所有需要账本对齐的非系统转账源消息分别通过专用索引读取，再以稳定 `(createdAt, id)` 去重排序。因此未打开会话的来电、转账不会因预览不是该消息而漏恢复。进入私聊、群聊或五子棋会话时会替换该会话预览为完整历史；全库删除、清理、角色删除等操作显式读取全量消息。完整备份、导入仍始终读取完整 `messages`，绝不只保存预览。

当前过渡策略优先保证正确性：页面进入会话后会完整装入该会话，而不是立即只保留 $80$ 条 UI 窗口。已有 cursor repository 可作为下一阶段虚拟列表向上翻页的基础，但该 UI 迁移必须同时验证引用跳转、未读锚点、搜索、记忆、撤回、通话和滚动恢复，不能用“未加载即不存在”的方式压缩内存。

### 5.5 线上角色多气泡的真实投递节奏

问题不在于模型不会生成多个 `messages` 项：现有协议已经能表达 text、语音、Sticker、图片、定位、转账、订单、旁白等任意顺序。但旧实现会在模型完整返回后用一次数组写入把同轮全部气泡同时渲染，视觉上像整段答案瞬间展开，削弱社交软件里“逐条点击发送”的真实感。

可选实现如下：

| 方案 | 做法 | 优势 | 代价与风险 |
| --- | --- | --- | --- |
| A. 前台顺序投递（当前实施） | 保持一次模型请求与完整 JSON 校验；当前会话前台可见时逐条写入消息，按内容和消息类型加入短间隔；后台、离开会话时立即完整落库 | 兼容所有现有 API、MCP、多媒体和备份格式；不增加模型首字延迟；失败前已展示的消息已持久化；只影响可见 UI | 不是真正 token 流式；模型推理完成前仍会显示输入中；节奏须避免过慢或机械化 |
| B. JSON 事件流 | 服务端把模型响应转为 SSE/NDJSON，解析出完整单个 `messages` item 就提交 | 首条消息可在整轮完成前出现，接近即时通讯服务器效果 | 必须定义可恢复的事件序号、断线重连、重复去重、半截 JSON、MCP 事件顺序和跨厂商流式兼容；导入/重生/撤回回滚复杂度较高 |
| C. Token 流式草稿气泡 | 模型 token 到达时更新一条 `sending` 草稿，完成后切分/固化成多条消息 | 用户最快看到文字出现，适合长文本 | 文字先属于哪一个气泡难以可靠判定；切分后会改变引用、翻译、旁白、卡片与消息 ID；频繁响应式更新增加低端 Android 掉帧和滚动锚点抖动风险 |
| D. 多轮计划器 | 先让模型生成“发送计划”，再为每条消息独立调用模型或定时发送 | 可以模拟撤回、补发、延迟回复、不同角色并发等复杂行为 | 成本、总延迟、失败面和上下文漂移显著增加；多次请求容易形成不连贯或重复内容，不适合当前单轮原子动作协议 |

当前选择 A：`replyDelivery.ts` 根据内容长度、卡片类型和稳定消息 ID 计算 $320\text{ms}$ 至 $1350\text{ms}$ 的间隔。仅当该线上会话处于前台、可见且本轮有多条消息时启用；切换会话、转入后台或正常非可见投递时保持立即完整持久化，避免通知、未读数、通话邀请和后台恢复被人为延迟。取消回复会中止尚未投递的消息，不删除已经显示并落库的气泡。

模型提示词继续由角色决定是否发多条，不要求将每一句强行拆开。多条气泡应代表自然的停顿、补充、改口、不同消息类型或真实社交动作；单条完整回复仍是合理结果。该策略不新增主题 CSS、不干预现有用户选择器、动画或布局权。

### 5.2 迁移和恢复不丢数据

任何 IndexedDB schema 或媒体引用变化必须遵守：

1. 首次迁移前创建可校验本地恢复点，并显示其结果；迁移失败不删除旧记录。
2. 新读路径先支持旧格式，再写入新格式；至少跨两个稳定版本保留旧 reader。
3. 清理任务仅在完整引用索引建立并成功校验后执行，绝不在只加载局部数据时将“不在内存中的媒体”视为垃圾。
4. 每一笔媒体迁移记录源 locator、目标 locator、字节数、hash、状态和可重试标记；OPFS、IndexedDB、Cache Storage 的写入采用幂等语义。
5. 导入、备份、媒体清理和数据库迁移共享锁与状态机，避免并发删除或覆盖。

### 5.3 媒体按显示面加载

Service Worker 能处理媒体路由时，消息和贴纸保持稳定的存储 URL；浏览器按 `img`、`audio` 或用户打开预览时才读取 Blob。没有 Service Worker controller 时，不应递归 materialize 全部快照：

- 首屏和可见虚拟窗口允许读取；
- 预加载应有字节与并发上限；
- 离开页面应释放不再使用的 Object URL；
- 音频需要 Range 的场景从单一媒体响应器读取；
- 大型媒体 hash、压缩和外部化放入可取消的后台任务，不占用输入交互帧。

### 5.4 持久化后台任务调度

建立 `RuntimeWorkScheduler`，用 IndexedDB 中可恢复的任务记录协调主动消息、保活状态同步、备份、媒体维护、模型刷新和状态检查。每个 `ScheduledWorkRecord` 至少保存 `id`、`kind`、`state`、`nextRunAt`、`attempt`、`leaseUntil`、`idempotencyKey`、`lastStartedAt`、`lastCompletedAt`、`lastError` 和版本化 payload。

- 主动消息保存到期索引与幂等 key；恢复、网络重连和定时器只会领取同一条 task，不能重复触发同一轮 AI 回复或通知。
- GitHub/云端自动备份保存待执行原因、备份快照边界、上传进度、远端 hash 和可重试状态；被中断后从安全检查点恢复，绝不把“未完成”显示为成功。
- Keep Alive 持久化用户意图、授权状态、最近原生服务确认和恢复尝试；实际音频、Wake Lock 或前台服务是否存活仍必须由平台实时确认。进程被系统终止后，状态应显示“待恢复”而非伪造“持续运行”。
- 任务明确声明前台/后台、网络、充电、空闲、会话是否活跃、最大并发和取消策略；生成中的会话保留 lease，网络恢复、页面恢复和定时器合并为一次去重领取。
- Android Keep Alive 启用时由原生前台服务维持系统身份，Web 层不需要每 15 秒重复恢复相同原生状态；iOS/PWA 在后台或锁屏后只能持久化待办并于下次允许的机会执行，不承诺准时唤醒。
- 自动备份、全库媒体维护和字体缓存仅在用户允许且设备空闲时运行，可取消、可恢复、可显示进度；严格需要“应用被杀后仍准时执行”的主动消息或备份必须迁移到服务器调度。

## 6. 版本、PWA 与原生壳策略

### 6.1 发布模型：先选择唯一产品承诺

必须在实施前确认下表中的产品选择，不能继续让“远程网页”和“本地历史 Web 包”在失败时无版本契约地互相替代：

| 模型 | 适用情形 | 要求 |
| --- | --- | --- |
| 统一远程 Web 运行时 | APP 是受鉴权网站的原生容器，更新需要快速同步 | APK/IPA 明确显示网络依赖；内嵌资源只提供版本明确的恢复页，不暗中运行旧 SPA；服务端按客户端最低兼容版本拒绝不兼容 API。 |
| 打包 Web 运行时 | APP 必须离线打开核心数据 | Capacitor 使用打包的 Web 资源；API/鉴权跨域、更新机制、数据隔离和原生包发布流程完整建设；PWA 与 APP 不承诺跨 origin 共享 IndexedDB。 |

以当前远程 `server.url` 架构，推荐先采用**统一远程 Web 运行时**：同一 Web build ID 服务于浏览器 PWA、Android WebView 和 iOS WebView；原生包只增加系统能力。若未来必须离线核心功能，再单独立项迁移到打包运行时，而不是把旧 `dist` 当作无版本 fallback。

### 6.2 build ID 与兼容握手

每次发布生成不可变 `buildId`、数据库最低版本和按平台划分的最低原生 build：

```text
ReleaseManifest
  webBuildId
  apiSchemaVersion
  minDbVersion
  minNativeBuild.android
  minNativeBuild.ios
  generatedAt
```

- 已实施：`vite.config.ts` 每次生产构建输出 `release-manifest.json`；其不进入 PWA precache，并由 `NetworkOnly` 规则和 `cache: 'no-store'` 请求读取。
- 已实施：页面更新检查和 Data 运行时诊断读取同一 manifest；数据库低于 `minDbVersion` 或原生实际 build 低于当前平台 `minNativeBuild` 时，会明确拒绝继续更新。manifest 离线或不可达不会阻塞既有可用业务。
- 发布时通过 `LINK_MIN_ANDROID_NATIVE_BUILD`、`LINK_MIN_IOS_NATIVE_BUILD` 设置最低原生 build；默认 `0` 仅代表本次 Web 发布不要求更新原生壳。
- 尚未实施服务端 API 版本拒绝与“受控升级页”，在 API 契约首次破坏性升级前必须补上；当前握手保护 PWA 更新和诊断，不替代服务端授权与 schema 校验。
- `Data` 页面显示 Web build、Service Worker build、native version 和数据库 reader 版本，便于远程排障；
- 发布产物生成 hash 清单，CI 校验服务器静态资源、PWA manifest 和原生包记录的版本关系。

### 6.3 更新不抢占用户交互

当前自动 `skipWaiting`、`clientsClaim` 与 controller change reload 不适合聊天产品。目标流程：

1. 发现新 Worker 后只下载并显示“新版本已就绪”；
2. 有草稿、正在输入、媒体上传、备份、导入、通话或请求中的 Agent 时不刷新；
3. 用户点击更新后，先同步草稿与关键 operation 状态，再执行 `SKIP_WAITING` 和一次刷新；
4. 新 Worker 激活不等于强制刷新所有页面；
5. 偶发的强制升级仅用于安全或数据协议不兼容，必须有明确原因和恢复路径；
6. Workbox/PWA 更新定期检查时处理离线、服务器不可达和短时间重复注册等边界。

## 7. 实施阶段与可回滚点

### Phase 0：基线、备份和观测

**目标**：先量化，不改变行为。

- 建立匿名、本地优先的运行时诊断：布局快照、键盘状态、Composer rect、滚动锚点、首屏阶段耗时、长任务、媒体读取量、数据库表计数和当前 build ID。
- Theme Health 只读报告上线；完整 CSS 原文不进入 telemetry。
- 为真实设备收集基线：启动、首次输入、键盘打开/关闭、切换 Sticker、滚动、发送、恢复和内存峰值。
- 执行并验证可恢复的完整本地备份；演练失败迁移、媒体缺失、旧版本读取和 Service Worker 回退。

**回滚**：仅新增观测开关，关闭即可；不迁移用户数据。

### Phase 1：建立 `LayoutRuntime` 并移除重复补偿

**目标**：默认 Theme 下消除底部留白、输入遮挡和重复位移。

- 先以 feature flag 接入 `LayoutRuntimeSnapshot`，旧逻辑仍保留为对照路径；
- 将私聊、群聊、线下页、Modal、Sticker 和选择工具栏改为消费统一快照；
- 将 Composer 与消息滚动区放入同一 flex shell；
- 逐个删除页面级 `--keyboard-inset` transform 和 iOS 仅私聊特例；
- 任何环境只保留一条 overlay fallback，且必须有相应的运行时原因码与真机复现证据；
- 保留真实 Theme scale，验证缩放后的原始几何值只被换算一次；不在键盘打开时临时取消根缩放；
- 为线上 `MessageBubble` 增加 `groupPosition` 数据 prop、`message-group-*`/`bubble-group-*` 类名与 `data-message-group`，并由私聊、群聊共享的纯函数在虚拟列表数据层计算；
- 保持 Theme 注入方式、选择器和层叠顺序不变。

**验收**：见第 8 节的键盘矩阵。若任何关键设备失败，按环境关闭新 owner，回到旧路径；不触碰数据。

### Phase 2：原生系统栏与键盘职责收敛

**目标**：Android/iOS 原生层不再与 Web 双算。

- Android 在 `adjustResize`、edge-to-edge、SystemBars 和 `LinkDisplayPlugin` 中选定唯一 owner；删除或停用其余重复控制逻辑。
- Capacitor Keyboard 仅按官方支持的环境设置；Android `resizeOnFullScreen` 仅作为已证实必要时的单点 workaround。
- iOS Native resize mode、系统状态栏和 Web Shell 的职责写入原生集成测试；不依赖 iOS PWA 的 `interactive-widget`。
- 覆盖 PWA display mode、浏览器 Fullscreen API、原生全屏、系统栏手势恢复、旋转和分屏；所有状态切换只更新一次 `LayoutRuntimeSnapshot`，不得重置 Theme scale、草稿或列表锚点。
- 每次原生改动执行 Capacitor sync，重建 APK/IPA，并把 native build ID 写入发布 manifest。

**回滚**：原生 feature flag 和上一稳定 APK/IPA 并存；新旧壳均能连接兼容的 Web build。

### Phase 3：版本协议与受控更新

**目标**：不再发生无感刷新和版本漂移。

- 部署 ReleaseManifest 与兼容握手；
- 将 PWA 更新改为用户确认式；
- 去除 controller change 的无条件 reload；
- 构建系统校验 Android/iOS 包、服务器 `dist`、PWA 预缓存的 build ID；
- Data 页面增加可复制的版本诊断包。

**回滚**：服务端保留前一兼容 Web build；manifest 可将新 build 标记为暂停，客户端继续旧兼容版本。

### Phase 4：Repository、按需加载和媒体迁移

**目标**：将全量启动替换为按需数据访问，且不丢用户数据。

- 先实现只读 repository 与分页消息 API；旧全量 Store 仍可对照；
- Home、Chat、Group、Offline 逐页迁移，所有跨领域写入经过统一事务协调器；
- 将启动维护改为增量引用索引；
- 媒体先双读、后双写、最后切换默认 reader；完成全量校验后才允许清理旧副本；
- 引入 `ScheduledWorkRecord`、领取 lease、幂等 key 和恢复检查点；先让主动消息、保活状态同步和两类自动备份双写旧状态与新任务记录，再切换 scheduler；
- 备份/导入覆盖新旧格式、媒体文件和中断恢复场景。

**回滚**：旧 reader 始终可用；迁移只新增数据，不删除旧 locator。数据删除需在至少两个稳定版本后另行发布。

### Phase 5：模块拆分与持续性能治理

**目标**：降低未来修改的耦合风险。

- 将 `appStore` 中的数据访问、消息缓存、AI 调度、媒体、钱包账本、主题、通知和备份协调拆为领域模块；
- 将私聊页面的通话、消息操作、媒体预览、AI trace、交易卡片和 Composer orchestration 拆为组件/服务；
- 为长列表、图片、滤镜和动画建立性能预算；
- 所有后台任务通过 `RuntimeWorkScheduler`。

**回滚**：每个领域模块保持同一公开接口与契约测试，避免大规模重写。

## 8. 验收矩阵与发布门槛

### 8.1 设备和运行形态

每个候选版本至少覆盖：

| 类别 | 必测形态 |
| --- | --- |
| iPhone | Safari 普通网页、主屏 PWA、刘海/动态岛设备、小屏设备、当前受支持的 iOS 主/次版本 |
| iPad | Safari 与主屏 PWA，竖屏/横屏、分屏或多任务、外接键盘（可获得时） |
| iOS Native | WKWebView 容器、冷启动、恢复、状态栏切换、通知深链 |
| Android Chrome | PWA、浏览器地址栏展开/收起、软键盘、全屏手势 |
| Android APK | API 最低支持版本、主流 API、目标 API；至少一台低内存设备及主流厂商 WebView |
| 桌面 | Chrome/Safari/Firefox 的响应式回归，作为快速预检，不替代真机 |

### 8.2 键盘和布局用例

对私聊、群聊、线下 RP、设置文本域、Modal、Sticker、媒体预览逐一执行：

1. 冷启动后首次 focus；
2. 中英文输入法切换、候选词、语音输入、emoji；
3. 连续输入、textarea 自动增长、发送、撤回 focus；
4. 键盘显示/隐藏期间切换 Sticker、弹窗、菜单和页面；
5. 底部、历史中部、顶部三种消息滚动位置；
6. 系统栏显示/隐藏、地址栏展开/收起、旋转、分屏、锁屏恢复；
7. Theme scale 为默认、最小、最大，以及用户自定义 CSS 三种样本；
8. 断网、弱网和 Service Worker 更新提示期间保留草稿。
9. 浏览器/PWA/原生全屏的进入、退出、系统栏手势恢复和 Activity 恢复，分别在键盘显示与隐藏状态执行；
10. 连续同一发送者、不同发送者、时间分隔、系统消息、图片/贴纸/卡片、撤回/编辑消息的分组 fixture，验证 `single`、`first`、`middle`、`last` 类名与虚拟滚动前后一致。

每一步采集：`LayoutRuntimeSnapshot`、Theme scale、全屏状态、根 Shell、消息区、Composer、系统安全区的 rect；判定输入可见且可点击、没有额外空白、消息锚点正确、没有超过一帧的持续跳动。

### 8.3 性能与数据门槛

先在 Phase 0 用参考设备录制当前 P50/P75/P95，再为每类设备定目标。发布最小门槛：

- 冷启动和路由首屏不再被全库 hydration 阻塞；
- 输入、滚动和打开聊天过程中无可归因于本应用的持续长任务；
- 首屏只读取必需的数据库记录和可见媒体；
- 任何迁移、导入、清理和升级都可恢复，媒体 hash 与计数一致；
- 默认 Theme 与所有既有官方预设视觉回归通过；
- 自定义 Theme fixture 不被篡改、拒绝、重排或静默禁用，且线上 `message-group-*`/`bubble-group-*` 类名在虚拟滚动、主题切换和缩放下保持稳定；
- 新 Worker 不会丢失草稿或无提示刷新；
- 全屏切换不改变 Theme scale，不丢草稿、不重置消息锚点、不造成安全区或键盘双重补偿；
- 主动消息、Keep Alive 和自动备份在页面/进程中断后能从持久化任务状态恢复，并正确区分“待恢复”“执行中”“成功”“失败”；
- 线上 Web、PWA、APK、IPA 的 build ID/兼容协议符合发布规则。

## 9. 观测、隐私与故障处理

### 9.1 最小观测事件

建议本地记录并允许用户在 Data 页面主动导出；远程上报须另行征得同意：

```text
layout_sample
  buildId, nativeVersion, environment, viewportOwner,
  layout/visual dimensions, safe insets, keyboard state, theme scale, fullscreen state,
  active route category, composer visibility, theme hash

startup_stage
  buildId, stage, elapsedMs, loaded record counts, media bytes

work_item
  id, type, trigger, state, attempt, elapsedMs, cancellation reason

update_state
  old/new buildId, worker state, user confirmation, draft preserved
```

不得记录聊天内容、API key、Cookie、Theme CSS 原文、图片、音频、联系人、QQ 号或精确地理位置。Theme 仅使用本地 hash 和预设 ID，以便定位“某主题影响布局”而不泄露用户代码。

### 9.2 故障优先级

| 级别 | 示例 | 处置 |
| --- | --- | --- |
| P0 | 本地数据丢失、无法输入、更新循环、启动白屏 | 立即暂停新 feature flag 或 manifest，保持旧 reader/旧 build，导出诊断与恢复数据 |
| P1 | 特定主流设备键盘遮挡、严重卡顿、通知深链失效 | 按运行形态关闭新布局路径，保留局部 workaround，安排热修复 |
| P2 | 个别主题导致视觉几何异常、非关键页性能下降 | Theme Health 提示与会话级恢复预览；不自动修改用户 CSS |

## 10. 推荐代码组织（授权实施后）

以下是建议的增量落点，不代表本次已创建这些文件：

```text
src/app/runtimeEnvironment.ts       运行形态识别与 build compatibility
src/app/layoutRuntime.ts            唯一几何快照和事件合并
src/app/runtimeWorkScheduler.ts     后台工作队列
src/data/repositories/              IndexedDB 领域 repository 与分页查询
src/data/migrations/                可恢复、可审计的数据迁移
src/stores/sessionStore.ts          启动壳、当前用户、路由级缓存
src/stores/conversationStore.ts     会话/消息窗口/锚点
src/services/releaseManifest.ts     Web/native 版本握手
src/services/runtimeDiagnostics.ts  本地诊断与导出
src/services/themeHealth.ts         只读 Theme 几何检测
src/utils/messageGrouping.ts        线上消息首中尾分组纯函数
src/components/layout/AppShell.vue  统一 flex shell
```

保留既有 `src/utils/themeStyles.ts`、Theme 设置数据和注入入口的功能边界；新模块只能消费主题结果或报告冲突，不能把 Theme 变成受限 DSL。

## 11. 方案依据（截至 2026-08-02 访问）

- [Capacitor v8 Keyboard](https://capacitorjs.com/docs/apis/keyboard)：区分 iOS resize mode、Android 全屏 workaround 与 keyboard event 行为。
- [MDN: VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)：说明 layout/visual viewport 的区别，以及 transform 模拟 fixed 元素存在闪烁风险。
- [MDN: viewport meta](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/viewport)：`interactive-widget`、`viewport-fit` 与兼容性；iOS 不支持 `interactive-widget` 的各 resize 值。
- [MDN: viewport length units](https://developer.mozilla.org/en-US/docs/Web/CSS/length#viewport-percentage_lengths)：`svh`/`lvh`/`dvh` 的语义与动态单位滚动性能注意事项。
- [WebKit: Designing Websites for iPhone X](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)：`viewport-fit=cover` 和安全区 `env()` 的使用原则。
- [Vite PWA: Periodic Service Worker Updates](https://vite-pwa-org.netlify.app/guide/periodic-sw-updates.html)：更新检查的离线、重复注册和自动更新边界。

## 12. 已确认决策与剩余产品选择

本轮已确认：

1. Theme scale 保留真实根级缩放，不替换为视觉近似；iOS 键盘问题通过统一缩放坐标换算和真机 feature flag 验证解决。
2. 主动消息、Keep Alive 和自动备份的任务意图、进度与恢复点必须持久化；平台实际后台存活由实时确认决定，不能伪造。
3. Themes 保持任意 CSS DIY；线上主题额外获得稳定的消息首条/中间/尾条/单条类名，不过滤、不自动写入用户 CSS。
4. 全屏必须作为独立运行时状态覆盖 PWA、浏览器、Android/iOS 原生及系统栏恢复，且不影响缩放、草稿和聊天锚点。
5. 正式质量门槛以当前主流 iOS/Android 设备、主流浏览器/WebView 与一台低内存 Android 真机为准；低于正式支持范围的可安装设备属于尽力兼容，不阻塞主流设备发布。

仍需在实施前明确：Android/iOS 是否正式承诺离线打开完整业务，还是采用统一远程 Web 运行时；以及主动消息和自动备份在“应用被杀后仍需准时执行”时，是否授权迁移到服务器调度。正确顺序仍是：可观测、可回滚、小范围灰度、真机验证、逐阶段扩大，而不是一次性“修完所有平台”。

## 13. 第一阶段实施记录（2026-08-02）

### 13.1 已实施

1. 新增 `LayoutRuntime` 并由 `viewport.ts` 作为唯一 CSS 几何变量发布者；已删除 Android 网页层的猜测键盘高度。布局快照包含运行环境、viewport owner、键盘状态、真实 Theme scale 与全屏状态。
2. iOS 主屏 PWA 的键盘模式缩小根布局且发布零 keyboard inset；普通网页 overlay 仅发布遮挡 inset；原生 WebView resize 仅使用壳层缩小。聊天、群聊和线下 RP 仍保留正常 flex shell 与同量滚动底部空间。
3. 线上私聊、群聊和五子棋会话新增 `single`、`first`、`middle`、`last` 消息分组接口；这是加性类名和数据属性，不过滤、改写或限制 Theme CSS。
4. IndexedDB 升级至 v19，新增不参与业务备份替换的 `runtimeWork` 表。主动消息、GitHub/云备份与保活协调改为可领取、可重试、可恢复的持久化工作项；网页/PWA 不再以高频 timer 伪造后台常驻。
5. PWA 改为等待并由用户确认后才发送 `SKIP_WAITING`；已移除 Service Worker controller 改变时的全局无条件刷新。
6. Fanfic 与角色运营 Store 改为读取各自的领域表，避免在主 Store hydrate 后再次加载完整 43 表快照。媒体 hydrate 仍保留，但 Fanfic 页面只处理它自己的领域快照。
7. Capacitor 远程启动路由改为直接配置 `server.url = https://babylink.top/home`，移除错误的 `server.appStartPath = /home`；Capacitor 8 会把后者同时解释为本地应用入口，导致 `/public/home` 不存在时主动退出。
8. `server.allowNavigation` 精确允许 `babylink.top` 在原生 WebView 内导航。若未明确允许，Capacitor 会将远程主框架导航交给系统 Safari；第三方域名仍维持系统外部打开的默认安全边界。
9. Android `LinkBackupPlugin` 的归档会话改为向异步 lambda 传入稳定的最终字节数，修复 Java 对被重新赋值局部变量的编译拒绝；备份协议和文件行为未改变。
10. 记忆设置升级为每批 `12` 楼层、保留最近 `100` 楼原文、召回预算默认 `20000` tokens，并将预算上限提升至 `50000`。v2 启动和导入迁移会恢复当前所有已保存会话的完整记忆默认集：启用记忆、压缩、自动捕获、成长、自然淡化、反思与语义召回，并清空旧 embedding 模型覆盖；迁移标记持久化后，用户可在角色记忆面板继续为每个会话保存自定义值，后续启动或导入带 v2 标记的备份均不会再次覆盖。
11. IndexedDB 已升级至 v21：`messages` 提供 `[conversationId, createdAt]` cursor 索引、`[call.direction, call.status]` 来电状态索引与 `transfer.status` 转账状态索引。启动只读取每会话最后预览，并额外读取响铃来电和账本转账源消息；私聊、群聊、五子棋直达或切换会按需读取完整会话，完整备份/导入仍全量读取消息。排序统一使用稳定 `(createdAt, id)`，避免同毫秒消息翻页或合并时乱序。
12. PWA 更新维持用户确认模式，并新增重载安全锁：回复生成、通话、五子棋请求、本地导入/导出、GitHub 和云端备份、私聊/群聊/线下 RP 的未发送草稿、图片选择与处理、录音和未保存编辑/重写/群资料表单进行中时均拒绝 `SKIP_WAITING`，显示阻塞原因；操作完成后用户再主动安装。私聊与群聊离开时会尝试保存未达到普通阈值的记忆尾批，线下 RP 草稿以 session storage 恢复。
13. Memory 自动捕获现在记录 `idle`、等待阈值、等待角色回复、等待总结模型、编码中、成功与失败状态，并对尾随用户消息提供强制尾批。关闭旧楼层压缩时不再隐式以最近楼层限制截断原文；召回查询结合最后用户回合与最近上下文。自然淡化仅作用于曾被召回且至少 $30$ 天未再召回的断言，避免“未命中即持续变弱”的反馈回路。语义召回提示会读取实际会话/全局 embedding 覆盖。
14. Android 全屏的系统栏控制权已收敛到 `LinkDisplayPlugin`：网页层检测到 Android 原生插件后不再并行调用 Capacitor `SystemBars`，并移除了 Capacitor 配置中的启动隐藏项。Android 仍允许系统手势临时显示状态栏/导航栏；这属于系统语义，不应伪造为永久隐藏。iOS 原生仍使用 Capacitor 标准接口；安装 PWA 和普通网页遵守各自浏览器全屏能力。
15. 发布兼容握手已落地：Vite 输出 `release-manifest.json`，运行时诊断显示 manifest build、兼容状态和更新可用性；明确不兼容的数据库或原生 build 不会继续 PWA 更新。生产静态服务将该文件明确标记为 `no-cache, no-store, must-revalidate`，并通过 Docker build args 写入 Android/iOS 的最低 build。Theme 的任意 CSS 能力、数据格式和注入顺序均未改变。
16. 服务端启动仅对 PostgreSQL 正在恢复、暂时拒绝连接等明确瞬态错误作有限迁移重试；其他迁移异常仍立即失败。部署文档要求镜像重建前检查磁盘余量，且只允许清理未使用的 Docker 构建缓存和悬空镜像，不得清理数据卷。

### 13.2 已验证

| 验收项 | 结果 |
| --- | --- |
| 移动布局与消息分组纯逻辑回归 | `npm run test:mobile-runtime` 通过 |
| 会话消息 cursor 分页纯逻辑回归 | `npm run test:message-pagination` 通过 |
| 记忆与角色运营回归 | `npm run test:memory`、`npm run test:role-operations` 通过 |
| Web PWA TypeScript 与生产构建 | `npm run build` 通过，生成 `dist/sw.js`、Workbox 产物及 `dist/release-manifest.json` |
| iOS 原生壳 | Capacitor 同步后，`xcodebuild` 使用 `iphonesimulator`、无签名 Debug 构建通过；此前 iPhone 17 Simulator（iOS 26.5）已完成安装与冷启动，控制台显示 `Loading app at https://babylink.top/home...` 与 `WebView loaded`，首屏显示 BabyLink 访问验证页且没有 Safari 控件 |
| Android 原生壳 | 使用 JDK 21 的 `android/gradlew :app:assembleDebug` 再次通过；系统栏已由 `LinkDisplayPlugin` 单一控制，打包配置包含 `https://babylink.top/home` 和精确 `allowNavigation` |
| 浏览器移动宽度烟雾测试 | 私聊路由可启动、无水平溢出、Composer 位于 Shell 可视底部 |
| IndexedDB 迁移与持久工作 | 已通过 v21 构建与消息启动选择回归；schema 包含 `runtimeWork`、消息 cursor、来电与转账状态索引。真实用户库的 v21 浏览器迁移仍须在发布前设备矩阵中复验 |
| 2026-08-02 线上发布 | 数据库与源码均已在发布前备份；网站/服务端已重新构建并通过 `https://babylink.top/health`、访问页 `no-store`、四个容器健康状态、线上 `release-manifest.json` 及关键源码哈希核验。发布清单要求 Android/iOS 最低 build 均为 `26`，安装包发布记录为 Android `1.0.25 (26)`（`669b8237c160223b717064fa2db92a61c70aa62ec0653569656a51a9a966fbf3`）和 iOS `1.0.25 (26)`（`860105ccdd20ba09bd9be58d77c1f07c6f4275e3d36dad83f7223505ee561875`）。 |

### 13.3 仍须完成的物理验收

以下项目不应被自动化、编译或当前线上健康检查替代；本次为已备份、可回滚的受控发布，完成这些项目后才能声明跨端体验验收全部完成。

1. 在 HTTPS 生产或预发布域名以两个连续构建演练 PWA waiting → 用户确认 → controller 切换，同时验证 `release-manifest.json` 的 NetworkOnly/no-store 路径，并确认私聊、群聊、线下草稿、上传、录音、编辑、重写与通话不会被自动刷新中断。
2. iOS Simulator 已验证冷启动和原生 WebView 首屏；仍须在真实 iPhone、iPad、Android 主流机和低内存 Android 覆盖已授权聊天后的输入框、键盘候选栏、横竖屏、分屏、系统栏手势、全屏、Theme scale 与自定义主题。当前 Simulator 停在访问验证页，不能将首屏验收替代已登录聊天 Composer 验收。
3. 对 Android Gradle 的 Kotlin 插件重复加载和 Gradle 9 弃用警告安排独立依赖治理；当前不影响 Debug 构建，但不应与布局改造混合修复。
4. 继续按领域拆分 `appStore`：启动预览、Chat、Group、Offline、搜索与五子棋的按需完整会话入口已经建立，但 Store 仍包含大量跨领域消息消费者；下一阶段应把“活动会话完整缓存”进一步降为稳定的 $80$ 条 UI 窗口，并将搜索、记忆、通话、清理和完整备份转为显式 repository/事务边界。生产构建仍有约 $1.72$ MB（gzip 约 $609$ KB）的 `appStore` chunk 告警，需以低端 Android 启动、长会话滚动与内存峰值实测决定后续拆分优先级。