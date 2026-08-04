<template>
  <section class="provider-panel">
    <div v-if="vendors.length" class="provider-list">
      <button
        v-for="vendor in vendors"
        :key="vendor.id"
        class="provider-card"
        type="button"
        @click="openEditor(vendor)"
      >
        <img class="provider-avatar" :src="vendor.avatar" :alt="vendor.name" />
        <div class="provider-copy">
          <strong>{{ vendor.name }}</strong>
          <p>{{ getVendorModelSummary(vendor) }}</p>
        </div>
        <div class="provider-meta">
          <span class="status-pill" :class="vendor.enabled ? 'enabled' : 'disabled'">
            {{ vendor.enabled ? 'Enabled' : 'Disabled' }}
          </span>
        </div>
      </button>
    </div>

    <section v-else class="empty-shell">
      <strong>No providers yet</strong>
      <p>点击右上角 + 新建模型供应商</p>
    </section>

    <AppModal v-model="showComposer" :title="editorTitle" :show-header="false" fixed-height variant="ins">
      <form class="provider-composer" @submit.prevent="submit">
        <section class="composer-hero">
          <img class="composer-avatar" :src="draft.avatar" :alt="draft.name || 'Provider avatar'" />
          <div>
            <span>Provider moodboard</span>
            <strong>{{ draft.name || 'OpenAI' }}</strong>
            <p>{{ draft.enabled ? '启动时会自动拉取模型，开盖即食' : '需要时再启用自动拉取' }}</p>
          </div>
        </section>

        <nav class="composer-tabs" aria-label="供应商编辑分栏">
          <button
            v-for="tab in composerTabs"
            :key="tab.id"
            class="composer-tab"
            :class="{ active: activeTab === tab.id }"
            type="button"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </nav>

        <section v-if="activeTab === 'openai'" class="composer-section form-grid">
          <label class="toggle-card">
            <input v-model="draft.enabled" class="toggle-input" type="checkbox" />
            <span class="toggle-indicator" aria-hidden="true"></span>
            <div>
              <strong>启用供应商</strong>
            </div>
          </label>

          <label class="field">
            <span>供应商名称</span>
            <input v-model="draft.name" placeholder="OpenAI / OpenRouter / 自建网关" />
          </label>

          <label class="field">
            <span>API Url</span>
            <input v-model="draft.apiUrl" placeholder="https://api.openai.com/v1 " />
          </label>

          <label class="field">
            <span>API 路径（新手谨慎更改）</span>
            <input v-model="draft.apiPath" placeholder="/chat/completions" />
          </label>

          <label class="field">
            <span>API Key</span>
            <input v-model="draft.apiKey" autocomplete="off" type="password" />
          </label>

          <label class="field">
            <span>流式回复</span>
            <select v-model="draft.streaming">
              <option value="off">关闭（兼容旧接口）</option>
              <option value="auto">自动尝试，失败时回退</option>
              <option value="on">强制开启</option>
            </select>
          </label>
        </section>

        <section v-else-if="activeTab === 'models'" class="composer-section form-grid">
          <div class="sync-shell">
            <div class="sync-copy">
              <span>Model sync</span>
              <strong>点击Sync now拉取模型</strong>
            </div>
            <button class="sync-button" type="button" :disabled="loadingModels" @click="pullModels">
              {{ syncButtonLabel }}
            </button>
          </div>
          <p v-if="modelFeedback" class="sync-feedback" :class="modelState === 'error' ? 'error' : 'success'">
            {{ modelFeedback }}
          </p>

          <template v-if="draft.models.length">
            <label class="field model-search-field">
              <span>搜索模型</span>
              <input v-model="modelSearch" type="search" autocomplete="off" placeholder="输入模型名称或 ID" />
            </label>

            <div v-if="filteredModels.length" class="model-grid">
              <label v-for="model in filteredModels" :key="model.id" class="model-option">
                <input :checked="model.selected" type="checkbox" @change="toggleModel(model.id, $event)" />
                <div>
                  <strong>{{ model.nickname || model.id }}</strong>
                  <span>{{ model.id }}</span>
                </div>
              </label>
            </div>

            <div v-else class="empty-note">未找到匹配的模型，试试其他关键字。</div>
          </template>

          <div v-else class="empty-note">暂无模型，拉取模型后可同时选择多个模型方便后续任意切换</div>
        </section>

        <section v-else class="composer-section form-grid">
          <label class="field persona-card">
            <span>头像 URL</span>
            <input v-model="draft.avatar" placeholder="https://..." />
          </label>

          <label class="persona-upload-card">
            <strong>上传本地头像</strong>
            <span>支持用本地图片覆盖当前供应商头像。</span>
            <input type="file" accept="image/*" @change="readAvatarFile" />
          </label>

          <div v-if="selectedModels.length" class="nickname-grid">
            <label v-for="model in selectedModels" :key="model.id" class="field nickname-card">
              <span>{{ model.id }} 备注</span>
              <input :value="model.nickname" placeholder="例如：哈基米/小克" @input="updateNickname(model.id, $event)" />
            </label>
          </div>

          <div v-else class="empty-note">暂时未选择任何模型</div>
        </section>

        <div class="composer-footer">
          <button class="footer-button footer-delete" type="button" :disabled="!editingVendorId" @click="removeVendor">
            删除供应商
          </button>
          <button class="footer-button footer-cancel" type="button" @click="showComposer = false">取消</button>
          <button class="footer-button footer-save" type="submit">保存</button>
        </div>
      </form>
    </AppModal>

    <AvatarCropperModal v-model="showAvatarEditor" :src="avatarEditorSource" @confirm="applyEditedAvatar" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppModal from '@/components/common/AppModal.vue';
