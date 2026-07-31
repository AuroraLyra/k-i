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
        <article v-for="item in group.items" :key="item.name" class="mcp-capability-row" :class="{ disabled: !item.enabled }">
          <span class="mcp-capability-icon" :class="`tone-${group.tone}`"><component :is="item.icon" :size="18" stroke-width="1.9" /></span>
          <span class="mcp-capability-copy"><strong>{{ item.title }}</strong><small>{{ item.description }}</small></span>
          <span class="mcp-permission-chip" :class="item.enabled ? (item.write ? 'action' : 'read') : 'off'">{{ item.enabled ? (item.write ? '操作' : '读取') : '已关闭' }}</span>
          <label class="phone-tool-switch" :aria-label="`${item.enabled ? '停用' : '启用'}${item.title}`">
            <input :checked="item.enabled" type="checkbox" @change="emit('set-tool', item.name, checked($event))" />
            <i></i>
          </label>
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
import { computed, ref, type Component } from 'vue';
import { BarChart3, BellRing, CalendarDays, CheckCircle2, Clipboard, ClipboardPaste, CloudSun, ContactRound, FileText, Globe2, LocateFixed, MapPinned, MessageCircle, Navigation, Newspaper, PhoneCall, Search, Settings2, Share2, ShieldCheck, ShoppingBasket, Smartphone, Volume2, Vibrate } from 'lucide-vue-next';
import type { McpToolDefinition } from '@/types/domain';

type CategoryId = 'all' | 'online' | 'device' | 'productivity' | 'places' | 'communication';

const props = defineProps<{ tools: McpToolDefinition[] }>();
const emit = defineEmits<{ 'set-tool': [toolName: string, enabled: boolean] }>();
const activeCategory = ref<CategoryId>('all');

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
  create_memo: { category: 'productivity', icon: Share2 },
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

function checked(event: Event) {
  return (event.target as HTMLInputElement).checked;
}
</script>

<style scoped>
.mcp-capability-row:has(.phone-tool-switch input:not(:checked)) { opacity: 0.58; }
</style>
