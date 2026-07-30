<template>
  <section class="screen no-tabs themes-page">
    <header class="top-bar themes-topbar">
      <button class="themes-title-button" type="button" aria-label="返回上一页" @click="goBack">
        <h1 class="top-title">Themes</h1>
      </button>
      <div class="header-actions">
        <button v-if="isStyleTab" class="header-add-button" type="button" :aria-label="`分享${activeStyleLabel}样式`" :title="`分享${activeStyleLabel}样式`" @click="openStyleExporter">
          <Share2 :size="18" stroke-width="2.35" />
        </button>
        <button class="header-add-button" type="button" :aria-label="isStyleTab ? `添加${activeStyleLabel}样式` : '导入字体'" :title="isStyleTab ? `添加${activeStyleLabel}样式` : '导入字体'" @click="openActiveImporter">
          <Plus :size="19" stroke-width="2.4" />
        </button>
      </div>
    </header>

    <main class="themes-main">
      <section v-if="!store.ready" class="themes-panel loading-panel">
        <LoaderCircle :size="18" class="spin" />
        <p>正在加载主题...</p>
      </section>

      <section v-else class="themes-panel">
        <section v-if="activeTab === 'font'" class="font-library" aria-label="字体主题">
          <header class="font-library-head">
            <div>
              <p class="section-kicker">Font Library</p>
              <h2>{{ activeFontEntry?.name || '系统默认' }}</h2>
            </div>
            <button class="section-action" type="button" :disabled="!fontSettings.activeFontId" @click="resetFont">恢复默认</button>
          </header>

          <section v-if="fontEntries.length" class="font-card-list" aria-label="已导入字体">
            <article v-for="entry in fontEntries" :key="entry.id" class="font-card" :class="{ active: entry.id === fontSettings.activeFontId }">
              <div class="font-card-top">
                <span class="font-mark"><Type :size="18" /></span>
                <div class="font-copy">
                  <strong>{{ entry.name }}</strong>
                </div>
                <span class="status-pill" :class="entry.id === fontSettings.activeFontId ? 'enabled' : 'disabled'">
                  {{ entry.id === fontSettings.activeFontId ? 'Applied' : sourceLabel(entry) }}
                </span>
              </div>

              <div class="font-preview" :style="fontPreviewStyle(entry)">
                <span>LINK Preview</span>
                <strong>与你的角色保持连接</strong>
                <p>中文、English、12345 AaBbCc</p>
              </div>

              <footer class="font-card-footer">
                <span>{{ formatFontMeta(entry) }}</span>
                <div>
                  <button class="card-action" type="button" :disabled="entry.id === fontSettings.activeFontId || applyingFontId === entry.id" @click="applyFont(entry.id)">
                    <span>{{ applyingFontId === entry.id ? '检测中' : entry.id === fontSettings.activeFontId ? '已应用' : '应用' }}</span>
                  </button>
                  <button class="card-action danger" type="button" @click="removeFont(entry.id)">
                    <span>删除</span>
                  </button>
                </div>
              </footer>
            </article>
          </section>

          <section v-else class="empty-shell">
            <strong>还没有导入字体</strong>
            <p>点击右上角 +，通过链接或本地字体文件添加到字体库。</p>
          </section>

          <p v-if="feedbackMessage" class="sync-feedback success">{{ feedbackMessage }}</p>
        </section>

        <section v-else-if="isStyleTab" class="online-style-library" :aria-label="`${activeStyleLabel}样式`">
          <section v-if="activeTab === 'global'" class="global-library global-display-settings" aria-label="全局显示设置">
            <article class="global-scale-card">
              <header class="global-card-head">
                <span class="font-mark"><Globe2 :size="18" /></span>
                <div>
                  <p class="section-kicker">Global Scale</p>
                  <h2>整体显示</h2>
                </div>
                <strong>{{ globalScalePercent }}%</strong>
              </header>

              <div class="scale-range-shell">
                <input
                  class="scale-range"
                  type="range"
                  :min="minGlobalThemeScalePercent"
                  :max="maxGlobalThemeScalePercent"
                  :step="globalThemeScaleStepPercent"
                  :value="globalScalePercent"
                  :aria-valuetext="`${globalScaleLabel}%`"
                  aria-label="调整全站显示大小"
                  @input="updateGlobalScaleFromInput"
                />
                <div class="scale-range-meta" aria-hidden="true">
                  <span>{{ formatGlobalScalePercent(minGlobalThemeScalePercent) }}%</span>
                  <span>{{ formatGlobalScalePercent(maxGlobalThemeScalePercent) }}%</span>
                </div>
              </div>

              <footer class="scale-actions" aria-label="显示大小快捷操作">
                <button class="scale-action" type="button" :disabled="globalScalePercent <= minGlobalThemeScalePercent" aria-label="缩小显示" @click="nudgeGlobalScale(-globalThemeScaleStepPercent)">
                  <Minus :size="16" />
                </button>
                <button class="scale-reset" type="button" :disabled="globalScalePercent === 100" @click="setGlobalScale(100)">默认</button>
                <button class="scale-action" type="button" :disabled="globalScalePercent >= maxGlobalThemeScalePercent" aria-label="放大显示" @click="nudgeGlobalScale(globalThemeScaleStepPercent)">
                  <Plus :size="16" />
                </button>
              </footer>
            </article>

            <article class="global-fullscreen-card">
              <span class="font-mark"><Maximize2 :size="18" /></span>
              <div class="global-fullscreen-copy">
                <p class="section-kicker">Immersive View</p>
                <h2>全屏显示</h2>
                <small v-if="fullscreenManagedByPwa">当前 PWA 由安装清单固定为全屏显示；如需恢复系统栏，请卸载后以普通网站模式使用。</small>
                <small v-else>App 与支持的 PWA 会隐藏系统栏；普通网页需浏览器授权，iOS Safari 网页无法隐藏原生状态栏。</small>
              </div>
              <button
                class="fullscreen-switch"
                :class="{ active: fullscreenEnabled }"
                type="button"
                role="switch"
                :aria-checked="fullscreenEnabled"
                :aria-label="fullscreenManagedByPwa ? 'PWA 全屏显示已由安装模式托管' : fullscreenEnabled ? '关闭全屏显示' : '开启全屏显示'"
                :disabled="fullscreenBusy || fullscreenManagedByPwa"
                @click="toggleFullscreen"
              >
                <span></span>
              </button>
            </article>
          </section>

          <header class="font-library-head">
            <div>
              <p class="section-kicker">{{ activeStyleKicker }}</p>
              <h2>{{ activeStyleName }}</h2>
            </div>
            <button class="section-action" type="button" :disabled="!activeStyleSettings.activePresetId" @click="applyThemeStyle(activeDefaultStylePresetId)">恢复默认</button>
          </header>

          <section class="font-card-list" :aria-label="`${activeStyleLabel}样式预设`">
            <article v-for="entry in allStylePresets" :key="entry.id" class="font-card style-preset-card" :class="{ active: entry.id === activeStyleId }">
              <div class="font-card-top">
                <span class="font-mark"><FileCode2 :size="18" /></span>
                <div class="font-copy">
                  <strong>{{ entry.name }}</strong>
                  <small>{{ entry.id === activeDefaultStylePresetId ? '内置默认样式' : formatStyleMeta(entry) }}</small>
                </div>
                <span class="status-pill" :class="entry.id === activeStyleId ? 'enabled' : 'disabled'">
                  {{ entry.id === activeStyleId ? 'Applied' : entry.id === activeDefaultStylePresetId ? 'Default' : 'Saved' }}
                </span>
              </div>
              <pre class="style-code-preview">{{ entry.css }}</pre>
              <footer class="font-card-footer style-card-footer">
                <span>{{ countCssLines(entry.css) }} 行 CSS</span>
                <div v-if="entry.id !== activeDefaultStylePresetId" class="style-card-actions custom-style-actions">
                  <button class="card-action" type="button" :disabled="entry.id === activeStyleId" @click="applyThemeStyle(entry.id)">
                    <span>{{ entry.id === activeStyleId ? '已应用' : '应用' }}</span>
                  </button>
                  <button class="card-action" type="button" @click="openStyleEditor(entry)">
                    <span>编辑</span>
                  </button>
                  <button class="card-action danger" type="button" @click="removeThemeStyle(entry.id)">
                    <span>删除</span>
                  </button>
                </div>
              </footer>
            </article>
          </section>

          <p v-if="activeTab === 'global' && fullscreenFeedback" class="sync-feedback" :class="fullscreenFeedbackError ? 'error' : 'success'">{{ fullscreenFeedback }}</p>
          <p v-else-if="feedbackMessage" class="sync-feedback success">{{ feedbackMessage }}</p>
        </section>
      </section>
    </main>

    <nav class="themes-tabs" aria-label="主题分栏">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="themes-tab"
        :class="{ active: activeTab === tab.id }"
        type="button"
        @click="openTab(tab.id)"
      >
        <component :is="tab.icon" :size="20" stroke-width="2.1" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <AppModal v-model="showImporter" title="导入字体" :show-header="false" fixed-height variant="ins">
      <form class="font-composer font-import-composer" @submit.prevent="submitImporter">
        <section class="composer-hero">
          <span class="composer-avatar"><Type :size="26" /></span>
          <div>
            <span>Font Library</span>
            <strong>{{ activeImportTab === 'link' ? '链接导入' : '文件导入' }}</strong>
            <p>{{ activeImportTab === 'link' ? '支持 CSS 字体链接或单个字体文件链接。' : '支持 WOFF、WOFF2、TTF、OTF 本地文件。' }}</p>
          </div>
        </section>

        <nav class="composer-tabs" aria-label="字体导入方式">
          <button
            v-for="tab in importTabs"
            :key="tab.id"
            class="composer-tab"
            :class="{ active: activeImportTab === tab.id }"
            type="button"
            @click="activeImportTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </nav>

        <section v-if="activeImportTab === 'link'" class="composer-section form-grid">
          <label class="field">
            <span>字体名称</span>
            <input v-model="linkName" placeholder="例如：霞鹜文楷" />
          </label>

          <label class="field">
            <span>字体链接</span>
            <textarea v-model="linkUrls" rows="5" placeholder="每行一个 .woff2 / .ttf / CSS 链接"></textarea>
          </label>
        </section>

        <section v-else class="composer-section form-grid">
          <label class="field">
            <span>字体名称</span>
            <input v-model="fileName" placeholder="留空则使用文件名" />
          </label>

          <label class="file-drop-card">
            <Upload :size="18" />
            <strong>选择字体文件</strong>
            <span>{{ selectedFontFiles.length ? `${selectedFontFiles.length} 个文件待导入` : 'WOFF / WOFF2 / TTF / OTF' }}</span>
            <input type="file" multiple :accept="fontFileAccept" @change="selectFontFiles" />
          </label>

          <div v-if="selectedFontFiles.length" class="selected-file-list">
            <span v-for="file in selectedFontFiles" :key="`${file.name}-${file.size}-${file.lastModified}`">{{ file.name }}</span>
          </div>
        </section>

        <p v-if="importError" class="sync-feedback error">{{ importError }}</p>

        <div class="composer-footer">
          <button class="footer-button footer-cancel" type="button" @click="showImporter = false">取消</button>
          <button class="footer-button footer-save" type="submit" :disabled="isImportingFont">{{ isImportingFont ? '检测中...' : '导入' }}</button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showStyleImporter" :title="editingStylePresetId ? `编辑${activeStyleLabel}样式` : `添加${activeStyleLabel}样式`" :show-header="false" fixed-height variant="ins">
      <form class="font-composer style-import-composer" @submit.prevent="submitStyleImporter">
        <section class="composer-hero">
          <span class="composer-avatar"><FileCode2 :size="26" /></span>
          <div>
            <span>{{ activeStyleKicker }}</span>
            <strong>{{ editingStylePresetId ? '编辑代码' : activeStyleImportTab === 'code' ? '完整代码' : 'PNG 导入' }}</strong>
            <p>{{ editingStylePresetId ? `修改名称或 CSS 后保存这个${activeStyleLabel}样式。` : activeStyleImportTab === 'code' ? `粘贴完整 CSS 后保存为${activeStyleLabel}样式。` : `选择别人分享的 LINK ${activeStyleLabel}样式 PNG。` }}</p>
          </div>
        </section>

        <nav v-if="!editingStylePresetId" class="composer-tabs" :aria-label="`${activeStyleLabel}样式导入方式`">
          <button class="composer-tab" :class="{ active: activeStyleImportTab === 'code' }" type="button" @click="activeStyleImportTab = 'code'">代码</button>
          <button class="composer-tab" :class="{ active: activeStyleImportTab === 'png' }" type="button" @click="activeStyleImportTab = 'png'">PNG</button>
        </nav>

        <section v-if="activeStyleImportTab === 'code'" class="composer-section form-grid">
          <label class="field">
            <span>样式名称</span>
            <input v-model="styleNameDraft" :placeholder="activeStyleScopeId === 'global' ? '例如：薄荷全站主题' : activeStyleScopeId === 'offline' ? '例如：月雾小说页' : '例如：浅雾绿聊天页'" />
          </label>
          <label class="field style-code-field">
            <span>完整 CSS</span>
            <textarea v-model="styleCssDraft" rows="12" spellcheck="false" placeholder="粘贴完整 CSS 代码"></textarea>
          </label>
        </section>

        <section v-else class="composer-section form-grid">
          <button class="file-drop-card" type="button" @click="chooseStylePngFile">
            <Upload :size="18" />
            <strong>选择 PNG 样式图片</strong>
            <span>{{ selectedStylePngFile ? selectedStylePngFile.name : `导入别人分享的${activeStyleLabel}样式` }}</span>
          </button>
          <input ref="stylePngInput" class="native-fallback-file-input" type="file" accept="image/png,.png" @change="selectStylePngFile" />
        </section>

        <p v-if="styleImportError" class="sync-feedback error">{{ styleImportError }}</p>

        <div class="composer-footer">
          <button class="footer-button footer-cancel" type="button" @click="showStyleImporter = false">取消</button>
          <button class="footer-button footer-save" type="submit" :disabled="isImportingStyle">{{ isImportingStyle ? '处理中...' : editingStylePresetId ? '保存修改' : '保存' }}</button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showStyleExporter" :title="`分享${activeStyleLabel}样式`" :show-header="false" fixed-height variant="ins">
      <section class="font-composer style-export-composer">
        <section class="composer-hero">
          <span class="composer-avatar"><Share2 :size="26" /></span>
          <div>
            <span>Share Style</span>
            <strong>导出 PNG</strong>
            <p>选择一个或多个已保存的{{ activeStyleLabel }}样式预设，导出的 PNG 可被其他用户导入。</p>
          </div>
        </section>

        <section ref="styleExportScrollShell" class="composer-section export-scroll-shell">
          <template v-if="stylePresets.length">
            <section class="export-preset-list" :aria-label="`选择导出的${activeStyleLabel}样式`">
              <label v-for="entry in stylePresets" :key="entry.id" class="export-preset-item">
                <input type="checkbox" :value="entry.id" v-model="selectedExportStyleIds" />
                <span>
                  <strong>{{ entry.name }}</strong>
                  <small>{{ countCssLines(entry.css) }} 行 CSS · {{ formatStyleMeta(entry) }}</small>
                </span>
              </label>
            </section>
            <section class="export-cover-panel">
              <div class="field export-cover-copy">
                <span>分享封面（可选）</span>
                <small>选择一张图片作为导出 PNG 的展示封面，样式数据会隐藏写入图片中，导入时仍可识别。</small>
              </div>
              <label class="file-drop-card export-cover-picker">
                <Upload :size="18" />
                <strong>{{ selectedStyleExportCoverFile ? '更换分享封面' : '选择分享封面图片' }}</strong>
                <span>{{ selectedStyleExportCoverFile ? selectedStyleExportCoverFile.name : '支持相册图片，导出时会统一转成 PNG' }}</span>
                <input type="file" accept="image/*" @change="selectStyleExportCoverFile" />
              </label>
              <section v-if="styleExportCoverPreview" class="export-cover-preview">
                <img :src="styleExportCoverPreview" alt="" />
                <div>
                  <strong>{{ selectedStyleExportCoverFile ? selectedStyleExportCoverFile.name : '已选择分享封面' }}</strong>
                  <small>导出时会叠加样式标题，并把样式数据写入图片。</small>
                </div>
                <button class="card-action" type="button" @click="clearStyleExportCover">移除图片</button>
              </section>
            </section>
          </template>
          <section v-else class="empty-shell">
            <strong>还没有可分享的自定义样式</strong>
            <p>先通过右上角 + 添加{{ activeStyleLabel }}样式，再导出 PNG。</p>
          </section>
        </section>

        <p v-if="styleExportError" class="sync-feedback error">{{ styleExportError }}</p>

        <div class="composer-footer">
          <button class="footer-button footer-cancel" type="button" @click="showStyleExporter = false">取消</button>
          <button class="footer-button footer-save" type="button" :disabled="!stylePresets.length || isExportingStyle" @click="exportSelectedThemeStyles">{{ isExportingStyle ? '导出中...' : '导出 PNG' }}</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="fontLoadError.open" title="字体加载失败" variant="ins">
      <section class="font-error-sheet">
        <strong>{{ fontLoadError.name }}</strong>
        <p>{{ fontLoadError.summary }}</p>
        <dl>
          <div>
            <dt>字体名称</dt>
            <dd>{{ fontLoadError.name || '未填写' }}</dd>
          </div>
          <div v-if="fontLoadError.url">
            <dt>字体来源</dt>
            <dd>{{ fontLoadError.url }}</dd>
          </div>
          <div>
            <dt>浏览器返回</dt>
            <dd>{{ fontLoadError.detail }}</dd>
          </div>
        </dl>
        <p class="font-error-tip">请确认链接未过期并且返回 WOFF、WOFF2、TTF、OTF 或字体 CSS，也可以改用本地字体文件导入。</p>
        <button class="footer-button footer-save" type="button" @click="fontLoadError.open = false">知道了</button>
      </section>
    </AppModal>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FileCode2, Globe2, LoaderCircle, Maximize2, Minus, Moon, Plus, Share2, Type, Upload, Wifi } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import { useAppStore } from '@/stores/appStore';
