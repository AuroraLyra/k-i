<template>
  <section class="mcp-console">
    <header class="mcp-overview">
      <div class="overview-main">
        <span class="overview-icon"><Network :size="23" /></span>
        <div>
          <p>MCP &amp; DEVICE</p>
          <h2>设备与外部能力</h2>
          <span>让角色联网搜索，并在你授权后使用手机系统 App、电脑助手和远程工具。</span>
        </div>
        <label class="master-control">
          <input :checked="mcpSettings.enabled" type="checkbox" @change="setMasterEnabled" />
          <span class="master-track"></span>
          <small>{{ mcpSettings.enabled ? '已开启' : '已关闭' }}</small>
        </label>
      </div>
      <div class="overview-stats">
        <span><strong>{{ enabledServerCount }}</strong> 个连接启用</span>
        <i></i>
        <span><strong>{{ connectedServerCount }}</strong> 个状态正常</span>
        <i></i>
        <span><strong>{{ enabledToolCount }}</strong> 项能力可用</span>
      </div>
    </header>

    <div v-if="notice.text" class="notice" :class="notice.kind">
      <CheckCircle2 v-if="notice.kind === 'success'" :size="17" />
      <AlertTriangle v-else :size="17" />
      <span>{{ notice.text }}</span>
      <button type="button" aria-label="关闭提示" @click="clearNotice"><X :size="15" /></button>
    </div>

    <section class="capability-card">
      <header class="section-heading">
        <div>
          <p>ON THIS PHONE</p>
          <h3>手机系统能力</h3>
        </div>
        <span class="ready-badge"><CheckCircle2 :size="12" />已内置</span>
      </header>

      <p class="section-intro">无需地址或密钥。首次调用日历、通讯录、定位等功能时，由手机系统向你确认权限。</p>

      <div class="capability-grid">
        <article class="search-capability"><span class="capability-icon violet"><Globe2 :size="18" /></span><div><strong>联网与资讯</strong><small>网页搜索、实时新闻、来源链接</small></div></article>
        <article><span class="capability-icon green"><Smartphone :size="18" /></span><div><strong>设备与提醒</strong><small>状态、通知、语音、震动、提醒</small></div></article>
        <article><span class="capability-icon blue"><CalendarDays :size="18" /></span><div><strong>效率工具</strong><small>系统日历、应用内备忘录、Android 闹钟</small></div></article>
        <article><span class="capability-icon amber"><MapPinned :size="18" /></span><div><strong>地点与出行</strong><small>定位、系统天气、系统地图、高德</small></div></article>
        <article><span class="capability-icon rose"><ContactRound :size="18" /></span><div><strong>通讯与应用</strong><small>系统联系人、电话、短信、常用 App</small></div></article>
      </div>

      <details class="reality-help">
        <summary><span>权限与系统限制</span><ChevronDown :size="15" /></summary>
        <div>
          <p><strong>真实系统数据：</strong>日程写入系统日历，联系人来自系统通讯录；备忘录直接保存在 BabyLink 本机数据中，天气与地图直接打开系统 App。</p>
          <p><strong>系统限制：</strong>iOS 不允许第三方创建“时钟”闹钟；BabyLink 不会读取其他 App 私有页面，也不能跨 App 查看或控制手机屏幕。</p>
        </div>
      </details>
    </section>

    <section class="assistant-card">
      <header class="section-heading">
        <div><p>COMPUTER ASSISTANT</p><h3>电脑助手</h3></div>
        <span class="computer-badge"><Laptop2 :size="12" />QQ / 小红书</span>
      </header>
      <p class="section-intro">在电脑本地安装 BabyLink Bridge 后，再登录自己的平台账号。助手会自动建立安全隧道并生成配对信息。</p>

      <div class="pairing-grid">
        <button type="button" @click="openBridgeGuide('qq')"><span class="template-icon qq"><MessageCircle :size="18" /></span><span><strong>配对 QQ</strong><small>NapCat / OneBot</small></span><ArrowRight :size="15" /></button>
        <button type="button" @click="openBridgeGuide('xiaohongshu')"><span class="template-icon xhs"><Camera :size="18" /></span><span><strong>配对小红书</strong><small>非官方适配器</small></span><ArrowRight :size="15" /></button>
      </div>

      <div class="privacy-note"><ShieldCheck :size="17" /><span><strong>账号与流量留在你的设备</strong><small>平台账号只登录在电脑，BabyLink 云端不代理 QQ 或小红书流量。</small></span></div>
    </section>

    <section class="remote-card">
      <header class="section-heading"><div><p>REMOTE MCP</p><h3>添加其他服务</h3></div><span>HTTPS 直连</span></header>
      <div class="remote-actions">
        <button class="primary" type="button" @click="showImporter = true"><span class="action-icon"><Upload :size="19" /></span><span><strong>导入服务配置</strong><small>JSON、TXT 或 HTTPS 地址</small></span><ArrowRight :size="17" /></button>
        <button type="button" @click="openComposer('custom')"><span class="action-icon"><Plus :size="18" /></span><span><strong>手动添加</strong><small>适合自建服务</small></span><ArrowRight :size="17" /></button>
      </div>
    </section>

    <details class="server-library">
      <summary class="section-heading library-heading">
        <div>
          <p>CONNECTION DETAILS</p>
          <h3>连接与工具管理</h3>
        </div>
        <span>{{ mcpSettings.servers.length }} 个 <ChevronDown :size="14" /></span>
      </summary>

      <div v-if="mcpSettings.servers.length" class="server-list">
        <article v-for="server in mcpSettings.servers" :key="server.id" class="server-card" :class="{ disabled: !server.enabled }">
          <header class="server-summary">
            <span class="server-avatar" :class="`kind-${server.kind}`">
              <Camera v-if="server.kind === 'xiaohongshu'" :size="19" />
              <MessageCircle v-else-if="server.kind === 'qq'" :size="19" />
              <BellRing v-else-if="server.kind === 'notification-inbox'" :size="19" />
              <Smartphone v-else-if="server.kind === 'reality'" :size="19" />
              <Network v-else :size="19" />
            </span>
            <div class="server-title">
              <strong>{{ server.name }}</strong>
              <span>{{ server.serverName || kindLabel(server.kind) }}</span>
            </div>
            <label class="mini-switch" :aria-label="`${server.enabled ? '停用' : '启用'} ${server.name}`">
              <input :checked="server.enabled" type="checkbox" @change="setServerEnabled(server, $event)" />
              <span></span>
            </label>
          </header>

          <div class="server-health">
            <span class="status-dot" :class="serverStatusClass(server)"></span>
            <strong>{{ serverStatusLabel(server) }}</strong>
            <span>{{ server.lastCheckedAt ? formatLastChecked(server.lastCheckedAt) : '保存后自动检测' }}</span>
          </div>

          <div class="endpoint-row"><BellRing v-if="server.kind === 'notification-inbox'" :size="14" /><Smartphone v-else-if="server.kind === 'reality'" :size="14" /><Globe2 v-else :size="14" /><span>{{ isBuiltinMcpServer(server) ? '当前设备本地执行 · 不需要远程地址' : server.url }}</span></div>

          <div class="server-tags">
            <span :class="server.globalEnabled ? 'active' : ''">{{ server.globalEnabled ? '全局应用' : '仅角色选择' }}</span>
            <span :class="server.toolPolicy === 'all' ? 'write' : ''">{{ policyShortLabel(server.toolPolicy) }}</span>
            <span>{{ server.tools.filter((tool) => tool.enabled).length }} 个工具</span>
          </div>

          <details class="server-manage">
            <summary><span>连接与工具设置</span><ChevronDown :size="16" /></summary>
            <div class="server-manage-body">
              <label class="control-row">
                <span><strong>全局应用</strong><small>角色未开启局部优先时自动继承</small></span>
                <input :checked="server.globalEnabled" :disabled="!server.enabled" type="checkbox" @change="setGlobalEnabled(server, $event)" />
              </label>
              <label class="policy-row">
                <span><strong>角色权限</strong><small>{{ policyDescription(server.toolPolicy) }}</small></span>
                <select :value="server.toolPolicy" :disabled="!server.enabled" @change="setToolPolicy(server, $event)">
                  <option value="disabled">不允许角色调用</option>
                  <option value="read-only">只浏览与查询</option>
                  <option value="all">浏览并执行操作</option>
                </select>
              </label>

              <details class="tool-details">
                <summary>
                  <span><Database :size="15" />{{ server.tools.length ? `${server.tools.length} 个已发现工具` : '尚未发现工具' }}</span>
                  <ChevronDown :size="15" />
                </summary>
                <div v-if="server.tools.length" class="tool-list">
                  <label v-for="tool in server.tools" :key="tool.name" class="tool-row">
                    <span>
                      <strong>{{ tool.title || tool.name }}</strong>
                      <small>{{ tool.description || tool.name }}</small>
                      <em :class="tool.write ? 'write' : 'read'">{{ tool.write ? '会执行操作' : '只读查询' }}</em>
                    </span>
                    <input :checked="tool.enabled" type="checkbox" @change="setToolEnabled(server, tool.name, $event)" />
                  </label>
                </div>
                <p v-else>保存连接后会自动检测，也可以点击下方“重新检测”。</p>
              </details>

              <p v-if="server.lastError" class="server-error">{{ server.lastError }}</p>
              <footer class="server-actions" :class="{ builtin: isBuiltinMcpServer(server) }">
                <button type="button" :disabled="testingServerIds.has(server.id)" @click="inspectServer(server)">
                  <RefreshCw :class="{ spin: testingServerIds.has(server.id) }" :size="15" />重新检测
                </button>
                <button v-if="!isBuiltinMcpServer(server)" type="button" @click="editServer(server)"><Pencil :size="15" />编辑</button>
                <button v-if="!isBuiltinMcpServer(server)" class="danger" type="button" @click="deleteTarget = server"><Trash2 :size="15" />删除</button>
                <span v-else class="builtin-action-note">手机能力已内置</span>
              </footer>
            </div>
          </details>
        </article>
      </div>

      <div v-else class="empty-library">
        <span><Sparkles :size="24" /></span>
        <strong>从第一个真实工具开始</strong>
        <p>拿到服务商配置后，导入并填写 API Key，系统会自动检测可用工具。</p>
        <button type="button" @click="showImporter = true">导入第一个 MCP</button>
      </div>
    </details>

    <details class="reply-preferences">
      <summary>
        <span><strong>回复调用偏好</strong><small>单次最多 {{ mcpSettings.maxToolCallsPerReply }} 个工具</small></span>
        <ChevronDown :size="16" />
      </summary>
      <label>
        <span>单次回复最多调用</span>
        <select :value="mcpSettings.maxToolCallsPerReply" @change="setMaxToolCalls">
          <option v-for="count in 6" :key="count" :value="count">{{ count }} 个工具</option>
        </select>
      </label>
      <p>角色局部优先与连接选择请在对应角色的 Chat Settings &gt; More 中设置。</p>
    </details>

    <AppModal v-model="showBridgeGuide" :title="bridgeGuideTitle" :show-header="false" fixed-height variant="ins">
      <form class="bridge-guide" @submit.prevent="runBridgePairing">
        <section class="bridge-hero" :class="`kind-${bridgeKind}`">
          <span class="composer-icon"><Camera v-if="bridgeKind === 'xiaohongshu'" :size="22" /><MessageCircle v-else :size="22" /></span>
          <div><p>COMPUTER ASSISTANT</p><strong>{{ bridgeGuideTitle }}</strong><small>账号只登录在你的电脑，BabyLink 云端不接触账号和平台流量。</small></div>
        </section>

        <section class="bridge-scroll">
          <div class="bridge-steps">
            <article v-for="(step, index) in bridgeGuideSteps" :key="step.title">
              <b>{{ index + 1 }}</b>
              <span><strong>{{ step.title }}</strong><small>{{ step.detail }}</small></span>
            </article>
          </div>

          <div class="pairing-focus">
            <span><CheckCircle2 :size="18" /></span>
            <div><strong>手机端只需要最后一步</strong><small>在电脑助手点击“复制配对信息”，回到这里粘贴。地址、Key 和平台类型都会自动填写。</small></div>
          </div>

          <label class="form-field pairing-field">
            <span>粘贴电脑助手配对信息</span>
            <textarea v-model="bridgePairingText" rows="7" spellcheck="false" :placeholder="bridgePairingPlaceholder"></textarea>
            <small>配对信息应包含电脑助手的 HTTPS 地址和访问令牌。不要粘贴 QQ 密码、小红书 Cookie 或扫码截图。</small>
          </label>

          <details class="bridge-help">
            <summary>电脑助手没有显示配对信息？<ChevronDown :size="15" /></summary>
            <p v-if="bridgeKind === 'qq'">确认 NapCat 已登录、OneBot HTTP 已开启、BabyLink Bridge 正在运行，并且电脑助手显示“QQ 在线”。</p>
            <p v-else>确认非官方小红书适配器已登录、Bridge 已连接适配器，并且电脑助手显示“小红书适配器在线”。</p>
            <p>电脑关机、退出账号或关闭助手后，手机会显示离线；重新开启电脑助手即可恢复，不需要再次配对。</p>
          </details>
        </section>

        <p v-if="bridgeError" class="form-error">{{ bridgeError }}</p>
        <div class="composer-footer">
          <button type="button" @click="showBridgeGuide = false">取消</button>
          <button class="primary" type="submit">配对并自动检测</button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showComposer" :title="editingServerId ? '编辑 MCP' : '添加 MCP'" :show-header="false" fixed-height variant="ins">
      <form class="setup-composer" @submit.prevent="saveComposer">
        <section class="composer-hero" :class="`kind-${composer.kind}`">
          <span class="composer-icon">
            <Camera v-if="composer.kind === 'xiaohongshu'" :size="22" />
            <MessageCircle v-else-if="composer.kind === 'qq'" :size="22" />
            <Smartphone v-else-if="composer.kind === 'reality'" :size="22" />
            <KeyRound v-else :size="22" />
          </span>
          <div>
            <p>{{ composer.kind === 'custom' ? 'REMOTE MCP' : 'COMPUTER SERVICE' }}</p>
            <strong>{{ kindLabel(composer.kind) }}</strong>
            <span>{{ composerKindHelper }}</span>
          </div>
        </section>

        <nav class="composer-tabs" aria-label="MCP 编辑分栏">
          <button type="button" :class="{ active: composerTab === 'quick' }" @click="composerTab = 'quick'">快速设置</button>
          <button type="button" :class="{ active: composerTab === 'advanced' }" @click="composerTab = 'advanced'">高级设置</button>
        </nav>

        <section v-if="composerTab === 'quick'" class="composer-scroll">
          <label class="form-field"><span>显示名称</span><input v-model="composer.name" maxlength="60" required /></label>
          <label class="form-field">
            <span>远程 HTTPS 地址</span>
            <input v-model="composer.url" inputmode="url" :placeholder="composer.kind === 'custom' ? 'https://mcp.example.com/mcp' : 'https://你的电脑助手域名/mcp'" required />
            <small>{{ composer.kind === 'custom' ? '填写服务商提供的 MCP 地址。' : '在你的电脑运行 BabyLink Bridge，完成 QQ / 小红书登录后，将它生成的 HTTPS MCP 地址粘贴到这里。BabyLink 云端不代理平台流量。' }}</small>
          </label>
          <label class="form-field secret-field">
            <span>API Key <em>没有鉴权可留空</em></span>
            <input v-model="composer.apiKey" autocomplete="off" placeholder="粘贴注册后获得的 Key" type="password" />
          </label>

          <fieldset class="permission-picker">
            <legend>角色可以做什么</legend>
            <label :class="{ active: composer.toolPolicy === 'read-only' }">
              <input v-model="composer.toolPolicy" type="radio" value="read-only" />
              <span><strong>只浏览</strong><small>查询、搜索、读取内容</small></span>
            </label>
            <label :class="{ active: composer.toolPolicy === 'all' }">
              <input v-model="composer.toolPolicy" type="radio" value="all" />
              <span><strong>浏览并操作</strong><small>允许评论、发帖、发送 QQ 消息</small></span>
            </label>
          </fieldset>

          <label class="simple-toggle">
            <span><strong>添加后全局应用</strong><small>所有未单独覆盖的角色都能使用</small></span>
            <input v-model="composer.globalEnabled" type="checkbox" />
          </label>
        </section>

        <section v-else class="composer-scroll advanced-fields">
          <label class="form-field"><span>连接说明</span><textarea v-model="composer.description" maxlength="400" rows="3"></textarea></label>
          <div class="form-grid">
            <label class="form-field"><span>Key 请求头</span><input v-model="composer.apiKeyHeader" placeholder="Authorization" /></label>
            <label class="form-field"><span>Key 前缀</span><input v-model="composer.apiKeyPrefix" placeholder="Bearer " /></label>
          </div>
          <label class="form-field">
            <span>其他请求头 JSON</span>
            <textarea v-model="headersText" autocomplete="off" placeholder='{"X-Client":"BabyLink"}' rows="5" spellcheck="false"></textarea>
            <small>不要重复填写 Content-Type、MCP 会话头或 Origin。</small>
          </label>
          <label class="form-field"><span>连接超时</span><select v-model.number="composer.timeoutMs"><option :value="15000">15 秒</option><option :value="30000">30 秒</option><option :value="45000">45 秒</option><option :value="60000">60 秒</option><option :value="120000">120 秒</option></select></label>
        </section>

        <p v-if="composerError" class="form-error">{{ composerError }}</p>
        <div class="composer-footer">
          <button type="button" @click="showComposer = false">取消</button>
          <button class="primary" type="submit">保存并自动检测</button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showImporter" title="导入远程 MCP" :show-header="false" fixed-height variant="ins">
      <form class="import-composer" @submit.prevent="runImport">
        <section class="import-hero">
          <span><Upload :size="22" /></span>
          <div><p>ONE-CLICK IMPORT</p><strong>把服务商配置粘进来</strong><small>支持 HTTPS 地址、mcpServers JSON 与 BabyLink 配置</small></div>
        </section>

        <div class="import-steps">
          <span><b>1</b>粘贴配置</span><i></i><span><b>2</b>填写 Key</span><i></i><span><b>3</b>自动检测</span>
        </div>

        <section class="import-scroll">
          <label class="file-import-card">
            <Upload :size="18" />
            <span><strong>选择 JSON / TXT 文件</strong><small>也可以直接粘贴到下方</small></span>
            <input accept=".json,.txt,application/json,text/plain" type="file" @change="readImportFile" />
          </label>
          <label class="form-field"><span>配置 JSON 或远程地址</span><textarea v-model="importText" rows="9" spellcheck="false" placeholder='https://mcp.example.com/mcp\n\n或粘贴服务商提供的 mcpServers JSON'></textarea></label>
          <label class="form-field secret-field"><span>API Key <em>可选</em></span><input v-model="importApiKey" autocomplete="off" placeholder="服务商注册后获得的 Key" type="password" /></label>
          <p class="import-tip"><ShieldCheck :size="15" />配置可以预置地址和鉴权格式，用户通常只需填写 API Key。</p>
        </section>

        <p v-if="importError" class="form-error">{{ importError }}</p>
        <div class="composer-footer">
          <button type="button" @click="showImporter = false">取消</button>
          <button class="primary" type="submit">导入并自动检测</button>
        </div>
      </form>
    </AppModal>

    <AppModal :model-value="Boolean(deleteTarget)" title="删除 MCP" :show-header="false" variant="ins" @update:model-value="closeDeleteModal">
      <section v-if="deleteTarget" class="delete-confirm">
        <span class="delete-icon"><Trash2 :size="22" /></span>
        <h3>删除 {{ deleteTarget.name }}？</h3>
        <p>连接配置、鉴权信息、已发现工具和所有角色局部绑定都会一并删除。</p>
        <div><button type="button" @click="deleteTarget = null">继续保留</button><button class="confirm-delete" type="button" @click="deleteServer">确认删除</button></div>
      </section>
    </AppModal>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { AlertTriangle, ArrowRight, BellRing, CalendarDays, Camera, CheckCircle2, ChevronDown, ContactRound, Database, Globe2, KeyRound, Laptop2, MapPinned, MessageCircle, Network, Pencil, Plus, RefreshCw, ShieldCheck, Smartphone, Sparkles, Trash2, Upload, X } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import { createMcpServerTemplate, importMcpServers, inspectMcpServer, normalizeMcpRemoteUrl } from '@/services/mcp';
