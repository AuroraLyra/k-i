<template>
  <section class="generated-image-viewer" :class="{ 'is-flipped': flipped }" :style="viewerStyle">
    <div class="image-flip-stage">
      <div class="image-flip-card">
        <button
          class="image-face image-face-front"
          type="button"
          :aria-label="`${itemLabel}原图，点击任意位置翻到图片日记`"
          :aria-hidden="flipped"
          :tabindex="flipped ? -1 : 0"
          @click="setFlipped(true)"
        >
          <img v-if="imageSrc" :src="imageSrc" :alt="description || itemLabel" decoding="async" @load="updateImageRatio" @error="$emit('image-error', imageSrc)" />
          <span v-else class="empty-image">
            <strong>这一页还没有图片</strong>
            <small>轻触翻到背面编辑描述并重新生成</small>
          </span>
        </button>

        <article
          class="image-face image-face-back"
          :aria-hidden="!flipped"
          @click="setFlipped(false)"
        >
          <aside class="history-rail" aria-label="历史图片" @click.stop>
            <header>
              <span>ARCHIVE</span>
              <small>{{ candidates.length }} CUTS</small>
            </header>
            <div class="history-scroll">
              <button
                v-for="(candidate, index) in candidates"
                :key="candidate.id"
                class="history-thumb"
                :class="{ active: candidate.id === selectedId }"
                type="button"
                :aria-label="`查看历史图片 ${index + 1}`"
                @click="selectCandidate(candidate.id)"
              >
                <img :src="candidate.image" :alt="candidate.description || itemLabel" loading="lazy" decoding="async" @error="$emit('image-error', candidate.image)" />
                <span>{{ String(index + 1).padStart(2, '0') }}</span>
                <i v-if="candidate.image === appliedImageSrc" aria-label="当前应用"></i>
              </button>
            </div>
          </aside>

          <main class="journal-page">
            <header class="journal-head">
              <div>
                <span>오늘의 기록 · IMAGE DIARY</span>
                <strong>把这一刻，留在纸上。</strong>
              </div>
              <time>{{ selectedDateLabel }}</time>
            </header>

            <label class="journal-description" @click.stop>
              <span>中文画面描述</span>
              <textarea
                :value="description"
                maxlength="500"
                rows="6"
                placeholder="写下这张图片呈现的中文画面。"
                @input="updateDescription"
              ></textarea>
            </label>

            <label class="journal-prompt" @click.stop>
              <span>
                <strong>ACTUAL IMAGE PROMPT</strong>
                <small>实际发送给生图模型 · 可直接修改</small>
              </span>
              <textarea
                :value="generationPrompt"
                maxlength="4000"
                rows="5"
                spellcheck="false"
                placeholder="Describe the scene, subject, light and composition in English."
                @input="updateGenerationPrompt"
              ></textarea>
            </label>

            <footer class="journal-foot">
              <span>{{ selectedMetaLabel }}</span>
              <span>点击非输入区域翻回原图</span>
            </footer>
          </main>

          <aside class="action-rail" aria-label="图片操作" @click.stop>
            <button type="button" @click="setFlipped(false)">
              <small>01</small>
              <span>查看原图</span>
            </button>
            <button type="button" :disabled="!imageSrc || downloadDisabled" @click="$emit('download')">
              <small>02</small>
              <span>保存图片</span>
            </button>
            <button type="button" :disabled="regenerating || !canApply" @click="$emit('apply')">
              <small>03</small>
              <span>应用此图</span>
            </button>
            <button class="primary-action" type="button" :disabled="regenerating || !canRegenerate || !description.trim()" @click="$emit('regenerate')">
              <small>04</small>
              <span>{{ regenerating ? '生成中…' : '重新生成' }}</span>
            </button>
            <button
              class="delete-action"
              :class="{ confirming: confirmingDelete }"
              type="button"
              :disabled="regenerating || !canDelete"
              @click="requestDelete"
            >
              <small>05</small>
              <span>{{ confirmingDelete ? '再次点击确认' : '删除此图' }}</span>
            </button>
          </aside>
        </article>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

