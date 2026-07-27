<template>
  <section class="screen no-tabs atelier-page">
    <header class="atelier-header">
      <button class="atelier-back" type="button" aria-label="返回世界书" @click="goBack">
        <ArrowLeft :size="19" stroke-width="1.9" />
      </button>
      <div class="atelier-brand">
        <span>{{ isTabooDraft ? 'Permanent archive' : isEditingRoute ? 'Edit collection' : 'New collection' }}</span>
        <h1>{{ pageTitle }}</h1>
      </div>
      <span v-if="isTabooDraft" class="permanent-chip"><LockKeyhole :size="11" /> locked</span>
      <button v-else class="book-state-chip" :class="{ active: draft.enabled }" type="button" @click="toggleBookEnabled">
        <span></span>{{ draft.enabled ? 'active' : 'paused' }}
      </button>
    </header>

    <main class="atelier-scroll">
      <section v-if="store.ready && isLoaded && !missingBook" class="atelier-workspace">
        <section v-if="isTabooDraft" class="priority-letter">
          <span class="priority-monogram">T</span>
          <div>
            <p>Priority letter · no. 00</p>
            <h2>全站最先读取的私人规则</h2>
            <small>这本书不会被删除、改名或停用。非空且已开启的条目始终优先进入文本生成；图片生成是否读取由下方开关控制。</small>
          </div>
          <Sparkles :size="17" stroke-width="1.6" />
        </section>

        <section v-if="isTabooDraft" class="taboo-api-routing">
          <span class="api-routing-icon"><ImageIcon :size="18" stroke-width="1.7" /></span>
          <div class="api-routing-copy">
            <p>Image generation route</p>
            <h2>生图 API 读取禁忌之书</h2>
            <small>关闭后，OpenAI、NovelAI 与 Pollinations 生图都不会附带本书内容。</small>
          </div>
          <button
            class="api-routing-toggle"
            :class="{ active: tabooImageGenerationReadEnabled }"
            type="button"
            role="switch"
            :aria-checked="tabooImageGenerationReadEnabled"
            :aria-label="tabooImageGenerationReadEnabled ? '生图 API 当前读取禁忌之书，点击关闭' : '生图 API 当前不读取禁忌之书，点击开启'"
            @click="toggleTabooImageGenerationRead"
          >
            <span><i></i></span>
            <strong>{{ tabooImageGenerationReadEnabled ? '读取' : '不读取' }}</strong>
          </button>
        </section>

        <section class="book-identity">
          <div class="identity-cover">
            <img v-if="!isBrokenCoverImage(draftCoverImage)" :src="draftCoverImage" alt="世界书封面" @error="markBrokenCoverImage(draftCoverImage)" />
            <span v-else>{{ draft.title || 'World Book' }}</span>
            <i aria-hidden="true"></i>
          </div>
          <div class="identity-fields">
            <label>
              <span>Book title</span>
              <input v-model="draft.title" :disabled="isTabooDraft" placeholder="给这个世界取一个名字" />
            </label>
            <label>
              <span>Collection</span>
              <select v-model="draft.scope" :disabled="isTabooDraft">
                <option value="global-online">线上全局收藏</option>
                <option value="global-offline">线下全局收藏</option>
                <option value="local">角色局部收藏</option>
              </select>
            </label>
            <div class="identity-caption">
              <span>{{ scopeDisplay }}</span>
              <span>{{ draft.entries.length }} entries</span>
            </div>
            <button v-if="selectedBookId && !isTabooDraft" class="remove-book-link" type="button" @click="requestDeleteWorldBook">
              <Trash2 :size="13" stroke-width="1.8" /> 删除整本世界书
            </button>
          </div>
        </section>

        <nav class="atelier-tabs" aria-label="编辑区域">
          <button type="button" :class="{ active: editorTab === 'entries' }" @click="editorTab = 'entries'">
            <BookOpenText :size="16" stroke-width="1.8" />
            <span>条目内容</span>
            <small>{{ draft.entries.length }}</small>
          </button>
          <button type="button" :class="{ active: editorTab === 'cover' }" @click="editorTab = 'cover'">
            <ImageIcon :size="16" stroke-width="1.8" />
            <span>封面装帧</span>
          </button>
        </nav>

        <form class="atelier-form" @submit.prevent="finishEditing">
          <section v-if="editorTab === 'cover'" class="cover-studio">
            <div class="studio-heading">
              <p>Cover styling</p>
              <h2>替这本书留下封面</h2>
              <small>上传本地图片，或粘贴一张可访问的图片地址。留空会使用自动生成的杂志封面。</small>
            </div>
            <label class="cover-dropzone">
              <input type="file" accept="image/*" @change="readCoverImage" />
              <span><Camera :size="22" stroke-width="1.6" /></span>
              <strong>选择本地图片</strong>
              <small>JPG · PNG · WEBP</small>
            </label>
            <label class="url-field">
              <span>Image address</span>
              <div>
                <LinkIcon :size="15" stroke-width="1.7" />
                <input v-model="draft.coverImage" placeholder="https://..." />
              </div>
            </label>
            <p v-if="coverFeedback" class="cover-feedback" :class="coverState">{{ coverFeedback }}</p>
          </section>

          <section v-else class="entry-studio">
            <header class="entry-studio-heading">
              <div>
                <p>World notes</p>
                <h2>条目手记</h2>
                <small>{{ enabledEntryCount }} 条正在使用</small>
              </div>
              <button type="button" @click="addLoreEntry">
                <Plus :size="16" stroke-width="2" /> 新增一条
              </button>
            </header>

            <nav class="entry-ribbon" aria-label="世界书条目">
              <button
                v-for="(entry, index) in draft.entries"
                :key="entry.id"
                type="button"
                :class="{ active: activeEntryIndex === index, off: !entry.enabled }"
                @click="activeEntryIndex = index"
              >
                <span>{{ String(index + 1).padStart(2, '0') }}</span>
                <strong>{{ entry.title || `条目 ${index + 1}` }}</strong>
                <i :class="entryLampClass(entry)"></i>
              </button>
            </nav>

            <article v-if="activeEntry" class="entry-paper" :class="`tone-${activeEntry.activation}`">
              <header class="entry-paper-header">
                <label class="entry-name-field">
                  <span>Entry name</span>
                  <input v-model="activeEntry.title" :placeholder="`条目 ${activeEntryIndex + 1}`" />
                </label>
                <button class="entry-toggle" :class="{ active: activeEntry.enabled }" type="button" @click="toggleLoreEntry(activeEntryIndex)">
                  <span></span>{{ activeEntry.enabled ? '使用中' : '已停用' }}
                </button>
              </header>

              <fieldset class="activation-picker">
                <legend>Reading mode</legend>
                <button
                  v-for="mode in activationModes"
                  :key="mode.id"
                  type="button"
                  :class="[`mode-${mode.id}`, { active: activeEntry.activation === mode.id }]"
                  @click="setEntryActivation(activeEntry, mode.id)"
                >
                  <i></i>
                  <span>
                    <strong>{{ mode.label }}</strong>
                    <small>{{ mode.description }}</small>
                  </span>
                </button>
              </fieldset>

              <div class="keyword-grid">
                <label>
                  <span>主关键词</span>
                  <input :value="activeEntry.keys.join('、')" placeholder="用逗号或顿号分隔" @input="updateEntryList(activeEntry, 'keys', $event)" />
                </label>
                <label>
                  <span>辅助关键词</span>
                  <input :value="activeEntry.secondaryKeys.join('、')" placeholder="可留空" @input="updateEntryList(activeEntry, 'secondaryKeys', $event)" />
                </label>
              </div>

              <details class="entry-settings">
                <summary>
                  <SlidersHorizontal :size="15" stroke-width="1.8" />
                  <span>读取细节</span>
                  <ChevronDown :size="14" stroke-width="1.8" />
                </summary>
                <div class="settings-grid">
                  <label>
                    <span>插入位置</span>
                    <select v-model="activeEntry.position">
                      <option value="before-chat">对话之前</option>
                      <option value="after-chat">对话之后</option>
                    </select>
                  </label>
                  <label>
                    <span>顺序</span>
                    <input v-model.number="activeEntry.order" type="number" min="0" max="9999" inputmode="numeric" />
                  </label>
                  <label>
                    <span>深度</span>
                    <input v-model.number="activeEntry.depth" type="number" min="0" max="12" inputmode="numeric" />
                  </label>
                  <label>
                    <span>概率 %</span>
                    <input v-model.number="activeEntry.probability" type="number" min="0" max="100" inputmode="numeric" />
                  </label>
                </div>
                <label class="case-option">
                  <input v-model="activeEntry.caseSensitive" type="checkbox" />
                  <span>关键词需要区分大小写</span>
                </label>
              </details>

              <label class="content-field">
                <span>Write the rule</span>
                <textarea
                  v-model="activeEntry.content"
                  :placeholder="isTabooDraft ? '写下全站所有生成任务必须最先遵守的规则。留空时不会读取。' : '写下人物关系、地点规则、世界观细节或语气约束。'"
                />
              </label>

              <footer class="entry-paper-footer">
                <span>完成收藏或离开页面时保存</span>
                <button type="button" :disabled="draft.entries.length <= 1" @click="removeLoreEntry(activeEntryIndex)">
                  <Trash2 :size="13" stroke-width="1.8" /> 删除这一条
                </button>
              </footer>
            </article>
          </section>
        </form>
      </section>

      <section v-else-if="store.ready && missingBook" class="missing-archive">
        <span><BookX :size="27" stroke-width="1.5" /></span>
        <p>Missing collection</p>
        <h2>没有找到这本世界书</h2>
        <button type="button" @click="goBackToShelf">回到收藏页</button>
      </section>

      <section v-else class="atelier-loading">
        <span></span>
        <p>正在展开纸页</p>
      </section>
    </main>

    <footer v-if="store.ready && isLoaded && !missingBook" class="save-dock">
      <div>
        <span :class="saveState"></span>
        <p>{{ saveStateLabel }}</p>
      </div>
      <button type="button" @click="finishEditing">完成收藏 <ArrowRight :size="16" stroke-width="1.9" /></button>
    </footer>

    <Teleport to="body">
      <div v-if="showDeleteConfirm" class="delete-backdrop" @click.self="cancelDeleteWorldBook">
        <section class="delete-letter" role="dialog" aria-modal="true" aria-label="确认删除世界书">
          <button class="delete-close" type="button" aria-label="关闭" :disabled="isDeletingWorldBook" @click="cancelDeleteWorldBook">
            <X :size="17" stroke-width="1.8" />
          </button>
          <span class="delete-mark"><Trash2 :size="22" stroke-width="1.7" /></span>
          <p>Remove from archive</p>
          <h2>真的要拿走这本书吗？</h2>
          <small><strong>{{ deleteBookTitle }}</strong> 会从收藏中移除，角色对它的局部绑定也会一并清理。</small>
          <div>
            <button type="button" :disabled="isDeletingWorldBook" @click="cancelDeleteWorldBook">继续保留</button>
            <button class="confirm-remove" type="button" :disabled="isDeletingWorldBook" @click="confirmDeleteWorldBook">
              {{ isDeletingWorldBook ? '正在移除' : '确认移除' }}
            </button>
          </div>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  BookX,
  Camera,
  ChevronDown,
  Image as ImageIcon,
  Link as LinkIcon,
  LockKeyhole,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X
} from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';
import type { WorldBookEntry, WorldBookEntryActivation, WorldBookLoreEntry } from '@/types/domain';
import { createId } from '@/utils/id';
import { readImageFileFromInput } from '@/utils/imageFile';
import { createWorldBookLoreEntry, isTabooWorldBook, normalizeWorldBookEntry, resolveWorldBookCover, TABOO_WORLD_BOOK_TITLE } from '@/utils/worldBook';

