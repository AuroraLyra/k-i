<template>
  <section class="tts-console">
    <nav class="tts-provider-tabs" aria-label="TTS 接口切换">
      <button
        v-for="provider in providerTabs"
        :key="provider.id"
        class="tts-provider-tab"
        :class="{ active: activeProvider === provider.id }"
        type="button"
        @click="setActiveProvider(provider.id)"
      >
        <span class="provider-tab-label">{{ provider.label }}</span>
        <small>{{ provider.badge }}</small>
      </button>
    </nav>

    <article class="tts-showcase" :class="`provider-${activeProvider}`">
      <div class="voice-stage">
        <span class="stage-badge" :class="activeProviderMeta.connected ? 'connected' : 'muted'">
          {{ activeProviderMeta.connected ? 'Connected' : 'Need setup' }}
        </span>
        <div class="voice-core">
          <span>{{ activeProviderMeta.visualLabel }}</span>
          <strong>{{ activeProviderMeta.shortLabel }}</strong>
        </div>
        <div class="wave-bars" aria-hidden="true">
          <i v-for="bar in 18" :key="bar" :style="{ '--bar-index': bar }"></i>
        </div>
      </div>

      <div class="tts-showcase-copy">
        <div class="showcase-topline">
          <div>
            <p class="module-kicker">{{ activeProviderMeta.kicker }}</p>
            <h2>{{ activeProviderMeta.title }}</h2>
          </div>
        </div>
      </div>
    </article>

    <section v-if="activeProvider === 'minimax'" class="provider-fields">
      <div class="section-head compact">
        <div>
          <p class="section-kicker">Connection</p>
          <h3>MiniMax 接口</h3>
        </div>
      </div>

      <label class="field secret-field">
        <span>API Key</span>
        <input v-model="draft.ttsMinimax.apiKey" autocomplete="off" placeholder="MiniMax API Key" type="password" />
      </label>

      <div class="field-grid two-up">
        <label class="field">
          <span>Group ID（旧版可选）</span>
          <input v-model="draft.ttsMinimax.groupId" autocomplete="off" placeholder="MiniMax Group ID" />
        </label>

        <label class="field">
          <span>Voice ID</span>
          <input v-model="draft.ttsMinimax.voiceId" placeholder="male-qn-qingse" />
        </label>
      </div>

      <div class="field-grid" :class="{ 'two-up': minimaxApiSite === 'custom' }">
        <label class="field">
          <span>API 站点</span>
          <select v-model="minimaxApiSite">
            <option value="china">国内站</option>
            <option value="global">国际站</option>
            <option value="custom">自定义</option>
          </select>
        </label>

        <label v-if="minimaxApiSite === 'custom'" class="field">
          <span>API URL</span>
          <input v-model="draft.ttsMinimax.apiUrl" placeholder="https://.../v1/t2a_v2" />
        </label>
      </div>
      <p class="provider-note">国内站与国际站当前均无需 Group ID；官方站点认证失败时会自动尝试另一站点。</p>

      <label class="field">
        <span>模型</span>
        <input v-model="draft.ttsMinimax.model" list="minimax-tts-models" placeholder="speech-02-hd" />
        <datalist id="minimax-tts-models">
          <option value="speech-2.8-hd" />
          <option value="speech-02-hd" />
          <option value="speech-02-turbo" />
          <option value="speech-01-hd" />
          <option value="speech-01-turbo" />
        </datalist>
      </label>

      <div class="section-head compact parameter-head">
        <div>
          <p class="section-kicker">Voice</p>
          <h3>音色与音频参数</h3>
        </div>
      </div>

      <div class="field-grid three-up tight-grid">
        <label class="field compact-field">
          <span>语速</span>
          <input v-model.number="draft.ttsMinimax.speed" max="2" min="0.5" step="0.1" type="number" />
        </label>

        <label class="field compact-field">
          <span>音量</span>
          <input v-model.number="draft.ttsMinimax.volume" max="10" min="0.1" step="0.1" type="number" />
        </label>

        <label class="field compact-field">
          <span>音调</span>
          <input v-model.number="draft.ttsMinimax.pitch" max="12" min="-12" step="1" type="number" />
        </label>
      </div>

      <div class="field-grid two-up">
        <label class="field">
          <span>音频格式</span>
          <select v-model="draft.ttsMinimax.audioFormat">
            <option value="mp3">MP3</option>
            <option value="wav">WAV</option>
            <option value="pcm">PCM</option>
          </select>
        </label>

        <label class="field">
          <span>声道</span>
          <select v-model.number="draft.ttsMinimax.channel">
            <option :value="1">单声道</option>
            <option :value="2">双声道</option>
          </select>
        </label>
      </div>

      <div class="field-grid two-up">
        <label class="field compact-field">
          <span>采样率</span>
          <input v-model.number="draft.ttsMinimax.sampleRate" min="8000" step="1000" type="number" />
        </label>

        <label class="field compact-field">
          <span>比特率</span>
          <input v-model.number="draft.ttsMinimax.bitrate" min="16000" step="1000" type="number" />
        </label>
      </div>
    </section>

    <section v-else-if="activeProvider === 'doubao'" class="provider-fields">
      <div class="section-head compact">
        <div>
          <p class="section-kicker">Connection</p>
          <h3>豆包语音接口</h3>
        </div>
      </div>

      <label class="field">
        <span>API URL</span>
        <input v-model="draft.ttsDoubao.apiUrl" placeholder="https://openspeech.bytedance.com/api/v1/tts" />
      </label>

      <div class="field-grid two-up">
        <label class="field">
          <span>App ID</span>
          <input v-model="draft.ttsDoubao.appId" autocomplete="off" placeholder="appid" />
        </label>

        <label class="field secret-field">
          <span>Token</span>
          <input v-model="draft.ttsDoubao.token" autocomplete="off" placeholder="access token" type="password" />
        </label>
      </div>

      <div class="field-grid two-up">
        <label class="field">
          <span>Cluster</span>
          <input v-model="draft.ttsDoubao.cluster" autocomplete="off" placeholder="volcano_tts" />
        </label>

        <label class="field">
          <span>UID</span>
          <input v-model="draft.ttsDoubao.uid" autocomplete="off" placeholder="link-user" />
        </label>
      </div>

      <label class="field">
        <span>Voice Type / 克隆音色 ID</span>
        <input v-model="draft.ttsDoubao.voiceType" list="doubao-tts-voices" placeholder="BV700_streaming / speaker id" />
        <datalist id="doubao-tts-voices">
          <option value="BV700_streaming" />
          <option value="BV700_V2_streaming" />
          <option value="BV701_streaming" />
          <option value="BV001_streaming" />
          <option value="BV002_streaming" />
          <option value="BV421_streaming" />
        </datalist>
      </label>

      <div class="section-head compact parameter-head">
        <div>
          <p class="section-kicker">Voice</p>
          <h3>复刻与音频参数</h3>
        </div>
      </div>

      <div class="field-grid three-up tight-grid">
        <label class="field compact-field">
          <span>语速</span>
          <input v-model.number="draft.ttsDoubao.speedRatio" max="3" min="0.2" step="0.1" type="number" />
        </label>

        <label class="field compact-field">
          <span>音量</span>
          <input v-model.number="draft.ttsDoubao.volumeRatio" max="3" min="0.1" step="0.1" type="number" />
        </label>

        <label class="field compact-field">
          <span>音高</span>
          <input v-model.number="draft.ttsDoubao.pitchRatio" max="3" min="0.1" step="0.1" type="number" />
        </label>
      </div>

      <div class="field-grid two-up">
        <label class="field">
          <span>编码</span>
          <select v-model="draft.ttsDoubao.encoding">
            <option value="mp3">MP3</option>
            <option value="wav">WAV</option>
            <option value="pcm">PCM</option>
            <option value="ogg_opus">OGG OPUS</option>
          </select>
        </label>

        <label class="field">
          <span>文本类型</span>
          <select v-model="draft.ttsDoubao.textType">
            <option value="plain">Plain</option>
            <option value="ssml">SSML</option>
          </select>
        </label>
      </div>

      <div class="field-grid two-up">
        <label class="field compact-field">
          <span>采样率</span>
          <input v-model.number="draft.ttsDoubao.sampleRate" min="8000" step="1000" type="number" />
        </label>

        <label class="field compact-field">
          <span>静音 ms</span>
          <input v-model.number="draft.ttsDoubao.silenceDuration" min="0" step="25" type="number" />
        </label>
      </div>

      <div class="field-grid two-up">
        <label class="field">
          <span>Emotion</span>
          <input v-model.trim="draft.ttsDoubao.emotion" placeholder="happy / sad / tear" />
        </label>

        <label class="field">
          <span>Language</span>
          <input v-model.trim="draft.ttsDoubao.language" placeholder="cn / en / ja" />
        </label>
      </div>

      <div class="toggle-grid">
        <label class="mini-toggle">
          <input v-model="draft.ttsDoubao.splitSentence" type="checkbox" />
          <span>复刻语速优化</span>
        </label>

        <label class="mini-toggle">
          <input v-model="draft.ttsDoubao.pureEnglishOpt" type="checkbox" />
          <span>英文前端优化</span>
        </label>
      </div>
    </section>

    <section v-else-if="activeProvider === 'openai'" class="provider-fields">
      <div class="section-head compact">
        <div>
          <p class="section-kicker">Vendors</p>
          <h3>OpenAI 兼容</h3>
        </div>
        <button class="section-action" type="button" @click="openVendorCreator">添加供应商</button>
      </div>

      <div v-if="openAiVendors.length" class="provider-list">
        <button
          v-for="vendor in openAiVendors"
          :key="vendor.id"
          class="provider-card"
          :class="{ active: draft.ttsOpenAi.activeVendorId === vendor.id }"
          type="button"
          @click="openVendorEditor(vendor)"
        >
          <img class="provider-avatar" :src="vendor.avatar" :alt="vendor.name" />
          <div class="provider-copy">
            <strong>{{ vendor.name }}</strong>
            <p>{{ getVendorModelSummary(vendor) }}</p>
          </div>
          <span class="status-pill" :class="vendor.enabled ? 'enabled' : 'disabled'">
            {{ vendor.enabled ? 'Enabled' : 'Disabled' }}
          </span>
        </button>
      </div>

      <section v-else class="empty-shell">
        <strong>还没有 TTS 供应商</strong>
        <p>添加 OpenAI、OpenRouter 或自建兼容网关后，可真实同步 /models 并选择语音模型。</p>
      </section>

      <div v-if="showOpenAiParameters" class="section-head compact parameter-head">
        <div>
          <p class="section-kicker">Speech parameters</p>
          <h3>OpenAI Speech 参数</h3>
        </div>
      </div>

      <div v-if="showOpenAiParameters" class="field-grid three-up openai-parameter-grid">
        <label class="field">
          <span>Voice</span>
          <input v-model.trim="draft.ttsOpenAi.voice" list="openai-tts-voice-options" placeholder="输入 voice / 选择推荐音色" />
          <datalist id="openai-tts-voice-options">
            <option v-for="voice in openAiVoiceOptions" :key="voice" :value="voice" />
          </datalist>
        </label>

        <label class="field">
          <span>音频格式</span>
          <select v-model="draft.ttsOpenAi.responseFormat">
            <option value="mp3">MP3</option>
            <option value="opus">OPUS</option>
            <option value="aac">AAC</option>
            <option value="flac">FLAC</option>
            <option value="wav">WAV</option>
            <option value="pcm">PCM</option>
          </select>
        </label>

        <label class="field compact-field">
          <span>语速</span>
          <input v-model.number="draft.ttsOpenAi.speed" max="4" min="0.25" step="0.1" type="number" />
        </label>
      </div>

      <label v-if="showOpenAiParameters" class="field">
        <span>语音指令</span>
        <textarea v-model="draft.ttsOpenAi.instructions" maxlength="500" placeholder="可选，gpt-4o-mini-tts 支持指令，例如：自然、温柔、带一点情绪。"></textarea>
      </label>

      <section v-else-if="openAiVendors.length" class="empty-shell compact-empty">
        <strong>尚未选择 TTS 模型</strong>
        <p>编辑供应商并同步 /models 后，语音参数会按所选模型显示。</p>
      </section>
    </section>

    <AppModal v-model="showVendorComposer" :title="vendorEditorTitle" :show-header="false" fixed-height variant="ins">
      <form class="provider-composer" @submit.prevent="saveVendor">
        <section class="composer-hero">
          <img class="provider-avatar composer-avatar" :src="vendorDraft.avatar" :alt="vendorDraft.name || 'Provider avatar'" />
          <div>
            <span>OpenAI Speech</span>
            <strong>{{ vendorDraft.name || 'OpenAI TTS' }}</strong>
            <p>{{ vendorDraft.enabled ? '启用后可作为当前 TTS 供应商' : '保存后保持禁用状态' }}</p>
          </div>
        </section>

        <nav class="composer-tabs" aria-label="TTS 供应商编辑分栏">
          <button
            v-for="tab in vendorTabs"
            :key="tab.id"
            class="composer-tab"
            :class="{ active: activeVendorTab === tab.id }"
            type="button"
            @click="activeVendorTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </nav>

        <section v-if="activeVendorTab === 'provider'" class="composer-section form-grid">
          <label class="toggle-card">
            <input v-model="vendorDraft.enabled" class="toggle-input" type="checkbox" />
            <span class="toggle-indicator" aria-hidden="true"></span>
            <div>
              <strong>启用供应商</strong>
            </div>
          </label>

          <label class="field">
            <span>供应商名称</span>
            <input v-model="vendorDraft.name" placeholder="OpenAI / OpenRouter / 自建 TTS 网关" />
          </label>

          <label class="field">
            <span>API Url</span>
            <input v-model="vendorDraft.apiUrl" placeholder="https://api.openai.com/v1" />
          </label>

          <label class="field">
            <span>Speech 路径</span>
            <input v-model="vendorDraft.apiPath" placeholder="/audio/speech" />
          </label>

          <label class="field secret-field">
            <span>API Key</span>
            <input v-model="vendorDraft.apiKey" autocomplete="off" type="password" />
          </label>
        </section>

        <section v-else-if="activeVendorTab === 'models'" class="composer-section form-grid">
          <div class="sync-shell">
            <div class="sync-copy">
              <span>Model sync</span>
              <strong>从 /models 拉取真实模型</strong>
            </div>
            <button class="sync-button" type="button" :disabled="vendorSyncState === 'loading'" @click="pullVendorModels">
              {{ vendorSyncButtonLabel }}
            </button>
          </div>

          <p v-if="vendorSyncFeedback" class="sync-feedback" :class="vendorSyncState === 'error' ? 'error' : 'success'">
            {{ vendorSyncFeedback }}
          </p>

          <div v-if="vendorDraft.models.length" class="model-grid">
            <label v-for="model in vendorDraft.models" :key="model.id" class="model-option">
              <input :checked="model.selected" type="checkbox" @change="toggleVendorModel(model.id, $event)" />
              <div>
                <strong>{{ model.nickname || model.id }}</strong>
                <span>{{ model.id }}</span>
              </div>
            </label>
          </div>

          <section v-else class="empty-shell compact-empty">
            <strong>暂无模型</strong>
            <p>先填好 API Url 和 Key，再同步模型列表。</p>
          </section>
        </section>

        <section v-else class="composer-section form-grid">
          <label class="field">
            <span>头像 URL</span>
            <input v-model="vendorDraft.avatar" placeholder="https://..." />
          </label>

          <label class="persona-upload-card">
            <strong>上传本地头像</strong>
            <span>保存为 TTS 供应商头像。</span>
            <input type="file" accept="image/*" @change="readVendorAvatar" />
          </label>

          <div v-if="selectedVendorModels.length" class="nickname-grid">
            <label v-for="model in selectedVendorModels" :key="model.id" class="field nickname-card">
              <span>{{ model.id }} 备注</span>
              <input :value="model.nickname" placeholder="例如：高清旁白/极速语音" @input="updateVendorModelNickname(model.id, $event)" />
            </label>
          </div>

          <div v-else class="empty-note">暂时未选择任何模型</div>
        </section>

        <div class="composer-footer">
          <button class="footer-button footer-delete" type="button" :disabled="!editingVendorId" @click="removeVendor">
            删除
          </button>
          <button class="footer-button footer-cancel" type="button" @click="showVendorComposer = false">取消</button>
          <button class="footer-button footer-save" type="submit">保存</button>
        </div>
      </form>
    </AppModal>

    <AvatarCropperModal v-model="showAvatarEditor" :src="avatarEditorSource" @confirm="applyEditedVendorAvatar" />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import AppModal from '@/components/common/AppModal.vue';
