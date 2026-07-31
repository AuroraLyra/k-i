<template>
  <AppModal
    :model-value="modelValue"
    title="本轮 API 记录"
    :show-header="false"
    variant="ins"
    fixed-height
    @update:model-value="emit('update:modelValue', $event)"
  >
    <section class="turn-trace-sheet">
      <header class="trace-hero">
        <div class="trace-hero-topline">
          <span>PRIVATE API NOTE</span>
          <button type="button" aria-label="关闭本轮 API 记录" @click="emit('update:modelValue', false)">
            <X :size="17" />
          </button>
        </div>
        <div class="trace-identity">
          <span class="trace-avatar">
            <img v-if="characterAvatar" :src="characterAvatar" :alt="characterName" />
            <span v-else>{{ characterInitial }}</span>
          </span>
          <span class="trace-title">
            <small>{{ generatedTime }}</small>
            <strong>这一轮，TA 在想什么</strong>
            <em>{{ trace?.model || '未记录模型' }}</em>
          </span>
        </div>
        <div v-if="trace" class="trace-meta" aria-label="API 元数据">
          <span v-if="trace.requestId"><small>REQUEST</small><strong>{{ trace.requestId }}</strong></span>
          <span v-if="tokenLabel"><small>TOKENS</small><strong>{{ tokenLabel }}</strong></span>
          <span v-if="trace.finishReason || trace.status"><small>STATUS</small><strong>{{ trace.finishReason || trace.status }}</strong></span>
        </div>
      </header>

      <div class="trace-flip-shell">
        <div class="trace-flip-card" :class="{ 'is-flipped': isFlipped }">
          <section class="trace-section trace-face trace-face-front reasoning-section" :aria-hidden="isFlipped">
            <div class="trace-section-heading">
              <span class="section-icon reasoning-icon"><BrainCircuit :size="18" /></span>
              <span>
                <small>{{ reasoningKicker }}</small>
                <strong>API 思维链</strong>
              </span>
              <span class="trace-heading-actions">
                <em>{{ trace?.reasoning ? 'captured' : 'not returned' }}</em>
                <button type="button" :tabindex="isFlipped ? -1 : 0" aria-label="翻到 MCP 工具调用" @click="isFlipped = true">
                  <RotateCw :size="12" />
                  MCP
                </button>
              </span>
            </div>
            <div class="trace-face-content">
              <pre v-if="trace?.reasoning" class="reasoning-copy">{{ trace.reasoning }}</pre>
              <div v-else class="trace-empty">
                <span>✦</span>
                <strong>{{ trace ? '本轮 API 未返回可展示的思维内容' : '这条历史回复没有 API 记录' }}</strong>
                <p>{{ trace ? '部分模型或中转接口只返回最终答案；这不代表本轮没有内部推理。' : '更新后的新回复会自动保存模型思维与 MCP 调用详情。' }}</p>
              </div>
            </div>
          </section>

          <section class="trace-section trace-face trace-face-back tools-section" :aria-hidden="!isFlipped">
            <div class="trace-section-heading">
              <span class="section-icon tools-icon"><Wrench :size="17" /></span>
              <span>
                <small>MODEL CONTEXT PROTOCOL</small>
                <strong>MCP 工具调用</strong>
              </span>
              <span class="trace-heading-actions">
                <em>{{ trace?.mcpToolCalls.length ?? 0 }} calls</em>
                <button type="button" :tabindex="isFlipped ? 0 : -1" aria-label="翻到 API 思维链" @click="isFlipped = false">
                  <RotateCw :size="12" />
                  API
                </button>
              </span>
            </div>

            <div class="trace-face-content">
              <div v-if="trace?.mcpToolCalls.length" class="tool-call-list">
                <details v-for="(call, index) in trace.mcpToolCalls" :key="`${call.serverId}-${call.toolName}-${index}`" class="tool-call-card" :open="index === 0">
                  <summary :tabindex="isFlipped ? 0 : -1">
                    <span class="tool-call-index">{{ String(index + 1).padStart(2, '0') }}</span>
                    <span class="tool-call-name">
                      <small>{{ call.serverName }}</small>
                      <strong>{{ call.toolName }}</strong>
                    </span>
                    <span class="tool-call-status" :class="call.status">
                      <CheckCircle2 v-if="call.status === 'success'" :size="14" />
                      <CircleAlert v-else :size="14" />
                      {{ call.status === 'success' ? '成功' : '失败' }}
                    </span>
                  </summary>
                  <div class="tool-call-detail">
                    <section>
                      <small>ARGUMENTS · 调用参数</small>
                      <pre>{{ formatArguments(call.arguments) }}</pre>
                    </section>
                    <section>
                      <small>RESULT · 返回详情</small>
                      <pre>{{ call.result || '工具没有返回内容。' }}</pre>
                    </section>
                  </div>
                </details>
              </div>
              <div v-else class="tool-empty">
                <span>NO TOOLS</span>
                <p>这一轮没有调用 MCP 工具。</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <footer class="trace-footnote">
        <LockKeyhole :size="13" />
        <span>仅展示 API 实际返回的内容；MCP 参数中的密钥、Token 与 Cookie 会自动脱敏。</span>
      </footer>
    </section>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { BrainCircuit, CheckCircle2, CircleAlert, LockKeyhole, RotateCw, Wrench, X } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import type { ChatApiTrace } from '@/types/domain';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  trace: ChatApiTrace | null;
  characterName?: string;
  characterAvatar?: string;
}>(), {
  characterName: '角色',
  characterAvatar: ''
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const isFlipped = ref(false);
const characterInitial = computed(() => props.characterName.trim().slice(0, 1) || 'L');
const generatedTime = computed(() => {
  if (!props.trace?.generatedAt) return 'LEGACY MESSAGE';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(props.trace.generatedAt);
});
const tokenLabel = computed(() => {
  const usage = props.trace?.usage;
  if (!usage) return '';
  const total = usage.totalTokens ?? ((usage.inputTokens ?? 0) + (usage.outputTokens ?? 0));
  return total > 0 ? total.toLocaleString('zh-CN') : '';
});
const reasoningKicker = computed(() => {
  if (props.trace?.reasoningFormat === 'gemini') return 'GEMINI THOUGHTS';
  if (props.trace?.reasoningFormat === 'claude') return 'CLAUDE THINKING';
  if (props.trace?.reasoningFormat === 'openai-compatible') return 'REASONING CONTENT';
  return 'MODEL REASONING';
});

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) isFlipped.value = false;
});