type CoverState = 'idle' | 'success' | 'error';
type EditorTab = 'cover' | 'entries';
type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const selectedBookId = ref<string | null>(null);
const editorTab = ref<EditorTab>('entries');
const activeEntryIndex = ref(0);
const coverState = ref<CoverState>('idle');
const coverFeedback = ref('');
const saveState = ref<SaveState>('idle');
const showDeleteConfirm = ref(false);
const isDeletingWorldBook = ref(false);
const brokenCoverImages = ref<string[]>([]);
const draft = reactive(createDraft());
const isRestoringDraft = ref(false);
const isLoaded = ref(false);
const missingBook = ref(false);
let hasPendingChanges = false;
let draftVersion = 0;
let persistPromise: Promise<boolean> | null = null;

const activationModes: Array<{ id: WorldBookEntryActivation; label: string; description: string }> = [
  { id: 'keyword', label: '关键词', description: '命中时读取' },
  { id: 'constant', label: '常驻', description: '持续加入上下文' },
  { id: 'priority', label: '优先', description: '优先于普通条目' }
];

const isEditingRoute = computed(() => route.name === 'world-book-edit');
const routeBookId = computed(() => String(route.params.id ?? '').trim());
const isTabooDraft = computed(() => isTabooWorldBook(draft));
const tabooImageGenerationReadEnabled = computed(() => draft.includeInImageGeneration !== false);
const pageTitle = computed(() => isTabooDraft.value ? TABOO_WORLD_BOOK_TITLE : draft.title.trim() || (isEditingRoute.value ? 'Edit world book' : 'New world book'));
const draftCoverImage = computed(() => resolveWorldBookCover(draft));
const activeEntry = computed(() => draft.entries[activeEntryIndex.value] ?? draft.entries[0] ?? null);
const enabledEntryCount = computed(() => draft.entries.filter((entry) => entry.enabled && entry.content.trim()).length);
const deleteBookTitle = computed(() => draft.title.trim() || '未命名世界书');
const scopeDisplay = computed(() => isTabooDraft.value ? 'sitewide priority' : ({
  'global-online': 'online archive',
  'global-offline': 'offline archive',
  local: 'private archive'
}[draft.scope]));
const saveStateLabel = computed(() => ({
  idle: '修改将在完成收藏或离开页面时保存',
  pending: '有未保存修改',
  saving: '正在保存',
  saved: '已保存到本机',
  error: '保存失败，请再试一次'
}[saveState.value]));