import { pickNativePngFile, shareNativeDataUrl } from '@/services/nativeFile';
import { getLastNativeDisplayState } from '@/services/nativeDisplay';
import { getFullscreenEnvironment, setFullscreenEnabled } from '@/services/systemBars';
import { cacheThemeFontEntry, cacheThemeFontFile, getThemeFontCss, getThemeFontFileUrl, hasPersistedThemeFontCache, isThemeFontStylesheetEntry } from '@/services/themeFontCache';
import type { AppSettings, AppThemeSettings, ThemeFontEntry, ThemeFontSource, ThemeStylePreset, ThemeStyleScopeSettings } from '@/types/domain';
import { createId } from '@/utils/id';
import { downloadDataUrl } from '@/utils/download';
import { normalizeAppSettings } from '@/utils/settings';
import { globalThemeScaleStepPercent, maxGlobalThemeScalePercent, minGlobalThemeScalePercent, normalizeGlobalThemeScalePercent } from '@/utils/themeScale';
import {
  decodeThemeStylePresetsFromPng,
  defaultGlobalThemeCss,
  defaultGlobalThemePresetId,
  defaultOfflineThemeCss,
  defaultOfflineThemePresetId,
  defaultOnlineThemeCss,
  defaultOnlineThemePresetId,
  encodeThemeStylePresetsToPng,
  globalThemeStarterCss
} from '@/utils/themeStyles';

