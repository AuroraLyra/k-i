<template>
  <section class="generated-image-viewer image-card-viewer" :class="{ 'is-flipped': flipped }" :style="viewerStyle">
    <div class="image-flip-stage">
      <div class="image-flip-card">
        <button
          class="image-face image-face-front"
          type="button"
          :aria-label="`${itemLabel}原图，点击查看中文描述`"
          :aria-hidden="flipped"
          :tabindex="flipped ? -1 : 0"
          @click="setFlipped(true)"
        >
          <img v-if="imageSrc" :src="imageSrc" :alt="description || itemLabel" decoding="async" @load="updateImageRatio" @error="$emit('image-error', imageSrc)" />
          <span v-else class="empty-image">这一页还没有图片</span>
        </button>

        <button
          class="image-face image-face-back"
          type="button"
          :aria-label="`${itemLabel}中文描述，点击查看原图`"
          :aria-hidden="!flipped"
          :tabindex="flipped ? 0 : -1"
          @click="setFlipped(false)"
        >
          <p>{{ description || '暂无中文描述。' }}</p>
        </button>
      </div>
    </div>

    <nav class="image-viewer-switcher" aria-label="图片历史与操作">
      <button type="button" :disabled="!canSelectPrevious" aria-label="查看上一张生成图片" @click="selectOffset(-1)">
        <ChevronLeft :size="20" stroke-width="2.4" />
      </button>

      <div class="image-action-grid">
        <button type="button" aria-label="修改提示词" title="修改提示词" @click="openEditor"><Pencil :size="20" stroke-width="2.4" /></button>
        <button type="button" :disabled="regenerating || !canApply" aria-label="应用此图" title="应用此图" @click="$emit('apply')"><Check :size="20" stroke-width="2.4" /></button>
        <button type="button" :disabled="!imageSrc || downloadDisabled" aria-label="下载图片" title="下载图片" @click="$emit('download')"><Download :size="20" stroke-width="2.4" /></button>
        <button type="button" :disabled="regenerating || !canRegenerate || !description.trim()" :aria-label="regenerating ? '正在重新生成' : '重新生成'" :title="regenerating ? '正在重新生成' : '重新生成'" @click="$emit('regenerate')">
          <LoaderCircle v-if="regenerating" class="spin" :size="20" stroke-width="2.4" />
          <RefreshCw v-else :size="20" stroke-width="2.4" />
        </button>
        <button class="delete-action" :class="{ confirming: confirmingDelete }" type="button" :disabled="regenerating || !canDelete" :aria-label="confirmingDelete ? '再次点击确认删除' : '删除此图'" :title="confirmingDelete ? '再次点击确认删除' : '删除此图'" @click="requestDelete"><Trash2 :size="20" stroke-width="2.4" /></button>
      </div>

      <button type="button" :disabled="!canSelectNext" aria-label="查看下一张生成图片" @click="selectOffset(1)">
        <ChevronRight :size="20" stroke-width="2.4" />
      </button>
    </nav>

    <section v-if="editing" class="image-editor" role="dialog" aria-modal="true" aria-label="修改图片提示词">
      <section class="image-editor-card">
        <header>
          <strong>修改图片提示词</strong>
          <button type="button" aria-label="关闭并保存修改" title="关闭并保存" @click="closeEditor"><X :size="18" stroke-width="2.4" /></button>
        </header>
        <label>
          <span>中文提示词</span>
          <textarea v-model="editorDescription" maxlength="500" rows="5" placeholder="写下这张图片呈现的中文画面。"></textarea>
        </label>
        <label>
          <span>英文提示词</span>
          <textarea v-model="editorGenerationPrompt" maxlength="4000" rows="6" spellcheck="false" placeholder="Describe the scene, subject, light and composition in English."></textarea>
        </label>
      </section>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Check, ChevronLeft, ChevronRight, Download, LoaderCircle, Pencil, RefreshCw, Trash2, X } from 'lucide-vue-next';

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
const editing = ref(false);
const editorDescription = ref('');
const editorGenerationPrompt = ref('');
const imageNaturalRatio = ref(0);
const selectedIndex = computed(() => props.candidates.findIndex((candidate) => candidate.id === props.selectedId));
const canSelectPrevious = computed(() => selectedIndex.value > 0);
const canSelectNext = computed(() => selectedIndex.value >= 0 && selectedIndex.value < props.candidates.length - 1);
const fallbackRatio = computed(() => {
  const [width, height] = props.aspectRatio.split('/').map((value) => Number.parseFloat(value.trim()));
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? width / height : 1;
});
const resolvedRatio = computed(() => imageNaturalRatio.value || fallbackRatio.value);
const viewerStyle = computed(() => ({
  '--generated-image-ratio': String(resolvedRatio.value),
  '--generated-image-ratio-number': String(resolvedRatio.value)
}));

function setFlipped(value: boolean) {
  confirmingDelete.value = false;
  emit('update:flipped', value);
}

function selectOffset(offset: number) {
  const nextCandidate = props.candidates[selectedIndex.value + offset];
  if (!nextCandidate) return;
  confirmingDelete.value = false;
  editing.value = false;
  emit('select', nextCandidate.id);
}

