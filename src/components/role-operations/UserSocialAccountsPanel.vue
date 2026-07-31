<template>
  <section class="operations-section user-social-accounts-panel">
    <header class="section-heading">
      <div><span>USER ACCOUNTS</span><h2>用户账号 · 仅查询</h2></div>
      <div class="header-actions"><button v-if="accounts.length" type="button" @click="openManualAction">手动互动</button><button type="button" @click="formOpen = true">绑定用户账号</button></div>
    </header>
    <p class="scope-hint">绑定的是用户自己的账号，仅授权给「{{ characterName }}」读取资料、作品与公开互动；它绝不会进入角色发帖、点赞、评论或私信队列。</p>

    <div v-if="accounts.length" class="account-list">
      <article v-for="account in accounts" :key="account.id" class="account-card user-account-card">
        <span class="platform-icon" :class="`platform-${account.platform}`"><component :is="platformIcon(account.platform)" :size="18" /></span>
        <div><strong>{{ account.displayName }}</strong><small>{{ platformLabel(account.platform) }} · {{ account.accountId }}</small><em>{{ capabilitiesText(account) }}</em></div>
        <button type="button" @click="selectForLookup(account)">查询</button>
        <button type="button" @click="toggleAccount(account)">{{ account.enabled ? '暂停' : '恢复' }}</button>
        <button class="danger-text" type="button" @click="removeAccount(account)">解绑</button>
      </article>
    </div>
    <p v-else class="empty-card">绑定用户的小红书或抖音账号后，当前角色可以通过只读连接查看资料、作品和评论。</p>

    <section v-if="accounts.length" class="user-lookup-box" aria-label="角色查询用户账号">
      <header><div><span>OBSERVE</span><h3>让角色查询用户账号</h3></div><Search :size="18" /></header>
      <form class="operation-form" @submit.prevent="lookupAccount">
        <label>用户账号<select v-model="lookup.accountId"><option value="" disabled>选择要查询的用户账号</option><option v-for="account in accounts.filter((entry) => entry.enabled)" :key="account.id" :value="account.id">{{ account.displayName }} · {{ platformLabel(account.platform) }}</option></select></label>
        <label>查询内容<select v-model="lookup.action"><option v-for="action in availableLookupActions" :key="action" :value="action">{{ lookupActionLabel(action) }}</option></select></label>
        <label>{{ lookupInputLabel }}<input v-model.trim="lookup.query" maxlength="160" :placeholder="lookupPlaceholder"></label>
        <button class="primary-button" type="submit" :disabled="lookupRunning">{{ lookupRunning ? '查询中…' : '由角色查询' }}</button>
      </form>
      <p v-if="lookupNotice" class="lookup-notice" :class="lookupNoticeKind">{{ lookupNotice }}</p>
      <pre v-if="lookupResult" class="lookup-result">{{ lookupResult }}</pre>
    </section>

    <AppModal v-model="formOpen" title="绑定用户账号" eyebrow="YOUR ACCOUNT · READ ACCESS" variant="ins">
      <form class="operation-form account-form" @submit.prevent="saveUserAccount">
        <label>平台<select v-model="form.platform" @change="syncServer"><option value="xiaohongshu">小红书</option><option value="douyin">抖音</option></select></label>
        <label>账号展示名<input v-model.trim="form.displayName" maxlength="36" placeholder="例如：我的小红书" required></label>
        <label>账号 ID / 主页标识<input v-model.trim="form.accountId" maxlength="100" placeholder="只记录展示 ID，不填写 Cookie 或密码" required></label>
        <label>查询连接<select v-model="form.serverId" required><option value="" disabled>选择已配对的 MCP 连接</option><option v-for="server in compatibleServers" :key="server.id" :value="server.id">{{ server.name }} · {{ server.lastStatus === 'connected' ? '在线' : '待检测' }}</option></select></label>
        <p class="form-hint">默认只读取资料。平台凭据只留在你的 Termux、Bridge 或上游适配器中。</p>
        <button class="primary-button" type="submit">保存用户账号</button>
      </form>
    </AppModal>

    <AppModal v-model="manualActionOpen" title="用户手动互动" eyebrow="ONLY YOU · EXPLICIT CONFIRMATION" variant="ins">
      <form class="operation-form manual-action-form" @submit.prevent="submitManualAction">
        <p class="manual-safety-note">这是用户自己的即时操作，不会交给角色、不会进入自动任务队列。每次发送前都会要求你再次确认。</p>
        <label>使用用户账号<select v-model="manual.accountId" required><option value="" disabled>选择你的平台账号</option><option v-for="account in accounts.filter((entry) => entry.enabled)" :key="account.id" :value="account.id">{{ account.displayName }} · {{ platformLabel(account.platform) }}</option></select></label>
        <label>操作<select v-model="manual.action"><option value="like">点赞</option><option value="comment">评论</option><option value="direct-message">私信</option></select></label>
        <label>{{ manualTargetLabel }}<input v-model.trim="manual.recipient" maxlength="120" :placeholder="manualTargetPlaceholder" required></label>
        <label v-if="manual.action !== 'like'">{{ manual.action === 'comment' ? '评论内容' : '私信内容' }}<textarea v-model="manual.content" rows="4" maxlength="1000" placeholder="由你本人输入，将直接发送到平台" required></textarea></label>
        <p v-if="manualNotice" class="lookup-notice" :class="manualNoticeKind">{{ manualNotice }}</p>
        <button class="primary-button" type="submit" :disabled="manualRunning">{{ manualRunning ? '发送中…' : '确认并手动发送' }}</button>
      </form>
    </AppModal>
  </section>
