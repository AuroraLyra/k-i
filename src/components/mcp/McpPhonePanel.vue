<template>
  <section class="mcp-view mcp-phone-view">
    <article class="mcp-hero-card mcp-phone-hero">
      <div class="mcp-phone-art" aria-hidden="true">
        <span><Smartphone :size="31" stroke-width="1.5" /></span>
        <i class="app-dot dot-calendar"><CalendarDays :size="14" /></i>
        <i class="app-dot dot-map"><MapPinned :size="14" /></i>
        <i class="app-dot dot-contact"><ContactRound :size="14" /></i>
        <i class="app-dot dot-weather"><CloudSun :size="14" /></i>
      </div>
      <div class="mcp-hero-copy">
        <p>On this phone</p>
        <h1>真实系统能力</h1>
        <span>不需要地址或密钥。首次使用时，权限由手机系统亲自向你确认。</span>
      </div>
      <span class="mcp-ready-pill"><CheckCircle2 :size="13" /> BUILT IN</span>
    </article>

    <section class="mcp-permission-panel" aria-label="手机系统权限">
      <header class="mcp-section-title compact">
        <div><span>PHONE ACCESS</span><h2>手机系统权限</h2></div>
        <button type="button" :disabled="requestingPermission" @click="requestAllPermissions">授权常规权限</button>
      </header>
      <p>通知、日历、通讯录和位置会依次由系统确认；“使用情况访问”和“通知使用权”是 Android 特殊权限，会跳转系统设置。</p>
      <div class="mcp-permission-list">
        <article v-for="permission in permissions" :key="permission.id" class="mcp-permission-row">
          <span><strong>{{ permission.label }}</strong><small>{{ permission.detail }}</small></span>
          <em :class="`state-${permission.status}`">{{ permissionStatusLabel(permission.status) }}</em>
          <button type="button" :disabled="requestingPermission || permission.status === 'unsupported'" @click="requestPermission(permission.id)">{{ permission.actionLabel }}</button>
        </article>
      </div>
      <p v-if="permissionFeedback" class="mcp-permission-feedback" :class="permissionFeedbackKind">{{ permissionFeedback }}</p>
    </section>

    <nav class="mcp-filter-tabs" aria-label="手机能力分类">
      <button v-for="category in categories" :key="category.id" :class="{ active: activeCategory === category.id }" type="button" @click="activeCategory = category.id">
        {{ category.label }} <small>{{ categoryCount(category.id) }}</small>
      </button>
    </nav>

    <section v-for="group in visibleGroups" :key="group.id" class="mcp-capability-group">
      <header class="mcp-section-title compact">
        <div><span>{{ group.kicker }}</span><h2>{{ group.title }}</h2></div>
        <small>{{ group.items.length }} tools</small>
      </header>
      <div class="mcp-capability-list">
        <article v-for="item in group.items" :key="item.name" class="mcp-capability-row">
          <span class="mcp-capability-icon" :class="`tone-${group.tone}`"><component :is="item.icon" :size="18" stroke-width="1.9" /></span>
          <span class="mcp-capability-copy"><strong>{{ item.title }}</strong><small>{{ item.description }}</small></span>
          <span class="mcp-permission-chip" :class="item.write ? 'action' : 'read'">{{ item.write ? '会执行操作' : '只读查询' }}</span>
          <span class="mcp-switch small"><input :checked="item.enabled" type="checkbox" @change="emit('set-tool', item.name, checked($event))"><i></i></span>
        </article>
      </div>
    </section>

    <article class="mcp-safety-note">
      <span><ShieldCheck :size="19" /></span>
      <div><strong>权限仍由系统掌握</strong><p>BabyLink 不会绕过系统授权，也不能读取其他 App 的私有页面。iOS 不开放第三方创建系统时钟闹钟。</p></div>
    </article>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, type Component } from 'vue';
import { BarChart3, BellRing, CalendarDays, CheckCircle2, Clipboard, ClipboardPaste, CloudSun, ContactRound, FileText, Globe2, LocateFixed, MapPinned, MessageCircle, Navigation, Newspaper, PhoneCall, Search, Settings2, ShieldCheck, ShoppingBasket, Smartphone, Volume2, Vibrate } from 'lucide-vue-next';
import type { McpToolDefinition } from '@/types/domain';
import { getRealityMcpPermissionStatus, requestAllRealityMcpPermissions, requestRealityMcpPermission, type RealityPermissionId, type RealityPermissionStatus } from '@/services/realityMcp';

type CategoryId = 'all' | 'online' | 'device' | 'productivity' | 'places' | 'communication';

const props = defineProps<{ tools: McpToolDefinition[] }>();
const emit = defineEmits<{ 'set-tool': [toolName: string, enabled: boolean] }>();
const activeCategory = ref<CategoryId>('all');
const permissions = ref<RealityPermissionStatus[]>([]);
const requestingPermission = ref(false);
const permissionFeedback = ref('');
const permissionFeedbackKind = ref<'success' | 'error'>('success');

