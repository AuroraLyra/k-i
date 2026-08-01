<template>
  <Teleport to="body">
    <div class="disclaimer-backdrop">
      <section class="disclaimer-panel" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
        <header class="disclaimer-header">
          <div class="disclaimer-title-group">
            <div class="disclaimer-badge-row">
              <span class="header-badge">18+ 成年限定</span>
              <span class="header-badge header-badge-soft">首次访问需确认</span>
            </div>
            <p class="disclaimer-kicker">Entry Compliance Notice</p>
            <h1 id="disclaimer-title">LINK小手机使用声明</h1>
          </div>

          <div class="disclaimer-progress-card" aria-label="阅读进度">
            <span>STEP</span>
            <strong>{{ stepNumber }}</strong>
            <small>/ {{ totalSteps }}</small>
          </div>
        </header>

        <div class="disclaimer-track-shell">
          <div class="disclaimer-track" :style="trackStyle">
            <article v-for="step in steps" :key="step.title" class="disclaimer-step">
              <div class="step-head">
                <h2>{{ step.title }}</h2>
                <p class="step-summary">{{ step.summary }}</p>
              </div>

              <div class="step-markers" aria-label="重点提示">
                <span v-for="marker in step.markers" :key="marker" class="step-marker">{{ marker }}</span>
              </div>

              <div class="clause-list">
                <section v-for="clause in step.clauses" :key="clause.label" class="clause-card" :class="`tone-${clause.tone}`">
                  <p class="clause-label">{{ clause.label }}</p>
                  <p class="clause-body">{{ clause.body }}</p>
                </section>
              </div>

              <div v-if="step.notice" class="step-notice" :class="`tone-${step.noticeTone ?? 'neutral'}`">
                <span class="notice-title">重点说明</span>
                <p>{{ step.notice }}</p>
              </div>
            </article>

            <article class="disclaimer-step disclaimer-step-confirm">
              <div class="step-head">
                <h2>完成入站声明后进入</h2>
                <p class="step-summary">
                  系统仅在首次打开网站时显示本流程。完成确认后，将记录你已阅读、理解并同意全部条款。
                </p>
              </div>

              <div class="confirm-checklist">
                <section v-for="item in confirmChecklist" :key="item.title" class="confirm-note-card">
                  <p class="confirm-note-title">{{ item.title }}</p>
                  <p class="confirm-note-body">{{ item.body }}</p>
                </section>
              </div>

              <div class="confirm-quote">
                <p class="quote-label">请逐字输入以下完整声明</p>
                <p class="quote-text">{{ confirmationText }}</p>
              </div>

              <label class="confirm-field">
                <span>确认输入</span>
                <textarea
                  v-model="typedConfirmation"
                  rows="6"
                  placeholder="请逐字输入完整声明，不可缺字或改字"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                />
              </label>

              <p v-if="typedConfirmation && !isConfirmationMatched" class="confirm-hint confirm-hint-error">
                输入内容需与上方声明完全一致后方可进入。
              </p>
              <p v-else-if="typedConfirmation && isConfirmationMatched" class="confirm-hint confirm-hint-success">
                声明内容校验通过，可在阅读计时结束后确认进入。
              </p>
            </article>

          </div>
        </div>

        <div class="disclaimer-dots" aria-hidden="true">
          <span
            v-for="(step, index) in totalSteps"
            :key="step"
            :class="['dot', { active: index === activeStep }]"
          />
        </div>

        <footer class="disclaimer-footer">
          <div class="countdown-copy" :class="{ ready: !showCountdown }">
            <span v-if="showCountdown">本页阅读计时剩余 {{ remainingSeconds }} 秒，计时结束后方可继续</span>
            <span v-else>{{ activeStep < steps.length ? '本页阅读已完成，可继续下一项条款' : '阅读已完成，输入声明无误后即可进入网站' }}</span>
          </div>

          <div class="footer-actions">
            <button class="secondary-action disclaimer-button" type="button" :disabled="activeStep === 0" @click="goPrev">
              返回上一项
            </button>
            <button
              class="primary-action disclaimer-button disclaimer-button-primary"
              type="button"
              :disabled="isNextDisabled"
              @click="handleNext"
            >
              {{ footerPrimaryLabel }}
            </button>
          </div>
        </footer>
      </section>

    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';

type StepClauseTone = 'neutral' | 'warn' | 'danger';