import AvatarCropperModal from '@/components/image/AvatarCropperModal.vue';
import { fetchVendorModels } from '@/services/ai';
import type { ApiVendor, ApiVendorModel, AppSettings, TtsProviderType } from '@/types/domain';
import { readImageFileFromInput } from '@/utils/imageFile';
import { createOpenAiTtsVendor, getResolvedOpenAiTtsConfig, getSelectedVendorModelCount, getTtsVoiceForProvider, mergeOpenAiTtsVendorModels, normalizeAppSettings } from '@/utils/settings';

type PreviewState = 'idle' | 'loading' | 'success' | 'error';
type VendorComposerTab = 'provider' | 'models' | 'personalize';
type MinimaxApiSite = 'china' | 'global' | 'custom';

const props = defineProps<{
  settings: AppSettings;
}>();

const emit = defineEmits<{
  save: [settings: AppSettings];
}>();

const legacyOpenAiVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
const modernOpenAiVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'];
const geminiTtsVoices = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede'];
const minimaxApiUrls: Record<Exclude<MinimaxApiSite, 'custom'>, string> = {
  china: 'https://api.minimaxi.com/v1/t2a_v2',
  global: 'https://api.minimax.io/v1/t2a_v2'
};
const vendorTabs = [
  { id: 'provider' as VendorComposerTab, label: 'openai' },
  { id: 'models' as VendorComposerTab, label: '选择模型' },
  { id: 'personalize' as VendorComposerTab, label: '个性化' }
];

