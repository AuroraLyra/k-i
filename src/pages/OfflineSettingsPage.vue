<template>
  <section v-if="conversation && character" class="screen no-tabs offline-settings-page">
    <header class="offline-settings-topbar">
      <button class="settings-icon-button" type="button" aria-label="返回线下模式" @click="goBack">
        <ArrowLeft :size="21" />
      </button>
      <div class="settings-title-block">
        <span>chapter preset</span>
        <h1>线下设置</h1>
      </div>
      <div class="settings-avatar-wrap">
        <img :src="character.avatar" :alt="characterDisplayName" />
      </div>
    </header>

    <main ref="settingsMainRef" class="offline-settings-main">
      <section class="settings-hero">
        <div class="settings-hero-kicker">
          <span>the offline edit</span>
          <em>vol. 01</em>
        </div>
        <div class="settings-hero-title">
          <div>
            <small><span class="settings-hero-for-label">for</span> {{ characterDisplayName }}</small>
            <strong>Chapter<br />Studio</strong>
          </div>
          <span aria-hidden="true">✦</span>
        </div>
        <p>把叙事视角、角色边界与文字气质整理成这一章的专属配方。</p>
        <div class="settings-hero-tags" aria-hidden="true">
          <span>narrative</span>
          <span>character</span>
          <span>tone</span>
        </div>
      </section>

      <section v-if="activeTab === 'enhance'" class="settings-section" aria-label="描写增强">
        <h2>描写增强</h2>
        <label v-for="item in toggleItems" :key="item.key" class="toggle-row">
          <span>
            <strong>{{ item.label }}</strong>
            <small>{{ item.description }}</small>
          </span>
          <input :checked="Boolean(offlineSettings[item.key])" type="checkbox" @change="updateToggle(item.key, $event)" />
        </label>
      </section>

      <template v-if="activeTab === 'guidance'">
      <section v-for="group in offlineGuidanceGroups" :key="group.id" class="settings-section" :aria-label="group.title">
        <h2>{{ group.title }}</h2>
        <p class="setting-note">{{ group.description }}</p>
        <label v-for="item in group.items" :key="item.key" class="toggle-row">
          <span>
            <strong>{{ item.label }}</strong>
            <small>{{ item.description }}</small>
          </span>
          <input :checked="Boolean(offlineSettings[item.key])" type="checkbox" @change="updateToggle(item.key, $event)" />
        </label>
      </section>
      </template>

      <template v-if="activeTab === 'structure'">
      <section class="settings-section" aria-label="章节结构">
        <h2>章节结构</h2>
        <div v-for="block in structureBlocks" :key="block.kind" class="setting-block">
          <div class="setting-block-head">
            <span class="setting-label">{{ block.label }}</span>
            <button class="small-action" type="button" @click="openStructureEditor(block.kind)">
              <Plus :size="13" />
              自定义
            </button>
          </div>
          <div :class="structureControlClass(block.layout)">
            <button v-for="option in block.options" :key="option.id" type="button" :class="{ active: isBuiltInStructureActive(block.kind, option.id) }" @click="applyBuiltInStructure(block.kind, option.id)">
              {{ option.label }}
            </button>
          </div>
          <div v-if="customStructurePresets(block.kind).length" class="structure-custom-list" :aria-label="`${block.label}自定义选项`">
            <article v-for="preset in customStructurePresets(block.kind)" :key="preset.id" class="structure-custom-row">
              <button class="structure-custom-apply" type="button" :class="{ active: isCustomStructureActive(block.kind, preset.id) }" @click="applyCustomStructurePreset(block.kind, preset.id)">
                <strong>{{ preset.name }}</strong>
                <small>{{ isCustomStructureActive(block.kind, preset.id) ? '应用中' : '自定义规则' }}</small>
              </button>
              <button class="structure-custom-action" type="button" @click="openStructureEditor(block.kind, preset)">编辑</button>
              <button class="structure-custom-action structure-custom-action--danger" type="button" aria-label="删除自定义结构选项" @click="deleteCustomStructurePreset(block.kind, preset.id)">
                <Trash2 :size="13" />
              </button>
            </article>
          </div>
          <div v-if="editingStructureKind === block.kind" class="structure-custom-editor">
            <label class="text-field">
              <span>自定义名称</span>
              <input v-model="structureNameDraft" :placeholder="`例如：我的${block.label}`" />
            </label>
            <label class="text-field text-field--textarea">
              <span>完整提示词</span>
              <textarea v-model="structureContentDraft" rows="5" :placeholder="block.placeholder"></textarea>
            </label>
            <div class="structure-editor-actions">
              <button type="button" :disabled="!structureNameDraft.trim() || !structureContentDraft.trim()" @click="saveAndApplyStructurePreset(block.kind)">
                <Check :size="14" />
                保存并应用
              </button>
              <button type="button" @click="closeStructureEditor">取消</button>
            </div>
          </div>
          <p v-if="block.note" class="setting-note">{{ block.note }}</p>
        </div>
      </section>

      <section class="settings-section" aria-label="文字风格">
        <h2>文字规格</h2>
        <label class="text-field">
          <span>正文字数</span>
          <input v-model="wordCountDraft" placeholder="800-1200字" @change="commitTextSetting('wordCount')" @blur="commitTextSetting('wordCount')" />
        </label>
      </section>
      </template>

      <template v-if="activeTab === 'style'">
      <section class="settings-section preset-editor-section" aria-label="写作文风预设">
        <div class="section-title-row">
          <h2>写作文风</h2>
          <button class="small-action" type="button" @click="addPreset('writingStyle')">
            <Plus :size="14" />
            新增
          </button>
        </div>
        <label class="preset-select-field">
          <span>选择文风</span>
          <select :value="selectedWritingStylePresetId" @change="selectPresetFromEvent('writingStyle', $event)">
            <option v-for="preset in writingStylePresets" :key="preset.id" :value="preset.id">
              {{ preset.name }}{{ offlineSettings.writingStylePresetId === preset.id ? ' · 应用中' : '' }}
            </option>
          </select>
        </label>
        <label class="text-field">
          <span>预设名称</span>
          <input v-model="writingStyleNameDraft" placeholder="例如：白描" />
        </label>
        <label class="text-field text-field--textarea">
          <span>预设内容</span>
          <textarea v-model="writingStyleContentDraft" rows="5" placeholder="写下完整文风规则"></textarea>
        </label>
        <div class="preset-actions">
          <button type="button" @click="applyPreset('writingStyle')">
            <Check :size="14" />
            应用
          </button>
          <button type="button" @click="savePreset('writingStyle')">保存</button>
          <button class="danger-action" type="button" :disabled="writingStylePresets.length <= 1" @click="deletePreset('writingStyle')">
            <Trash2 :size="14" />
            删除
          </button>
        </div>
      </section>

      <section class="settings-section preset-editor-section" aria-label="基调预设">
        <div class="section-title-row">
          <h2>基调</h2>
          <button class="small-action" type="button" @click="addPreset('tone')">
            <Plus :size="14" />
            新增
          </button>
        </div>
        <label class="preset-select-field">
          <span>选择基调</span>
          <select :value="selectedTonePresetId" @change="selectPresetFromEvent('tone', $event)">
            <option v-for="preset in tonePresets" :key="preset.id" :value="preset.id">
              {{ preset.name }}{{ offlineSettings.tonePresetId === preset.id ? ' · 应用中' : '' }}
            </option>
          </select>
        </label>
        <label class="text-field">
          <span>预设名称</span>
          <input v-model="toneNameDraft" placeholder="例如：日常" />
        </label>
        <label class="text-field text-field--textarea">
          <span>预设内容</span>
          <textarea v-model="toneContentDraft" rows="5" placeholder="写下完整基调规则，不只是两个字"></textarea>
        </label>
        <div class="preset-actions">
          <button type="button" @click="applyPreset('tone')">
            <Check :size="14" />
            应用
          </button>
          <button type="button" @click="savePreset('tone')">保存</button>
          <button class="danger-action" type="button" :disabled="tonePresets.length <= 1" @click="deletePreset('tone')">
            <Trash2 :size="14" />
            删除
          </button>
        </div>
      </section>
      </template>
    </main>

    <footer class="offline-settings-tabs" aria-label="线下设置分类">
      <button v-for="tab in tabs" :key="tab.id" type="button" :class="{ active: activeTab === tab.id }" :aria-pressed="activeTab === tab.id" @click="selectTab(tab.id)">
        <component :is="tab.icon" :size="18" :stroke-width="1.9" />
        <span>{{ tab.label }}</span>
      </button>
    </footer>
  </section>
  <section v-else class="screen no-tabs empty-state">会话不存在</section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Check, Feather, Layers3, Plus, SlidersHorizontal, Trash2, UserRoundPen } from 'lucide-vue-next';
