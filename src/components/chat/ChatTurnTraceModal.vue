<template>
  <Teleport to="body">
    <div v-if="modelValue" class="trace-veil" tabindex="-1" @click.self="close" @keydown.esc="close">
      <div class="trace-stage" @click.self="close">
        <section class="trace-dialog" role="dialog" aria-modal="true" aria-label="本轮 API 记录">
          <div
            class="trace-card"
            :class="{ 'trace-card--back': isFlipped }"
            tabindex="0"
            :aria-label="isFlipped ? '工具回执，点击卡片翻回思绪页' : '思绪记录，点击卡片翻到工具回执页'"
            @click="toggleCard"
            @keydown.enter.prevent="toggleCard"
            @keydown.space.prevent="toggleCard"
          >
            <template v-if="hasCustomThoughtChain">
              <section class="trace-custom-card trace-custom-card--front" :aria-hidden="isFlipped" :data-thought-chain-scope="thoughtChainScopeId" v-html="customThoughtChainHtml"></section>
              <section class="trace-custom-card trace-custom-card--back" :aria-hidden="!isFlipped" :data-thought-chain-scope="thoughtChainScopeId" v-html="customThoughtChainHtml"></section>
            </template>

            <template v-else>
            <article class="trace-page trace-page--mind" :aria-hidden="isFlipped">
              <section class="trace-folded-note">
                <header class="trace-note-head">
                  <div>
                    <span>MEMO / 01</span>
                    <small>{{ generatedLabel }}</small>
                  </div>
                </header>

                <div class="trace-note-title">
                  <i></i>
                  <span>{{ reasoningFormatLabel }}</span>
                  <h2>未说出口的<br />这一页</h2>
                </div>

                <div class="trace-note-body">
                  <pre v-if="traceMindText">{{ traceMindText }}</pre>
                  <div v-else class="trace-no-thought">
                    <Sparkles :size="22" stroke-width="1.55" />
                    <strong>{{ trace ? '这一次没有留下思维内容' : '这条历史消息没有保存记录' }}</strong>
                    <p>{{ trace ? '模型只返回了最终回复，因此这里保持空白。' : '之后生成的回复会在这里留下可查看的轨迹。' }}</p>
                  </div>
                </div>

                <footer class="trace-note-meta">
                  <span>{{ trace?.model || 'MODEL UNKNOWN' }}</span>
                  <span>{{ tokenLabel || 'TOKEN —' }}</span>
                </footer>
              </section>

              <footer class="trace-tap-guide" aria-hidden="true">
                <span></span>
                点击卡片任意位置，翻到工具回执
                <span></span>
              </footer>
            </article>

            <article class="trace-page trace-page--tools" :aria-hidden="!isFlipped">
              <div class="trace-machine-rail" aria-hidden="true">
                <span>LINK</span>
                <i></i>
                <span>TRACE</span>
                <i></i>
                <span>02</span>
              </div>

              <div class="trace-machine-body">
                <header class="trace-machine-head">
                  <span class="trace-machine-mark"><Layers3 :size="17" /></span>
                  <div>
                    <small>RUNTIME RECEIPT</small>
                    <strong>MCP 路径记录</strong>
                  </div>
                </header>

                <section class="trace-machine-intro">
                  <p>本轮模型与已启用能力之间的实际交互。</p>
                  <div class="trace-machine-metrics">
                    <span><small>CALLS</small><strong>{{ toolCalls.length }}</strong></span>
                    <span><small>OUTPUT</small><strong>{{ outputTokenLabel }}</strong></span>
                    <span><small>STATE</small><strong>{{ statusLabel }}</strong></span>
                  </div>
                </section>

                <main v-if="toolCalls.length" class="trace-tool-route" aria-label="MCP 工具调用列表">
                  <div v-for="(call, index) in toolCalls" :key="`${call.serverId}-${call.toolName}-${index}`" class="trace-route-stop" :class="{ 'trace-route-stop--open': activeToolIndex === index }">
                    <button type="button" :tabindex="isFlipped ? 0 : -1" @click.stop="toggleTool(index)">
                      <span class="trace-route-dot" :class="call.status"></span>
                      <span class="trace-route-copy">
                        <small>{{ String(index + 1).padStart(2, '0') }} · {{ call.serverName }}</small>
                        <strong>{{ call.toolName }}</strong>
                      </span>
                      <span class="trace-route-state" :class="call.status">
                        <Check v-if="call.status === 'success'" :size="14" stroke-width="2.4" />
                        <CircleAlert v-else :size="14" stroke-width="2.2" />
                        {{ call.status === 'success' ? 'OK' : 'ERR' }}
                      </span>
                    </button>

                    <section v-if="activeToolIndex === index" class="trace-route-detail" @click.stop>
                      <div>
                        <small>INPUT</small>
                        <pre>{{ formatArguments(call.arguments) }}</pre>
                      </div>
                      <div>
                        <small>RETURN</small>
                        <pre>{{ call.result || '工具没有返回内容。' }}</pre>
                      </div>
                    </section>
                  </div>
                </main>

                <section v-else class="trace-no-tools">
                  <LockKeyhole :size="25" stroke-width="1.45" />
                  <strong>无外部工具调用</strong>
                  <p>本轮回复没有请求任何 MCP 服务或设备能力。</p>
                </section>

                <footer class="trace-machine-footer" aria-hidden="true">
                  <span>点击非操作区域可翻回思绪页</span>
                  <i></i>
                  <span>{{ requestLabel }}</span>
                </footer>
              </div>
            </article>
            </template>
          </div>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Check, CircleAlert, Layers3, LockKeyhole, Sparkles } from 'lucide-vue-next';
