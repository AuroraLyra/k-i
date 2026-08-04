<template>
  <article class="voom-post">
    <header>
      <div class="author-row">
        <img class="avatar" :src="resolvedAuthorAvatar" :alt="resolvedAuthorName" />
        <div>
          <strong>{{ resolvedAuthorName }}</strong>
          <time>{{ formatRelativeDate(post.createdAt) }}</time>
        </div>
      </div>
      <div class="header-actions">
        <button
          class="header-action"
          type="button"
          :aria-label="replyingThread ? '正在生成评论回复' : 'AI 回复评论区'"
          :title="replyingThread ? '正在生成评论回复' : 'AI 回复评论区'"
          :disabled="replyingThread"
          @click="emit('reply-thread', post.id)"
        >
          <LoaderCircle v-if="replyingThread" class="loading-icon" :size="18" />
          <BotMessageSquare v-else :size="18" />
        </button>
        <button class="header-action delete-action" type="button" aria-label="删除 VOOM 动态" title="删除 VOOM 动态" @click="emit('delete-post', post.id)">
          <X :size="18" />
        </button>
      </div>
    </header>
    <p>{{ postDisplayContent }}</p>
    <figure v-if="hasVisualContent" class="post-visual" :class="{ mock: !post.image || isBrokenImageSource(post.image) }" :style="visualStyle" @click="openVisualModal">
      <img v-if="post.image && !isBrokenImageSource(post.image)" :src="post.image" :alt="post.imageDescription || post.content" loading="lazy" decoding="async" @error="markBrokenImageSource(post.image)" />
      <figcaption v-else>{{ visualDescription }}</figcaption>
    </figure>
    <footer>
      <span v-if="post.likes.length" ref="likeSummaryRef" class="likes-summary">{{ displayedLikeSummary }}</span>
      <span v-else class="likes-summary">还没有点赞</span>
      <span v-if="post.likes.length" ref="likeMeasureRef" class="likes-measure" aria-hidden="true">{{ fullLikeSummary }}</span>
      <div class="post-actions">
        <button class="action-button" :class="{ active: likedByMe }" type="button" aria-label="点赞" @click="emit('toggle-like', post.id)">
          <Heart :size="17" />
        </button>
        <button class="action-button" type="button" aria-label="评论" @click="openCommentComposer()">
          <MessageCircle :size="17" />
        </button>
      </div>
    </footer>
    <form v-if="isComposerFor('')" class="comment-composer" @submit.prevent="submitComment">
      <input v-model="commentDraft" :placeholder="commentPlaceholder" />
      <button type="submit" :disabled="!commentDraft.trim()">发送</button>
    </form>
    <div v-if="post.comments.length" class="comments">
      <article v-for="thread in commentThreads" :key="thread.comment.id" class="comment-thread">
        <button class="comment-line comment-main" type="button" @click="openCommentComposer(thread.comment.id)">
          <span class="comment-meta">
            <strong>{{ displayAuthorName(thread.comment.authorName, thread.comment.authorId) }}</strong>
          </span>
          <span class="comment-text">{{ commentDisplayContent(thread.comment) }}</span>
          <time class="comment-inline-time" :datetime="commentDateTime(thread.comment)">{{ commentTime(thread.comment) }}</time>
        </button>
        <form v-if="isComposerFor(thread.comment.id)" class="comment-composer comment-composer-inline" @submit.prevent="submitComment">
          <input v-model="commentDraft" :placeholder="commentPlaceholder" />
          <button type="submit" :disabled="!commentDraft.trim()">发送</button>
        </form>
        <div v-if="thread.replies.length" class="comment-replies">
          <template v-for="reply in thread.replies" :key="reply.id">
            <button class="comment-line comment-reply" type="button" @click="openCommentComposer(reply.id)">
              <span class="comment-meta">
                <strong>{{ displayAuthorName(reply.authorName, reply.authorId) }}</strong>
              </span>
              <span class="comment-text">{{ replyDisplayContent(reply) }}</span>
              <time class="comment-inline-time" :datetime="commentDateTime(reply)">{{ commentTime(reply) }}</time>
            </button>
            <form v-if="isComposerFor(reply.id)" class="comment-composer comment-composer-inline" @submit.prevent="submitComment">
              <input v-model="commentDraft" :placeholder="commentPlaceholder" />
              <button type="submit" :disabled="!commentDraft.trim()">发送</button>
            </form>
          </template>
        </div>
      </article>
    </div>

    <AppModal v-model="showVisualModal" title="VOOM 图片日记" :show-header="false" variant="image-journal">
      <GeneratedImageFlipViewer
        v-model:flipped="visualFlipped"
        v-model:description="descriptionDraft"
        v-model:generation-prompt="generationPromptDraft"
        :image-src="modalImageSrc === '/load.jpg' ? '' : modalImageSrc"
        :candidates="visualCandidates"
        :selected-id="selectedCandidateId"
        :applied-image-src="post.image"
        :aspect-ratio="visualAspectRatio"
        item-label="VOOM 配图"
        :can-regenerate="canRegenerateImage"
        :regenerating="regeneratingImage"
        :can-apply="canApplySelectedCandidate"
        :can-delete="Boolean(modalImageSrc && modalImageSrc !== '/load.jpg')"
        :download-disabled="modalImageSrc === '/load.jpg'"
        @select="selectCandidate"
        @download="downloadCurrentVisual"
        @apply="applySelectedCandidate"
        @regenerate="regenerateImage"
        @delete="deleteSelectedCandidate"
        @image-error="markBrokenImageSource"
      />
    </AppModal>
  </article>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { BotMessageSquare, Heart, LoaderCircle, MessageCircle, X } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import GeneratedImageFlipViewer from '@/components/image/GeneratedImageFlipViewer.vue';