import { offlineGuidanceGroups, type OfflineGuidanceSettingKey } from '@/data/offlineGuidance';
import { useAppStore } from '@/stores/appStore';
import type { ConversationOfflineSettings, OfflineInterruptionMode, OfflineParagraphMode, OfflinePerspective, OfflinePromptPreset, OfflineRetellMode, OfflineStructureKind } from '@/types/domain';
import { getCharacterDisplayName } from '@/utils/character';
import { createId } from '@/utils/id';

const props = defineProps<{
  id: string;
}>();

type SettingsTab = 'enhance' | 'guidance' | 'structure' | 'style';

const tabs: Array<{ id: SettingsTab; label: string; icon: typeof SlidersHorizontal }> = [
  { id: 'enhance', label: '描写增强', icon: SlidersHorizontal },
  { id: 'guidance', label: '角色引导', icon: UserRoundPen },
  { id: 'structure', label: '章节结构', icon: Layers3 },
  { id: 'style', label: '文风基调', icon: Feather }
];

const paragraphOptions: Array<{ id: OfflineParagraphMode; label: string }> = [
  { id: 'long', label: '长段落' },
  { id: 'short', label: '短段落' },
  { id: 'mixed', label: '交错' }
];

const perspectiveOptions: Array<{ id: OfflinePerspective; label: string }> = [
  { id: 'omniscient-third', label: '上帝视角第三人称' },
  { id: 'character-third', label: '角色第三人称' },
  { id: 'character-second', label: '角色第二人称' },
  { id: 'user-first', label: '用户第一人称' },
  { id: 'user-second', label: '用户第二人称' }
];