</template>

<script setup lang="ts">
import { FileText, Search, Video } from 'lucide-vue-next';
import { computed, reactive, ref, watch } from 'vue';
import AppModal from '@/components/common/AppModal.vue';
import { useRoleOperationsStore } from '@/stores/roleOperationsStore';
import { executeUserSocialLookup, executeUserSocialManualAction, suggestedUserAccountCapabilities } from '@/services/roleOperations';
import type { AppSettings, McpServerConfig } from '@/types/domain';
import type { UserSocialAccount, UserSocialManualAction, UserSocialReadAction } from '@/types/roleOperations';
import { createId } from '@/utils/id';

const props = defineProps<{
  characterId: string;
  characterName: string;
  userId: string;
  settings: AppSettings;
}>();

const operations = useRoleOperationsStore();
const formOpen = ref(false);
const manualActionOpen = ref(false);
const lookupRunning = ref(false);
const manualRunning = ref(false);
const lookupNotice = ref('');
const lookupNoticeKind = ref<'success' | 'error'>('success');
const manualNotice = ref('');
const manualNoticeKind = ref<'success' | 'error'>('success');
const lookupResult = ref('');
const form = reactive({ platform: 'xiaohongshu' as UserSocialAccount['platform'], displayName: '', accountId: '', serverId: '' });
const lookup = reactive({ accountId: '', action: 'profile' as UserSocialReadAction, query: '' });
const manual = reactive({ accountId: '', action: 'like' as UserSocialManualAction, recipient: '', content: '' });

const accounts = computed(() => operations.userAccountsForUser(props.userId, props.characterId));
const selectedLookupAccount = computed(() => accounts.value.find((account) => account.id === lookup.accountId) ?? null);
const compatibleServers = computed(() => props.settings.mcpSettings.servers.filter((server) => supportsPlatformRead(server, form.platform)));
const availableLookupActions = computed<UserSocialReadAction[]>(() => selectedLookupAccount.value?.capabilities.length ? selectedLookupAccount.value.capabilities : ['profile']);
const lookupInputLabel = computed(() => lookup.action === 'search' ? '搜索关键词' : lookup.action === 'detail' || lookup.action === 'comments' ? '笔记 / 视频 ID' : '用户账号 ID（留空使用绑定账号）');
const lookupPlaceholder = computed(() => lookup.action === 'search' ? '输入关键词' : lookup.action === 'detail' || lookup.action === 'comments' ? '输入笔记或视频 ID' : selectedLookupAccount.value?.accountId || '输入账号 ID');
const manualTargetLabel = computed(() => manual.action === 'direct-message' ? '收件人 ID' : '目标内容 ID');
const manualTargetPlaceholder = computed(() => manual.action === 'direct-message' ? '输入平台用户 ID' : '输入笔记或视频 ID');

