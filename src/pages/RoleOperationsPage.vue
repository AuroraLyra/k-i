<template>
  <section class="screen no-tabs role-operations-page">
    <header class="top-bar role-operations-topbar">
      <button class="icon-button" type="button" aria-label="返回服务中心" @click="goBack"><ChevronLeft :size="22" /></button>
      <div><p>OUR LITTLE STUDIO</p><h1>两个人的运营空间</h1></div>
      <button class="icon-button" type="button" aria-label="刷新待办" :disabled="runningDue" @click="runDueTasks"><RefreshCw :size="18" :class="{ spinning: runningDue }" /></button>
    </header>

    <main class="role-operations-content">
      <section class="role-operations-hero">
        <div class="hero-orbit hero-orbit-left"></div>
        <div class="hero-orbit hero-orbit-right"></div>
        <div class="hero-copy">
          <span>PRIVATE SOCIAL SPACE</span>
          <h2>把两个身份，<br>放进同一片小宇宙。</h2>
          <p>角色负责创作，你决定每一次对外发送。</p>
        </div>
        <div class="hero-pair" aria-hidden="true"><span class="hero-avatar hero-avatar-user">YOU</span><span class="hero-heart">♥</span><span class="hero-avatar hero-avatar-role">{{ selectedCharacter?.nickname?.slice(0, 1) || selectedCharacter?.name?.slice(0, 1) || 'TA' }}</span></div>
      </section>

      <label class="character-picker">
        <span>运营角色</span>
        <select v-model="selectedCharacterId">
          <option v-for="character in appStore.characters" :key="character.id" :value="character.id">{{ character.nickname || character.name }}</option>
        </select>
      </label>

      <template v-if="selectedCharacter">
        <nav class="desk-tabs" aria-label="运营功能">
          <button type="button" :class="{ active: activeTab === 'space' }" @click="activeTab = 'space'"><Sparkles :size="15" /><span>空间</span></button>
          <button type="button" :class="{ active: activeTab === 'role' }" @click="activeTab = 'role'"><Heart :size="15" /><span>角色</span></button>
          <button type="button" :class="{ active: activeTab === 'user' }" @click="activeTab = 'user'"><UserRound :size="15" /><span>我的账号</span></button>
          <button type="button" :class="{ active: activeTab === 'tasks' }" @click="activeTab = 'tasks'"><ListChecks :size="15" /><span>待办</span></button>
        </nav>

        <p v-if="notice" class="operation-notice desk-notice" :class="noticeKind">{{ notice }}</p>

        <section v-show="activeTab === 'space'" class="couple-overview" aria-label="情侣运营概览">
          <div class="overview-intro"><span>TONIGHT'S LITTLE PLAN</span><h2>和 {{ selectedCharacter.nickname || selectedCharacter.name }} 一起，把心意留在刚刚好的一刻。</h2><p>所有角色写入先经过你的规则；你的账号始终只由你亲自操作。</p></div>
          <section class="status-strip" aria-label="角色运营概览">
          <span><strong>{{ selectedAccounts.length }}</strong><small>角色账号</small></span>
          <i></i>
          <span><strong>{{ waitingTasks.length }}</strong><small>待处理任务</small></span>
          <i></i>
          <span><strong>{{ successfulToday }}</strong><small>今日已执行</small></span>
          </section>
          <div class="moment-actions">
            <button type="button" class="moment-card moment-card-role" @click="activeTab = 'role'; accountFormOpen = true"><span><Plus :size="17" /></span><strong>给 TA 绑定创作账号</strong><small>角色账号可进入审核队列</small></button>
            <button type="button" class="moment-card moment-card-user" @click="activeTab = 'user'"><span><Search :size="17" /></span><strong>看看我的社交足迹</strong><small>授权 TA 仅查询公开内容</small></button>
          </div>
          <article class="space-promise"><span><ShieldCheck :size="18" /></span><div><strong>这是你们的私密工作台</strong><p>不保存 Cookie 或密码；用户账号不会成为角色的自动写入来源。</p></div></article>
        </section>

        <section v-show="activeTab === 'role'" class="operations-section role-pane">
          <header class="section-heading"><div><span>ROLE ACCOUNTS</span><h2>角色账号 · 可写入</h2></div><button type="button" @click="accountFormOpen = !accountFormOpen">{{ accountFormOpen ? '收起' : '绑定角色账号' }}</button></header>
          <p class="account-scope-hint">这里绑定的是角色自己的平台账号。只有它可以进入点赞、评论、发帖和私信任务；用户账号不会出现在这里。</p>

          <AppModal v-model="accountFormOpen" title="绑定角色账号" eyebrow="ROLE ACCOUNT · WRITE WITH APPROVAL" variant="ins">
          <form class="operation-form account-form" @submit.prevent="createAccount">
            <label>平台<select v-model="accountForm.platform" @change="syncAccountServer"><option value="xiaohongshu">小红书</option><option value="douyin">抖音</option><option value="qq">QQ</option><option value="system-share">系统分享</option></select></label>
            <label>账号展示名<input v-model.trim="accountForm.displayName" maxlength="36" placeholder="例如：阿岚的小红书" required></label>
            <label>账号 ID / 备注<input v-model.trim="accountForm.accountId" maxlength="80" placeholder="只记录展示 ID，不填写 Cookie 或密码"></label>
            <label v-if="accountForm.platform !== 'system-share'">写入连接<select v-model="accountForm.serverId" required><option value="" disabled>选择已在 MCP 中配对的连接</option><option v-for="server in currentSettings.mcpSettings.servers" :key="server.id" :value="server.id">{{ server.name }} · {{ server.lastStatus === 'connected' ? '在线' : '待检测' }}</option></select></label>
            <p class="form-hint">{{ accountHint }}</p>
            <button class="primary-button" type="submit">保存角色账号</button>
          </form>
          </AppModal>

          <div v-if="selectedAccounts.length" class="account-list">
            <article v-for="account in selectedAccounts" :key="account.id" class="account-card">
              <span class="platform-icon" :class="`platform-${account.platform}`"><component :is="platformIcon(account.platform)" :size="18" /></span>
              <div><strong>{{ account.displayName }}</strong><small>{{ platformLabel(account.platform) }} · {{ account.accountId || '未记录账号 ID' }}</small><em>{{ accountCapabilityText(account) }}</em></div>
              <button type="button" @click="toggleAccount(account)">{{ account.enabled ? '暂停' : '恢复' }}</button>
              <button class="danger-text" type="button" @click="removeAccount(account)">解绑</button>
            </article>
          </div>
          <p v-else class="empty-card">先绑定角色自己的平台账号。小红书、抖音和 QQ 的写入连接必须实际提供对应写工具。</p>
        </section>

        <UserSocialAccountsPanel v-show="activeTab === 'user'" :character-id="selectedCharacter.id" :character-name="selectedCharacter.nickname || selectedCharacter.name" :user-id="currentSettings.activeUserId" :settings="currentSettings" />

        <section v-show="activeTab === 'role'" class="operations-section compose-pane">
          <header class="section-heading"><div><span>COMPOSE</span><h2>草稿与发送</h2></div><button type="button" @click="clearComposer">新建</button></header>
          <form class="operation-form composer-form" @submit.prevent="queueTask">
            <label>使用账号<select v-model="composer.accountId" required><option value="" disabled>选择角色账号</option><option v-for="account in selectedAccounts.filter((entry) => entry.enabled)" :key="account.id" :value="account.id">{{ account.displayName }} · {{ platformLabel(account.platform) }}</option></select></label>
            <label>操作<select v-model="composer.action" required><option v-for="action in availableActions" :key="action" :value="action">{{ actionLabel(action) }}</option></select></label>
            <label v-if="composer.action === 'publish'">标题<input v-model.trim="composer.title" maxlength="60" placeholder="发布标题"></label>
            <label v-if="composer.action !== 'like'">正文<textarea v-model="composer.body" rows="4" maxlength="2000" :placeholder="bodyPlaceholder"></textarea></label>
            <label>分享链接 / 图片 URL<input v-model.trim="composer.linkUrl" type="url" placeholder="https://…（可选）"></label>
            <label v-if="needsRecipient">{{ recipientLabel }}<input v-model.trim="composer.recipient" maxlength="100" :placeholder="recipientPlaceholder" :required="needsRecipient"></label>
            <label v-if="selectedComposerAccount?.platform === 'qq' && needsRecipient">收件类型<select v-model="composer.recipientType"><option value="private">QQ 私聊</option><option value="group">QQ群</option></select></label>
            <label v-if="selectedComposerAccount?.platform === 'system-share' && composer.action === 'share-to-user'">发送到 BabyLink 会话<select v-model="composer.conversationId"><option value="">打开系统分享面板</option><option v-for="conversation in characterConversations" :key="conversation.id" :value="conversation.id">{{ conversationTitle(conversation.id) }}</option></select></label>
            <label>计划时间<input v-model="composer.scheduledAt" type="datetime-local"></label>
            <div class="composer-actions"><button class="soft-button" type="button" @click="saveDraft">存为草稿</button><button class="primary-button" type="submit">{{ queueButtonLabel }}</button></div>
          </form>

          <div v-if="selectedDrafts.length" class="draft-list">
            <button v-for="draft in selectedDrafts.slice(0, 4)" :key="draft.id" type="button" @click="useDraft(draft)"><span><FileText :size="16" /></span><div><strong>{{ draft.title || draft.body || '未命名草稿' }}</strong><small>{{ platformLabel(draft.platform) }} · {{ formatTime(draft.updatedAt) }}</small></div><ChevronRight :size="16" /></button>
          </div>
        </section>

        <section v-show="activeTab === 'tasks'" class="operations-section task-pane">
          <header class="section-heading"><div><span>QUEUE</span><h2>审核与队列</h2></div><small>{{ waitingTasks.length }} 项</small></header>
          <div v-if="selectedTasks.length" class="task-list">
            <article v-for="task in selectedTasks.slice(0, 12)" :key="task.id" class="task-card" :class="`task-${task.status}`">
              <span class="task-state"><component :is="taskIcon(task.status)" :size="17" /></span>
              <div class="task-copy"><strong>{{ actionLabel(task.action) }} · {{ platformLabel(task.platform) }}</strong><p>{{ task.title || task.body || task.linkUrl || '无正文' }}</p><small>{{ taskStatusLabel(task.status) }}<template v-if="task.scheduledAt"> · {{ formatTime(task.scheduledAt) }}</template><template v-if="task.errorSummary"> · {{ task.errorSummary }}</template></small></div>
              <div class="task-actions">
                <button v-if="task.status === 'awaiting-approval'" type="button" @click="approveTask(task)">确认</button>
                <button v-else-if="['draft', 'scheduled', 'failed', 'blocked'].includes(task.status)" type="button" :disabled="task.status === 'scheduled' && Boolean(task.scheduledAt && task.scheduledAt > Date.now())" @click="executeTask(task)">执行</button>
                <button v-if="!['succeeded', 'cancelled'].includes(task.status)" class="danger-text" type="button" @click="cancelTask(task)">取消</button>
              </div>
            </article>
          </div>
          <p v-else class="empty-card">这里会显示待确认、定时、失败重试和已完成的运营任务。</p>
        </section>

        <section v-show="activeTab === 'tasks'" class="operations-section policy-section">
          <header class="section-heading"><div><span>POLICY</span><h2>自动化边界</h2></div><button type="button" @click="savePolicy">保存策略</button></header>
          <div class="policy-toggle"><div><strong>暂停全部运营</strong><small>暂停后所有外部写入均被拦截</small></div><label class="toggle"><input v-model="policyForm.paused" type="checkbox"><span></span></label></div>
          <label>执行方式<select v-model="policyForm.approvalMode"><option value="always">每一条都需要我确认</option><option value="trusted-auto">仅白名单内可自动执行</option></select></label>
          <div class="policy-grid"><label>每小时上限<input v-model.number="policyForm.maxWritesPerHour" type="number" min="1" max="60"></label><label>每日上限<input v-model.number="policyForm.maxWritesPerDay" type="number" min="1" max="240"></label></div>
          <div class="policy-grid"><label>静默开始<input v-model="policyForm.quietHoursStart" type="time"></label><label>静默结束<input v-model="policyForm.quietHoursEnd" type="time"></label></div>
          <label>可信收件人（逗号分隔）<input v-model="policyForm.recipientAllowlist" placeholder="QQ 号、平台用户 ID"></label>
          <label>拦截词（逗号分隔）<input v-model="policyForm.blockedKeywords" placeholder="出现这些词时必须拦截"></label>
        </section>

        <section v-show="activeTab === 'tasks'" class="operations-section audit-pane">
          <header class="section-heading"><div><span>AUDIT</span><h2>最近审计</h2></div><small>不记录凭据</small></header>
          <div v-if="selectedAudits.length" class="audit-list"><article v-for="audit in selectedAudits.slice(0, 8)" :key="audit.id"><span :class="`audit-${audit.status}`"><component :is="audit.status === 'succeeded' || audit.status === 'shared' ? CheckCircle2 : audit.status === 'failed' || audit.status === 'blocked' ? CircleAlert : Clock3" :size="15" /></span><div><strong>{{ actionLabel(audit.action) }} · {{ audit.summary }}</strong><small>{{ formatTime(audit.createdAt) }}</small></div></article></div>
          <p v-else class="empty-card">确认、阻止、执行与失败都会记录在这里，内容与令牌不会被写入审计。</p>
        </section>
      </template>
      <p v-else class="empty-card role-operations-empty">还没有可运营的角色。请先在 Add 页面创建或导入角色，再回来分别绑定角色自己的账号和用户自己的查询账号。</p>
    </main>
  </section>