const interruptionOptions: Array<{ id: OfflineInterruptionMode; label: string }> = [
  { id: 'advance', label: '抢话' },
  { id: 'strict', label: '不抢话' }
];

const retellOptions: Array<{ id: OfflineRetellMode; label: string }> = [
  { id: 'retell', label: '转述' },
  { id: 'direct', label: '不转述' }
];

type StructureOptionId = OfflineParagraphMode | OfflinePerspective | OfflineInterruptionMode | OfflineRetellMode;
type StructureControlLayout = 'two' | 'three' | 'grid';

const structurePlaceholders: Record<OfflineStructureKind, string> = {
  paragraph: '写下段落长度与切分规则，例如每段承担什么功能、何时长段、何时短段、禁止哪些灌水方式。可使用 {{char}} 和 {{user}} 作为角色名占位符。',
  perspective: '写下叙事视角规则，例如人称、镜头距离、能进入谁的内心、哪些信息必须留白。可使用 {{char}} 和 {{user}}。',
  interruption: '写下剧情拓展规则，例如是否允许代接用户动作、哪些低风险内容可补、哪些关键决定绝不能代替。',
  retell: '写下转述规则，例如是否承接用户最新输入、承接到什么程度、如何避免重复和擅自改写。'
};

const structureBlocks: Array<{ kind: OfflineStructureKind; label: string; layout: StructureControlLayout; options: Array<{ id: StructureOptionId; label: string }>; note?: string; placeholder: string }> = [
  { kind: 'paragraph', label: '段落长度', layout: 'three', options: paragraphOptions, placeholder: structurePlaceholders.paragraph },
  { kind: 'perspective', label: '叙事视角', layout: 'grid', options: perspectiveOptions, placeholder: structurePlaceholders.perspective },
  { kind: 'interruption', label: '剧情拓展', layout: 'two', options: interruptionOptions, placeholder: structurePlaceholders.interruption },
  { kind: 'retell', label: '转述方式', layout: 'two', options: retellOptions, note: '转述会在章节前原样承接用户输出，并润色扩写动作、行为、神情和话语。', placeholder: structurePlaceholders.retell }
];

