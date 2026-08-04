<template>
  <AppModal :model-value="modelValue" :title="panelTitle" :show-header="false" variant="ins" @update:model-value="emit('update:modelValue', $event)">
    <section class="model-switch-panel form-grid">
      <label v-for="scope in visibleModelScopes" :key="scope.id" class="field model-select-field">
        <span>{{ scope.label }}</span>
        <div class="model-select-shell">
          <img v-if="selectedModelMeta(modelValueFor(scope.id))" :src="selectedModelMeta(modelValueFor(scope.id))?.avatar" :alt="selectedModelMeta(modelValueFor(scope.id))?.vendorName" />
          <span v-if="selectedModelMeta(modelValueFor(scope.id))" class="model-select-vendor">{{ selectedModelMeta(modelValueFor(scope.id))?.vendorName }}</span>
          <select :value="modelValueFor(scope.id)" :class="{ 'with-provider': selectedModelMeta(modelValueFor(scope.id)) }" @change="updateModel(scope.id, $event)">
            <option value="">{{ fallbackLabel(scope.id) }}</option>
            <optgroup v-for="vendor in groupedModels" :key="`${scope.id}-${vendor.id}`" :label="vendorSelectLabel(vendor)">
              <option v-for="model in vendor.models" :key="`${scope.id}-${model.value}`" :value="model.value">
                {{ model.label }}
              </option>
            </optgroup>
          </select>
        </div>
      </label>
    </section>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import AppModal from '@/components/common/AppModal.vue';
import { useAppStore } from '@/stores/appStore';
import type { AppSettings, ChatModelOverrides, ChatModelScope } from '@/types/domain';
import { normalizeAppSettings, normalizeChatModelOverrides } from '@/utils/settings';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  conversationId?: string;
  variant?: 'conversation' | 'global';
}>(), {
  conversationId: '',
  variant: 'conversation'
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const store = useAppStore();
const modelScopes: Array<{ id: ChatModelScope; label: string }> = [
  { id: 'online', label: '线上聊天模型' },
  { id: 'offline', label: '线下 RP 模型' },
  { id: 'summary', label: '总结、图谱、视觉导演模型' },
  { id: 'embedding', label: '向量化模型' },
  { id: 'voom', label: 'VOOM 生成模型' },
  { id: 'theater', label: '小剧场模型' },
  { id: 'content', label: '搜索角色群聊、同人文、商场、音乐评论区、情侣空间模型' }
];
const draft = reactive<ChatModelOverrides>(normalizeChatModelOverrides(null));
const settingsDraft = reactive<AppSettings>(normalizeAppSettings(null));
const isGlobal = computed(() => props.variant === 'global');
const isGroupConversation = computed(() => store.conversationById(props.conversationId)?.kind === 'group');
const visibleModelScopes = computed(() => {
  if (isGlobal.value) return modelScopes;
  const allowedScopes: ChatModelScope[] = isGroupConversation.value
    ? ['online', 'offline', 'summary', 'embedding']
    : ['online', 'offline', 'summary', 'embedding', 'voom', 'theater'];
  return modelScopes.filter((scope) => allowedScopes.includes(scope.id));
});
const panelTitle = computed(() => (isGlobal.value ? '全局模型切换' : '模型切换'));
const currentLocalModelOverrides = computed(() => store.modelOverridesForConversation(props.conversationId));
const currentGlobalSettings = computed(() => normalizeAppSettings(store.settings));

const groupedModels = computed(() => {
  return (store.settings?.apiVendors ?? [])
    .filter((vendor) => vendor.enabled)
    .map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      avatar: vendor.avatar,
      models: vendor.models
        .filter((model) => model.selected)
        .map((model) => ({
          value: `${vendor.id}::${model.id}`,
          label: model.nickname || model.id
        }))
        .sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'))
    }))
    .filter((vendor) => vendor.models.length)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
});

watch(
  () => [props.conversationId, currentLocalModelOverrides.value, props.modelValue] as const,
  () => {
    if (isGlobal.value) return;
    Object.assign(draft, currentLocalModelOverrides.value);
  },
  { immediate: true }
);

watch(
  () => [currentGlobalSettings.value, props.modelValue] as const,
  () => {
    if (!isGlobal.value) return;
    Object.assign(settingsDraft, currentGlobalSettings.value);
  },
  { immediate: true }
);

function modelValueFor(scope: ChatModelScope) {
  const value = isGlobal.value ? settingsDraft.modelOverrides[scope] : draft[scope];
  return groupedModels.value.some((vendor) => vendor.models.some((model) => model.value === value.trim())) ? value.trim() : '';
}

function fallbackLabel(scope: ChatModelScope) {
  if (isGlobal.value) {
    const labels: Record<ChatModelScope, string> = {
      online: '未配置（角色回复时会提示配置模型）',
      offline: '未配置（线下 RP 时会提示配置模型）',
      summary: '未配置（自动记忆与生图高级模式不会调用模型）',
      embedding: '未配置（语义记忆不会调用模型）',
      voom: '未配置（生成 VOOM 时会提示配置模型）',
      theater: '未配置（生成小剧场时会提示配置模型）',
      content: '未配置（内容创作时会提示配置模型）'
    };
    return labels[scope];
  }
  const labels: Record<ChatModelScope, string> = {
    online: '跟随全局线上聊天模型（未配置则报错）',
    offline: '跟随全局线下 RP 模型（未配置则报错）',
    summary: '跟随全局总结、图谱、视觉导演模型（未配置则不调用）',
    embedding: '跟随全局向量化模型（未配置则不调用）',
    voom: '跟随全局 VOOM 生成模型（未配置则报错）',
    theater: '跟随全局小剧场模型（未配置则报错）',
    content: '跟随全局内容创作模型（未配置则报错）'
  };
  return labels[scope];
}

function updateModel(scope: ChatModelScope, event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  if (isGlobal.value) {
    const nextSettings = normalizeAppSettings({
      ...settingsDraft,
      modelOverrides: {
        ...settingsDraft.modelOverrides,
        [scope]: value
      }
    });
    Object.assign(settingsDraft, nextSettings);
    void store.saveSettings(nextSettings);
    return;
  }

  const nextOverrides = normalizeChatModelOverrides({
    ...draft,
    [scope]: value
  });
  Object.assign(draft, nextOverrides);
  void store.saveCharacterModelOverridesForConversation(props.conversationId, nextOverrides);
}

function vendorSelectLabel(vendor: { avatar: string; name: string }) {
  return `${vendor.avatar ? '◉ ' : ''}${vendor.name}`;
}

function selectedModelMeta(value: string) {
  if (!value.trim()) return null;
  const [vendorId, ...modelParts] = value.split('::');
  if (!modelParts.length) return null;
  const vendor = groupedModels.value.find((item) => item.id === vendorId);
  if (!vendor) return null;
  const modelValue = `${vendorId}::${modelParts.join('::')}`;
  const model = vendor.models.find((item) => item.value === modelValue);
  if (!model) return null;
  return {
    avatar: vendor.avatar,
    vendorName: vendor.name,
    modelLabel: model.label
  };
}
</script>

<style scoped>
.model-switch-panel {
  padding-top: 4px;
}

.model-select-field select {
  width: 100%;
  min-height: 42px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.76);
  color: #24201e;
  font-weight: 800;
}

.model-select-shell {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 5px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.58);
}

.model-select-shell img {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  object-fit: cover;
  background: var(--soft);
}

.model-select-vendor {
  max-width: 86px;
  overflow: hidden;
  color: #5f5a56;
  font-size: 12px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-select-shell select:not(.with-provider) {
  grid-column: 1 / -1;
}
</style>