type ThemeTab = 'font' | 'global' | 'online' | 'offline';
type ImportTab = 'link' | 'file';
type StyleImportTab = 'code' | 'png';
type StyleScopeId = 'global' | 'online' | 'offline';

interface FontLoadErrorState {
  open: boolean;
  name: string;
  family: string;
  url: string;
  summary: string;
  detail: string;
}

const tabs = [
  { id: 'font' as ThemeTab, label: '字体', icon: Type },
  { id: 'global' as ThemeTab, label: '全局', icon: Globe2 },
  { id: 'online' as ThemeTab, label: '线上', icon: Wifi },
  { id: 'offline' as ThemeTab, label: '线下', icon: Moon }
];

const importTabs = [
  { id: 'link' as ImportTab, label: '链接导入' },
  { id: 'file' as ImportTab, label: '文件导入' }
];

const fontFileAccept = '.woff,.woff2,.ttf,.otf,font/woff,font/woff2,font/ttf,font/otf,application/font-woff,application/x-font-ttf,application/x-font-otf';
const supportedFontExtensions = ['woff', 'woff2', 'ttf', 'otf'];
const fontMimeByExtension: Record<string, string> = {
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf'
};

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const showImporter = ref(false);
const showStyleImporter = ref(false);
const showStyleExporter = ref(false);
const activeImportTab = ref<ImportTab>('link');
const activeStyleImportTab = ref<StyleImportTab>('code');
const linkName = ref('');
const linkUrls = ref('');
const fileName = ref('');
const selectedFontFiles = ref<File[]>([]);
const selectedStylePngFile = ref<File | null>(null);
const stylePngInput = ref<HTMLInputElement | null>(null);
const importError = ref('');
const styleImportError = ref('');
const styleExportError = ref('');
const feedbackMessage = ref('');
const fullscreenFeedback = ref('');
const fullscreenFeedbackError = ref(false);
const fullscreenBusy = ref(false);
const isImportingFont = ref(false);
const isImportingStyle = ref(false);
const isExportingStyle = ref(false);
const applyingFontId = ref('');
const styleNameDraft = ref('');
const styleCssDraft = ref('');
const editingStylePresetId = ref('');
const selectedExportStyleIds = ref<string[]>([]);
const selectedStyleExportCoverFile = ref<File | null>(null);
const styleExportCoverPreview = ref('');
const styleExportScrollShell = ref<HTMLElement | null>(null);
const fontLoadError = ref<FontLoadErrorState>({
  open: false,
  name: '',
  family: '',
  url: '',
  summary: '',
  detail: ''
});

const currentSettings = computed<AppSettings>(() => normalizeAppSettings(store.settings));
const themeSettings = computed(() => currentSettings.value.themeSettings);
const fontSettings = computed(() => themeSettings.value.fonts);
const fontEntries = computed(() => fontSettings.value.entries);
const globalScalePercent = computed(() => normalizeGlobalThemeScalePercent((themeSettings.value.global?.scale ?? 1) * 100));
const globalScaleLabel = computed(() => formatGlobalScalePercent(globalScalePercent.value));
const fullscreenEnvironment = computed(() => getFullscreenEnvironment());
const fullscreenManagedByPwa = computed(() => fullscreenEnvironment.value === 'pwa');
const fullscreenEnabled = computed(() => fullscreenManagedByPwa.value || Boolean(themeSettings.value.global?.fullscreen));
const activeTab = computed<ThemeTab>(() => {
  const tab = String(route.query.tab ?? 'font');
  return tabs.some((item) => item.id === tab) ? tab as ThemeTab : 'font';
});
const activeFontEntry = computed(() => fontEntries.value.find((entry) => entry.id === fontSettings.value.activeFontId) ?? null);
const isStyleTab = computed(() => activeTab.value !== 'font');
const activeStyleScopeId = computed<StyleScopeId>(() => activeTab.value === 'global' ? 'global' : activeTab.value === 'offline' ? 'offline' : 'online');
const activeStyleLabel = computed(() => getThemeStyleScopeLabel(activeStyleScopeId.value));
const activeStyleKicker = computed(() => activeStyleScopeId.value === 'global' ? 'Global Style' : activeStyleScopeId.value === 'offline' ? 'Offline Style' : 'Online Style');
const activeStyleSettings = computed(() => getThemeStyleScope(themeSettings.value, activeStyleScopeId.value));
const stylePresets = computed(() => activeStyleSettings.value.presets);
const activeDefaultStylePresetId = computed(() => activeStyleScopeId.value === 'global' ? defaultGlobalThemePresetId : activeStyleScopeId.value === 'offline' ? defaultOfflineThemePresetId : defaultOnlineThemePresetId);
const activeDefaultStyleCss = computed(() => activeStyleScopeId.value === 'global' ? defaultGlobalThemeCss : activeStyleScopeId.value === 'offline' ? defaultOfflineThemeCss : defaultOnlineThemeCss);
const defaultStylePreset = computed<ThemeStylePreset>(() => ({
  id: activeDefaultStylePresetId.value,
  name: `默认${activeStyleLabel.value}样式`,
  css: activeDefaultStyleCss.value,
  source: 'custom',
  createdAt: 0,
  updatedAt: 0
}));
const allStylePresets = computed(() => [defaultStylePreset.value, ...stylePresets.value]);
const activeStyleId = computed(() => activeStyleSettings.value.activePresetId || activeDefaultStylePresetId.value);
const activeStylePreset = computed(() => allStylePresets.value.find((entry) => entry.id === activeStyleId.value) ?? defaultStylePreset.value);
const activeStyleName = computed(() => activeStylePreset.value.name);

onMounted(async () => {
  await store.hydrate();
  await validateActiveFontOnOpen();
});

watch(showStyleExporter, (open) => {
  if (open) {
    void nextTick(() => {
      styleExportScrollShell.value?.scrollTo({ top: 0 });
    });
    return;
  }
  selectedExportStyleIds.value = [];
  selectedStyleExportCoverFile.value = null;
  styleExportCoverPreview.value = '';
  styleExportError.value = '';
  isExportingStyle.value = false;
});

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.push({ name: 'home' });
}

function openTab(tab: ThemeTab) {
  if (tab === activeTab.value) return;
  void router.replace({ name: 'themes', query: tab === 'font' ? {} : { tab } });
}

function cloneFontEntry(entry: ThemeFontEntry): ThemeFontEntry {
  return { ...entry };
}

function cloneStylePreset(entry: ThemeStylePreset): ThemeStylePreset {
  return { ...entry };
}

function cloneStyleScope(scope: ThemeStyleScopeSettings): ThemeStyleScopeSettings {
  return {
    activePresetId: scope.activePresetId,
    presets: scope.presets.map(cloneStylePreset)
  };
}

function getThemeStyleScope(settings: AppThemeSettings, scopeId: StyleScopeId) {
  return scopeId === 'global' ? settings.global.style : settings[scopeId];
}

function getThemeStyleScopeLabel(scopeId: StyleScopeId) {
  if (scopeId === 'global') return '全站';
  return scopeId === 'offline' ? '线下' : '线上';
}