import type { VoomPost } from '@/types/domain';
import { downloadImageUrl } from '@/utils/download';
import { formatRelativeDate } from '@/utils/time';
import { formatContentWithChineseTranslation } from '@/utils/translation';
import { stripVoomCommentReplyPrefix } from '@/utils/voom';

const props = defineProps<{
  post: VoomPost;
  authorName?: string;
  authorAvatar?: string;
  currentUserId?: string;
  currentUserName?: string;
  characterDisplayNames?: Record<string, string>;
  characterAuthorAliases?: Record<string, string>;
  canRegenerateImage?: boolean;
  regeneratingImage?: boolean;
  replyingThread?: boolean;
}>();

const emit = defineEmits<{
  'toggle-like': [postId: string];
  comment: [postId: string, content: string, parentId?: string];
  'reply-thread': [postId: string];
  'regenerate-image': [postId: string, description: string, generationPrompt: string];
  'apply-image': [postId: string, candidateId: string];
  'delete-image': [postId: string, candidateId: string, imageUrl: string];
  'busy-action': [message: string, title: string];
  'delete-post': [postId: string];
}>();

const showComposer = ref(false);
const commentDraft = ref('');
const replyParentId = ref('');
const showVisualModal = ref(false);
const visualFlipped = ref(false);
const descriptionDraft = ref('');
const generationPromptDraft = ref('');
const selectedCandidateId = ref('');
const brokenImageSources = ref<string[]>([]);
const lastCandidateCount = ref(0);
const busyReminderShown = ref(false);
const likeSummaryRef = ref<HTMLElement | null>(null);
const likeMeasureRef = ref<HTMLElement | null>(null);
const compactLikeSummary = ref(false);
let likeResizeObserver: ResizeObserver | undefined;
let likeMeasureFrame = 0;