function platformLabel(platform: UserSocialAccount['platform']) {
  return platform === 'xiaohongshu' ? '小红书' : '抖音';
}

function platformIcon(platform: UserSocialAccount['platform']) {
  return platform === 'douyin' ? Video : FileText;
}

function lookupActionLabel(action: UserSocialReadAction) {
  return { profile: '查看账号资料', posts: '查看账号作品', search: '搜索内容', detail: '查看内容详情', comments: '查看评论区' }[action];
}

function capabilitiesText(account: UserSocialAccount) {
  const labels = { profile: '账号资料', posts: '账号作品', search: '搜索', detail: '内容详情', comments: '评论区' } as const;
  return account.capabilities.length ? account.capabilities.map((capability) => labels[capability]).join(' · ') : '当前连接未发现可用查询工具';
}

function supportsPlatformRead(server: McpServerConfig, platform: UserSocialAccount['platform']) {
  if (!server.enabled || server.toolPolicy === 'disabled') return false;
  const prefix = platform === 'xiaohongshu' ? /(?:^|_)xhs(?:_|$)|xiaohongshu|rednote/i : /(?:^|_)douyin(?:_|$)|抖音/i;
  return server.tools.some((tool) => tool.enabled && !tool.write && prefix.test(`${tool.name} ${tool.title} ${tool.description}`));
}

function syncServer() {
  form.serverId = compatibleServers.value[0]?.id ?? '';
}

async function saveUserAccount() {
  const server = props.settings.mcpSettings.servers.find((entry) => entry.id === form.serverId) ?? null;
  if (!server || !supportsPlatformRead(server, form.platform)) return notify('请选择提供只读查询工具的 MCP 连接。', 'error');
  const now = Date.now();
  const existing = operations.userAccounts.find((account) => account.userId === props.userId && account.platform === form.platform && account.accountId === form.accountId && account.serverId === server.id);
  const account: UserSocialAccount = existing
    ? {
        ...existing,
        displayName: form.displayName,
        characterIds: [...new Set([...existing.characterIds, props.characterId])],
        enabled: true,
        status: server.lastStatus === 'connected' ? 'connected' : 'unknown',
        capabilities: suggestedUserAccountCapabilities(form.platform, server),
        lastCheckedAt: server.lastCheckedAt,
        lastError: server.lastError,
        updatedAt: now
      }
    : {
        id: createId('user-social-account'),
        userId: props.userId,
        characterIds: [props.characterId],
        platform: form.platform,
        displayName: form.displayName,
        accountId: form.accountId,
        serverId: server.id,
        enabled: true,
        status: server.lastStatus === 'connected' ? 'connected' : 'unknown',
        capabilities: suggestedUserAccountCapabilities(form.platform, server),
        lastCheckedAt: server.lastCheckedAt,
        lastError: server.lastError,
        createdAt: now,
        updatedAt: now
      };
  await operations.saveUserAccount(account);
  lookup.accountId = account.id;
  lookup.action = account.capabilities[0] ?? 'profile';
  lookup.query = account.accountId;
  form.displayName = '';
  form.accountId = '';
  formOpen.value = false;
  notify('用户账号已绑定给当前角色；它只可用于查询。');
}

function openManualAction() {
  manual.accountId = accounts.value.find((account) => account.enabled)?.id ?? '';
  manual.action = 'like';
  manual.recipient = '';
  manual.content = '';
  manualNotice.value = '';
  manualActionOpen.value = true;
}