export interface GeneratedImageViewerCandidate {
  id: string;
  image: string;
  description: string;
  generationPrompt?: string;
  provider?: string;
  model?: string;
  size?: string;
  createdAt: number;
}

const props = withDefaults(defineProps<{
  flipped: boolean;
  imageSrc: string;
  description: string;
  generationPrompt: string;
  candidates: GeneratedImageViewerCandidate[];
  selectedId: string;
  appliedImageSrc?: string;
  aspectRatio?: string;
  itemLabel?: string;
  canRegenerate?: boolean;
  regenerating?: boolean;
  canApply?: boolean;
  canDelete?: boolean;
  downloadDisabled?: boolean;
}>(), {
  appliedImageSrc: '',
  aspectRatio: '1 / 1',
  itemLabel: '图片',
  canRegenerate: false,
  regenerating: false,
  canApply: false,
  canDelete: false,
  downloadDisabled: false
});

const emit = defineEmits<{
  'update:flipped': [value: boolean];
  'update:description': [value: string];
  'update:generationPrompt': [value: string];
  select: [candidateId: string];
  download: [];
  apply: [];
  regenerate: [];
  delete: [];
  'image-error': [source: string];
}>();

const confirmingDelete = ref(false);
const imageNaturalRatio = ref(0);
const selectedCandidate = computed(() => props.candidates.find((candidate) => candidate.id === props.selectedId));
const fallbackRatio = computed(() => {
  const [width, height] = props.aspectRatio.split('/').map((value) => Number.parseFloat(value.trim()));
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? width / height : 1;
});
const resolvedRatio = computed(() => imageNaturalRatio.value || fallbackRatio.value);
const viewerStyle = computed(() => ({
  '--generated-image-ratio': String(resolvedRatio.value),
  '--generated-image-ratio-number': String(resolvedRatio.value)
}));
const selectedDateLabel = computed(() => {
  const createdAt = selectedCandidate.value?.createdAt;
  if (!createdAt) return 'NEW PAGE';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(createdAt);
});
const selectedMetaLabel = computed(() => {
  const candidate = selectedCandidate.value;
  return [candidate?.model || candidate?.provider || 'IMAGE', candidate?.size || 'ORIGINAL'].filter(Boolean).join(' · ');
});

function setFlipped(value: boolean) {
  confirmingDelete.value = false;
  emit('update:flipped', value);
}

function selectCandidate(candidateId: string) {
  confirmingDelete.value = false;
  emit('select', candidateId);
}

function updateDescription(event: Event) {
  emit('update:description', (event.target as HTMLTextAreaElement).value);
}

function updateGenerationPrompt(event: Event) {
  emit('update:generationPrompt', (event.target as HTMLTextAreaElement).value);
}

function updateImageRatio(event: Event) {
  const image = event.target as HTMLImageElement;
  imageNaturalRatio.value = image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 0;
}

function requestDelete() {
  if (!confirmingDelete.value) {
    confirmingDelete.value = true;
    return;
  }
  confirmingDelete.value = false;
  emit('delete');
}

watch(() => props.selectedId, () => {
  confirmingDelete.value = false;
});

watch(() => props.imageSrc, () => {
  imageNaturalRatio.value = 0;
});
</script>

<style scoped>
.generated-image-viewer {
  width: 100%;
  color: #403b35;
}

.image-flip-stage {
  width: 100%;
  height: min(570px, calc(var(--app-height) - var(--safe-top) - var(--safe-bottom) - 128px));
  min-height: 430px;
  perspective: 1800px;
}

.image-flip-card {
  position: relative;
  width: 100%;
  height: 100%;
  -webkit-transform: rotateY(0deg);
  transform: rotateY(0deg);
  -webkit-transform-style: preserve-3d;
  transform-style: preserve-3d;
  transition: transform 720ms cubic-bezier(0.2, 0.68, 0.16, 1);
  -webkit-transition: -webkit-transform 720ms cubic-bezier(0.2, 0.68, 0.16, 1);
}

.is-flipped .image-flip-card {
  -webkit-transform: rotateY(180deg);
  transform: rotateY(180deg);
}

.image-face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  -webkit-transform-style: preserve-3d;
  transform-style: preserve-3d;
}