import AvatarCropperModal from '@/components/image/AvatarCropperModal.vue';
import type { ApiVendor, ApiVendorModel, AppSettings } from '@/types/domain';
import { fetchVendorModels } from '@/services/ai';
import { readImageFileFromInput } from '@/utils/imageFile';
import { createApiVendor, getSelectedVendorModelCount, mergeVendorModels, normalizeAppSettings } from '@/utils/settings';

const props = defineProps<{
  settings: AppSettings;
  openComposerTick?: number;
}>();

const emit = defineEmits<{
  save: [settings: AppSettings];
}>();

const composerTabs = [
  { id: 'openai', label: 'openai' },
  { id: 'models', label: '选择模型' },
  { id: 'personalize', label: '个性化' }
] as const;

type ComposerTab = (typeof composerTabs)[number]['id'];

const showComposer = ref(false);
const activeTab = ref<ComposerTab>('openai');
const loadingModels = ref(false);
const modelState = ref<'idle' | 'loading' | 'success' | 'error'>('idle');
const modelFeedback = ref('');
const modelSearch = ref('');
const editingVendorId = ref<string | null>(null);
const draft = ref<ApiVendor>(createApiVendor({ enabled: true }));
const showAvatarEditor = ref(false);
const avatarEditorSource = ref('');

const vendors = computed(() => props.settings.apiVendors);
const selectedModels = computed(() => draft.value.models.filter((model) => model.selected));
const filteredModels = computed(() => {
  const keyword = modelSearch.value.trim().toLocaleLowerCase();
  if (!keyword) return draft.value.models;
  return draft.value.models.filter((model) => [model.id, model.nickname].some((value) => value.toLocaleLowerCase().includes(keyword)));
});
const editorTitle = computed(() => (editingVendorId.value ? 'Edit Provider' : 'Add Provider'));
const syncButtonLabel = computed(() => ({
  idle: 'Sync now',
  loading: 'Syncing',
  success: 'Synced',
  error: 'Retry sync'
}[modelState.value]));

function getVendorModelSummary(vendor: ApiVendor) {
  const count = getSelectedVendorModelCount(vendor);
  return `${count} ${count === 1 ? 'model' : 'models'} selected`;
}

watch(
  () => props.openComposerTick,
  (nextTick, previousTick) => {
    if (nextTick === undefined || nextTick === previousTick) return;
    openCreator();
  }
);