import { useAppStore } from '@/stores/appStore';
import type { McpServerConfig, McpServerKind, McpSettings, McpToolPolicy } from '@/types/domain';
import { normalizeAppSettings, normalizeMcpSettings } from '@/utils/settings';

type ComposerTab = 'quick' | 'advanced';
type BridgeKind = 'xiaohongshu' | 'qq';

const store = useAppStore();
const showComposer = ref(false);
const showBridgeGuide = ref(false);
const bridgeKind = ref<BridgeKind>('qq');
const bridgePairingText = ref('');
const bridgeError = ref('');
const composerTab = ref<ComposerTab>('quick');
const editingServerId = ref('');
const composer = reactive<McpServerConfig>(createMcpServerTemplate());
const headersText = ref('{}');
const composerError = ref('');
const showImporter = ref(false);
const importText = ref('');
const importApiKey = ref('');
const importError = ref('');
const deleteTarget = ref<McpServerConfig | null>(null);
const testingServerIds = ref(new Set<string>());
const notice = reactive<{ kind: 'success' | 'error'; text: string }>({ kind: 'success', text: '' });

const currentSettings = computed(() => normalizeAppSettings(store.settings));
const mcpSettings = computed(() => currentSettings.value.mcpSettings);
const enabledServerCount = computed(() => mcpSettings.value.servers.filter((server) => server.enabled).length);
const connectedServerCount = computed(() => mcpSettings.value.servers.filter((server) => server.enabled && server.lastStatus === 'connected').length);
const enabledToolCount = computed(() => mcpSettings.value.servers.reduce((count, server) => count + (server.enabled ? server.tools.filter((tool) => tool.enabled).length : 0), 0));
const bridgeGuideTitle = computed(() => bridgeKind.value === 'qq' ? '连接 QQ 电脑助手' : '连接小红书电脑助手');
const bridgePairingPlaceholder = computed(() => bridgeKind.value === 'qq'
  ? '粘贴电脑助手复制的 QQ 配对信息…'
  : '粘贴电脑助手复制的小红书配对信息…');