.image-face-front {
  display: grid;
  width: 100%;
  height: 100%;
  padding: 0;
  place-items: center;
  border-radius: 23px;
  background:
    radial-gradient(circle at 50% 10%, rgba(255, 255, 255, 0.09), transparent 36%),
    #171615;
  box-shadow: 0 25px 65px rgba(31, 23, 18, 0.3);
  -webkit-transform: rotateY(0deg) translateZ(1px);
  transform: rotateY(0deg) translateZ(1px);
  cursor: pointer;
  pointer-events: auto;
}

.is-flipped .image-face-front {
  pointer-events: none;
}

.image-face-front img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.page-corner {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 36px;
  height: 36px;
  border-radius: 18px 0 0;
  background: linear-gradient(135deg, transparent 48%, rgba(255, 255, 255, 0.7) 49%);
  opacity: 0.72;
}

.empty-image {
  display: grid;
  max-width: 240px;
  justify-items: center;
  gap: 8px;
  padding: 28px;
  color: rgba(255, 255, 255, 0.72);
  text-align: center;
}

.empty-image strong { font-family: Georgia, "Songti SC", serif; font-size: 17px; font-weight: 500; }
.empty-image small { color: rgba(255, 255, 255, 0.48); font-size: 10px; line-height: 1.6; }

.image-face-back {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) 58px;
  gap: 8px;
  padding: 9px;
  border: 1px solid rgba(99, 80, 61, 0.12);
  border-radius: 24px 5px 24px 5px;
  background:
    radial-gradient(circle at 90% 4%, rgba(199, 151, 122, 0.2), transparent 26%),
    linear-gradient(145deg, #d8cfbd, #ede7da 56%, #d8cfbd);
  box-shadow: 0 27px 72px rgba(53, 41, 31, 0.34), -8px 9px 0 rgba(255, 250, 239, 0.38);
  -webkit-transform: rotateY(180deg) translateZ(1px);
  transform: rotateY(180deg) translateZ(1px);
  cursor: pointer;
  pointer-events: none;
}

.is-flipped .image-face-back {
  pointer-events: auto;
}

.history-rail,
.action-rail {
  min-width: 0;
  border: 1px solid rgba(96, 76, 57, 0.1);
  border-radius: 15px 4px 15px 4px;
  background: rgba(255, 252, 245, 0.55);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.65);
  cursor: default;
}

.history-rail {
  display: grid;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  padding: 7px 5px;
}

.history-rail > header {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 3px 0 8px;
  color: #8a7463;
}