function cloneThemeSettings(settings: AppThemeSettings): AppThemeSettings {
  return {
    fonts: {
      activeFontId: settings.fonts.activeFontId,
      entries: settings.fonts.entries.map(cloneFontEntry)
    },
    global: {
      scale: settings.global.scale,
      fullscreen: settings.global.fullscreen,
      style: cloneStyleScope(settings.global.style)
    },
    online: cloneStyleScope(settings.online),
    offline: cloneStyleScope(settings.offline)
  };
}

function clampGlobalScalePercent(value: number) {
  return normalizeGlobalThemeScalePercent(value);
}

function formatGlobalScalePercent(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

async function setGlobalScale(percent: number) {
  const nextPercent = clampGlobalScalePercent(percent);
  if (nextPercent === globalScalePercent.value) return;
  const nextThemeSettings = cloneThemeSettings(themeSettings.value);
  nextThemeSettings.global.scale = nextPercent / 100;
  await saveThemeSettings(nextThemeSettings);
  feedbackMessage.value = nextPercent === 100 ? '已恢复默认显示大小。' : `已调整为 ${nextPercent}% 显示大小。`;
}

async function toggleFullscreen() {
  if (fullscreenBusy.value) return;
  fullscreenBusy.value = true;
  fullscreenFeedback.value = '';
  fullscreenFeedbackError.value = false;
  const previous = fullscreenEnabled.value;
  const next = !previous;
  try {
    if (next) {
      const applied = await setFullscreenEnabled(true, { requestBrowserFullscreen: true });
      if (!applied) {
        await setFullscreenEnabled(false);
        fullscreenFeedback.value = getFullscreenEnvironment() === 'unsupported'
          ? '当前浏览器不支持网页全屏；iOS Safari 网页不能隐藏原生状态栏，请使用 BabyLink App 或安装支持全屏显示的 PWA。'
          : '浏览器拒绝了全屏授权，请从页面按钮重新尝试，或使用 BabyLink App。';
        fullscreenFeedbackError.value = true;
        return;
      }
    }
    const nextThemeSettings = cloneThemeSettings(themeSettings.value);
    nextThemeSettings.global.fullscreen = next;
    await saveThemeSettings(nextThemeSettings);
    if (!next) await setFullscreenEnabled(false);
    const nativeState = getLastNativeDisplayState();
    if (next && nativeState?.applied === false && (nativeState.statusBarVisible || nativeState.navigationBarVisible)) {
      fullscreenFeedback.value = `已开启持续沉浸模式，系统栏正在重试隐藏（状态栏：${nativeState.statusBarVisible ? '仍显示' : '已隐藏'}；导航栏：${nativeState.navigationBarVisible ? '仍显示' : '已隐藏'}）。`;
      fullscreenFeedbackError.value = true;
    } else {
      fullscreenFeedback.value = next ? '已开启全屏显示。' : '已关闭全屏显示。';
    }
  } catch (error) {
    await setFullscreenEnabled(previous, { requestBrowserFullscreen: previous });
    fullscreenFeedback.value = error instanceof Error && error.message ? error.message : '全屏设置保存失败，请重试。';
    fullscreenFeedbackError.value = true;
  } finally {
    fullscreenBusy.value = false;
  }
}

function updateGlobalScaleFromInput(event: Event) {
  const input = event.target as HTMLInputElement;
  void setGlobalScale(Number(input.value));
}

function nudgeGlobalScale(delta: number) {
  void setGlobalScale(globalScalePercent.value + delta);
}

function sanitizeFontFamily(value: string) {
  return value.replace(/[{};]/g, '').replace(/\s+/g, ' ').trim();
}

function escapeCssString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function getQuotedFontFamily(family: string) {
  return `"${escapeCssString(family)}"`;
}

function getFileExtension(fileNameValue: string) {
  return fileNameValue.split('.').pop()?.trim().toLowerCase() ?? '';
}

function stripFontExtension(fileNameValue: string) {
  return fileNameValue.replace(/\.[a-z0-9]+$/i, '').trim();
}

function getFontNameFromUrl(url: string, index: number) {
  try {
    const parsedUrl = new URL(url);
    return stripFontExtension(decodeURIComponent(parsedUrl.pathname.split('/').pop() ?? '')) || parsedUrl.hostname || `字体 ${index + 1}`;
  } catch {
    return stripFontExtension(url.split('/').pop()?.split('?')[0] ?? '') || `字体 ${index + 1}`;
  }
}

function splitFontUrls(value: string) {
  return [...new Set(value.split(/\n+/).map((url) => url.trim()).filter(Boolean))];
}

function createFontEntry(options: { name: string; family?: string; source: ThemeFontSource; url?: string; mimeType?: string; size?: number }): ThemeFontEntry {
  const now = Date.now();
  const name = options.name.trim() || '自定义字体';
  const family = sanitizeFontFamily(options.family || name);
  return {
    id: createId('theme-font'),
    name,
    family,
    source: options.source,
    url: options.source === 'family' ? '' : String(options.url ?? '').trim(),
    mimeType: String(options.mimeType ?? '').trim(),
    size: Math.max(0, Math.round(Number(options.size ?? 0) || 0)),
    enabled: true,
    createdAt: now,
    updatedAt: now
  };
}

async function saveThemeSettings(nextThemeSettings: AppThemeSettings) {
  await store.saveSettings({
    ...currentSettings.value,
    themeSettings: nextThemeSettings
  });
}

function getThemeSaveErrorMessage(error: unknown) {
  if (error instanceof DOMException && ['QuotaExceededError', 'UnknownError'].includes(error.name)) {
    return '主题内容没有写入本机存储，可能是浏览器空间不足或导入内容过大。请删除一些本地数据后重试。';
  }
  return error instanceof Error && error.message ? error.message : '主题设置没有写入本机存储，请重试。';
}

async function trySaveThemeSettings(nextThemeSettings: AppThemeSettings, target: 'font' | 'style' = 'font') {
  try {
    await saveThemeSettings(nextThemeSettings);
    return true;
  } catch (error) {
    const message = getThemeSaveErrorMessage(error);
    if (target === 'style') styleImportError.value = message;
    else importError.value = message;
    return false;
  }
}

function openImporter() {
  activeImportTab.value = 'link';
  importError.value = '';
  feedbackMessage.value = '';
  showImporter.value = true;
}

function openActiveImporter() {
  if (isStyleTab.value) {
    openStyleImporter();
    return;
  }
  openImporter();
}

function openStyleImporter() {
  activeStyleImportTab.value = 'code';
  editingStylePresetId.value = '';
  styleNameDraft.value = '';
  styleCssDraft.value = activeStyleScopeId.value === 'global' ? globalThemeStarterCss : activeDefaultStyleCss.value;
  selectedStylePngFile.value = null;
  styleImportError.value = '';
  feedbackMessage.value = '';
  showStyleImporter.value = true;
}

function openStyleEditor(entry: ThemeStylePreset) {
  if (entry.id === activeDefaultStylePresetId.value) return;
  activeStyleImportTab.value = 'code';
  editingStylePresetId.value = entry.id;
  styleNameDraft.value = entry.name;
  styleCssDraft.value = entry.css;
  selectedStylePngFile.value = null;
  styleImportError.value = '';
  feedbackMessage.value = '';
  showStyleImporter.value = true;
}

function openStyleExporter() {
  selectedExportStyleIds.value = stylePresets.value.map((entry) => entry.id);
  selectedStyleExportCoverFile.value = null;
  styleExportCoverPreview.value = '';
  styleExportError.value = '';
  showStyleExporter.value = true;
}

function inferFontMimeType(file: File) {
  return file.type || fontMimeByExtension[getFileExtension(file.name)] || 'font/woff2';
}

function isSupportedFontFile(file: File) {
  return supportedFontExtensions.includes(getFileExtension(file.name));
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('读取字体文件失败')));
    reader.readAsDataURL(file);
  });
}

function createStylePreset(options: { name: string; css: string; source?: ThemeStylePreset['source'] }): ThemeStylePreset {
  const now = Date.now();
  return {
    id: createId('theme-style'),
    name: options.name.trim() || `自定义${activeStyleLabel.value}样式`,
    css: options.css.trim(),
    source: options.source ?? 'custom',
    createdAt: now,
    updatedAt: now
  };
}

function selectFontFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedFontFiles.value = Array.from(input.files ?? []);
  input.value = '';
  importError.value = '';
}

function selectStylePngFile(event: Event) {
  const input = event.target as HTMLInputElement;
  selectedStylePngFile.value = input.files?.[0] ?? null;
  input.value = '';
  styleImportError.value = '';
}

async function chooseStylePngFile() {
  styleImportError.value = '';
  try {
    const file = await pickNativePngFile();
    if (file === undefined) {
      stylePngInput.value?.click();
      return;
    }
    if (file) selectedStylePngFile.value = file;
  } catch (error) {
    styleImportError.value = error instanceof Error ? error.message : '无法打开系统 PNG 文件选择器。';
  }
}