interface StepClause {
  label: string;
  body: string;
  tone?: StepClauseTone;
}

interface DisclaimerStep {
  title: string;
  summary: string;
  markers: string[];
  clauses: StepClause[];
  notice?: string;
  noticeTone?: StepClauseTone;
}

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  complete: [];
}>();

const confirmationText = '本人已满十八周岁，已完整阅读并理解以上全部使用条款，知悉权责，同意所有条款，确认使用。';

const steps: DisclaimerStep[] = [
  {
    title: '年龄使用限制条款',
    summary: '本站仅向年满 18 周岁且具备完全民事行为能力的成年人开放，未成年人不得访问、浏览或使用本站任何功能。',
    markers: ['仅限成年人使用', '需具备完全民事行为能力', '监护责任不由项目承担'],
    clauses: [
      {
        label: '适用对象',
        body: '只有已满法定十八周岁、能够独立承担民事法律后果的用户，方可继续使用本站服务。',
        tone: 'warn'
      },
      {
        label: '未成年人禁止进入',
        body: '未成年人严禁在未取得监护人许可的情况下访问、浏览、使用本站全部功能板块。'
      },
      {
        label: '责任承担',
        body: '若未成年人擅自进入本站，并因虚拟剧情内容引发心理、家庭、人身或法律争议，由未成年人本人及其法定监护人自行承担全部后果与责任。',
        tone: 'danger'
      },
      {
        label: '确认效力',
        body: '用户继续完成本流程并输入最终声明，即视为本人已如实确认年龄达标、心智完整，且能够独立承担使用本站产生的一切法律后果。'
      }
    ],
    notice: '若年龄条件不符合，请立即停止访问本站并关闭页面。',
    noticeTone: 'danger'
  },
  {
    title: '倒卖禁止与侵权追责说明',
    summary: '项目源码、原创排版、站内文案、提示词模板与交互逻辑等均受法律保护，仅可在个人自学、技术研究、非商用参考范围内使用。',
    markers: ['禁止倒卖与改包售卖', '禁止冒充原版传播', '侵权将保留追责权利'],
    clauses: [
      {
        label: '权利归属',
        body: '本项目完整前端源代码、页面原创结构、文案内容、提示词模板、配置文件及整体汇编内容，均由项目开发者独立构思并创作完成，自创作完成之日起依法享有完整著作权。'
      },
      {
        label: '明确禁止',
        body: '严禁复制、二次封装、改包售卖、付费代搭建、私发资源、倒卖角色配置、篡改项目名称或声明后冒充原版对外传播及接单商用。',
        tone: 'danger'
      },
      {
        label: '侵权后果',
        body: '对于未经许可的倒卖、商用篡改、侵权传播及借项目从事诈骗、灰产引流等行为，项目开发者有权保留完整证据并向平台投诉、要求下架、封禁、停止侵害以及主张民事赔偿。',
        tone: 'danger'
      }
    ],
    notice: '若行为触及治安管理或刑事法律风险，相关罚款、拘留、立案与审判后果均由实施人独立承担。',
    noticeTone: 'danger'
  },
  {
    title: '用户输入内容权责划分',
    summary: '角色设定、对话文本、剧情指令均由用户主动输入，AI 回复由外部第三方服务生成；用户需对输入与传播的全部内容独立负责。',
    markers: ['用户自行编辑内容', '外部 AI 生成回复', '违规传播责任自负'],
    clauses: [
      {
        label: '输入来源',
        body: '站内角色资料、聊天内容与剧情指令均由用户本人自主创建与输入，后续对话由外部第三方 AI 服务器运算生成。'
      },
      {
        label: '平台能力边界',
        body: '本站不储存用户聊天记录，也未自建或部署 AI 大模型，无法对模型输出进行预先审核、实时过滤或绝对控制。'
      },
      {
        label: '用户责任',
        body: '用户需对自己输入、创建、发布及向外传播的全部内容独立承担民事、行政乃至刑事责任。',
        tone: 'warn'
      },
      {
        label: '禁止内容',
        body: '严禁编辑、发送涉政不当言论、色情低俗、暴力血腥、造谣诽谤、侵犯他人肖像或文案权益、违禁违法等信息；由此产生的平台处罚或法律后果均由使用人自行承担。',
        tone: 'danger'
      }
    ],
    noticeTone: 'warn'
  },
  {
    title: 'AI 内容风险警示',
    summary: '本站展示的 AI 内容仅用于虚拟娱乐创作，具有随机性与虚构性，不具备现实真实性，也不构成任何专业意见。',
    markers: ['仅限虚拟娱乐', '不得替代专业判断', '继续使用视为同意规则'],
    clauses: [
      {
        label: '内容属性',
        body: 'AI 生成的剧情、文字与对话内容仅属于网络虚拟娱乐创作，不具备事实证明、现实判断或专业参考效力。'
      },
      {
        label: '风险自担',
        body: '任何用户若仅凭 AI 虚构内容作出法律、医疗、投资、财产或其他重大现实决策，由此产生的损失、纠纷和后果均由当事人自行承担。',
        tone: 'danger'
      },
      {
        label: '规则效力',
        body: '完成本流程并继续使用网站，即视为你已经完整阅读、充分理解并自愿接受本声明的全部条款及其后续在法律允许范围内的合理修订。'
      },
      {
        label: '冲突处理',
        body: '若本声明个别条款与现行有效法律法规存在冲突，以国家现行法律法规的强制性规定为优先执行标准。'
      }
    ],
    notice: '如你不能接受 AI 内容的随机性、虚构性与风险自担原则，请勿继续进入本站。',
    noticeTone: 'danger'
  },
];