onMounted(() => void store.hydrate());
onBeforeUnmount(() => {
  void persistDraft();
});
onBeforeRouteLeave(() => persistDraft());
onBeforeRouteUpdate(() => persistDraft());

function normalizeScopeValue(value: unknown): WorldBookEntry['scope'] {
  const scope = Array.isArray(value) ? value[0] : value;
  return scope === 'global-online' || scope === 'global-offline' || scope === 'local' ? scope : 'local';
}

function createDraft(scope: WorldBookEntry['scope'] = 'local'): WorldBookEntry {
  return normalizeWorldBookEntry({
    id: createId('wb'),
    title: '',
    content: '',
    entries: [createWorldBookLoreEntry({ title: '条目 1', activation: 'constant', order: 100 })],
    scope,
    enabled: true,
    coverImage: ''
  });
}

function cloneLoreEntry(entry: WorldBookLoreEntry): WorldBookLoreEntry {
  return { ...entry, keys: [...entry.keys], secondaryKeys: [...entry.secondaryKeys] };
}

function cloneWorldBook(entry: WorldBookEntry): WorldBookEntry {
  const normalized = normalizeWorldBookEntry(entry);
  const fallbackEntry = createWorldBookLoreEntry({
    title: isTabooWorldBook(normalized) ? '禁忌规则 1' : '条目 1',
    activation: isTabooWorldBook(normalized) ? 'priority' : 'constant',
    order: 100
  });
  return {
    ...normalized,
    entries: normalized.entries.length ? normalized.entries.map(cloneLoreEntry) : [fallbackEntry]
  };
}

function beginDraftRestore() {
  isRestoringDraft.value = true;
  hasPendingChanges = false;
  draftVersion += 1;
}

function endDraftRestore() {
  void nextTick(() => {
    isRestoringDraft.value = false;
    saveState.value = 'idle';
  });
}

function loadDraftFromRoute() {
  if (!store.ready) return;
  beginDraftRestore();
  activeEntryIndex.value = 0;
  editorTab.value = 'entries';
  coverState.value = 'idle';
  coverFeedback.value = '';

  if (isEditingRoute.value) {
    const entry = store.worldBooks.find((book) => book.id === routeBookId.value);
    if (!entry) {
      selectedBookId.value = null;
      missingBook.value = true;
      isLoaded.value = true;
      endDraftRestore();
      return;
    }
    selectedBookId.value = entry.id;
    missingBook.value = false;
    Object.assign(draft, cloneWorldBook(entry));
  } else {
    selectedBookId.value = null;
    missingBook.value = false;
    Object.assign(draft, createDraft(normalizeScopeValue(route.query.scope)));
  }

  isLoaded.value = true;
  endDraftRestore();
}