type EnhanceSettingKey = keyof Pick<ConversationOfflineSettings, 'enhanceAppearance' | 'enhanceOutfit' | 'expandLength' | 'characterPsychology'>;
type OfflineToggleKey = EnhanceSettingKey | OfflineGuidanceSettingKey;

const toggleItems: Array<{ key: EnhanceSettingKey; label: string; description: string }> = [
  { key: 'enhanceAppearance', label: '增强外貌描写', description: '更细地写神态、距离、光线下的外貌细节' },
  { key: 'enhanceOutfit', label: '增强服饰描写', description: '把衣着、材质、穿搭状态自然写入场景' },
  { key: 'expandLength', label: '增加对话篇幅', description: '扩展互动、环境和动作过渡' },
  { key: 'characterPsychology', label: '角色心理活动', description: '加入角色当下的真实心理和情绪余波' }
];

const store = useAppStore();
const router = useRouter();
const conversation = computed(() => store.conversationById(props.id));
const character = computed(() => {
  if (!conversation.value) return undefined;
  if (conversation.value.kind !== 'group') return store.characterById(conversation.value.charId);
  return conversation.value.groupMembers?.flatMap((member) => member.identityType === 'character' && member.identityId ? [store.characterById(member.identityId)] : []).find(Boolean);
});
const characterDisplayName = computed(() => conversation.value?.kind === 'group' ? conversation.value.title : character.value ? getCharacterDisplayName(character.value) : '');
const chatSettings = computed(() => store.settingsForConversation(props.id));
const offlineSettings = computed(() => chatSettings.value.offline);
const writingStylePresets = computed(() => offlineSettings.value.writingStylePresets);
const tonePresets = computed(() => offlineSettings.value.tonePresets);
const activeTab = ref<SettingsTab>('enhance');
const wordCountDraft = ref('');
const selectedWritingStylePresetId = ref('');
const selectedTonePresetId = ref('');
const writingStyleNameDraft = ref('');
const writingStyleContentDraft = ref('');
const toneNameDraft = ref('');
const toneContentDraft = ref('');
const settingsMainRef = ref<HTMLElement | null>(null);
const editingStructureKind = ref<OfflineStructureKind | null>(null);
const editingStructurePresetId = ref('');
const structureNameDraft = ref('');
const structureContentDraft = ref('');

type PresetKind = 'writingStyle' | 'tone';

function fallbackPreset(kind: PresetKind) {
  const presets = kind === 'writingStyle' ? writingStylePresets.value : tonePresets.value;
  const activeId = kind === 'writingStyle' ? offlineSettings.value.writingStylePresetId : offlineSettings.value.tonePresetId;
  return presets.find((preset) => preset.id === activeId) ?? presets[0];
}

function selectedPreset(kind: PresetKind) {
  const selectedId = kind === 'writingStyle' ? selectedWritingStylePresetId.value : selectedTonePresetId.value;
  const presets = kind === 'writingStyle' ? writingStylePresets.value : tonePresets.value;
  return presets.find((preset) => preset.id === selectedId) ?? fallbackPreset(kind);
}

function syncPresetDraft(kind: PresetKind) {
  const preset = selectedPreset(kind);
  if (!preset) return;
  if (kind === 'writingStyle') {
    selectedWritingStylePresetId.value = preset.id;
    writingStyleNameDraft.value = preset.name;
    writingStyleContentDraft.value = preset.content;
    return;
  }
  selectedTonePresetId.value = preset.id;
  toneNameDraft.value = preset.name;
  toneContentDraft.value = preset.content;
}

