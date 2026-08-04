<template>
  <AppModal :model-value="modelValue" title="分享 Stickers" :show-header="false" variant="ins" @update:model-value="updateModalValue">
    <section class="share-modal">
      <div class="modal-head">
        <div>
          <p class="modal-kicker">Sticker Share</p>
          <h3>选择要导出的贴纸分组</h3>
        </div>
        <span class="mode-badge">PNG 分享包</span>
      </div>

      <p class="share-note">会生成一张可预览的 PNG，并将分组和贴纸图片一并封装。请以原文件或原图发送；截图、压缩转图会破坏导入数据。</p>

      <section class="group-picker">
        <label class="group-option group-option-all">
          <input :checked="allSelected" type="checkbox" :disabled="disabled || !groups.length" @change="toggleAll" />
          <span class="checkmark"></span>
          <span class="group-copy"><strong>全部分组</strong><small>{{ groups.length }} 个分组 · {{ totalStickerCount }} 张贴纸</small></span>
        </label>
        <label v-for="group in groups" :key="group.id" class="group-option">
          <input :checked="selectedGroupIds.includes(group.id)" type="checkbox" :disabled="disabled" @change="toggleGroup(group.id)" />
          <span class="checkmark"></span>
          <span class="group-copy"><strong>{{ group.name }}</strong><small>{{ group.stickerCount }} 张贴纸</small></span>
        </label>
      </section>

      <p v-if="feedback" class="feedback">{{ feedback }}</p>

      <div class="modal-actions">
        <button class="secondary-ghost" type="button" :disabled="disabled" @click="updateModalValue(false)">取消</button>
        <button class="secondary-ghost" type="button" :disabled="disabled || !selectedGroupIds.length" @click="emit('save', selectedGroupIds)">
          <span>{{ disabled ? '正在生成' : '保存 PNG' }}</span>
        </button>
        <button class="save-button" type="button" :disabled="disabled || !selectedGroupIds.length" @click="emit('submit', selectedGroupIds)">
          <span>{{ disabled ? '正在生成' : '分享 PNG' }}</span>
        </button>
      </div>
    </section>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppModal from '@/components/common/AppModal.vue';

export interface StickerShareGroupOption {
  id: string;
  name: string;
  stickerCount: number;
}

const props = defineProps<{
  modelValue: boolean;
  groups: StickerShareGroupOption[];
  defaultGroupId?: string;
  feedback: string;
  disabled: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [groupIds: string[]];
  submit: [groupIds: string[]];
}>();

const selectedGroupIds = ref<string[]>([]);
const totalStickerCount = computed(() => props.groups.reduce((total, group) => total + group.stickerCount, 0));
const allSelected = computed(() => Boolean(props.groups.length) && props.groups.every((group) => selectedGroupIds.value.includes(group.id)));

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    const defaultGroupExists = props.groups.some((group) => group.id === props.defaultGroupId);
    selectedGroupIds.value = defaultGroupExists && props.defaultGroupId ? [props.defaultGroupId] : props.groups.map((group) => group.id);
  }
);

watch(
  () => props.groups,
  (groups) => {
    const availableIds = new Set(groups.map((group) => group.id));
    selectedGroupIds.value = selectedGroupIds.value.filter((groupId) => availableIds.has(groupId));
  },
  { deep: true }
);

function updateModalValue(value: boolean) {
  if (props.disabled && !value) return;
  emit('update:modelValue', value);
}

function toggleAll() {
  if (props.disabled) return;
  selectedGroupIds.value = allSelected.value ? [] : props.groups.map((group) => group.id);
}

function toggleGroup(groupId: string) {
  if (props.disabled) return;
  selectedGroupIds.value = selectedGroupIds.value.includes(groupId)
    ? selectedGroupIds.value.filter((id) => id !== groupId)
    : [...selectedGroupIds.value, groupId];
}
</script>

<style scoped>
.share-modal {
  display: grid;
  gap: 12px;
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.modal-kicker,
.share-note {
  margin: 0;
  color: #8f8790;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.modal-head h3 {
  margin: 4px 0 0;
  color: #2a242c;
  font-size: 18px;
  line-height: 1.2;
}

.mode-badge {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  color: #2a242c;
  font-size: 11px;
  font-weight: 800;
}

.share-note,
.feedback {
  color: #6a636a;
  font-size: 12px;
  line-height: 1.55;
  letter-spacing: normal;
  text-transform: none;
}

.group-picker {
  display: grid;
  max-height: min(42vh, 360px);
  overflow-y: auto;
  border: 1px solid rgba(31, 27, 34, 0.07);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
}

.group-option {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 58px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(31, 27, 34, 0.06);
  cursor: pointer;
}

.group-option:last-child {
  border-bottom: 0;
}

.group-option-all {
  background: rgba(250, 239, 245, 0.8);
}

.group-option input {
  position: absolute;
  opacity: 0;
}

.checkmark {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: 1.5px solid rgba(44, 37, 45, 0.24);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.9);
}

.group-option input:checked + .checkmark {
  border-color: #111111;
  background: #111111;
}

.group-option input:checked + .checkmark::after {
  width: 7px;
  height: 4px;
  border-bottom: 1.8px solid #ffffff;
  border-left: 1.8px solid #ffffff;
  content: '';
  transform: rotate(-45deg) translate(1px, -1px);
}

.group-option input:focus-visible + .checkmark {
  outline: 2px solid rgba(185, 93, 124, 0.6);
  outline-offset: 2px;
}

.group-option input:disabled ~ * {
  opacity: 0.45;
}

.group-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.group-copy strong {
  overflow: hidden;
  color: #2a242c;
  font-size: 13px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-copy small {
  color: #837984;
  font-size: 11px;
}

.feedback {
  margin: 0;
  color: #8a495c;
}

.modal-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.secondary-ghost,
.save-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 800;
}

.secondary-ghost {
  background: rgba(17, 17, 17, 0.08);
  color: #251f26;
}

.save-button {
  background: #111111;
  color: #ffffff;
}

.secondary-ghost:disabled,
.save-button:disabled {
  opacity: 0.4;
}
</style>