function preparedDraft() {
  const entries = (draft.entries.length ? draft.entries : [createWorldBookLoreEntry({ title: '条目 1', activation: 'constant' })])
    .map((entry, index) => createWorldBookLoreEntry({ ...entry, title: entry.title.trim() || `条目 ${index + 1}` }));
  return normalizeWorldBookEntry({
    ...draft,
    title: isTabooDraft.value ? TABOO_WORLD_BOOK_TITLE : draft.title.trim() || '未命名世界书',
    content: entries.map((entry) => entry.content).filter(Boolean).join('\n\n'),
    entries
  });
}

async function persistDraft(force = false): Promise<boolean> {
  if (isRestoringDraft.value || !isLoaded.value || missingBook.value) return true;
  if (persistPromise) {
    const saved = await persistPromise;
    if (!saved) return false;
    if (!hasPendingChanges) return true;
  }
  if (!force && !hasPendingChanges) return true;

  const versionAtStart = draftVersion;
  saveState.value = 'saving';
  persistPromise = (async () => {
    try {
      const persisted = preparedDraft();
      await store.saveWorldBook(persisted);
      selectedBookId.value = persisted.id;
      if (draftVersion === versionAtStart) {
        hasPendingChanges = false;
        saveState.value = 'saved';
      } else {
        hasPendingChanges = true;
        saveState.value = 'pending';
      }
      return true;
    } catch {
      saveState.value = 'error';
      return false;
    }
  })();

  const currentPersistPromise = persistPromise;
  const saved = await currentPersistPromise;
  if (persistPromise === currentPersistPromise) persistPromise = null;
  if (!saved || !hasPendingChanges) return saved;
  return persistDraft();
}

async function goBack() {
  if (!await persistDraft()) return;
  goBackToShelf();
}

function goBackToShelf() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.push({ name: 'world-book' });
}

async function finishEditing() {
  if (!await persistDraft(true)) return;
  goBackToShelf();
}

function toggleBookEnabled() {
  if (!isTabooDraft.value) draft.enabled = !draft.enabled;
}

function toggleTabooImageGenerationRead() {
  if (!isTabooDraft.value) return;
  draft.includeInImageGeneration = !tabooImageGenerationReadEnabled.value;
}

function parseEntryList(value: string) {
  return [...new Set(value.split(/[，,、\n]/).map((item) => item.trim()).filter(Boolean))];
}

function updateEntryList(entry: WorldBookLoreEntry, field: 'keys' | 'secondaryKeys', event: Event) {
  entry[field] = parseEntryList(event.target instanceof HTMLInputElement ? event.target.value : '');
}

function entryLampClass(entry: WorldBookLoreEntry) {
  return entry.enabled ? `lamp-${entry.activation}` : 'lamp-off';
}

function setEntryActivation(entry: WorldBookLoreEntry, activation: WorldBookEntryActivation) {
  entry.activation = activation;
}

function toggleLoreEntry(index: number) {
  const entry = draft.entries[index];
  if (entry) entry.enabled = !entry.enabled;
}

function addLoreEntry() {
  draft.entries.push(createWorldBookLoreEntry({
    title: isTabooDraft.value ? `禁忌规则 ${draft.entries.length + 1}` : `条目 ${draft.entries.length + 1}`,
    activation: isTabooDraft.value ? 'priority' : 'keyword',
    order: 100 + draft.entries.length * 10
  }));
  activeEntryIndex.value = draft.entries.length - 1;
}

function removeLoreEntry(index: number) {
  if (draft.entries.length <= 1) return;
  draft.entries.splice(index, 1);
  activeEntryIndex.value = Math.min(index, draft.entries.length - 1);
}

async function readCoverImage(event: Event) {
  const image = await readImageFileFromInput(event);
  if (!image) return;
  brokenCoverImages.value = brokenCoverImages.value.filter((item) => item !== image);
  draft.coverImage = image;
  coverState.value = 'success';
  coverFeedback.value = '本地封面已经装入，会跟随这本世界书一起保存。';
}

function isBrokenCoverImage(imageUrl: string | undefined) {
  return Boolean(imageUrl && brokenCoverImages.value.includes(imageUrl));
}

function markBrokenCoverImage(imageUrl: string | undefined) {
  if (!imageUrl || brokenCoverImages.value.includes(imageUrl)) return;
  brokenCoverImages.value = [...brokenCoverImages.value, imageUrl];
  if (draft.coverImage.trim() === imageUrl) {
    coverState.value = 'error';
    coverFeedback.value = '这张图片没有加载成功，请换一个地址或上传本地图片。';
  }
}

function requestDeleteWorldBook() {
  if (isTabooDraft.value) return;
  showDeleteConfirm.value = true;
}

function cancelDeleteWorldBook() {
  if (!isDeletingWorldBook.value) showDeleteConfirm.value = false;
}

async function confirmDeleteWorldBook() {
  const targetId = selectedBookId.value || draft.id;
  if (!targetId || isTabooWorldBook(targetId) || isDeletingWorldBook.value) return;
  isDeletingWorldBook.value = true;
  try {
    await store.deleteWorldBook(targetId);
    showDeleteConfirm.value = false;
    hasPendingChanges = false;
    draftVersion += 1;
    isLoaded.value = false;
    void router.replace({ name: 'world-book' });
  } finally {
    isDeletingWorldBook.value = false;
  }
}