function syncDrafts() {
  wordCountDraft.value = offlineSettings.value.wordCount;
  syncPresetDraft('writingStyle');
  syncPresetDraft('tone');
}

onMounted(() => {
  void store.hydrate().then(syncDrafts);
});

watch(() => props.id, syncDrafts);
watch(offlineSettings, syncDrafts);

function updateOfflineSettings(patch: Partial<ConversationOfflineSettings>) {
  void store.saveConversationSettings({
    ...chatSettings.value,
    offline: {
      ...offlineSettings.value,
      ...patch
    }
  });
}

function updateToggle(key: OfflineToggleKey, event: Event) {
  updateOfflineSettings({ [key]: (event.target as HTMLInputElement).checked });
}

function structureControlClass(layout: StructureControlLayout) {
  return {
    'segmented-control': layout !== 'grid',
    'segmented-control--three': layout === 'three',
    'option-grid': layout === 'grid',
    'structure-option-list': true
  };
}

function customStructurePresets(kind: OfflineStructureKind) {
  return offlineSettings.value.customStructurePresets[kind];
}

function activeCustomStructurePresetId(kind: OfflineStructureKind) {
  return offlineSettings.value.activeCustomStructurePresetIds[kind];
}

function currentBuiltInStructureValue(kind: OfflineStructureKind) {
  if (kind === 'paragraph') return offlineSettings.value.paragraphMode;
  if (kind === 'perspective') return offlineSettings.value.perspective;
  if (kind === 'interruption') return offlineSettings.value.interruptionMode;
  return offlineSettings.value.retellMode;
}

function isBuiltInStructureActive(kind: OfflineStructureKind, optionId: StructureOptionId) {
  return !activeCustomStructurePresetId(kind) && currentBuiltInStructureValue(kind) === optionId;
}

function isCustomStructureActive(kind: OfflineStructureKind, presetId: string) {
  return activeCustomStructurePresetId(kind) === presetId;
}

function updateStructureBuiltIn(kind: OfflineStructureKind, patch: Partial<ConversationOfflineSettings>) {
  updateOfflineSettings({
    ...patch,
    activeCustomStructurePresetIds: {
      ...offlineSettings.value.activeCustomStructurePresetIds,
      [kind]: ''
    }
  });
}

function applyBuiltInStructure(kind: OfflineStructureKind, optionId: StructureOptionId) {
  if (kind === 'paragraph') {
    updateStructureBuiltIn(kind, { paragraphMode: optionId as OfflineParagraphMode });
    return;
  }
  if (kind === 'perspective') {
    updateStructureBuiltIn(kind, { perspective: optionId as OfflinePerspective });
    return;
  }
  if (kind === 'interruption') {
    updateStructureBuiltIn(kind, { interruptionMode: optionId as OfflineInterruptionMode });
    return;
  }
  updateStructureBuiltIn(kind, { retellMode: optionId as OfflineRetellMode });
}

function openStructureEditor(kind: OfflineStructureKind, preset?: OfflinePromptPreset) {
  editingStructureKind.value = kind;
  editingStructurePresetId.value = preset?.id ?? '';
  structureNameDraft.value = preset?.name ?? `自定义${structureBlocks.find((block) => block.kind === kind)?.label ?? '结构'}`;
  structureContentDraft.value = preset?.content ?? '';
}

function closeStructureEditor() {
  editingStructureKind.value = null;
  editingStructurePresetId.value = '';
  structureNameDraft.value = '';
  structureContentDraft.value = '';
}

function saveAndApplyStructurePreset(kind: OfflineStructureKind) {
  if (editingStructureKind.value !== kind) return;
  const name = structureNameDraft.value.trim();
  const content = structureContentDraft.value.trim();
  if (!name || !content) return;
  const preset: OfflinePromptPreset = {
    id: editingStructurePresetId.value || createId(`structure-${kind}`),
    name,
    content
  };
  const presets = customStructurePresets(kind);
  const nextPresets = presets.some((item) => item.id === preset.id)
    ? presets.map((item) => (item.id === preset.id ? preset : item))
    : [...presets, preset];
  updateOfflineSettings({
    customStructurePresets: {
      ...offlineSettings.value.customStructurePresets,
      [kind]: nextPresets
    },
    activeCustomStructurePresetIds: {
      ...offlineSettings.value.activeCustomStructurePresetIds,
      [kind]: preset.id
    }
  });
  closeStructureEditor();
}

