<template>
  <section class="screen no-tabs thought-theme-page">
    <header class="thought-theme-topbar">
      <button class="top-back" type="button" aria-label="返回聊天" @click="goBack"><ArrowLeft :size="19" /></button>
      <div class="top-copy">
        <span>Visible Reasoning</span>
        <h1>思维链</h1>
      </div>
      <div class="top-actions">
        <button type="button" aria-label="清理思维记录" title="清理记录" @click="showCleanup = true"><Eraser :size="17" /></button>
        <button type="button" aria-label="导入思维链 PNG" title="导入 PNG" @click="choosePngFile"><Upload :size="17" /></button>
        <button type="button" aria-label="分享思维链" title="分享" @click="openExporter"><Share2 :size="17" /></button>
        <button class="top-add" type="button" aria-label="新增思维链" title="新增" @click="openCreator"><Plus :size="18" /></button>
      </div>
    </header>

    <main class="thought-theme-main">
      <section class="thought-theme-hero">
        <p>Private Trace Library</p>
        <h2>让角色留下<br /><em>可见的思考轨迹。</em></h2>
        <span>启用后，线上回复会随机使用一个主题，生成独立于聊天气泡的可见决策记录；历史记录会保留当时的弹窗样式。</span>
      </section>

      <section class="thought-theme-library" aria-label="思维链主题库">
        <header class="library-head">
          <div>
            <p>THEMES</p>
            <h2>主题库</h2>
          </div>
          <span><strong>{{ enabledThemes.length }}</strong> / {{ themes.length }} 已启用</span>
        </header>

        <div v-if="themes.length" class="thought-theme-list">
          <article
            v-for="(theme, index) in themes"
            :key="theme.id"
            class="thought-theme-card"
            :class="{ paused: !theme.enabled }"
            role="button"
            tabindex="0"
            @click="openEditor(theme)"
            @keydown.enter.prevent="openEditor(theme)"
            @keydown.space.prevent="openEditor(theme)"
          >
            <span class="card-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <div class="card-copy">
              <span>{{ theme.source === 'imported' ? 'Imported archive' : 'Personal instruction' }}</span>
              <strong>{{ theme.name }}</strong>
              <small>{{ countPromptLines(theme.prompt) }} 行生成规则 · {{ theme.enabled ? '随机启用' : '已暂停' }}</small>
            </div>
            <button class="theme-switch" :class="{ active: theme.enabled }" type="button" role="switch" :aria-checked="theme.enabled" :aria-label="`${theme.name}随机生成`" @click.stop="toggleTheme(theme)"><i></i></button>
            <ArrowUpRight class="card-arrow" :size="16" />
          </article>
        </div>

        <section v-else class="thought-theme-empty">
          <div><Sparkles :size="24" stroke-width="1.6" /></div>
          <p>NO ACTIVE ARCHIVE</p>
          <h2>还没有思维链主题</h2>
          <span>新建一个主题，定义模型如何写可见的思考记录，并自定义整张 API Trace 前页。</span>
          <button type="button" @click="openCreator">创建第一个主题</button>
        </section>
      </section>
    </main>

    <input ref="pngInput" class="native-fallback-input" type="file" accept="image/png,.png" @change="selectPngFile" />

    <AppModal v-model="showEditor" :title="editingTheme ? '编辑思维链' : '新增思维链'" eyebrow="VISIBLE REASONING" variant="profile-theme">
      <form class="thought-theme-form" @submit.prevent="saveTheme">
        <label>
          <span>主题名称</span>
          <input v-model="draft.name" maxlength="80" placeholder="例如：冷静推演、晚安电台" />
        </label>
        <label>
          <span>思维链生成提示词</span>
          <textarea v-model="draft.prompt" maxlength="12000" rows="7" placeholder="写清楚希望角色把哪些判断、情绪和决定写进可见记录。"></textarea>
        </label>
        <label>
          <span>正则提取（可选）</span>
          <input v-model="draft.regex" maxlength="1000" placeholder="例如：<thought>([\s\S]+)</thought>" />
        </label>
        <label>
          <span>整张翻转卡片代码</span>
          <textarea v-model="draft.code" maxlength="48000" rows="16" spellcheck="false" placeholder="写完整翻转卡片 HTML，必须包含正面和背面；可在顶部使用 <style>...</style>。支持 {{lines}}、{{tools}}、{{title}}、{{themeName}}、{{model}}、{{tokens}}、{{status}}。"></textarea>
          <small>代码直接接管 API Trace 翻转卡片的正反两面，样式会自动隔离。</small>
        </label>
        <label class="form-switch">
          <input v-model="draft.enabled" type="checkbox" />
          <span>加入本轮回复的随机生成池</span>
        </label>
        <div class="form-actions" :class="{ editing: Boolean(editingTheme) }">
          <button v-if="editingTheme" class="danger" type="button" @click="deleteTheme">删除</button>
          <button class="secondary" type="button" @click="showEditor = false">取消</button>
          <button class="primary" type="submit">保存</button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showExporter" title="分享思维链" eyebrow="VISIBLE REASONING" variant="profile-theme">
      <section class="export-panel">
        <p>选择要分享的主题。导出的 PNG 可以在任意 LINK 设备导入，不会包含聊天记录或 API 配置。</p>
        <label v-for="theme in themes" :key="theme.id" class="export-item">
          <input v-model="selectedExportThemeIds" type="checkbox" :value="theme.id" />
          <span><strong>{{ theme.name }}</strong><small>{{ theme.source === 'imported' ? '导入主题' : '自定义主题' }} · {{ countPromptLines(theme.prompt) }} 行提示</small></span>
        </label>
        <p v-if="exportError" class="form-error">{{ exportError }}</p>
        <div class="form-actions">
          <button class="secondary" type="button" @click="showExporter = false">取消</button>
          <button class="primary" type="button" :disabled="exporting || !selectedExportThemeIds.length" @click="exportSelectedThemes">{{ exporting ? '导出中...' : '导出 PNG' }}</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showCleanup" title="清理思维记录" eyebrow="VISIBLE REASONING" variant="profile-theme">
      <section class="cleanup-panel">
        <p>清理只会移除历史 API Trace 中的可见思维链和其样式快照，不影响聊天内容、工具回执或原始 API 信息。</p>
        <label>早于
          <select v-model.number="cleanupDays"><option :value="3">3 天</option><option :value="7">7 天</option><option :value="30">30 天</option><option :value="90">90 天</option></select>
          的记录
        </label>
        <p v-if="cleanupNotice" class="cleanup-notice">{{ cleanupNotice }}</p>
        <div class="form-actions">
          <button class="secondary" type="button" @click="showCleanup = false">取消</button>
          <button class="danger primary-danger" type="button" :disabled="cleaning" @click="cleanupTraces">{{ cleaning ? '清理中...' : '清理记录' }}</button>
        </div>
      </section>
    </AppModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, ArrowUpRight, Eraser, Plus, Share2, Sparkles, Upload } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import { pickNativePngFile } from '@/services/nativeFile';