.history-rail > header span,
.action-rail span {
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.history-scroll {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 7px;
  overflow: hidden auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  touch-action: pan-y;
}

.history-scroll::-webkit-scrollbar { display: none; }

.history-thumb {
  position: relative;
  flex: 0 0 49px;
  width: 100%;
  height: 49px;
  padding: 2px;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 11px 3px 11px 3px;
  background: rgba(255, 255, 255, 0.5);
}

.history-thumb.active {
  border-color: #8ba296;
  background: #ffffff;
  box-shadow: 0 4px 11px rgba(69, 76, 68, 0.18);
}

.history-thumb img { display: block; width: 100%; height: 100%; border-radius: 8px 2px 8px 2px; object-fit: cover; }
.history-thumb > span { position: absolute; left: 4px; bottom: 3px; padding: 1px 3px; border-radius: 4px; background: rgba(23, 24, 22, 0.62); color: #fff; font-size: 6px; font-weight: 900; }
.history-thumb > i { position: absolute; top: 4px; right: 4px; width: 7px; height: 7px; border: 2px solid #fff; border-radius: 50%; background: #6f9b83; box-shadow: 0 1px 4px rgba(20, 44, 31, 0.35); }

.journal-page {
  position: relative;
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr) minmax(108px, 0.72fr) auto;
  padding: 15px 14px 10px 20px;
  border: 1px solid rgba(91, 73, 54, 0.11);
  border-radius: 4px 17px 4px 17px;
  background:
    linear-gradient(90deg, transparent 0 15px, rgba(185, 127, 117, 0.17) 15px 16px, transparent 16px),
    repeating-linear-gradient(0deg, transparent 0 27px, rgba(103, 95, 78, 0.08) 27px 28px),
    #fbf7ed;
  box-shadow: 0 10px 23px rgba(73, 56, 38, 0.13);
}

.journal-page::before {
  position: absolute;
  top: 0;
  left: 20px;
  width: 56px;
  height: 3px;
  background: #8ca397;
  content: '';
}

.journal-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 9px;
  color: #86776b;
}

.journal-head div { display: grid; gap: 2px; }
.journal-head span { color: #81978c; font-size: 7px; font-weight: 950; letter-spacing: 0.16em; }
.journal-head strong { color: #403f38; font-family: Georgia, "Songti SC", serif; font-size: 16px; font-weight: 500; }
.journal-head time { font-size: 7px; font-weight: 800; letter-spacing: 0.04em; white-space: nowrap; }

.journal-description,
.journal-prompt {
  display: grid;
  min-height: 0;
  cursor: text;
}

.journal-description { grid-template-rows: auto minmax(0, 1fr); align-content: center; padding: 7px 2px 10px; }
.journal-description > span { color: #9a8878; font-size: 8px; font-weight: 900; letter-spacing: 0.12em; text-align: center; }

.journal-description textarea,
.journal-prompt textarea {
  width: 100%;
  min-height: 0;
  padding: 7px 5px;
  overflow: auto;
  border: 0;
  outline: 0;
  background: transparent;
  color: #4d4c45;
  resize: none;
  scrollbar-width: thin;
}

.journal-description textarea {
  align-self: center;
  font-family: Georgia, "Songti SC", serif;
  font-size: 14px;
  font-weight: 500;
  line-height: 2;
  text-align: center;
}

.journal-prompt {
  grid-template-rows: auto minmax(0, 1fr);
  padding: 8px 9px 6px;
  border: 1px dashed rgba(120, 104, 86, 0.19);
  border-radius: 8px 2px 8px 2px;
  background: rgba(255, 255, 255, 0.37);
}

.journal-prompt > span { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.journal-prompt strong { color: #748d80; font-size: 7px; letter-spacing: 0.12em; }
.journal-prompt small { color: #a19588; font-size: 7px; }
.journal-prompt textarea { color: #6a655d; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9px; line-height: 1.55; }

.journal-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding-top: 8px;
  color: #92877a;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.journal-foot span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.journal-foot span:last-child { flex: 0 0 auto; }

.action-rail {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 7px;
  justify-content: center;
  padding: 7px 5px;
  overflow: hidden auto;
}

.action-rail button {
  display: grid;
  min-height: 48px;
  flex: 0 0 auto;
  place-items: center;
  gap: 3px;
  padding: 5px 2px;
  border: 1px solid rgba(94, 79, 64, 0.1);
  border-radius: 10px 3px 10px 3px;
  background: rgba(255, 255, 255, 0.62);
  color: #675f57;
}

.action-rail button:not(:disabled):active { transform: translateY(1px); }
.action-rail button:disabled { opacity: 0.38; cursor: default; }
.action-rail .primary-action { background: #294038; color: #edf6ef; }
.action-rail .delete-action { color: #a45555; }
.action-rail .delete-action.confirming { border-color: #b66a64; background: #a94f4f; color: #fff; }

.spin { animation: image-viewer-spin 0.8s linear infinite; }
@keyframes image-viewer-spin { to { transform: rotate(360deg); } }

@media (max-width: 390px) {
  .image-face-back { grid-template-columns: 50px minmax(0, 1fr) 50px; gap: 5px; padding: 6px; }
  .journal-page { padding: 13px 9px 8px 16px; }
  .history-rail, .action-rail { padding-inline: 4px; }
  .history-thumb { height: 42px; flex-basis: 42px; }
  .action-rail button { min-height: 44px; }
  .journal-description textarea { font-size: 12px; }
  .journal-prompt textarea { font-size: 8px; }
}

@media (max-height: 620px) {
  .image-flip-stage { height: calc(var(--app-height) - var(--safe-top) - var(--safe-bottom) - 102px); min-height: 360px; }
  .journal-page { grid-template-rows: auto minmax(0, 1fr) minmax(82px, 0.56fr) auto; }
  .action-rail { justify-content: start; }
  .action-rail button { min-height: 39px; }
}

@media (prefers-reduced-motion: reduce) {
  .image-flip-card { transition-duration: 1ms; }
}

.generated-image-viewer {
  display: grid;
  width: 100%;
  place-items: center;
  color: #373833;
}

.image-flip-stage {
  width: min(100%, calc((var(--app-height) - var(--safe-top) - var(--safe-bottom) - 36px) * var(--generated-image-ratio-number)));
  height: auto;
  min-height: 0;
  aspect-ratio: var(--generated-image-ratio);
  perspective: 1800px;
}

.image-face-front {
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.image-face-front img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.empty-image {
  width: 100%;
  max-width: none;
  height: 100%;
  align-content: center;
  padding: 28px;
  background: #f5f1e9;
  color: #77786f;
}

.empty-image small { color: #a2a196; }

.image-face-back {
  grid-template-columns: 66px minmax(0, 1fr) 76px;
  gap: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: #f8f5ee;
  box-shadow: 0 28px 72px rgba(27, 25, 22, 0.26);
}

.history-rail,
.action-rail {
  min-width: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  cursor: default;
}

.history-rail {
  padding: 15px 7px 10px;
  border-right: 1px solid rgba(53, 57, 51, 0.09);
  background: #e9ebe6;
}

.history-rail > header {
  gap: 1px;
  padding: 0 0 12px;
  color: #5e665f;
}

.history-rail > header span {
  font-family: Arial, sans-serif;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.history-rail > header small {
  color: #9a9e98;
  font-size: 6px;
  letter-spacing: 0.08em;
}

.history-scroll {
  gap: 10px;
  padding: 2px 2px 12px;
}

.history-thumb {
  flex: 0 0 58px;
  width: 100%;
  height: 58px;
  padding: 3px 3px 11px;
  overflow: visible;
  border: 0;
  border-radius: 1px;
  background: #fffefa;
  box-shadow: 0 4px 10px rgba(43, 46, 41, 0.13);
  transform: rotate(-1.8deg);
  transition: transform 180ms ease, box-shadow 180ms ease;
}

.history-thumb:nth-child(even) { transform: rotate(1.5deg); }

.history-thumb.active {
  border: 0;
  outline: 2px solid #88958c;
  outline-offset: 2px;
  background: #fffefa;
  box-shadow: 0 7px 16px rgba(43, 46, 41, 0.2);
  transform: rotate(0deg) translateY(-1px);
}

.history-thumb img {
  width: 100%;
  height: 100%;
  border-radius: 0;
  object-fit: cover;
}

.history-thumb > span {
  right: 3px;
  bottom: 2px;
  left: auto;
  padding: 0;
  background: transparent;
  color: #8a8c85;
  font-family: Arial, sans-serif;
  font-size: 6px;
  font-weight: 700;
}

.history-thumb > i {
  top: -4px;
  right: -4px;
  width: 7px;
  height: 7px;
  border: 1px solid #fff;
  background: #788b7f;
  box-shadow: none;
}

.journal-page {
  grid-template-rows: auto minmax(102px, 1fr) minmax(98px, 0.68fr) auto;
  padding: 20px 17px 13px;
  overflow: hidden auto;
  border: 0;
  border-radius: 0;
  background:
    linear-gradient(90deg, transparent 0 12px, rgba(200, 156, 155, 0.17) 12px 13px, transparent 13px),
    repeating-linear-gradient(0deg, transparent 0 30px, rgba(86, 92, 84, 0.055) 30px 31px),
    #fbf8f1;
  box-shadow: none;
  scrollbar-width: none;
}

.journal-page::-webkit-scrollbar { display: none; }

.journal-page::before {
  top: 7px;
  left: 50%;
  width: 52px;
  height: 13px;
  background: rgba(203, 193, 169, 0.42);
  transform: translateX(-50%) rotate(-1deg);
}

.journal-head {
  align-items: start;
  padding: 3px 0 13px;
  border-bottom: 1px solid rgba(72, 76, 69, 0.1);
  color: #929087;
}

.journal-head div { gap: 4px; }
.journal-head span { color: #7d897f; font-family: Arial, sans-serif; font-size: 6px; font-weight: 800; letter-spacing: 0.12em; }
.journal-head strong { color: #454640; font-family: "Songti SC", Georgia, serif; font-size: 15px; font-weight: 500; letter-spacing: 0.04em; }
.journal-head time { padding-top: 1px; color: #a09d94; font-family: Arial, sans-serif; font-size: 6px; font-weight: 600; }

.journal-description {
  grid-template-rows: auto minmax(0, 1fr);
  align-content: center;
  padding: 13px 3px 11px;
}

.journal-description > span {
  color: #9b978e;
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-align: left;
}

.journal-description textarea {
  align-self: stretch;
  padding: 9px 1px;
  color: #3f413c;
  font-family: "Songti SC", Georgia, serif;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.9;
  text-align: left;
}

.journal-prompt {
  grid-template-rows: auto minmax(70px, 1fr);
  padding: 10px 3px 4px;
  border: 0;
  border-top: 1px solid rgba(72, 76, 69, 0.12);
  border-radius: 0;
  background: transparent;
}

.journal-prompt > span {
  display: grid;
  justify-content: stretch;
  gap: 2px;
}

.journal-prompt strong { color: #728178; font-family: Arial, sans-serif; font-size: 6px; font-weight: 800; letter-spacing: 0.14em; }
.journal-prompt small { color: #9f9d95; font-size: 6px; }
.journal-prompt textarea { padding: 7px 1px; color: #6c6d66; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8px; line-height: 1.6; }

.journal-foot {
  padding-top: 9px;
  color: #9d9a91;
  font-family: Arial, sans-serif;
  font-size: 6px;
  font-weight: 600;
}

.action-rail {
  display: grid;
  grid-template-rows: repeat(5, minmax(52px, 1fr));
  gap: 0;
  justify-content: stretch;
  padding: 0;
  overflow: hidden auto;
  border-left: 1px solid rgba(53, 57, 51, 0.09);
  background: #f0ece4;
}

.action-rail button {
  display: flex;
  min-height: 0;
  align-items: flex-start;
  justify-content: center;
  flex-direction: column;
  gap: 5px;
  padding: 8px 9px;
  border: 0;
  border-bottom: 1px solid rgba(58, 61, 56, 0.09);
  border-radius: 0;
  background: transparent;
  color: #555951;
  text-align: left;
}

.action-rail button small {
  color: #a3a198;
  font-family: Arial, sans-serif;
  font-size: 6px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.action-rail button span {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.35;
}

.action-rail button:not(:disabled):active {
  background: rgba(117, 132, 122, 0.1);
  transform: none;
}

.action-rail button:disabled { opacity: 0.3; }
.action-rail .primary-action { background: #78877d; color: #fff; }
.action-rail .primary-action small { color: rgba(255, 255, 255, 0.58); }
.action-rail .delete-action { color: #a66e69; }
.action-rail .delete-action.confirming { border-color: transparent; background: #a66e69; color: #fff; }
.action-rail .delete-action.confirming small { color: rgba(255, 255, 255, 0.58); }

@media (max-width: 390px) {
  .image-face-back { grid-template-columns: 58px minmax(0, 1fr) 68px; gap: 0; padding: 0; }
  .history-rail { padding: 13px 6px 9px; }
  .journal-page { padding: 18px 13px 11px; }
  .history-thumb { height: 52px; flex-basis: 52px; }
  .action-rail { padding: 0; }
  .action-rail button { min-height: 0; padding: 7px; }
  .journal-description textarea { font-size: 12px; }
  .journal-prompt textarea { font-size: 8px; }
}

@media (max-height: 620px) {
  .image-flip-stage {
    width: min(100%, calc((var(--app-height) - var(--safe-top) - var(--safe-bottom) - 24px) * var(--generated-image-ratio-number)));
    height: auto;
    min-height: 0;
  }
  .journal-page { grid-template-rows: auto minmax(84px, 1fr) minmax(78px, 0.62fr) auto; }
  .action-rail { justify-content: stretch; }
  .action-rail button { min-height: 0; }
}
</style>