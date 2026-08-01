<template>
  <form :class="['composer', { 'composer--online': online, 'composer--text-mode': textMode }]" @submit.prevent="submit">
    <div v-if="quote" class="composer-quote">
      <div>
        <strong>{{ quote.authorName }}</strong>
        <span>{{ quoteContent }}</span>
      </div>
      <button class="quote-cancel" type="button" aria-label="取消引用" @click="$emit('cancel-quote')">
        <X :size="15" />
      </button>
    </div>
    <section v-if="visibleStickerSuggestions.length" class="sticker-suggestions" aria-label="推荐 Stickers">
      <button
        v-for="sticker in visibleStickerSuggestions"
        :key="sticker.id"
        class="suggestion-chip"
        type="button"
        :aria-label="`发送推荐 Sticker：${sticker.description}`"
        :disabled="disabled"
        @pointerdown.prevent="keepTextMode"
        @click="pickStickerSuggestion(sticker)"
      >
        <img :src="getStickerDisplayImageUrl(sticker)" :alt="sticker.description" />
        <span>{{ sticker.description }}</span>
      </button>
    </section>
    <button v-if="!textMode" class="icon-button" type="button" aria-label="添加" @click="$emit('open-menu')">
      <Plus :size="27" />
    </button>
    <input ref="cameraInputRef" class="visually-hidden-input" type="file" accept="image/*" capture="environment" @change="handleCameraFile" />
    <button v-if="!textMode" class="icon-button" type="button" aria-label="相机" :disabled="disabled" @click="openCameraInput">
      <Camera :size="23" />
    </button>
    <button v-if="online && !textMode" class="icon-button" type="button" aria-label="图片" :disabled="disabled" @click="$emit('open-image-panel')">
      <ImageIcon :size="23" />
    </button>
    <div class="composer-input">
      <textarea
        ref="inputRef"
        v-model="text"
        rows="1"
        enterkeyhint="send"
        :placeholder="placeholder"
        :disabled="effectiveInputDisabled"
        @pointerdown="prepareInputFocus"
        @keydown.enter="handleEnterKey"
        @focus="handleFocus"
        @blur="handleBlur"
      />
      <button v-if="!textMode" class="sticker-button" type="button" aria-label="Stickers" :disabled="disabled" @click.stop="openStickers">
        <Smile :size="online ? 20 : 21" />
      </button>
    </div>
    <template v-if="online && textMode">
      <button class="text-action text-action--send" type="button" :disabled="disabled || !text.trim()" @pointerdown.prevent="keepTextMode" @click="submit">发送</button>
      <button class="text-action text-action--reply" type="button" :disabled="disabled || (!text.trim() && !canSendReply)" @pointerdown.prevent="keepTextMode" @click="submitAndReply">回复</button>
    </template>
    <button v-else-if="online" class="voice-button" type="button" :disabled="disabled" aria-label="发送语音" @click="$emit('open-voice-panel')">
      <Mic :size="22" />
    </button>
    <button v-else class="send-button" type="button" :disabled="disabled || !text.trim()" aria-label="发送" @click="pressSendButton">
    </button>
  </form>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Camera, Image as ImageIcon, Mic, Plus, Smile, X } from 'lucide-vue-next';
import type { ChatMessageQuote, Sticker } from '@/types/domain';
import { getStickerDisplayImageUrl } from '@/utils/stickers';

const props = defineProps<{
  canSendReply?: boolean;
  disabled?: boolean;
  inputDisabled?: boolean;
  modelValue?: string;
  online?: boolean;
  placeholder?: string;
  quote?: ChatMessageQuote | null;
  stickerSuggestions?: Sticker[];
}>();

const emit = defineEmits<{
  'cancel-quote': [];
  'capture-photo': [file: File];
  blur: [];
  focus: [];
  'prepare-focus': [];
  'open-image-panel': [];
  'open-menu': [];
  'open-stickers': [];
  'open-voice-panel': [];
  'draft-text': [content: string];
  'update:modelValue': [content: string];
  reply: [content: string];
  send: [content: string];
  'send-sticker': [sticker: Sticker];
}>();