async function selectStyleExportCoverFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (!file) return;
  if (file.type && !file.type.startsWith('image/')) {
    styleExportError.value = '请选择图片文件作为分享封面。';
    return;
  }
  try {
    selectedStyleExportCoverFile.value = file;
    styleExportCoverPreview.value = await readFileAsDataUrl(file);
    styleExportError.value = '';
  } catch (error) {
    selectedStyleExportCoverFile.value = null;
    styleExportCoverPreview.value = '';
    styleExportError.value = error instanceof Error ? error.message : '分享封面图片读取失败。';
  }
}

function clearStyleExportCover() {
  selectedStyleExportCoverFile.value = null;
  styleExportCoverPreview.value = '';
  styleExportError.value = '';
}

async function submitImporter() {
  if (isImportingFont.value) return;
  isImportingFont.value = true;
  try {
    if (activeImportTab.value === 'link') {
      await importFontLinks();
      return;
    }
    await importFontFiles();
  } finally {
    isImportingFont.value = false;
  }
}

async function submitStyleImporter() {
  if (isImportingStyle.value) return;
  isImportingStyle.value = true;
  try {
    if (editingStylePresetId.value) {
      await updateThemeStyleFromCode();
      return;
    }
    if (activeStyleImportTab.value === 'png') {
      await importThemeStylesFromPng();
      return;
    }
    await importThemeStyleFromCode();
  } finally {
    isImportingStyle.value = false;
  }
}

async function importThemeStyleFromCode() {
  const css = styleCssDraft.value.trim();
  if (!css) {
    styleImportError.value = '请先填写完整 CSS 样式代码。';
    return;
  }
  const entry = createStylePreset({ name: styleNameDraft.value, css });
  const nextThemeSettings = cloneThemeSettings(themeSettings.value);
  const scope = getThemeStyleScope(nextThemeSettings, activeStyleScopeId.value);
  scope.presets = [entry, ...scope.presets];
  scope.activePresetId = entry.id;
  if (!await trySaveThemeSettings(nextThemeSettings, 'style')) return;
  resetStyleImporterDraft();
  feedbackMessage.value = `已保存并应用 ${entry.name}。`;
}

async function updateThemeStyleFromCode() {
  const css = styleCssDraft.value.trim();
  if (!css) {
    styleImportError.value = '请先填写完整 CSS 样式代码。';
    return;
  }
  const nextThemeSettings = cloneThemeSettings(themeSettings.value);
  const scope = getThemeStyleScope(nextThemeSettings, activeStyleScopeId.value);
  const entry = scope.presets.find((item) => item.id === editingStylePresetId.value);
  if (!entry) {
    styleImportError.value = '没有找到要编辑的样式，请关闭后重试。';
    return;
  }
  entry.name = styleNameDraft.value.trim() || `自定义${activeStyleLabel.value}样式`;
  entry.css = css;
  entry.updatedAt = Date.now();
  if (!await trySaveThemeSettings(nextThemeSettings, 'style')) return;
  const updatedName = entry.name;
  resetStyleImporterDraft();
  feedbackMessage.value = `已更新 ${updatedName}。`;
}

async function importThemeStylesFromPng() {
  const file = selectedStylePngFile.value;
  if (!file) {
    styleImportError.value = '请先选择 PNG 样式图片。';
    return;
  }
  if (file.type && file.type !== 'image/png') {
    styleImportError.value = '请选择 PNG 格式的样式图片。';
    return;
  }
  try {
    const decoded = await decodeThemeStylePresetsFromPng(await readFileAsDataUrl(file));
    if (decoded.scope && decoded.scope !== activeStyleScopeId.value) {
      styleImportError.value = `这张 PNG 是${getThemeStyleScopeLabel(decoded.scope)}样式，请切换到对应标签后再导入。`;
      return;
    }
    const importedPresets = decoded.presets
      .map((entry, index) => createStylePreset({
        name: String(entry.name ?? '').trim() || `导入样式 ${index + 1}`,
        css: String(entry.css ?? '').trim(),
        source: 'imported'
      }))
      .filter((entry) => entry.css);
    if (!importedPresets.length) {
      styleImportError.value = `PNG 中没有可用的${activeStyleLabel.value}样式。`;
      return;
    }
    const nextThemeSettings = cloneThemeSettings(themeSettings.value);
    const scope = getThemeStyleScope(nextThemeSettings, activeStyleScopeId.value);
    scope.presets = [...importedPresets, ...scope.presets];
    scope.activePresetId = importedPresets[0].id;
    if (!await trySaveThemeSettings(nextThemeSettings, 'style')) return;
    resetStyleImporterDraft();
    feedbackMessage.value = `已导入并应用 ${importedPresets[0].name}。`;
  } catch (error) {
    styleImportError.value = error instanceof Error ? error.message : 'PNG 样式图片导入失败。';
  }
}

function resetStyleImporterDraft() {
  editingStylePresetId.value = '';
  styleNameDraft.value = '';
  styleCssDraft.value = '';
  selectedStylePngFile.value = null;
  styleImportError.value = '';
  showStyleImporter.value = false;
}

function getFontLoadDetail(error: unknown) {
  if (error instanceof Error) return [error.name, error.message].filter(Boolean).join(': ');
  return String(error || '浏览器没有返回更多错误信息。');
}

function openFontLoadError(entry: ThemeFontEntry, summary: string, error: unknown) {
  fontLoadError.value = {
    open: true,
    name: entry.name || '自定义字体',
    family: entry.family,
    url: entry.url,
    summary,
    detail: getFontLoadDetail(error)
  };
  importError.value = summary;
  feedbackMessage.value = '';
}

const localFontLoadTimeoutMs = 12_000;
const remoteFontLoadTimeoutMs = 5 * 60 * 1000;

function withFontLoadTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

function getFontLoadTimeout(entry: ThemeFontEntry) {
  return entry.source === 'url'
    ? { ms: remoteFontLoadTimeoutMs, label: '5 分钟' }
    : { ms: localFontLoadTimeoutMs, label: '12 秒' };
}

async function validateFontFileEntry(entry: ThemeFontEntry) {
  const fontUrl = getThemeFontFileUrl(entry);
  const fontFace = new FontFace(entry.family, `url("${escapeCssString(fontUrl)}")`, { display: 'swap' });
  document.fonts.add(fontFace);
  try {
    const timeout = getFontLoadTimeout(entry);
    await withFontLoadTimeout(fontFace.load(), timeout.ms, `字体文件加载超时，浏览器在 ${timeout.label} 内没有完成读取：${fontUrl}`);
    if (fontFace.status !== 'loaded') throw new Error(`字体状态为 ${fontFace.status}，没有完成加载。`);
  } finally {
    document.fonts.delete(fontFace);
  }
}

function loadTemporaryStylesheet(url: string) {
  return new Promise<HTMLLinkElement>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.addEventListener('load', () => resolve(link), { once: true });
    link.addEventListener('error', () => reject(new Error(`CSS 字体链接加载失败：${url}`)), { once: true });
    document.head.appendChild(link);
  });
}

async function validateStylesheetFontEntry(entry: ThemeFontEntry) {
  let link: HTMLLinkElement | null = null;
  let style: HTMLStyleElement | null = null;
  try {
    const cachedCss = getThemeFontCss(entry);
    if (cachedCss) {
      style = document.createElement('style');
      style.textContent = cachedCss;
      document.head.appendChild(style);
    } else {
      link = await withFontLoadTimeout(loadTemporaryStylesheet(entry.url), remoteFontLoadTimeoutMs, `CSS 字体链接加载超时，浏览器在 5 分钟内没有完成下载：${entry.url}`);
    }
    const loadedFaces = await withFontLoadTimeout(document.fonts.load(`16px ${getQuotedFontFamily(entry.family)}`, 'LINK 字体检测'), remoteFontLoadTimeoutMs, `CSS 已下载，但字体名称「${entry.name}」没有在 5 分钟内完成加载。`);
    if (!loadedFaces.length) throw new Error(`CSS 已下载，但没有找到字体名称「${entry.name}」对应的字体。`);
  } finally {
    link?.remove();
    style?.remove();
  }
}

async function validateFontEntryCanLoad(entry: ThemeFontEntry, context: string) {
  if (entry.source === 'family') return true;
  if (!entry.url.trim()) {
    openFontLoadError(entry, `${context}失败：字体链接为空。`, new Error('没有可加载的字体 URL。'));
    return false;
  }
  if (!entry.family.trim()) {
    openFontLoadError(entry, `${context}失败：字体名称为空。`, new Error('浏览器需要字体名称才能应用字体。'));
    return false;
  }
  if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !document.fonts) return true;

  try {
    if (entry.source === 'url' && isThemeFontStylesheetEntry(entry)) await validateStylesheetFontEntry(entry);
    else await validateFontFileEntry(entry);
    return true;
  } catch (error) {
    openFontLoadError(entry, `${context}失败：浏览器没有成功加载这个字体。`, error);
    return false;
  }
}

