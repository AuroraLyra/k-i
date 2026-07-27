<template>
  <section class="screen no-tabs archive-page">
    <header class="archive-header">
      <button class="back-button" type="button" aria-label="返回首页" @click="goBack">
        <ArrowLeft :size="19" stroke-width="1.9" />
      </button>
      <div class="archive-brand">
        <span>BabyLink collection</span>
        <h1>World Archive</h1>
      </div>
      <div class="header-actions">
        <button type="button" :disabled="importingWorldBooks" aria-label="导入世界书（JSON、TXT、DOC、DOCX）" title="导入 JSON / TXT / DOC / DOCX 世界书" @click="openImportPicker">
          <Upload :size="17" stroke-width="1.9" />
        </button>
        <button class="create-button" type="button" aria-label="新建世界书" @click="openCreateWorldBook">
          <Plus :size="17" stroke-width="2" />
        </button>
        <input
          ref="importInputRef"
          class="file-input"
          type="file"
          accept=".json,.txt,.doc,.docx,application/json,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          @change="importWorldBookFiles"
        />
      </div>
    </header>

    <main class="archive-scroll">
      <section class="archive-masthead">
        <div class="masthead-copy">
          <p>나의 작은 세계 · issue {{ issueNumber }}</p>
          <h2>把不能忘记的<br />写进世界里</h2>
          <small>收藏每个小世界的规则与作用领域</small>
        </div>
        <div class="masthead-seal" aria-hidden="true">
          <span>W</span>
          <small>archive</small>
        </div>
        <span class="masthead-note">private<br />collection</span>
      </section>

      <nav v-if="store.ready" class="scope-strip" aria-label="世界书分类">
        <button
          v-for="filter in filters"
          :key="filter.id"
          type="button"
          :class="{ active: activeScope === filter.id }"
          @click="activeScope = filter.id"
        >
          <component :is="filter.icon" :size="14" stroke-width="1.8" />
          <span>{{ filter.label }}</span>
          <small>{{ scopeCount(filter.id) }}</small>
        </button>
      </nav>

      <section v-if="store.ready" class="shelf-stage">
        <WorldBookShelf ref="worldBookShelfRef" :books="filteredBooks" :create-scope="createScope" />
      </section>

      <section v-else class="archive-loading">
        <span></span>
        <p>正在整理你的收藏</p>
      </section>
    </main>

    <Teleport to="body">
      <div v-if="feedback.open" class="archive-dialog-backdrop" @click.self="feedback.open = false">
        <section class="archive-dialog" role="dialog" aria-modal="true" :aria-label="feedback.title">
          <button class="dialog-close" type="button" aria-label="关闭" @click="feedback.open = false">
            <X :size="17" stroke-width="1.8" />
          </button>
          <span class="dialog-stamp" :class="{ success: feedback.success }">
            <Check v-if="feedback.success" :size="23" stroke-width="1.8" />
            <FileUp v-else :size="23" stroke-width="1.8" />
          </span>
          <p>Archive notice</p>
          <h2>{{ feedback.title }}</h2>
          <div class="dialog-message">{{ feedback.message }}</div>
          <button class="dialog-confirm" type="button" @click="feedback.open = false">收进档案</button>
        </section>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, BookOpen, Check, FileUp, Globe2, LockKeyhole, Plus, Upload, UserRound, X } from 'lucide-vue-next';
import WorldBookShelf from '@/components/home/WorldBookShelf.vue';
import { useAppStore } from '@/stores/appStore';
import type { WorldBookEntry } from '@/types/domain';
import { isTabooWorldBook } from '@/utils/worldBook';
import { parseWorldBookImportText, readWorldBookImportFile, worldBookImportSourceTypeForFile } from '@/utils/worldBookImport';

type ScopeFilter = 'all' | 'online' | 'offline' | 'local' | 'taboo';