const syncing = ref(false);
const activeProvider = ref<TtsProviderType>('minimax');
const showVendorComposer = ref(false);
const activeVendorTab = ref<VendorComposerTab>('provider');
const editingVendorId = ref<string | null>(null);
const showAvatarEditor = ref(false);
const avatarEditorSource = ref('');
const vendorSyncState = ref<PreviewState>('idle');
const vendorSyncFeedback = ref('');
const vendorDraft = ref<ApiVendor>(createOpenAiTtsVendor({ enabled: true, name: 'OpenAI TTS', apiUrl: '', apiPath: '/audio/speech' }));
let saveTimer: number | undefined;

function cloneVendors(vendors: ApiVendor[]) {
  return vendors.map((vendor) => ({
    ...vendor,
    models: vendor.models.map((model) => ({ ...model }))
  }));
}

function createDraft(settings: AppSettings) {
  return normalizeAppSettings({
    ...settings,
    ttsOpenAi: {
      ...settings.ttsOpenAi,
      vendors: cloneVendors(settings.ttsOpenAi.vendors)
    },
    ttsMinimax: { ...settings.ttsMinimax },
    ttsDoubao: { ...settings.ttsDoubao }
  });
}

const draft = reactive(createDraft(props.settings));
activeProvider.value = draft.ttsProvider;