import { useAppStore } from '@/stores/appStore';
import type { ThoughtChainTheme } from '@/types/domain';
import { downloadDataUrl } from '@/utils/download';
import { composeThoughtChainThemeCode, decodeThoughtChainThemesFromPng, defaultThoughtChainCode, defaultThoughtChainPrompt, encodeThoughtChainThemesToPng, splitThoughtChainThemeCode } from '@/utils/thoughtChainThemes';

const props = defineProps<{ id: string }>();
const router = useRouter();
const store = useAppStore();
const showEditor = ref(false);
const showExporter = ref(false);
const showCleanup = ref(false);
const editingThemeId = ref('');
const pngInput = ref<HTMLInputElement | null>(null);
const selectedExportThemeIds = ref<string[]>([]);
const exportError = ref('');
const exporting = ref(false);
const cleaning = ref(false);
const cleanupDays = ref(30);
const cleanupNotice = ref('');
const draft = reactive({ name: '', prompt: '', regex: '', code: '', enabled: true });

const themes = computed(() => store.thoughtChainThemes());
const enabledThemes = computed(() => themes.value.filter((theme) => theme.enabled));
const editingTheme = computed(() => editingThemeId.value ? themes.value.find((theme) => theme.id === editingThemeId.value) ?? null : null);

onMounted(() => void store.hydrate());