</template>

<script setup lang="ts">
import { CircleAlert, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileText, Heart, ListChecks, MessageCircle, Plus, RefreshCw, Search, ShieldCheck, Smartphone, Sparkles, UserRound, Video } from 'lucide-vue-next';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import AppModal from '@/components/common/AppModal.vue';
import UserSocialAccountsPanel from '@/components/role-operations/UserSocialAccountsPanel.vue';
import { defaultSettings } from '@/data/seed';
import { useAppStore } from '@/stores/appStore';
import { useRoleOperationsStore } from '@/stores/roleOperationsStore';
import { createDefaultRoleOperationPolicy, createRoleContentDraft, createRoleOutboundTask, executeRoleOperation, nextTaskStatusAfterApproval, operationAudit, suggestedAccountCapabilities } from '@/services/roleOperations';
import type { RoleContentDraft, RoleOperationPolicy, RoleOperationTaskStatus, RoleOutboundAction, RoleOutboundTask, RoleSocialAccount, RoleSocialPlatform } from '@/types/roleOperations';
import { createId } from '@/utils/id';

const router = useRouter();
const appStore = useAppStore();
const operations = useRoleOperationsStore();
const selectedCharacterId = ref('');
const activeTab = ref<'space' | 'role' | 'user' | 'tasks'>('space');
const accountFormOpen = ref(false);
const runningDue = ref(false);
const busyTaskIds = ref(new Set<string>());
const notice = ref('');
const noticeKind = ref<'success' | 'error'>('success');
let visibilityListener: (() => void) | null = null;