const router = useRouter();
const store = useAppStore();
const worldBookShelfRef = ref<InstanceType<typeof WorldBookShelf> | null>(null);
const importInputRef = ref<HTMLInputElement | null>(null);
const activeScope = ref<ScopeFilter>('all');
const importingWorldBooks = ref(false);
const feedback = reactive({ open: false, title: '', message: '', success: false });

const filters = [
  { id: 'all' as const, label: '全部', icon: BookOpen },
  { id: 'online' as const, label: '线上', icon: Globe2 },
  { id: 'offline' as const, label: '线下', icon: BookOpen },
  { id: 'local' as const, label: '局部', icon: UserRound },
  { id: 'taboo' as const, label: '禁忌', icon: LockKeyhole }
];

const issueNumber = computed(() => Math.max(1, store.worldBooks.length).toString().padStart(2, '0'));
const filteredBooks = computed(() => {
  if (activeScope.value === 'all') return store.worldBooks;
  if (activeScope.value === 'taboo') return store.worldBooks.filter((book) => isTabooWorldBook(book));
  const scope = {
    online: 'global-online',
    offline: 'global-offline',
    local: 'local'
  }[activeScope.value];
  return store.worldBooks.filter((book) => book.scope === scope && !isTabooWorldBook(book));
});
const createScope = computed<WorldBookEntry['scope']>(() => {
  if (activeScope.value === 'online') return 'global-online';
  if (activeScope.value === 'offline') return 'global-offline';
  return 'local';
});

function scopeCount(scope: ScopeFilter) {
  if (scope === 'all') return store.worldBooks.length;
  if (scope === 'taboo') return store.worldBooks.filter((book) => isTabooWorldBook(book)).length;
  const targetScope = { online: 'global-online', offline: 'global-offline', local: 'local' }[scope];
  return store.worldBooks.filter((book) => book.scope === targetScope && !isTabooWorldBook(book)).length;
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.push({ name: 'home' });
}

function openCreateWorldBook() {
  worldBookShelfRef.value?.openCreateModal();
}

function openImportPicker() {
  if (!importingWorldBooks.value) importInputRef.value?.click();
}

function showFeedback(title: string, message: string, success = false) {
  Object.assign(feedback, { open: true, title, message, success });
}

async function importWorldBookFiles(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  const files = Array.from(input?.files ?? []);
  if (!files.length) return;

  importingWorldBooks.value = true;
  try {
    await store.hydrate();
    const importedBooks: WorldBookEntry[] = [];
    const warnings: string[] = [];
    for (const file of files) {
      const result = parseWorldBookImportText(await readWorldBookImportFile(file), {
        fileName: file.name,
        defaultScope: createScope.value,
        sourceType: worldBookImportSourceTypeForFile(file)
      });
      importedBooks.push(...result.books);
      warnings.push(...result.warnings.map((warning) => `${file.name}: ${warning}`));
    }
    if (!importedBooks.length) {
      showFeedback('没有找到可收藏的内容', warnings.join('\n') || '文件中没有识别到世界书条目。');
      return;
    }
    await Promise.all(importedBooks.map((book) => store.saveWorldBook(book)));
    showFeedback('已经放进书架', `成功收藏 ${importedBooks.length} 本世界书。${warnings.length ? `\n\n${warnings.join('\n')}` : ''}`, true);
  } catch (error) {
    showFeedback('这次导入没有完成', error instanceof Error ? error.message : '请检查文件后再试一次。');
  } finally {
    importingWorldBooks.value = false;
    if (input) input.value = '';
  }
}
</script>