function resolveMinimaxApiSite(apiUrl: string): MinimaxApiSite {
  try {
    const hostname = new URL(apiUrl).hostname.toLowerCase();
    if (hostname === 'api.minimaxi.com' || hostname === 'api-bj.minimaxi.com' || hostname === 'api.minimax.chat') return 'china';
    if (hostname === 'api.minimax.io' || hostname === 'api-uw.minimax.io') return 'global';
  } catch {
    return 'custom';
  }
  return 'custom';
}

const minimaxApiSite = computed<MinimaxApiSite>({
  get: () => resolveMinimaxApiSite(draft.ttsMinimax.apiUrl),
  set: (site) => {
    if (site === 'custom') {
      if (resolveMinimaxApiSite(draft.ttsMinimax.apiUrl) !== 'custom') draft.ttsMinimax.apiUrl = '';
      return;
    }
    draft.ttsMinimax.apiUrl = minimaxApiUrls[site];
  }
});

const openAiVendors = computed(() => draft.ttsOpenAi.vendors);
const activeOpenAiVendor = computed(() => openAiVendors.value.find((vendor) => vendor.id === draft.ttsOpenAi.activeVendorId) ?? openAiVendors.value[0] ?? null);
const resolvedOpenAiConfig = computed(() => getResolvedOpenAiTtsConfig(draft));
const activeOpenAiModel = computed(() => resolvedOpenAiConfig.value.model.trim());
const showOpenAiParameters = computed(() => Boolean(activeOpenAiVendor.value?.models.length && activeOpenAiModel.value));
const selectedVendorModels = computed(() => vendorDraft.value.models.filter((model) => model.selected));
const vendorEditorTitle = computed(() => editingVendorId.value ? '编辑 TTS 供应商' : '添加 TTS 供应商');
const vendorSyncButtonLabel = computed(() => ({
  idle: 'Sync now',
  loading: 'Syncing',
  success: 'Synced',
  error: 'Retry sync'
}[vendorSyncState.value]));
const openAiVoiceOptions = computed(() => {
  const model = activeOpenAiModel.value;
  if (/gemini.*tts/i.test(model)) return geminiTtsVoices;
  if (/^tts-1(?:-hd)?$/i.test(model)) return legacyOpenAiVoices;
  return modernOpenAiVoices;
});
const requiresKnownOpenAiVoice = computed(() => /gemini.*tts/i.test(activeOpenAiModel.value) || /^tts-1(?:-hd)?$/i.test(activeOpenAiModel.value));