async function validateFontEntriesCanLoad(entries: ThemeFontEntry[], context: string) {
  for (const entry of entries) {
    if (!await validateFontEntryCanLoad(entry, context)) return false;
  }
  return true;
}

async function cacheFontEntryForUse(entry: ThemeFontEntry, context: string) {
  try {
    return await cacheThemeFontEntry(entry);
  } catch (error) {
    openFontLoadError(entry, `${context}失败：字体没有缓存到本机。`, error);
    return null;
  }
}

async function importFontLinks() {
  const urls = splitFontUrls(linkUrls.value);
  if (!urls.length) {
    importError.value = '请先填写字体链接。';
    return;
  }

  const nextThemeSettings = cloneThemeSettings(themeSettings.value);
  const newEntries = urls.map((url, index) => {
    const fallbackName = getFontNameFromUrl(url, index);
    const name = linkName.value.trim() || fallbackName;
    return createFontEntry({
      name: urls.length > 1 && !linkName.value.trim() ? `${name} ${index + 1}` : name,
      source: 'url',
      url
    });
  });

  const cachedEntries: ThemeFontEntry[] = [];
  for (const entry of newEntries) {
    const cachedEntry = await cacheFontEntryForUse(entry, '导入');
    if (!cachedEntry) return;
    cachedEntries.push(cachedEntry);
  }
  if (!await validateFontEntriesCanLoad(cachedEntries, '导入')) return;

  nextThemeSettings.fonts.entries = [...cachedEntries, ...nextThemeSettings.fonts.entries];
  nextThemeSettings.fonts.activeFontId = cachedEntries[0]?.id ?? nextThemeSettings.fonts.activeFontId;
  if (!await trySaveThemeSettings(nextThemeSettings)) return;
  resetImporterDraft();
  feedbackMessage.value = `已缓存并应用 ${cachedEntries[0]?.name ?? '字体'}。`;
}

async function importFontFiles() {
  const files = selectedFontFiles.value;
  if (!files.length) {
    importError.value = '请先选择字体文件。';
    return;
  }
  const unsupportedFile = files.find((file) => !isSupportedFontFile(file));
  if (unsupportedFile) {
    importError.value = `${unsupportedFile.name} 不是支持的字体格式。`;
    return;
  }

  const nextThemeSettings = cloneThemeSettings(themeSettings.value);
  const newEntries: ThemeFontEntry[] = [];
  for (const [index, file] of files.entries()) {
    const fallbackName = stripFontExtension(file.name) || `字体 ${index + 1}`;
    const name = fileName.value.trim() || fallbackName;
    const entry = createFontEntry({
      name: files.length > 1 && !fileName.value.trim() ? `${name} ${index + 1}` : name,
      source: 'file',
      url: '',
      mimeType: inferFontMimeType(file),
      size: file.size
    });
    try {
      newEntries.push(await cacheThemeFontFile(entry, file));
    } catch (error) {
      openFontLoadError(entry, '导入失败：字体没有缓存到本机。', error);
      return;
    }
  }

  if (!await validateFontEntriesCanLoad(newEntries, '导入')) return;

  nextThemeSettings.fonts.entries = [...newEntries, ...nextThemeSettings.fonts.entries];
  nextThemeSettings.fonts.activeFontId = newEntries[0]?.id ?? nextThemeSettings.fonts.activeFontId;
  if (!await trySaveThemeSettings(nextThemeSettings)) return;
  resetImporterDraft();
  feedbackMessage.value = `已缓存并应用 ${newEntries[0]?.name ?? '字体'}。`;
}

function resetImporterDraft() {
  linkName.value = '';
  linkUrls.value = '';
  fileName.value = '';
  selectedFontFiles.value = [];
  importError.value = '';
  showImporter.value = false;
}

async function applyFont(fontId: string) {
  if (applyingFontId.value) return;
  const nextThemeSettings = cloneThemeSettings(themeSettings.value);
  const entry = nextThemeSettings.fonts.entries.find((item) => item.id === fontId);
  if (!entry) return;
  applyingFontId.value = fontId;
  try {
    const cachedEntry = await cacheFontEntryForUse(entry, '应用');
    if (!cachedEntry || !await validateFontEntryCanLoad(cachedEntry, '应用')) return;
    Object.assign(entry, cachedEntry);
    entry.enabled = true;
    entry.updatedAt = Date.now();
    nextThemeSettings.fonts.activeFontId = fontId;
    await saveThemeSettings(nextThemeSettings);
    feedbackMessage.value = `已应用 ${entry.name}。`;
  } finally {
    applyingFontId.value = '';
  }
}

async function validateActiveFontOnOpen() {
  let activeEntry = activeFontEntry.value;
  if (!activeEntry) return;
  if (!hasPersistedThemeFontCache(activeEntry)) {
    const cachedEntry = await cacheFontEntryForUse(activeEntry, '当前字体缓存');
    if (!cachedEntry) return;
    const cachedThemeSettings = cloneThemeSettings(themeSettings.value);
    cachedThemeSettings.fonts.entries = cachedThemeSettings.fonts.entries.map((entry) => entry.id === cachedEntry.id ? cachedEntry : entry);
    await saveThemeSettings(cachedThemeSettings);
    activeEntry = cachedEntry;
  }
  if (await validateFontEntryCanLoad(activeEntry, '当前字体检测')) return;
  const nextThemeSettings = cloneThemeSettings(themeSettings.value);
  nextThemeSettings.fonts.activeFontId = '';
  await saveThemeSettings(nextThemeSettings);
  feedbackMessage.value = `字体 ${activeEntry.name} 加载失败，已恢复系统默认。`;
}

async function removeFont(fontId: string) {
  const nextThemeSettings = cloneThemeSettings(themeSettings.value);
  nextThemeSettings.fonts.entries = nextThemeSettings.fonts.entries.filter((entry) => entry.id !== fontId);
  if (nextThemeSettings.fonts.activeFontId === fontId) nextThemeSettings.fonts.activeFontId = '';
  await saveThemeSettings(nextThemeSettings);
}

async function resetFont() {
  const nextThemeSettings = cloneThemeSettings(themeSettings.value);
  nextThemeSettings.fonts.activeFontId = '';
  await saveThemeSettings(nextThemeSettings);
  feedbackMessage.value = '已恢复系统默认字体。';
}

async function applyThemeStyle(styleId: string) {
  const nextThemeSettings = cloneThemeSettings(themeSettings.value);
  const scope = getThemeStyleScope(nextThemeSettings, activeStyleScopeId.value);
  const styleName = styleId === activeDefaultStylePresetId.value
    ? `默认${activeStyleLabel.value}样式`
    : scope.presets.find((entry) => entry.id === styleId)?.name ?? `${activeStyleLabel.value}样式`;
  scope.activePresetId = styleId === activeDefaultStylePresetId.value ? '' : styleId;
  await saveThemeSettings(nextThemeSettings);
  feedbackMessage.value = styleId === activeDefaultStylePresetId.value ? `已恢复默认${activeStyleLabel.value}样式。` : `已应用 ${styleName}。`;
}

async function removeThemeStyle(styleId: string) {
  const nextThemeSettings = cloneThemeSettings(themeSettings.value);
  const scope = getThemeStyleScope(nextThemeSettings, activeStyleScopeId.value);
  scope.presets = scope.presets.filter((entry) => entry.id !== styleId);
  if (scope.activePresetId === styleId) scope.activePresetId = '';
  await saveThemeSettings(nextThemeSettings);
  feedbackMessage.value = `已删除${activeStyleLabel.value}样式。`;
}

function countCssLines(css: string) {
  return css.split('\n').length;
}

function formatStyleMeta(entry: ThemeStylePreset) {
  const time = entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString('zh-CN') : '未知日期';
  return `${entry.source === 'imported' ? '导入' : '自定义'} · ${time}`;
}

function getDownloadFileName(presets: ThemeStylePreset[]) {
  const baseName = presets.length === 1 ? presets[0].name : `LINK${activeStyleLabel.value}样式-${presets.length}个`;
  return `${baseName.replace(/[\/:*?"<>|]+/g, '-').slice(0, 48) || `LINK${activeStyleLabel.value}样式`}.png`;
}

function exportSelectedThemeStyles() {
  if (isExportingStyle.value) return;
  const selectedIds = new Set(selectedExportStyleIds.value);
  const presets = stylePresets.value.filter((entry) => selectedIds.has(entry.id));
  if (!presets.length) {
    styleExportError.value = '请至少选择一个已保存的样式预设。';
    return;
  }
  isExportingStyle.value = true;
  void (async () => {
    try {
      const dataUrl = await encodeThemeStylePresetsToPng(presets, {
        scope: activeStyleScopeId.value,
        coverImageDataUrl: styleExportCoverPreview.value || undefined
      });
      const fileName = getDownloadFileName(presets);
      if (!await shareNativeDataUrl(dataUrl, fileName)) await downloadDataUrl(dataUrl, fileName);
      styleExportError.value = '';
      showStyleExporter.value = false;
      feedbackMessage.value = `已导出 ${presets.length} 个${activeStyleLabel.value}样式 PNG。`;
    } catch (error) {
      styleExportError.value = error instanceof Error ? error.message : '样式 PNG 导出失败。';
    } finally {
      isExportingStyle.value = false;
    }
  })();
}