const text = ref(props.modelValue ?? '');
const inputFocused = ref(false);
const inputRef = ref<HTMLTextAreaElement | null>(null);
const cameraInputRef = ref<HTMLInputElement | null>(null);
let blurTimer: number | undefined;
let draftTimer: number | undefined;
let resizeFrameId = 0;
let pendingDraftText: string | undefined;
const draftDebounceMs = 220;
const effectiveInputDisabled = computed(() => props.inputDisabled ?? props.disabled ?? false);
const textMode = computed(() => Boolean(props.online && inputFocused.value));
const visibleStickerSuggestions = computed(() => text.value.trim() ? props.stickerSuggestions?.slice(0, 6) ?? [] : []);
const quoteContent = computed(() => {
  if (props.quote?.sticker) return `[Sticker] ${props.quote.sticker.description}`;
  if (props.quote?.image) return `[图片] ${props.quote.image.description}`;
  if (props.quote?.voice) return `[语音] ${props.quote.voice.transcript}`;
  if (props.quote?.location) return `[定位] ${props.quote.location.name}`;
  if (props.quote?.transfer) return `${props.quote.transfer.responseToMessageId ? '[转账回执]' : '[转账]'} ¥${props.quote.transfer.amount}`;
  if (props.quote?.commerce) return `[${props.quote.commerce.kind === 'takeout' ? '外卖' : props.quote.commerce.kind === 'gift' ? '礼物' : '购物'}] ${props.quote.commerce.storeName}`;
  return props.quote?.content ?? '';
});

function clearBlurTimer() {
  if (blurTimer === undefined) return;
  window.clearTimeout(blurTimer);
  blurTimer = undefined;
}

function clearDraftTimer() {
  if (draftTimer === undefined) return;
  window.clearTimeout(draftTimer);
  draftTimer = undefined;
}

function flushDraftText() {
  if (pendingDraftText === undefined) return;
  clearDraftTimer();
  const value = pendingDraftText;
  pendingDraftText = undefined;
  emit('draft-text', value);
}

function queueDraftText(value: string) {
  pendingDraftText = value;
  clearDraftTimer();
  draftTimer = window.setTimeout(flushDraftText, draftDebounceMs);
}

function keepTextMode() {
  clearBlurTimer();
}

function focusInput() {
  if (effectiveInputDisabled.value) return;
  clearBlurTimer();
  inputFocused.value = true;
  const input = inputRef.value;
  if (!input) return;
  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }
  const cursorPosition = input.value.length;
  try {
    input.setSelectionRange(cursorPosition, cursorPosition);
  } catch {}
  queueInputResize();
}

function resizeInput() {
  const input = inputRef.value;
  if (!input) return;
  input.style.height = '0px';
  input.style.height = `${Math.min(input.scrollHeight, 92)}px`;
  input.scrollTop = input.scrollHeight;
}

function queueInputResize() {
  if (resizeFrameId) return;
  resizeFrameId = window.requestAnimationFrame(() => {
    resizeFrameId = 0;
    resizeInput();
  });
}

function prepareInputFocus() {
  emit('prepare-focus');
}

function handleFocus() {
  clearBlurTimer();
  inputFocused.value = true;
  emit('focus');
}

function handleBlur() {
  flushDraftText();
  emit('blur');
  clearBlurTimer();
  blurTimer = window.setTimeout(() => {
    inputFocused.value = false;
    blurTimer = undefined;
  }, 120);
}

function submit() {
  if (props.disabled) return;
  const content = text.value.trim();
  if (!content) return;
  emit('send', content);
  text.value = '';
  queueDraftText('');
  flushDraftText();
}

function handleEnterKey(event: KeyboardEvent) {
  if (event.isComposing || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  submit();
}

function submitAndReply() {
  if (props.disabled) return;
  const content = text.value.trim();
  if (content) {
    text.value = '';
    queueDraftText('');
  }
  flushDraftText();
  emit('reply', content);
}

function pickStickerSuggestion(sticker: Sticker) {
  if (props.disabled) return;
  emit('send-sticker', sticker);
}

function pressSendButton() {
  if (props.online) {
    submitAndReply();
    return;
  }
  submit();
}

function openCameraInput() {
  cameraInputRef.value?.click();
}

function openStickers() {
  clearBlurTimer();
  inputRef.value?.blur();
  window.requestAnimationFrame(() => emit('open-stickers'));
}

function handleCameraFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file?.type.startsWith('image/')) emit('capture-photo', file);
}

watch(
  () => props.modelValue,
  (value) => {
    const nextText = value ?? '';
    if (nextText === text.value) return;
    text.value = nextText;
  }
);

watch(text, (value) => {
  emit('update:modelValue', value);
  queueDraftText(value);
  queueInputResize();
}, { immediate: true });