const confirmChecklist = [
  {
    title: '确认年龄条件',
    body: '你需确认本人已满十八周岁，并具备独立承担民事法律后果的资格。'
  },
  {
    title: '确认阅读完成',
    body: '你需确认已完整阅读并理解前述全部条款，而非仅浏览标题或节选内容。'
  },
  {
    title: '确认责任归属',
    body: '你需确认理解用户输入内容、外部 AI 生成结果以及后续传播行为的责任边界。'
  }
] as const;

const totalSteps = steps.length + 1;
const readDelaySeconds = 8;
const activeStep = ref(0);
const typedConfirmation = ref('');
const remainingSeconds = ref(readDelaySeconds);

let countdownTimer: number | null = null;

const trackStyle = computed(() => ({
  transform: `translateX(-${activeStep.value * 100}%)`
}));
const stepNumber = computed(() => String(activeStep.value + 1).padStart(2, '0'));
const isConfirmationMatched = computed(() => typedConfirmation.value.trim() === confirmationText);
const showCountdown = computed(() => remainingSeconds.value > 0);
const isConfirmStep = computed(() => activeStep.value === steps.length);
const footerPrimaryLabel = computed(() => {
  if (isConfirmStep.value) return '确认进入网站';
  return nextButtonLabel.value;
});
const isNextDisabled = computed(() => {
  if (remainingSeconds.value > 0) return true;
  if (isConfirmStep.value) return !isConfirmationMatched.value;
  return false;
});
const nextButtonLabel = computed(() => {
  if (remainingSeconds.value > 0) return `继续阅读 (${remainingSeconds.value}s)`;
  return activeStep.value === steps.length - 1 ? '进入最终确认' : '继续下一项';
});

function stopCountdown() {
  if (countdownTimer !== null) {
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function startCountdown() {
  stopCountdown();
  remainingSeconds.value = readDelaySeconds;
  countdownTimer = window.setInterval(() => {
    if (remainingSeconds.value <= 1) {
      remainingSeconds.value = 0;
      stopCountdown();
      return;
    }
    remainingSeconds.value -= 1;
  }, 1000);
}

function goPrev() {
  if (activeStep.value === 0) return;
  activeStep.value -= 1;
}

function handleNext() {
  if (isNextDisabled.value) return;

  if (isConfirmStep.value) {
    stopCountdown();
    emit('complete');
    return;
  }

  activeStep.value += 1;
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) {
      stopCountdown();
      return;
    }

    activeStep.value = 0;
    typedConfirmation.value = '';
    startCountdown();
  },
  { immediate: true }
);

watch(activeStep, () => {
  if (!props.modelValue) return;
  startCountdown();
});

onBeforeUnmount(() => {
  stopCountdown();
});
</script>

