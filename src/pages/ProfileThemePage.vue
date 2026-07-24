<template>
  <section v-if="conversation && character" class="screen no-tabs profile-theme-page profile-theme-ins-view">
    <header class="top-bar profile-theme-topbar">
      <button class="profile-theme-title-button" type="button" aria-label="返回聊天" @click="goBack">
        <h1 class="top-title">Profile Themes</h1>
      </button>
      <div class="profile-theme-header-actions">
        <button class="header-action-button" type="button" aria-label="主页清理设置" title="主页清理" @click="openHomepageCleanupSettings">
          <SlidersHorizontal :size="18" stroke-width="2.4" />
        </button>
        <button class="header-action-button" type="button" aria-label="分享主页主题" title="分享主页主题" @click="openExporter">
          <Share2 :size="18" stroke-width="2.4" />
        </button>
        <button class="header-action-button" type="button" aria-label="新增主页主题" title="新增主页主题" @click="openCreator">
          <Plus :size="18" stroke-width="2.4" />
        </button>
      </div>
    </header>

    <main class="profile-theme-main">
      <section class="profile-theme-panel">
        <section v-if="activeTab === 'themes'" class="profile-theme-section theme-library-section" aria-label="主页主题管理">
          <header class="profile-theme-section-head theme-library-head">
            <div>
              <p class="section-kicker">Theme Library</p>
              <h2>主题管理</h2>
              <p class="theme-library-intro">收藏角色主页的每一种氛围。</p>
            </div>
            <span class="section-count theme-library-count">
              <strong>{{ enabledThemes.length }}</strong>
              <small>of {{ themes.length }} active</small>
            </span>
          </header>

          <div v-if="themes.length" class="theme-library-grid">
            <article
              v-for="(theme, index) in themes"
              :key="theme.id"
              class="profile-theme-card"
              :class="{ disabled: !theme.enabled }"
              role="button"
              tabindex="0"
              @click="openEditTheme(theme)"
              @keydown.enter.prevent="openEditTheme(theme)"
              @keydown.space.prevent="openEditTheme(theme)"
            >
              <span class="theme-card-number">{{ formatThemeSequence(index) }}</span>
              <div class="theme-copy">
                <small>{{ theme.builtIn ? 'Original theme' : theme.source === 'imported' ? 'Imported archive' : 'Personal archive' }}</small>
                <strong>{{ theme.name }}</strong>
                <span class="theme-card-meta">
                  {{ countPromptLines(theme.prompt) }} lines
                  <i></i>
                  {{ theme.enabled ? 'In rotation' : 'Paused' }}
                </span>
              </div>
              <button class="theme-switch" :class="{ active: theme.enabled }" type="button" role="switch" :aria-label="`${theme.name}随机生成`" :aria-checked="theme.enabled" @click.stop="toggleTheme(theme)">
                <span></span>
              </button>
              <span class="theme-card-open" aria-hidden="true"><ArrowUpRight :size="15" stroke-width="2" /></span>
            </article>
          </div>

          <section v-else class="profile-theme-empty theme-library-empty">
            <div class="theme-library-empty-art" aria-hidden="true"><Sparkles :size="23" stroke-width="1.6" /></div>
            <p class="theme-library-empty-kicker">Build your collection</p>
            <h2>收藏第一种氛围</h2>
            <p>新增主题后，角色回复时会从启用的收藏里随机选择并更新主页。</p>
            <button type="button" @click="openCreator">新增主题</button>
          </section>
        </section>

        <section v-else class="profile-theme-section homepage-archive-section" aria-label="生成主页时间轴">
          <header class="profile-theme-section-head homepage-archive-head">
            <div>
              <p class="section-kicker">Private Archive</p>
              <h2>生成主页</h2>
              <p class="homepage-archive-intro">每一次回应，都是主页新的一页。</p>
            </div>
            <span class="section-count homepage-archive-count">
              <strong>{{ homepages.length }}</strong>
              <small>entries</small>
            </span>
          </header>

          <div v-if="homepages.length" class="homepage-timeline">
            <article v-for="(homepage, index) in homepages" :key="homepage.id" class="homepage-timeline-item">
              <div class="homepage-timeline-stamp" aria-hidden="true">
                <span>{{ formatHomepageMonth(homepage.updatedAt || homepage.createdAt) }}</span>
                <strong>{{ formatHomepageDay(homepage.updatedAt || homepage.createdAt) }}</strong>
                <i></i>
              </div>
              <div class="homepage-record-card">
                <button class="homepage-record-main" type="button" @click="openHomepagePreview(homepage.id)">
                  <span class="homepage-record-copy">
                    <small>PAGE {{ formatHomepageSequence(index) }}</small>
                    <strong>{{ homepage.themeName }}</strong>
                    <em>{{ homepagePreviewText(homepage) }}</em>
                  </span>
                  <span class="homepage-record-footer">
                    <time>{{ formatHomepageClock(homepage.updatedAt || homepage.createdAt) }}</time>
                    <span class="homepage-record-open">View homepage <ArrowUpRight :size="14" stroke-width="2" /></span>
                  </span>
                </button>
                <button class="homepage-record-delete" type="button" aria-label="删除生成主页" title="删除" @click="deleteHomepage(homepage.id)">
                  <Trash2 :size="15" stroke-width="2" />
                </button>
              </div>
            </article>
          </div>

          <section v-else class="profile-theme-empty homepage-timeline-empty">
            <div class="homepage-empty-art" aria-hidden="true">
              <span><Sparkles :size="22" stroke-width="1.6" /></span>
            </div>
            <p class="homepage-empty-kicker">Your story starts here</p>
            <h2>等待第一张主页</h2>
            <p>开启自定义主题后，每次线上回复生成的主页，都会按时间收进这本私人档案。</p>
            <button type="button" @click="setActiveTab('themes')">去开启主题</button>
          </section>
        </section>
      </section>
    </main>

    <nav class="profile-theme-bottom-tabs" aria-label="主页自定义页面切换">
      <button type="button" :class="{ active: activeTab === 'themes' }" @click="setActiveTab('themes')">
        <ListChecks :size="20" />
        <span>主题管理</span>
      </button>
      <button type="button" :class="{ active: activeTab === 'homepages' }" @click="setActiveTab('homepages')">
        <PanelsTopLeft :size="20" />
        <span>生成主页</span>
      </button>
    </nav>

    <AppModal v-model="showEditor" title="编辑主页主题" eyebrow="PROFILE ARCHIVE" variant="profile-theme">
      <form class="profile-theme-editor" @submit.prevent="submitEditor">
        <label>
          <span>主题名称</span>
          <input v-model="themeDraft.name" maxlength="36" placeholder="例如：小红书、微博、Mood" />
        </label>
        <label>
          <span>跟随正文生成的提示词</span>
          <textarea v-model="themeDraft.prompt" maxlength="12000" rows="7" placeholder="写清楚希望模型生成什么主页资料内容。"></textarea>
        </label>
        <label>
          <span>正则提取（可选）</span>
          <input v-model="themeDraft.regex" placeholder="例如：\\s*([\\s\\S]+)$" />
        </label>
        <label>
          <span>主页代码</span>
          <textarea v-model="themeDraft.code" maxlength="24000" rows="12" spellcheck="false" placeholder="写完整角色主页 HTML，可在顶部加入 <style>...</style>。支持 {{content}}、{{lines}}、{{title}}。"></textarea>
        </label>
        <label class="theme-editor-switch">
          <input v-model="themeDraft.enabled" type="checkbox" />
          <span>加入随机生成池</span>
        </label>
        <div class="theme-editor-actions" :class="{ editing: canDeleteEditingTheme }">
          <button v-if="canDeleteEditingTheme" class="danger" type="button" @click="deleteEditingTheme">删除</button>
          <button class="secondary" type="button" @click="showEditor = false">取消</button>
          <button class="primary" type="submit">保存</button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showCreator" title="添加主页主题" :show-header="false" fixed-height variant="profile-theme">
      <form class="profile-theme-editor profile-theme-creator" @submit.prevent="submitCreator">
        <section class="composer-hero">
          <span class="composer-avatar"><component :is="creatorTab === 'theme' ? Plus : Upload" :size="26" /></span>
          <div>
            <span>Profile Theme</span>
            <strong>{{ creatorTab === 'theme' ? '新增主页主题' : 'PNG 导入' }}</strong>
            <p>{{ creatorTab === 'theme' ? '填写提示词、正则和完整主页代码，保存为全局共用主页主题。' : '选择别人分享的 LINK 主页主题 PNG。' }}</p>
          </div>
        </section>

        <nav class="composer-tabs" aria-label="主页主题添加方式">
          <button class="composer-tab" :class="{ active: creatorTab === 'theme' }" type="button" @click="creatorTab = 'theme'">新增主页主题</button>
          <button class="composer-tab" :class="{ active: creatorTab === 'png' }" type="button" @click="creatorTab = 'png'">导入 PNG</button>
        </nav>

        <section v-if="creatorTab === 'theme'" class="composer-section profile-theme-editor-fields">
          <label>
            <span>主题名称</span>
            <input v-model="themeDraft.name" maxlength="36" placeholder="例如：小红书、微博、Mood" />
          </label>
          <label>
            <span>跟随正文生成的提示词</span>
            <textarea v-model="themeDraft.prompt" maxlength="12000" rows="7" placeholder="写清楚希望模型生成什么主页资料内容。"></textarea>
          </label>
          <label>
            <span>正则提取（可选）</span>
            <input v-model="themeDraft.regex" placeholder="例如：\\s*([\\s\\S]+)$" />
          </label>
          <label>
            <span>主页代码</span>
            <textarea v-model="themeDraft.code" maxlength="24000" rows="12" spellcheck="false" placeholder="写完整角色主页 HTML，可在顶部加入 <style>...</style>。支持 {{content}}、{{lines}}、{{title}}。"></textarea>
          </label>
          <label class="theme-editor-switch">
            <input v-model="themeDraft.enabled" type="checkbox" />
            <span>加入随机生成池</span>
          </label>
        </section>

        <section v-else class="composer-section">
          <button class="file-drop-card" type="button" @click="choosePngFile">
            <Upload :size="18" />
            <strong>选择 PNG 主题图片</strong>
            <span>{{ selectedPngFile ? selectedPngFile.name : '导入别人分享的主页主题' }}</span>
          </button>
          <input ref="pngInput" class="native-fallback-file-input" type="file" accept="image/png,.png" @change="selectPngFile" />
        </section>

        <p v-if="importError" class="sync-feedback error">{{ importError }}</p>
        <div class="profile-theme-modal-footer composer-footer">
          <button class="footer-button footer-cancel" type="button" @click="showCreator = false">取消</button>
          <button class="footer-button footer-save" type="submit" :disabled="importing">{{ importing ? '处理中...' : creatorTab === 'theme' ? '保存' : '导入' }}</button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showExporter" title="分享主页主题" :show-header="false" fixed-height variant="profile-theme">
      <section class="profile-theme-exporter style-export-composer">
        <section class="composer-hero">
          <span class="composer-avatar"><Share2 :size="26" /></span>
          <div>
            <span>Share Profile</span>
            <strong>导出 PNG</strong>
            <p>选择要分享的自定义主页主题，导出的 PNG 可被其他用户导入。</p>
          </div>
        </section>
        <section v-if="exportableThemes.length" class="export-theme-list export-preset-list">
          <label v-for="theme in exportableThemes" :key="theme.id" class="export-theme-item export-preset-item">
            <input v-model="selectedExportThemeIds" type="checkbox" :value="theme.id" />
            <span>
              <strong>{{ theme.name }}</strong>
              <small>{{ countPromptLines(theme.prompt) }} 行提示 · {{ theme.source === 'imported' ? '导入' : '自定义' }}</small>
            </span>
          </label>
        </section>
        <section v-else class="profile-theme-empty compact-empty">
          <strong>还没有可分享的自定义主题</strong>
          <p>默认 Mood 主题不需要分享，先新增或导入一个主题。</p>
        </section>
        <p v-if="exportError" class="sync-feedback error">{{ exportError }}</p>
        <div class="profile-theme-modal-footer composer-footer">
          <button class="footer-button footer-cancel" type="button" @click="showExporter = false">取消</button>
          <button class="footer-button footer-save" type="button" :disabled="exporting || !selectedExportThemeIds.length" @click="exportSelectedThemes">{{ exporting ? '导出中...' : '导出 PNG' }}</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showHomepagePreview" title="生成主页预览" :show-header="false" variant="profile-theme">
      <section v-if="selectedHomepage" class="homepage-preview-sheet">
        <div class="homepage-preview-body" :data-profile-theme-scope="homepageScopeId(selectedHomepage)" v-html="homepageHtml(selectedHomepage)"></div>
      </section>
    </AppModal>

    <AppModal v-model="showHomepageCleanupSettings" title="主页清理" eyebrow="PROFILE ARCHIVE" variant="profile-theme">
      <section class="homepage-cleanup-panel">
        <section class="cleanup-character-card single-character">
          <div class="cleanup-character-top">
            <div class="cleanup-character-head">
              <img :src="character.avatar" :alt="character.name || character.nickname" />
              <span>
                <strong>{{ character.name || character.nickname }}</strong>
                <small>{{ homepageCleanupSetting.enabled ? `${homepageCleanupSetting.days} 天前自动清理` : '自动清理已关闭' }}</small>
              </span>
            </div>
            <label class="cleanup-switch-card" :aria-label="`${character.name || character.nickname} 主页自动清理`">
              <input type="checkbox" :checked="homepageCleanupSetting.enabled" @change="updateHomepageCleanupEnabled" />
              <span class="cleanup-switch-track"></span>
            </label>
          </div>
          <div class="cleanup-compact-row character-row">
            <label class="cleanup-select-field">
              <span>早于</span>
              <select :value="homepageCleanupSetting.preset" @change="selectHomepageCleanupPresetFromEvent">
                <option v-for="option in cleanupPresetOptions" :key="`homepage-${option.preset}`" :value="option.preset">{{ option.label }}</option>
              </select>
            </label>
            <label v-if="homepageCleanupSetting.preset === 'custom'" class="cleanup-days-field">
              <input :value="homepageCleanupSetting.days" inputmode="numeric" min="1" max="3650" type="number" @change="updateHomepageCleanupCustomDays" />
              <span>天</span>
            </label>
            <button class="cleanup-text-action" type="button" :disabled="homepageCleanupRunning || !homepageCleanupCountForDays(homepageCleanupSetting.days)" @click="cleanupHomepageBySetting">清理</button>
          </div>
        </section>

        <section class="cleanup-manual-card">
          <div class="cleanup-section-head">
            <span>手动清理</span>
            <small>{{ manualHomepageCleanupCount }} 张可清理</small>
          </div>
          <div class="cleanup-compact-row">
            <label class="cleanup-select-field">
              <span>早于</span>
              <select :value="manualHomepageCleanupPreset" @change="setManualHomepageCleanupPresetFromEvent">
                <option v-for="option in cleanupPresetOptions" :key="`manual-homepage-${option.preset}`" :value="option.preset">{{ option.label }}</option>
              </select>
            </label>
            <label v-if="manualHomepageCleanupPreset === 'custom'" class="cleanup-days-field">
              <input v-model.number="manualHomepageCleanupCustomDays" inputmode="numeric" min="1" max="3650" type="number" />
              <span>天</span>
            </label>
            <button class="cleanup-text-action danger" type="button" :disabled="homepageCleanupRunning || !manualHomepageCleanupCount" @click="runManualHomepageCleanup">
              {{ homepageCleanupRunning ? '清理中' : '清理' }}
            </button>
          </div>
        </section>

        <p v-if="homepageCleanupNotice" class="cleanup-notice">{{ homepageCleanupNotice }}</p>
      </section>
    </AppModal>
  </section>

  <section v-else class="screen no-tabs profile-theme-page missing-profile-theme">
    <header class="top-bar profile-theme-topbar">
      <button class="profile-theme-title-button" type="button" aria-label="返回聊天" @click="goBack">
        <h1 class="top-title">Profile Themes</h1>
      </button>
    </header>
    <main class="profile-theme-main">
      <section class="profile-theme-empty">
        <h2>没有找到这段聊天</h2>
        <button type="button" @click="goBack">返回</button>
      </section>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowUpRight, ListChecks, PanelsTopLeft, Plus, Share2, SlidersHorizontal, Sparkles, Trash2, Upload } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import { pickNativePngFile, shareNativeDataUrl } from '@/services/nativeFile';