<style scoped>
.archive-page {
  --paper: #f5f0e9;
  --ink: #2f2925;
  --muted: #978b84;
  --rose: #c7a198;
  display: flex;
  flex-direction: column;
  padding: 0;
  background:
    radial-gradient(circle at 8% 3%, rgba(222, 202, 191, 0.28), transparent 27%),
    linear-gradient(180deg, #faf7f2 0%, var(--paper) 62%, #eee7df 100%);
  color: var(--ink);
}

.archive-header {
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

.archive-header button {
  display: inline-grid;
  place-items: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid rgba(91, 73, 64, 0.09);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.58);
  color: #5b4b44;
  box-shadow: 0 7px 18px rgba(75, 59, 52, 0.06);
}

.archive-brand {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.archive-brand span {
  color: #b0988d;
  font-size: 7px;
  font-weight: 850;
  letter-spacing: 0.19em;
  text-transform: uppercase;
}

.archive-brand h1 {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
  font-size: 18px;
  font-weight: 500;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.header-actions {
  position: relative;
  display: flex;
  gap: 7px;
}

.archive-header .create-button {
  border-color: #55463f;
  background: #55463f;
  color: #fffaf6;
}

.archive-header button:disabled {
  opacity: 0.42;
}

.file-input {
  display: none;
}

.archive-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 22px calc(16px + var(--safe-right)) calc(38px + var(--safe-bottom)) calc(16px + var(--safe-left));
}

.archive-masthead,
.scope-strip,
.shelf-stage,
.archive-loading {
  width: min(100%, 720px);
  margin-inline: auto;
}

.archive-masthead {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 82px;
  gap: 12px;
  min-height: 205px;
  padding: 24px 22px;
  overflow: hidden;
  border: 1px solid rgba(105, 83, 73, 0.08);
  border-radius: 76px 18px 76px 18px;
  background:
    linear-gradient(108deg, rgba(255, 253, 249, 0.86), rgba(241, 228, 219, 0.76)),
    #f5ece6;
  box-shadow: 0 20px 44px rgba(82, 64, 56, 0.08);
}

.archive-masthead::before {
  content: '';
  position: absolute;
  top: -46px;
  right: -35px;
  width: 175px;
  height: 175px;
  border: 1px solid rgba(119, 90, 79, 0.1);
  border-radius: 50%;
  box-shadow: 0 0 0 24px rgba(255, 255, 255, 0.18), 0 0 0 49px rgba(255, 255, 255, 0.11);
}

.masthead-copy {
  position: relative;
  z-index: 1;
  display: grid;
  align-content: center;
  gap: 9px;
}

.masthead-copy p,
.masthead-copy h2,
.masthead-copy small {
  margin: 0;
}

.masthead-copy p {
  color: #aa8d82;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.masthead-copy h2 {
  font-family: Georgia, "Songti SC", serif;
  font-size: clamp(28px, 8vw, 39px);
  font-weight: 500;
  line-height: 1.18;
  letter-spacing: -0.055em;
}

.masthead-copy small {
  max-width: 310px;
  color: #8f8179;
  font-size: 10px;
  line-height: 1.7;
}

.masthead-seal {
  position: relative;
  z-index: 1;
  align-self: center;
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  border: 1px solid rgba(95, 72, 64, 0.22);
  border-radius: 50%;
  color: #6f554d;
  transform: rotate(7deg);
}

.masthead-seal::after {
  content: '';
  position: absolute;
  inset: 5px;
  border: 1px dashed rgba(95, 72, 64, 0.18);
  border-radius: inherit;
}

.masthead-seal span {
  font-family: Georgia, serif;
  font-size: 29px;
  font-style: italic;
  line-height: 0.9;
}

.masthead-seal small {
  margin-top: -16px;
  font-size: 6px;
  font-weight: 850;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.masthead-note {
  position: absolute;
  right: 17px;
  bottom: 13px;
  color: rgba(112, 87, 77, 0.45);
  font-family: Georgia, serif;
  font-size: 8px;
  font-style: italic;
  line-height: 1.15;
  text-align: right;
}

.scope-strip {
  display: flex;
  gap: 8px;
  margin-top: 18px;
  padding: 3px 1px 7px;
  overflow-x: auto;
  scrollbar-width: none;
}

.scope-strip::-webkit-scrollbar {
  display: none;
}

.scope-strip button {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 37px;
  padding: 0 12px;
  border: 1px solid rgba(94, 75, 66, 0.09);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.55);
  color: #8f8179;
  font-size: 9px;
  font-weight: 760;
  white-space: nowrap;
  box-shadow: 0 7px 16px rgba(73, 57, 50, 0.035);
}

.scope-strip button.active {
  border-color: #55463f;
  background: #55463f;
  color: #fffaf6;
  box-shadow: 0 10px 22px rgba(85, 70, 63, 0.15);
}

.scope-strip button small {
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 50%;
  background: rgba(126, 103, 93, 0.09);
  font-size: 7px;
}

.scope-strip button.active small {
  background: rgba(255, 255, 255, 0.15);
}

.shelf-stage {
  margin-top: 22px;
}

.archive-loading {
  display: grid;
  place-items: center;
  gap: 12px;
  min-height: 280px;
  color: var(--muted);
  font-size: 10px;
  letter-spacing: 0.08em;
}

.archive-loading span {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(98, 77, 68, 0.15);
  border-top-color: #8c7065;
  border-radius: 50%;
  animation: archive-spin 0.9s linear infinite;
}

@keyframes archive-spin {
  to { transform: rotate(360deg); }
}

.archive-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  height: 100vh;
  height: 100dvh;
  padding: max(18px, var(--safe-top)) calc(16px + var(--safe-right)) max(18px, calc(16px + var(--safe-bottom))) calc(16px + var(--safe-left));
  background: rgba(49, 39, 35, 0.38);
  backdrop-filter: blur(15px);
}

.archive-dialog {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 9px;
  width: min(100%, 370px);
  max-height: min(680px, calc(100dvh - 36px - var(--safe-top) - var(--safe-bottom)));
  padding: 28px 20px 20px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 58px 18px 58px 18px;
  background:
    radial-gradient(circle at 88% 0%, rgba(225, 202, 193, 0.5), transparent 35%),
    #f8f3ed;
  color: #8f8179;
  text-align: center;
  box-shadow: 0 32px 90px rgba(53, 40, 35, 0.27);
}

.dialog-close {
  position: absolute;
  top: 13px;
  right: 13px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid rgba(91, 72, 64, 0.08);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.58);
  color: #756159;
}