import type { ChatApiTrace } from '@/types/domain';
import { renderThoughtChainThemeHtml, scopeThoughtChainCss } from '@/utils/thoughtChainThemes';

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
const activeToolIndex = ref<number | null>(null);
let lastFlipAt = 0;
let customThoughtChainStyleElement: HTMLStyleElement | null = null;

const toolCalls = computed(() => props.trace?.mcpToolCalls ?? []);
const traceMindText = computed(() => props.trace?.visibleReasoning || props.trace?.reasoning || '');
const thoughtChainTheme = computed(() => props.trace?.thoughtChainTheme ?? null);
const hasCustomThoughtChain = computed(() => Boolean(thoughtChainTheme.value && (thoughtChainTheme.value.template || thoughtChainTheme.value.css)));
const thoughtChainScopeId = computed(() => `trace-thought-${props.trace?.generatedAt ?? 'unknown'}-${thoughtChainTheme.value?.id ?? 'default'}`.replace(/[^a-zA-Z0-9_-]/g, ''));
const customThoughtChainHtml = computed(() => {
  const theme = thoughtChainTheme.value;
  if (!theme) return '';
  return renderThoughtChainThemeHtml(traceMindText.value, theme, {
    model: props.trace?.model || 'MODEL UNKNOWN',
    tokens: tokenLabel.value || 'TOKEN —',
    status: statusLabel.value,
    generatedAt: generatedLabel.value,
    toolCalls: toolCalls.value
  });
});
const generatedLabel = computed(() => {
  if (!props.trace?.generatedAt) return 'ARCHIVE / UNKNOWN DATE';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(props.trace.generatedAt).replace(/\//g, '.');
});
const tokenLabel = computed(() => {
  const usage = props.trace?.usage;
  const total = usage?.totalTokens ?? ((usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0));
  return total > 0 ? `TOKENS ${total.toLocaleString('zh-CN')}` : '';
});
const outputTokenLabel = computed(() => {
  const output = props.trace?.usage?.outputTokens;
  return output && output > 0 ? output.toLocaleString('zh-CN') : '—';
});
const statusLabel = computed(() => (props.trace?.finishReason || props.trace?.status || 'saved').toUpperCase());
const requestLabel = computed(() => props.trace?.requestId ? `ID ${props.trace.requestId.slice(-10)}` : 'LOCAL ARCHIVE');
const reasoningFormatLabel = computed(() => {
  if (thoughtChainTheme.value) return `VISIBLE / ${thoughtChainTheme.value.name}`;
  if (props.trace?.reasoningFormat === 'gemini') return 'GEMINI / THOUGHTS';
  if (props.trace?.reasoningFormat === 'claude') return 'CLAUDE / THINKING';
  if (props.trace?.reasoningFormat === 'openai-compatible') return 'MODEL / REASONING';
  return 'PRIVATE / REASONING';
});

watch(() => props.modelValue, (isOpen) => {
  if (!isOpen) return;
  isFlipped.value = false;
  activeToolIndex.value = null;
});

watch([() => props.modelValue, hasCustomThoughtChain, thoughtChainScopeId, thoughtChainTheme], () => {
  updateThoughtChainStyle();
}, { immediate: true });

onBeforeUnmount(() => {
  customThoughtChainStyleElement?.remove();
  customThoughtChainStyleElement = null;
});

function updateThoughtChainStyle() {
  customThoughtChainStyleElement?.remove();
  customThoughtChainStyleElement = null;
  const theme = thoughtChainTheme.value;
  if (!props.modelValue || !hasCustomThoughtChain.value || !theme?.css) return;
  const css = scopeThoughtChainCss(theme.css, thoughtChainScopeId.value);
  if (!css) return;
  customThoughtChainStyleElement = document.createElement('style');
  customThoughtChainStyleElement.setAttribute('data-thought-chain-trace-style', thoughtChainScopeId.value);
  customThoughtChainStyleElement.textContent = css;
  document.head.appendChild(customThoughtChainStyleElement);
}

function close() {
  emit('update:modelValue', false);
}

function toggleCard() {
  const now = Date.now();
  if (now - lastFlipAt < 360) return;
  lastFlipAt = now;
  isFlipped.value = !isFlipped.value;
}

function toggleTool(index: number) {
  activeToolIndex.value = activeToolIndex.value === index ? null : index;
}

function formatArguments(value: Record<string, unknown>) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
}
</script>