const categories: { id: CategoryId; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'online', label: '联网' },
  { id: 'productivity', label: '效率' },
  { id: 'places', label: '出行' },
  { id: 'communication', label: '通讯' },
  { id: 'device', label: '设备' }
];

const toolPresentation: Record<string, { category: Exclude<CategoryId, 'all'>; icon: Component }> = {
  get_device_status: { category: 'device', icon: Smartphone },
  get_app_usage_access: { category: 'device', icon: BarChart3 },
  request_app_usage_access: { category: 'device', icon: Settings2 },
  get_app_usage: { category: 'device', icon: BarChart3 },
  get_app_usage_report: { category: 'device', icon: BarChart3 },
  get_notification_inbox_access: { category: 'device', icon: BellRing },
  request_notification_inbox_access: { category: 'device', icon: Settings2 },
  get_notification_inbox: { category: 'device', icon: BellRing },
  clear_notification_inbox: { category: 'device', icon: BellRing },
  prepare_date_plan: { category: 'places', icon: MapPinned },
  prepare_trip_plan: { category: 'places', icon: Navigation },
  prepare_shopping_plan: { category: 'productivity', icon: ShoppingBasket },
  prepare_study_session: { category: 'productivity', icon: BarChart3 },
  prepare_watch_together: { category: 'productivity', icon: CalendarDays },
  get_nightly_brief: { category: 'productivity', icon: CloudSun },
  set_cooking_timer: { category: 'productivity', icon: BellRing },
  add_music_to_queue: { category: 'communication', icon: Volume2 },
  notify_user: { category: 'device', icon: BellRing },
  speak_to_user: { category: 'device', icon: Volume2 },
  vibrate_phone: { category: 'device', icon: Vibrate },
  set_reminder: { category: 'productivity', icon: BellRing },
  list_reminders: { category: 'productivity', icon: BellRing },
  update_reminder: { category: 'productivity', icon: BellRing },
  complete_reminder: { category: 'productivity', icon: CheckCircle2 },
  snooze_reminder: { category: 'productivity', icon: BellRing },
  cancel_reminder: { category: 'productivity', icon: BellRing },
  create_calendar_event: { category: 'productivity', icon: CalendarDays },
  get_calendar_events: { category: 'productivity', icon: CalendarDays },
  update_calendar_event: { category: 'productivity', icon: CalendarDays },
  delete_calendar_event: { category: 'productivity', icon: CalendarDays },
  check_calendar_conflicts: { category: 'productivity', icon: CalendarDays },
  find_calendar_free_time: { category: 'productivity', icon: CalendarDays },
  create_memo: { category: 'productivity', icon: FileText },
  list_memos: { category: 'productivity', icon: FileText },
  pick_contact: { category: 'communication', icon: ContactRound },
  search_contacts: { category: 'communication', icon: Search },
  create_contact: { category: 'communication', icon: ContactRound },
  set_alarm: { category: 'productivity', icon: BellRing },
  get_current_location: { category: 'places', icon: LocateFixed },
  get_live_news: { category: 'online', icon: Newspaper },
  search_web: { category: 'online', icon: Globe2 },
  read_web_page: { category: 'online', icon: FileText },
  read_clipboard_text: { category: 'device', icon: ClipboardPaste },
  analyze_clipboard: { category: 'device', icon: ClipboardPaste },
  write_clipboard_text: { category: 'device', icon: Clipboard },
  get_weather: { category: 'places', icon: CloudSun },
  search_nearby_places: { category: 'places', icon: MapPinned },
  open_map_route: { category: 'places', icon: Navigation },
  open_amap: { category: 'places', icon: MapPinned },
  open_mobile_app: { category: 'communication', icon: Settings2 },
  open_real_world_service: { category: 'communication', icon: PhoneCall }
};

const groupMetadata = {
  online: { id: 'online', kicker: 'WEB & NEWS', title: '联网与资讯', tone: 'violet' },
  productivity: { id: 'productivity', kicker: 'LIFE ADMIN', title: '日程与效率', tone: 'rose' },
  places: { id: 'places', kicker: 'PLACES', title: '地点与出行', tone: 'amber' },
  communication: { id: 'communication', kicker: 'PEOPLE & APPS', title: '通讯与应用', tone: 'blue' },
  device: { id: 'device', kicker: 'DEVICE', title: '设备与提醒', tone: 'mint' }
} as const;

const presentedTools = computed(() => props.tools.map((tool) => ({
  ...tool,
  category: toolPresentation[tool.name]?.category ?? 'device',
  icon: toolPresentation[tool.name]?.icon ?? MessageCircle
})));