function fontPreviewStyle(entry: ThemeFontEntry) {
  return { fontFamily: `${getQuotedFontFamily(entry.family)}, var(--app-current-font-family)` };
}

function sourceLabel(entry: ThemeFontEntry) {
  if (entry.source === 'file') return 'File';
  if (entry.source === 'url' && isThemeFontStylesheetEntry(entry)) return 'CSS Link';
  if (entry.source === 'url') return 'Link';
  return 'Text';
}

function formatFileSize(size: number) {
  if (!size) return '';
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatFontMeta(entry: ThemeFontEntry) {
  const size = formatFileSize(entry.size);
  if (entry.source === 'file') return [entry.mimeType || 'Font file', size].filter(Boolean).join(' · ');
  if (entry.source === 'url') return isThemeFontStylesheetEntry(entry) ? ['CSS stylesheet', size].filter(Boolean).join(' · ') : ['Remote font file', size].filter(Boolean).join(' · ');
  return 'System font stack';
}
</script>

<style scoped>
.native-fallback-file-input { display: none; }
.themes-page {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-bottom: 0;
  overflow-x: hidden;
  background:
    radial-gradient(circle at 8% 0%, rgba(255, 218, 227, 0.5), transparent 30%),
    radial-gradient(circle at 94% 10%, rgba(6, 199, 85, 0.14), transparent 28%),
    linear-gradient(180deg, #fbfcfb 0%, #f5f7f6 52%, #edf3f1 100%);
}

.themes-topbar {
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  background: rgba(251, 252, 251, 0.92);
  backdrop-filter: blur(18px);
}

.themes-title-button {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  margin-right: auto;
  padding: 0;
  color: inherit;
  text-align: left;
}

.themes-title-button .top-title {
  margin: 0;
}

.themes-title-button:active {
  opacity: 0.7;
}

.header-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.header-add-button {
  position: relative;
  z-index: 2;
  display: grid;
  place-items: center;
  flex: 0 0 34px;
  width: 34px;
  min-height: 34px;
  padding: 0;
  border-radius: 999px;
  background: transparent;
  color: #057a35;
  font-family: var(--app-current-font-family);
  box-shadow: none;
}

.themes-main {
  flex: 1;
  min-width: 0;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scroll-padding-bottom: calc(76px + var(--safe-bottom));
  padding: 10px 16px calc(76px + var(--safe-bottom));
}

.themes-panel {
  display: grid;
  min-width: 0;
  padding: 16px;
  border: 1px solid rgba(17, 17, 17, 0.04);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 14px 32px rgba(16, 24, 20, 0.06);
}

.loading-panel,
.empty-scope {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 240px;
  color: #69706a;
  font-size: 12px;
  font-weight: 800;
}

.spin {
  animation: spin 0.8s linear infinite;
}

.font-library,
.global-library,
.online-style-library,
.font-card-list {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.global-scale-card {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(17, 17, 17, 0.06);
  border-radius: 20px;
  background:
    radial-gradient(circle at top right, rgba(6, 199, 85, 0.11), transparent 36%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 250, 248, 0.95));
  box-shadow: 0 12px 30px rgba(16, 24, 20, 0.06);
}

.global-fullscreen-card {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(17, 17, 17, 0.06);
  border-radius: 20px;
  background: linear-gradient(145deg, rgba(248, 252, 250, 0.98), rgba(239, 248, 243, 0.96));
  box-shadow: 0 12px 30px rgba(16, 24, 20, 0.05);
}

.global-fullscreen-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.global-fullscreen-copy h2 {
  margin: 0;
  color: #111111;
  font-size: 16px;
  line-height: 1.2;
  font-weight: 900;
}

.global-fullscreen-copy small {
  color: #737b76;
  font-size: 11px;
  line-height: 1.5;
}

.fullscreen-switch {
  position: relative;
  width: 48px;
  height: 28px;
  padding: 0;
  border-radius: 999px;
  background: #d9dedb;
  transition: background 0.2s ease;
}

.fullscreen-switch span {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(18, 35, 26, 0.2);
  transition: transform 0.2s ease;
}

.fullscreen-switch.active {
  background: var(--link-green);
}

.fullscreen-switch.active span {
  transform: translateX(20px);
}

.fullscreen-switch:disabled {
  opacity: 0.55;
}

.global-card-head {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.global-card-head > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.global-card-head h2 {
  margin: 0;
  color: #111111;
  font-size: 16px;
  line-height: 1.2;
  font-weight: 900;
}

.global-card-head > strong {
  color: #057a35;
  font-family: var(--app-current-font-family);
  font-size: 17px;
  font-weight: 900;
}

.scale-range {
  width: 100%;
  height: 28px;
  accent-color: var(--link-green);
}

.scale-range-shell {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.scale-range-meta {
  display: flex;
  justify-content: space-between;
  color: #8a928d;
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
}

.scale-actions {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 42px;
  gap: 8px;
  min-width: 0;
}

.scale-action,
.scale-reset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 38px;
  border-radius: 14px;
  background: #f3f6f4;
  color: #30363d;
  font-family: var(--app-current-font-family);
  font-size: 12px;
  font-weight: 900;
}

.scale-action:disabled,
.scale-reset:disabled {
  opacity: 0.45;
  cursor: default;
}

.font-library-head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.font-library-head > div {
  display: grid;
  gap: 3px;
  min-width: 0;
  margin-right: auto;
}

.section-kicker,
.composer-hero span,
.field span {
  margin: 0;
  color: #9d7a86;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.font-library-head h2 {
  margin: 0;
  overflow: hidden;
  color: #111111;
  font-size: 18px;
  line-height: 1.2;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-action {
  flex: 0 0 auto;
  min-height: 34px;
  padding: 0 10px;
  border-radius: 999px;
  background: #f3f6f4;
  color: #363a40;
  font-family: var(--app-current-font-family);
  font-size: 12px;
  font-weight: 900;
}

.section-action:disabled {
  opacity: 0.42;
  cursor: default;
}

.font-card {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(17, 17, 17, 0.06);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 248, 251, 0.96));
  box-shadow: 0 12px 32px rgba(26, 30, 38, 0.06);
}

.font-card.active {
  border-color: rgba(6, 199, 85, 0.28);
  background:
    radial-gradient(circle at top right, rgba(6, 199, 85, 0.1), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 252, 248, 0.96));
}

.font-card-top {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.font-mark {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 18px;
  background: #eef8f1;
  color: #057a35;
}

.font-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.font-copy strong {
  overflow: hidden;
  margin: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-copy strong {
  color: #111111;
  font-size: 15px;
  font-weight: 900;
}

.font-copy small {
  overflow: hidden;
  color: #7b838d;
  font-size: 11px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-card-footer > span,
.empty-shell p,
.sync-feedback {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-family: var(--app-current-font-family);
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.status-pill.enabled {
  background: #e7f8ec;
  color: #138046;
}

.status-pill.disabled {
  background: #f1f3f6;
  color: #79808a;
}

.font-preview {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 14px;
  border-radius: 18px;
  background: linear-gradient(135deg, #111111, #27322b);
  color: #ffffff;
}

.font-preview span {
  color: rgba(255, 255, 255, 0.7);
  font-size: 11px;
  font-weight: 900;
}

.font-preview strong {
  font-size: 20px;
  line-height: 1.25;
  letter-spacing: 0;
}

.font-preview p {
  margin: 0;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.style-code-field textarea {
  width: 100%;
  min-height: 260px;
  resize: vertical;
  padding: 12px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 16px;
  background: #101418;
  color: #eef4f0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1.55;
  outline: none;
}

.style-code-preview {
  max-height: 160px;
  margin: 0;
  overflow: auto;
  padding: 12px;
  border-radius: 14px;
  background: #101418;
  color: #dfe9e3;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 10px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.font-card-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  font-family: var(--app-current-font-family);
}

.font-card-footer > span {
  min-width: 0;
  margin-right: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.font-card-footer > div {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.style-card-footer {
  display: grid;
  align-items: stretch;
  gap: 8px;
}

.style-card-footer > span {
  margin-right: 0;
}

.style-card-actions {
  display: grid;
  gap: 8px;
  width: 100%;
}

.style-card-actions.custom-style-actions {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.style-card-actions .card-action {
  min-width: 0;
  width: 100%;
  padding-inline: 8px;
}

.card-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  background: #f3f6f4;
  color: #363a40;
  font-family: var(--app-current-font-family);
  font-size: 12px;
  font-weight: 900;
}

.card-action:disabled {
  opacity: 0.48;
  cursor: default;
}

.card-action.danger {
  background: #fff1f4;
  color: #d7354b;
}

.empty-shell {
  display: grid;
  gap: 8px;
  padding: 20px;
  border: 1px dashed rgba(17, 17, 17, 0.1);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.75);
}

.empty-shell strong,
.composer-hero strong {
  font-size: 18px;
  font-weight: 800;
}

.sync-feedback {
  margin: 0;
  padding: 9px 10px;
  border-radius: 12px;
  font-family: var(--app-current-font-family);
  font-weight: 800;
}

.sync-feedback.success {
  background: #eef8f1;
  color: #057a35;
}

.sync-feedback.error {
  background: rgba(239, 68, 90, 0.1);
  color: #d7354b;
}

.font-composer {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto auto;
  gap: 16px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  font-family: var(--app-current-font-family);
}

.style-export-composer {
  grid-template-rows: auto minmax(0, 1fr) auto auto;
}

.composer-hero {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 12px;
  padding: 14px;
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(255, 209, 224, 0.65), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 248, 252, 0.94));
}

.composer-avatar {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 20px;
  background: #eef8f1;
  color: #057a35;
}

.composer-avatar.composer-avatar {
  display: grid;
  color: #057a35;
  letter-spacing: 0;
  text-transform: none;
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

.composer-hero p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.composer-tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.composer-tab {
  min-height: 40px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: #6f7079;
  font-size: 12px;
  font-weight: 800;
}

.composer-tab.active {
  background: linear-gradient(180deg, #111111, #2c2f39);
  color: #ffffff;
}

.composer-section {
  min-height: 0;
  align-content: start;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.export-preset-list {
  display: grid;
  align-content: start;
  gap: 10px;
  min-height: auto;
}

.export-scroll-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.export-preset-item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border-radius: 16px;
  background: rgba(246, 248, 251, 0.96);
}

.export-preset-item input {
  width: 18px;
  height: 18px;
  accent-color: var(--link-green);
}

.export-preset-item span {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.export-preset-item strong,
.export-preset-item small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.export-preset-item strong {
  color: #111111;
  font-size: 14px;
  font-weight: 900;
}

.export-preset-item small {
  color: #77808a;
  font-size: 12px;
  font-weight: 800;
}

.export-cover-panel {
  display: grid;
  gap: 10px;
}

.export-cover-copy {
  gap: 4px;
}

.export-cover-copy > span {
  color: #111111;
  font-size: 13px;
  font-weight: 900;
}

.export-cover-copy > small {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.export-cover-picker {
  min-height: 112px;
  place-items: start;
  align-content: center;
  justify-items: start;
  text-align: left;
}

.export-cover-preview {
  display: grid;
  gap: 10px;
  padding: 10px;
  border-radius: 18px;
  background: rgba(246, 248, 251, 0.96);
}

.export-cover-preview img {
  width: 100%;
  height: 148px;
  border-radius: 14px;
  object-fit: cover;
}

.export-cover-preview > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.export-cover-preview strong {
  color: #111111;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.4;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.export-cover-preview small {
  color: #6d7680;
  font-size: 12px;
  line-height: 1.45;
}

.export-cover-preview .card-action {
  width: 100%;
}

.form-grid {
  display: grid;
  gap: 10px;
}

.field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.field input,
.field textarea {
  min-height: 40px;
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
  color: #171717;
  font-size: 12px;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.06);
}

.field textarea {
  resize: vertical;
  line-height: 1.45;
}

.file-drop-card {
  position: relative;
  display: grid;
  place-items: center;
  gap: 6px;
  min-height: 142px;
  padding: 18px;
  border: 1px dashed rgba(17, 17, 17, 0.16);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.82);
  color: #363a40;
  text-align: center;
}

.file-drop-card strong,
.file-drop-card span {
  display: block;
  width: 100%;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.file-drop-card strong {
  font-size: 14px;
}

.file-drop-card span {
  color: var(--muted);
  font-size: 12px;
}

.file-drop-card input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.selected-file-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.selected-file-list span {
  max-width: 100%;
  overflow: hidden;
  padding: 6px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: #69706a;
  font-size: 11px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0;
  width: 100%;
  align-self: end;
}

.footer-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 0;
  min-height: 42px;
  padding: 0 10px;
  font-size: 13px;
  font-weight: 800;
}

.footer-cancel {
  border-radius: 16px 0 0 16px;
  background: rgba(255, 255, 255, 0.88);
  color: #4f535b;
}

.footer-save {
  border-radius: 0 16px 16px 0;
  background: linear-gradient(180deg, #1f2229, #373b45);
  color: #ffffff;
}

.footer-button:disabled {
  opacity: 0.58;
  cursor: default;
}

.font-error-sheet {
  display: grid;
  gap: 12px;
  min-width: 0;
  font-family: var(--app-current-font-family);
}

.font-error-sheet strong {
  color: #111111;
  font-size: 16px;
  font-weight: 900;
}

.font-error-sheet p {
  margin: 0;
  color: #4f535b;
  font-size: 13px;
  line-height: 1.55;
}

.font-error-sheet dl {
  display: grid;
  gap: 8px;
  margin: 0;
}

.font-error-sheet dl > div {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.06);
}

.font-error-sheet dt,
.font-error-sheet dd {
  margin: 0;
  min-width: 0;
}

.font-error-sheet dt {
  color: #9d7a86;
  font-size: 11px;
  font-weight: 900;
}

.font-error-sheet dd {
  overflow-wrap: anywhere;
  color: #252a31;
  font-size: 12px;
  line-height: 1.45;
}

.font-error-tip {
  padding: 10px;
  border-radius: 14px;
  background: rgba(239, 68, 90, 0.1);
  color: #b42b40 !important;
  font-weight: 800;
}

:global(.modal-panel .modal-body .font-import-composer.font-import-composer .composer-footer) {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
  gap: 0 !important;
  width: 100% !important;
}

:global(.modal-panel .modal-body .font-import-composer.font-import-composer .footer-button) {
  width: 100% !important;
  min-width: 0 !important;
  min-height: 42px !important;
  border-radius: 0 !important;
}

:global(.modal-panel .modal-body .font-import-composer.font-import-composer .footer-cancel) {
  border-radius: 16px 0 0 16px !important;
}

:global(.modal-panel .modal-body .font-import-composer.font-import-composer .footer-save) {
  border-radius: 0 16px 16px 0 !important;
}

:global(.modal-panel .modal-body .style-import-composer.style-import-composer .composer-footer),
:global(.modal-panel .modal-body .style-export-composer.style-export-composer .composer-footer) {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 0 !important;
  width: 100% !important;
}

:global(.modal-panel .modal-body .style-import-composer.style-import-composer .footer-button),
:global(.modal-panel .modal-body .style-export-composer.style-export-composer .footer-button) {
  display: inline-flex !important;
  justify-content: center !important;
  width: 100% !important;
  min-width: 0 !important;
  min-height: 42px !important;
  border-radius: 0 !important;
}

:global(.modal-panel .modal-body .style-import-composer.style-import-composer .footer-cancel),
:global(.modal-panel .modal-body .style-export-composer.style-export-composer .footer-cancel) {
  border-radius: 16px 0 0 16px !important;
}

:global(.modal-panel .modal-body .style-import-composer.style-import-composer .footer-save),
:global(.modal-panel .modal-body .style-export-composer.style-export-composer .footer-save) {
  border-radius: 0 16px 16px 0 !important;
}

.themes-tabs {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 3px;
  padding: 7px calc(8px + var(--safe-right)) calc(9px + var(--safe-bottom)) calc(8px + var(--safe-left));
  border-top: 1px solid rgba(17, 17, 17, 0.05);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(18px);
}

.themes-tab {
  display: grid;
  justify-items: center;
  gap: 3px;
  min-width: 0;
  min-height: 46px;
  padding: 6px 2px;
  border-radius: 13px;
  color: var(--muted);
  font-family: var(--app-current-font-family);
  font-size: 10px;
  font-weight: 800;
}

.themes-tab span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.themes-tab.active {
  background: #eef8f1;
  color: #111111;
}

.themes-tab svg {
  width: 19px;
  height: 19px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 420px) {
  .themes-main {
    padding-inline: 10px;
  }

  .themes-panel {
    padding: 12px;
    border-radius: 18px;
  }

  .font-card {
    padding: 12px;
    border-radius: 18px;
  }

  .font-card-top {
    grid-template-columns: 42px minmax(0, 1fr) max-content;
    align-items: center;
    gap: 10px;
  }

  .font-mark {
    width: 42px;
    height: 42px;
    border-radius: 16px;
  }

  .status-pill {
    grid-column: auto;
    justify-self: end;
    margin-left: 0;
    padding-inline: 8px;
    font-size: 10px;
  }

  .font-card-footer {
    display: grid;
    align-items: stretch;
    gap: 8px;
  }

  .font-card-footer > span {
    margin-right: 0;
  }

  .font-card-footer > div {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
  }

  .card-action {
    min-width: 0;
    width: 100%;
    padding-inline: 8px;
  }
}
</style>