const accountForm = reactive({ platform: 'xiaohongshu' as RoleSocialPlatform, displayName: '', accountId: '', serverId: '' });
const composer = reactive({ accountId: '', action: 'publish' as RoleOutboundAction, title: '', body: '', linkUrl: '', recipient: '', recipientType: 'private' as RoleOutboundTask['recipientType'], conversationId: '', scheduledAt: '' });
const policyForm = reactive({ paused: false, approvalMode: 'always' as RoleOperationPolicy['approvalMode'], maxWritesPerHour: 6, maxWritesPerDay: 24, quietHoursStart: '23:00', quietHoursEnd: '08:00', recipientAllowlist: '', blockedKeywords: '' });

const selectedCharacter = computed(() => appStore.characters.find((character) => character.id === selectedCharacterId.value) ?? null);
const currentSettings = computed(() => appStore.settings ?? defaultSettings);
const selectedAccounts = computed(() => selectedCharacter.value ? operations.accountsForCharacter(selectedCharacter.value.id) : []);
const selectedDrafts = computed(() => selectedCharacter.value ? operations.draftsForCharacter(selectedCharacter.value.id) : []);
const selectedTasks = computed(() => selectedCharacter.value ? operations.tasksForCharacter(selectedCharacter.value.id) : []);
const characterConversations = computed(() => selectedCharacter.value ? appStore.conversations.filter((conversation) => conversation.charId === selectedCharacter.value?.id && conversation.kind !== 'group') : []);
const selectedAudits = computed(() => selectedCharacter.value ? operations.auditsForCharacter(selectedCharacter.value.id) : []);
const waitingTasks = computed(() => selectedTasks.value.filter((task) => !['succeeded', 'cancelled'].includes(task.status)));
const successfulToday = computed(() => selectedAudits.value.filter((audit) => (audit.status === 'succeeded' || audit.status === 'shared') && audit.createdAt > Date.now() - 24 * 60 * 60 * 1000).length);
const selectedComposerAccount = computed(() => selectedAccounts.value.find((account) => account.id === composer.accountId) ?? null);
const accountHint = computed(() => accountForm.platform === 'system-share'
  ? '系统分享会在你点击执行时打开手机或浏览器分享面板，不会自动发送。'
  : '请先在 MCP Studio 配对电脑 Bridge。这里不收集、不保存 Cookie、密码或平台令牌。');