import { useAppStore } from '@/stores/appStore';
import type { CharacterProfileHomepageAutoCleanupSettings, ProfileHomepageAutoCleanupPreset, ProfileHomepageRecord, ProfileTheme } from '@/types/domain';
import { downloadDataUrl } from '@/utils/download';
import { composeProfileThemeCode, decodeProfileThemesFromPng, defaultCustomProfileThemeCode, defaultProfileThemePrompt, encodeProfileThemesToPng, renderProfileThemeHtml, scopeProfileThemeCss, splitProfileThemeCode } from '@/utils/profileThemes';

const props = defineProps<{ id: string }>();

const route = useRoute();
const router = useRouter();
const store = useAppStore();

type ProfileThemeTab = 'themes' | 'homepages';

const activeTab = ref<ProfileThemeTab>(normalizeProfileThemeTab(route.query.tab));
const showEditor = ref(false);
const showCreator = ref(false);
const showExporter = ref(false);
const showHomepagePreview = ref(false);
const showHomepageCleanupSettings = ref(false);
const creatorTab = ref<'theme' | 'png'>('theme');
const editingThemeId = ref('');
const selectedHomepageId = ref('');
const selectedPngFile = ref<File | null>(null);
const pngInput = ref<HTMLInputElement | null>(null);
const importError = ref('');
const exportError = ref('');
const importing = ref(false);
const exporting = ref(false);
const homepageCleanupRunning = ref(false);
const homepageCleanupNotice = ref('');
const manualHomepageCleanupPreset = ref<ProfileHomepageAutoCleanupPreset>('7');
const manualHomepageCleanupCustomDays = ref(14);
const selectedExportThemeIds = ref<string[]>([]);
let homepagePreviewStyleElement: HTMLStyleElement | null = null;