const providerTabs = computed(() => [
  {
    id: 'minimax' as TtsProviderType,
    label: 'MINIMAX',
    badge: 'Pro',
    kicker: 'MiniMax TTS',
    title: '角色语音生成',
    visualLabel: 'MM',
    shortLabel: 'Pro',
    connected: Boolean(draft.ttsMinimax.apiKey.trim() && draft.ttsMinimax.voiceId.trim())
  },
  {
    id: 'openai' as TtsProviderType,
    label: 'OPENAI',
    badge: `${openAiVendors.value.length || 0} 家`,
    kicker: 'OpenAI Speech',
    title: 'OpenAI 兼容语音',
    visualLabel: 'AI',
    shortLabel: `${openAiVendors.value.length || 0} 家`,
    connected: Boolean(activeOpenAiVendor.value?.enabled && resolvedOpenAiConfig.value.endpoint.trim() && resolvedOpenAiConfig.value.model.trim())
  },
  {
    id: 'doubao' as TtsProviderType,
    label: 'DOUBAO',
    badge: 'Clone',
    kicker: 'Doubao TTS',
    title: '豆包语音复刻',
    visualLabel: 'DB',
    shortLabel: 'Clone',
    connected: Boolean(draft.ttsDoubao.apiUrl.trim() && draft.ttsDoubao.appId.trim() && draft.ttsDoubao.token.trim() && draft.ttsDoubao.cluster.trim() && draft.ttsDoubao.voiceType.trim())
  }
]);

const activeProviderMeta = computed(() => providerTabs.value.find((provider) => provider.id === activeProvider.value) ?? providerTabs.value[0]);

watch(
  () => props.settings,
  (nextSettings) => {
    syncing.value = true;
    const nextDraft = createDraft(nextSettings);
    Object.assign(draft, nextDraft);
    activeProvider.value = nextDraft.ttsProvider;
    window.setTimeout(() => {
      syncing.value = false;
    });
  },
  { deep: true }
);

function buildNextSettings() {
  const provider = activeProvider.value;
  const nextDraft = {
    ...draft,
    ttsEnabled: true,
    ttsProvider: provider,
    ttsOpenAi: {
      ...draft.ttsOpenAi,
      vendors: cloneVendors(draft.ttsOpenAi.vendors)
    },
    ttsMinimax: {
      ...draft.ttsMinimax,
      enabled: provider === 'minimax'
    },
    ttsDoubao: { ...draft.ttsDoubao }
  };

  return normalizeAppSettings({
    ...nextDraft,
    ttsVoice: getTtsVoiceForProvider(nextDraft)
  });
}

function scheduleSave() {
  if (syncing.value) return;
  if (saveTimer !== undefined) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    emit('save', buildNextSettings());
    saveTimer = undefined;
  }, 350);
}

watch(
  () => `${activeOpenAiModel.value}\0${openAiVoiceOptions.value.join('\0')}\0${requiresKnownOpenAiVoice.value}`,
  () => {
    if (!showOpenAiParameters.value) return;
    if (openAiVoiceOptions.value.includes(draft.ttsOpenAi.voice)) return;
    if (!requiresKnownOpenAiVoice.value && draft.ttsOpenAi.voice.trim()) return;
    draft.ttsOpenAi.voice = openAiVoiceOptions.value[0] ?? 'alloy';
    scheduleSave();
  },
  { immediate: true }
);

function saveNow() {
  if (syncing.value) return;
  if (saveTimer !== undefined) {
    window.clearTimeout(saveTimer);
    saveTimer = undefined;
  }
  emit('save', buildNextSettings());
}

function setActiveProvider(provider: TtsProviderType) {
  if (activeProvider.value === provider) return;
  activeProvider.value = provider;
  draft.ttsProvider = provider;
  draft.ttsEnabled = true;
  draft.ttsVoice = getTtsVoiceForProvider(draft);
  draft.ttsMinimax.enabled = provider === 'minimax';
  saveNow();
}

function getVendorModelSummary(vendor: ApiVendor) {
  const selectedCount = getSelectedVendorModelCount(vendor);
  const modelCount = vendor.models.length;
  if (!modelCount) return '未同步模型';
  return `${selectedCount || modelCount} / ${modelCount} 个模型可用`;
}

function cloneVendor(vendor?: ApiVendor) {
  return createOpenAiTtsVendor({
    ...vendor,
    models: vendor?.models.map((model) => ({ ...model })) ?? []
  });
}

function openVendorCreator() {
  editingVendorId.value = null;
  vendorDraft.value = createOpenAiTtsVendor({
    enabled: true,
    name: 'OpenAI TTS',
    apiUrl: '',
    apiPath: '/audio/speech'
  });
  vendorSyncState.value = 'idle';
  vendorSyncFeedback.value = '';
  activeVendorTab.value = 'provider';
  showVendorComposer.value = true;
}

function openVendorEditor(vendor: ApiVendor) {
  editingVendorId.value = vendor.id;
  vendorDraft.value = cloneVendor(vendor);
  vendorSyncState.value = 'idle';
  vendorSyncFeedback.value = '';
  activeVendorTab.value = 'provider';
  showVendorComposer.value = true;
}

function filterTtsModelIds(modelIds: string[]) {
  const ttsModels = modelIds.filter((modelId) => /tts|speech|audio/i.test(modelId));
  return ttsModels.length ? ttsModels : modelIds;
}

async function pullVendorModels() {
  vendorSyncState.value = 'loading';
  vendorSyncFeedback.value = '';
  try {
    const modelIds = filterTtsModelIds(await fetchVendorModels(vendorDraft.value));
    vendorDraft.value = mergeOpenAiTtsVendorModels(vendorDraft.value, modelIds);
    vendorSyncState.value = 'success';
    vendorSyncFeedback.value = modelIds.length ? `已同步 ${modelIds.length} 个模型。` : '接口返回为空，未发现可用模型。';
    activeVendorTab.value = 'models';
  } catch (error) {
    vendorSyncState.value = 'error';
    vendorSyncFeedback.value = error instanceof Error ? error.message : '模型同步失败，请检查 API 配置。';
  }
}