function formatArguments(value: Record<string, unknown>) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
}
</script>

<style scoped>
.turn-trace-sheet {
  min-height: 100%;
  color: #3f393d;
}

.trace-hero {
  position: relative;
  overflow: hidden;
  margin: -14px -12px 14px;
  padding: 18px 18px 16px;
  border-bottom: 1px solid rgba(102, 83, 91, 0.08);
  background:
    radial-gradient(circle at 88% 14%, rgba(221, 187, 201, 0.56), transparent 28%),
    radial-gradient(circle at 8% 90%, rgba(199, 216, 207, 0.54), transparent 30%),
    linear-gradient(145deg, #fffaf8 0%, #f7f0f2 55%, #f1f4ef 100%);
}

.trace-hero::after {
  content: "";
  position: absolute;
  right: 25px;
  bottom: 14px;
  width: 42px;
  height: 14px;
  border-radius: 50%;
  background: rgba(146, 115, 128, 0.12);
  filter: blur(8px);
}

.trace-hero-topline,
.trace-identity,
.trace-meta,
.trace-section-heading,
.tool-call-card summary,
.trace-footnote {
  display: flex;
  align-items: center;
}

.trace-hero-topline {
  position: relative;
  z-index: 1;
  justify-content: space-between;
  margin-bottom: 14px;
  color: #9a818b;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.2em;
}

.trace-hero-topline button {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid rgba(105, 84, 92, 0.1);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.66);
  color: #5f555a;
}

.trace-identity {
  position: relative;
  z-index: 1;
  gap: 13px;
}

.trace-avatar {
  display: grid;
  place-items: center;
  flex: 0 0 58px;
  width: 58px;
  height: 58px;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.9);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 10px 25px rgba(92, 68, 78, 0.13);
  color: #8f707c;
  font-family: Georgia, "Songti SC", serif;
  font-size: 24px;
}

.trace-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 18px;
  object-fit: cover;
}