function applyCustomStructurePreset(kind: OfflineStructureKind, presetId: string) {
  updateOfflineSettings({
    activeCustomStructurePresetIds: {
      ...offlineSettings.value.activeCustomStructurePresetIds,
      [kind]: presetId
    }
  });
}

function deleteCustomStructurePreset(kind: OfflineStructureKind, presetId: string) {
  const nextPresets = customStructurePresets(kind).filter((preset) => preset.id !== presetId);
  updateOfflineSettings({
    customStructurePresets: {
      ...offlineSettings.value.customStructurePresets,
      [kind]: nextPresets
    },
    activeCustomStructurePresetIds: {
      ...offlineSettings.value.activeCustomStructurePresetIds,
      [kind]: activeCustomStructurePresetId(kind) === presetId ? '' : activeCustomStructurePresetId(kind)
    }
  });
  if (editingStructureKind.value === kind && editingStructurePresetId.value === presetId) closeStructureEditor();
}

async function selectTab(tab: SettingsTab) {
  activeTab.value = tab;
  await nextTick();
  settingsMainRef.value?.scrollTo({ top: 0, behavior: 'auto' });
}

function commitTextSetting(key: 'wordCount') {
  const value = wordCountDraft.value.trim();
  updateOfflineSettings({ [key]: value });
}

function selectPreset(kind: PresetKind, presetId: string) {
  if (kind === 'writingStyle') {
    selectedWritingStylePresetId.value = presetId;
  } else {
    selectedTonePresetId.value = presetId;
  }
  syncPresetDraft(kind);
}

function selectPresetFromEvent(kind: PresetKind, event: Event) {
  selectPreset(kind, (event.target as HTMLSelectElement).value);
}

function presetDraft(kind: PresetKind) {
  return kind === 'writingStyle'
    ? { name: writingStyleNameDraft.value.trim() || '未命名文风', content: writingStyleContentDraft.value.trim() || '请补充这个写作文风的完整规则。' }
    : { name: toneNameDraft.value.trim() || '未命名基调', content: toneContentDraft.value.trim() || '请补充这个剧情基调的完整规则。' };
}

function savePreset(kind: PresetKind) {
  const preset = selectedPreset(kind);
  if (!preset) return;
  const drafts = presetDraft(kind);
  const presets = kind === 'writingStyle' ? writingStylePresets.value : tonePresets.value;
  const nextPresets = presets.map((item) => (item.id === preset.id ? { ...item, ...drafts } : item));
  updateOfflineSettings(kind === 'writingStyle' ? { writingStylePresets: nextPresets } : { tonePresets: nextPresets });
}

function addPreset(kind: PresetKind) {
  const preset: OfflinePromptPreset = kind === 'writingStyle'
    ? { id: createId('style'), name: '新文风', content: '写下这套文风的完整规则，例如叙述密度、对白比例、描写方式和节奏。' }
    : { id: createId('tone'), name: '新基调', content: '写下这套基调的完整规则，例如情绪温度、关系张力、推进速度和留白方式。' };
  if (kind === 'writingStyle') {
    selectedWritingStylePresetId.value = preset.id;
    updateOfflineSettings({ writingStylePresets: [...writingStylePresets.value, preset] });
  } else {
    selectedTonePresetId.value = preset.id;
    updateOfflineSettings({ tonePresets: [...tonePresets.value, preset] });
  }
}