function cloneVendor(vendor?: ApiVendor) {
  return createApiVendor({
    ...vendor,
    models: vendor?.models.map((model) => ({ ...model })) ?? []
  });
}

function openCreator() {
  editingVendorId.value = null;
  draft.value = cloneVendor(createApiVendor({
    enabled: true,
    name: 'OpenAI',
    apiUrl: '',
    apiPath: '/chat/completions'
  }));
  activeTab.value = 'openai';
  modelState.value = 'idle';
  modelFeedback.value = '';
  modelSearch.value = '';
  showComposer.value = true;
}

function openEditor(vendor: ApiVendor) {
  editingVendorId.value = vendor.id;
  draft.value = cloneVendor(vendor);
  activeTab.value = 'openai';
  modelState.value = 'idle';
  modelFeedback.value = '';
  modelSearch.value = '';
  showComposer.value = true;
}

async function pullModels() {
  loadingModels.value = true;
  modelState.value = 'loading';
  modelFeedback.value = '';
  try {
    const modelIds = await fetchVendorModels(draft.value);
    draft.value = mergeVendorModels(draft.value, modelIds);
    modelState.value = 'success';
    modelFeedback.value = modelIds.length ? `已同步 ${modelIds.length} 个模型。` : '接口返回为空，未发现可用模型。';
    activeTab.value = 'models';
  } catch (error) {
    modelState.value = 'error';
    modelFeedback.value = error instanceof Error ? error.message : '模型同步失败，请检查 API 配置。';
  } finally {
    loadingModels.value = false;
  }
}

function removeVendor() {
  if (!editingVendorId.value) return;

  emit('save', normalizeAppSettings({
    ...props.settings,
    apiVendors: props.settings.apiVendors.filter((vendor) => vendor.id !== editingVendorId.value)
  }));
  showComposer.value = false;
}

function toggleModel(modelId: string, event: Event) {
  const input = event.target as HTMLInputElement;
  draft.value = {
    ...draft.value,
    models: draft.value.models.map((model) => model.id === modelId ? { ...model, selected: input.checked } : model)
  };
}

function updateNickname(modelId: string, event: Event) {
  const input = event.target as HTMLInputElement;
  draft.value = {
    ...draft.value,
    models: draft.value.models.map((model) => model.id === modelId ? { ...model, nickname: input.value } : model)
  };
}

async function readAvatarFile(event: Event) {
  const image = await readImageFileFromInput(event);
  if (!image) return;
  avatarEditorSource.value = image;
  showAvatarEditor.value = true;
}

function applyEditedAvatar(value: string) {
  draft.value = {
    ...draft.value,
    avatar: value
  };
}

function submit() {
  const cleanedModels = draft.value.models
    .map((model): ApiVendorModel => ({
      id: model.id.trim(),
      nickname: model.nickname.trim(),
      selected: model.selected
    }))
    .filter((model) => model.id);

  const nextVendor = createApiVendor({
    ...draft.value,
    name: draft.value.name.trim() || 'OpenAI',
    apiUrl: draft.value.apiUrl.trim(),
    apiPath: draft.value.apiPath.trim() || '/chat/completions',
    avatar: draft.value.avatar.trim(),
    models: cleanedModels
  });

  const remainingVendors = props.settings.apiVendors.filter((vendor) => vendor.id !== nextVendor.id);
  emit('save', normalizeAppSettings({
    ...props.settings,
    apiVendors: [nextVendor, ...remainingVendors]
  }));
  showComposer.value = false;
}
</script>

<style scoped>
.provider-panel {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.provider-list {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.provider-card {
  --provider-avatar-size: 56px;

  display: grid;
  grid-template-columns: var(--provider-avatar-size) minmax(0, 1fr) max-content;
  gap: 12px;
  align-items: center;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  padding: 14px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 248, 251, 0.96));
  box-shadow: 0 12px 32px rgba(26, 30, 38, 0.06);
  overflow: hidden;
  text-align: left;
}