onBeforeUnmount(() => {
  flushDraftText();
  clearBlurTimer();
  if (resizeFrameId) window.cancelAnimationFrame(resizeFrameId);
});

defineExpose({ focusInput });
</script>

<style scoped>
.composer {
  position: relative;
  z-index: 12;
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 32px 32px minmax(0, 1fr) 30px;
  align-items: end;
  gap: 3px;
  min-height: calc(46px + var(--safe-bottom));
  padding: 4px calc(8px + var(--safe-right)) calc(4px + var(--safe-bottom)) calc(8px + var(--safe-left));
  background: rgba(255, 255, 255, 0.98);
  transform: translate3d(0, calc(0px - var(--keyboard-inset)), 0);
  will-change: transform;
}

.visually-hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.icon-button:disabled {
  opacity: 0.45;
  cursor: default;
}

.composer-quote {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 7px 8px;
  border-radius: 9px;
  background: #f2f3f4;
  color: #4d535a;
}

.composer-quote div {
  display: grid;
  flex: 1 1 auto;
  gap: 2px;
  min-width: 0;
}

.composer-quote strong,
.composer-quote span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-quote strong {
  font-size: 11px;
  line-height: 1.15;
}

.composer-quote span {
  font-size: 12px;
  line-height: 1.2;
}

.sticker-suggestions {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0 1px 2px;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
}

.suggestion-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  max-width: 124px;
  min-height: 30px;
  padding: 4px 8px 4px 5px;
  border-radius: 999px;
  background: rgba(240, 241, 242, 0.96);
  color: #2d333a;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
}

.suggestion-chip img {
  display: block;
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  border-radius: 8px;
  object-fit: contain;
}

.suggestion-chip span {
  min-width: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 8px;
  line-height: 1.15;
  white-space: normal;
  overflow-wrap: anywhere;
}

.suggestion-chip:disabled {
  opacity: 0.45;
  cursor: default;
}

.quote-cancel {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  margin-left: auto;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #626971;
}

.quote-cancel:active {
  background: rgba(0, 0, 0, 0.06);
}

.composer-input {
  display: flex;
  align-items: center;
  align-self: end;
  gap: 5px;
  min-width: 0;
  height: auto;
  min-height: 34px;
  max-height: 104px;
  padding: 5px 9px;
  border-radius: 17px;
  background: #f0f1f2;
  color: #777b80;
  overflow: hidden;
}

.composer-input textarea {
  display: block;
  flex: 1 1 auto;
  min-height: 22px;
  max-height: 92px;
  padding: 0;
  resize: none;
  overflow-y: auto;
  color: #2d333a;
  font: inherit;
  line-height: 1.35;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  scrollbar-width: none;
}

.composer-input textarea::-webkit-scrollbar {
  display: none;
}

.composer-input svg {
  width: 19px;
  height: 19px;
}

.sticker-button {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #777b80;
}

.sticker-button:active {
  background: rgba(0, 0, 0, 0.06);
}

.sticker-button:disabled {
  opacity: 0.45;
  cursor: default;
}

.send-button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 14px;
  background: var(--link-green);
  color: #ffffff;
}

.voice-button {
  display: grid;
  place-items: center;
  width: var(--top-icon-button-width);
  height: var(--top-icon-button-height);
  border-radius: 8px;
  background: transparent;
  color: #141414;
}

.voice-button svg {
  width: var(--top-icon-size);
  height: var(--top-icon-size);
}

.send-button:disabled {
  background: #d6d8db;
}

.voice-button:disabled {
  opacity: 0.45;
  cursor: default;
}

.composer--online {
  grid-template-columns: 32px 32px 32px minmax(0, 1fr) 30px;
}

.composer--online .composer-input {
  font-size: 14px;
}

.composer--online .sticker-button svg {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
}

.composer--text-mode {
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 6px;
}

.composer--text-mode .composer-input {
  min-height: 34px;
  border-radius: 16px;
  font-size: 14px;
}

.text-action {
  min-width: 44px;
  min-height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  color: #2d333a;
  font-size: 13px;
  font-weight: 850;
  line-height: 1.2;
  white-space: nowrap;
}

.text-action--send {
  background: #eff1f3;
}

.text-action--reply {
  background: #eff1f3;
  color: #2d333a;
}

.text-action:disabled {
  opacity: 0.45;
  cursor: default;
}
</style>