const resolvedAuthorName = computed(() => props.authorName || props.post.authorName);
const resolvedAuthorAvatar = computed(() => props.authorAvatar || props.post.authorAvatar);
const likedByMe = computed(() => Boolean(props.currentUserName && props.post.likes.includes(props.currentUserName)));
const replyTarget = computed(() => props.post.comments.find((comment) => comment.id === replyParentId.value));
const commentPlaceholder = computed(() => replyTarget.value ? `回复 ${displayAuthorName(replyTarget.value.authorName, replyTarget.value.authorId)}` : '评论这条 VOOM');
const visualDescription = computed(() => props.post.imageDescription || '配图描述暂未保存。');
const hasVisualContent = computed(() => Boolean(props.post.image || props.post.imageDescription?.trim()));
const visualCandidates = computed(() => {
  const candidates = [...(props.post.imageCandidates ?? [])].filter((candidate) => candidate.image && candidate.image !== '/load.jpg' && !isBrokenImageSource(candidate.image));
  if (props.post.image && props.post.image !== '/load.jpg' && !candidates.some((candidate) => candidate.image === props.post.image)) {
    candidates.unshift({
      id: `${props.post.id}-current-image`,
      image: props.post.image,
      description: props.post.imageDescription || props.post.content,
      generationPrompt: props.post.imageGenerationPrompt,
      negativePrompt: props.post.imageNegativePrompt,
      referenceImage: props.post.imageReferenceImage,
      seed: props.post.imageSeed,
      provider: props.post.imageProvider || 'local',
      createdAt: props.post.createdAt
    });
  }
  return candidates;
});
const selectedCandidate = computed(() => visualCandidates.value.find((candidate) => candidate.id === selectedCandidateId.value) ?? visualCandidates.value.find((candidate) => candidate.image === props.post.image));
const modalImageSrc = computed(() => props.post.image === '/load.jpg' ? '/load.jpg' : selectedCandidate.value?.image || props.post.image || '/load.jpg');
const canApplySelectedCandidate = computed(() => Boolean(selectedCandidate.value && selectedCandidate.value.image !== props.post.image && !selectedCandidate.value.id.endsWith('-current-image')));
const visualAspectRatio = computed(() => {
  const size = selectedCandidate.value?.size || props.post.imageCandidates?.find((candidate) => candidate.image === props.post.image)?.size || '';
  const [width, height] = size.split('x').map((value) => Number.parseInt(value, 10));
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? `${width} / ${height}` : '1 / 1';
});
const visualStyle = computed(() => ({ '--voom-image-ratio': visualAspectRatio.value }));
const postDisplayContent = computed(() => formatContentWithChineseTranslation(props.post.content, props.post.contentTranslation));
const displayLikeNames = computed(() => props.post.likes.map((name) => displayAuthorName(name)));
const fullLikeSummary = computed(() => displayLikeNames.value.length ? `${displayLikeNames.value.join('、')} 赞了` : '还没有点赞');
const shortLikeSummary = computed(() => {
  const firstLike = displayLikeNames.value[0];
  if (!firstLike) return '还没有点赞';
  return displayLikeNames.value.length > 1 ? `${firstLike} 等${displayLikeNames.value.length}人赞过` : `${firstLike} 赞过`;
});
const displayedLikeSummary = computed(() => compactLikeSummary.value ? shortLikeSummary.value : fullLikeSummary.value);
const commentIndexById = computed(() => new Map(props.post.comments.map((comment, index) => [comment.id, index])));
const commentThreads = computed(() => {
  const commentById = new Map(props.post.comments.map((comment) => [comment.id, comment]));
  const threads = new Map<string, { comment: VoomPost['comments'][number]; replies: VoomPost['comments'] }>();

  function rootCommentFor(comment: VoomPost['comments'][number]) {
    let current = comment;
    const seenCommentIds = new Set<string>();
    while (current.parentId) {
      const parent = commentById.get(current.parentId);
      if (!parent || seenCommentIds.has(parent.id)) break;
      seenCommentIds.add(parent.id);
      current = parent;
    }
    return current;
  }

  for (const comment of props.post.comments) {
    const rootComment = rootCommentFor(comment);
    if (!threads.has(rootComment.id)) {
      threads.set(rootComment.id, { comment: rootComment, replies: [] });
    }
    if (rootComment.id !== comment.id) {
      threads.get(rootComment.id)?.replies.push(comment);
    }
  }

  return [...threads.values()];
});