function openEditor() {
  confirmingDelete.value = false;
  editorDescription.value = props.description;
  editorGenerationPrompt.value = props.generationPrompt;
  editing.value = true;
}

function closeEditor() {
  emit('update:description', editorDescription.value);
  emit('update:generationPrompt', editorGenerationPrompt.value);
  editing.value = false;
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
  editing.value = false;
  imageNaturalRatio.value = 0;
});

watch(() => props.imageSrc, () => {
  imageNaturalRatio.value = 0;
});
</script>

<style scoped>
.image-card-viewer {
  position: relative;
  display: grid;
  width: 100%;
  gap: 14px;
  place-items: center;
  color: #111111;
}

.image-flip-stage {
  width: min(100%, calc((var(--app-height) - var(--safe-top) - var(--safe-bottom) - 118px) * var(--generated-image-ratio-number)));
  min-height: 0;
  aspect-ratio: var(--generated-image-ratio);
  perspective: 1800px;
}

.image-flip-card {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 620ms cubic-bezier(0.2, 0.68, 0.16, 1);
}

.is-flipped .image-flip-card {
  transform: rotateY(180deg);
}

.image-face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  min-height: 0 !important;
  padding: 0 !important;
  border: 0;
  border-radius: 0 !important;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform-style: preserve-3d;
}

.image-face-front {
  display: grid;
  width: 100%;
  height: 100%;
  padding: 0;
  place-items: center;
  background: transparent;
  cursor: pointer;
  transform: rotateY(0deg) translateZ(1px);
}

.is-flipped .image-face-front {
  pointer-events: none;
}

.image-face-front img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.empty-image {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  padding: 28px;
  background: #f5f5f5;
  color: #111111;
  font-size: 14px;
  text-align: center;
}

.image-face-back {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  padding: clamp(24px, 8vw, 56px) !important;
  border: 1px solid #ececec;
  background: #ffffff;
  color: #111111;
  cursor: pointer;
  transform: rotateY(180deg) translateZ(1px);
}

.is-flipped .image-face-back {
  pointer-events: auto;
}

.image-face-back p {
  max-width: min(100%, 36ch);
  margin: 0;
  font-family: "Songti SC", "STSong", Georgia, serif;
  font-size: clamp(17px, 5vw, 24px) !important;
  font-weight: 500;
  line-height: 1.8 !important;
  text-align: center;
  white-space: pre-wrap;
}

.image-viewer-switcher {
  display: grid;
  width: min(100%, 360px);
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  align-items: center;
  gap: 2px;
}

.image-viewer-switcher > button {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  min-height: 0 !important;
  padding: 0 !important;
  border: 0;
  border-radius: 16px !important;
  background: transparent;
  color: #171717;
}

.image-viewer-switcher > button:disabled {
  color: #c7c9ca;
}

.image-action-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
}

.image-action-grid button {
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 36px !important;
  padding: 3px 1px !important;
  border: 0;
  border-radius: 9px !important;
  background: transparent;
  color: #151515;
  line-height: 1;
}

.image-action-grid button svg {
  flex: 0 0 auto;
}

.image-action-grid button:active:not(:disabled) {
  transform: translateY(1px);
}

.image-action-grid button:disabled {
  color: #b8b8b8;
  background: transparent;
}

.image-action-grid .delete-action {
  color: #a34d4d;
}

.image-action-grid .delete-action.confirming {
  background: transparent;
  color: #d13f3f;
}

.image-editor {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  align-items: center;
  padding: 10px;
  background: rgba(255, 255, 255, 0.94);
}

.image-editor-card {
  display: grid;
  gap: 14px;
  width: min(100%, 360px);
  max-height: 100%;
  margin: 0 auto;
  padding: 18px;
  overflow: auto;
  border: 1px solid #e9e9e9;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.12);
}

.image-editor-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.image-editor-card header strong {
  font-size: 15px;
}

.image-editor-card header button {
  display: grid;
  width: 28px;
  height: 28px;
  min-height: 0 !important;
  place-items: center;
  padding: 0 !important;
  border-radius: 50% !important;
  background: transparent;
  color: #222222;
  font-size: 20px !important;
}

.spin {
  animation: image-viewer-spin 0.8s linear infinite;
}

@keyframes image-viewer-spin {
  to {
    transform: rotate(360deg);
  }
}

.image-editor-card label {
  display: grid;
  gap: 7px;
  color: #252525;
  font-size: 12px;
  font-weight: 750;
}

.image-editor-card textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #e5e5e5;
  border-radius: 10px;
  background: #ffffff;
  color: #111111;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.6;
  resize: vertical;
}

@media (max-height: 620px) {
  .image-flip-stage {
    width: min(100%, calc((var(--app-height) - var(--safe-top) - var(--safe-bottom) - 94px) * var(--generated-image-ratio-number)));
  }

  .image-card-viewer {
    gap: 8px;
  }

  .image-action-grid button {
    min-height: 32px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .image-flip-card {
    transition-duration: 1ms;
  }
}
</style>