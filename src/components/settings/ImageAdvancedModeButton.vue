<template>
  <button
    class="image-advanced-mode-button"
    :class="{ active: advancedModeEnabled }"
    type="button"
    :aria-label="buttonLabel"
    :title="buttonLabel"
    @click="showModal = true"
  >
    <Sparkles :size="18" stroke-width="2.4" />
  </button>

  <AppModal v-model="showModal" title="生图高级模式" variant="ins">
    <section class="advanced-mode-panel">
      <div class="advanced-mode-copy">
        <span>Visual direction</span>
        <strong>生图高级模式</strong>
        <p>{{ advancedModeEnabled ? '已开启：先让“总结、图谱、视觉导演模型”理解人物、场景、服装与镜头，再调用生图模型。会多一次文本请求与等待。' : '已关闭：直接调用生图模型，不调用视觉导演，因此更快，也不会增加文本请求。' }}</p>
      </div>
      <label class="advanced-mode-switch">
        <input :checked="advancedModeEnabled" type="checkbox" @change="updateAdvancedMode" />
        <span class="advanced-mode-switch-track" aria-hidden="true"><i></i></span>
        <span>{{ advancedModeEnabled ? '开启' : '关闭' }}</span>
      </label>
    </section>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Sparkles } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import { useAppStore } from '@/stores/appStore';
import { normalizeAppSettings } from '@/utils/settings';

const store = useAppStore();
const showModal = ref(false);
const advancedModeEnabled = computed(() => store.settings?.imageAdvancedModeEnabled ?? true);
const buttonLabel = computed(() => `生图高级模式：${advancedModeEnabled.value ? '已开启' : '已关闭'}`);

async function updateAdvancedMode(event: Event) {
  const settings = store.settings;
  if (!settings) return;
  await store.saveSettings(normalizeAppSettings({
    ...settings,
    imageAdvancedModeEnabled: (event.target as HTMLInputElement).checked
  }));
}
</script>

<style scoped>
.image-advanced-mode-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 34px;
  width: 34px;
  min-height: 34px;
  padding: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: #68716b;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.image-advanced-mode-button.active {
  background: linear-gradient(145deg, #1a9d5d, #0b7442);
  color: #ffffff;
  box-shadow: 0 8px 18px rgba(22, 137, 80, 0.25);
}

.advanced-mode-panel {
  display: grid;
  gap: 18px;
  padding-top: 4px;
}

.advanced-mode-copy {
  display: grid;
  gap: 6px;
}

.advanced-mode-copy > span {
  color: #638274;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.advanced-mode-copy strong {
  color: #17261e;
  font-size: 16px;
}

.advanced-mode-copy p {
  margin: 0;
  color: #5e6e65;
  font-size: 12px;
  line-height: 1.65;
}

.advanced-mode-switch {
  display: inline-grid;
  grid-template-columns: auto auto;
  align-items: center;
  justify-self: start;
  gap: 9px;
  color: #246f49;
  font-size: 12px;
  font-weight: 900;
}

.advanced-mode-switch input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.advanced-mode-switch-track {
  width: 44px;
  height: 26px;
  padding: 3px;
  border-radius: 999px;
  background: #c9d1cc;
  box-shadow: inset 0 0 0 1px rgba(23, 38, 30, 0.08);
  cursor: pointer;
  transition: background 0.18s ease;
}

.advanced-mode-switch-track i {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(20, 39, 30, 0.2);
  transition: transform 0.18s ease;
}

.advanced-mode-switch input:checked + .advanced-mode-switch-track {
  background: #1e9b5e;
}

.advanced-mode-switch input:checked + .advanced-mode-switch-track i {
  transform: translateX(18px);
}

.advanced-mode-switch input:focus-visible + .advanced-mode-switch-track {
  outline: 3px solid rgba(30, 155, 94, 0.24);
  outline-offset: 3px;
}
</style>