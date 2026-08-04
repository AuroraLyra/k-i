<template>
  <AppModal :model-value="modelValue" title="导入 Stickers" :show-header="false" variant="ins" @update:model-value="emit('update:modelValue', $event)">
    <section class="import-modal">
      <div class="modal-head">
        <div>
          <p class="modal-kicker">Sticker Import</p>
          <h3>选择导入方式与目标分组</h3>
        </div>
        <span class="mode-badge">{{ modeLabelMap[activeTab] }}</span>
      </div>

      <nav class="tab-row" aria-label="Stickers 导入方式">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-pill"
          :class="{ active: activeTab === tab.id }"
          type="button"
          @click="emit('update:activeTab', tab.id)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <div class="target-row" :class="{ 'has-file': activeTab === 'file' }">
        <label class="field">
          <span>导入到分组</span>
          <select :value="selectedGroupId" @change="emit('update:selectedGroupId', ($event.target as HTMLSelectElement).value)">
            <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.name }}</option>
          </select>
        </label>

        <section v-if="activeTab === 'file'" class="file-card">
          <span class="field-label">上传文件</span>
          <label class="file-button">
            选择文件
            <input :accept="fileAccept" multiple type="file" @change="emitFiles" />
          </label>
        </section>
      </div>

      <section class="create-group-card">
        <span class="field-label">添加分组</span>
        <div class="create-group-row">
          <input
            :value="newGroupName"
            aria-label="新分组名称"
            placeholder="新分组名称"
            @input="emit('update:newGroupName', ($event.target as HTMLInputElement).value)"
            @keydown.enter.prevent="newGroupName.trim() && emit('create-group')"
          />
          <button class="mini-button" type="button" :disabled="!newGroupName.trim()" @click="emit('create-group')">添加</button>
        </div>
      </section>

      <label v-if="activeTab === 'url'" class="field grow">
        <span>URL 内容</span>
        <textarea
          :value="textValue"
          placeholder="每行一条，支持“描述 + 图片链接”或 JSON。"
          @input="emit('update:textValue', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>

      <section v-if="selectedFiles.length" class="file-list">
        <strong>已选择 {{ selectedFiles.length }} 个文件</strong>
        <p>{{ selectedFiles.map((file) => file.name).join('、') }}</p>
      </section>

      <p class="import-note">{{ helperMap[activeTab] }}</p>
      <p v-if="feedback" class="feedback">{{ feedback }}</p>

      <div class="modal-actions">
        <button class="secondary-ghost" type="button" @click="emit('update:modelValue', false)">取消</button>
        <button class="save-button" type="button" :disabled="disabled" @click="emit('submit')">导入</button>
      </div>
    </section>
  </AppModal>
</template>

<script setup lang="ts">
import AppModal from '@/components/common/AppModal.vue';
import type { StickerGroup } from '@/types/domain';

export type StickerImportTab = 'url' | 'file';

const props = defineProps<{
  modelValue: boolean;
  activeTab: StickerImportTab;
  groups: StickerGroup[];
  selectedGroupId: string;
  textValue: string;
  selectedFiles: File[];
  newGroupName: string;
  feedback: string;
  disabled: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'update:activeTab': [tab: StickerImportTab];
  'update:selectedGroupId': [groupId: string];
  'update:textValue': [value: string];
  'update:selectedFiles': [files: File[]];
  'update:newGroupName': [value: string];
  'create-group': [];
  submit: [];
}>();

const tabs: Array<{ id: StickerImportTab; label: string }> = [
  { id: 'url', label: 'URL 导入' },
  { id: 'file', label: '文件导入' }
];

const modeLabelMap: Record<StickerImportTab, string> = {
  url: '链接文本',
  file: '文件文本'
};

const helperMap: Record<StickerImportTab, string> = {
  url: '支持逐行或连续粘贴，描述和图片链接之间可用中文/英文分号、空格或多空格分隔。',
  file: '支持 TXT、DOC、DOCX、JSON 与本地图片；收到的 BabyLink Stickers 分享 PNG 可直接选择，分组和图片会一并导入。'
};

const fileAccept = 'image/*,.txt,.json,.doc,.docx,text/plain,application/json,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function emitFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  emit('update:selectedFiles', Array.from(input.files ?? []));
}
</script>

<style scoped>
.import-modal {
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
.field-label,
.import-note {
  margin: 0;
  color: #8f8790;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.modal-head h3,
.file-list strong {
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

.tab-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.tab-pill {
  width: 100%;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #6a636a;
  font-size: 12px;
  font-weight: 800;
}

.tab-pill.active {
  background: #111111;
  color: #ffffff;
}

.target-row {
  display: grid;
  gap: 8px;
}

.target-row.has-file {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
}

.target-row.has-file > * {
  min-width: 0;
}

.field,
.file-card,
.create-group-card,
.file-list {
  display: grid;
  gap: 6px;
  padding: 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.74);
}

.field span {
  color: #6f6870;
  font-size: 12px;
  font-weight: 800;
}

.field select,
.field textarea,
.create-group-row input {
  border-radius: 12px;
  background: rgba(242, 243, 246, 0.96);
  color: #251f26;
  padding: 10px 12px;
}

.create-group-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px;
  gap: 8px;
}

.create-group-row > * {
  min-width: 0;
}

.field textarea {
  min-height: 180px;
  resize: vertical;
}

.field.grow {
  min-height: 0;
}

.file-card {
  align-content: space-between;
}

.file-card p,
.file-list p,
.feedback,
.import-note {
  margin: 0;
  color: #6a636a;
  font-size: 12px;
  line-height: 1.5;
}

.file-button,
.mini-button,
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

.file-button {
  position: relative;
  width: 100%;
  background: rgba(17, 17, 17, 0.08);
  color: #171319;
}

.mini-button {
  background: #111111;
  color: #ffffff;
}

.mini-button:disabled {
  opacity: 0.4;
}

.file-button input {
  position: absolute;
  inset: 0;
  opacity: 0;
}

.feedback {
  color: #6e4d57;
}

.modal-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.secondary-ghost {
  background: rgba(17, 17, 17, 0.08);
  color: #251f26;
}

.save-button {
  background: #111111;
  color: #ffffff;
}

.save-button:disabled {
  opacity: 0.4;
}
</style>