function commentDisplayContent(comment: VoomPost['comments'][number]) {
  const targetName = replyTargetName(comment.parentId);
  const rawTargetName = rawReplyTargetName(comment.parentId);
  const content = stripVoomCommentReplyPrefix(stripVoomCommentReplyPrefix(comment.content, rawTargetName), targetName);
  const contentTranslation = comment.contentTranslation
    ? stripVoomCommentReplyPrefix(stripVoomCommentReplyPrefix(comment.contentTranslation, rawTargetName), targetName)
    : comment.contentTranslation;
  return formatContentWithChineseTranslation(
    content,
    contentTranslation
  );
}

function replyDisplayContent(comment: VoomPost['comments'][number]) {
  const targetName = replyTargetName(comment.parentId);
  const content = commentDisplayContent(comment);
  return targetName ? `@${targetName} ${content}` : content;
}

function normalizeAuthorKey(name = '') {
  return name.trim().toLocaleLowerCase();
}

function displayAuthorName(authorName = '', authorId = '') {
  const idDisplayName = authorId ? props.characterDisplayNames?.[authorId] : '';
  if (idDisplayName) return idDisplayName;
  return props.characterAuthorAliases?.[normalizeAuthorKey(authorName)] || authorName;
}

function commentTimestamp(comment: VoomPost['comments'][number]) {
  return comment.createdAt ?? props.post.createdAt + (commentIndexById.value.get(comment.id) ?? 0) + 1;
}

function commentTime(comment: VoomPost['comments'][number]) {
  return formatRelativeDate(commentTimestamp(comment));
}

function commentDateTime(comment: VoomPost['comments'][number]) {
  return new Date(commentTimestamp(comment)).toISOString();
}

function openCommentComposer(parentId = '') {
  replyParentId.value = parentId;
  showComposer.value = true;
  window.setTimeout(() => {
    document.addEventListener('pointerdown', handleOutsidePointerDown);
  });
}

function isComposerFor(parentId = '') {
  return showComposer.value && replyParentId.value === parentId;
}

function openVisualModal() {
  lastCandidateCount.value = visualCandidates.value.length;
  selectedCandidateId.value = visualCandidates.value.find((candidate) => candidate.image === props.post.image)?.id ?? visualCandidates.value[0]?.id ?? '';
  syncVisualDrafts();
  visualFlipped.value = !props.post.image;
  showVisualModal.value = true;
}

function selectCandidate(candidateId: string) {
  selectedCandidateId.value = candidateId;
  syncVisualDrafts(visualCandidates.value.find((candidate) => candidate.id === candidateId));
}

function applySelectedCandidate() {
  if (props.regeneratingImage) {
    emit('busy-action', '正在重新生成 VOOM 配图，请等待当前生成完成。', '正在生成');
    return;
  }
  if (!selectedCandidate.value || !canApplySelectedCandidate.value) return;
  emit('apply-image', props.post.id, selectedCandidate.value.id);
}

function isBrokenImageSource(source: string | undefined) {
  return Boolean(source && brokenImageSources.value.includes(source));
}

function markBrokenImageSource(source: string | undefined) {
  if (!source || brokenImageSources.value.includes(source)) return;
  brokenImageSources.value = [...brokenImageSources.value, source];
}

function regenerateImage() {
  const description = descriptionDraft.value.trim();
  if (props.regeneratingImage) {
    if (!busyReminderShown.value) {
      busyReminderShown.value = true;
      emit('busy-action', '正在重新生成 VOOM 配图，请等待当前生成完成。', '正在生成');
    }
    return;
  }
  if (!description) return;
  emit('regenerate-image', props.post.id, description, generationPromptDraft.value.trim());
  visualFlipped.value = false;
}

function syncVisualDrafts(candidate = selectedCandidate.value) {
  descriptionDraft.value = candidate?.description || visualDescription.value;
  generationPromptDraft.value = candidate?.generationPrompt ?? props.post.imageGenerationPrompt ?? '';
}