const cleanupPresetOptions: Array<{ preset: ProfileHomepageAutoCleanupPreset; label: string; days: number }> = [
  { preset: '3', label: '3天', days: 3 },
  { preset: '7', label: '7天', days: 7 },
  { preset: '30', label: '一个月', days: 30 },
  { preset: 'custom', label: '自定义', days: 14 }
];

const homepageMonthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
const homepageClockFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

const themeDraft = reactive({
  name: '',
  prompt: '',
  regex: '',
  code: '',
  enabled: true
});

const conversation = computed(() => store.conversationById(props.id));
const character = computed(() => conversation.value ? store.characterById(conversation.value.charId) : null);
const themes = computed(() => character.value ? store.profileThemesForCharacter(character.value.id) : []);
const homepages = computed(() => character.value ? store.profileHomepagesForCharacter(character.value.id) : []);
const enabledThemes = computed(() => themes.value.filter((theme) => theme.enabled));
const editingTheme = computed(() => editingThemeId.value ? themes.value.find((theme) => theme.id === editingThemeId.value) ?? null : null);
const canDeleteEditingTheme = computed(() => Boolean(editingTheme.value && !editingTheme.value.builtIn));
const exportableThemes = computed(() => themes.value.filter((theme) => !theme.builtIn));
const selectedHomepage = computed(() => selectedHomepageId.value ? homepages.value.find((homepage) => homepage.id === selectedHomepageId.value) ?? null : null);
const manualHomepageCleanupDays = computed(() => manualHomepageCleanupPreset.value === 'custom'
  ? normalizeHomepageCleanupDays(manualHomepageCleanupCustomDays.value)
  : Number(manualHomepageCleanupPreset.value)
);
const manualHomepageCleanupCount = computed(() => homepageCleanupCountForDays(manualHomepageCleanupDays.value));
const homepageCleanupSetting = computed(() => character.value ? homepageCleanupSettingForCharacter(character.value.id) : defaultHomepageCleanupSetting());

function normalizeProfileThemeTab(tab: unknown): ProfileThemeTab {
  return tab === 'themes' ? 'themes' : 'homepages';
}

onMounted(async () => {
  await store.hydrate();
  if (character.value) {
    await store.ensureProfileThemesForCharacter(character.value.id);
    await runAutoHomepageCleanupForCurrentCharacter();
  }
});

watch(() => character.value?.id, async (characterId) => {
  if (!characterId) return;
  await store.ensureProfileThemesForCharacter(characterId);
  await runAutoHomepageCleanupForCurrentCharacter();
}, { immediate: true });

watch(() => route.query.tab, (tab) => {
  activeTab.value = normalizeProfileThemeTab(tab);
});

watch(showExporter, (open) => {
  if (open) return;
  selectedExportThemeIds.value = [];
  exportError.value = '';
  exporting.value = false;
});

watch(showCreator, (open) => {
  if (open) return;
  selectedPngFile.value = null;
  importError.value = '';
  importing.value = false;
});

watch([showHomepagePreview, selectedHomepage], ([open, homepage]) => {
  if (open && homepage) {
    updateHomepagePreviewStyle(homepage);
    return;
  }
  removeHomepagePreviewStyle();
});

onBeforeUnmount(() => {
  removeHomepagePreviewStyle();
});

function setActiveTab(tab: ProfileThemeTab) {
  activeTab.value = tab;
  void router.replace({ query: { ...route.query, tab } });
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.replace({ name: 'chat-room', params: { id: props.id } });
}

function countPromptLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length || 1;
}

function formatThemeSequence(index: number) {
  return String(index + 1).padStart(2, '0');
}

function normalizeHomepageCleanupDays(value: unknown) {
  return Math.min(3650, Math.max(1, Math.round(Number(value) || 1)));
}

function defaultHomepageCleanupSetting(): CharacterProfileHomepageAutoCleanupSettings {
  return {
    enabled: false,
    days: 7,
    preset: '7',
    lastCleanupAt: 0
  };
}

function daysForPreset(preset: ProfileHomepageAutoCleanupPreset, fallbackDays = 7) {
  if (preset === 'custom') return normalizeHomepageCleanupDays(fallbackDays);
  return normalizeHomepageCleanupDays(Number(preset));
}

function normalizeHomepageCleanupPreset(value: unknown): ProfileHomepageAutoCleanupPreset {
  return value === '3' || value === '7' || value === '30' || value === 'custom' ? value : '7';
}

function homepageCleanupSettingForCharacter(characterId: string): CharacterProfileHomepageAutoCleanupSettings {
  const entry = store.settings?.profileHomepageAutoCleanup?.[characterId];
  if (!entry) return defaultHomepageCleanupSetting();
  const preset = normalizeHomepageCleanupPreset(entry.preset);
  const days = daysForPreset(preset, entry.days);
  return {
    enabled: Boolean(entry.enabled),
    days,
    preset,
    lastCleanupAt: Math.max(0, Math.round(Number(entry.lastCleanupAt) || 0))
  };
}

function homepageCleanupCountForDays(days: number) {
  const currentCharacter = character.value;
  if (!currentCharacter) return 0;
  const cutoff = Date.now() - normalizeHomepageCleanupDays(days) * 24 * 60 * 60 * 1000;
  return homepages.value.filter((homepage) => (homepage.updatedAt || homepage.createdAt) < cutoff).length;
}