<style scoped>
.trace-veil {
  position: fixed;
  inset: 0;
  z-index: 90;
  min-height: var(--app-height);
  overflow: hidden;
  background: transparent;
}

.trace-veil::before,
.trace-veil::after {
  content: none;
}

.trace-stage {
  position: relative;
  z-index: 1;
  display: grid;
  min-height: var(--app-height);
  place-items: center;
  padding: max(22px, var(--safe-top)) calc(22px + var(--safe-right)) max(22px, calc(22px + var(--safe-bottom))) calc(22px + var(--safe-left));
}

.trace-dialog {
  position: relative;
  width: min(100%, 360px);
  height: min(520px, calc(var(--app-height) - var(--safe-top) - var(--safe-bottom) - 104px));
  perspective: 1700px;
}

.trace-card {
  position: relative;
  width: 100%;
  height: 100%;
  cursor: pointer;
  outline: none;
  -webkit-transform: rotateY(0deg);
  transform: rotateY(0deg);
  -webkit-transform-style: preserve-3d;
  transform-style: preserve-3d;
  -webkit-transition: -webkit-transform 780ms cubic-bezier(0.2, 0.68, 0.16, 1);
  transition: transform 780ms cubic-bezier(0.2, 0.68, 0.16, 1);
}

.trace-card--back {
  -webkit-transform: rotateY(180deg);
  transform: rotateY(180deg);
}

.trace-card:focus-visible .trace-page--mind,
.trace-card:focus-visible .trace-page--tools {
  outline: 3px solid rgba(255, 255, 255, 0.88);
  outline-offset: 4px;
}

.trace-page {
  position: absolute;
  inset: 0;
  overflow: hidden auto;
  color: #1f2422;
  scrollbar-color: rgba(100, 93, 83, 0.32) transparent;
  scrollbar-width: thin;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  -webkit-transform-style: preserve-3d;
  transform-style: preserve-3d;
}

.trace-page--mind {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  border: 5px solid #f9f6ef;
  border-radius: 18px;
  background: #ede8dd;
  box-shadow: 0 22px 50px rgba(7, 11, 12, 0.36);
  -webkit-transform: rotateY(0deg) translateZ(1px);
  transform: rotateY(0deg) translateZ(1px);
}

.trace-custom-card {
  position: absolute;
  inset: 0;
  overflow: hidden auto;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  -webkit-transform: rotateY(0deg) translateZ(1px);
  transform: rotateY(0deg) translateZ(1px);
  -webkit-transform-style: preserve-3d;
  transform-style: preserve-3d;
}

.trace-custom-card--back {
  -webkit-transform: rotateY(180deg) translateZ(1px);
  transform: rotateY(180deg) translateZ(1px);
}

.trace-folded-note {
  position: relative;
  z-index: 2;
  display: grid;
  min-height: 0;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  margin: 13px 12px 0;
  padding: 21px 18px 13px;
  border: 1px solid rgba(75, 66, 55, 0.1);
  border-radius: 13px 13px 3px 3px;
  background:
    linear-gradient(90deg, transparent 0 18px, rgba(164, 136, 120, 0.12) 18px 19px, transparent 19px),
    repeating-linear-gradient(0deg, transparent 0 28px, rgba(121, 111, 94, 0.09) 28px 29px),
    #fbf8f0;
  box-shadow: 0 9px 17px rgba(59, 50, 38, 0.1);
}