const availableActions = computed<RoleOutboundAction[]>(() => {
  const account = selectedComposerAccount.value;
  if (!account) return ['publish', 'comment', 'direct-message', 'share-to-user'];
  return account.capabilities.filter((capability): capability is RoleOutboundAction => ['like', 'publish', 'comment', 'direct-message', 'share-to-user'].includes(capability));
});
const needsRecipient = computed(() => ['like', 'comment', 'direct-message', 'share-to-user'].includes(composer.action));
const recipientLabel = computed(() => composer.action === 'like' || composer.action === 'comment' ? '目标内容 ID' : composer.action === 'share-to-user' && selectedComposerAccount.value?.platform === 'system-share' ? '收件人备注（可选）' : '收件人 ID');
const recipientPlaceholder = computed(() => composer.action === 'like' || composer.action === 'comment' ? '笔记 / 视频 ID' : selectedComposerAccount.value?.platform === 'qq' ? 'QQ 号或群号' : '平台用户 ID');
const bodyPlaceholder = computed(() => composer.action === 'publish' ? '写下角色要发布的内容…' : composer.action === 'comment' ? '写下要发表的评论…' : '写下要发送或分享的内容…');
const queueButtonLabel = computed(() => currentPolicy.value?.approvalMode === 'always' ? '提交待确认' : composer.scheduledAt ? '加入计划队列' : '创建任务');
const currentPolicy = computed(() => selectedCharacter.value ? operations.policyForCharacter(selectedCharacter.value.id) : null);

function splitList(value: string) {
  return [...new Set(value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean))];
}

function notify(message: string, kind: 'success' | 'error' = 'success') {
  notice.value = message;
  noticeKind.value = kind;
}

function goBack() {
  void router.push({ name: 'services' });
}

function platformLabel(platform: RoleSocialPlatform) {
  return { xiaohongshu: '小红书', douyin: '抖音', qq: 'QQ', 'system-share': '系统分享' }[platform];
}

function platformIcon(platform: RoleSocialPlatform) {
  return platform === 'qq' ? MessageCircle : platform === 'douyin' ? Video : platform === 'system-share' ? Smartphone : FileText;
}

function actionLabel(action: RoleOutboundAction) {
  return { like: '点赞内容', publish: '发布内容', comment: '发表评论', 'direct-message': '发送私信', 'share-to-user': '分享给用户' }[action];
}

function taskStatusLabel(status: RoleOperationTaskStatus) {
  return { draft: '可执行', 'awaiting-approval': '等待确认', scheduled: '定时等待', running: '执行中', succeeded: '已完成', failed: '执行失败', cancelled: '已取消', blocked: '已拦截' }[status];
}