function applyPreset(kind: PresetKind) {
  const preset = selectedPreset(kind);
  if (!preset) return;
  const drafts = presetDraft(kind);
  const presets = kind === 'writingStyle' ? writingStylePresets.value : tonePresets.value;
  const nextPresets = presets.map((item) => (item.id === preset.id ? { ...item, ...drafts } : item));
  updateOfflineSettings(kind === 'writingStyle'
    ? { writingStylePresets: nextPresets, writingStylePresetId: preset.id }
    : { tonePresets: nextPresets, tonePresetId: preset.id });
}

function deletePreset(kind: PresetKind) {
  const preset = selectedPreset(kind);
  const presets = kind === 'writingStyle' ? writingStylePresets.value : tonePresets.value;
  if (!preset || presets.length <= 1) return;
  const nextPresets = presets.filter((item) => item.id !== preset.id);
  const nextActiveId = kind === 'writingStyle'
    ? offlineSettings.value.writingStylePresetId === preset.id ? nextPresets[0].id : offlineSettings.value.writingStylePresetId
    : offlineSettings.value.tonePresetId === preset.id ? nextPresets[0].id : offlineSettings.value.tonePresetId;
  if (kind === 'writingStyle') {
    selectedWritingStylePresetId.value = nextActiveId;
    updateOfflineSettings({ writingStylePresets: nextPresets, writingStylePresetId: nextActiveId });
  } else {
    selectedTonePresetId.value = nextActiveId;
    updateOfflineSettings({ tonePresets: nextPresets, tonePresetId: nextActiveId });
  }
}

function goBack() {
  const backPath = window.history.state?.back;
  if (typeof backPath === 'string' && backPath.startsWith(`/offline/${props.id}`) && !backPath.includes('/settings')) {
    router.back();
    return;
  }
  void router.replace({ name: 'offline-room', params: { id: props.id } });
}
</script>

<style scoped>
.offline-settings-page {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 0;
  color: #282328;
  background:
    linear-gradient(145deg, rgba(255, 230, 238, 0.78), rgba(246, 242, 255, 0.68) 44%, rgba(239, 251, 245, 0.8)),
    #fbf8fa;
}

.offline-settings-topbar {
  position: relative;
  z-index: 10;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 38px;
  align-items: center;
  gap: 10px;
  padding: calc(10px + var(--safe-top)) calc(14px + var(--safe-right)) 10px calc(14px + var(--safe-left));
  border-bottom: 1px solid rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.66);
  -webkit-backdrop-filter: blur(22px);
  backdrop-filter: blur(22px);
}

.settings-icon-button,
.settings-avatar-wrap {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 10px 24px rgba(77, 58, 71, 0.08);
}

.settings-avatar-wrap img {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  object-fit: cover;
}

.settings-title-block {
  display: grid;
  justify-items: center;
  gap: 2px;
  min-width: 0;
}

.settings-title-block span {
  color: #b28b99;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
}

.settings-title-block h1 {
  margin: 0;
  color: #211d21;
  font-size: 17px;
  font-weight: 900;
  line-height: 1.15;
}

.offline-settings-main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  display: grid;
  align-content: start;
  gap: 12px;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 14px calc(14px + var(--safe-right)) 14px calc(14px + var(--safe-left));
}

.settings-hero,
.settings-section {
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: 0 18px 44px rgba(96, 74, 88, 0.1);
}

.settings-hero {
  display: grid;
  gap: 4px;
  padding: 16px;
}

.settings-hero span {
  color: #b28b99;
  font-size: 11px;
  font-weight: 900;
}

.settings-hero strong {
  color: #211d21;
  font-size: 24px;
  font-weight: 900;
  line-height: 1.05;
}

.settings-hero p {
  margin: 2px 0 0;
  color: #8f858c;
  font-size: 12px;
  line-height: 1.5;
}

.settings-section {
  display: grid;
  gap: 10px;
  padding: 14px;
}

.settings-section h2 {
  margin: 0 0 2px;
  color: #342d34;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.2;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.small-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(182, 154, 166, 0.24);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.76);
  color: #302a30;
  font-size: 12px;
  font-weight: 900;
}

.toggle-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 10px 0;
  border-top: 1px solid rgba(46, 37, 43, 0.08);
}