const bridgeGuideSteps = computed(() => bridgeKind.value === 'qq'
  ? [
      { title: '电脑打开 BabyLink 助手', detail: '选择 QQ，助手会连接本机 NapCat / OneBot。' },
      { title: '按提示扫码登录 QQ', detail: 'QQ 只登录在你的电脑；看到“QQ 在线”再继续。' },
      { title: '复制配对信息', detail: '电脑助手会生成一段配对信息，复制后粘贴到下方。' }
    ]
  : [
      { title: '电脑打开 BabyLink 助手', detail: '选择小红书，并连接你安装的非官方适配器。' },
      { title: '按适配器提示登录', detail: '账号和 Cookie 只留在电脑；看到“适配器在线”再继续。' },
      { title: '复制配对信息', detail: '电脑助手会生成一段配对信息，复制后粘贴到下方。' }
    ]);
const composerKindHelper = computed(() => composer.kind === 'custom'
  ? '填写服务商提供的地址与 Key，保存后自动读取工具。'
  : '服务在用户电脑运行，只把公开的远程 HTTPS 地址填入这里。');

function setNotice(kind: 'success' | 'error', text: string) {
  notice.kind = kind;
  notice.text = text;
}

function clearNotice() {
  notice.text = '';
}

async function saveMcpSettings(nextMcpSettings: McpSettings) {
  await store.saveSettings(normalizeAppSettings({
    ...currentSettings.value,
    mcpSettings: normalizeMcpSettings(nextMcpSettings)
  }));
}