function deleteSelectedCandidate() {
  if (!modalImageSrc.value || modalImageSrc.value === '/load.jpg') return;
  emit('delete-image', props.post.id, selectedCandidateId.value, modalImageSrc.value);
}

async function downloadCurrentVisual() {
  if (!modalImageSrc.value || modalImageSrc.value === '/load.jpg') return;
  try {
    await downloadImageUrl(modalImageSrc.value, `link-voom-image-${props.post.id}`);
  } catch (error) {
    emit('busy-action', error instanceof Error ? error.message : '图片下载失败。', '下载失败');
  }
}

watch(() => props.regeneratingImage, (isRegenerating) => {
  if (!isRegenerating) busyReminderShown.value = false;
});

function submitComment() {
  const content = commentDraft.value.trim();
  if (!content) return;
  emit('comment', props.post.id, content, replyParentId.value || undefined);
  commentDraft.value = '';
  replyParentId.value = '';
  showComposer.value = false;
  removeOutsideListener();
}

function replyTargetName(parentId?: string) {
  if (!parentId) return '';
  const target = props.post.comments.find((comment) => comment.id === parentId);
  return target ? displayAuthorName(target.authorName, target.authorId) : '';
}

function rawReplyTargetName(parentId?: string) {
  if (!parentId) return '';
  return props.post.comments.find((comment) => comment.id === parentId)?.authorName ?? '';
}

function closeCommentComposer() {
  showComposer.value = false;
  replyParentId.value = '';
  removeOutsideListener();
}

function handleOutsidePointerDown(event: PointerEvent) {
  const target = event.target;
  if (target instanceof HTMLElement && target.closest('.comment-composer')) return;
  closeCommentComposer();
}

function removeOutsideListener() {
  document.removeEventListener('pointerdown', handleOutsidePointerDown);
}

function scheduleLikeSummaryMeasure() {
  if (likeMeasureFrame) window.cancelAnimationFrame(likeMeasureFrame);
  likeMeasureFrame = window.requestAnimationFrame(() => {
    likeMeasureFrame = 0;
    void nextTick(updateLikeSummaryMode);
  });
}

function updateLikeSummaryMode() {
  const summaryEl = likeSummaryRef.value;
  const measureEl = likeMeasureRef.value;
  if (!summaryEl || !measureEl || !props.post.likes.length) {
    compactLikeSummary.value = false;
    return;
  }

  compactLikeSummary.value = measureEl.scrollWidth > summaryEl.clientWidth;
}

watch(fullLikeSummary, scheduleLikeSummaryMeasure, { immediate: true });

watch(() => visualCandidates.value.length, (count, previousCount) => {
  if (!showVisualModal.value) {
    lastCandidateCount.value = count;
    return;
  }
  if (count > previousCount && count > lastCandidateCount.value) {
    selectedCandidateId.value = visualCandidates.value[count - 1]?.id ?? selectedCandidateId.value;
    syncVisualDrafts();
    visualFlipped.value = false;
  }
  lastCandidateCount.value = count;
});
watch(() => props.post.image, () => {
  if (!showVisualModal.value) return;
  selectedCandidateId.value = visualCandidates.value.find((candidate) => candidate.image === props.post.image)?.id ?? '';
  syncVisualDrafts();
  visualFlipped.value = false;
});

watch(() => visualCandidates.value.map((candidate) => candidate.id).join('|'), () => {
  if (!showVisualModal.value || visualCandidates.value.some((candidate) => candidate.id === selectedCandidateId.value)) return;
  selectedCandidateId.value = visualCandidates.value.find((candidate) => candidate.image === props.post.image)?.id ?? visualCandidates.value.at(-1)?.id ?? '';
  syncVisualDrafts();
});

onMounted(() => {
  if (likeSummaryRef.value) {
    likeResizeObserver = new ResizeObserver(scheduleLikeSummaryMeasure);
    likeResizeObserver.observe(likeSummaryRef.value);
  }
  scheduleLikeSummaryMeasure();
});