function formatHomepageMonth(timestamp: number) {
  if (!timestamp) return '--';
  return homepageMonthFormatter.format(new Date(timestamp)).toUpperCase();
}

function formatHomepageDay(timestamp: number) {
  if (!timestamp) return '--';
  return String(new Date(timestamp).getDate()).padStart(2, '0');
}

function formatHomepageClock(timestamp: number) {
  if (!timestamp) return '未知时间';
  return homepageClockFormatter.format(new Date(timestamp));
}

function formatHomepageSequence(index: number) {
  return String(Math.max(1, homepages.value.length - index)).padStart(2, '0');
}

function homepagePreviewText(homepage: ProfileHomepageRecord) {
  return (homepage.content || homepage.html || '这张主页没有可显示的文字内容。')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || '这张主页没有可显示的文字内容。';
}

function homepageScopeId(homepage: ProfileHomepageRecord) {
  return `profile-homepage-${homepage.id}`;
}

function homepageHtml(homepage: ProfileHomepageRecord) {
  return homepage.html || renderProfileThemeHtml(homepage.content, '');
}

function updateHomepagePreviewStyle(homepage: ProfileHomepageRecord) {
  const css = scopeProfileThemeCss(homepage.css || '', homepageScopeId(homepage));
  if (!css) {
    removeHomepagePreviewStyle();
    return;
  }
  if (!homepagePreviewStyleElement) {
    homepagePreviewStyleElement = document.createElement('style');
    homepagePreviewStyleElement.setAttribute('data-profile-homepage-preview-style', 'true');
    document.head.appendChild(homepagePreviewStyleElement);
  }
  homepagePreviewStyleElement.textContent = css;
}

function removeHomepagePreviewStyle() {
  homepagePreviewStyleElement?.remove();
  homepagePreviewStyleElement = null;
}

function openHomepagePreview(homepageId: string) {
  selectedHomepageId.value = homepageId;
  showHomepagePreview.value = true;
}

async function deleteHomepage(homepageId: string) {
  const homepage = homepages.value.find((entry) => entry.id === homepageId);
  if (!homepage) return;
  if (!window.confirm(`删除“${homepage.themeName}”生成的这张主页？`)) return;
  await store.deleteProfileHomepage(homepageId);
  if (selectedHomepageId.value === homepageId) {
    selectedHomepageId.value = '';
    showHomepagePreview.value = false;
  }
}

async function saveHomepageCleanupSetting(nextSetting: CharacterProfileHomepageAutoCleanupSettings) {
  const currentCharacter = character.value;
  if (!currentCharacter || !store.settings) return;
  await store.saveSettings({
    ...store.settings,
    profileHomepageAutoCleanup: {
      ...store.settings.profileHomepageAutoCleanup,
      [currentCharacter.id]: nextSetting
    }
  });
}

function openHomepageCleanupSettings() {
  const setting = homepageCleanupSetting.value;
  manualHomepageCleanupPreset.value = '7';
  manualHomepageCleanupCustomDays.value = 14;
  homepageCleanupNotice.value = '';
  if (setting.preset === 'custom') manualHomepageCleanupCustomDays.value = setting.days;
  showHomepageCleanupSettings.value = true;
}

async function updateHomepageCleanupEnabled(event: Event) {
  const enabled = Boolean((event.target as HTMLInputElement).checked);
  const setting = homepageCleanupSetting.value;
  await saveHomepageCleanupSetting({ ...setting, enabled });
}

async function selectHomepageCleanupPreset(preset: ProfileHomepageAutoCleanupPreset) {
  const setting = homepageCleanupSetting.value;
  await saveHomepageCleanupSetting({
    ...setting,
    preset,
    days: daysForPreset(preset, setting.days)
  });
}

function selectHomepageCleanupPresetFromEvent(event: Event) {
  void selectHomepageCleanupPreset(normalizeHomepageCleanupPreset((event.target as HTMLSelectElement).value));
}

async function updateHomepageCleanupCustomDays(event: Event) {
  const days = normalizeHomepageCleanupDays((event.target as HTMLInputElement).value);
  const setting = homepageCleanupSetting.value;
  await saveHomepageCleanupSetting({ ...setting, preset: 'custom', days });
}

function setManualHomepageCleanupPresetFromEvent(event: Event) {
  manualHomepageCleanupPreset.value = normalizeHomepageCleanupPreset((event.target as HTMLSelectElement).value);
}

async function cleanupHomepageBySetting() {
  const currentCharacter = character.value;
  if (!currentCharacter || homepageCleanupRunning.value) return;
  homepageCleanupRunning.value = true;
  try {
    const days = homepageCleanupSetting.value.days;
    const removedCount = await store.cleanupProfileHomepagesForCharacters([currentCharacter.id], days);
    homepageCleanupNotice.value = removedCount ? `已清理 ${removedCount} 张生成主页。` : '没有需要清理的生成主页。';
  } finally {
    homepageCleanupRunning.value = false;
  }
}

async function runManualHomepageCleanup() {
  const currentCharacter = character.value;
  if (!currentCharacter || homepageCleanupRunning.value) return;
  homepageCleanupRunning.value = true;
  try {
    const removedCount = await store.cleanupProfileHomepagesForCharacters([currentCharacter.id], manualHomepageCleanupDays.value);
    homepageCleanupNotice.value = removedCount ? `已清理 ${removedCount} 张生成主页。` : '没有需要清理的生成主页。';
  } finally {
    homepageCleanupRunning.value = false;
  }
}

async function runAutoHomepageCleanupForCurrentCharacter() {
  const currentCharacter = character.value;
  if (!currentCharacter) return;
  await store.runProfileHomepageAutoCleanupForCharacters([currentCharacter.id]);
}

function resetThemeDraft() {
  editingThemeId.value = '';
  themeDraft.name = '';
  themeDraft.prompt = defaultProfileThemePrompt;
  themeDraft.regex = '';
  themeDraft.code = defaultCustomProfileThemeCode;
  themeDraft.enabled = true;
}

function openCreator() {
  resetThemeDraft();
  selectedPngFile.value = null;
  importError.value = '';
  creatorTab.value = 'theme';
  showCreator.value = true;
}

function openEditTheme(theme: ProfileTheme) {
  editingThemeId.value = theme.id;
  themeDraft.name = theme.name;
  themeDraft.prompt = theme.prompt;
  themeDraft.regex = theme.regex;
  themeDraft.code = composeProfileThemeCode(theme.template, theme.css) || defaultCustomProfileThemeCode;
  themeDraft.enabled = theme.enabled;
  showEditor.value = true;
}

async function saveThemeDraft(options: { closeCreator?: boolean } = {}) {
  const currentCharacter = character.value;
  if (!currentCharacter) return;
  const name = themeDraft.name.trim();
  const prompt = themeDraft.prompt.trim();
  if (!name || !prompt) {
    store.showConfigAlert('请填写主页主题名称和提示词。', '无法保存主页主题');
    return;
  }

  const existingTheme = editingTheme.value;
  const profileThemeCode = splitProfileThemeCode(themeDraft.code);
  if (existingTheme) {
    await store.saveProfileTheme({
      ...existingTheme,
      name,
      prompt,
      regex: themeDraft.regex.trim(),
      template: profileThemeCode.html,
      css: profileThemeCode.css
    });
    await store.setProfileThemeEnabledForCharacter(currentCharacter.id, existingTheme.id, themeDraft.enabled);
  } else {
    const createdTheme = await store.createProfileTheme({
      charId: currentCharacter.id,
      name,
      prompt,
      regex: themeDraft.regex.trim(),
      template: profileThemeCode.html,
      css: profileThemeCode.css
    });
    if (createdTheme) await store.setProfileThemeEnabledForCharacter(currentCharacter.id, createdTheme.id, themeDraft.enabled);
  }
  if (options.closeCreator) showCreator.value = false;
  else showEditor.value = false;
}