function toggleVendorModel(modelId: string, event: Event) {
  const input = event.target as HTMLInputElement;
  vendorDraft.value = {
    ...vendorDraft.value,
    models: vendorDraft.value.models.map((model) => model.id === modelId ? { ...model, selected: input.checked } : model)
  };
}

function updateVendorModelNickname(modelId: string, event: Event) {
  const input = event.target as HTMLInputElement;
  vendorDraft.value = {
    ...vendorDraft.value,
    models: vendorDraft.value.models.map((model) => model.id === modelId ? { ...model, nickname: input.value } : model)
  };
}

async function readVendorAvatar(event: Event) {
  const image = await readImageFileFromInput(event);
  if (!image) return;
  avatarEditorSource.value = image;
  showAvatarEditor.value = true;
}

function applyEditedVendorAvatar(value: string) {
  vendorDraft.value = {
    ...vendorDraft.value,
    avatar: value
  };
}

function saveVendor() {
  const cleanedModels = vendorDraft.value.models
    .map((model): ApiVendorModel => ({
      id: model.id.trim(),
      nickname: model.nickname.trim(),
      selected: model.selected
    }))
    .filter((model) => model.id);
  const nextVendor = createOpenAiTtsVendor({
    ...vendorDraft.value,
    name: vendorDraft.value.name.trim() || 'OpenAI TTS',
    apiUrl: vendorDraft.value.apiUrl.trim(),
    apiPath: vendorDraft.value.apiPath.trim() || '/audio/speech',
    apiKey: vendorDraft.value.apiKey.trim(),
    avatar: vendorDraft.value.avatar.trim(),
    models: cleanedModels
  });
  const remainingVendors = draft.ttsOpenAi.vendors.filter((vendor) => vendor.id !== nextVendor.id);
  draft.ttsOpenAi.vendors = [nextVendor, ...remainingVendors];
  draft.ttsOpenAi.activeVendorId = editingVendorId.value ? draft.ttsOpenAi.activeVendorId || nextVendor.id : nextVendor.id;
  if (draft.ttsOpenAi.activeVendorId === nextVendor.id) {
    draft.ttsOpenAi.model = nextVendor.models.find((model) => model.selected)?.id ?? nextVendor.models[0]?.id ?? draft.ttsOpenAi.model;
  }
  showVendorComposer.value = false;
  scheduleSave();
}

function removeVendor() {
  if (!editingVendorId.value) return;
  draft.ttsOpenAi.vendors = draft.ttsOpenAi.vendors.filter((vendor) => vendor.id !== editingVendorId.value);
  if (draft.ttsOpenAi.activeVendorId === editingVendorId.value) {
    draft.ttsOpenAi.activeVendorId = draft.ttsOpenAi.vendors[0]?.id ?? '';
    draft.ttsOpenAi.model = draft.ttsOpenAi.vendors[0]?.models.find((model) => model.selected)?.id ?? draft.ttsOpenAi.vendors[0]?.models[0]?.id ?? draft.ttsOpenAi.model;
  }
  showVendorComposer.value = false;
  scheduleSave();
}

watch(
  () => ({
    provider: draft.ttsProvider,
    enabled: draft.ttsEnabled,
    ttsOpenAi: {
      ...draft.ttsOpenAi,
      vendors: cloneVendors(draft.ttsOpenAi.vendors)
    },
    ttsMinimax: { ...draft.ttsMinimax },
    ttsDoubao: { ...draft.ttsDoubao }
  }),
  scheduleSave,
  { deep: true }
);

onBeforeUnmount(() => {
  if (saveTimer !== undefined) {
    window.clearTimeout(saveTimer);
    emit('save', buildNextSettings());
  }
});
</script>

<style scoped>
.tts-console {
  display: grid;
  gap: 16px;
  min-width: 0;
  padding-bottom: calc(10px + var(--safe-bottom));
  container-type: inline-size;
}

.tts-provider-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  width: 100%;
  min-width: 0;
}

.tts-provider-tab {
  display: grid;
  align-items: center;
  justify-items: center;
  gap: 4px;
  min-width: 0;
  min-height: 44px;
  padding: 9px 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: #6f7079;
  text-align: center;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.05);
  overflow: hidden;
}