function taskIcon(status: RoleOperationTaskStatus) {
  return status === 'succeeded' ? CheckCircle2 : status === 'failed' || status === 'blocked' ? CircleAlert : status === 'awaiting-approval' ? ShieldCheck : Clock3;
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

function conversationTitle(conversationId: string) {
  const conversation = appStore.conversations.find((entry) => entry.id === conversationId);
  return conversation?.title || selectedCharacter.value?.nickname || '角色私聊';
}

function accountCapabilityText(account: RoleSocialAccount) {
  const labels: Record<RoleSocialAccount['capabilities'][number], string> = { like: '点赞内容', publish: '发布内容', comment: '发表评论', 'direct-message': '发送私信', 'share-to-user': '分享给用户', schedule: '定时发布', metrics: '创作数据' };
  return account.capabilities.length ? account.capabilities.map((capability) => labels[capability]).join(' · ') : '当前连接未发现可用写工具';
}

async function ensurePolicy(characterId: string) {
  const policy = operations.policyForCharacter(characterId) ?? createDefaultRoleOperationPolicy(characterId);
  if (!operations.policyForCharacter(characterId)) await operations.savePolicy(policy);
  Object.assign(policyForm, {
    paused: policy.paused,
    approvalMode: policy.approvalMode,
    maxWritesPerHour: policy.maxWritesPerHour,
    maxWritesPerDay: policy.maxWritesPerDay,
    quietHoursStart: policy.quietHoursStart,
    quietHoursEnd: policy.quietHoursEnd,
    recipientAllowlist: policy.recipientAllowlist.join(', '),
    blockedKeywords: policy.blockedKeywords.join(', ')
  });
}

function syncAccountServer() {
  const candidates = currentSettings.value.mcpSettings.servers.filter((server) => {
    if (accountForm.platform === 'qq') return server.kind === 'qq' || server.tools.some((tool) => tool.name.startsWith('qq_'));
    if (accountForm.platform === 'xiaohongshu') return server.kind === 'xiaohongshu' || server.tools.some((tool) => tool.name.startsWith('xhs_'));
    if (accountForm.platform === 'douyin') return server.kind === 'douyin-search' || server.tools.some((tool) => tool.name.startsWith('douyin_'));
    return false;
  });
  accountForm.serverId = candidates[0]?.id ?? '';
}

async function createAccount() {
  if (!selectedCharacter.value) return;
  const server = currentSettings.value.mcpSettings.servers.find((entry) => entry.id === accountForm.serverId) ?? null;
  if (accountForm.platform !== 'system-share' && !server) return notify('请先选择已经配对的 MCP 连接。', 'error');
  const now = Date.now();
  const account: RoleSocialAccount = {
    id: createId('role-account'),
    characterId: selectedCharacter.value.id,
    platform: accountForm.platform,
    displayName: accountForm.displayName || `${selectedCharacter.value.nickname || selectedCharacter.value.name}的${platformLabel(accountForm.platform)}`,
    accountId: accountForm.accountId,
    serverId: accountForm.serverId,
    enabled: true,
    status: server?.lastStatus === 'connected' ? 'connected' : 'unknown',
    capabilities: suggestedAccountCapabilities(accountForm.platform, server),
    lastCheckedAt: server?.lastCheckedAt ?? 0,
    lastError: server?.lastError ?? '',
    createdAt: now,
    updatedAt: now
  };
  await operations.saveAccount(account);
  accountForm.displayName = '';
  accountForm.accountId = '';
  accountFormOpen.value = false;
  composer.accountId = account.id;
  composer.action = account.capabilities.find((capability): capability is RoleOutboundAction => ['like', 'publish', 'comment', 'direct-message', 'share-to-user'].includes(capability)) ?? 'publish';
  notify('角色账号已保存。写入能力会以当前 MCP 连接实际返回的工具为准。');
}

async function toggleAccount(account: RoleSocialAccount) {
  await operations.saveAccount({ ...account, enabled: !account.enabled, updatedAt: Date.now() });
}

async function removeAccount(account: RoleSocialAccount) {
  if (!window.confirm(`解绑「${account.displayName}」？已有任务会保留为不可执行记录。`)) return;
  await operations.deleteAccount(account.id);
  if (composer.accountId === account.id) clearComposer();
}

function clearComposer() {
  Object.assign(composer, { accountId: selectedAccounts.value.find((account) => account.enabled)?.id ?? '', action: 'publish', title: '', body: '', linkUrl: '', recipient: '', recipientType: 'private', conversationId: '', scheduledAt: '' });
}

function scheduledTimestamp() {
  if (!composer.scheduledAt) return null;
  const timestamp = new Date(composer.scheduledAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function taskRecipientType(account: RoleSocialAccount | null): RoleOutboundTask['recipientType'] {
  if (composer.action === 'publish') return 'none';
  if (composer.action === 'like' || composer.action === 'comment') return 'note';
  if (account?.platform === 'system-share') return 'user';
  return composer.recipientType;
}

async function saveDraft() {
  if (!selectedCharacter.value || !selectedComposerAccount.value) return notify('请先选择角色账号。', 'error');
  const draft = createRoleContentDraft({
    characterId: selectedCharacter.value.id,
    accountId: selectedComposerAccount.value.id,
    platform: selectedComposerAccount.value.platform,
    title: composer.title,
    body: composer.body,
    mediaUrls: [],
    linkUrl: composer.linkUrl,
    source: 'manual',
    scheduledAt: scheduledTimestamp()
  });
  await operations.saveDraft(draft);
  notify('草稿已保存在本机。');
}

async function queueTask() {
  if (!selectedCharacter.value || !selectedComposerAccount.value) return notify('请先选择角色账号。', 'error');
  if (composer.action !== 'like' && !composer.body.trim() && !composer.linkUrl.trim()) return notify('请填写正文或分享链接。', 'error');
  if (needsRecipient.value && composer.action !== 'share-to-user' && !composer.recipient.trim()) return notify('请填写目标内容或收件人 ID。', 'error');
  const policy = currentPolicy.value ?? createDefaultRoleOperationPolicy(selectedCharacter.value.id);
  const task = createRoleOutboundTask({
    characterId: selectedCharacter.value.id,
    accountId: selectedComposerAccount.value.id,
    platform: selectedComposerAccount.value.platform,
    action: composer.action,
    title: composer.title,
    body: composer.body,
    mediaUrls: [],
    linkUrl: composer.linkUrl,
    recipient: composer.recipient,
    recipientType: taskRecipientType(selectedComposerAccount.value),
    ...(composer.conversationId ? { conversationId: composer.conversationId } : {}),
    scheduledAt: scheduledTimestamp()
  }, policy);
  await operations.saveTask(task);
  await operations.saveAudit(operationAudit(task, 'queued', task.status === 'awaiting-approval' ? '任务已创建，等待用户确认。' : '任务已进入可执行队列。'));
  notify(task.status === 'awaiting-approval' ? '已加入待确认队列。' : '任务已加入执行队列。');
  clearComposer();
}

function useDraft(draft: RoleContentDraft) {
  Object.assign(composer, { accountId: draft.accountId, action: 'publish', title: draft.title, body: draft.body, linkUrl: draft.linkUrl, recipient: '', recipientType: 'private', conversationId: '', scheduledAt: draft.scheduledAt ? new Date(draft.scheduledAt - new Date(draft.scheduledAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function approveTask(task: RoleOutboundTask) {
  const next = { ...task, status: nextTaskStatusAfterApproval(task), approvedAt: Date.now(), updatedAt: Date.now(), errorSummary: '' };
  await operations.saveTask(next);
  await operations.saveAudit(operationAudit(next, 'approved', '用户已确认该任务。'));
  if (next.status === 'draft') await executeTask(next);
  else notify('任务已确认，将在计划时间进入执行队列。');
}

async function executeTask(task: RoleOutboundTask) {
  if (busyTaskIds.value.has(task.id)) return;
  const account = operations.accounts.find((entry) => entry.id === task.accountId) ?? null;
  const policy = currentPolicy.value ?? createDefaultRoleOperationPolicy(task.characterId);
  busyTaskIds.value = new Set([...busyTaskIds.value, task.id]);
  const running = { ...task, status: 'running' as const, startedAt: Date.now(), updatedAt: Date.now(), errorSummary: '' };
  await operations.saveTask(running);
  await operations.saveAudit(operationAudit(running, 'started', '开始执行角色运营任务。'));
  try {
    const result = await executeRoleOperation({ settings: currentSettings.value, account, task: running, policy, audits: operations.auditsForCharacter(task.characterId), appendConversationEvent: appStore.appendConversationEvent });
    const now = Date.now();
    if (result.ok) {
      const completed = { ...running, status: 'succeeded' as const, completedAt: now, updatedAt: now, executionReference: result.reference, errorSummary: '' };
      await operations.saveTask(completed);
      await operations.saveAudit(operationAudit(completed, task.platform === 'system-share' ? 'shared' : 'succeeded', result.summary));
      notify(result.summary);
    } else {
      const blocked = result.check.error.includes('拦截') || result.check.error.includes('等待') || result.check.error.includes('上限') || result.check.error.includes('静默')
        ? 'blocked' as const
        : 'failed' as const;
      const next = { ...running, status: blocked, retryCount: running.retryCount + 1, updatedAt: now, errorSummary: result.summary };
      await operations.saveTask(next);
      await operations.saveAudit(operationAudit(next, blocked, result.summary));
      notify(result.summary, 'error');
    }
  } catch (error) {
    const next = { ...running, status: 'failed' as const, retryCount: running.retryCount + 1, updatedAt: Date.now(), errorSummary: error instanceof Error ? error.message : '执行失败。' };
    await operations.saveTask(next);
    await operations.saveAudit(operationAudit(next, 'failed', next.errorSummary));
    notify(next.errorSummary, 'error');
  } finally {
    busyTaskIds.value = new Set([...busyTaskIds.value].filter((id) => id !== task.id));
  }
}

async function cancelTask(task: RoleOutboundTask) {
  const next = { ...task, status: 'cancelled' as const, updatedAt: Date.now() };
  await operations.saveTask(next);
  await operations.saveAudit(operationAudit(next, 'cancelled', '用户已取消该任务。'));
}

async function runDueTasks() {
  if (runningDue.value || !selectedCharacter.value) return;
  runningDue.value = true;
  try {
    const now = Date.now();
    const due = selectedTasks.value.filter((task) => task.platform !== 'system-share' && ['draft', 'scheduled'].includes(task.status) && (!task.scheduledAt || task.scheduledAt <= now)).slice(0, 4);
    for (const task of due) await executeTask(task);
    if (!due.length) notify('暂时没有到期的可执行任务。');
  } finally {
    runningDue.value = false;
  }
}

async function savePolicy() {
  if (!selectedCharacter.value) return;
  const policy: RoleOperationPolicy = {
    characterId: selectedCharacter.value.id,
    paused: policyForm.paused,
    approvalMode: policyForm.approvalMode,
    maxWritesPerHour: Math.min(60, Math.max(1, Number(policyForm.maxWritesPerHour) || 6)),
    maxWritesPerDay: Math.min(240, Math.max(1, Number(policyForm.maxWritesPerDay) || 24)),
    quietHoursStart: policyForm.quietHoursStart,
    quietHoursEnd: policyForm.quietHoursEnd,
    recipientAllowlist: splitList(policyForm.recipientAllowlist),
    topicAllowlist: [],
    blockedKeywords: splitList(policyForm.blockedKeywords),
    maxRetries: 1,
    updatedAt: Date.now()
  };
  await operations.savePolicy(policy);
  notify('角色运营策略已保存。');
}

watch(selectedCharacterId, async (characterId) => {
  if (!characterId) return;
  await ensurePolicy(characterId);
  clearComposer();
});

watch(availableActions, (actions) => {
  if (!actions.includes(composer.action)) composer.action = actions[0] ?? 'publish';
});

onMounted(async () => {
  await operations.ensureReady();
  selectedCharacterId.value = appStore.characters[0]?.id ?? '';
  if (selectedCharacterId.value) await ensurePolicy(selectedCharacterId.value);
  clearComposer();
  visibilityListener = () => {
    if (document.visibilityState === 'visible') void runDueTasks();
  };
  document.addEventListener('visibilitychange', visibilityListener);
  void runDueTasks();
});

onBeforeUnmount(() => {
  if (visibilityListener) document.removeEventListener('visibilitychange', visibilityListener);
});
</script>

<style scoped>
.role-operations-page {
  display: block;
  min-height: 100%;
  overflow: auto;
}

.role-operations-page,
.role-operations-page *,
.role-operations-page *::before,
.role-operations-page *::after {
  box-sizing: border-box;
}

.role-operations-topbar {
  position: sticky;
  top: 0;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 40px;
  align-items: center;
  gap: 10px;
  backdrop-filter: blur(18px);
}

.role-operations-topbar div { min-width: 0; }
.role-operations-topbar p,
.role-operations-topbar h1 { margin: 0; }

.icon-button {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 0;
}

.spinning { animation: role-operations-spin .9s linear infinite; }
@keyframes role-operations-spin { to { transform: rotate(360deg); } }

.role-operations-content {
  display: grid;
  width: 100%;
}

.role-operations-hero { display: grid; gap: 12px; }

.character-picker,
.operation-form label,
.policy-section > label {
  display: grid;
  gap: 7px;
  font-size: 10px;
  font-weight: 850;
}

.role-operations-page select,
.role-operations-page input,
.role-operations-page textarea {
  width: 100%;
  min-width: 0;
  padding: 10px 11px;
  border: 1px solid transparent;
  outline: 0;
  font: inherit;
}

.role-operations-page textarea { resize: vertical; }

.operation-notice {
  margin: 0;
  padding: 11px 12px;
  font-size: 11px;
  line-height: 1.55;
}

.operation-notice.success { color: #766293; background: #f1ecfa; }
.operation-notice.error { color: #ac5267; background: #fff0f3; }

.status-strip {
  display: grid;
  grid-template-columns: 1fr 1px 1fr 1px 1fr;
  align-items: center;
  min-height: 98px;
  padding: 12px;
}

.status-strip > span {
  display: grid;
  justify-items: center;
  gap: 5px;
  text-align: center;
}

.status-strip > i { width: 1px; height: 46px; }

.operations-section,
.account-list,
.task-list,
.audit-list,
.draft-list {
  display: grid;
  gap: 10px;
}

.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 10px;
}

.section-heading > div { display: grid; gap: 2px; }
.section-heading h2,
.section-heading span,
.section-heading small { margin: 0; }

.operation-form {
  display: grid;
  gap: 11px;
  padding: 14px;
}

.form-hint,
.empty-card {
  margin: 0;
  padding: 12px;
  font-size: 10px;
  line-height: 1.55;
}

.composer-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.primary-button,
.soft-button,
.section-heading button,
.account-card button,
.task-actions button {
  min-height: 38px;
  padding: 0 12px;
  border: 0;
  font: inherit;
  font-weight: 850;
}

.account-card {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.platform-icon,
.task-state {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
}

.account-card > div,
.task-copy,
.audit-list article > div,
.draft-list button > div {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.account-card strong,
.task-copy strong,
.draft-list strong,
.audit-list strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-card small,
.account-card em,
.task-copy p,
.task-copy small,
.draft-list small,
.audit-list small {
  margin: 0;
  font-size: 9px;
  font-style: normal;
  line-height: 1.45;
}

.danger-text { color: #b4536d !important; }

.draft-list button {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  padding: 9px;
  text-align: left;
}

.draft-list button > span {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
}

.task-card {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.task-actions {
  display: grid;
  justify-items: end;
  gap: 6px;
}

.task-actions button:disabled { opacity: .48; }

.policy-section {
  display: grid;
  gap: 12px;
  padding: 15px;
}

.policy-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid transparent;
}

.policy-toggle > div { display: grid; gap: 3px; }
.policy-toggle small { font-size: 9px; }
.toggle { position: relative; display: block; width: 40px; height: 24px; flex: none; }
.toggle input { position: absolute; opacity: 0; }
.toggle span { position: absolute; inset: 0; border-radius: 999px; background: #ddd4da; transition: background .18s; }
.toggle span::after { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 3px 8px rgba(54, 41, 48, .18); content: ''; transition: transform .18s; }
.toggle input:checked + span { background: #bd7b91; }
.toggle input:checked + span::after { transform: translateX(16px); }

.policy-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }

.audit-list article {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  padding: 10px;
}

.audit-list article > span { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 10px; }
.audit-list .audit-succeeded,
.audit-list .audit-shared { color: #4f9270; background: #e9f7ee; }
.audit-list .audit-failed,
.audit-list .audit-blocked { color: #b25c72; background: #ffeff3; }

@media (max-width: 350px) {
  .account-card,
  .task-card { grid-template-columns: 34px minmax(0, 1fr); }
  .account-card .danger-text { display: none; }
  .task-actions { grid-column: 2; justify-items: start; display: flex; }
}

.role-operations-page {
  --ink: #3d3341;
  --muted: #95858d;
  --lavender: #b8a2c5;
  --blush: #f7e4e8;
  --paper: #fffafb;
  background:
    radial-gradient(circle at 11% 9%, rgba(255, 205, 218, .58), transparent 24%),
    radial-gradient(circle at 96% 34%, rgba(203, 194, 232, .42), transparent 27%),
    linear-gradient(180deg, #fff8fa 0%, #f9f7fc 54%, #f1f3fa 100%);
}

.role-operations-topbar {
  z-index: 7;
  padding: 14px 16px 13px;
  border-bottom: 1px solid rgba(117, 87, 100, .08);
  background: rgba(255, 250, 252, .76);
  box-shadow: 0 5px 20px rgba(101, 76, 86, .035);
}

.role-operations-topbar p { color: #b07e90; }
.role-operations-topbar h1 { color: var(--ink); font-family: Georgia, "Songti SC", serif; font-size: 18px; font-weight: 650; letter-spacing: -.04em; }
.icon-button { border: 1px solid rgba(156, 126, 139, .13); border-radius: 50%; color: #725b66; background: rgba(255,255,255,.72); box-shadow: 0 6px 15px rgba(89, 65, 76, .06); }
.role-operations-content { gap: 13px; padding: 14px 16px calc(34px + var(--safe-bottom)); }

.role-operations-hero {
  position: relative;
  isolation: isolate;
  grid-template-columns: minmax(0, 1fr) 112px;
  min-height: 163px;
  overflow: hidden;
  padding: 20px;
  border: 1px solid rgba(255,255,255,.78);
  border-radius: 30px;
  color: var(--ink);
  background: linear-gradient(136deg, #f9e9ec 0%, #f8edf2 49%, #e5e1f0 100%);
  box-shadow: 0 18px 38px rgba(112, 82, 100, .13);
}

.hero-copy { position: relative; z-index: 2; align-self: center; }
.role-operations-hero .hero-copy > span { color: #a77789; font-size: 9px; font-weight: 950; letter-spacing: .15em; opacity: 1; }
.role-operations-hero h2 { max-width: 215px; margin: 7px 0 0; font-family: Georgia, "Songti SC", serif; font-size: 23px; font-weight: 650; letter-spacing: -.055em; line-height: 1.18; }
.role-operations-hero p { max-width: 215px; margin-top: 8px; color: #795e68; font-size: 10px; line-height: 1.55; opacity: .9; }
.hero-orbit { position: absolute; z-index: -1; border-radius: 50%; border: 1px solid rgba(255,255,255,.54); }
.hero-orbit-left { width: 205px; height: 205px; top: -122px; left: -70px; }
.hero-orbit-right { width: 174px; height: 174px; right: -73px; bottom: -92px; background: rgba(213, 197, 230, .22); }
.hero-pair { position: relative; z-index: 2; align-self: center; width: 104px; height: 90px; }
.hero-avatar { position: absolute; display: grid; place-items: center; width: 57px; height: 57px; overflow: hidden; border: 3px solid rgba(255,255,255,.85); border-radius: 50%; color: #fff; font-size: 9px; font-weight: 950; letter-spacing: .06em; box-shadow: 0 8px 18px rgba(98, 71, 91, .16); }
.hero-avatar-user { top: 5px; left: 4px; background: linear-gradient(145deg, #e698ac, #bf7d94); }
.hero-avatar-role { right: 2px; bottom: 5px; background: linear-gradient(145deg, #9d8abf, #76669d); }
.hero-heart { position: absolute; z-index: 3; top: 39px; left: 43px; display: grid; place-items: center; width: 26px; height: 26px; border: 2px solid #fff; border-radius: 50%; color: #d97891; background: #fff9fa; font-size: 13px; box-shadow: 0 4px 10px rgba(116, 80, 92, .12); }

.character-picker { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 10px; padding: 10px 13px; border: 1px solid rgba(157, 122, 138, .11); border-radius: 17px; background: rgba(255,255,255,.68); box-shadow: none; }
.character-picker > span { color: #a5818f; font-size: 9px; letter-spacing: .1em; }
.character-picker select { min-height: 32px; padding: 0 0 0 8px; border: 0; border-left: 1px solid rgba(167, 130, 144, .13); border-radius: 0; color: var(--ink); background: transparent; box-shadow: none; font-size: 12px; }

.desk-tabs { position: sticky; top: 67px; z-index: 6; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 5px; border: 1px solid rgba(147, 117, 130, .1); border-radius: 18px; background: rgba(255, 251, 252, .84); box-shadow: 0 10px 22px rgba(98, 70, 83, .06); backdrop-filter: blur(18px); }
.desk-tabs button { display: grid; justify-items: center; gap: 3px; min-height: 44px; padding: 5px 2px; border: 0; border-radius: 13px; color: #9b8990; background: transparent; font-size: 9px; font-weight: 850; }
.desk-tabs button.active { color: #9d5c73; background: linear-gradient(135deg, #fff0f4, #f3effa); box-shadow: 0 4px 10px rgba(138, 101, 125, .08); }
.desk-notice { margin: 0; border-radius: 15px; box-shadow: 0 8px 18px rgba(99, 73, 82, .05); }

.couple-overview { display: grid; gap: 12px; }
.overview-intro { padding: 5px 3px 1px; }
.overview-intro span { color: #b48c99; font-size: 9px; font-weight: 950; letter-spacing: .13em; }
.overview-intro h2 { margin: 6px 0; color: var(--ink); font-family: Georgia, "Songti SC", serif; font-size: 20px; font-weight: 600; letter-spacing: -.05em; line-height: 1.35; }
.overview-intro p { margin: 0; color: #87757d; font-size: 11px; line-height: 1.65; }
.status-strip { border: 1px solid rgba(157, 126, 139, .1); border-radius: 21px; background: rgba(255,255,255,.72); box-shadow: 0 10px 24px rgba(109, 81, 94, .055); }
.status-strip strong { color: #735a78; font-family: Georgia, "Songti SC", serif; font-size: 21px; }
.status-strip small { color: #9b8b92; }
.status-strip i { background: rgba(167, 137, 151, .16); }
.moment-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.moment-card { display: grid; align-content: start; gap: 4px; min-height: 126px; padding: 14px; border: 1px solid rgba(255,255,255,.82); border-radius: 23px; text-align: left; }
.moment-card > span { display: grid; place-items: center; width: 32px; height: 32px; margin-bottom: 3px; border-radius: 12px; }
.moment-card strong { color: var(--ink); font-size: 12px; line-height: 1.35; }
.moment-card small { color: #907e86; font-size: 9px; line-height: 1.45; }
.moment-card-role { background: linear-gradient(145deg, #fff5f6, #f5e9ee); box-shadow: 0 11px 22px rgba(167, 111, 132, .09); }
.moment-card-role > span { color: #c06881; background: #fce1e9; }
.moment-card-user { background: linear-gradient(145deg, #faf9ff, #ecebf8); box-shadow: 0 11px 22px rgba(110, 98, 159, .08); }
.moment-card-user > span { color: #7c72ab; background: #e7e4f7; }
.space-promise { display: grid; grid-template-columns: 33px minmax(0, 1fr); gap: 10px; align-items: start; padding: 14px; border: 1px dashed rgba(159, 121, 139, .25); border-radius: 19px; background: rgba(255,250,252,.52); }
.space-promise > span { display: grid; place-items: center; width: 31px; height: 31px; border-radius: 11px; color: #9b7182; background: #f8e8ed; }
.space-promise strong { color: #66525a; font-size: 11px; }
.space-promise p { margin: 3px 0 0; color: #9b898f; font-size: 10px; line-height: 1.55; }

.operations-section { gap: 12px; }
.section-heading { padding: 3px 4px 0; }
.section-heading span { color: #b18b9a; }
.section-heading h2 { color: var(--ink); font-family: Georgia, "Songti SC", serif; font-size: 19px; font-weight: 600; letter-spacing: -.04em; }
.section-heading button { border: 1px solid rgba(191, 133, 152, .18); border-radius: 999px; color: #a46178; background: rgba(255,251,253,.76); padding: 7px 10px; font-size: 10px; box-shadow: 0 5px 10px rgba(113, 75, 91, .05); }
.account-scope-hint, .empty-card { border: 1px solid rgba(170, 136, 149, .11); border-radius: 18px; background: rgba(255,255,255,.65); color: #8d777f; box-shadow: none; }
.role-pane .account-scope-hint { color: #9d6878; background: linear-gradient(135deg, rgba(255,240,244,.88), rgba(249,244,252,.86)); }
.operation-form { border: 1px solid rgba(165, 128, 143, .13); border-radius: 20px; background: rgba(255,253,254,.88); box-shadow: 0 10px 23px rgba(102, 73, 86, .06); }
.operation-form label, .policy-section > label { color: #89767e; }
select, input, textarea { border-color: rgba(169, 136, 149, .18); border-radius: 13px; color: #504149; background: #fffdfd; }
select:focus, input:focus, textarea:focus { border-color: #d58da4; box-shadow: 0 0 0 3px rgba(214, 141, 164, .13); }
.primary-button { border-radius: 14px; background: linear-gradient(135deg, #b86c86, #9b759f); box-shadow: 0 10px 17px rgba(163, 94, 122, .18); }
.soft-button { border-radius: 14px; border-color: rgba(183, 127, 148, .19); color: #9f6075; background: #fff8fa; }
.account-card, .task-card { border: 1px solid rgba(162, 128, 142, .1); border-radius: 20px; background: rgba(255,255,255,.75); box-shadow: 0 9px 19px rgba(105, 76, 90, .05); }
.account-card { padding: 14px; }
.account-card strong, .task-card strong { color: #51424a; }
.account-card small, .task-card small { color: #97858c; }
.account-card em { color: #a26b80; }
.account-card button, .task-actions button { border-radius: 11px; color: #a36178; background: #fff4f7; }
.platform-icon { border-radius: 13px; }
.platform-xiaohongshu { color: #c9687d; background: #ffe9ee; }
.platform-douyin { color: #786bad; background: #eeebfb; }
.platform-qq { color: #6c91bb; background: #eaf3fb; }
.platform-system-share { color: #85918d; background: #edf2ef; }
.compose-pane { padding-top: 5px; }
.draft-list button { border-radius: 17px; border-color: rgba(165, 130, 145, .1); background: rgba(255,255,255,.67); }
.draft-list button > span { color: #b26982; background: #fbe8ed; }
.task-card { padding: 13px; }
.task-state { border-radius: 12px; color: #aa6b80; background: #fbe9ee; }
.policy-section { border: 1px solid rgba(165, 130, 145, .1); border-radius: 23px; background: linear-gradient(145deg, rgba(255,248,250,.83), rgba(245,243,251,.83)); box-shadow: 0 9px 20px rgba(104, 75, 90, .04); }
.policy-toggle { border-color: rgba(162, 128, 142, .12); }
.audit-list article { border-color: rgba(162, 128, 142, .1); background: rgba(255,255,255,.66); }
.role-operations-empty { margin-top: 35px; }

@media (min-width: 560px) {
  .role-operations-content { width: min(100%, 520px); margin: 0 auto; }
}
</style>