async function submitEditor() {
  await saveThemeDraft();
}

async function toggleTheme(theme: ProfileTheme) {
  const currentCharacter = character.value;
  if (!currentCharacter) return;
  await store.setProfileThemeEnabledForCharacter(currentCharacter.id, theme.id, !theme.enabled);
}

async function deleteEditingTheme() {
  const theme = editingTheme.value;
  if (!theme || theme.builtIn) return;
  if (!window.confirm(`删除主页主题“${theme.name}”？已生成的主页内容会保留。`)) return;
  await store.deleteProfileTheme(theme.id);
  editingThemeId.value = '';
  showEditor.value = false;
}

function openExporter() {
  selectedExportThemeIds.value = exportableThemes.value.map((theme) => theme.id);
  exportError.value = '';
  showExporter.value = true;
}

function selectPngFile(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedPngFile.value = input.files?.[0] ?? null;
  input.value = '';
  importError.value = '';
}

async function choosePngFile() {
  importError.value = '';
  try {
    const file = await pickNativePngFile();
    if (file === undefined) {
      pngInput.value?.click();
      return;
    }
    if (file) selectedPngFile.value = file;
  } catch (error) {
    importError.value = error instanceof Error ? error.message : '无法打开系统 PNG 文件选择器。';
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('读取 PNG 文件失败')));
    reader.readAsDataURL(file);
  });
}

async function importThemesFromPng() {
  const currentCharacter = character.value;
  const file = selectedPngFile.value;
  if (!currentCharacter || !file || importing.value) {
    if (!file) importError.value = '请先选择 PNG 主页主题图片。';
    return;
  }
  if (file.type && file.type !== 'image/png') {
    importError.value = '请选择 PNG 格式的主页主题图片。';
    return;
  }
  importing.value = true;
  try {
    const importedThemes = await decodeProfileThemesFromPng(await readFileAsDataUrl(file), currentCharacter.id);
    const savedThemes = await store.importProfileThemes(currentCharacter.id, importedThemes);
    if (!savedThemes.length) {
      importError.value = 'PNG 中没有可用的主页主题。';
      return;
    }
    showCreator.value = false;
    store.showConfigAlert(`已导入 ${savedThemes.length} 个主页主题。`, '导入完成');
  } catch (error) {
    importError.value = error instanceof Error ? error.message : 'PNG 主页主题导入失败。';
  } finally {
    importing.value = false;
  }
}

async function submitCreator() {
  if (creatorTab.value === 'png') {
    await importThemesFromPng();
    return;
  }
  await saveThemeDraft({ closeCreator: true });
}