<style scoped>
.disclaimer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  min-height: var(--app-height);
  padding: calc(14px + var(--safe-top)) calc(14px + var(--safe-right)) calc(14px + var(--safe-bottom)) calc(14px + var(--safe-left));
  background:
    radial-gradient(circle at top, rgba(8, 182, 104, 0.1), transparent 34%),
    radial-gradient(circle at bottom left, rgba(0, 0, 0, 0.18), transparent 36%),
    rgba(14, 20, 18, 0.52);
  backdrop-filter: blur(18px);
}

.disclaimer-panel {
  --accent: #08b668;
  --accent-ink: #0a7042;
  --accent-soft: rgba(8, 182, 104, 0.1);
  --warn-soft: rgba(240, 171, 67, 0.14);
  --warn-ink: #9c6120;
  --danger-soft: rgba(228, 87, 87, 0.12);
  --danger-ink: #a23c3c;
  --panel-border: rgba(14, 28, 21, 0.08);
  width: min(100%, 416px);
  height: min(calc(var(--app-height) - 28px), 720px);
  max-height: min(calc(var(--app-height) - 28px), 720px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--panel-border);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 249, 248, 0.98));
  box-shadow: 0 28px 80px rgba(5, 16, 11, 0.22);
  overflow: hidden;
}

.disclaimer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.disclaimer-title-group {
  min-width: 0;
}

.disclaimer-badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.header-badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: rgba(10, 112, 66, 0.1);
  color: var(--accent-ink);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.header-badge-soft {
  background: rgba(15, 23, 42, 0.06);
  color: #425466;
}

.disclaimer-kicker {
  margin: 0 0 5px;
  color: #627169;
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.disclaimer-header h1 {
  margin: 0;
  color: #17211b;
  font-size: 24px;
  line-height: 1.08;
  font-weight: 900;
}

.disclaimer-progress-card {
  flex: 0 0 auto;
  display: grid;
  gap: 2px;
  min-width: 66px;
  padding: 8px 10px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(8, 182, 104, 0.12), rgba(8, 182, 104, 0.04));
  color: var(--accent-ink);
  text-align: right;
}

.disclaimer-progress-card span,
.disclaimer-progress-card small {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.disclaimer-progress-card strong {
  font-size: 18px;
  line-height: 1;
}

.disclaimer-track-shell {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.disclaimer-track {
  display: flex;
  height: 100%;
  min-height: 0;
  transition: transform 320ms ease;
}

.disclaimer-step {
  flex: 0 0 100%;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  padding: 4px 1px 3px;
  -webkit-overflow-scrolling: touch;
}

.disclaimer-step::-webkit-scrollbar {
  width: 6px;
}

.disclaimer-step::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(23, 33, 27, 0.14);
}

.step-head {
  display: grid;
  gap: 9px;
}

.disclaimer-step h2 {
  margin: 0;
  color: #18211c;
  font-size: 18px;
  line-height: 1.24;
}

.step-summary {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(8, 182, 104, 0.12);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(8, 182, 104, 0.09), rgba(255, 255, 255, 0.9));
  color: #304239;
  font-size: 12px;
  line-height: 1.62;
}

.step-markers {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.step-marker {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 9px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.05);
  color: #31413a;
  font-size: 10px;
  font-weight: 700;
  text-decoration: underline;
  text-decoration-color: rgba(8, 182, 104, 0.5);
  text-underline-offset: 4px;
}

.clause-list {
  display: grid;
  gap: 9px;
  margin-top: 12px;
}

.clause-card {
  padding: 11px 12px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
}

.clause-card.tone-warn {
  border-color: rgba(240, 171, 67, 0.28);
  background: linear-gradient(180deg, rgba(240, 171, 67, 0.08), rgba(255, 255, 255, 0.96));
}

.clause-card.tone-danger {
  border-color: rgba(228, 87, 87, 0.24);
  background: linear-gradient(180deg, rgba(228, 87, 87, 0.08), rgba(255, 255, 255, 0.96));
}

.clause-label {
  margin: 0 0 6px;
  color: #17211b;
  font-size: 12px;
  font-weight: 800;
  text-decoration: underline;
  text-decoration-color: rgba(8, 182, 104, 0.72);
  text-decoration-thickness: 2px;
  text-underline-offset: 5px;
}

.clause-card.tone-warn .clause-label {
  text-decoration-color: rgba(240, 171, 67, 0.74);
}

.clause-card.tone-danger .clause-label {
  text-decoration-color: rgba(228, 87, 87, 0.8);
}