async function submitManualAction() {
  const account = accounts.value.find((entry) => entry.id === manual.accountId) ?? null;
  const label = manual.action === 'like' ? '点赞' : manual.action === 'comment' ? '发表评论' : '发送私信';
  if (!window.confirm(`确认使用「${account?.displayName || '当前用户账号'}」${label}？此操作会直接发送到平台。`)) return;
  manualRunning.value = true;
  try {
    const result = await executeUserSocialManualAction({
      settings: props.settings,
      account,
      action: manual.action,
      recipient: manual.recipient,
      content: manual.content
    });
    manualNotice.value = result.summary;
    manualNoticeKind.value = result.ok ? 'success' : 'error';
    if (result.ok) {
      manual.recipient = '';
      manual.content = '';
    }
  } finally {
    manualRunning.value = false;
  }
}

async function toggleAccount(account: UserSocialAccount) {
  await operations.saveUserAccount({ ...account, enabled: !account.enabled, updatedAt: Date.now() });
}

async function removeAccount(account: UserSocialAccount) {
  if (!window.confirm(`解绑「${account.displayName}」？当前角色将无法再查询此账号。`)) return;
  const remainingCharacterIds = account.characterIds.filter((id) => id !== props.characterId);
  if (remainingCharacterIds.length) await operations.saveUserAccount({ ...account, characterIds: remainingCharacterIds, updatedAt: Date.now() });
  else await operations.deleteUserAccount(account.id);
  if (lookup.accountId === account.id) {
    lookup.accountId = '';
    lookup.query = '';
    lookupResult.value = '';
  }
}