.provider-tab-label {
  display: block;
  max-width: 100%;
  color: inherit;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.04em;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.tts-provider-tab small {
  display: block;
  max-width: 100%;
  color: inherit;
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
  opacity: 0.72;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tts-provider-tab.active {
  background: linear-gradient(180deg, #111111, #2c2f39);
  color: rgba(255, 255, 255, 0.86);
  box-shadow: 0 16px 30px rgba(26, 30, 38, 0.12);
}

.tts-showcase {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(17, 17, 17, 0.04);
  border-radius: 26px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 249, 252, 0.96));
  box-shadow: 0 16px 34px rgba(26, 30, 38, 0.06);
  overflow: hidden;
}

.tts-showcase.provider-minimax .voice-stage {
  background:
    radial-gradient(circle at top left, rgba(255, 232, 215, 0.92), transparent 30%),
    linear-gradient(135deg, #fff8f3, #eef6f6 56%, #f2f0fb);
}

.tts-showcase.provider-openai .voice-stage {
  background:
    radial-gradient(circle at top right, rgba(255, 221, 232, 0.9), transparent 30%),
    linear-gradient(135deg, #fff8fb, #f1f6fb 56%, #eef8f1);
}

.tts-showcase.provider-doubao .voice-stage {
  background:
    radial-gradient(circle at top left, rgba(226, 244, 255, 0.92), transparent 30%),
    linear-gradient(135deg, #f8fcff, #f2f8ee 56%, #fff6f1);
}

.voice-stage {
  position: relative;
  display: grid;
  align-items: end;
  min-width: 0;
  min-height: 210px;
  border-radius: 20px;
  overflow: hidden;
}

.stage-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  backdrop-filter: blur(12px);
}

.stage-badge.connected {
  background: rgba(231, 248, 236, 0.96);
  color: #138046;
}

.stage-badge.muted {
  background: rgba(241, 243, 246, 0.96);
  color: #79808a;
}

.voice-core {
  position: absolute;
  top: 20px;
  left: 18px;
  display: grid;
  gap: 4px;
  min-width: 0;
}

.voice-core span {
  color: rgba(35, 31, 37, 0.62);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.16em;
  line-height: 1;
  text-transform: uppercase;
}

.voice-core strong {
  color: rgba(35, 31, 37, 0.88);
  font-family: var(--app-current-font-family);
  font-size: 34px;
  font-weight: 650;
  line-height: 1;
}

.wave-bars {
  display: grid;
  grid-template-columns: repeat(18, minmax(0, 1fr));
  align-items: end;
  gap: 4px;
  min-width: 0;
  min-height: 92px;
  padding: 0 16px 18px;
}

.wave-bars i {
  display: block;
  height: 22px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.58);
  opacity: 0.62;
  animation: ttsWave 1.8s ease-in-out infinite;
  animation-delay: calc(var(--bar-index) * -0.06s);
}

.wave-bars i:nth-child(3n) {
  height: 42px;
  opacity: 0.76;
}

.wave-bars i:nth-child(4n + 1) {
  height: 58px;
}

.wave-bars i:nth-child(5n + 2) {
  height: 34px;
}

@keyframes ttsWave {
  0%, 100% {
    transform: scaleY(0.78);
  }

  50% {
    transform: scaleY(1);
  }
}

.tts-showcase-copy {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.showcase-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.showcase-topline > div {
  min-width: 0;
}

.module-kicker {
  margin: 0;
  color: #9d7a86;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  line-height: 1;
  text-transform: uppercase;
}

.showcase-topline h2 {
  margin: 4px 0 0;
  color: #231f25;
  font-family: var(--app-current-font-family);
  font-size: 24px;
  font-weight: 650;
  line-height: 1.12;
  overflow-wrap: anywhere;
}

.tts-overview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 248, 251, 0.96));
  box-shadow: 0 12px 30px rgba(26, 30, 38, 0.06);
  overflow: hidden;
}

.overview-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.overview-copy p,
.section-kicker {
  margin: 0;
  color: #64736a;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1;
  text-transform: uppercase;
}

.overview-copy h2,
.section-head h3 {
  margin: 0;
  color: #171717;
  line-height: 1.14;
  overflow-wrap: anywhere;
}

.overview-copy h2 {
  font-size: 20px;
}

.overview-copy span {
  max-width: 100%;
  color: #707781;
  font-size: 11px;
  font-weight: 750;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tts-status,
.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 0;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.tts-status.ready,
.status-pill.enabled {
  background: rgba(231, 248, 236, 0.96);
  color: #138046;
}

.tts-status.pending,
.status-pill.disabled {
  background: rgba(241, 243, 246, 0.96);
  color: #79808a;
}

.provider-fields {
  display: grid;
  gap: 12px;
  min-width: 0;
  overflow: hidden;
  padding: 14px;
  border: 1px solid rgba(17, 17, 17, 0.04);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(247, 248, 251, 0.94));
  box-shadow: 0 12px 30px rgba(26, 30, 38, 0.05);
}

.provider-note {
  margin: -4px 2px 0;
  color: #858b93;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.45;
}