watch(showExporter, (open) => {
  if (open) return;
  selectedExportThemeIds.value = [];
  exportError.value = '';
});

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

function resetDraft() {
  editingThemeId.value = '';
  draft.name = '';
  draft.prompt = defaultThoughtChainPrompt;
  draft.regex = '';
  draft.code = defaultThoughtChainCode;
  draft.enabled = true;
}

function openCreator() {
  resetDraft();
  showEditor.value = true;
}

function openEditor(theme: ThoughtChainTheme) {
  editingThemeId.value = theme.id;
  draft.name = theme.name;
  draft.prompt = theme.prompt;
  draft.regex = theme.regex;
  draft.code = composeThoughtChainThemeCode(theme.template, theme.css) || defaultThoughtChainCode;
  draft.enabled = theme.enabled;
  showEditor.value = true;
}

async function saveTheme() {
  const name = draft.name.trim();
  const prompt = draft.prompt.trim();
  if (!name || !prompt) {
    store.showConfigAlert('请填写思维链名称和提示词。', '无法保存思维链');
    return;
  }
  const code = splitThoughtChainThemeCode(draft.code);
  const existingTheme = editingTheme.value;
  if (existingTheme) {
    await store.saveThoughtChainTheme({ ...existingTheme, name, prompt, regex: draft.regex.trim(), template: code.html, css: code.css, enabled: draft.enabled });
  } else {
    await store.createThoughtChainTheme({ name, prompt, regex: draft.regex.trim(), template: code.html, css: code.css, enabled: draft.enabled });
  }
  showEditor.value = false;
}

async function toggleTheme(theme: ThoughtChainTheme) {
  await store.setThoughtChainThemeEnabled(theme.id, !theme.enabled);
}

async function deleteTheme() {
  const theme = editingTheme.value;
  if (!theme || !window.confirm(`删除思维链“${theme.name}”？已生成的历史记录不会受影响。`)) return;
  await store.deleteThoughtChainTheme(theme.id);
  showEditor.value = false;
  editingThemeId.value = '';
}

function selectPngFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (file) void importThemes(file);
}

async function choosePngFile() {
  try {
    const file = await pickNativePngFile();
    if (file === undefined) {
      pngInput.value?.click();
      return;
    }
    if (file) await importThemes(file);
  } catch (error) {
    store.showConfigAlert(error instanceof Error ? error.message : '无法打开思维链主题 PNG。', '导入失败');
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('读取 PNG 文件失败。')));
    reader.readAsDataURL(file);
  });
}

async function importThemes(file: File) {
  try {
    if (file.type && file.type !== 'image/png') throw new Error('请选择 PNG 格式的思维链主题图片。');
    const importedThemes = await decodeThoughtChainThemesFromPng(await readFileAsDataUrl(file));
    const savedThemes = await store.importThoughtChainThemes(importedThemes);
    if (!savedThemes.length) throw new Error('文件中没有可用的思维链主题。');
    store.showConfigAlert(`已导入 ${savedThemes.length} 个思维链主题。`, '导入完成');
  } catch (error) {
    store.showConfigAlert(error instanceof Error ? error.message : '思维链主题导入失败。', '导入失败');
  }
}

function openExporter() {
  selectedExportThemeIds.value = themes.value.map((theme) => theme.id);
  showExporter.value = true;
}

async function exportSelectedThemes() {
  const selectedIds = new Set(selectedExportThemeIds.value);
  const selectedThemes = themes.value.filter((theme) => selectedIds.has(theme.id));
  if (!selectedThemes.length) {
    exportError.value = '请先选择至少一个主题。';
    return;
  }
  exporting.value = true;
  try {
    const dataUrl = await encodeThoughtChainThemesToPng(selectedThemes);
    const firstName = selectedThemes[0]?.name.replace(/[^\u4e00-\u9fa5\w-]+/g, '-').replace(/^-+|-+$/g, '') || 'thought-chain';
    const fileName = `link-thought-chain-${firstName}-${Date.now()}.png`;
    await downloadDataUrl(dataUrl, fileName);
    showExporter.value = false;
  } catch (error) {
    exportError.value = error instanceof Error ? error.message : '思维链主题导出失败。';
  } finally {
    exporting.value = false;
  }
}