.trace-folded-note::before {
  position: absolute;
  top: 0;
  left: 19px;
  width: 63px;
  height: 3px;
  background: #a6b8a8;
  content: '';
}

.trace-note-head,
.trace-note-meta,
.trace-machine-head,
.trace-machine-metrics,
.trace-machine-footer {
  display: flex;
  align-items: center;
}

.trace-note-head {
  color: #84776a;
}

.trace-note-head div { display: grid; gap: 3px; }

.trace-note-head span,
.trace-note-head small,
.trace-note-title > span,
.trace-machine-head small,
.trace-machine-metrics small,
.trace-route-copy small,
.trace-route-detail small {
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.15em;
}

.trace-note-head small {
  color: #a5988a;
  font-size: 8px;
  letter-spacing: 0.06em;
}

.trace-note-title {
  position: relative;
  display: grid;
  gap: 4px;
  margin-top: 14px;
  color: #2d332f;
}

.trace-note-title i {
  width: 18px;
  height: 1px;
  background: #8aa497;
}

.trace-note-title > span { color: #7f978a; }

.trace-note-title h2 {
  margin: 2px 0 0;
  font-family: Georgia, 'Songti SC', serif;
  font-size: 25px;
  font-weight: 500;
  letter-spacing: -0.065em;
  line-height: 0.98;
}

.trace-note-body {
  min-height: 0;
  margin: 13px 0 9px;
  overflow: auto;
  overscroll-behavior: contain;
}

.trace-note-body pre {
  margin: 0;
  color: #4f514a;
  font-family: var(--app-current-font-family);
  font-size: 12px;
  line-height: 2.35;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

.trace-no-thought {
  display: grid;
  min-height: 100%;
  align-content: center;
  justify-items: start;
  padding: 3px 6px 9px;
  color: #7d8078;
}

.trace-no-thought svg { color: #8eaa9b; }

.trace-no-thought strong {
  margin-top: 10px;
  color: #55584f;
  font-size: 12px;
}

.trace-no-thought p {
  max-width: 245px;
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.75;
}

.trace-note-meta {
  justify-content: space-between;
  gap: 12px;
  padding: 9px 0 0 20px;
  border-top: 1px solid rgba(105, 93, 77, 0.15);
  color: #8e8377;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.trace-note-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trace-tap-guide {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  padding: 4px 18px 7px;
  color: #77756e;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.07em;
}

.trace-tap-guide span {
  width: 15px;
  height: 1px;
  background: #b4b1a8;
}

.trace-page--tools {
  display: grid;
  grid-template-columns: 33px minmax(0, 1fr);
  border: 1px solid rgba(205, 229, 209, 0.32);
  border-radius: 25px 3px 25px 3px;
  background:
    radial-gradient(circle at 92% 6%, rgba(152, 207, 180, 0.2), transparent 26%),
    linear-gradient(142deg, #1e322b 0%, #102019 72%);
  box-shadow: 0 28px 72px rgba(5, 10, 8, 0.5), -9px 9px 0 rgba(188, 219, 196, 0.2);
  color: #e7f1e8;
  -webkit-transform: rotateY(180deg) translateZ(1px);
  transform: rotateY(180deg) translateZ(1px);
}

.trace-machine-rail {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 11px;
  padding: 14px 0;
  border-right: 1px solid rgba(200, 229, 207, 0.17);
  color: #a9c9ad;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.16em;
  writing-mode: vertical-rl;
}

.trace-machine-rail i {
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: #82ba91;
}

.trace-machine-body {
  display: grid;
  min-height: 100%;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  padding: 18px 17px 13px;
}

.trace-machine-head { gap: 10px; }

.trace-machine-mark {
  display: grid;
  width: 35px;
  height: 35px;
  place-items: center;
  border: 1px solid rgba(207, 235, 214, 0.24);
  border-radius: 2px 12px 2px 12px;
  background: rgba(201, 232, 209, 0.09);
  color: #bde0c5;
}

.trace-machine-head > div { display: grid; flex: 1; gap: 3px; }
.trace-machine-head small { color: #8aa993; }
.trace-machine-head strong { font-family: Georgia, 'Songti SC', serif; font-size: 20px; font-weight: 500; letter-spacing: -0.05em; }

.trace-machine-intro { padding: 22px 0 17px; }

.trace-machine-intro > p {
  margin: 0 0 15px;
  color: #b9cdbd;
  font-size: 11px;
  line-height: 1.7;
}

.trace-machine-metrics {
  justify-content: space-between;
  gap: 5px;
  padding: 9px 0;
  border-top: 1px solid rgba(215, 240, 219, 0.18);
  border-bottom: 1px solid rgba(215, 240, 219, 0.18);
}

.trace-machine-metrics span { display: grid; min-width: 0; gap: 3px; }
.trace-machine-metrics small { color: #89a991; font-size: 7px; }
.trace-machine-metrics strong { overflow: hidden; color: #e5f2e7; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }

.trace-tool-route {
  min-height: 0;
  padding: 17px 0 12px;
  overflow: auto;
  overscroll-behavior: contain;
}

.trace-route-stop { position: relative; padding-left: 19px; }

.trace-route-stop:not(:last-child)::before {
  position: absolute;
  top: 35px;
  bottom: -14px;
  left: 5px;
  width: 1px;
  background: repeating-linear-gradient(to bottom, rgba(155, 201, 165, 0.5) 0 4px, transparent 4px 8px);
  content: '';
}

.trace-route-stop > button {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 9px;
  padding: 10px;
  border: 1px solid rgba(208, 235, 212, 0.17);
  border-radius: 2px 15px 2px 15px;
  background: rgba(217, 239, 219, 0.08);
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.trace-route-stop--open > button {
  border-color: rgba(170, 221, 182, 0.46);
  background: rgba(188, 224, 195, 0.15);
}

.trace-route-dot {
  position: absolute;
  top: 21px;
  left: 0;
  width: 11px;
  height: 11px;
  border: 3px solid #20372d;
  border-radius: 50%;
  background: #86cc99;
  box-shadow: 0 0 0 1px rgba(164, 218, 177, 0.45);
}

.trace-route-dot.error { background: #e9a4a3; box-shadow: 0 0 0 1px rgba(245, 182, 181, 0.55); }

.trace-route-copy { display: grid; min-width: 0; flex: 1; gap: 3px; }
.trace-route-copy small { overflow: hidden; color: #91b49a; font-size: 7px; text-overflow: ellipsis; white-space: nowrap; }
.trace-route-copy strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }

.trace-route-state {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #a6ddaf;
  font-size: 9px;
  font-weight: 900;
}

.trace-route-state.error { color: #f0b2ad; }

.trace-route-detail {
  display: grid;
  gap: 8px;
  margin: 8px 0 13px;
  padding: 0 0 0 8px;
}

.trace-route-detail > div {
  padding: 9px 10px;
  border-left: 1px solid rgba(195, 228, 201, 0.32);
  background: rgba(0, 0, 0, 0.13);
}

.trace-route-detail small { color: #91b79b; font-size: 7px; }

.trace-route-detail pre {
  max-height: 145px;
  margin: 5px 0 0;
  overflow: auto;
  color: #d6e5d9;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
  line-height: 1.65;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

.trace-no-tools {
  display: grid;
  min-height: 0;
  align-content: center;
  justify-items: start;
  padding: 22px 4px;
  color: #99b8a1;
}

.trace-no-tools strong { margin-top: 11px; color: #dcecdf; font-size: 13px; }
.trace-no-tools p { max-width: 205px; margin: 6px 0 0; font-size: 11px; line-height: 1.75; }

.trace-machine-footer {
  justify-content: space-between;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid rgba(213, 240, 217, 0.17);
  color: #82a58b;
  font-size: 7px;
  font-weight: 800;
  letter-spacing: 0.09em;
}

.trace-machine-footer i { width: 1px; height: 12px; background: rgba(203, 234, 209, 0.3); }

.trace-route-stop > button:active { transform: scale(0.96); }

@media (max-width: 360px) {
  .trace-stage { padding-right: 20px; padding-left: 20px; }
  .trace-dialog { height: min(500px, calc(var(--app-height) - var(--safe-top) - var(--safe-bottom) - 80px)); }
  .trace-page--mind { border-width: 4px; }
  .trace-folded-note { margin: 10px 9px 0; padding: 19px 14px 11px; }
  .trace-note-title h2 { font-size: 23px; }
  .trace-note-body pre { font-size: 11px; line-height: 2.1; }
  .trace-page--tools { grid-template-columns: 27px minmax(0, 1fr); }
  .trace-machine-body { padding-right: 13px; padding-left: 13px; }
  .trace-machine-footer { font-size: 6px; }
}

@media (prefers-reduced-motion: reduce) {
  .trace-card { transition-duration: 0.01ms; }
}
</style>