.form-grid {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.provider-composer {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 16px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.section-head {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding-bottom: 2px;
}

.section-head.compact h3 {
  margin-top: 4px;
  font-size: 16px;
}

.parameter-head {
  padding-top: 2px;
}

.section-action,
.sync-button,
.footer-button {
  display: inline-grid !important;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 36px !important;
  height: 36px !important;
  padding: 0 12px !important;
  border-radius: 999px;
  background: var(--soft);
  color: var(--ink);
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.field-grid {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.toggle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  min-width: 0;
}

.mini-toggle {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 42px;
  padding: 0 12px;
  border-radius: 11px;
  background: #eff1f3;
  color: #626971;
  font-size: 12px;
  font-weight: 900;
  overflow: hidden;
}

.mini-toggle input {
  width: 16px;
  height: 16px;
  accent-color: #111111;
}

.mini-toggle span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.two-up {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.three-up {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.field span {
  display: block;
  max-width: 100%;
  color: #626971;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.15;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 42px;
  border: 0;
  border-radius: 11px;
  padding: 0 12px;
  background: #eff1f3;
  color: #14171a;
  font: inherit;
  font-size: 13px;
  font-weight: 760;
  outline: none;
}

.field input,
.field select {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tts-console :is(.section-action, .sync-button, .footer-button, .composer-tab, .field span, .field input, .field select, .provider-tab-label, .tts-provider-tab small) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap !important;
}

.field textarea {
  min-height: 92px;
  padding-block: 11px;
  line-height: 1.45;
  resize: vertical;
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  box-shadow: 0 0 0 2px rgba(6, 199, 85, 0.18);
}

.secret-field input {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  letter-spacing: 0.02em;
}

.compact-field input {
  padding-inline: 9px;
}

.provider-list {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 10px;
  min-width: 0;
}

.provider-card {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) max-content;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-width: 0;
  padding: 12px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 248, 251, 0.96));
  box-shadow: 0 10px 26px rgba(26, 30, 38, 0.05);
  overflow: hidden;
  text-align: left;
}

.provider-card.active {
  box-shadow: inset 0 0 0 2px rgba(6, 199, 85, 0.2), 0 10px 26px rgba(26, 30, 38, 0.05);
}

.provider-avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  object-fit: cover;
  background: var(--soft);
}

.provider-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.provider-copy strong,
.composer-hero strong,
.sync-copy strong,
.empty-shell strong,
.model-option strong,
.toggle-card strong {
  max-width: 100%;
  color: #191b1f;
  font-size: 13px;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-copy p,
.composer-hero p,
.empty-shell p,
.sync-copy span,
.model-option span,
.empty-note,
.sync-feedback {
  margin: 0;
  color: #767d86;
  font-size: 11px;
  font-weight: 720;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.empty-shell {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 14px;
  border-radius: 18px;
  background: rgba(244, 246, 248, 0.82);
}

.compact-empty {
  padding: 12px;
}

.composer-hero {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border-radius: 22px;
  background: linear-gradient(135deg, #fff8fb, #f1f6fb 56%, #eef8f1);
}

.composer-avatar {
  width: 52px;
  height: 52px;
  border-radius: 18px;
}

.composer-hero > div,
.sync-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.composer-hero span {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: #9d7a86;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.composer-hero strong {
  font-size: 18px;
  font-weight: 800;
}

.composer-hero p {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.5;
}

.composer-tabs {
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  min-width: 0;
  margin-bottom: 6px;
}

.composer-section {
  position: relative;
  z-index: 1;
  min-height: 0;
  align-content: start;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.composer-section-head {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.composer-section-head span {
  color: #9d7a86;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  line-height: 1;
  text-transform: uppercase;
}

.composer-section-head strong {
  color: #191b1f;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.15;
}

.composer-tab {
  display: inline-grid !important;
  align-items: center !important;
  justify-items: center !important;
  min-width: 0;
  min-height: 38px !important;
  height: 38px !important;
  padding: 0 6px !important;
  border-radius: 999px;
  background: rgba(245, 246, 248, 0.9);
  color: #717782;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-tab.active {
  background: #111111;
  color: rgba(255, 255, 255, 0.86);
}

.toggle-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: 50px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.88);
}

.toggle-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle-indicator {
  flex: 0 0 18px;
  position: relative;
  width: 18px;
  height: 18px;
  border: 1.5px solid rgba(146, 150, 158, 0.55);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.toggle-indicator::after {
  display: none;
}

.toggle-input:checked + .toggle-indicator {
  border-color: transparent;
  background: linear-gradient(180deg, #1f2229, #3a3d48);
  box-shadow: 0 0 0 4px rgba(255, 219, 230, 0.58);
}

.sync-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border-radius: 18px;
  background: rgba(245, 246, 248, 0.9);
}

.sync-feedback.success {
  color: #26774e;
}

.sync-feedback.error {
  color: #cf425a;
}

.model-grid,
.nickname-grid {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.model-option {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(245, 246, 248, 0.9);
}

.model-option input {
  width: 16px;
  height: 16px;
}

.model-option > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.nickname-card {
  padding: 10px;
  border-radius: 14px;
  background: rgba(245, 246, 248, 0.78);
}

.persona-upload-card {
  display: grid;
  gap: 8px;
  min-width: 0;
  min-height: 58px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
}

.persona-upload-card strong,
.persona-upload-card span {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.persona-upload-card strong {
  color: #232529;
  font-size: 13px;
  font-weight: 800;
}

.persona-upload-card span {
  color: #767d86;
  font-size: 12px;
  line-height: 1.4;
}

.persona-upload-card input {
  display: none;
}

.composer-footer {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  align-self: stretch;
  justify-self: stretch;
  width: 100%;
  min-width: 0;
  padding-top: 2px;
}

.footer-delete {
  background: #fff0f3;
  color: #c43b56;
}

.footer-cancel {
  background: #f0f2f4;
  color: #69717b;
}

.footer-save {
  background: #111111;
  color: #ffffff;
}

.composer-footer .footer-button {
  min-height: 42px !important;
  height: 42px !important;
  border-radius: 16px;
  font-size: 13px;
}

.footer-button:disabled,
.sync-button:disabled,
.section-action:disabled {
  opacity: 0.55;
}

@container (max-width: 360px) {
  .tts-console {
    gap: 12px;
  }

  .tts-provider-tabs,
  .composer-tabs {
    gap: 4px;
  }

  .tts-provider-tab {
    min-height: 42px;
    padding-inline: 2px;
  }

  .provider-tab-label {
    font-size: 9px;
  }

  .tts-provider-tab small {
    font-size: 8px;
  }

  .tts-showcase,
  .voice-stage,
  .provider-card,
  .sync-shell,
  .composer-hero {
    padding: 11px;
  }

  .voice-stage {
    min-height: 186px;
  }

  .showcase-topline {
    grid-template-columns: minmax(0, 1fr);
  }

  .showcase-topline {
    display: grid;
  }

  .provider-fields,
  .field-grid,
  .provider-fields,
  .form-grid {
    gap: 8px;
  }

  .field input,
  .field select,
  .field textarea {
    padding-inline: 9px;
    font-size: 12px;
  }

  .openai-parameter-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@container (max-width: 310px) {
  .two-up {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .three-up.tight-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .section-head,
  .sync-shell {
    grid-template-columns: minmax(0, 1fr) max-content;
  }

  .section-action,
  .sync-button {
    width: auto;
  }
}
</style>