function getExportFileName(items: ProfileTheme[]) {
  const firstName = items[0]?.name?.replace(/[^\u4e00-\u9fa5\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'profile-theme';
  return `link-profile-${firstName}-${Date.now()}.png`;
}

async function exportSelectedThemes() {
  if (exporting.value) return;
  const selectedIds = new Set(selectedExportThemeIds.value);
  const selectedThemes = exportableThemes.value.filter((theme) => selectedIds.has(theme.id));
  if (!selectedThemes.length) {
    exportError.value = '请先选择要导出的主页主题。';
    return;
  }
  exporting.value = true;
  try {
    const dataUrl = await encodeProfileThemesToPng(selectedThemes);
    const fileName = getExportFileName(selectedThemes);
    if (!await shareNativeDataUrl(dataUrl, fileName)) await downloadDataUrl(dataUrl, fileName);
    showExporter.value = false;
  } catch (error) {
    exportError.value = error instanceof Error ? error.message : '主页主题导出失败。';
  } finally {
    exporting.value = false;
  }
}
</script>

<style scoped>
.native-fallback-file-input { display: none; }
.profile-theme-page {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: #f6f8f7;
  color: #111111;
}

.profile-theme-page.profile-theme-ins-view {
  background:
    radial-gradient(circle at 88% 3%, rgba(234, 214, 204, 0.36), transparent 25%),
    linear-gradient(180deg, #f8f5f0 0%, #f6f3ee 58%, #f9f7f3 100%);
  color: #302b29;
}

.profile-theme-topbar {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: calc(8px + var(--safe-top)) calc(12px + var(--safe-right)) 8px calc(12px + var(--safe-left));
  background: rgba(246, 248, 247, 0.94);
  backdrop-filter: blur(18px);
}

.profile-theme-ins-view .profile-theme-topbar {
  background: rgba(248, 245, 240, 0.88);
}

.profile-theme-title-button,
.header-action-button,
.profile-theme-card,
.profile-theme-empty button,
.theme-editor-actions button,
.profile-theme-modal-footer button {
  border: 0;
  font: inherit;
  cursor: pointer;
}

.profile-theme-title-button {
  justify-self: start;
  min-width: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  text-align: left;
}

.profile-theme-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.header-action-button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  color: #202329;
}

.profile-theme-main {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 12px calc(12px + var(--safe-right)) 18px calc(12px + var(--safe-left));
}

.profile-theme-panel,
.profile-theme-section {
  display: grid;
  gap: 10px;
  max-width: 680px;
  margin: 0 auto;
}

.profile-theme-section {
  width: 100%;
}

.homepage-archive-section {
  gap: 16px;
}

.profile-theme-section-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 2px 6px;
}

.homepage-archive-head {
  align-items: start;
  padding: 10px 4px 8px;
}

.homepage-archive-head > div {
  display: grid;
  gap: 2px;
}

.section-kicker,
.profile-theme-section-head h2,
.profile-theme-card strong,
.profile-theme-card small,
.profile-theme-empty h2,
.profile-theme-empty p,
.composer-hero span,
.composer-hero strong,
.composer-hero p {
  margin: 0;
}

.section-kicker {
  color: #7b838c;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.homepage-archive-head .section-kicker {
  color: #a68e83;
  font-size: 8px;
  letter-spacing: 0.2em;
}

.profile-theme-section-head h2 {
  margin-top: 2px;
  font-size: 18px;
  font-weight: 900;
}

.homepage-archive-head h2 {
  margin-top: 1px;
  color: #302b29;
  font-family: Georgia, "Songti SC", serif;
  font-size: 27px;
  font-weight: 600;
  letter-spacing: -0.04em;
}

.homepage-archive-intro {
  margin: 4px 0 0;
  color: #9b8f88;
  font-size: 10px;
  letter-spacing: 0.04em;
}

.section-count {
  display: inline-grid;
  place-items: center;
  min-width: 42px;
  height: 26px;
  border-radius: 999px;
  background: #ffffff;
  color: #4f5963;
  font-size: 12px;
  font-weight: 900;
}

.homepage-archive-count {
  display: grid;
  gap: 0;
  width: 56px;
  height: 56px;
  border: 1px solid rgba(123, 100, 89, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.62);
  box-shadow: 0 12px 30px rgba(87, 68, 59, 0.06);
}

.homepage-archive-count strong {
  color: #4a403b;
  font-family: Georgia, serif;
  font-size: 18px;
  font-weight: 500;
  line-height: 1;
}

.homepage-archive-count small {
  color: #ad9a90;
  font-size: 6px;
  font-weight: 900;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.theme-library-section {
  gap: 16px;
}

.theme-library-head {
  align-items: start;
  padding: 10px 4px 8px;
}

.theme-library-head > div {
  display: grid;
  gap: 2px;
}

.theme-library-head .section-kicker {
  color: #9a887f;
  font-size: 8px;
  letter-spacing: 0.2em;
}

.theme-library-head h2 {
  margin-top: 1px;
  color: #302b29;
  font-family: Georgia, "Songti SC", serif;
  font-size: 27px;
  font-weight: 600;
  letter-spacing: -0.04em;
}

.theme-library-intro {
  margin: 4px 0 0;
  color: #9b8f88;
  font-size: 10px;
  letter-spacing: 0.04em;
}

.theme-library-count {
  display: grid;
  gap: 0;
  width: 62px;
  height: 56px;
  border: 1px solid rgba(123, 100, 89, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.62);
  box-shadow: 0 12px 30px rgba(87, 68, 59, 0.06);
}

.theme-library-count strong {
  color: #4a403b;
  font-family: Georgia, serif;
  font-size: 18px;
  font-weight: 500;
  line-height: 1;
}

.theme-library-count small {
  color: #ad9a90;
  font-size: 6px;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.theme-library-grid {
  display: grid;
  gap: 12px;
  padding-bottom: 24px;
}

.profile-theme-card {
  position: relative;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  min-height: 116px;
  padding: 17px 56px 17px 17px;
  overflow: hidden;
  border: 1px solid rgba(131, 105, 93, 0.075);
  border-radius: 28px 28px 10px 28px;
  background:
    radial-gradient(circle at 94% 8%, rgba(229, 208, 198, 0.54), transparent 27%),
    rgba(255, 255, 255, 0.74);
  box-shadow: 0 16px 36px rgba(81, 63, 55, 0.07);
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.profile-theme-card:nth-child(3n + 2) {
  background:
    radial-gradient(circle at 94% 8%, rgba(215, 220, 207, 0.58), transparent 27%),
    rgba(255, 255, 255, 0.74);
}

.profile-theme-card:nth-child(3n) {
  background:
    radial-gradient(circle at 94% 8%, rgba(224, 215, 204, 0.58), transparent 27%),
    rgba(255, 255, 255, 0.74);
}

.profile-theme-card::before {
  content: '';
  position: absolute;
  right: 16px;
  bottom: -18px;
  width: 48px;
  height: 48px;
  border: 1px solid rgba(143, 117, 105, 0.1);
  border-radius: 50%;
}

.profile-theme-card:active {
  transform: scale(0.99);
}

.profile-theme-card.disabled {
  opacity: 0.62;
}

.theme-card-number {
  display: grid;
  place-items: center;
  width: 38px;
  height: 52px;
  border-right: 1px solid rgba(131, 105, 93, 0.11);
  color: #a98f83;
  font-family: Georgia, serif;
  font-size: 16px;
}

.theme-card-open {
  position: absolute;
  right: 18px;
  bottom: 15px;
  display: grid;
  place-items: center;
  color: #9d887e;
}

.homepage-timeline {
  position: relative;
  display: grid;
  gap: 18px;
  padding: 4px 0 24px;
}

.homepage-timeline::before {
  content: '';
  position: absolute;
  top: 15px;
  bottom: 12px;
  left: 27px;
  width: 1px;
  background: linear-gradient(180deg, rgba(170, 145, 132, 0.16), rgba(170, 145, 132, 0.46) 16%, rgba(170, 145, 132, 0.16));
}

.homepage-timeline-item {
  position: relative;
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  min-width: 0;
}

.homepage-timeline-stamp {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  gap: 0;
  padding-top: 8px;
  color: #76655c;
}

.homepage-timeline-stamp span {
  color: #ab958a;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.16em;
}

.homepage-timeline-stamp strong {
  font-family: Georgia, serif;
  font-size: 20px;
  font-weight: 500;
  line-height: 1.1;
}

.homepage-timeline-stamp i {
  width: 7px;
  height: 7px;
  margin-top: 7px;
  border: 2px solid #f8f5f0;
  border-radius: 50%;
  background: #c8aa9b;
  box-shadow: 0 0 0 1px rgba(155, 126, 113, 0.24);
}

.homepage-record-card {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(131, 105, 93, 0.08);
  border-radius: 25px 25px 25px 8px;
  background:
    radial-gradient(circle at 100% 0%, rgba(229, 210, 200, 0.36), transparent 30%),
    rgba(255, 255, 255, 0.76);
  box-shadow: 0 16px 36px rgba(81, 63, 55, 0.075);
}

.homepage-record-card::after {
  content: '';
  position: absolute;
  top: -22px;
  right: 34px;
  width: 42px;
  height: 42px;
  border: 1px solid rgba(154, 126, 113, 0.1);
  border-radius: 50%;
  pointer-events: none;
}

.homepage-record-main,
.homepage-record-delete {
  border: 0;
  font: inherit;
  cursor: pointer;
}

.homepage-record-main {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 15px;
  width: 100%;
  min-height: 132px;
  min-width: 0;
  padding: 18px;
  background: transparent;
  color: inherit;
  text-align: left;
}

.homepage-record-copy {
  display: grid;
  align-content: start;
  gap: 5px;
  min-width: 0;
}

.homepage-record-copy strong,
.homepage-record-copy em {
  overflow: hidden;
  text-overflow: ellipsis;
}

.homepage-record-copy strong {
  color: #3b3230;
  font-family: Georgia, "Songti SC", serif;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.02em;
  white-space: nowrap;
}

.homepage-record-copy small {
  color: #b09285;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.17em;
  text-transform: uppercase;
}

.homepage-record-copy em {
  display: -webkit-box;
  color: #8b7e78;
  font-size: 10px;
  font-style: normal;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.homepage-record-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(126, 101, 90, 0.09);
}

.homepage-record-footer time {
  color: #a79992;
  font-family: Georgia, serif;
  font-size: 9px;
  letter-spacing: 0.08em;
}

.homepage-record-open {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #705d55;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.homepage-record-delete {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.54);
  color: #b19e95;
}

.homepage-record-delete:active {
  background: rgba(131, 99, 87, 0.1);
  color: #755f56;
}

.profile-theme-bottom-tabs {
  position: relative;
  z-index: 20;
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 8px calc(12px + var(--safe-right)) calc(10px + var(--safe-bottom)) calc(12px + var(--safe-left));
  border-top: 1px solid rgba(17, 17, 17, 0.05);
  background: rgba(255, 255, 255, 0.96);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}

.profile-theme-ins-view .profile-theme-bottom-tabs {
  border-top-color: rgba(99, 77, 67, 0.05);
  background: rgba(253, 251, 248, 0.94);
}

.profile-theme-bottom-tabs button {
  display: grid;
  justify-items: center;
  gap: 3px;
  min-width: 0;
  min-height: 48px;
  padding: 6px 4px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  color: #69706a;
  font: inherit;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
}

.profile-theme-bottom-tabs button.active {
  background: #eef8f1;
  color: #111111;
}

.profile-theme-ins-view .profile-theme-bottom-tabs button.active {
  background: #efe5df;
  color: #4e403a;
}

.profile-theme-bottom-tabs span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.homepage-preview-sheet {
  display: grid;
  padding: 5px;
  border: 1px solid rgba(133, 106, 94, 0.08);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: 0 18px 44px rgba(72, 54, 47, 0.08);
  color: #111111;
}

.homepage-preview-body {
  min-width: 0;
  overflow: hidden;
  border-radius: 22px;
  background: #ffffff;
}

.homepage-cleanup-panel {
  display: grid;
  gap: 10px;
  color: #443a36;
}

.cleanup-manual-card,
.cleanup-character-card {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(128, 100, 88, 0.08);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: 0 12px 30px rgba(75, 56, 48, 0.045);
}

.cleanup-character-card.single-character {
  padding-top: 14px;
  border-top: 1px solid rgba(128, 100, 88, 0.08);
}

.cleanup-section-head,
.cleanup-character-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.cleanup-section-head span {
  color: #4a3e39;
  font-size: 13px;
  font-weight: 900;
}

.cleanup-section-head small,
.cleanup-notice {
  color: #9b8b84;
  font-size: 12px;
}

.cleanup-character-head {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cleanup-character-head img {
  width: 36px;
  height: 36px;
  border: 2px solid rgba(255, 255, 255, 0.82);
  border-radius: 14px;
  box-shadow: 0 7px 16px rgba(75, 55, 48, 0.1);
  object-fit: cover;
}

.cleanup-character-head span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.cleanup-character-head strong,
.cleanup-character-head small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cleanup-character-head strong {
  color: #493e39;
  font-size: 13px;
  font-weight: 900;
}

.cleanup-character-head small {
  color: #9b8b84;
  font-size: 11px;
}

.cleanup-switch-card {
  position: relative;
  flex: 0 0 auto;
}

.cleanup-switch-card input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.cleanup-switch-track {
  display: block;
  width: 42px;
  height: 24px;
  border-radius: 999px;
  background: #d9d0ca;
  transition: background 0.18s ease;
}

.cleanup-switch-track::after {
  content: '';
  display: block;
  width: 20px;
  height: 20px;
  margin: 2px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 3px 8px rgba(42, 35, 31, 0.18);
  transition: transform 0.18s ease;
}

.cleanup-switch-card input:checked + .cleanup-switch-track {
  background: #92776b;
}

.cleanup-switch-card input:checked + .cleanup-switch-track::after {
  transform: translateX(18px);
}

.cleanup-compact-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 8px;
}

.cleanup-compact-row.character-row {
  grid-template-columns: minmax(0, 1fr) auto auto;
}

.cleanup-select-field,
.cleanup-days-field {
  display: grid;
  gap: 5px;
  color: #8f7b72;
  font-size: 11px;
  font-weight: 900;
}

.cleanup-select-field select,
.cleanup-days-field input {
  height: 38px;
  border: 1px solid rgba(128, 100, 88, 0.1);
  border-radius: 14px;
  background: #f7f2ed;
  color: #493e39;
  font: inherit;
}

.cleanup-select-field select {
  min-width: 116px;
  padding: 0 10px;
}

.cleanup-days-field {
  grid-template-columns: 58px auto;
  align-items: end;
}

.cleanup-days-field span {
  padding-bottom: 10px;
  color: #9b8b84;
}

.cleanup-days-field input {
  width: 58px;
  padding: 0 8px;
}

.cleanup-text-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 58px;
  height: 38px;
  border: 0;
  border-radius: 14px;
  background: #eadfd9;
  color: #6e564c;
  font: inherit;
  font-size: 12px;
  font-weight: 900;
}

.cleanup-text-action.danger {
  background: rgba(170, 92, 92, 0.1);
  color: #a25e5e;
}

.cleanup-notice {
  margin: 0;
  line-height: 1.45;
}

.theme-switch {
  position: relative;
  width: 38px;
  height: 22px;
  border: 0;
  border-radius: 999px;
  background: #d9d0ca;
  padding: 3px;
}

.profile-theme-card > .theme-switch {
  position: absolute;
  top: 14px;
  right: 14px;
}

.theme-switch span {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 2px 7px rgba(78, 60, 52, 0.16);
  transition: transform 0.18s ease;
}

.theme-switch.active {
  background: #8f766b;
}

.theme-switch.active span {
  transform: translateX(16px);
}

.theme-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.theme-copy strong {
  overflow: hidden;
  color: #403633;
  font-family: Georgia, "Songti SC", serif;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theme-copy > small {
  overflow: hidden;
  color: #aa8e82;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.theme-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #998b84;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.theme-card-meta i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #cbb5aa;
}

.theme-library-empty {
  align-content: center;
  gap: 7px;
  min-height: min(62vh, 560px);
  color: #978b85;
}

.theme-library-empty-art {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  margin-bottom: 10px;
  border: 1px solid rgba(156, 128, 115, 0.1);
  border-radius: 50% 50% 18px 50%;
  background: #eee2dc;
  color: #856d63;
  box-shadow: 0 16px 36px rgba(83, 63, 54, 0.08);
}

.profile-theme-empty .theme-library-empty-kicker {
  color: #aa8f83;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.theme-library-empty h2 {
  color: #443a36;
  font-family: Georgia, "Songti SC", serif;
  font-size: 21px;
  font-weight: 600;
}

.theme-library-empty > button {
  margin-top: 10px;
  padding: 0 18px;
  border-radius: 999px;
  background: #51443e;
  box-shadow: 0 10px 24px rgba(78, 59, 51, 0.12);
  font-size: 10px;
}

.profile-theme-empty {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 38vh;
  padding: 28px 18px;
  color: #7a838c;
  text-align: center;
}

.profile-theme-empty h2,
.profile-theme-empty strong {
  color: #22262c;
  font-size: 17px;
  font-weight: 900;
}

.profile-theme-empty p {
  max-width: 280px;
  font-size: 12px;
  line-height: 1.5;
}

.profile-theme-empty button {
  min-height: 38px;
  padding: 0 14px;
  border-radius: 8px;
  background: #202329;
  color: #ffffff;
  font-size: 12px;
  font-weight: 900;
}

.homepage-timeline-empty {
  position: relative;
  align-content: center;
  gap: 7px;
  min-height: min(62vh, 560px);
  padding: 38px 24px 82px;
  color: #978b85;
}

.homepage-timeline-empty::before {
  content: '';
  position: absolute;
  top: 36px;
  bottom: 46px;
  left: 50%;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(182, 156, 143, 0.2) 24%, rgba(182, 156, 143, 0.2) 76%, transparent);
}

.homepage-empty-art {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 78px;
  height: 78px;
  margin-bottom: 12px;
  border: 1px solid rgba(164, 136, 123, 0.12);
  border-radius: 28px 28px 28px 8px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 18px 40px rgba(91, 70, 61, 0.08);
  transform: rotate(-3deg);
}

.homepage-empty-art::before,
.homepage-empty-art::after {
  content: '';
  position: absolute;
  border: 1px solid rgba(171, 143, 130, 0.12);
  border-radius: 50%;
}

.homepage-empty-art::before {
  top: -11px;
  right: -10px;
  width: 32px;
  height: 32px;
}

.homepage-empty-art::after {
  bottom: 12px;
  left: 12px;
  width: 9px;
  height: 9px;
  background: #e8d7ce;
}

.homepage-empty-art span {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 16px;
  background: #f1e6e0;
  color: #8f7468;
}

.profile-theme-empty .homepage-empty-kicker {
  position: relative;
  z-index: 1;
  color: #b09487;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.homepage-timeline-empty h2,
.homepage-timeline-empty > p,
.homepage-timeline-empty > button {
  position: relative;
  z-index: 1;
}

.homepage-timeline-empty h2 {
  color: #443a36;
  font-family: Georgia, "Songti SC", serif;
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.homepage-timeline-empty > p:not(.homepage-empty-kicker) {
  max-width: 255px;
  color: #978b85;
  font-size: 11px;
  line-height: 1.7;
}

.homepage-timeline-empty > button {
  min-height: 38px;
  margin-top: 12px;
  padding: 0 18px;
  border-radius: 999px;
  background: #51443e;
  box-shadow: 0 10px 24px rgba(78, 59, 51, 0.12);
  font-size: 10px;
  letter-spacing: 0.06em;
}

.profile-theme-editor,
.profile-theme-exporter {
  display: grid;
  gap: 14px;
  color: #443a36;
}

.profile-theme-creator,
.profile-theme-exporter {
  grid-template-rows: auto auto minmax(0, 1fr) auto auto;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.profile-theme-exporter {
  grid-template-rows: auto minmax(0, 1fr) auto auto;
}

.profile-theme-editor-fields,
.composer-section {
  display: grid;
  align-content: start;
  gap: 14px;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.profile-theme-editor label {
  display: grid;
  gap: 7px;
}

.profile-theme-editor label span {
  color: #7f6b62;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.04em;
}

.profile-theme-editor input,
.profile-theme-editor textarea {
  width: 100%;
  border: 1px solid rgba(128, 100, 88, 0.1);
  border-radius: 16px;
  padding: 11px 12px;
  outline: 0;
  background: rgba(255, 255, 255, 0.68);
  color: #443a36;
  font: inherit;
  line-height: 1.5;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.profile-theme-editor input:focus,
.profile-theme-editor textarea:focus {
  border-color: rgba(139, 108, 94, 0.28);
  box-shadow: 0 0 0 3px rgba(166, 135, 121, 0.08);
}

.profile-theme-editor textarea {
  resize: vertical;
}

.theme-editor-switch {
  display: flex !important;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px !important;
  padding: 12px;
  border: 1px solid rgba(128, 100, 88, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.54);
}

.theme-editor-switch input {
  width: 18px;
  height: 18px;
  padding: 0;
  accent-color: #8f766b;
}

.theme-editor-actions,
.profile-theme-modal-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 9px;
}

.theme-editor-actions.editing {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.theme-editor-actions button,
.profile-theme-modal-footer button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
}

.theme-editor-actions .secondary,
.footer-cancel {
  background: #e9dfd9;
  color: #6f5a51;
}

.theme-editor-actions .primary,
.footer-save {
  background: #51443e;
  color: #ffffff;
  box-shadow: 0 10px 22px rgba(76, 57, 49, 0.12);
}

.theme-editor-actions .danger {
  background: rgba(170, 92, 92, 0.1);
  color: #a25e5e;
}

.composer-hero {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(134, 103, 90, 0.07);
  border-radius: 28px 28px 28px 10px;
  background:
    radial-gradient(circle at top right, rgba(228, 205, 194, 0.68), transparent 32%),
    rgba(255, 255, 255, 0.64);
  box-shadow: 0 14px 34px rgba(75, 56, 48, 0.055);
}

.composer-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 56px;
  height: 56px;
  border-radius: 20px 20px 20px 7px;
  background: #eaded8;
  color: #775f55;
}

.composer-avatar.composer-avatar {
  display: grid;
  color: #775f55;
  letter-spacing: 0;
  text-transform: none;
}

.composer-avatar svg {
  width: 26px;
  height: 26px;
}

.composer-hero > div {
  min-width: 0;
}

.composer-hero span,
.composer-hero strong {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-hero span {
  color: #a18478;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.composer-hero strong {
  color: #443936;
  font-family: Georgia, "Songti SC", serif;
  font-size: 18px;
  font-weight: 600;
}

.composer-hero p {
  margin: 4px 0 0;
  color: #91837c;
  font-size: 10px;
  line-height: 1.6;
}

.composer-tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: #eae0da;
}

.composer-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #927f76;
  font-size: 10px;
  font-weight: 800;
}

.composer-tab.active {
  background: rgba(255, 255, 255, 0.8);
  color: #564741;
  box-shadow: 0 6px 16px rgba(78, 59, 51, 0.08);
}

.file-drop-card {
  position: relative;
  display: grid;
  place-items: center;
  gap: 7px;
  min-height: 154px;
  border: 1px dashed rgba(131, 102, 89, 0.24);
  border-radius: 26px 26px 26px 9px;
  background: rgba(255, 255, 255, 0.58);
  color: #806c63;
  text-align: center;
}

.file-drop-card input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.file-drop-card strong {
  color: #493e39;
  font-size: 14px;
}

.file-drop-card span,
.export-theme-item small {
  color: #998a83;
  font-size: 12px;
}

.export-theme-list {
  display: grid;
  align-content: start;
  gap: 9px;
  min-height: auto;
  overflow: auto;
}

.export-theme-item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 13px;
  border: 1px solid rgba(128, 100, 88, 0.08);
  border-radius: 20px 20px 20px 8px;
  background: rgba(255, 255, 255, 0.6);
}

.export-theme-item input {
  width: 18px;
  height: 18px;
  accent-color: #8f766b;
}

.export-theme-item span {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.export-theme-item strong,
.export-theme-item small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.export-theme-item strong {
  color: #473c38;
  font-family: Georgia, "Songti SC", serif;
  font-size: 14px;
  font-weight: 600;
}

.export-theme-item small {
  color: #998a83;
  font-size: 12px;
}

.sync-feedback {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
}

.sync-feedback.error {
  color: #d33c41;
}

.compact-empty {
  min-height: 160px;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

:global(.modal-panel .modal-body .profile-theme-creator.profile-theme-creator .profile-theme-modal-footer),
:global(.modal-panel .modal-body .style-export-composer.style-export-composer .profile-theme-modal-footer) {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 9px !important;
  width: 100% !important;
}

:global(.modal-panel .modal-body .profile-theme-creator.profile-theme-creator .footer-button),
:global(.modal-panel .modal-body .style-export-composer.style-export-composer .footer-button) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  min-width: 0 !important;
  min-height: 42px !important;
  border-radius: 999px !important;
}

:global(.modal-panel .modal-body .profile-theme-editor:not(.profile-theme-creator) .theme-editor-actions) {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 8px !important;
  width: 100% !important;
}

:global(.modal-panel .modal-body .profile-theme-editor:not(.profile-theme-creator) .theme-editor-actions.editing) {
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
}

:global(.modal-panel .modal-body .profile-theme-editor:not(.profile-theme-creator) .theme-editor-actions button) {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 100% !important;
  min-width: 0 !important;
}

:global(.modal-panel .modal-body .profile-theme-creator.profile-theme-creator .composer-avatar),
:global(.modal-panel .modal-body .style-export-composer.style-export-composer .composer-avatar) {
  display: grid !important;
  place-items: center !important;
  width: 56px !important;
  height: 56px !important;
}

:global(.modal-panel .modal-body .profile-theme-creator.profile-theme-creator .composer-avatar svg),
:global(.modal-panel .modal-body .style-export-composer.style-export-composer .composer-avatar svg) {
  width: 26px !important;
  height: 26px !important;
}

@media (max-width: 480px) {
  .profile-theme-main {
    padding-top: 8px;
  }

  .theme-library-section,
  .homepage-archive-section {
    gap: 12px;
  }

  .theme-library-grid {
    gap: 8px;
    padding-bottom: 16px;
  }

  .profile-theme-card {
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 11px;
    min-height: 88px;
    padding: 12px 48px 12px 12px;
    border-radius: 22px 22px 9px 22px;
    box-shadow: 0 10px 24px rgba(81, 63, 55, 0.06);
  }

  .profile-theme-card::before {
    right: 12px;
    bottom: -20px;
    width: 40px;
    height: 40px;
  }

  .theme-card-number {
    width: 32px;
    height: 42px;
    font-size: 14px;
  }

  .profile-theme-card > .theme-switch {
    top: 10px;
    right: 10px;
  }

  .theme-card-open {
    right: 14px;
    bottom: 10px;
  }

  .theme-copy {
    gap: 2px;
  }

  .theme-copy strong {
    font-size: 16px;
  }

  .homepage-timeline {
    gap: 12px;
    padding-bottom: 16px;
  }

  .homepage-timeline-item {
    grid-template-columns: 50px minmax(0, 1fr);
    gap: 8px;
  }

  .homepage-record-card {
    border-radius: 20px 20px 20px 8px;
    box-shadow: 0 10px 24px rgba(81, 63, 55, 0.06);
  }

  .homepage-record-main {
    gap: 10px;
    min-height: 106px;
    padding: 14px;
  }

  .homepage-record-footer {
    padding-top: 9px;
  }

  .homepage-timeline-empty {
    min-height: clamp(250px, 36vh, 320px);
    padding: 26px 18px 34px;
  }

  .homepage-timeline-empty::before {
    top: 24px;
    bottom: 24px;
  }

  .homepage-empty-art {
    width: 60px;
    height: 60px;
    margin-bottom: 6px;
    border-radius: 22px 22px 22px 7px;
    box-shadow: 0 10px 24px rgba(91, 70, 61, 0.07);
  }

  .homepage-empty-art span {
    width: 34px;
    height: 34px;
    border-radius: 12px;
  }

  .homepage-timeline-empty h2 {
    font-size: 19px;
  }

  .homepage-timeline-empty > button {
    min-height: 36px;
    margin-top: 6px;
  }
}
</style>