.clause-body {
  margin: 0;
  color: #56645d;
  font-size: 12px;
  line-height: 1.66;
}

.step-notice {
  display: grid;
  gap: 6px;
  margin-top: 12px;
  padding: 11px 12px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.05);
}

.step-notice.tone-neutral {
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.step-notice.tone-warn {
  border: 1px solid rgba(240, 171, 67, 0.26);
  background: var(--warn-soft);
}

.step-notice.tone-danger {
  border: 1px solid rgba(228, 87, 87, 0.24);
  background: var(--danger-soft);
}

.notice-title {
  color: #17211b;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.step-notice p {
  margin: 0;
  color: #49564f;
  font-size: 12px;
  line-height: 1.6;
}

.disclaimer-step-confirm {
  display: flex;
  flex-direction: column;
}

.confirm-checklist {
  display: grid;
  gap: 9px;
  margin-top: 10px;
}

.confirm-note-card {
  padding: 11px 12px;
  border: 1px solid rgba(8, 182, 104, 0.16);
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(8, 182, 104, 0.08), rgba(255, 255, 255, 0.98));
}

.confirm-note-title {
  margin: 0 0 5px;
  color: #17211b;
  font-size: 12px;
  font-weight: 800;
  text-decoration: underline;
  text-decoration-color: rgba(8, 182, 104, 0.7);
  text-decoration-thickness: 2px;
  text-underline-offset: 5px;
}

.confirm-note-body {
  margin: 0;
  color: #526059;
  font-size: 12px;
  line-height: 1.6;
}

.confirm-quote {
  margin-top: 12px;
  padding: 12px;
  border-radius: 18px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  background: linear-gradient(180deg, rgba(246, 249, 247, 0.98), rgba(255, 255, 255, 0.98));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.quote-label {
  margin: 0 0 7px;
  color: #526059;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.quote-text {
  margin: 0;
  color: #18211c;
  font-size: 12px;
  line-height: 1.66;
}

.confirm-field {
  display: grid;
  gap: 6px;
  margin-top: 12px;
}

.confirm-field span {
  color: #526059;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.confirm-field textarea {
  min-height: 112px;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.98);
  color: #17211b;
  font-size: 12px;
  line-height: 1.6;
  resize: none;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
}

.confirm-field textarea:focus {
  border-color: rgba(8, 182, 104, 0.48);
  box-shadow: 0 0 0 4px rgba(8, 182, 104, 0.1);
}

:global(html.is-ios) .confirm-field textarea {
  font-size: var(--ios-control-font-size) !important;
  line-height: 1.5;
}

.confirm-hint {
  margin-top: 7px;
  font-size: 11px;
  line-height: 1.45;
}

.confirm-hint-error {
  color: var(--danger-ink);
}

.confirm-hint-success {
  color: var(--accent-ink);
}

.disclaimer-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: rgba(23, 33, 27, 0.18);
  transition: transform 200ms ease, background 200ms ease, width 200ms ease;
}

.dot.active {
  width: 16px;
  transform: none;
  background: var(--accent);
}

.disclaimer-footer {
  display: grid;
  gap: 9px;
}

.countdown-copy {
  min-height: 17px;
  color: #63726a;
  font-size: 11px;
  font-weight: 700;
}

.countdown-copy.ready {
  color: var(--accent-ink);
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.disclaimer-button {
  flex: 1;
  min-height: 40px;
  border-radius: 12px;
  font-size: 12px;
}

.disclaimer-button-primary {
  background: linear-gradient(180deg, #12c974, #08b668);
  box-shadow: 0 16px 30px rgba(8, 182, 104, 0.28);
}

.disclaimer-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
  box-shadow: none;
}

@media (max-width: 420px) {
  .disclaimer-backdrop {
    padding: 0;
  }

  .disclaimer-panel {
    width: 100%;
    height: var(--app-height);
    max-height: var(--app-height);
    border-radius: 0;
    padding-top: calc(14px + var(--safe-top));
    padding-right: calc(14px + var(--safe-right));
    padding-bottom: calc(14px + var(--safe-bottom));
    padding-left: calc(14px + var(--safe-left));
  }

  .disclaimer-header {
    gap: 9px;
  }

  .disclaimer-header h1 {
    font-size: 22px;
  }

  .disclaimer-progress-card {
    min-width: 62px;
    padding: 8px;
  }
}
</style>