function selectForLookup(account: UserSocialAccount) {
  lookup.accountId = account.id;
  lookup.action = account.capabilities[0] ?? 'profile';
  lookup.query = account.accountId;
  lookupResult.value = '';
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

async function lookupAccount() {
  lookupResult.value = '';
  lookupRunning.value = true;
  try {
    const result = await executeUserSocialLookup({
      settings: props.settings,
      account: selectedLookupAccount.value,
      characterId: props.characterId,
      action: lookup.action,
      query: lookup.query
    });
    notify(result.summary, result.ok ? 'success' : 'error');
    if (result.text) lookupResult.value = result.text.slice(0, 8_000);
  } finally {
    lookupRunning.value = false;
  }
}

function notify(message: string, kind: 'success' | 'error' = 'success') {
  lookupNotice.value = message;
  lookupNoticeKind.value = kind;
}

watch(compatibleServers, (servers) => {
  if (!servers.some((server) => server.id === form.serverId)) syncServer();
}, { immediate: true });

watch(availableLookupActions, (actions) => {
  if (!actions.includes(lookup.action)) lookup.action = actions[0] ?? 'profile';
});
</script>

<style scoped>
.user-social-accounts-panel {
  display: grid;
  gap: 13px;
}

.user-social-accounts-panel,
.user-social-accounts-panel *,
.user-social-accounts-panel *::before,
.user-social-accounts-panel *::after {
  box-sizing: border-box;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.section-heading > div { display: grid; gap: 3px; }
.section-heading h2,
.section-heading span { margin: 0; }

.scope-hint {
  margin: 0;
  padding: 11px 12px;
  font-size: 11px;
  line-height: 1.6;
}

.operation-form {
  display: grid;
  gap: 11px;
  padding: 15px;
}

.operation-form label {
  display: grid;
  gap: 7px;
  font-size: 10px;
  font-weight: 850;
}

.form-hint { margin: 0; font-size: 10px; line-height: 1.55; }

.primary-button {
  min-height: 43px;
  border: 0;
  color: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
}

.primary-button:disabled { opacity: .55; }

.account-list { display: grid; gap: 8px; }

.account-card {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 13px;
}

.account-card > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.account-card strong,
.account-card small,
.account-card em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-card strong { font-size: 12px; }
.account-card small { font-size: 10px; }
.account-card em { font-size: 9px; font-style: normal; }
.account-card button { min-height: 32px; border: 0; font: inherit; font-size: 10px; font-weight: 850; }

.user-lookup-box {
  display: grid;
  gap: 12px;
  padding: 15px;
}

.user-lookup-box > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.user-lookup-box > header > div { display: grid; gap: 2px; }
.user-lookup-box h3 { margin: 0; }

.lookup-notice,
.manual-safety-note {
  margin: 0;
  padding: 11px;
  font-size: 10px;
  line-height: 1.6;
}

.lookup-result {
  overflow: auto;
  max-height: 260px;
  margin: 0;
  padding: 11px;
  font: 10px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre-wrap;
}

.user-social-accounts-panel { gap: 13px; }
.section-heading { align-items: center; padding: 3px 4px 0; }
.section-heading span, .user-lookup-box > header span { color: #9b82ae; }
.section-heading h2, .user-lookup-box h3 { color: #4a3e57; font-family: Georgia, "Songti SC", serif; font-size: 19px; font-weight: 600; letter-spacing: -.04em; }
.header-actions { display: flex; gap: 6px; }
.section-heading .header-actions button, .section-heading > button { border: 1px solid rgba(147, 122, 178, .17); border-radius: 999px; color: #7e669a; background: rgba(251,249,255,.84); padding: 7px 10px; font-size: 10px; box-shadow: 0 5px 10px rgba(93, 76, 119, .05); }
.scope-hint { border: 1px solid rgba(143, 119, 172, .12); border-radius: 18px; color: #756184; background: linear-gradient(135deg, rgba(244,240,253,.94), rgba(252,247,252,.92)); box-shadow: none; }
.account-card { border: 1px solid rgba(146, 119, 171, .11); border-radius: 20px; background: rgba(255,255,255,.73); box-shadow: 0 9px 19px rgba(87, 69, 108, .055); }
.account-card strong { color: #4e405a; }
.account-card small { color: #92838f; }
.account-card em { color: #7f6998; }
.account-card button { border-radius: 11px; color: #806797; background: #f6f1fb; padding: 6px 7px; }
.account-card .danger-text { color: #bb6575; background: #fff3f5; }
.platform-xiaohongshu { color: #c8667d; background: #ffebef; }
.platform-douyin { color: #776baa; background: #eeebfb; }
.user-lookup-box { border-color: rgba(142, 119, 170, .12); border-radius: 23px; background: linear-gradient(145deg, rgba(248,246,254,.94), rgba(255,251,253,.95)); box-shadow: 0 10px 22px rgba(85, 68, 105, .055); }
.user-lookup-box > header > svg { color: #9b7dae; }
.operation-form { border: 1px solid rgba(151, 123, 169, .13); border-radius: 20px; background: rgba(255,253,254,.92); box-shadow: none; }
.operation-form label { color: #83727f; }
.operation-form select, .operation-form input, .operation-form textarea { box-sizing: border-box; width: 100%; min-height: 39px; padding: 10px 11px; border: 1px solid rgba(164, 132, 157, .19); border-radius: 13px; color: #50424d; background: #fffdfd; font: inherit; outline: none; }
.operation-form textarea { resize: vertical; line-height: 1.55; }
.operation-form select:focus, .operation-form input:focus, .operation-form textarea:focus { border-color: #c98da6; box-shadow: 0 0 0 3px rgba(201, 141, 166, .13); }
.primary-button { border-radius: 14px; background: linear-gradient(135deg, #a978a1, #806ba4); box-shadow: 0 10px 17px rgba(122, 93, 148, .17); }
.manual-safety-note { margin: 0; padding: 11px; border: 1px solid rgba(192, 123, 147, .15); border-radius: 14px; color: #926676; background: #fff4f7; font-size: 10px; line-height: 1.6; }
.lookup-notice.success { color: #766293; background: #f1ecfa; }
.lookup-notice.error { color: #a95363; background: #fff0f3; }
.lookup-result { border: 1px solid rgba(144, 118, 170, .1); border-radius: 15px; color: #5d5068; background: #f6f3fb; }
</style>