.dialog-stamp {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  margin-bottom: 4px;
  border-radius: 50%;
  background: #e9ddd6;
  color: #805f58;
  transform: rotate(-4deg);
}

.dialog-stamp.success {
  background: #e4e8df;
  color: #68745f;
}

.archive-dialog p,
.archive-dialog h2 {
  margin: 0;
}

.archive-dialog p {
  color: #ad9287;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.archive-dialog h2 {
  color: #352d29;
  font-family: Georgia, "Songti SC", serif;
  font-size: 24px;
  font-weight: 500;
}

.dialog-message {
  width: 100%;
  max-height: 190px;
  overflow-y: auto;
  font-size: 10px;
  line-height: 1.75;
  white-space: pre-wrap;
}

.dialog-confirm {
  width: 100%;
  min-height: 44px;
  margin-top: 8px;
  border: 0;
  border-radius: 999px;
  background: #55463f;
  color: #fffaf6;
  font-size: 10px;
  font-weight: 800;
  box-shadow: 0 12px 24px rgba(85, 70, 63, 0.16);
}

@media (max-width: 360px) {
  .archive-scroll {
    padding-inline: calc(12px + var(--safe-left));
  }

  .archive-masthead {
    grid-template-columns: minmax(0, 1fr) 65px;
    min-height: 190px;
    padding: 21px 18px;
  }

  .masthead-seal {
    width: 62px;
    height: 62px;
  }

  .masthead-copy small {
    font-size: 9px;
  }
}
</style>