.toggle-row:first-of-type {
  border-top: 0;
}

.toggle-row span {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.toggle-row strong,
.text-field span,
.setting-label {
  color: #302a30;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.2;
}

.toggle-row small {
  color: #92878e;
  font-size: 11px;
  line-height: 1.35;
}

.toggle-row input[type='checkbox'] {
  width: 42px;
  height: 24px;
  border-radius: 999px;
  appearance: none;
  background: rgba(48, 42, 48, 0.16);
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.72);
  transition: background 0.16s ease;
}

.toggle-row input[type='checkbox']::before {
  display: block;
  width: 20px;
  height: 20px;
  margin: 2px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 4px 10px rgba(47, 37, 45, 0.18);
  content: '';
  transition: transform 0.16s ease;
}

.toggle-row input[type='checkbox']:checked {
  background: #262126;
}

.toggle-row input[type='checkbox']:checked::before {
  transform: translateX(18px);
}

.setting-block,
.text-field,
.preset-select-field {
  display: grid;
  gap: 8px;
}

.setting-note {
  margin: -2px 0 0;
  color: #92878e;
  font-size: 11px;
  font-weight: 760;
  line-height: 1.45;
}

.preset-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.preset-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 38px;
  padding: 6px 8px;
  border: 1px solid rgba(182, 154, 166, 0.24);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: #302a30;
  font-size: 12px;
  font-weight: 900;
}

.preset-actions button:first-child {
  border-color: #262126;
  background: #262126;
  color: #ffffff;
}

.preset-actions .danger-action {
  color: #a64d5b;
}

.preset-actions button:disabled {
  opacity: 0.42;
}

.segmented-control,
.option-grid,
.tone-grid {
  display: grid;
  gap: 7px;
}

.segmented-control {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.segmented-control--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.option-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.tone-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.segmented-control button,
.option-grid button,
.tone-grid button {
  min-height: 38px;
  padding: 6px 8px;
  border: 1px solid rgba(182, 154, 166, 0.24);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.68);
  color: #695d65;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.25;
}

.segmented-control button.active,
.option-grid button.active,
.tone-grid button.active {
  border-color: #262126;
  background: #262126;
  color: #ffffff;
}

.text-field input,
.text-field textarea,
.preset-select-field select {
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid rgba(182, 154, 166, 0.24);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: #262126;
  font-size: 13px;
  font-weight: 800;
}

.preset-select-field span {
  color: #302a30;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.2;
}

.preset-select-field select {
  appearance: none;
  background:
    linear-gradient(45deg, transparent 50%, #6b6068 50%) calc(100% - 18px) 52% / 6px 6px no-repeat,
    linear-gradient(135deg, #fff, rgba(255, 255, 255, 0.72));
  color: #262126;
}

.text-field textarea {
  min-height: 96px;
  resize: vertical;
  padding: 10px 12px;
  line-height: 1.45;
}

.preset-editor-section {
  gap: 12px;
}

.text-field input::placeholder,
.text-field textarea::placeholder {
  color: #aaa0a7;
}

.offline-settings-tabs {
  position: relative;
  flex: 0 0 auto;
  z-index: 18;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 9px calc(12px + var(--safe-right)) calc(9px + var(--safe-bottom)) calc(12px + var(--safe-left));
  border-top: 1px solid rgba(255, 255, 255, 0.66);
  background: rgba(255, 255, 255, 0.78);
  -webkit-backdrop-filter: blur(22px);
  backdrop-filter: blur(22px);
}

.offline-settings-tabs button {
  display: grid;
  place-items: center;
  gap: 3px;
  min-width: 0;
  min-height: 48px;
  padding: 5px 4px;
  border: 1px solid rgba(182, 154, 166, 0.22);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.64);
  color: #71666e;
  font-size: 11px;
  font-weight: 900;
}

.offline-settings-tabs button.active {
  border-color: #262126;
  background: #262126;
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(38, 33, 38, 0.16);
}

.offline-settings-tabs span {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<style scoped src="@/styles/offlineSettingsKorean.css"></style>