async function cleanupTraces() {
  cleaning.value = true;
  try {
    const count = await store.cleanupThoughtChainTraces(cleanupDays.value);
    cleanupNotice.value = count ? `已清理 ${count} 条历史思维记录。` : '没有符合条件的思维记录。';
  } finally {
    cleaning.value = false;
  }
}
</script>

<style scoped>
.native-fallback-input { display: none; }
.thought-theme-page { min-height: var(--app-height); background: #f6f3ef; color: #29251f; }
.thought-theme-topbar { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; min-height: calc(58px + var(--safe-top)); padding: var(--safe-top) calc(13px + var(--safe-right)) 8px calc(13px + var(--safe-left)); background: rgba(246, 243, 239, .9); backdrop-filter: blur(18px); }
.top-back, .top-actions button, .thought-theme-card, .thought-theme-empty button, .form-actions button { border: 0; font: inherit; cursor: pointer; }
.top-back, .top-actions button { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 10px; background: rgba(255,255,255,.75); color: #3a342d; }
.top-copy { min-width: 0; }
.top-copy span, .thought-theme-hero > p, .library-head p, .card-copy > span, .thought-theme-empty > p { display: block; margin: 0; color: #9c8174; font-size: 9px; font-weight: 900; letter-spacing: .15em; text-transform: uppercase; }
.top-copy h1 { margin: 2px 0 0; font-family: Georgia, "Songti SC", serif; font-size: 19px; font-weight: 600; letter-spacing: -.05em; }
.top-actions { display: flex; align-items: center; gap: 5px; }
.top-actions .top-add { background: #494039; color: #fff; }
.thought-theme-main { display: grid; gap: 26px; padding: 18px calc(14px + var(--safe-right)) calc(30px + var(--safe-bottom)) calc(14px + var(--safe-left)); overflow: auto; }
.thought-theme-hero { display: grid; gap: 10px; padding: 22px 20px 23px; border-radius: 22px; background: radial-gradient(circle at 92% 3%, rgba(229, 189, 165, .55), transparent 32%), linear-gradient(135deg, #e8ddd3, #f6f0e9 68%); box-shadow: 0 12px 30px rgba(104, 79, 62, .09); }
.thought-theme-hero h2 { margin: 0; font-family: Georgia, "Songti SC", serif; font-size: clamp(29px, 8vw, 39px); font-weight: 500; line-height: .98; letter-spacing: -.07em; }
.thought-theme-hero h2 em { color: #a86559; font-style: italic; }
.thought-theme-hero > span { max-width: 450px; color: #74665f; font-size: 12px; line-height: 1.75; }
.thought-theme-library { display: grid; gap: 12px; max-width: 720px; width: 100%; margin: 0 auto; }
.library-head { display: flex; align-items: end; justify-content: space-between; padding: 0 5px; }
.library-head h2 { margin: 3px 0 0; font-size: 20px; letter-spacing: -.04em; }
.library-head > span { color: #95877e; font-size: 11px; font-weight: 700; }
.library-head > span strong { color: #9f665b; font-size: 19px; }
.thought-theme-list { display: grid; gap: 9px; }
.thought-theme-card { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 12px; width: 100%; min-height: 84px; padding: 13px 14px; border: 1px solid rgba(89, 70, 57, .07); border-radius: 17px; background: rgba(255,255,255,.76); color: inherit; text-align: left; box-shadow: 0 8px 20px rgba(74, 55, 41, .045); transition: transform .2s ease, opacity .2s ease; }
.thought-theme-card:active { transform: scale(.985); }
.thought-theme-card.paused { opacity: .56; }
.card-index { align-self: start; color: #b89d8e; font-family: Georgia, serif; font-size: 12px; font-weight: 700; }
.card-copy { display: grid; min-width: 0; gap: 4px; }
.card-copy strong { overflow: hidden; font-size: 16px; letter-spacing: -.04em; text-overflow: ellipsis; white-space: nowrap; }
.card-copy small { color: #93867e; font-size: 10px; font-weight: 700; }
.theme-switch { position: relative; width: 37px; height: 23px; padding: 0; border: 0; border-radius: 999px; background: #d7d0c9; cursor: pointer; transition: background .2s ease; }
.theme-switch i { position: absolute; top: 3px; left: 3px; width: 17px; height: 17px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.18); transition: transform .2s ease; }
.theme-switch.active { background: #b77264; }.theme-switch.active i { transform: translateX(14px); }
.card-arrow { color: #aa968a; }
.thought-theme-empty { display: grid; justify-items: center; gap: 9px; padding: 44px 22px; border: 1px dashed rgba(126, 97, 80, .24); border-radius: 19px; text-align: center; }
.thought-theme-empty > div { display: grid; width: 48px; height: 48px; place-items: center; border-radius: 16px; background: #efe2d8; color: #ae7163; }.thought-theme-empty h2 { margin: 0; font-family: Georgia, "Songti SC", serif; font-size: 23px; letter-spacing: -.05em; }.thought-theme-empty > span { max-width: 270px; color: #897b73; font-size: 12px; line-height: 1.7; }.thought-theme-empty button { margin-top: 7px; padding: 10px 15px; border-radius: 10px; background: #4c423b; color: #fff; font-size: 12px; font-weight: 800; }
.thought-theme-form, .export-panel, .cleanup-panel { display: grid; gap: 15px; }.thought-theme-form label { display: grid; gap: 7px; }.thought-theme-form label > span { color: #675c54; font-size: 12px; font-weight: 800; }.thought-theme-form input, .thought-theme-form textarea, .cleanup-panel select { width: 100%; box-sizing: border-box; border: 1px solid #ded6cf; border-radius: 10px; background: #fffdfb; color: #312b25; font: inherit; font-size: 13px; outline: none; }.thought-theme-form input { height: 40px; padding: 0 11px; }.thought-theme-form textarea { min-height: 86px; padding: 10px 11px; line-height: 1.55; resize: vertical; }.thought-theme-form label > small { color: #97887f; font-size: 10px; line-height: 1.55; }.thought-theme-form .form-switch { display: flex; align-items: center; gap: 8px; color: #65584f; font-size: 12px; font-weight: 700; }.form-switch input { width: 16px; height: 16px; accent-color: #aa695e; }
.form-actions { display: flex; justify-content: end; gap: 8px; margin-top: 3px; }.form-actions.editing { justify-content: space-between; }.form-actions button { min-height: 37px; padding: 0 15px; border-radius: 9px; font-size: 12px; font-weight: 800; }.form-actions .secondary { background: #eee8e2; color: #5c514a; }.form-actions .primary { background: #4c423b; color: #fff; }.form-actions .danger, .primary-danger { background: #ffe9e4; color: #b54735; }.form-actions .primary-danger { color: #fff; background: #b85645; }.form-actions button:disabled { cursor: not-allowed; opacity: .5; }
.export-panel > p, .cleanup-panel > p { margin: 0; color: #796d65; font-size: 12px; line-height: 1.7; }.export-item { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #eee6e0; }.export-item input { accent-color: #aa695e; }.export-item span { display: grid; gap: 3px; }.export-item strong { font-size: 13px; }.export-item small { color: #94867e; font-size: 10px; }.form-error { color: #c14f42 !important; }.cleanup-panel > label { display: flex; align-items: center; gap: 7px; color: #65594f; font-size: 13px; font-weight: 800; }.cleanup-panel select { width: auto; height: 34px; padding: 0 26px 0 9px; }.cleanup-notice { padding: 9px 10px; border-radius: 9px; background: #edf4ea; color: #55714d !important; }
@media (min-width: 680px) { .thought-theme-main { padding-top: 30px; }.thought-theme-hero { padding: 32px 34px; }.thought-theme-topbar { padding-left: max(18px, var(--safe-left)); padding-right: max(18px, var(--safe-right)); } }
</style>