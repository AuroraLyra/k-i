<template>
  <section class="image-module-configurator">
    <section class="composer-shell">
      <p v-if="moduleFeedback[activeModuleId]" class="module-feedback" :class="previewState[activeModuleId] === 'error' ? 'error' : 'success'">
        {{ moduleFeedback[activeModuleId] }}
      </p>

      <section v-if="activeModuleId === 'openai'" class="composer-section form-grid">
        <div class="section-head compact">
          <div>
            <p class="section-kicker">Vendors</p>
            <h3>OpenAI 兼容供应商</h3>
          </div>
          <button class="secondary-action section-action" type="button" @click="openVendorCreator">添加供应商</button>
        </div>

        <div v-if="draft.imageOpenAi.vendors.length" class="provider-list">
          <button
            v-for="vendor in draft.imageOpenAi.vendors"
            :key="vendor.id"
            class="provider-card"
            type="button"
            @click="openVendorEditor(vendor)"
          >
            <img class="provider-avatar" :src="vendor.avatar" :alt="vendor.name" />
            <div class="provider-copy">
              <strong>{{ vendor.name }}</strong>
              <p>{{ imageVendorModelSummary(vendor) }}</p>
            </div>
            <div class="provider-meta">
              <span class="status-pill" :class="vendor.enabled ? 'enabled' : 'disabled'">
                {{ vendor.enabled ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
          </button>
        </div>
        <section v-else class="empty-shell">
          <strong>还没有图片供应商</strong>
          <p>支持添加多个 OpenAI 兼容图片供应商，例如 OpenAI、OpenRouter 或自建网关。</p>
        </section>

        <label class="field">
          <span>默认画幅</span>
          <select v-model="draft.imageOpenAi.size">
            <option value="1024x1024">1024 x 1024</option>
            <option value="832x1216">832 x 1216</option>
            <option value="768x1152">768 x 1152</option>
            <option value="640x960">640 x 960</option>
            <option value="1216x832">1216 x 832</option>
            <option value="1152x768">1152 x 768</option>
          </select>
        </label>

        <section class="prompt-preset-shell">
          <div class="section-head compact">
            <div>
              <p class="section-kicker">Prompts</p>
              <h3>提示词预设</h3>
            </div>
            <div class="preset-actions">
              <button class="secondary-action preset-action" type="button" @click="addPromptPreset(activeModuleId)">新增预设</button>
              <button class="secondary-action preset-action" type="button" :disabled="activePromptPresets.length <= 1" @click="removePromptPreset(activeModuleId)">删除当前</button>
            </div>
          </div>

          <div class="field-grid two-up">
            <label class="field">
              <span>当前预设</span>
              <select v-model="activePromptPresetIdModel">
                <option v-for="preset in activePromptPresets" :key="preset.id" :value="preset.id">
                  {{ preset.name || '未命名预设' }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>预设名称</span>
              <input v-model="activePromptPresetNameModel" placeholder="例如：角色立绘 / 书封 / 海报" />
            </label>
          </div>

          <label class="field">
            <span>正向提示词</span>
            <textarea v-model="activePositivePromptModel" :placeholder="activePromptPlaceholders.positive" />
          </label>

          <label class="field">
            <span>反向提示词</span>
            <textarea v-model="activeNegativePromptModel" :placeholder="activePromptPlaceholders.negative" />
          </label>

          <label class="field">
            <span>默认负面词</span>
            <textarea v-model="activeDefaultNegativePromptModel" placeholder="用于聊天配图和 VOOM 配图的通用质量、脸部、手部负面词" />
          </label>

          <label class="field">
            <span>聊天配图模板</span>
            <textarea v-model="activeOnlineChatTemplateModel" placeholder="可使用 {basePrompt} {generationPrompt} {sceneDescription} {characterAppearance} {faceConsistency}" />
          </label>

          <label class="field">
            <span>VOOM 配图模板</span>
            <textarea v-model="activeVoomTemplateModel" placeholder="可使用 {basePrompt} {generationPrompt} {sceneDescription} {characterAppearance} {faceConsistency} {postContent}" />
          </label>
        </section>

      </section>

      <section v-else-if="activeModuleId === 'novelai'" class="composer-section form-grid">
        <div class="section-head compact">
          <div>
            <p class="section-kicker">NovelAI</p>
            <h3>连接、模型与参数</h3>
          </div>
        </div>

        <section class="novelai-panel">
          <div class="novelai-status-card" :class="`status-${novelAiSyncState}`">
            <div>
              <p class="section-kicker">Auto check</p>
              <strong>{{ novelAiStatusTitle }}</strong>
              <small>{{ novelAiSyncFeedback }}</small>
            </div>
            <span>{{ novelAiStatusBadge }}</span>
          </div>

          <div class="field-grid two-up compact-grid">
            <label class="field">
              <span>连接方式</span>
              <select v-model="draft.imageNovelAi.endpointMode">
                <option value="proxy">内置代理</option>
                <option value="official">官方直连</option>
                <option value="custom">第三方代理</option>
              </select>
            </label>

            <label class="field">
              <span>NovelAI Token</span>
              <input v-model="draft.imageNovelAi.apiKey" autocomplete="off" type="password" />
            </label>
          </div>

          <label v-if="draft.imageNovelAi.endpointMode === 'custom'" class="field">
            <span>第三方代理链接</span>
            <input v-model="draft.imageNovelAi.customProxyUrl" autocomplete="off" inputmode="url" placeholder="https://your-novelai-proxy.example.com" />
          </label>

          <div class="field-grid two-up compact-grid">
            <label class="field">
              <span>模型</span>
              <select v-model="novelAiModelModel">
                <option v-for="model in novelAiModelOptions" :key="model.id" :value="model.id">
                  {{ model.label }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>尺寸</span>
              <select v-model="novelAiSizePresetModel">
                <option v-for="preset in novelAiSizePresets" :key="preset.value" :value="preset.value">
                  {{ preset.label }}
                </option>
              </select>
            </label>
          </div>

          <div class="field-grid three-up compact-grid">
            <label class="field">
              <span>采样器</span>
              <select v-model="draft.imageNovelAi.sampler">
                <option value="k_euler_ancestral">Euler A</option>
                <option value="k_euler">Euler</option>
                <option value="k_dpmpp_2m">DPM++ 2M</option>
                <option value="k_dpmpp_sde">DPM++ SDE</option>
                <option value="k_dpmpp_2s_ancestral">DPM++ 2S A</option>
                <option value="ddim">DDIM</option>
              </select>
            </label>

            <label class="field">
              <span>噪声计划</span>
              <select v-model="draft.imageNovelAi.noiseSchedule">
                <option value="native">Native</option>
                <option value="karras">Karras</option>
                <option value="exponential">Exponential</option>
                <option value="polyexponential">Polyexponential</option>
              </select>
            </label>

            <label class="field">
              <span>种子</span>
              <input v-model="draft.imageNovelAi.seed" placeholder="随机" />
            </label>
          </div>

          <div class="field-grid three-up compact-grid">
            <label class="field">
              <span>引导强度</span>
              <input v-model.number="draft.imageNovelAi.guidance" min="1" max="20" step="0.5" type="number" />
            </label>
            <label class="field">
              <span>步数</span>
              <input v-model.number="draft.imageNovelAi.steps" min="1" max="60" step="1" type="number" />
            </label>
            <label class="field">
              <span>CFG Rescale</span>
              <input v-model.number="draft.imageNovelAi.cfgRescale" min="0" max="1" step="0.05" type="number" />
            </label>
          </div>

          <div class="field-grid two-up compact-grid">
            <label class="field">
              <span>UC 预设</span>
              <select v-model.number="draft.imageNovelAi.ucPreset">
                <option v-for="preset in novelAiUcPresetOptions" :key="preset.value" :value="preset.value">
                  {{ preset.label }}
                </option>
              </select>
            </label>
          </div>

          <div class="toggle-grid compact-toggle-grid">
            <label class="toggle-card">
              <input v-model="draft.imageNovelAi.qualityToggle" class="toggle-input" type="checkbox" />
              <span class="toggle-indicator" aria-hidden="true"></span>
              <div>
                <strong>Quality</strong>
                <small>官方质量增强</small>
              </div>
            </label>
            <label class="toggle-card">
              <input v-model="draft.imageNovelAi.sm" class="toggle-input" type="checkbox" />
              <span class="toggle-indicator" aria-hidden="true"></span>
              <div>
                <strong>SMEA</strong>
                <small>大图构图</small>
              </div>
            </label>
            <label class="toggle-card">
              <input v-model="draft.imageNovelAi.smDyn" class="toggle-input" type="checkbox" />
              <span class="toggle-indicator" aria-hidden="true"></span>
              <div>
                <strong>SMEA Dyn</strong>
                <small>动态细节</small>
              </div>
            </label>
            <label class="toggle-card">
              <input v-model="draft.imageNovelAi.dynamicThresholding" class="toggle-input" type="checkbox" />
              <span class="toggle-indicator" aria-hidden="true"></span>
              <div>
                <strong>Threshold</strong>
                <small>高 CFG 稳定</small>
              </div>
            </label>
          </div>
        </section>

        <section class="prompt-preset-shell">
          <div class="section-head compact">
            <div>
              <p class="section-kicker">Prompts</p>
              <h3>提示词预设</h3>
            </div>
            <div class="preset-actions">
              <button class="secondary-action preset-action" type="button" @click="addPromptPreset(activeModuleId)">新增预设</button>
              <button class="secondary-action preset-action" type="button" :disabled="activePromptPresets.length <= 1" @click="removePromptPreset(activeModuleId)">删除当前</button>
            </div>
          </div>

          <div class="field-grid two-up">
            <label class="field">
              <span>当前预设</span>
              <select v-model="activePromptPresetIdModel">
                <option v-for="preset in activePromptPresets" :key="preset.id" :value="preset.id">
                  {{ preset.name || '未命名预设' }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>预设名称</span>
              <input v-model="activePromptPresetNameModel" placeholder="例如：角色立绘 / 书封 / 海报" />
            </label>
          </div>

          <label class="field">
            <span>正向提示词</span>
            <textarea v-model="activePositivePromptModel" :placeholder="activePromptPlaceholders.positive" />
          </label>

          <label class="field">
            <span>反向提示词</span>
            <textarea v-model="activeNegativePromptModel" :placeholder="activePromptPlaceholders.negative" />
          </label>

          <label class="field">
            <span>默认负面词</span>
            <textarea v-model="activeDefaultNegativePromptModel" placeholder="用于聊天配图和 VOOM 配图的通用质量、脸部、手部负面词" />
          </label>

          <label class="field">
            <span>聊天配图模板</span>
            <textarea v-model="activeOnlineChatTemplateModel" placeholder="可使用 {basePrompt} {generationPrompt} {sceneDescription} {characterAppearance} {faceConsistency}" />
          </label>

          <label class="field">
            <span>VOOM 配图模板</span>
            <textarea v-model="activeVoomTemplateModel" placeholder="可使用 {basePrompt} {generationPrompt} {sceneDescription} {characterAppearance} {faceConsistency} {postContent}" />
          </label>
        </section>

      </section>

      <section v-else class="composer-section form-grid">
        <div class="section-head compact">
          <div>
            <p class="section-kicker">Pollinations</p>
            <h3>连接、模型与参数</h3>
          </div>
        </div>

        <section class="novelai-panel pollinations-panel">
          <div class="novelai-status-card" :class="`status-${pollinationsSyncState}`">
            <div>
              <p class="section-kicker">Auto check</p>
              <strong>{{ pollinationsStatusTitle }}</strong>
              <small>{{ pollinationsSyncFeedback }}</small>
            </div>
            <span>{{ pollinationsStatusBadge }}</span>
          </div>

          <div class="field-grid two-up compact-grid">
            <label class="field">
              <span>Pollinations API Key</span>
              <input v-model="draft.imagePollinations.apiKey" autocomplete="off" type="password" placeholder="pk_ 或 sk_" />
            </label>

            <label class="field">
              <span>参考图 URL</span>
              <input v-model="draft.imagePollinations.referenceImage" placeholder="可选，支持编辑/参考图模型" />
            </label>
          </div>

          <div class="field-grid two-up compact-grid">
            <label class="field">
              <span>模型</span>
              <select v-model="draft.imagePollinations.model">
                <option v-for="model in pollinationsModelOptions" :key="model.id" :value="model.id">
                  {{ model.label }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>尺寸</span>
              <select v-model="pollinationsSizePresetModel">
                <option v-for="preset in pollinationsSizePresets" :key="preset.value" :value="preset.value">
                  {{ preset.label }}
                </option>
              </select>
            </label>
          </div>

          <div class="field-grid three-up compact-grid pollinations-parameter-grid">
            <label class="field">
              <span>种子</span>
              <input v-model="draft.imagePollinations.seed" placeholder="随机" />
            </label>
            <label class="field">
              <span>安全策略</span>
              <select v-model="draft.imagePollinations.safe">
                <option value="true">基础</option>
                <option value="privacy,secrets">隐私</option>
                <option value="nsfw">NSFW</option>
                <option value="false">关闭</option>
              </select>
            </label>
            <label class="field">
              <span>质量</span>
              <select v-model="draft.imagePollinations.quality">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="hd">HD</option>
              </select>
            </label>
          </div>

          <div class="toggle-grid compact-toggle-grid pollinations-toggle-grid">
            <label class="toggle-card">
              <input v-model="draft.imagePollinations.transparent" class="toggle-input" type="checkbox" />
              <span class="toggle-indicator" aria-hidden="true"></span>
              <div>
                <strong>Transparent</strong>
                <small>透明背景</small>
              </div>
            </label>
          </div>
        </section>

        <section class="prompt-preset-shell">
          <div class="section-head compact">
            <div>
              <p class="section-kicker">Prompts</p>
              <h3>提示词预设</h3>
            </div>
            <div class="preset-actions">
              <button class="secondary-action preset-action" type="button" @click="addPromptPreset(activeModuleId)">新增预设</button>
              <button class="secondary-action preset-action" type="button" :disabled="activePromptPresets.length <= 1" @click="removePromptPreset(activeModuleId)">删除当前</button>
            </div>
          </div>

          <div class="field-grid two-up">
            <label class="field">
              <span>当前预设</span>
              <select v-model="activePromptPresetIdModel">
                <option v-for="preset in activePromptPresets" :key="preset.id" :value="preset.id">
                  {{ preset.name || '未命名预设' }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>预设名称</span>
              <input v-model="activePromptPresetNameModel" placeholder="例如：角色立绘 / 书封 / 海报" />
            </label>
          </div>

          <label class="field">
            <span>正向提示词</span>
            <textarea v-model="activePositivePromptModel" :placeholder="activePromptPlaceholders.positive" />
          </label>

          <label class="field">
            <span>反向提示词</span>
            <textarea v-model="activeNegativePromptModel" :placeholder="activePromptPlaceholders.negative" />
          </label>

          <label class="field">
            <span>默认负面词</span>
            <textarea v-model="activeDefaultNegativePromptModel" placeholder="用于聊天配图和 VOOM 配图的通用质量、脸部、手部负面词" />
          </label>

          <label class="field">
            <span>聊天配图模板</span>
            <textarea v-model="activeOnlineChatTemplateModel" placeholder="可使用 {basePrompt} {generationPrompt} {sceneDescription} {characterAppearance} {faceConsistency}" />
          </label>

          <label class="field">
            <span>VOOM 配图模板</span>
            <textarea v-model="activeVoomTemplateModel" placeholder="可使用 {basePrompt} {generationPrompt} {sceneDescription} {characterAppearance} {faceConsistency} {postContent}" />
          </label>
        </section>

      </section>
    </section>

    <AppModal v-model="showVendorComposer" :title="vendorEditorTitle" :show-header="false" fixed-height variant="ins">
      <form class="provider-composer" @submit.prevent="saveVendor">
        <section class="composer-hero provider-hero">
          <img class="provider-avatar" :src="vendorDraft.avatar" :alt="vendorDraft.name || 'Provider avatar'" />
          <div>
            <span>Provider moodboard</span>
            <strong>{{ vendorDraft.name || 'OpenAI Images' }}</strong>
            <p>{{ vendorDraft.enabled ? '启用后可在生图模型切换中选择' : '保存后保持禁用状态' }}</p>
          </div>
        </section>

        <nav class="composer-tabs" aria-label="图片供应商编辑分栏">
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

          <label class="toggle-card">
            <input v-model="vendorDraft.preferBase64ImageResponse" class="toggle-input" type="checkbox" />
            <span class="toggle-indicator" aria-hidden="true"></span>
            <div>
              <strong>优先 Base64 图片响应</strong>
            </div>
          </label>

          <label class="field">
            <span>供应商名称</span>
            <input v-model="vendorDraft.name" placeholder="OpenAI / OpenRouter / 自建图片网关" />
          </label>

          <label class="field">
            <span>API Url</span>
            <input v-model="vendorDraft.apiUrl" placeholder="https://api.openai.com/v1" />
          </label>

          <label class="field">
            <span>API 路径（新手谨慎更改）</span>
            <input v-model="vendorDraft.apiPath" placeholder="/images/generations" />
          </label>

          <label class="field">
            <span>API Key</span>
            <input v-model="vendorDraft.apiKey" autocomplete="off" type="password" />
          </label>

        </section>

        <section v-else-if="activeVendorTab === 'models'" class="composer-section form-grid">
          <div class="sync-shell">
            <div class="sync-copy">
              <span>Model sync</span>
              <strong>点击 Sync now 拉取图片模型</strong>
            </div>
            <button class="sync-button" type="button" :disabled="vendorSyncState === 'loading'" @click="pullVendorModels">
              {{ vendorSyncButtonLabel }}
            </button>
          </div>
          <p v-if="vendorSyncFeedback" class="module-feedback" :class="vendorSyncState === 'error' ? 'error' : 'success'">
            {{ vendorSyncFeedback }}
          </p>

          <div v-if="vendorDraft.models.length" class="model-grid">
            <label
              v-for="model in vendorDraft.models"
              :key="model.id"
              class="model-option"
            >
              <input :checked="model.selected" type="checkbox" @change="toggleVendorModel(model.id, $event)" />
              <div>
                <strong>{{ model.nickname || model.id }}</strong>
                <span>{{ model.id }}</span>
              </div>
            </label>
          </div>

          <section v-else class="empty-shell compact-empty">
            <strong>暂无图片模型</strong>
            <p>先填好接口和 Key，再同步模型列表。</p>
          </section>
        </section>

        <section v-else class="composer-section form-grid">
          <label class="field persona-card">
            <span>头像 URL</span>
            <input v-model="vendorDraft.avatar" placeholder="https://..." />
          </label>

          <label class="persona-upload-card">
            <strong>上传本地头像</strong>
            <span>保存为图片供应商头像。</span>
            <input type="file" accept="image/*" @change="readVendorAvatar" />
          </label>

          <div v-if="selectedVendorModels.length" class="nickname-grid">
            <label v-for="model in selectedVendorModels" :key="model.id" class="field nickname-card">
              <span>{{ model.id }} 备注</span>
              <input :value="model.nickname" placeholder="例如：封面/立绘" @input="updateVendorModelNickname(model.id, $event)" />
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
import { checkNovelAiImageAccess, checkPollinationsImageAccess, fetchNovelAiModels, fetchPollinationsModels, fetchVendorModels } from '@/services/ai';
import type { ApiVendor, ApiVendorModel, AppSettings, ImageModuleId, ImagePromptPreset } from '@/types/domain';
import { createId } from '@/utils/id';
import { readImageFileFromInput } from '@/utils/imageFile';
import { createImageApiVendor, isNovelAiV4FamilyModel, mergeImageVendorModels, normalizeAppSettings, normalizeNovelAiUcPreset } from '@/utils/settings';

type PreviewState = 'idle' | 'loading' | 'success' | 'error';
type VendorComposerTab = 'provider' | 'models' | 'personalize';

const props = defineProps<{
  settings: AppSettings;
  moduleId: ImageModuleId;
}>();

const emit = defineEmits<{
  save: [settings: AppSettings];
}>();

const vendorTabs = [
  { id: 'provider' as VendorComposerTab, label: 'openai' },
  { id: 'models' as VendorComposerTab, label: '选择模型' },
  { id: 'personalize' as VendorComposerTab, label: '个性化' }
];

const draft = ref<AppSettings>(normalizeAppSettings(props.settings));
const showVendorComposer = ref(false);
const activeVendorTab = ref<VendorComposerTab>('provider');
const editingVendorId = ref<string | null>(null);
const showAvatarEditor = ref(false);
const avatarEditorSource = ref('');
const vendorDraft = ref<ApiVendor>(createImageApiVendor({
  enabled: true,
  name: 'OpenAI Images',
  apiUrl: '',
  apiPath: '/images/generations',
  preferBase64ImageResponse: true
}));
const vendorSyncState = ref<PreviewState>('idle');
const vendorSyncFeedback = ref('');
const novelAiSyncState = ref<PreviewState>('idle');
const novelAiSyncFeedback = ref('');
const pollinationsSyncState = ref<PreviewState>('idle');
const pollinationsSyncFeedback = ref('');
const previewState = reactive<Record<ImageModuleId, PreviewState>>({
  openai: 'idle',
  novelai: 'idle',
  pollinations: 'idle'
});
const moduleFeedback = reactive<Record<ImageModuleId, string>>({
  openai: '',
  novelai: '',
  pollinations: ''
});
let skipNextDraftSave = false;
let autoSaveTimer: number | undefined;
let novelAiCheckTimer: number | undefined;
let pollinationsCheckTimer: number | undefined;

watch(
  () => props.settings,
  (nextSettings) => {
    skipNextDraftSave = true;
    draft.value = normalizeAppSettings(nextSettings);
  },
  { deep: true }
);

watch(
  draft,
  (nextDraft) => {
    if (skipNextDraftSave) {
      skipNextDraftSave = false;
      return;
    }

    if (autoSaveTimer) window.clearTimeout(autoSaveTimer);
    autoSaveTimer = window.setTimeout(() => {
      emit('save', normalizeAppSettings(nextDraft));
    }, 350);
  },
  { deep: true }
);

onBeforeUnmount(() => {
  if (autoSaveTimer) {
    window.clearTimeout(autoSaveTimer);
    emit('save', normalizeAppSettings(draft.value));
  }
  if (novelAiCheckTimer) window.clearTimeout(novelAiCheckTimer);
  if (pollinationsCheckTimer) window.clearTimeout(pollinationsCheckTimer);
});

const activeModuleId = computed(() => props.moduleId);
const vendorEditorTitle = computed(() => editingVendorId.value ? '编辑图片供应商' : '添加图片供应商');
const vendorSyncButtonLabel = computed(() => ({
  idle: 'Sync now',
  loading: 'Syncing',
  success: 'Synced',
  error: 'Retry sync'
}[vendorSyncState.value]));
const novelAiSizePresets = [
  { label: 'Portrait 832 x 1216', value: '832x1216', width: 832, height: 1216 },
  { label: 'Portrait 768 x 1152', value: '768x1152', width: 768, height: 1152 },
  { label: 'Portrait 640 x 960', value: '640x960', width: 640, height: 960 },
  { label: 'Square 1024 x 1024', value: '1024x1024', width: 1024, height: 1024 },
  { label: 'Landscape 1216 x 832', value: '1216x832', width: 1216, height: 832 },
  { label: 'Landscape 1152 x 768', value: '1152x768', width: 1152, height: 768 }
];
const novelAiLegacyUcPresetOptions = [
  { label: 'Preset 0', value: 0 },
  { label: 'Preset 1', value: 1 },
  { label: 'Preset 2', value: 2 },
  { label: 'None', value: 3 },
  { label: 'Heavy', value: 4 }
];
const novelAiV4UcPresetOptions = [
  { label: 'Heavy', value: 4 },
  { label: 'Light', value: 5 },
  { label: 'Human Focus', value: 6 },
  { label: 'Furry Focus', value: 7 },
  { label: 'None', value: 3 }
];
const pollinationsSizePresets = novelAiSizePresets;
const novelAiModelOptions = computed(() => draft.value.imageNovelAi.availableModels);
const novelAiUcPresetOptions = computed(() => isNovelAiV4FamilyModel(draft.value.imageNovelAi.model) ? novelAiV4UcPresetOptions : novelAiLegacyUcPresetOptions);
const pollinationsModelOptions = computed(() => draft.value.imagePollinations.availableModels);
const novelAiModelModel = computed({
  get: () => draft.value.imageNovelAi.model,
  set: (model: string) => {
    draft.value = normalizeAppSettings({
      ...draft.value,
      imageNovelAi: {
        ...draft.value.imageNovelAi,
        model,
        ucPreset: normalizeNovelAiUcPreset(model, draft.value.imageNovelAi.ucPreset)
      }
    });
  }
});
const novelAiSizePresetModel = computed({
  get: () => {
    const width = draft.value.imageNovelAi.width;
    const height = draft.value.imageNovelAi.height;
    return novelAiSizePresets.find((preset) => preset.width === width && preset.height === height)?.value ?? novelAiSizePresets[0].value;
  },
  set: (value: string) => {
    const preset = novelAiSizePresets.find((item) => item.value === value) ?? novelAiSizePresets[0];
    draft.value = normalizeAppSettings({
      ...draft.value,
      imageNovelAi: {
        ...draft.value.imageNovelAi,
        width: preset.width,
        height: preset.height
      }
    });
  }
});
const novelAiStatusTitle = computed(() => {
  if (novelAiSyncState.value === 'success' && draft.value.imageNovelAi.endpointMode === 'custom') {
    return '配置已就绪';
  }
  return {
    idle: '等待配置',
    loading: '正在检测',
    success: '接口可调用',
    error: '不可调用'
  }[novelAiSyncState.value];
});
const novelAiStatusBadge = computed(() => ({
  idle: 'Ready',
  loading: 'Check',
  success: 'OK',
  error: 'Error'
}[novelAiSyncState.value]));
const pollinationsSizePresetModel = computed({
  get: () => {
    const width = draft.value.imagePollinations.width;
    const height = draft.value.imagePollinations.height;
    return pollinationsSizePresets.find((preset) => preset.width === width && preset.height === height)?.value ?? pollinationsSizePresets[3].value;
  },
  set: (value: string) => {
    const preset = pollinationsSizePresets.find((item) => item.value === value) ?? pollinationsSizePresets[3];
    draft.value = normalizeAppSettings({
      ...draft.value,
      imagePollinations: {
        ...draft.value.imagePollinations,
        width: preset.width,
        height: preset.height
      }
    });
  }
});
const pollinationsStatusTitle = computed(() => ({
  idle: '等待检测',
  loading: '正在检测',
  success: '接口可调用',
  error: '不可调用'
}[pollinationsSyncState.value]));
const pollinationsStatusBadge = computed(() => ({
  idle: 'Ready',
  loading: 'Check',
  success: 'OK',
  error: 'Error'
}[pollinationsSyncState.value]));
const selectedVendorModels = computed(() => vendorDraft.value.models.filter((model) => model.selected));
const activePromptPlaceholders = computed(() => ({
  openai: {
    positive: '例如：Seoul editorial photo, linen desk, soft sunlight, clean composition',
    negative: '例如：blurry, extra fingers, noisy background, oversaturated'
  },
  novelai: {
    positive: '例如：Korean bookshelf cover art, soft beige, embossed title, detailed illustration',
    negative: '例如：bad anatomy, watermark, noisy, text artifacts'
  },
  pollinations: {
    positive: '例如：minimal Korean zine cover, muted blush palette, bookstore shelf photography',
    negative: '例如：extra limbs, deformed hands, cluttered background'
  }
}[activeModuleId.value]));

type PromptSettings = AppSettings['imageOpenAi'] | AppSettings['imageNovelAi'] | AppSettings['imagePollinations'];

function cloneVendor(vendor?: ApiVendor) {
  return createImageApiVendor({
    ...vendor,
    models: vendor?.models.map((model) => ({ ...model })) ?? []
  });
}

function getPromptSettings(moduleId: ImageModuleId): PromptSettings {
  if (moduleId === 'openai') return draft.value.imageOpenAi;
  if (moduleId === 'novelai') return draft.value.imageNovelAi;
  return draft.value.imagePollinations;
}

function updatePromptSettings(moduleId: ImageModuleId, nextSettings: PromptSettings) {
  if (moduleId === 'openai') {
    draft.value = normalizeAppSettings({
      ...draft.value,
      imageOpenAi: nextSettings as AppSettings['imageOpenAi']
    });
    return;
  }

  if (moduleId === 'novelai') {
    draft.value = normalizeAppSettings({
      ...draft.value,
      imageNovelAi: nextSettings as AppSettings['imageNovelAi']
    });
    return;
  }

  draft.value = normalizeAppSettings({
    ...draft.value,
    imagePollinations: nextSettings as AppSettings['imagePollinations']
  });
}

function patchPromptSettings(moduleId: ImageModuleId, updater: (settings: PromptSettings) => PromptSettings) {
  updatePromptSettings(moduleId, updater(getPromptSettings(moduleId)));
}

function resolveActivePromptPreset(moduleId: ImageModuleId) {
  const settings = getPromptSettings(moduleId);
  return settings.promptPresets.find((preset) => preset.id === settings.activePromptPresetId) ?? settings.promptPresets[0] ?? null;
}

const activePromptPresets = computed(() => getPromptSettings(activeModuleId.value).promptPresets);
const activePromptPresetIdModel = computed({
  get: () => resolveActivePromptPreset(activeModuleId.value)?.id ?? '',
  set: (presetId: string) => setActivePromptPreset(activeModuleId.value, presetId)
});
const activePromptPresetNameModel = computed({
  get: () => resolveActivePromptPreset(activeModuleId.value)?.name ?? '',
  set: (name: string) => updateActivePromptPreset(activeModuleId.value, { name })
});
const activePositivePromptModel = computed({
  get: () => resolveActivePromptPreset(activeModuleId.value)?.positivePrompt ?? '',
  set: (positivePrompt: string) => updateActivePromptPreset(activeModuleId.value, { positivePrompt })
});
const activeNegativePromptModel = computed({
  get: () => resolveActivePromptPreset(activeModuleId.value)?.negativePrompt ?? '',
  set: (negativePrompt: string) => updateActivePromptPreset(activeModuleId.value, { negativePrompt })
});
const activeDefaultNegativePromptModel = computed({
  get: () => resolveActivePromptPreset(activeModuleId.value)?.defaultNegativePrompt ?? '',
  set: (defaultNegativePrompt: string) => updateActivePromptPreset(activeModuleId.value, { defaultNegativePrompt })
});
const activeOnlineChatTemplateModel = computed({
  get: () => resolveActivePromptPreset(activeModuleId.value)?.onlineChatTemplate ?? '',
  set: (onlineChatTemplate: string) => updateActivePromptPreset(activeModuleId.value, { onlineChatTemplate })
});
const activeVoomTemplateModel = computed({
  get: () => resolveActivePromptPreset(activeModuleId.value)?.voomTemplate ?? '',
  set: (voomTemplate: string) => updateActivePromptPreset(activeModuleId.value, { voomTemplate })
});

function setActivePromptPreset(moduleId: ImageModuleId, presetId: string) {
  const settings = getPromptSettings(moduleId);
  const nextPreset = settings.promptPresets.find((preset) => preset.id === presetId);
  if (!nextPreset) return;

  updatePromptSettings(moduleId, {
    ...settings,
    activePromptPresetId: nextPreset.id,
    positivePrompt: nextPreset.positivePrompt,
    negativePrompt: nextPreset.negativePrompt
  });
}

function updateActivePromptPreset(moduleId: ImageModuleId, updates: Partial<ImagePromptPreset>) {
  const settings = getPromptSettings(moduleId);
  const activePreset = resolveActivePromptPreset(moduleId);
  if (!activePreset) return;

  const nextPromptPresets = settings.promptPresets.map((preset) => {
    if (preset.id !== activePreset.id) return preset;
    return {
      ...preset,
      ...updates
    };
  });
  const nextActivePreset = nextPromptPresets.find((preset) => preset.id === activePreset.id) ?? activePreset;

  updatePromptSettings(moduleId, {
    ...settings,
    promptPresets: nextPromptPresets,
    activePromptPresetId: nextActivePreset.id,
    positivePrompt: nextActivePreset.positivePrompt,
    negativePrompt: nextActivePreset.negativePrompt
  });
}

function addPromptPreset(moduleId: ImageModuleId) {
  const settings = getPromptSettings(moduleId);
  const nextPreset = {
    id: createId('prompt_preset'),
    name: `预设 ${settings.promptPresets.length + 1}`,
    positivePrompt: settings.positivePrompt,
    negativePrompt: settings.negativePrompt,
    defaultNegativePrompt: resolveActivePromptPreset(moduleId)?.defaultNegativePrompt ?? '',
    onlineChatTemplate: resolveActivePromptPreset(moduleId)?.onlineChatTemplate ?? '',
    voomTemplate: resolveActivePromptPreset(moduleId)?.voomTemplate ?? ''
  };

  updatePromptSettings(moduleId, {
    ...settings,
    activePromptPresetId: nextPreset.id,
    promptPresets: [...settings.promptPresets, nextPreset],
    positivePrompt: nextPreset.positivePrompt,
    negativePrompt: nextPreset.negativePrompt
  });
}

function removePromptPreset(moduleId: ImageModuleId) {
  const settings = getPromptSettings(moduleId);
  if (settings.promptPresets.length <= 1) {
    previewState[moduleId] = 'error';
    moduleFeedback[moduleId] = '至少保留一个提示词预设。';
    return;
  }

  const activePreset = resolveActivePromptPreset(moduleId);
  if (!activePreset) return;

  const activeIndex = settings.promptPresets.findIndex((preset) => preset.id === activePreset.id);
  const nextPromptPresets = settings.promptPresets.filter((preset) => preset.id !== activePreset.id);
  const fallbackIndex = Math.max(0, activeIndex - 1);
  const nextActivePreset = nextPromptPresets[fallbackIndex] ?? nextPromptPresets[0];

  updatePromptSettings(moduleId, {
    ...settings,
    activePromptPresetId: nextActivePreset.id,
    promptPresets: nextPromptPresets,
    positivePrompt: nextActivePreset.positivePrompt,
    negativePrompt: nextActivePreset.negativePrompt
  });

  previewState[moduleId] = 'success';
  moduleFeedback[moduleId] = '已删除当前提示词预设。';
}

function openVendorCreator() {
  editingVendorId.value = null;
  vendorDraft.value = cloneVendor(createImageApiVendor({
    enabled: true,
    name: 'OpenAI Images',
    apiUrl: '',
    apiPath: '/images/generations',
    preferBase64ImageResponse: true
  }));
  activeVendorTab.value = 'provider';
  vendorSyncState.value = 'idle';
  vendorSyncFeedback.value = '';
  showVendorComposer.value = true;
}

function openVendorEditor(vendor: ApiVendor) {
  editingVendorId.value = vendor.id;
  vendorDraft.value = cloneVendor(vendor);
  activeVendorTab.value = 'provider';
  vendorSyncState.value = 'idle';
  vendorSyncFeedback.value = '';
  showVendorComposer.value = true;
}

async function pullVendorModels() {
  vendorSyncState.value = 'loading';
  vendorSyncFeedback.value = '';
  try {
    const modelIds = await fetchVendorModels(vendorDraft.value);
    vendorDraft.value = mergeImageVendorModels(vendorDraft.value, modelIds);
    vendorSyncState.value = 'success';
    vendorSyncFeedback.value = modelIds.length ? `已同步 ${modelIds.length} 个模型。` : '接口返回为空，未发现可用模型。';
    activeVendorTab.value = 'models';
  } catch (error) {
    vendorSyncState.value = 'error';
    vendorSyncFeedback.value = error instanceof Error ? error.message : '图片模型同步失败，请检查 API 配置。';
  }
}

function scheduleNovelAiSelfCheck() {
  if (novelAiCheckTimer) window.clearTimeout(novelAiCheckTimer);

  if (activeModuleId.value !== 'novelai') return;
  if (!draft.value.imageNovelAi.apiKey.trim()) {
    novelAiSyncState.value = 'idle';
    novelAiSyncFeedback.value = '填写 Token 后自动检测连接与生图入口。';
    return;
  }

  novelAiCheckTimer = window.setTimeout(() => {
    void refreshNovelAiSelfCheck();
  }, 450);
}

async function refreshNovelAiSelfCheck() {
  novelAiSyncState.value = 'loading';
  novelAiSyncFeedback.value = '正在检测 NovelAI 鉴权、生图入口与模型列表。';

  try {
    const normalizedSettings = normalizeAppSettings(draft.value);
    await checkNovelAiImageAccess(normalizedSettings);
    const models = await fetchNovelAiModels(normalizedSettings);
    const nextModel = models.some((model) => model.id === draft.value.imageNovelAi.model)
      ? draft.value.imageNovelAi.model
      : models[0]?.id ?? draft.value.imageNovelAi.model;

    draft.value = normalizeAppSettings({
      ...draft.value,
      imageNovelAi: {
        ...draft.value.imageNovelAi,
        availableModels: models,
        model: nextModel
      }
    });
    novelAiSyncState.value = 'success';
    novelAiSyncFeedback.value = normalizedSettings.imageNovelAi.endpointMode === 'custom'
      ? `第三方代理配置已就绪，已准备 ${models.length} 个模型；Token 将在实际生图时校验。`
      : `鉴权通过，生图入口可达，已准备 ${models.length} 个模型。`;
  } catch (error) {
    novelAiSyncState.value = 'error';
    novelAiSyncFeedback.value = error instanceof Error ? error.message : 'NovelAI 生图接口预检失败，请检查 Token 或连接方式。';
  }
}

watch(
  () => [
    activeModuleId.value,
    draft.value.imageNovelAi.endpointMode,
    draft.value.imageNovelAi.customProxyUrl,
    draft.value.imageNovelAi.apiKey,
    draft.value.imageNovelAi.model
  ],
  scheduleNovelAiSelfCheck,
  { immediate: true }
);

function schedulePollinationsSelfCheck() {
  if (pollinationsCheckTimer) window.clearTimeout(pollinationsCheckTimer);

  if (activeModuleId.value !== 'pollinations') return;
  if (!draft.value.imagePollinations.apiKey.trim()) {
    pollinationsSyncState.value = 'idle';
    pollinationsSyncFeedback.value = '填写 API Key 后自动检测模型列表与生图入口。';
    return;
  }
  if (!draft.value.imagePollinations.model.trim()) {
    pollinationsSyncState.value = 'idle';
    pollinationsSyncFeedback.value = '选择模型后自动检测图片接口。';
    return;
  }

  pollinationsCheckTimer = window.setTimeout(() => {
    void refreshPollinationsSelfCheck();
  }, 650);
}

async function refreshPollinationsSelfCheck() {
  pollinationsSyncState.value = 'loading';
  pollinationsSyncFeedback.value = '正在检测 Pollinations 模型列表与图片入口。';

  try {
    const models = await fetchPollinationsModels();
    const nextModel = models.some((model) => model.id === draft.value.imagePollinations.model)
      ? draft.value.imagePollinations.model
      : models[0]?.id ?? draft.value.imagePollinations.model;

    const nextSettings = normalizeAppSettings({
      ...draft.value,
      imagePollinations: {
        ...draft.value.imagePollinations,
        availableModels: models,
        model: nextModel
      }
    });

    await checkPollinationsImageAccess(nextSettings);
    draft.value = nextSettings;
    pollinationsSyncState.value = 'success';
    pollinationsSyncFeedback.value = `图片入口可达，已准备 ${models.length} 个模型。`;
  } catch (error) {
    pollinationsSyncState.value = 'error';
    pollinationsSyncFeedback.value = error instanceof Error ? error.message : 'Pollinations 图片接口检测失败。';
  }
}

watch(
  () => [
    activeModuleId.value,
    draft.value.imagePollinations.apiKey,
    draft.value.imagePollinations.referrer,
    draft.value.imagePollinations.model,
    draft.value.imagePollinations.width,
    draft.value.imagePollinations.height,
    draft.value.imagePollinations.safe,
    draft.value.imagePollinations.quality,
    draft.value.imagePollinations.referenceImage,
    draft.value.imagePollinations.transparent
  ],
  schedulePollinationsSelfCheck,
  { immediate: true }
);

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

function imageVendorModelSummary(vendor: ApiVendor) {
  const selected = vendor.models.find((model) => model.selected);
  if (selected) return selected.nickname || selected.id;
  if (vendor.models[0]) return `${vendor.models.length} models`;
  return '尚未同步模型';
}

function saveVendor() {
  const cleanedModels = vendorDraft.value.models
    .map((model): ApiVendorModel => ({
      id: model.id.trim(),
      nickname: model.nickname.trim(),
      selected: model.selected
    }))
    .filter((model) => model.id);

  const nextVendor = createImageApiVendor({
    ...vendorDraft.value,
    name: vendorDraft.value.name.trim() || 'OpenAI Images',
    avatar: vendorDraft.value.avatar.trim(),
    apiUrl: vendorDraft.value.apiUrl.trim(),
    apiPath: vendorDraft.value.apiPath.trim() || '/images/generations',
    models: cleanedModels.length
      ? cleanedModels.map((model, index) => ({
        ...model,
        selected: cleanedModels.some((item) => item.selected)
          ? model.selected
          : index === 0
      }))
      : []
  });

  const remainingVendors = draft.value.imageOpenAi.vendors.filter((vendor) => vendor.id !== nextVendor.id);
  const nextVendors = [nextVendor, ...remainingVendors];

  draft.value = normalizeAppSettings({
    ...draft.value,
    imageOpenAi: {
      ...draft.value.imageOpenAi,
      vendors: nextVendors
    }
  });
  showVendorComposer.value = false;
}

function removeVendor() {
  if (!editingVendorId.value) return;

  const nextVendors = draft.value.imageOpenAi.vendors.filter((vendor) => vendor.id !== editingVendorId.value);
  const nextActiveVendorId = draft.value.imageOpenAi.activeVendorId === editingVendorId.value
    ? ''
    : draft.value.imageOpenAi.activeVendorId;

  draft.value = normalizeAppSettings({
    ...draft.value,
    imageOpenAi: {
      ...draft.value.imageOpenAi,
      activeVendorId: nextActiveVendorId,
      vendors: nextVendors
    }
  });
  showVendorComposer.value = false;
}
</script>

<style scoped>
.image-module-configurator,
.composer-shell,
.provider-composer,
.composer-section,
.form-grid {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.image-module-configurator *,
.image-module-configurator *::before,
.image-module-configurator *::after {
  min-width: 0;
}

.image-module-configurator button {
  max-width: 100%;
  line-height: 1.2;
  overflow-wrap: anywhere;
  white-space: normal;
}

.provider-composer {
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.composer-hero,
.empty-shell {
  position: relative;
  overflow: hidden;
}

.composer-hero {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(255, 209, 224, 0.65), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 248, 252, 0.94));
}

.composer-hero-novelai {
  background:
    radial-gradient(circle at top left, rgba(244, 221, 198, 0.72), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(249, 246, 242, 0.94));
}

.composer-hero-pollinations {
  background:
    radial-gradient(circle at top right, rgba(215, 231, 255, 0.78), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(247, 249, 255, 0.94));
}

.provider-hero {
  grid-template-columns: 56px minmax(0, 1fr);
  align-items: center;
}

.provider-hero .provider-avatar {
  grid-column: auto;
  grid-row: auto;
  width: 56px;
  height: 56px;
  border-radius: 20px;
}

.section-kicker,
.composer-hero span,
.sync-copy span {
  margin: 0;
  color: #9d7a86;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}

.section-head h3 {
  margin: 0;
  color: #231f25;
  font-family: var(--app-current-font-family);
  font-size: 15px;
  line-height: 1.2;
  font-weight: 800;
  overflow: hidden;
  overflow-wrap: normal;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-hero strong {
  display: block;
  margin: 0;
  color: #111111;
  font-family: inherit;
  font-size: 18px;
  line-height: 1.18;
  font-weight: 800;
}

.composer-hero p,
.field-hint,
.provider-copy p,
.empty-shell p,
.module-feedback,
.toggle-card small {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.module-feedback.error {
  color: #cf425a;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.module-feedback.success {
  color: #26774e;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.hero-generate,
.section-action,
.sync-button,
.footer-button {
  display: inline-grid;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  min-width: 0;
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-generate {
  width: 100%;
  background: rgba(243, 244, 245, 0.9);
}

.section-head,
.sync-shell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: nowrap;
  min-width: 0;
}

.section-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
}

.section-head > div,
.sync-copy {
  flex: 1 1 auto;
  min-width: 0;
}

.section-action {
  flex: 0 1 auto;
  background: rgba(243, 244, 245, 0.92);
}

.image-module-configurator :is(.section-action, .preset-action, .sync-button, .footer-button, .composer-tab) {
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}

.provider-list,
.model-grid,
.toggle-grid,
.field-grid,
.provider-copy,
.sync-copy,
.toggle-card div {
  display: grid;
}

.provider-list,
.model-grid,
.toggle-grid,
.field-grid {
  gap: 10px;
}

.provider-card {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 8px 10px;
  align-items: start;
  position: relative;
  padding: 10px 82px 10px 10px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  text-align: left;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.04);
  min-width: 0;
}

.provider-avatar {
  grid-column: 1;
  grid-row: 1;
  width: 44px;
  height: 44px;
  border-radius: 15px;
  object-fit: cover;
  background: var(--soft);
}

.provider-copy {
  grid-column: 2;
  grid-row: 1;
  gap: 4px;
  min-width: 0;
}

.provider-copy strong {
  color: #231f25;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.provider-meta {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}

.provider-copy p {
  overflow-wrap: anywhere;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 22px;
  max-width: 100%;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.status-pill.enabled {
  background: rgba(231, 248, 236, 0.96);
  color: #138046;
}

.status-pill.disabled {
  background: rgba(241, 243, 246, 0.96);
  color: #79808a;
}

.empty-shell,
.prompt-preset-shell,
.sync-shell,
.model-option,
.toggle-card,
.vendor-avatar-upload {
  padding: 11px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.035);
}

.novelai-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 248, 247, 0.92));
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.04), 0 12px 26px rgba(31, 26, 21, 0.05);
  overflow: hidden;
}

.novelai-status-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 14px;
  background: rgba(247, 248, 249, 0.95);
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.035);
}

.novelai-status-card div {
  display: grid;
  gap: 3px;
}

.novelai-status-card strong {
  color: #232529;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.novelai-status-card small {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.novelai-status-card > span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  min-width: 48px;
  padding: 0 9px;
  border-radius: 999px;
  background: rgba(232, 235, 239, 0.98);
  color: #676e78;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.novelai-status-card.status-loading > span {
  background: rgba(255, 243, 215, 0.98);
  color: #9b6810;
}

.novelai-status-card.status-success > span {
  background: rgba(225, 247, 232, 0.98);
  color: #137a42;
}

.novelai-status-card.status-error > span {
  background: rgba(255, 234, 238, 0.98);
  color: #c74259;
}

.compact-grid {
  gap: 8px;
}

.novelai-panel .field-grid.two-up.compact-grid {
  grid-template-columns: 1fr;
}

.novelai-panel .field-grid.three-up.compact-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.novelai-panel .field-grid.three-up.compact-grid .field {
  gap: 5px;
}

.novelai-panel .field-grid.three-up.compact-grid .field > span {
  font-size: 11px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.novelai-panel .field-grid.three-up.compact-grid .field input,
.novelai-panel .field-grid.three-up.compact-grid .field select {
  min-height: 44px;
  padding-inline: 10px;
  border-radius: 14px;
  font-size: 13px;
}

.compact-toggle-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.compact-toggle-grid .toggle-card {
  padding: 9px;
  border-radius: 14px;
  gap: 8px;
}

.compact-toggle-grid .toggle-card strong {
  font-size: 12px;
}

.compact-toggle-grid .toggle-card small {
  font-size: 11px;
  line-height: 1.35;
}

.prompt-preset-shell {
  display: grid;
  gap: 14px;
  padding: 14px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(249, 250, 250, 0.9));
}

.prompt-preset-shell .section-head {
  align-items: flex-start;
}

.prompt-preset-shell .field-grid.two-up {
  grid-template-columns: 1fr;
}

.prompt-preset-shell .field {
  gap: 6px;
}

.prompt-preset-shell .field input,
.prompt-preset-shell .field select,
.prompt-preset-shell .field textarea {
  border-radius: 14px;
  background: rgba(247, 248, 249, 0.96);
}

.prompt-preset-shell .field textarea {
  min-height: 128px;
}

.empty-shell strong {
  color: #232529;
  font-size: 13px;
}

.field {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.field > span {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: #686d72;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field input,
.field select,
.field textarea {
  width: 100%;
  min-height: 34px;
  padding: 7px 9px;
  border-radius: 10px;
  background: rgba(243, 244, 245, 0.9);
  color: #17191d;
  font-size: 12px;
  line-height: 1.4;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.035);
  overflow-wrap: anywhere;
}

.field input,
.field select {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field textarea {
  min-height: 104px;
  resize: vertical;
}

.field input::placeholder,
.field textarea::placeholder {
  color: #9b9fa5;
}

.field:focus-within > span {
  color: #16643e;
}

.field:focus-within input,
.field:focus-within select,
.field:focus-within textarea {
  background: #ffffff;
  box-shadow: 0 0 0 1.5px rgba(6, 199, 85, 0.18), 0 12px 24px rgba(27, 81, 52, 0.08);
}

.toggle-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  overflow: hidden;
}

.toggle-card div {
  min-width: 0;
}

.toggle-card strong,
.toggle-card small {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vendor-avatar-upload {
  display: grid;
  gap: 4px;
  min-height: 58px;
}

.vendor-avatar-upload input {
  display: none;
}

.vendor-avatar-upload strong {
  color: #232529;
  font-size: 13px;
  font-weight: 800;
}

.vendor-avatar-upload small {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.45;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle-indicator {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  border: 1.5px solid rgba(146, 150, 158, 0.55);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}

.toggle-input:checked + .toggle-indicator {
  border-color: transparent;
  background: linear-gradient(180deg, #1f2229, #3a3d48);
  box-shadow: 0 0 0 4px rgba(255, 219, 230, 0.58);
}

.toggle-card strong,
.sync-copy strong,
.model-option strong {
  color: #232529;
  font-size: 13px;
  font-weight: 800;
}

.sync-button {
  min-width: 98px;
  background: linear-gradient(180deg, #111111, #2c2f39);
  color: #ffffff;
}

.preset-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
  width: 100%;
}

.preset-action {
  flex: 1 1 calc(50% - 4px);
  min-height: 36px;
  background: rgba(243, 244, 245, 0.92);
}

.persona-card,
.persona-upload-card,
.nickname-card {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
}

.persona-upload-card strong,
.persona-upload-card span {
  display: block;
}

.persona-upload-card strong {
  font-size: 14px;
}

.persona-upload-card span {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}

.persona-upload-card input {
  display: none;
}

.nickname-grid {
  display: grid;
  gap: 10px;
}

.empty-note {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.model-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 11px;
  border: 1px solid transparent;
  text-align: left;
  overflow-wrap: anywhere;
}

.model-option input {
  width: 16px;
  height: 16px;
  margin-top: 2px;
}

.model-option div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.model-option.active {
  border-color: rgba(255, 188, 210, 0.88);
  box-shadow: 0 10px 26px rgba(34, 25, 39, 0.08);
}

.model-option span {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.composer-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.novelai-sync-shell .field {
  flex: 1 1 190px;
}

.composer-tab {
  display: inline-grid;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  min-width: 0;
  padding-inline: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: #6f7079;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-tab.active {
  background: linear-gradient(180deg, #111111, #2c2f39);
  color: #ffffff;
}

.composer-footer {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-self: stretch;
  justify-self: stretch;
  width: 100%;
  min-width: 0;
}

.footer-button {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  border-radius: 16px;
  font-size: 13px;
}

.provider-composer > .composer-section {
  min-height: 0;
  align-content: start;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.footer-cancel {
  background: rgba(255, 255, 255, 0.88);
  color: #44424b;
}

.footer-save {
  background: linear-gradient(180deg, #111111, #2c2f39);
  color: #ffffff;
}

.footer-delete {
  background: rgba(255, 237, 240, 0.94);
  color: #c74259;
}

.compact-empty {
  padding: 16px;
}

@media (min-width: 520px) {
  .provider-card {
    grid-template-columns: 48px minmax(0, 1fr);
    align-items: center;
    padding-right: 92px;
  }

  .provider-avatar {
    width: 48px;
    height: 48px;
    border-radius: 16px;
  }

  .composer-section > .field-grid.two-up,
  .toggle-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .field-grid.three-up {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 360px) {
  .image-module-configurator,
  .composer-shell,
  .composer-section,
  .form-grid {
    gap: 10px;
  }

  .section-head,
  .sync-shell,
  .composer-footer {
    gap: 8px;
  }

  .provider-card {
    grid-template-columns: 40px minmax(0, 1fr);
    padding: 9px 72px 9px 9px;
    border-radius: 16px;
  }

  .provider-avatar {
    width: 40px;
    height: 40px;
    border-radius: 13px;
  }

  .status-pill {
    min-height: 20px;
    padding: 0 7px;
    font-size: 9px;
  }

  .empty-shell,
  .prompt-preset-shell,
  .sync-shell,
  .model-option,
  .toggle-card,
  .vendor-avatar-upload {
    padding: 10px;
    border-radius: 16px;
  }

  .novelai-panel {
    gap: 9px;
    padding: 10px;
    border-radius: 16px;
  }

  .novelai-status-card {
    gap: 8px;
    padding: 9px;
    border-radius: 14px;
  }

  .novelai-status-card > span {
    min-width: 42px;
    padding-inline: 8px;
  }

  .novelai-panel .field-grid.three-up.compact-grid {
    gap: 6px;
  }

  .novelai-panel .field-grid.three-up.compact-grid .field > span {
    font-size: 10px;
  }

  .novelai-panel .field-grid.three-up.compact-grid .field input,
  .novelai-panel .field-grid.three-up.compact-grid .field select {
    min-height: 40px;
    padding-inline: 7px;
    border-radius: 12px;
    font-size: 12px;
  }

  .compact-toggle-grid {
    gap: 7px;
  }

  .compact-toggle-grid .toggle-card {
    gap: 7px;
    padding: 8px;
  }

  .compact-toggle-grid .toggle-card strong {
    font-size: 11px;
  }

  .compact-toggle-grid .toggle-card small {
    font-size: 10px;
  }

  .preset-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 100%;
  }

  .composer-footer {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
  }

  .preset-action,
  .footer-button {
    width: 100%;
    padding-inline: 8px;
  }

  .footer-delete {
    grid-column: auto;
  }
}
</style>