watch(
  () => [store.ready, route.name, routeBookId.value, String(route.query.scope ?? '')],
  loadDraftFromRoute,
  { immediate: true }
);
watch(draft, () => {
  if (!isLoaded.value || missingBook.value || isRestoringDraft.value) return;
  draftVersion += 1;
  hasPendingChanges = true;
  saveState.value = 'pending';
}, { deep: true, flush: 'sync' });
</script>

<style scoped>
.atelier-page {
  --paper: #f5f0e9;
  --ink: #302925;
  --muted: #978a83;
  --line: rgba(94, 74, 65, 0.09);
  display: flex;
  flex-direction: column;
  padding: 0;
  background:
    radial-gradient(circle at 94% 5%, rgba(223, 202, 192, 0.28), transparent 27%),
    linear-gradient(180deg, #faf7f2 0%, var(--paper) 62%, #eee7df 100%);
  color: var(--ink);
}

button,
input,
select,
textarea {
  font: inherit;
}

.atelier-header {
  position: relative;
  z-index: 5;
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: calc(62px + var(--safe-top));
  padding: var(--safe-top) calc(14px + var(--safe-right)) 0 calc(14px + var(--safe-left));
  border-bottom: 1px solid rgba(91, 73, 64, 0.065);
  background: rgba(250, 247, 242, 0.88);
  backdrop-filter: blur(24px);
}

.atelier-back {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.58);
  color: #5b4b44;
  box-shadow: 0 7px 18px rgba(75, 59, 52, 0.06);
}

.atelier-brand {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.atelier-brand span {
  color: #b0988d;
  font-size: 7px;
  font-weight: 850;
  letter-spacing: 0.19em;
  text-transform: uppercase;
}

.atelier-brand h1 {
  margin: 0;
  overflow: hidden;
  font-family: Georgia, "Songti SC", serif;
  font-size: 17px;
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.permanent-chip,
.book-state-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(101, 75, 73, 0.1);
  border-radius: 999px;
  background: #eadbd7;
  color: #795d5c;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.book-state-chip {
  background: rgba(255, 255, 255, 0.58);
  color: #8d817a;
}

.book-state-chip > span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #b4aaa4;
}

.book-state-chip.active > span {
  background: #8fa083;
  box-shadow: 0 0 0 4px rgba(143, 160, 131, 0.12);
}

.atelier-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 20px calc(16px + var(--safe-right)) 28px calc(16px + var(--safe-left));
}

.atelier-workspace,
.atelier-loading,
.missing-archive {
  width: min(100%, 720px);
  margin-inline: auto;
}

.atelier-workspace {
  display: grid;
  gap: 18px;
}

.priority-letter {
  position: relative;
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
  padding: 17px;
  overflow: hidden;
  border-radius: 7px 30px 7px 30px;
  background:
    radial-gradient(circle at 92% 0%, rgba(233, 199, 192, 0.25), transparent 40%),
    linear-gradient(125deg, #49383e, #71545b);
  color: #fff9f5;
  box-shadow: 0 20px 40px rgba(74, 51, 57, 0.18);
}

.priority-letter::after {
  content: '';
  position: absolute;
  right: -26px;
  bottom: -42px;
  width: 120px;
  height: 120px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  box-shadow: 0 0 0 20px rgba(255, 255, 255, 0.025);
}

.priority-monogram {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 50%;
  font-family: Georgia, serif;
  font-size: 22px;
  font-style: italic;
}

.priority-letter > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.priority-letter p,
.priority-letter h2,
.priority-letter small {
  margin: 0;
}

.priority-letter p {
  color: #dfc0bb;
  font-size: 7px;
  font-weight: 850;
  letter-spacing: 0.17em;
  text-transform: uppercase;
}

.priority-letter h2 {
  font-family: Georgia, "Songti SC", serif;
  font-size: 17px;
  font-weight: 500;
}

.priority-letter small {
  color: rgba(255, 248, 244, 0.68);
  font-size: 9px;
  line-height: 1.65;
}

.priority-letter > svg {
  position: relative;
  z-index: 1;
  color: #dec0ba;
}

.taboo-api-routing {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 14px 15px;
  border: 1px solid rgba(112, 84, 78, 0.1);
  border-radius: 28px 8px 28px 8px;
  background:
    radial-gradient(circle at 100% 0%, rgba(220, 191, 184, 0.24), transparent 38%),
    rgba(255, 253, 249, 0.76);
  box-shadow: 0 14px 30px rgba(74, 56, 50, 0.07);
}

.api-routing-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: #eaded9;
  color: #765b55;
}

.api-routing-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.api-routing-copy p,
.api-routing-copy h2,
.api-routing-copy small {
  margin: 0;
}

