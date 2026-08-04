<template>
  <button class="image-model-button" :class="{ 'with-label': showLabel }" type="button" :aria-label="buttonLabel" :title="buttonLabel" @click="showPicker = true">
    <SlidersHorizontal :size="iconSize" stroke-width="2.4" />
    <span v-if="showLabel">{{ compactSelectedLabel }}</span>
  </button>

  <AppModal v-model="showPicker" title="生图模型" :show-header="false" variant="ins">
    <section class="image-model-switch-panel form-grid">
      <label v-for="scope in imageModelScopes" :key="scope.id" class="field model-select-field">
        <span>{{ scope.label }}</span>
        <div class="model-select-shell">
          <span v-if="selectedModelMeta(scope.id)" class="model-select-vendor">{{ selectedModelMeta(scope.id)?.providerLabel }}</span>
          <select :value="selectionValueFor(scope.id)" :class="{ 'with-provider': selectedModelMeta(scope.id) }" @change="updateImageModel(scope.id, $event)">
            <option value="">跟随可用默认生图模型</option>
            <option :value="disabledImageModelSelectionValue">关闭生图</option>
            <optgroup v-for="group in groupedImageModels" :key="`${scope.id}-${group.id}`" :label="group.label">
              <option v-for="option in group.options" :key="`${scope.id}-${option.key}`" :value="option.key">
                {{ option.label }}{{ option.detail ? ` · ${option.detail}` : '' }}
              </option>
            </optgroup>
          </select>
        </div>
      </label>

      <section v-if="!imageModelOptions.length" class="picker-empty">
        <strong>暂无可切换模型</strong>
        <p>先在 Image 页面配置 OpenAI 图片供应商、NovelAI 或 Pollinations。</p>
      </section>
    </section>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { SlidersHorizontal } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import { useAppStore } from '@/stores/appStore';
import type { AppSettings, ImageModelScope } from '@/types/domain';
import { createImageModelKey, disabledImageModelSelectionValue, getConfiguredImageModelOptions, getSelectedImageModelOption, isImageModelSelectionDisabled, type ConfiguredImageModelOption } from '@/utils/settings';

withDefaults(defineProps<{
  showLabel?: boolean;
  iconSize?: number;
}>(), {
  showLabel: false,
  iconSize: 18
});

const store = useAppStore();
const showPicker = ref(false);

const imageModelScopes: Array<{ id: ImageModelScope; label: string }> = [
  { id: 'voom', label: 'VOOM' },
  { id: 'onlineChat', label: '线上聊天' },
  { id: 'videoCall', label: '视频通话生图' }
];

const imageModelOptions = computed(() => getConfiguredImageModelOptions(store.settings));
const selectedModel = computed(() => getSelectedImageModelOption(store.settings, 'voom'));
const voomImageDisabled = computed(() => isImageModelSelectionDisabled(store.settings?.imageModelOverrides.voom));
const compactSelectedLabel = computed(() => voomImageDisabled.value ? '已关闭' : selectedModel.value?.providerLabel ?? 'Image');
const buttonLabel = computed(() => {
  if (voomImageDisabled.value) return '切换生图模型：VOOM 已关闭生图';
  return selectedModel.value ? `切换生图模型：${selectedModel.value.providerLabel} · ${selectedModel.value.label}` : '切换生图模型';
});
const groupedImageModels = computed(() => {
  const groups = new Map<string, { id: string; label: string; options: ConfiguredImageModelOption[] }>();
  for (const option of imageModelOptions.value) {
    const id = `${option.provider}:${option.detail}`;
    const label = option.detail ? `${option.providerLabel} · ${option.detail}` : option.providerLabel;
    const group = groups.get(id) ?? { id, label, options: [] };
    group.options.push(option);
    groups.set(id, group);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    options: [...group.options].sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'))
  }));
});

function rawSelectionFor(scope: ImageModelScope) {
  return store.settings?.imageModelOverrides[scope] ?? { provider: '', model: '' };
}

function selectionValueFor(scope: ImageModelScope) {
  const selection = rawSelectionFor(scope);
  if (isImageModelSelectionDisabled(selection)) return disabledImageModelSelectionValue;
  const key = selection.provider ? createImageModelKey(selection.provider, selection.model) : '';
  return imageModelOptions.value.some((option) => option.key === key) ? key : '';
}

function selectedModelMeta(scope: ImageModelScope) {
  const value = selectionValueFor(scope);
  return value ? imageModelOptions.value.find((option) => option.key === value) ?? null : null;
}

async function updateImageModel(scope: ImageModelScope, event: Event) {
  const settings = store.settings;
  if (!settings) return;
  const value = (event.target as HTMLSelectElement).value;
  const option = imageModelOptions.value.find((item) => item.key === value) ?? null;
  const disabled = value === disabledImageModelSelectionValue;

  const nextSettings: AppSettings = {
    ...settings,
    imageGenerationEnabled: true,
    imageModelOverrides: {
      ...settings.imageModelOverrides,
      [scope]: {
        provider: option?.provider ?? '',
        model: disabled ? disabledImageModelSelectionValue : option?.model ?? ''
      }
    }
  };

  if (scope === 'voom') {
    nextSettings.voomImageProvider = option?.provider ?? '';
    nextSettings.voomImageModel = disabled ? disabledImageModelSelectionValue : option?.model ?? '';
  }

  if (!option) {
    await store.saveSettings(nextSettings);
    return;
  }

  if (option.provider === 'openai') {
    const [vendorId] = option.model.split('::');
    nextSettings.imageOpenAi = {
      ...settings.imageOpenAi,
      activeVendorId: vendorId || settings.imageOpenAi.activeVendorId
    };
  } else if (option.provider === 'novelai') {
    nextSettings.imageNovelAi = {
      ...settings.imageNovelAi,
      model: option.model
    };
  } else {
    nextSettings.imagePollinations = {
      ...settings.imagePollinations,
      model: option.model
    };
  }

  await store.saveSettings(nextSettings);
}
</script>

<style scoped>
.image-model-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 34px;
  width: 34px;
  min-height: 34px;
  padding: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: #111111;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
  font-size: 13px;
  font-weight: 800;
}

.image-model-button.with-label {
  flex-basis: auto;
  width: auto;
  gap: 6px;
  padding: 0 10px;
}

.image-model-button span {
  max-width: 86px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-model-switch-panel {
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
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 5px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.58);
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

.picker-empty p {
  margin: 0;
  color: #767b82;
  font-size: 12px;
  line-height: 1.45;
}

.picker-empty {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 8px;
  background: #ffffff;
}

.picker-empty strong {
  color: #171717;
  font-size: 14px;
}
</style>