.provider-avatar {
  width: var(--provider-avatar-size);
  height: var(--provider-avatar-size);
  border-radius: 20px;
  object-fit: cover;
  background: var(--soft);
}

.composer-avatar {
  width: 56px;
  height: 56px;
  border-radius: 20px;
  object-fit: cover;
  background: var(--soft);
}

.provider-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
  overflow: hidden;
}

.provider-copy strong,
.provider-copy p {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-copy strong,
.provider-copy p {
  margin: 0;
}

.provider-copy strong {
  font-size: 16px;
  font-weight: 800;
}

.provider-copy p,
.empty-shell p,
.empty-note {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.provider-meta {
  display: grid;
  justify-items: end;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.status-pill.enabled {
  background: #e7f8ec;
  color: #138046;
}

.status-pill.disabled {
  background: #f1f3f6;
  color: #79808a;
}

.empty-shell {
  display: grid;
  gap: 8px;
  padding: 20px;
  border: 1px dashed rgba(17, 17, 17, 0.1);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.75);
}

.empty-shell strong,
.composer-hero strong {
  font-size: 18px;
  font-weight: 800;
}

.provider-composer {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 16px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.composer-hero {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 12px;
  padding: 14px;
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(255, 209, 224, 0.65), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 248, 252, 0.94));
}

.composer-hero > div,
.sync-copy,
.model-option div,
.nickname-card {
  min-width: 0;
}

.composer-hero span,
.composer-hero strong {
  display: block;
  margin: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-hero p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.composer-hero span {
  color: #9d7a86;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.composer-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.composer-tab {
  min-height: 40px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: #6f7079;
  font-size: 12px;
  font-weight: 800;
}

.composer-tab.active {
  background: linear-gradient(180deg, #111111, #2c2f39);
  color: #ffffff;
}

.composer-section {
  min-height: 0;
  align-content: start;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.toggle-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
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

.toggle-card div {
  display: grid;
}

.toggle-card strong {
  font-size: 14px;
}

.sync-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(245, 247, 250, 0.92));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95);
}

.sync-copy {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.sync-copy span {
  color: #9d7a86;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sync-copy strong {
  font-size: 15px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-feedback {
  margin: 0;
  color: #26774e;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.sync-feedback.error {
  color: #cf425a;
}

.sync-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 16px;
  justify-self: end;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(20, 20, 20, 0.96), rgba(44, 47, 57, 0.96));
  color: #ffffff;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}

.sync-button:disabled {
  opacity: 0.72;
  cursor: wait;
}

.model-grid,
.nickname-grid {
  display: grid;
  gap: 10px;
}

.model-search-field {
  gap: 6px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
}

.model-search-field span {
  color: #9d7a86;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.model-search-field input {
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: inherit;
}

.model-search-field input:focus {
  outline: none;
}

.model-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
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

.model-option strong {
  font-size: 14px;
}

.model-option span {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}

.model-option strong,
.model-option span,
.nickname-card > span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.empty-note {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.composer-footer {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-self: end;
}

.footer-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 42px;
  padding: 0 10px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 800;
}

.footer-delete {
  background: linear-gradient(180deg, #fff3f5, #ffe8ee);
  color: #cf4a68;
}

.footer-delete:disabled {
  opacity: 0.42;
  cursor: default;
}

.footer-cancel {
  background: rgba(255, 255, 255, 0.88);
  color: #4f535b;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.94);
}

.footer-save {
  background: linear-gradient(180deg, #1f2229, #3a3d48);
  color: #ffffff;
}

@media (max-width: 360px) {
  .provider-card {
    --provider-avatar-size: 44px;

    gap: 8px;
    padding: 12px;
  }

  .provider-avatar {
    border-radius: 16px;
  }

  .provider-copy strong {
    font-size: 15px;
  }

  .provider-copy p {
    font-size: 11px;
    line-height: 1.3;
  }

  .status-pill {
    min-height: 24px;
    padding: 0 8px;
    font-size: 10px;
  }
}
</style>