const visibleGroups = computed(() => Object.values(groupMetadata).flatMap((metadata) => {
  if (activeCategory.value !== 'all' && metadata.id !== activeCategory.value) return [];
  const items = presentedTools.value.filter((tool) => tool.category === metadata.id);
  return items.length ? [{ ...metadata, items }] : [];
}));

function categoryCount(category: CategoryId) {
  return category === 'all' ? presentedTools.value.length : presentedTools.value.filter((tool) => tool.category === category).length;
}

function checked(event: Event) { return (event.target as HTMLInputElement).checked; }

function permissionStatusLabel(status: RealityPermissionStatus['status']) {
  return {
    granted: '已授权',
    denied: '未授权',
    prompt: '待授权',
    available: '可授权',
    unsupported: '不支持',
    unknown: '待检查'
  }[status];
}

async function refreshPermissions() {
  permissions.value = await getRealityMcpPermissionStatus();
}

async function requestPermission(id: RealityPermissionId) {
  if (requestingPermission.value) return;
  requestingPermission.value = true;
  permissionFeedback.value = '';
  try {
    const result = await requestRealityMcpPermission(id);
    const unsupported = 'unsupported' in result && result.unsupported === true;
    const granted = 'granted' in result ? result.granted : undefined;
    const awaitingUser = 'awaitingUser' in result && result.awaitingUser === true;
    permissionFeedbackKind.value = unsupported || granted === false ? 'error' : 'success';
    permissionFeedback.value = awaitingUser
      ? '已打开系统设置，请允许 BabyLink 后返回此页重新检查。'
      : granted === false
        ? '系统没有授予该权限；请在系统设置中允许 BabyLink 后重试。'
        : '系统权限请求已完成。';
  } catch (error) {
    permissionFeedbackKind.value = 'error';
    permissionFeedback.value = error instanceof Error ? error.message : '系统权限请求失败。';
  } finally {
    requestingPermission.value = false;
    await refreshPermissions();
  }
}

async function requestAllPermissions() {
  if (requestingPermission.value) return;
  requestingPermission.value = true;
  permissionFeedback.value = '';
  try {
    const results = await requestAllRealityMcpPermissions();
    const denied = results.filter((result) => ('granted' in result && result.granted === false) || ('unsupported' in result && result.unsupported === true)).length;
    permissionFeedbackKind.value = denied ? 'error' : 'success';
    permissionFeedback.value = denied
      ? `常规权限请求已结束，${denied} 项未获授权；可逐项重新请求或到系统设置允许。`
      : '常规手机权限请求已完成。Android 特殊权限请在下方单独打开系统设置。';
  } catch (error) {
    permissionFeedbackKind.value = 'error';
    permissionFeedback.value = error instanceof Error ? error.message : '批量权限请求失败。';
  } finally {
    requestingPermission.value = false;
    await refreshPermissions();
  }
}

onMounted(() => void refreshPermissions());

</script>

<style scoped>
.mcp-permission-panel {
  margin: 14px 0 18px;
  padding: 16px;
  border: 1px solid rgba(108, 88, 156, 0.14);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 12px 28px rgba(85, 66, 109, 0.07);
}

.mcp-permission-panel .mcp-section-title button,
.mcp-permission-row button {
  border: 0;
  border-radius: 999px;
  padding: 7px 9px;
  color: #fff;
  background: #7663b5;
  font: inherit;
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
}

.mcp-permission-panel .mcp-section-title button:disabled,
.mcp-permission-row button:disabled {
  opacity: 0.48;
}

.mcp-permission-panel > p {
  margin: 8px 0 12px;
  color: #746c7a;
  font-size: 12px;
  line-height: 1.55;
}

.mcp-permission-list {
  display: grid;
  gap: 8px;
}

.mcp-permission-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 7px;
  padding: 10px;
  border-radius: 14px;
  background: rgba(246, 244, 251, 0.86);
}

.mcp-permission-row span {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.mcp-permission-row small {
  color: #807786;
  font-size: 11px;
  line-height: 1.35;
}

.mcp-permission-row em {
  padding: 4px 6px;
  border-radius: 999px;
  color: #7663b5;
  background: #ede9fb;
  font-size: 9px;
  font-style: normal;
  white-space: nowrap;
}

.mcp-permission-row em.state-granted { color: #23835d; background: #dbf4e8; }
.mcp-permission-row em.state-denied { color: #b1495f; background: #fae6eb; }
.mcp-permission-row em.state-unsupported { color: #817989; background: #ece9ee; }
.mcp-permission-feedback.success { color: #23835d; }
.mcp-permission-feedback.error { color: #b1495f; }

@media (max-width: 430px) {
  .mcp-permission-row { padding: 9px; }
  .mcp-permission-row small { font-size: 10px; }
}

@media (max-width: 280px) {
  .mcp-permission-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
  }

  .mcp-permission-row > span { grid-column: 1 / -1; }
}
</style>