.api-routing-copy p {
  color: #b09287;
  font-size: 7px;
  font-weight: 850;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.api-routing-copy h2 {
  color: #443833;
  font-family: Georgia, "Songti SC", serif;
  font-size: 14px;
  font-weight: 600;
}

.api-routing-copy small {
  color: #978a83;
  font-size: 8px;
  line-height: 1.55;
}

.api-routing-toggle {
  display: grid;
  justify-items: center;
  gap: 4px;
  min-width: 58px;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: #a07873;
}

.api-routing-toggle > span {
  position: relative;
  display: block;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: #d8ccc6;
  box-shadow: inset 0 1px 3px rgba(67, 48, 43, 0.1);
  transition: background 0.18s ease;
}

.api-routing-toggle i {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fffdf9;
  box-shadow: 0 3px 8px rgba(65, 48, 43, 0.2);
  transition: transform 0.18s ease;
}

.api-routing-toggle strong {
  font-size: 8px;
  font-weight: 800;
}

.api-routing-toggle.active {
  color: #6f7d68;
}

.api-routing-toggle.active > span {
  background: #899d80;
}

.api-routing-toggle.active i {
  transform: translateX(16px);
}

.book-identity {
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 42px 10px 42px 10px;
  background: rgba(255, 253, 249, 0.7);
  box-shadow: 0 18px 38px rgba(77, 60, 52, 0.07);
}

.identity-cover {
  position: relative;
  width: 112px;
  height: 158px;
  padding: 6px;
  background: #fffdf9;
  transform: rotate(-1.5deg);
  box-shadow: 0 14px 26px rgba(68, 52, 46, 0.16);
}

.identity-cover::before {
  content: '';
  position: absolute;
  top: -7px;
  left: 50%;
  z-index: 2;
  width: 42px;
  height: 16px;
  background: rgba(216, 198, 182, 0.75);
  transform: translateX(-50%) rotate(2deg);
}

.identity-cover img,
.identity-cover > span {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  object-fit: cover;
  overflow: hidden;
  background: #e9dfd8;
  color: #6b5850;
  font-family: Georgia, "Songti SC", serif;
  font-size: 12px;
  text-align: center;
}

.identity-cover i {
  position: absolute;
  inset: 6px auto 6px 6px;
  width: 9px;
  background: linear-gradient(90deg, rgba(48, 37, 33, 0.2), transparent);
}

.identity-fields {
  display: grid;
  gap: 11px;
  min-width: 0;
}

.identity-fields label,
.url-field,
.entry-name-field,
.keyword-grid label,
.settings-grid label,
.content-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.identity-fields label > span,
.url-field > span,
.entry-name-field > span,
.keyword-grid label > span,
.settings-grid label > span,
.content-field > span {
  color: #a18f86;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.identity-fields input,
.identity-fields select,
.url-field input,
.entry-name-field input,
.keyword-grid input,
.settings-grid input,
.settings-grid select,
.content-field textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.7);
  color: var(--ink);
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75);
}

.identity-fields input,
.identity-fields select,
.url-field input,
.entry-name-field input,
.keyword-grid input,
.settings-grid input,
.settings-grid select {
  min-height: 43px;
  padding: 0 12px;
  border-radius: 6px 15px 6px 15px;
  font-size: 11px;
}

.identity-fields input:focus,
.identity-fields select:focus,
.url-field input:focus,
.entry-name-field input:focus,
.keyword-grid input:focus,
.settings-grid input:focus,
.settings-grid select:focus,
.content-field textarea:focus {
  border-color: rgba(132, 100, 89, 0.26);
  box-shadow: 0 0 0 3px rgba(194, 162, 150, 0.1);
}

.identity-fields input:disabled,
.identity-fields select:disabled {
  opacity: 1;
  background: #e9e1dc;
  color: #88766f;
  -webkit-text-fill-color: #88766f;
}

.identity-caption {
  display: flex;
  gap: 7px;
  color: #a0938c;
  font-size: 7px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.identity-caption span + span::before {
  content: '·';
  margin-right: 7px;
}

.remove-book-link {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #ad696b;
  font-size: 9px;
  font-weight: 760;
}

.atelier-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 5px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(225, 215, 208, 0.55);
}

.atelier-tabs button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 39px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: #8f827b;
  font-size: 9px;
  font-weight: 780;
}

.atelier-tabs button.active {
  background: #fffdf9;
  color: #55463f;
  box-shadow: 0 8px 18px rgba(75, 59, 52, 0.08);
}

.atelier-tabs small {
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #eee4de;
  font-size: 7px;
}

.atelier-form {
  min-width: 0;
}

.cover-studio,
.entry-studio {
  display: grid;
  gap: 18px;
}

.studio-heading,
.entry-studio-heading > div {
  display: grid;
  gap: 4px;
}

.studio-heading p,
.studio-heading h2,
.studio-heading small,
.entry-studio-heading p,
.entry-studio-heading h2,
.entry-studio-heading small {
  margin: 0;
}

.studio-heading p,
.entry-studio-heading p {
  color: #b0968b;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.studio-heading h2,
.entry-studio-heading h2 {
  font-family: Georgia, "Songti SC", serif;
  font-size: 24px;
  font-weight: 500;
  letter-spacing: -0.035em;
}

.studio-heading small,
.entry-studio-heading small {
  color: #978a83;
  font-size: 9px;
  line-height: 1.65;
}

.cover-dropzone {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 7px;
  min-height: 190px;
  padding: 30px;
  border: 1px dashed rgba(113, 88, 77, 0.22);
  border-radius: 64px 12px 64px 12px;
  background:
    radial-gradient(circle at 50% 26%, rgba(220, 200, 190, 0.24), transparent 30%),
    rgba(255, 253, 249, 0.57);
  color: #8e7e76;
  cursor: pointer;
}

.cover-dropzone input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.cover-dropzone > span {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: #eadfd9;
  color: #795f56;
}

.cover-dropzone strong {
  color: #4f423c;
  font-family: Georgia, "Songti SC", serif;
  font-size: 16px;
  font-weight: 500;
}

.cover-dropzone small {
  font-size: 7px;
  letter-spacing: 0.14em;
}

.url-field > div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding-left: 12px;
  border: 1px solid var(--line);
  border-radius: 7px 16px 7px 16px;
  background: rgba(255, 255, 255, 0.66);
  color: #927f76;
}