.trace-title {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.trace-title small {
  margin-bottom: 2px;
  color: #a18992;
  font-size: 9px;
  letter-spacing: 0.1em;
}

.trace-title strong {
  color: #42383d;
  font-family: Georgia, "Songti SC", serif;
  font-size: 21px;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.trace-title em {
  overflow: hidden;
  margin-top: 4px;
  color: #756a6f;
  font-size: 10px;
  font-style: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-meta {
  position: relative;
  z-index: 1;
  gap: 7px;
  margin-top: 14px;
  overflow-x: auto;
  scrollbar-width: none;
}

.trace-meta::-webkit-scrollbar {
  display: none;
}

.trace-meta > span {
  display: flex;
  min-width: 82px;
  max-width: 180px;
  flex: 0 0 auto;
  flex-direction: column;
  padding: 7px 9px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
}

.trace-meta small,
.trace-section-heading small,
.tool-call-detail small {
  color: #aa919a;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.trace-meta strong {
  overflow: hidden;
  color: #574b50;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-section {
  padding: 13px;
  border: 1px solid rgba(92, 74, 82, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 10px 30px rgba(78, 63, 70, 0.06);
}

.trace-flip-shell {
  height: clamp(330px, 52dvh, 440px);
  margin-bottom: 12px;
  perspective: 1200px;
}

.trace-flip-card {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.58s cubic-bezier(0.2, 0.72, 0.2, 1);
}

.trace-flip-card.is-flipped {
  transform: rotateY(180deg);
}

.trace-face {
  position: absolute;
  inset: 0;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.trace-face-front {
  background: linear-gradient(155deg, rgba(255, 255, 255, 0.94), rgba(252, 247, 249, 0.9));
}

.trace-face-back {
  transform: rotateY(180deg);
  background: linear-gradient(155deg, rgba(255, 255, 255, 0.94), rgba(246, 250, 247, 0.92));
}

.trace-face-content {
  min-height: 0;
  flex: 1;
  margin-top: 11px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

.trace-section-heading {
  gap: 9px;
}

.trace-section-heading > span:nth-child(2) {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.trace-section-heading strong {
  color: #473d42;
  font-family: Georgia, "Songti SC", serif;
  font-size: 15px;
  font-weight: 600;
}

.trace-section-heading em {
  padding: 4px 7px;
  border-radius: 999px;
  background: #f3eef0;
  color: #9b7f89;
  font-size: 8px;
  font-style: normal;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.trace-heading-actions {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 5px;
}

.trace-heading-actions button {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 7px;
  border: 1px solid rgba(114, 91, 100, 0.1);
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 3px 9px rgba(82, 67, 73, 0.07);
  color: #74656b;
  font-family: inherit;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.trace-heading-actions button:active {
  transform: scale(0.96);
}

.section-icon {
  display: grid;
  place-items: center;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  border-radius: 12px;
}

.reasoning-icon {
  background: #f5e9ed;
  color: #a8798b;
}

.tools-icon {
  background: #e9f0eb;
  color: #6f8d7d;
}

.reasoning-copy,
.tool-call-detail pre {
  margin: 11px 0 0;
  overflow: visible;
  color: #51484c;
  font-family: var(--app-current-font-family);
  font-size: 11px;
  line-height: 1.75;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

.reasoning-copy {
  margin-top: 0;
  padding: 12px;
  border-radius: 15px;
  background: linear-gradient(150deg, #fcf8f7, #f7f3f5);
}

.trace-empty,
.tool-empty {
  margin-top: 0;
  padding: 17px 14px;
  border: 1px dashed rgba(134, 109, 119, 0.2);
  border-radius: 15px;
  background: #fcfaf9;
  text-align: center;
}

.trace-empty > span {
  color: #c197a7;
  font-size: 18px;
}

.trace-empty strong {
  display: block;
  margin-top: 3px;
  font-size: 11px;
}

.trace-empty p,
.tool-empty p {
  margin: 5px 0 0;
  color: #978a8f;
  font-size: 9px;
  line-height: 1.6;
}

.tool-call-list {
  display: grid;
  gap: 8px;
}

.tool-call-card {
  overflow: hidden;
  border: 1px solid rgba(91, 111, 99, 0.11);
  border-radius: 15px;
  background: #fbfcfa;
}

.tool-call-card summary {
  gap: 9px;
  min-height: 48px;
  padding: 8px 10px;
  cursor: pointer;
  list-style: none;
}

.tool-call-card summary::-webkit-details-marker {
  display: none;
}

.tool-call-index {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border-radius: 9px;
  background: #eaf0eb;
  color: #748a7e;
  font-family: Georgia, serif;
  font-size: 10px;
}

.tool-call-name {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.tool-call-name small {
  overflow: hidden;
  color: #9a8e92;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-call-name strong {
  overflow: hidden;
  color: #4d5751;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-call-status {
  display: flex;
  align-items: center;
  gap: 3px;
  color: #758f80;
  font-size: 9px;
}

.tool-call-status.error {
  color: #b8797d;
}

.tool-call-detail {
  display: grid;
  gap: 8px;
  padding: 0 10px 10px;
}

.tool-call-detail section {
  padding: 10px;
  border-radius: 12px;
  background: #f4f6f3;
}

.tool-call-detail pre {
  max-height: 220px;
  margin-top: 6px;
  overflow-y: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
  line-height: 1.65;
}

.tool-empty > span {
  color: #90a397;
  font-family: Georgia, serif;
  font-size: 10px;
  letter-spacing: 0.16em;
}

.trace-footnote {
  gap: 6px;
  padding: 2px 4px 8px;
  color: #9a8c91;
  font-size: 8px;
  line-height: 1.5;
}

@media (max-width: 360px) {
  .trace-hero {
    padding-right: 14px;
    padding-left: 14px;
  }

  .trace-title strong {
    font-size: 18px;
  }

  .trace-avatar {
    flex-basis: 52px;
    width: 52px;
    height: 52px;
  }

  .trace-heading-actions em {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .trace-flip-card {
    transition-duration: 0.01ms;
  }
}
</style>