onBeforeUnmount(() => {
  removeOutsideListener();
  if (likeMeasureFrame) window.cancelAnimationFrame(likeMeasureFrame);
  likeResizeObserver?.disconnect();
});
</script>

<style scoped>
.voom-post {
  padding: 14px 16px;
  background: #ffffff;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.author-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.author-row div {
  display: grid;
  gap: 2px;
}

.author-row strong {
  font-size: 15px;
}

.header-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 2px;
}

.header-action,
.action-button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: transparent;
  color: #4b4f55;
}

.header-action:active,
.action-button:active {
  background: transparent;
  color: var(--link-green);
}

.header-action:disabled {
  color: var(--link-green);
  cursor: progress;
}

.delete-action {
  color: #8b929a;
}

.delete-action:active {
  color: var(--danger);
}

.loading-icon {
  animation: voom-spin 0.8s linear infinite;
}

@keyframes voom-spin {
  to {
    transform: rotate(360deg);
  }
}

.action-button.active {
  background: transparent;
  color: var(--link-green);
}

time {
  color: var(--muted);
  font-size: 11px;
}

.voom-post > p {
  margin: 10px 0;
  color: #171717;
  font-size: 14px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.post-visual {
  position: relative;
  width: min(56vw, 216px);
  max-width: 100%;
  margin: 10px 0 12px;
  aspect-ratio: var(--voom-image-ratio, 1 / 1);
  overflow: hidden;
  border-radius: 18px;
  background: #eff1f3;
  cursor: zoom-in;
}

.post-visual img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.post-visual.mock {
  display: grid;
  place-items: center;
  padding: 18px;
  border: 1px solid #eef0f2;
  background: #ffffff;
}

.post-visual figcaption {
  max-width: 100%;
  margin: 0;
  padding: 0;
  color: #222222;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.6;
  text-align: center;
}

footer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--muted);
  font-size: 12px;
}

.likes-summary {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.likes-measure {
  position: absolute;
  left: 0;
  bottom: 0;
  max-width: none;
  overflow: hidden;
  visibility: hidden;
  white-space: nowrap;
  pointer-events: none;
}

.post-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
}

.post-actions svg,
.header-action svg {
  width: 16px;
  height: 16px;
}

.comments {
  display: grid;
  gap: 6px;
  margin-top: 8px;
  padding: 8px;
  border-radius: 8px;
  background: var(--soft);
}

.comment-thread {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.comment-line {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 1px 0;
  border-radius: 0;
  background: transparent;
  color: #4f555c;
  font-size: 11px;
  line-height: 1.42;
  text-align: left;
  overflow-wrap: anywhere;
}

.comment-line:active {
  color: #171717;
}

.comment-meta {
  display: inline;
  margin-right: 4px;
  vertical-align: baseline;
}

.comment-inline-time {
  margin-left: 6px;
  color: #9298a0;
  font-size: 10px;
  white-space: nowrap;
}

.comment-meta strong {
  color: #14171a;
  font-size: inherit;
  font-weight: 800;
  line-height: inherit;
}

.comment-text {
  color: inherit;
  font-weight: 400;
  white-space: pre-wrap;
}

.comment-replies {
  display: grid;
  gap: 2px;
  margin-top: 2px;
  padding: 1px 0 1px 6px;
  border-left: 1px solid rgba(20, 23, 26, 0.09);
}

.comment-reply {
  color: #5c636c;
}

.comment-reply .comment-meta strong {
  color: #2f343a;
}

.comment-reply .comment-inline-time {
  color: #9aa0a7;
}

.comment-composer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 6px;
  border-radius: 12px;
  background: #f7f8f9;
}

.comment-composer-inline {
  margin: 4px 0 3px;
}

.comment-composer input {
  height: 32px;
  padding: 0 11px;
  border-radius: 999px;
  background: #ffffff;
  color: #222222;
}

.comment-composer button {
  flex: 0 0 auto;
  height: 32px;
  padding: 0 13px;
  border-radius: 999px;
  background: var(--link-green);
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
}

.comment-composer button:disabled {
  background: #d6d8db;
}
</style>