.url-field input {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.cover-feedback {
  margin: 0;
  padding: 11px 13px;
  border-radius: 7px 16px 7px 16px;
  font-size: 9px;
  line-height: 1.6;
}

.cover-feedback.success {
  background: #e7ebe2;
  color: #68735f;
}

.cover-feedback.error {
  background: #f1dfdd;
  color: #9e6264;
}

.entry-studio-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.entry-studio-heading > button {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 39px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: #55463f;
  color: #fffaf6;
  font-size: 9px;
  font-weight: 780;
  box-shadow: 0 11px 22px rgba(85, 70, 63, 0.15);
}

.entry-ribbon {
  display: flex;
  gap: 9px;
  padding: 2px 1px 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.entry-ribbon::-webkit-scrollbar {
  display: none;
}

.entry-ribbon button {
  position: relative;
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: auto minmax(58px, auto) auto;
  gap: 7px;
  align-items: center;
  min-height: 42px;
  max-width: 185px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: 7px 18px 7px 18px;
  background: rgba(255, 255, 255, 0.55);
  color: #92857e;
}

.entry-ribbon button.active {
  border-color: #5a4942;
  background: #5a4942;
  color: #fffaf6;
  box-shadow: 0 11px 22px rgba(84, 66, 58, 0.14);
}

.entry-ribbon button.off {
  opacity: 0.55;
}

.entry-ribbon button > span {
  font-family: Georgia, serif;
  font-size: 11px;
  font-style: italic;
}

.entry-ribbon button strong {
  overflow: hidden;
  font-size: 9px;
  font-weight: 780;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-ribbon i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #aaa09a;
}

.entry-ribbon .lamp-keyword { background: #90a386; }
.entry-ribbon .lamp-constant { background: #9299af; }
.entry-ribbon .lamp-priority { background: #c19b7f; }

.entry-paper {
  position: relative;
  display: grid;
  gap: 18px;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 10px 38px 10px 38px;
  background:
    linear-gradient(rgba(137, 112, 100, 0.035) 1px, transparent 1px) 0 34px / 100% 29px,
    rgba(255, 253, 249, 0.76);
  box-shadow: 0 22px 44px rgba(75, 57, 50, 0.08);
}

.entry-paper::before {
  content: '';
  position: absolute;
  top: -8px;
  left: 50%;
  width: 52px;
  height: 17px;
  background: rgba(217, 198, 181, 0.72);
  transform: translateX(-50%) rotate(-1.5deg);
}

.entry-paper.tone-priority {
  border-color: rgba(143, 99, 85, 0.16);
  background-color: rgba(252, 246, 241, 0.82);
}

.entry-paper-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 11px;
  align-items: end;
}

.entry-name-field input {
  font-family: Georgia, "Songti SC", serif;
  font-size: 14px;
  font-weight: 600;
}

.entry-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 43px;
  padding: 0 11px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #eee8e4;
  color: #91847d;
  font-size: 8px;
  font-weight: 780;
  white-space: nowrap;
}

.entry-toggle > span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #b1a7a1;
}

.entry-toggle.active {
  background: #e5eae0;
  color: #65705d;
}

.entry-toggle.active > span {
  background: #8fa083;
  box-shadow: 0 0 0 4px rgba(143, 160, 131, 0.12);
}

.activation-picker {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.activation-picker legend {
  grid-column: 1 / -1;
  margin-bottom: 2px;
  color: #a18f86;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.activation-picker button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 7px;
  align-items: center;
  min-width: 0;
  min-height: 55px;
  padding: 8px 9px;
  border: 1px solid var(--line);
  border-radius: 7px 17px 7px 17px;
  background: rgba(255, 255, 255, 0.58);
  color: #8d8079;
  text-align: left;
}

.activation-picker button > i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #aaa09a;
}

.activation-picker button > span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.activation-picker strong {
  color: #51443e;
  font-size: 9px;
  font-weight: 800;
}

.activation-picker small {
  overflow: hidden;
  font-size: 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activation-picker .mode-keyword.active { background: #e7ece2; color: #68735f; }
.activation-picker .mode-keyword.active > i { background: #8fa083; box-shadow: 0 0 0 4px rgba(143, 160, 131, 0.14); }
.activation-picker .mode-constant.active { background: #e8e8ee; color: #686e82; }
.activation-picker .mode-constant.active > i { background: #9299af; box-shadow: 0 0 0 4px rgba(146, 153, 175, 0.14); }
.activation-picker .mode-priority.active { background: #f1e6de; color: #896c58; }
.activation-picker .mode-priority.active > i { background: #bd9274; box-shadow: 0 0 0 4px rgba(189, 146, 116, 0.14); }

.keyword-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.entry-settings {
  border: 1px solid var(--line);
  border-radius: 7px 17px 7px 17px;
  background: rgba(246, 241, 236, 0.72);
}

.entry-settings summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 43px;
  padding: 0 12px;
  color: #7f7069;
  font-size: 9px;
  font-weight: 780;
  list-style: none;
  cursor: pointer;
}

.entry-settings summary::-webkit-details-marker {
  display: none;
}

.entry-settings[open] summary > svg:last-child {
  transform: rotate(180deg);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 0 12px 12px;
}

.settings-grid input,
.settings-grid select {
  padding-inline: 8px;
  font-size: 9px;
}

.case-option {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 12px 12px;
  color: #8e817a;
  font-size: 8px;
}

.case-option input {
  width: 15px;
  height: 15px;
  accent-color: #756057;
}

.content-field textarea {
  min-height: 230px;
  padding: 15px;
  resize: vertical;
  border-radius: 8px 22px 8px 22px;
  font-size: 12px;
  line-height: 1.85;
}

.entry-paper-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #aaa09a;
  font-size: 7px;
  font-style: italic;
}

.entry-paper-footer button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #aa686a;
  font-size: 8px;
  font-style: normal;
  font-weight: 760;
}

.entry-paper-footer button:disabled {
  opacity: 0.28;
}

.atelier-loading,
.missing-archive {
  display: grid;
  place-items: center;
  gap: 10px;
  min-height: 300px;
  padding: 34px;
  border: 1px solid var(--line);
  border-radius: 64px 14px 64px 14px;
  background: rgba(255, 253, 249, 0.6);
  color: var(--muted);
  text-align: center;
}

.atelier-loading > span {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(98, 77, 68, 0.15);
  border-top-color: #8c7065;
  border-radius: 50%;
  animation: atelier-spin 0.9s linear infinite;
}

@keyframes atelier-spin {
  to { transform: rotate(360deg); }
}

.missing-archive > span {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: #e9ded8;
  color: #786158;
}

.missing-archive p,
.missing-archive h2 {
  margin: 0;
}

.missing-archive p {
  color: #ae9489;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.missing-archive h2 {
  color: var(--ink);
  font-family: Georgia, "Songti SC", serif;
  font-size: 22px;
  font-weight: 500;
}

.missing-archive button {
  min-height: 42px;
  margin-top: 7px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  background: #55463f;
  color: #fffaf6;
  font-size: 9px;
  font-weight: 780;
}

.save-dock {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: calc(68px + var(--safe-bottom));
  padding: 8px calc(14px + var(--safe-right)) calc(8px + var(--safe-bottom)) calc(16px + var(--safe-left));
  border-top: 1px solid rgba(91, 73, 64, 0.065);
  background: rgba(250, 247, 242, 0.9);
  backdrop-filter: blur(24px);
}

.save-dock > div {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.save-dock > div > span {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #aaa19b;
}

.save-dock > div > span.pending,
.save-dock > div > span.saving {
  background: #bd9274;
  box-shadow: 0 0 0 4px rgba(189, 146, 116, 0.12);
}

.save-dock > div > span.saved {
  background: #8fa083;
  box-shadow: 0 0 0 4px rgba(143, 160, 131, 0.12);
}

.save-dock > div > span.error {
  background: #b66c70;
  box-shadow: 0 0 0 4px rgba(182, 108, 112, 0.12);
}

.save-dock p {
  margin: 0;
  overflow: hidden;
  color: #938780;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.save-dock > button {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  background: #55463f;
  color: #fffaf6;
  font-size: 9px;
  font-weight: 800;
  box-shadow: 0 12px 24px rgba(85, 70, 63, 0.17);
}

.delete-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  height: 100vh;
  height: 100dvh;
  padding: max(18px, var(--safe-top)) calc(16px + var(--safe-right)) max(18px, calc(16px + var(--safe-bottom))) calc(16px + var(--safe-left));
  background: rgba(49, 39, 35, 0.4);
  backdrop-filter: blur(15px);
}

.delete-letter {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 9px;
  width: min(100%, 370px);
  padding: 29px 20px 20px;
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 58px 16px 58px 16px;
  background:
    radial-gradient(circle at 90% 0%, rgba(224, 195, 190, 0.42), transparent 35%),
    #f8f2ec;
  color: #8e8079;
  text-align: center;
  box-shadow: 0 32px 90px rgba(53, 40, 35, 0.28);
}

.delete-close {
  position: absolute;
  top: 13px;
  right: 13px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.58);
  color: #756159;
}

.delete-mark {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  margin-bottom: 3px;
  border-radius: 50%;
  background: #efdeda;
  color: #a35f63;
  transform: rotate(-4deg);
}

.delete-letter p,
.delete-letter h2,
.delete-letter small {
  margin: 0;
}

.delete-letter p {
  color: #ae8f87;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.delete-letter h2 {
  color: #352d29;
  font-family: Georgia, "Songti SC", serif;
  font-size: 23px;
  font-weight: 500;
}

.delete-letter small {
  line-height: 1.75;
}

.delete-letter small strong {
  display: block;
  margin-bottom: 3px;
  color: #5b4b44;
}

.delete-letter > div {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
  margin-top: 9px;
}

.delete-letter > div button {
  min-height: 44px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.62);
  color: #665650;
  font-size: 9px;
  font-weight: 780;
}

.delete-letter > div .confirm-remove {
  border-color: #a56064;
  background: #a56064;
  color: #fffaf6;
}

@media (max-width: 420px) {
  .atelier-scroll {
    padding-inline: calc(12px + var(--safe-left));
  }

  .book-identity {
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 14px;
    padding: 15px;
  }

  .identity-cover {
    width: 96px;
    height: 140px;
  }

  .settings-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 350px) {
  .permanent-chip {
    padding-inline: 8px;
    font-size: 0;
  }

  .book-identity {
    grid-template-columns: 82px minmax(0, 1fr);
    gap: 11px;
  }

  .taboo-api-routing {
    grid-template-columns: 36px minmax(0, 1fr) auto;
    gap: 8px;
    padding-inline: 11px;
  }

  .api-routing-icon {
    width: 36px;
    height: 36px;
  }

  .api-routing-copy small {
    display: none;
  }

  .identity-cover {
    width: 82px;
    height: 122px;
  }

  .activation-picker {
    gap: 5px;
  }

  .activation-picker button {
    padding-inline: 6px;
  }

  .activation-picker small {
    display: none;
  }

  .keyword-grid {
    grid-template-columns: 1fr;
  }
}
</style>