async function patchServer(serverId: string, patch: Partial<McpServerConfig>) {
  await saveMcpSettings({
    ...mcpSettings.value,
    servers: mcpSettings.value.servers.map((server) => server.id === serverId ? { ...server, ...patch } : server)
  });
}

function eventChecked(event: Event) {
  return (event.target as HTMLInputElement).checked;
}

function eventValue(event: Event) {
  return (event.target as HTMLSelectElement).value;
}

function setMasterEnabled(event: Event) {
  void saveMcpSettings({ ...mcpSettings.value, enabled: eventChecked(event) });
}

function setMaxToolCalls(event: Event) {
  void saveMcpSettings({ ...mcpSettings.value, maxToolCallsPerReply: Number(eventValue(event)) });
}

function setServerEnabled(server: McpServerConfig, event: Event) {
  void patchServer(server.id, { enabled: eventChecked(event) });
}

function setGlobalEnabled(server: McpServerConfig, event: Event) {
  void patchServer(server.id, { globalEnabled: eventChecked(event) });
}

function setToolPolicy(server: McpServerConfig, event: Event) {
  const value = eventValue(event);
  const policy: McpToolPolicy = value === 'disabled' || value === 'all' ? value : 'read-only';
  void patchServer(server.id, { toolPolicy: policy });
}

function setToolEnabled(server: McpServerConfig, toolName: string, event: Event) {
  const enabled = eventChecked(event);
  void patchServer(server.id, {
    tools: server.tools.map((tool) => tool.name === toolName ? { ...tool, enabled } : tool)
  });
}

function kindLabel(kind: McpServerKind) {
  if (kind === 'xiaohongshu') return '小红书电脑 Bridge';
  if (kind === 'qq') return 'QQ / NapCat MCP';
  if (kind === 'reality') return 'Reality MCP · 手机能力';
  if (kind === 'notification-inbox') return '系统通知 MCP · 角色专用';
  if (kind === 'taobao-search') return '淘宝商品搜索 MCP';
  if (kind === 'douyin-search') return '抖音视频搜索 MCP';
  if (kind === 'xiaohongshu-search') return '小红书内容搜索 MCP';
  return '自定义 MCP';
}

function isBuiltinMcpServer(server: McpServerConfig) {
  return server.kind === 'reality' || server.kind === 'notification-inbox';
}

function policyDescription(policy: McpToolPolicy) {
  if (policy === 'all') return '角色可真实评论、发帖、点赞或发送消息';
  if (policy === 'disabled') return '保留连接，但不向角色提供工具';
  return '角色只能搜索、浏览和读取外部内容';
}

function policyShortLabel(policy: McpToolPolicy) {
  if (policy === 'all') return '允许操作';
  if (policy === 'disabled') return '角色禁用';
  return '只读';
}

function serverStatusClass(server: McpServerConfig) {
  if (testingServerIds.value.has(server.id)) return 'checking';
  return server.lastStatus;
}

function serverStatusLabel(server: McpServerConfig) {
  if (testingServerIds.value.has(server.id)) return '正在检测';
  if (server.lastStatus === 'connected') return '连接正常';
  if (server.lastStatus === 'error') return '需要检查';
  return '等待检测';
}

function formatLastChecked(timestamp: number) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (elapsedMinutes < 1) return '刚刚检查';
  if (elapsedMinutes < 60) return `${elapsedMinutes} 分钟前`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} 小时前`;
  return `${Math.floor(elapsedHours / 24)} 天前`;
}

function openComposer(kind: McpServerKind) {
  editingServerId.value = '';
  composerTab.value = 'quick';
  Object.assign(composer, createMcpServerTemplate(kind));
  headersText.value = '{}';
  composerError.value = '';
  showComposer.value = true;
}

function openBridgeGuide(kind: BridgeKind) {
  bridgeKind.value = kind;
  bridgePairingText.value = '';
  bridgeError.value = '';
  showBridgeGuide.value = true;
}

async function runBridgePairing() {
  bridgeError.value = '';
  try {
    const imported = importMcpServers(bridgePairingText.value);
    const pairedServer = imported.find((server) => server.kind === bridgeKind.value);
    if (!pairedServer) throw new Error(`这不是${bridgeKind.value === 'qq' ? ' QQ' : '小红书'}电脑助手的配对信息。`);
    const existing = mcpSettings.value.servers.find((server) => server.kind === bridgeKind.value && server.url === pairedServer.url);
    const nextServer: McpServerConfig = {
      ...pairedServer,
      id: existing?.id ?? pairedServer.id,
      enabled: true,
      globalEnabled: true,
      toolPolicy: 'all',
      tools: existing?.tools ?? pairedServer.tools
    };
    const discoveredServer = await discoverServer(nextServer);
    await saveMcpSettings({
      ...mcpSettings.value,
      servers: existing
        ? mcpSettings.value.servers.map((server) => server.id === existing.id ? discoveredServer : server)
        : [...mcpSettings.value.servers, discoveredServer]
    });
    showBridgeGuide.value = false;
    bridgePairingText.value = '';
    setNotice('success', `${discoveredServer.name} 已配对，发现 ${discoveredServer.tools.length} 个工具。`);
  } catch (error) {
    bridgeError.value = error instanceof Error ? error.message : '电脑助手配对失败。';
  }
}

function editServer(server: McpServerConfig) {
  editingServerId.value = server.id;
  composerTab.value = 'quick';
  Object.assign(composer, {
    ...server,
    headers: { ...server.headers },
    tools: server.tools.map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema } }))
  });
  headersText.value = JSON.stringify(server.headers, null, 2);
  composerError.value = '';
  showComposer.value = true;
}

function parseHeaders() {
  if (!headersText.value.trim()) return {};
  const parsed = JSON.parse(headersText.value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('其他请求头必须是 JSON 对象。');
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key.trim(), String(value ?? '').trim()]).filter(([key, value]) => key && value));
}

async function saveComposer() {
  composerError.value = '';
  try {
    const url = normalizeMcpRemoteUrl(composer.url);
    const headers = parseHeaders();
    const nextServer: McpServerConfig = {
      ...composer,
      name: composer.name.trim() || kindLabel(composer.kind),
      description: composer.description.trim(),
      url,
      headers
    };
    const discoveredServer = await discoverServer(nextServer);
    const exists = mcpSettings.value.servers.some((server) => server.id === editingServerId.value);
    await saveMcpSettings({
      ...mcpSettings.value,
      servers: exists
        ? mcpSettings.value.servers.map((server) => server.id === editingServerId.value ? discoveredServer : server)
        : [...mcpSettings.value.servers, discoveredServer]
    });
    showComposer.value = false;
    setNotice('success', `${discoveredServer.name} 已保存，发现 ${discoveredServer.tools.length} 个工具。`);
  } catch (error) {
    composerError.value = error instanceof Error ? error.message : 'MCP 配置无法保存。';
  }
}

async function inspectServer(server: McpServerConfig) {
  testingServerIds.value = new Set([...testingServerIds.value, server.id]);
  clearNotice();
  try {
    const inspection = await inspectMcpServer(server);
    await patchServer(server.id, {
      ...inspection,
      tools: inspection.tools.map((tool) => ({
        ...tool,
        enabled: server.tools.find((configured) => configured.name === tool.name)?.enabled ?? tool.enabled
      })),
      lastStatus: 'connected',
      lastCheckedAt: Date.now(),
      lastError: ''
    });
    setNotice('success', `${server.name} 已连接，发现 ${inspection.tools.length} 个工具。`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MCP 连接失败。';
    await patchServer(server.id, {
      lastStatus: 'error',
      lastCheckedAt: Date.now(),
      lastError: message
    });
    setNotice('error', message);
  } finally {
    const nextIds = new Set(testingServerIds.value);
    nextIds.delete(server.id);
    testingServerIds.value = nextIds;
  }
}

async function discoverServer(server: McpServerConfig) {
  const inspection = await inspectMcpServer(server);
  return {
    ...server,
    ...inspection,
    tools: inspection.tools.map((tool) => ({
      ...tool,
      enabled: server.tools.find((configured) => configured.name === tool.name)?.enabled ?? tool.enabled
    })),
    lastStatus: 'connected' as const,
    lastCheckedAt: Date.now(),
    lastError: ''
  } satisfies McpServerConfig;
}

async function readImportFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > 1_000_000) {
    importError.value = '导入配置不能超过 1 MB。';
    return;
  }
  try {
    importText.value = await file.text();
    importError.value = '';
  } catch {
    importError.value = '无法读取这个配置文件。';
  }
}

async function runImport() {
  importError.value = '';
  try {
    const imported = importMcpServers(importText.value);
    const importedWithKey = imported.map((server) => ({ ...server, apiKey: importApiKey.value.trim() || server.apiKey }));
    const existingUrls = new Set(mcpSettings.value.servers.map((server) => server.url));
    const additions = importedWithKey.filter((server) => !existingUrls.has(server.url));
    if (!additions.length) throw new Error('这些远程地址已经存在。');
    const discoveredAdditions: McpServerConfig[] = [];
    for (const server of additions) discoveredAdditions.push(await discoverServer(server));
    await saveMcpSettings({ ...mcpSettings.value, servers: [...mcpSettings.value.servers, ...discoveredAdditions] });
    showImporter.value = false;
    importText.value = '';
    importApiKey.value = '';
    const toolCount = discoveredAdditions.reduce((total, server) => total + server.tools.length, 0);
    setNotice('success', `已导入 ${discoveredAdditions.length} 个远程 MCP，发现 ${toolCount} 个工具。`);
  } catch (error) {
    importError.value = error instanceof Error ? error.message : 'MCP 配置导入失败。';
  }
}

function closeDeleteModal(open: boolean) {
  if (!open) deleteTarget.value = null;
}

async function deleteServer() {
  const server = deleteTarget.value;
  if (!server) return;
  await saveMcpSettings({
    ...mcpSettings.value,
    servers: mcpSettings.value.servers.filter((entry) => entry.id !== server.id)
  });
  const affectedCharacters = store.characters.filter((character) => character.mcpBinding?.serverIds.includes(server.id));
  await Promise.all(affectedCharacters.map((character) => store.saveCharacter({
    ...character,
    mcpBinding: {
      overrideGlobal: Boolean(character.mcpBinding?.overrideGlobal),
      serverIds: (character.mcpBinding?.serverIds ?? []).filter((serverId) => serverId !== server.id)
    }
  })));
  deleteTarget.value = null;
  setNotice('success', `${server.name} 已删除。`);
}
</script>

<style scoped>
.mcp-console { display: grid; gap: 14px; min-width: 0; color: #171717; }

.mcp-overview, .capability-card, .assistant-card, .remote-card {
  min-width: 0;
  border: 1px solid rgba(29, 36, 32, 0.06);
  border-radius: 22px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(28, 35, 31, 0.055);
}
.mcp-overview { overflow: hidden; background: linear-gradient(145deg, #ffffff 0%, #f5f9f6 100%); }
.overview-main { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 11px; padding: 16px; }
.overview-icon { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 15px; color: #315e47; background: #edf6f0; }
.overview-main > div { min-width: 0; }
.overview-main p { margin: 0 0 3px; color: #718078; font-size: 10px; font-weight: 900; letter-spacing: 0.12em; }
.overview-main h2 { margin: 0; font-size: 17px; line-height: 1.25; }
.overview-main div > span { display: block; margin-top: 5px; color: #77827c; font-size: 11px; line-height: 1.5; }
.overview-stats { display: flex; align-items: center; justify-content: center; gap: 9px; min-height: 39px; padding: 8px 12px; color: #737e78; background: rgba(236, 242, 238, 0.72); font-size: 10px; }
.overview-stats span { white-space: nowrap; }
.overview-stats strong { color: #27322c; font-size: 12px; }
.overview-stats i { width: 1px; height: 13px; background: #d8e0db; }

.capability-card, .assistant-card, .remote-card { display: grid; gap: 12px; padding: 15px; }
.section-intro { margin: -4px 0 0; color: #77817b; font-size: 11px; line-height: 1.6; }
.ready-badge, .computer-badge { display: inline-flex; align-items: center; gap: 4px; padding: 5px 8px; border-radius: 999px; font-size: 10px !important; font-weight: 800; }
.ready-badge { color: #27704a !important; background: #eaf7ef; }
.computer-badge { color: #3d6380 !important; background: #edf6fc; }

.capability-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.capability-grid article { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 9px; min-width: 0; padding: 10px; border: 1px solid #edf0ee; border-radius: 16px; background: #fafbfa; }
.capability-grid article > div { display: grid; min-width: 0; gap: 3px; }
.capability-grid strong { font-size: 12px; }
.capability-grid small { color: #808a84; font-size: 10px; line-height: 1.45; }
.capability-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 12px; }
.capability-icon.green { color: #347355; background: #eaf6ee; }
.capability-icon.blue { color: #3d6f94; background: #eaf4fb; }
.capability-icon.amber { color: #94672c; background: #fbf2df; }
.capability-icon.rose { color: #a34e62; background: #fbeef2; }
.capability-icon.violet { color: #71559a; background: #f2ecfb; }
.search-capability { grid-column: 1 / -1; }

.pairing-grid, .remote-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.pairing-grid button, .remote-actions button { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; min-width: 0; text-align: left; }
.pairing-grid button > span:nth-child(2), .remote-actions button > span:nth-child(2) { display: grid; min-width: 0; gap: 3px; }
.pairing-grid strong, .remote-actions strong { font-size: 12px; }
.pairing-grid small, .remote-actions small { overflow: hidden; color: #849088; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }

.pairing-grid { padding-top: 2px; border-top: 1px solid #edf0ee; }
.pairing-grid button { min-height: 55px; padding: 8px 9px; border-radius: 15px; color: #313733; background: #f7f8f7; }
.privacy-note { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 8px; padding: 10px; border-radius: 14px; color: #5f6955; background: #f8f6ed; }
.privacy-note > span { display: grid; gap: 2px; }
.privacy-note strong { font-size: 11px; }
.privacy-note small { color: #827d6b; font-size: 10px; line-height: 1.5; }

.remote-actions button { min-height: 58px; padding: 9px 10px; border: 1px solid #e5e9e7; border-radius: 16px; color: #303632; background: #f8f9f8; }
.remote-actions button.primary { border: 0; color: #ffffff; background: #252a27; box-shadow: 0 9px 18px rgba(29, 35, 32, 0.14); }
.remote-actions .action-icon { width: 36px; height: 36px; border-radius: 12px; background: #ffffff; }
.remote-actions .primary .action-icon { background: rgba(255, 255, 255, 0.13); }
.remote-actions .primary small { color: rgba(255, 255, 255, 0.62); }

.action-icon, .template-icon, .server-avatar, .composer-icon { display: grid; place-items: center; flex: 0 0 auto; }
.section-heading p, .composer-hero p, .import-hero p { margin: 0 0 3px; color: #75837a; font-size: 10px; font-weight: 900; letter-spacing: 0.12em; }
.master-control { display: grid; justify-items: center; gap: 4px; cursor: pointer; }
.master-control input, .mini-switch input { position: absolute; opacity: 0; pointer-events: none; }
.master-track, .mini-switch > span { display: block; border-radius: 999px; background: #d8ddda; transition: 180ms ease; }
.master-track { width: 42px; height: 25px; }
.master-track::after, .mini-switch > span::after { content: ''; display: block; border-radius: 50%; background: #ffffff; box-shadow: 0 2px 7px rgba(20, 26, 23, 0.2); transition: 180ms ease; }
.master-track::after { width: 19px; height: 19px; margin: 3px; }
.master-control input:checked + .master-track, .mini-switch input:checked + span { background: #202321; }
.master-control input:checked + .master-track::after { transform: translateX(17px); }
.master-control small { color: #7d8681; font-size: 10px; font-weight: 900; letter-spacing: 0.06em; }

.notice { display: flex; align-items: flex-start; gap: 9px; padding: 11px 12px; border-radius: 15px; font-size: 11px; line-height: 1.5; }
.notice.success { color: #286744; background: #edf8f1; }
.notice.error { color: #9c4038; background: #fff0ee; }
.notice span { flex: 1; }
.notice button { padding: 0; color: inherit; }

.server-library, .reply-preferences { border: 1px solid rgba(24, 29, 26, 0.05); border-radius: 22px; background: rgba(255, 255, 255, 0.9); box-shadow: 0 12px 30px rgba(27, 33, 30, 0.05); }
.server-library { display: grid; gap: 12px; padding: 14px; }
.section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; }
.section-heading h3 { margin: 0; font-size: 15px; }
.section-heading > span { color: #8a918d; font-size: 10px; }
.reality-help { overflow: hidden; border: 1px solid #e7ebe8; border-radius: 15px; background: #fafbfa; }
.reality-help summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 11px; color: #5e6962; cursor: pointer; list-style: none; font-size: 10px; font-weight: 850; }
.reality-help summary::-webkit-details-marker { display: none; }
.reality-help[open] summary svg { transform: rotate(180deg); }
.reality-help > div { display: grid; gap: 7px; padding: 0 11px 10px; }
.reality-help p { margin: 0; color: #808984; font-size: 10px; line-height: 1.6; }
.reality-help strong { color: #4c5751; }
.action-icon { width: 38px; height: 38px; border-radius: 13px; background: rgba(255, 255, 255, 0.14); }
.template-icon { width: 34px; height: 34px; border-radius: 12px; }
.template-icon.xhs { color: #b64659; background: #fff0f3; }
.template-icon.qq { color: #2770a2; background: #eef7fd; }

.library-heading { align-items: center; }
.library-heading { cursor: pointer; list-style: none; }
.library-heading::-webkit-details-marker { display: none; }
.library-heading > span { display: inline-flex; align-items: center; gap: 4px; padding: 5px 8px; border-radius: 999px; color: #5d6962; background: #f0f3f1; font-weight: 850; }
.server-library[open] > .library-heading > span svg { transform: rotate(180deg); }

.server-list { display: grid; gap: 10px; }
.server-card { min-width: 0; overflow: hidden; border: 1px solid rgba(25, 31, 28, 0.06); border-radius: 19px; background: linear-gradient(180deg, #ffffff, #fbfcfb); box-shadow: 0 9px 22px rgba(27, 34, 30, 0.045); }
.server-card.disabled { opacity: 0.64; }
.server-summary { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 9px; padding: 12px 12px 8px; }
.server-avatar { width: 39px; height: 39px; border-radius: 14px; color: #326448; background: #edf7f1; }
.server-avatar.kind-xiaohongshu { color: #b64659; background: #fff0f3; }
.server-avatar.kind-qq { color: #2770a2; background: #eef7fd; }
.server-title { display: grid; min-width: 0; gap: 2px; }
.server-title strong, .server-title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.server-title strong { font-size: 12px; }
.server-title span { color: #8d9490; font-size: 10px; }
.mini-switch { position: relative; display: inline-flex; cursor: pointer; }
.mini-switch > span { width: 38px; height: 22px; }
.mini-switch > span::after { width: 16px; height: 16px; margin: 3px; }
.mini-switch input:checked + span::after { transform: translateX(16px); }

.server-health { display: flex; align-items: center; gap: 5px; padding: 0 12px 8px; color: #858d88; font-size: 10px; }
.server-health strong { color: #59635d; font-size: 11px; }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: #aeb5b1; }
.status-dot.connected { background: #35a667; box-shadow: 0 0 0 3px rgba(53, 166, 103, 0.1); }
.status-dot.error { background: #d75b50; box-shadow: 0 0 0 3px rgba(215, 91, 80, 0.1); }
.status-dot.checking { background: #d6a339; box-shadow: 0 0 0 3px rgba(214, 163, 57, 0.12); }
.endpoint-row { display: flex; align-items: center; gap: 6px; min-width: 0; margin: 0 12px 8px; padding: 8px 9px; border-radius: 11px; color: #6f7873; background: #f3f5f4; font-size: 10px; }
.endpoint-row svg { flex: 0 0 auto; }
.endpoint-row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.server-tags { display: flex; flex-wrap: wrap; gap: 5px; padding: 0 12px 11px; }
.server-tags span { padding: 4px 7px; border-radius: 999px; color: #78817c; background: #f0f2f1; font-size: 10px; font-weight: 800; }
.server-tags span.active { color: #287049; background: #eaf7ef; }
.server-tags span.write { color: #9a5d37; background: #fff1e7; }

.server-manage { border-top: 1px solid #edf0ee; }
.server-manage > summary, .tool-details > summary, .reply-preferences > summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; list-style: none; }
.server-manage > summary::-webkit-details-marker, .tool-details > summary::-webkit-details-marker, .reply-preferences > summary::-webkit-details-marker { display: none; }
.server-manage > summary { padding: 10px 12px; color: #626d66; background: #fafbfa; font-size: 10px; font-weight: 850; }
.server-manage[open] > summary > svg, .tool-details[open] > summary > svg, .reply-preferences[open] > summary > svg { transform: rotate(180deg); }
.server-manage-body { display: grid; }
.control-row, .policy-row, .tool-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-top: 1px solid #eef1ef; }
.control-row > span, .policy-row > span, .tool-row > span { display: grid; min-width: 0; gap: 2px; }
.control-row strong, .policy-row strong, .tool-row strong { font-size: 11px; }
.control-row small, .policy-row small, .tool-row small { color: #8c9490; font-size: 10px; line-height: 1.5; }
.control-row input, .tool-row input { flex: 0 0 auto; width: 17px; height: 17px; accent-color: #252a27; }
.policy-row select { max-width: 120px; min-height: 34px; padding: 0 6px; border: 1px solid #dfe4e1; border-radius: 10px; background: #ffffff; font-size: 10px; }
.tool-details { border-top: 1px solid #eef1ef; }
.tool-details > summary { padding: 10px 12px; color: #5f6963; font-size: 10px; font-weight: 850; }
.tool-details > summary span { display: inline-flex; align-items: center; gap: 6px; }
.tool-list { display: grid; border-top: 1px solid #eef1ef; }
.tool-row { align-items: flex-start; }
.tool-row small { overflow-wrap: anywhere; }
.tool-row em { width: fit-content; margin-top: 2px; padding: 2px 5px; border-radius: 5px; font-size: 10px; font-style: normal; font-weight: 850; }
.tool-row em.read { color: #287049; background: #edf8f1; }
.tool-row em.write { color: #9a512f; background: #fff2e9; }
.tool-details > p { margin: 0; padding: 0 12px 11px; color: #909792; font-size: 10px; }
.server-error { margin: 0; padding: 9px 12px; color: #a14139; background: #fff3f1; font-size: 10px; line-height: 1.5; overflow-wrap: anywhere; }
.server-actions { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: #edf0ee; }
.server-actions.builtin { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.server-actions button { display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 40px; color: #5e6962; background: #fafbfa; font-size: 10px; font-weight: 800; }
.server-actions button.danger { color: #a4473f; }
.server-actions button:disabled { opacity: 0.5; }
.builtin-action-note { display: flex; align-items: center; justify-content: center; min-height: 40px; color: #6b8272; background: #f2f8f3; font-size: 10px; font-weight: 800; }

.empty-library { display: grid; justify-items: center; gap: 6px; padding: 22px 16px; border: 1px dashed rgba(33, 40, 36, 0.11); border-radius: 18px; color: #808985; text-align: center; background: #fafbfa; }
.empty-library > span { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 16px; color: #486b56; background: #edf6f0; }
.empty-library strong { color: #4e5852; font-size: 12px; }
.empty-library p { max-width: 230px; margin: 0; font-size: 10px; line-height: 1.55; }
.empty-library button { min-height: 36px; margin-top: 3px; padding: 0 13px; border-radius: 999px; color: #ffffff; background: #262a28; font-size: 10px; font-weight: 850; }

.reply-preferences { overflow: hidden; }
.reply-preferences > summary { padding: 12px 13px; }
.reply-preferences > summary span { display: grid; gap: 2px; }
.reply-preferences > summary strong { font-size: 11px; }
.reply-preferences > summary small { color: #8b938e; font-size: 10px; }
.reply-preferences > label { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 13px; border-top: 1px solid #eef0ef; color: #59635d; font-size: 10px; font-weight: 800; }
.reply-preferences select { min-height: 34px; padding: 0 24px 0 8px; border: 1px solid #dfe4e1; border-radius: 10px; background: #ffffff; font-size: 10px; }
.reply-preferences > p { margin: 0; padding: 0 13px 12px; color: #919894; font-size: 10px; line-height: 1.5; }

.setup-composer, .import-composer, .bridge-guide { display: grid; gap: 12px; height: 100%; min-height: 0; overflow: hidden; }
.setup-composer, .import-composer { grid-template-rows: auto auto minmax(0, 1fr) auto auto; }
.bridge-guide { grid-template-rows: auto minmax(0, 1fr) auto auto; }
.composer-hero, .import-hero { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 10px; padding: 13px; border-radius: 21px; background: radial-gradient(circle at top right, rgba(218, 239, 226, 0.9), transparent 42%), linear-gradient(145deg, #fffefd, #f5f7f6); }
.composer-hero.kind-xiaohongshu { background: radial-gradient(circle at top right, rgba(255, 213, 222, 0.84), transparent 42%), #fffafa; }
.composer-hero.kind-qq { background: radial-gradient(circle at top right, rgba(210, 235, 250, 0.9), transparent 42%), #f9fcff; }
.composer-icon, .import-hero > span { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 15px; color: #315f47; background: rgba(255, 255, 255, 0.86); box-shadow: 0 8px 18px rgba(29, 48, 38, 0.08); }
.composer-hero > div, .import-hero > div { display: grid; min-width: 0; gap: 2px; }
.composer-hero strong, .import-hero strong { overflow: hidden; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
.composer-hero div > span, .import-hero small { color: #7e8782; font-size: 10px; line-height: 1.5; }
.composer-tabs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; padding: 4px; border-radius: 15px; background: #eff2f0; }
.composer-tabs button { min-height: 36px; border-radius: 12px; color: #7a837e; font-size: 10px; font-weight: 850; }
.composer-tabs button.active { color: #ffffff; background: #252927; box-shadow: 0 6px 14px rgba(30, 35, 32, 0.15); }
.composer-scroll, .import-scroll { display: grid; align-content: start; gap: 11px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 1px; }

.bridge-hero { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 10px; padding: 13px; border-radius: 21px; background: radial-gradient(circle at top right, rgba(210, 235, 250, 0.9), transparent 42%), #f9fcff; }
.bridge-hero.kind-xiaohongshu { background: radial-gradient(circle at top right, rgba(255, 213, 222, 0.84), transparent 42%), #fffafa; }
.bridge-hero > div { display: grid; min-width: 0; gap: 2px; }
.bridge-hero p { margin: 0; color: #75837a; font-size: 10px; font-weight: 900; letter-spacing: 0.12em; }
.bridge-hero strong { font-size: 13px; }
.bridge-hero small { color: #7e8782; font-size: 10px; line-height: 1.5; }
.bridge-scroll { display: grid; align-content: start; gap: 11px; min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 1px; }
.bridge-steps { display: grid; gap: 7px; }
.bridge-steps article { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 9px; padding: 10px; border: 1px solid #e7ebe8; border-radius: 15px; background: #fafbfa; }
.bridge-steps b { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 9px; color: #ffffff; background: #2b312e; font-size: 10px; }
.bridge-steps span, .pairing-focus > div { display: grid; gap: 2px; }
.bridge-steps strong, .pairing-focus strong { font-size: 11px; }
.bridge-steps small, .pairing-focus small { color: #87908b; font-size: 10px; line-height: 1.5; }
.pairing-focus { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 8px; padding: 10px; border-radius: 15px; color: #2f6f4d; background: #eef8f2; }
.pairing-field textarea { min-height: 112px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.bridge-help { border: 1px solid #e7ebe8; border-radius: 14px; background: #fafbfa; }
.bridge-help summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px; color: #616b65; cursor: pointer; list-style: none; font-size: 10px; font-weight: 850; }
.bridge-help summary::-webkit-details-marker { display: none; }
.bridge-help[open] summary svg { transform: rotate(180deg); }
.bridge-help p { margin: 0; padding: 0 10px 9px; color: #858e88; font-size: 10px; line-height: 1.5; }

.form-field { display: grid; gap: 5px; color: #59635d; font-size: 10px; font-weight: 850; }
.form-field > span { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.form-field em { color: #9a9f9c; font-size: 10px; font-style: normal; font-weight: 600; }
.form-field input, .form-field textarea, .form-field select { width: 100%; min-width: 0; padding: 10px 11px; border: 1px solid #e0e5e2; border-radius: 13px; color: #202522; background: #f8f9f8; font-size: 11px; outline: none; }
.form-field input:focus, .form-field textarea:focus, .form-field select:focus { border-color: #8daf9a; background: #ffffff; box-shadow: 0 0 0 3px rgba(91, 144, 112, 0.09); }
.form-field textarea { resize: vertical; line-height: 1.5; }
.form-field small { color: #959c98; font-size: 10px; font-weight: 500; line-height: 1.5; }

.permission-picker { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin: 0; padding: 0; border: 0; }
.permission-picker legend { grid-column: 1 / -1; margin-bottom: 5px; color: #59635d; font-size: 10px; font-weight: 850; }
.permission-picker label { display: grid; min-width: 0; padding: 10px; border: 1px solid #e2e6e3; border-radius: 15px; background: #f8f9f8; cursor: pointer; }
.permission-picker label.active { border-color: rgba(38, 46, 41, 0.35); background: #f1f4f2; box-shadow: inset 0 0 0 1px rgba(38, 46, 41, 0.08); }
.permission-picker input { position: absolute; opacity: 0; }
.permission-picker span { display: grid; gap: 3px; }
.permission-picker strong { font-size: 11px; }
.permission-picker small { color: #8b938e; font-size: 10px; line-height: 1.45; }

.simple-toggle { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px; border-radius: 15px; background: #f7f8f7; }
.simple-toggle > span { display: grid; gap: 2px; }
.simple-toggle strong { font-size: 11px; }
.simple-toggle small { color: #8f9692; font-size: 10px; }
.simple-toggle input { width: 18px; height: 18px; accent-color: #262b28; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.form-error { margin: 0; padding: 9px 10px; border-radius: 11px; color: #9e3f37; background: #fff0ee; font-size: 10px; line-height: 1.5; }
.composer-footer { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0; overflow: hidden; border-radius: 13px; }
.composer-footer button { min-width: 0; min-height: 40px; border-radius: 0; color: #647069; background: #eef1ef; font-size: 10px; font-weight: 850; white-space: nowrap; }
.composer-footer button.primary { color: #ffffff; background: #252927; }
.setup-composer.setup-composer > .composer-footer.composer-footer,
.import-composer.import-composer > .composer-footer.composer-footer { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 0 !important; padding: 0 !important; }
.setup-composer > .composer-footer > button,
.import-composer > .composer-footer > button { min-height: 40px !important; padding-inline: 0 !important; border-radius: 0 !important; font-size: 10px !important; }

.import-steps { display: grid; grid-template-columns: auto 1fr auto 1fr auto; align-items: center; gap: 5px; color: #7d8681; font-size: 10px; }
.import-steps span { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
.import-steps b { display: grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; color: #ffffff; background: #333936; font-size: 10px; }
.import-steps i { height: 1px; background: #dfe4e1; }
.file-import-card { position: relative; display: flex; align-items: center; gap: 9px; padding: 11px; border: 1px dashed #cfd8d2; border-radius: 15px; color: #53635a; background: #f5f8f6; cursor: pointer; }
.file-import-card > span { display: grid; gap: 2px; }
.file-import-card strong { font-size: 10px; }
.file-import-card small { color: #929b95; font-size: 10px; }
.file-import-card input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.import-tip { display: flex; align-items: flex-start; gap: 6px; margin: 0; padding: 9px 10px; border-radius: 12px; color: #756b59; background: #faf5e9; font-size: 10px; line-height: 1.5; }

.delete-confirm { display: grid; justify-items: center; gap: 9px; padding: 8px 4px 2px; text-align: center; }
.delete-icon { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 16px; color: #b33d37; background: #fff0ee; }
.delete-confirm h3 { margin: 0; font-size: 15px; }
.delete-confirm p { margin: 0; color: #7c8780; font-size: 10px; line-height: 1.55; }
.delete-confirm > div { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0; overflow: hidden; width: 100%; margin-top: 5px; border-radius: 11px; }
.delete-confirm button { min-width: 0; min-height: 40px; border-radius: 0; color: #5e6962; background: #eef1ef; font-size: 10px; font-weight: 850; white-space: nowrap; }
.delete-confirm .confirm-delete { color: #ffffff; background: #bd453d; }
.delete-confirm > div > button { min-height: 40px !important; padding-inline: 0 !important; border-radius: 0 !important; font-size: 10px !important; }

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 360px) {
  .overview-main { gap: 8px; padding: 14px 12px; }
  .overview-icon { width: 40px; height: 40px; }
  .overview-main h2 { font-size: 15px; }
  .overview-main div > span { font-size: 10px; }
  .overview-stats { gap: 5px; padding-inline: 7px; font-size: 10px; }
  .overview-stats strong { font-size: 11px; }
  .capability-card, .assistant-card, .remote-card { padding: 13px; }
  .capability-grid { grid-template-columns: 1fr; }
  .pairing-grid, .remote-actions { grid-template-columns: 1fr; }
  .form-grid, .permission-picker { grid-template-columns: 1fr; }
}
</style>