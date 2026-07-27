<template>
  <section class="add-friend-sheet">
    <form v-if="activeTab === 'add'" id="add-friend-form" class="form-grid" @submit.prevent="submitAdd">
      <section class="profile-section wide-field" aria-label="角色基础资料">
        <div class="avatar-card">
          <img class="avatar-preview" :src="avatarPreview" :alt="draft.nickname || draft.name || 'new friend'" />
          <label class="avatar-upload">
            <input type="file" accept="image/*" @change="readAvatar($event, 'add')" />
            <span>导入头像</span>
          </label>
        </div>
        <div class="profile-fields">
          <label class="field avatar-url-field">
            <span>头像 URL</span>
            <input v-model="draft.avatar" placeholder="https://..." />
          </label>

          <section class="identity-row" aria-label="角色名称资料">
            <label class="field compact-field">
              <span>名字</span>
              <input v-model="draft.name" required placeholder="真名" />
            </label>

            <label class="field compact-field">
              <span>网名</span>
              <input v-model="draft.nickname" placeholder="" />
            </label>

            <label class="field compact-field note-field">
              <span>备注</span>
              <input v-model="draft.userNote" placeholder="备注名" />
            </label>
          </section>
        </div>
      </section>

      <label class="field wide-field">
        <span>个性签名</span>
        <input v-model="draft.signature" placeholder="角色在 Link 上的个性签名" />
      </label>

      <label class="field wide-field">
        <span>角色资料</span>
        <textarea v-model="draft.description" rows="7" />
      </label>

      <label class="field wide-field">
        <span>绑定用户账号</span>
        <select v-model="draft.boundUserId">
          <option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.nickname }} · ID {{ account.id }}</option>
        </select>
      </label>

      <label class="field wide-field">
        <span>绑定局部世界书</span>
        <select :value="localBookSelectValue" :disabled="!localBooks.length" @change="toggleLocalWorldBookFromSelect">
          <option :value="localBookSelectValue" disabled>{{ localBookSummary }}</option>
          <option v-for="book in localBooks" :key="book.id" :value="book.id">
            {{ draft.localWorldBookIds.includes(book.id) ? '✓ ' : '' }}{{ book.title }}
          </option>
        </select>
      </label>

    </form>

    <section v-else-if="activeTab === 'scan'" class="scan-panel">
      <p class="panel-copy">导入 PNG / JSON 角色卡，或 TXT / DOC / DOCX 人设文档。文档全文会写入角色资料，并以文件名作为默认角色名。</p>
      <label class="upload-card" :class="{ disabled: importingCharacter }" :aria-busy="importingCharacter">
        <input
          type="file"
          accept=".json,.png,.txt,.doc,.docx,image/png,application/json,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          :disabled="importingCharacter"
          @change="importCard($event)"
        />
        <ImagePlus class="upload-icon" :size="22" stroke-width="2.2" aria-hidden="true" />
        <strong>{{ importingCharacter ? '正在读取…' : '导入角色' }}</strong>
        <span>支持 PNG / JSON / TXT / DOC / DOCX</span>
      </label>
      <p v-if="importError" class="import-error" role="alert">{{ importError }}</p>

      <form v-if="importPreview" id="import-character-form" class="form-grid import-edit-form" @submit.prevent="submitImportedCharacter">
        <section class="profile-section wide-field" aria-label="导入角色基础资料">
          <div class="avatar-card">
            <img class="avatar-preview" :src="scanAvatarPreview" :alt="scanDraft.nickname || scanDraft.name || 'imported friend'" />
            <label class="avatar-upload">
              <input type="file" accept="image/*" @change="readAvatar($event, 'scan')" />
              <span>导入头像</span>
            </label>
          </div>
          <div class="profile-fields">
            <label class="field avatar-url-field">
              <span>头像 URL</span>
              <input v-model="scanDraft.avatar" placeholder="https://..." />
            </label>

            <section class="identity-row" aria-label="导入角色名称资料">
              <label class="field compact-field">
                <span>名字</span>
                <input v-model="scanDraft.name" required placeholder="真名" />
              </label>

              <label class="field compact-field">
                <span>网名</span>
                <input v-model="scanDraft.nickname" placeholder="" />
              </label>

              <label class="field compact-field note-field">
                <span>备注</span>
                <input v-model="scanDraft.userNote" placeholder="备注名" />
              </label>
            </section>
          </div>
        </section>

        <label class="field wide-field">
          <span>个性签名</span>
          <input v-model="scanDraft.signature" placeholder="角色在 Link 上的个性签名" />
        </label>

        <label class="field wide-field">
          <span>角色资料</span>
          <textarea v-model="scanDraft.description" rows="7" />
        </label>

        <label class="field wide-field">
          <span>绑定用户账号</span>
          <select v-model="scanDraft.boundUserId">
            <option v-for="account in accounts" :key="account.id" :value="account.id">{{ account.nickname }} · ID {{ account.id }}</option>
          </select>
        </label>

        <section v-if="scanDraft.importedWorldBooks.length" class="import-book-summary wide-field" aria-label="随角色卡导入的世界书">
          <div class="local-book-header">
            <strong>随卡导入局部世界书</strong>
            <span>{{ scanDraft.importedWorldBooks.length }} 本 / {{ importedLoreEntryCount }} 条条目</span>
          </div>
          <div class="import-book-list">
            <span v-for="book in scanDraft.importedWorldBooks" :key="book.id">{{ book.title }}</span>
          </div>
        </section>

      </form>
    </section>

    <section v-else-if="activeTab === 'create-group'" class="group-panel">
      <div class="group-intro">
        <strong>创建群组</strong>
        <p>选择当前账号绑定的角色，创建后会进入真实群聊消息流。</p>
      </div>
      <label class="field">
        <span>群名称</span>
        <input v-model="groupName" maxlength="40" placeholder="给群聊起个名字" />
      </label>
      <label class="field">
        <span>群公告</span>
        <textarea v-model="groupAnnouncement" rows="3" placeholder="选填" />
      </label>
      <div class="character-picker">
        <strong>邀请已有角色</strong>
        <button v-for="character in characters" :key="character.id" class="character-choice" :class="{ selected: createCharacterIds.includes(character.id) }" type="button" @click="toggleCharacter(createCharacterIds, character.id)">
          <img :src="character.avatar" :alt="character.name" />
          <span><b>{{ character.name }}</b><small>{{ character.nickname || '未设置网名' }}</small></span>
          <i>{{ createCharacterIds.includes(character.id) ? '✓' : '' }}</i>
        </button>
      </div>
      <section class="npc-builder">
        <header><div><strong>自定义 NPC</strong><span>可创建多个只存在于本群的成员</span></div><button type="button" @click="addNpcDraft">添加 NPC</button></header>
        <article v-for="(npc, index) in npcDrafts" :key="index" class="npc-card">
          <div class="npc-card-head"><strong>NPC {{ index + 1 }}</strong><button type="button" @click="removeNpcDraft(index)">删除</button></div>
          <div class="npc-name-grid">
            <label class="field"><span>真名</span><input v-model="npc.trueName" maxlength="40" placeholder="群聊中使用的真实姓名" /></label>
            <label class="field"><span>群昵称</span><input v-model="npc.nickname" maxlength="40" placeholder="选填" /></label>
          </div>
          <label class="field"><span>头像 URL</span><input v-model="npc.avatar" placeholder="选填 https://..." /></label>
          <label class="field"><span>角色设定</span><textarea v-model="npc.description" rows="4" placeholder="性格、身份、关系、说话习惯与群内背景" /></label>
        </article>
        <p v-if="!npcDrafts.length">尚未添加自定义 NPC。</p>
      </section>
      <button class="group-primary" type="button" :disabled="loading || !groupName.trim() || !createCharacterIds.length || hasInvalidNpc" @click="submitCreateGroup">创建并进入群聊</button>
    </section>

    <section v-else class="group-panel">
      <div class="group-intro">
        <strong>查找目前已有群聊</strong>
        <p>选择一个或多个角色。API 会结合角色设定、局部世界书、线上/线下楼层与记忆生成可加入的群聊。</p>
      </div>
      <div class="character-picker">
        <button v-for="character in characters" :key="character.id" class="character-choice" :class="{ selected: searchCharacterIds.includes(character.id) }" type="button" @click="toggleCharacter(searchCharacterIds, character.id)">
          <img :src="character.avatar" :alt="character.name" />
          <span><b>{{ character.name }}</b><small>{{ character.nickname || '未设置网名' }}</small></span>
          <i>{{ searchCharacterIds.includes(character.id) ? '✓' : '' }}</i>
        </button>
      </div>
      <button class="group-primary" type="button" :disabled="loading || !searchCharacterIds.length" @click="emit('discover-groups', [...searchCharacterIds])">
        {{ loading ? '正在读取角色经历并搜索…' : '查找群聊' }}
      </button>
      <p v-if="error" class="group-error">{{ error }}</p>
      <div v-if="candidates.length" class="candidate-list">
        <article v-for="candidate in candidates" :key="candidate.id" class="candidate-card">
          <header><div><strong>{{ candidate.name }}</strong><span>{{ candidate.members.length }} 位成员</span></div><button type="button" :disabled="loading" @click="emit('join-group', candidate)">加入</button></header>
          <p>{{ candidate.description }}</p>
          <div class="member-stack"><span v-for="member in candidate.members" :key="member.id">{{ member.trueName }}<small v-if="member.role === 'owner'">群主</small></span></div>
          <div v-if="candidate.announcement" class="announcement"><b>群公告</b>{{ candidate.announcement }}</div>
          <div class="recent-preview"><div v-for="(message, index) in candidate.recentMessages.slice(-8)" :key="index"><b>{{ candidate.members.find((member) => member.id === message.authorMemberId)?.trueName || '群成员' }}</b><span>{{ message.content }}</span></div></div>
          <small class="discovery-reason">{{ candidate.discoveryReason }}</small>
        </article>
      </div>
    </section>

    <AvatarCropperModal v-model="showAvatarEditor" :src="avatarEditorSource" @confirm="applyEditedAvatar" />
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ImagePlus } from 'lucide-vue-next';
import AvatarCropperModal from '@/components/image/AvatarCropperModal.vue';
import type { CharacterProfile, GroupDiscoveryCandidate, GroupNpcDraft, UserProfile, WorldBookEntry } from '@/types/domain';
import { importSillyTavernCharacterCard, type ImportedCharacterCard } from '@/utils/characterCard';
import { readImageFileFromInput } from '@/utils/imageFile';

const defaultAvatar = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="默认角色头像">
    <defs>
      <linearGradient id="friendCardBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffd8e3"/>
        <stop offset="100%" stop-color="#dff7e8"/>
      </linearGradient>
    </defs>
    <rect width="96" height="96" rx="28" fill="url(#friendCardBg)"/>
    <circle cx="48" cy="35" r="15" fill="#ffffff" fill-opacity="0.96"/>
    <path d="M24 79c3-14 14-22 24-22s21 8 24 22" fill="#ffffff" fill-opacity="0.96"/>
  </svg>
`)}`;

interface AddFriendPayload {
  nickname: string;
  name: string;
  userNote: string;
  avatar: string;
  signature: string;
  description: string;
  boundUserId: string;
  localWorldBookIds?: string[];
  importedWorldBooks?: WorldBookEntry[];
}

type TabId = 'add' | 'scan' | 'create-group' | 'join-group';

const props = withDefaults(defineProps<{
  accounts: UserProfile[];
  activeUserId: string;
  activeTab?: TabId;
  localBooks?: WorldBookEntry[];
  characters?: CharacterProfile[];
  candidates?: GroupDiscoveryCandidate[];
  loading?: boolean;
  error?: string;
}>(), {
  activeTab: 'add',
  localBooks: () => [],
  characters: () => [],
  candidates: () => [],
  error: ''
});

const emit = defineEmits<{
  add: [payload: AddFriendPayload];
  'update:activeTab': [value: TabId];
  'scan-import-ready': [value: boolean];
  'create-group': [payload: { name: string; announcement: string; characterIds: string[]; npcMembers: GroupNpcDraft[] }];
  'discover-groups': [characterIds: string[]];
  'join-group': [candidate: GroupDiscoveryCandidate];
}>();

const activeTab = computed({
  get: () => props.activeTab,
  set: (value: TabId) => emit('update:activeTab', value)
});
const importPreview = ref<ImportedCharacterCard | null>(null);
const importingCharacter = ref(false);
const importError = ref('');
const showAvatarEditor = ref(false);
const avatarEditorSource = ref('');
const avatarEditTarget = ref<'add' | 'scan'>('add');
const localBookSelectValue = '__local_world_book_summary__';
const localBooks = computed(() => props.localBooks.filter((book) => book.scope === 'local'));
const characters = computed(() => props.characters);
const candidates = computed(() => props.candidates);
const groupName = ref('');
const groupAnnouncement = ref('');
const createCharacterIds = reactive<string[]>([]);
const npcDrafts = reactive<GroupNpcDraft[]>([]);
const searchCharacterIds = reactive<string[]>([]);
const hasInvalidNpc = computed(() => npcDrafts.some((npc) => !npc.trueName.trim() || !npc.description.trim()));

const draft = reactive({
  nickname: '',
  name: '',
  userNote: '',
  avatar: '',
  signature: '',
  description: '',
  boundUserId: props.activeUserId || props.accounts[0]?.id || '',
  localWorldBookIds: [] as string[]
});
const scanDraft = reactive({
  nickname: '',
  name: '',
  userNote: '',
  avatar: '',
  signature: '',
  description: '',
  boundUserId: props.activeUserId || props.accounts[0]?.id || '',
  localWorldBookIds: [] as string[],
  importedWorldBooks: [] as WorldBookEntry[]
});
const avatarPreview = computed(() => draft.avatar.trim() || defaultAvatar);
const scanAvatarPreview = computed(() => scanDraft.avatar.trim() || defaultAvatar);
const importedLoreEntryCount = computed(() => scanDraft.importedWorldBooks.reduce((total, book) => total + book.entries.length, 0));
const selectedLocalBooks = computed(() => localBooks.value.filter((book) => draft.localWorldBookIds.includes(book.id)));
const localBookSummary = computed(() => {
  if (!localBooks.value.length) return '暂无局部世界书';
  if (!selectedLocalBooks.value.length) return '请选择局部世界书';
  if (selectedLocalBooks.value.length === 1) return selectedLocalBooks.value[0]?.title ?? '已绑定 1 本局部世界书';
  return `已绑定 ${selectedLocalBooks.value.length} 本局部世界书`;
});

const accounts = props.accounts;

function resetDraft() {
  draft.nickname = '';
  draft.name = '';
  draft.userNote = '';
  draft.avatar = '';
  draft.signature = '';
  draft.description = '';
  draft.boundUserId = props.activeUserId || props.accounts[0]?.id || '';
  draft.localWorldBookIds = [];
}

function resetScanDraft() {
  scanDraft.nickname = '';
  scanDraft.name = '';
  scanDraft.userNote = '';
  scanDraft.avatar = '';
  scanDraft.signature = '';
  scanDraft.description = '';
  scanDraft.boundUserId = props.activeUserId || props.accounts[0]?.id || '';
  scanDraft.localWorldBookIds = [];
  scanDraft.importedWorldBooks = [];
}

async function readAvatar(event: Event, target: 'add' | 'scan') {
  const image = await readImageFileFromInput(event);
  if (!image) return;
  avatarEditTarget.value = target;
  avatarEditorSource.value = image;
  showAvatarEditor.value = true;
}

function applyEditedAvatar(value: string) {
  if (avatarEditTarget.value === 'scan') scanDraft.avatar = value;
  else draft.avatar = value;
}

function submitAdd() {
  emit('add', {
    nickname: draft.nickname,
    name: draft.name,
    userNote: draft.userNote,
    avatar: avatarPreview.value,
    signature: draft.signature.trim(),
    description: draft.description,
    boundUserId: draft.boundUserId,
    localWorldBookIds: [...draft.localWorldBookIds]
  });
  resetDraft();
}

function toggleLocalWorldBookFromSelect(event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return;
  const bookId = event.target.value;
  if (!bookId || bookId === localBookSelectValue) return;
  const ids = new Set(draft.localWorldBookIds);
  if (ids.has(bookId)) ids.delete(bookId);
  else ids.add(bookId);
  draft.localWorldBookIds = [...ids];
  event.target.value = localBookSelectValue;
}

async function importCard(event: Event) {
  const input = event.target instanceof HTMLInputElement ? event.target : null;
  if (!input) return;
  const file = input.files?.[0];
  if (!file) return;
  importError.value = '';
  importingCharacter.value = true;
  importPreview.value = null;
  resetScanDraft();
  emit('scan-import-ready', false);
  try {
    const imported = await importSillyTavernCharacterCard(file);
    importPreview.value = imported;
    scanDraft.nickname = imported.nickname;
    scanDraft.name = imported.name;
    scanDraft.userNote = '';
    scanDraft.avatar = imported.avatar;
    scanDraft.signature = imported.signature;
    scanDraft.description = imported.description;
    scanDraft.boundUserId = props.activeUserId || props.accounts[0]?.id || '';
    scanDraft.localWorldBookIds = [];
    scanDraft.importedWorldBooks = imported.worldBooks;
    emit('scan-import-ready', true);
  } catch (error) {
    importError.value = error instanceof Error ? error.message : '角色文件读取失败，请检查文件后重试。';
  } finally {
    importingCharacter.value = false;
    input.value = '';
  }
}

function submitImportedCharacter() {
  if (!importPreview.value) return;
  emit('add', {
    nickname: scanDraft.nickname,
    name: scanDraft.name,
    userNote: scanDraft.userNote,
    avatar: scanAvatarPreview.value,
    signature: scanDraft.signature.trim(),
    description: scanDraft.description,
    boundUserId: scanDraft.boundUserId,
    localWorldBookIds: [...scanDraft.localWorldBookIds],
    importedWorldBooks: [...scanDraft.importedWorldBooks]
  });
  importPreview.value = null;
  resetScanDraft();
  importError.value = '';
  emit('scan-import-ready', false);
}

function toggleCharacter(target: string[], characterId: string) {
  const index = target.indexOf(characterId);
  if (index >= 0) target.splice(index, 1);
  else target.push(characterId);
}

function addNpcDraft() {
  npcDrafts.push({ trueName: '', nickname: '', avatar: '', description: '' });
}

function removeNpcDraft(index: number) {
  npcDrafts.splice(index, 1);
}

function submitCreateGroup() {
  emit('create-group', {
    name: groupName.value.trim(),
    announcement: groupAnnouncement.value.trim(),
    characterIds: [...createCharacterIds],
    npcMembers: npcDrafts.map((npc) => ({ trueName: npc.trueName.trim(), nickname: npc.nickname.trim(), avatar: npc.avatar?.trim(), description: npc.description.trim() }))
  });
}
</script>

<style scoped>
.add-friend-sheet {
  display: grid;
  gap: 0;
  min-width: 0;
  color: #151719;
  font-size: 12px;
}

.form-grid,
.scan-panel,
.placeholder-panel,
.group-panel {
  display: grid;
  gap: 14px;
}

.group-panel { display: grid; gap: 14px; }
.group-intro { padding: 16px; border-radius: 22px; background: rgba(255,255,255,.86); box-shadow: 0 12px 30px rgba(21,30,26,.06); }
.group-intro strong { font-size: 15px; }
.group-intro p { margin: 6px 0 0; color: #72797c; line-height: 1.6; }
.character-picker { display: grid; gap: 8px; }
.character-picker > strong { color: #4c5357; font-size: 11px; }
.character-choice { display: flex; align-items: center; gap: 10px; min-height: 58px; padding: 8px 11px; border: 1px solid rgba(17,17,17,.06); border-radius: 18px; background: rgba(255,255,255,.88); text-align: left; }
.character-choice.selected { border-color: rgba(6,199,85,.38); background: #eef9f2; }
.character-choice img { width: 40px; height: 40px; border-radius: 13px; object-fit: cover; }
.character-choice span { display: grid; gap: 2px; min-width: 0; flex: 1; }
.character-choice b,.character-choice small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.character-choice small { color: #8a9093; }
.character-choice i { width: 24px; color: #06a94c; font-size: 16px; font-style: normal; text-align: center; }
.group-primary { min-height: 46px; border-radius: 16px; background: #111; color: white; font-weight: 800; }
.group-primary:disabled { opacity: .4; }
.npc-builder { display:grid;gap:10px;padding:13px;border:1px solid rgba(17,17,17,.05);border-radius:20px;background:rgba(255,255,255,.72) }
.npc-builder>header,.npc-card-head { display:flex;align-items:center;justify-content:space-between;gap:10px }
.npc-builder>header div { display:grid;gap:2px }.npc-builder>header span,.npc-builder>p { color:#858c88;font-size:10px }.npc-builder>header button { padding:7px 11px;border-radius:999px;background:#eaf8ef;color:#07853c;font-weight:850 }
.npc-builder>p { margin:0;padding:8px;text-align:center }.npc-card { display:grid;gap:10px;padding:12px;border-radius:16px;background:#f6f8f7 }.npc-card-head button { color:#cf3850;font-size:11px;font-weight:800 }.npc-name-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px }
.group-error,
.import-error { margin: 0; padding: 10px 12px; border-radius: 12px; background: #fff0f2; color: #bf2940; }
.candidate-list { display: grid; gap: 12px; }
.candidate-card { display: grid; gap: 10px; padding: 14px; border-radius: 22px; background: rgba(255,255,255,.94); box-shadow: 0 12px 28px rgba(21,30,26,.07); }
.candidate-card header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.candidate-card header div { display: grid; gap: 2px; }
.candidate-card header strong { font-size: 15px; }
.candidate-card header span,.candidate-card > p,.discovery-reason { color: #7c8386; }
.candidate-card header button { padding: 8px 15px; border-radius: 999px; background: #eaf8ef; color: #07853c; font-weight: 800; }
.candidate-card > p { margin: 0; line-height: 1.5; }
.member-stack { display: flex; flex-wrap: wrap; gap: 6px; }
.member-stack span { padding: 5px 8px; border-radius: 999px; background: #f2f4f3; }
.member-stack small { margin-left: 4px; color: #0a9a47; }
.announcement { display: grid; gap: 3px; padding: 9px 10px; border-radius: 12px; background: #f7f8f7; line-height: 1.45; }
.recent-preview { display: grid; gap: 6px; padding-top: 8px; border-top: 1px solid #f0f1f0; }
.recent-preview div { display: grid; grid-template-columns: minmax(50px, auto) 1fr; gap: 8px; }
.recent-preview b { color: #59605d; }
.recent-preview span { min-width: 0; color: #202321; overflow-wrap: anywhere; }

.wide-field {
  min-width: 0;
}

.profile-section,
.import-book-summary,
.scan-panel,
.placeholder-panel {
  border: 1px solid rgba(17, 17, 17, 0.04);
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 14px 36px rgba(21, 30, 26, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.92);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}

.profile-section {
  display: grid;
  grid-template-columns: clamp(82px, 25vw, 104px) minmax(0, 1fr);
  gap: clamp(10px, 3vw, 14px);
  align-items: center;
  padding: clamp(12px, 3.5vw, 14px);
  border-radius: 24px;
}

.avatar-card {
  align-self: center;
  display: grid;
  justify-items: center;
  gap: 10px;
  min-width: 0;
}

.avatar-preview,
.import-preview img {
  width: clamp(70px, 21vw, 88px);
  height: clamp(70px, 21vw, 88px);
  border-radius: clamp(20px, 6vw, 26px);
  background: #eef3f1;
  object-fit: cover;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.05), 0 12px 26px rgba(26, 33, 30, 0.08);
}

.avatar-upload,
.upload-card,
.primary-action {
  touch-action: manipulation;
}

.avatar-upload {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  max-width: 100%;
  padding: 0 10px;
  border-radius: 12px;
  border: 1px solid rgba(17, 17, 17, 0.07);
  background: rgba(255, 255, 255, 0.82);
  color: #50585c;
  font-size: 11px;
  font-weight: 800;
  white-space: nowrap;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.avatar-upload input,
.upload-card input {
  display: none;
}

.profile-fields {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.identity-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(8px, 2.5vw, 10px);
  min-width: 0;
}

.note-field {
  grid-column: 1 / -1;
}

.field {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.field > span {
  color: #4c5357;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.2;
}

.field input,
.field textarea,
.field select {
  width: 100%;
  min-height: 44px;
  padding: 11px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.95);
  color: #151719;
  font-size: 12px;
  line-height: 1.4;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.06);
}

.field textarea {
  min-height: 168px;
  resize: vertical;
}

.field input::placeholder,
.field textarea::placeholder {
  color: #a3a9ad;
}

.field:focus-within > span {
  color: #17191b;
}

.field:focus-within input,
.field:focus-within textarea,
.field:focus-within select {
  box-shadow: inset 0 0 0 1px rgba(6, 199, 85, 0.35), 0 0 0 3px rgba(6, 199, 85, 0.1);
}

.import-book-summary {
  display: grid;
  gap: 10px;
  padding: 14px;
  border-radius: 22px;
}

.local-book-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.local-book-header strong {
  color: #30363a;
  font-size: 13px;
}

.local-book-header span,
.panel-copy,
.placeholder-panel p,
.import-preview p,
.import-preview span {
  color: #69736f;
  line-height: 1.55;
}

.local-book-header span {
  font-size: 11px;
  font-weight: 800;
}

.panel-copy,
.placeholder-panel p {
  margin: 0;
}

.import-book-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.import-book-list span {
  max-width: 100%;
  min-height: 32px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(250, 252, 250, 0.96);
  color: #33393d;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.35;
  box-shadow: inset 0 0 0 1px rgba(42, 75, 60, 0.08);
}

.primary-action {
  border: 1px solid rgba(6, 199, 85, 0.18);
  background: linear-gradient(135deg, rgba(224, 249, 233, 0.98), rgba(255, 242, 247, 0.96));
  color: #16643e;
  box-shadow: 0 14px 28px rgba(31, 120, 74, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.scan-panel,
.placeholder-panel {
  padding: 14px;
  border-radius: 24px;
}

.panel-copy {
  font-size: 12px;
}

.upload-card {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 8px;
  min-height: 136px;
  padding: 18px;
  border: 1px dashed rgba(21, 23, 25, 0.14);
  border-radius: 22px;
  background: rgba(248, 251, 249, 0.94);
  color: #202426;
  text-align: center;
}

.upload-card.disabled {
  pointer-events: none;
  opacity: 0.62;
}

.upload-icon {
  color: var(--link-green);
}

.upload-card strong,
.placeholder-panel strong,
.import-preview strong {
  font-size: 13px;
}

.upload-card span,
.import-preview span {
  color: #78807c;
  font-size: 11px;
  font-weight: 800;
}

.import-preview {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 22px;
  background: rgba(248, 251, 249, 0.94);
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.05);
}

.import-preview p,
.import-preview span {
  display: block;
  margin: 6px 0 0;
  font-size: 11px;
}

.primary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  border-radius: 17px;
  font-size: 12px;
  font-weight: 800;
}

.placeholder-panel {
  min-height: 220px;
  align-content: center;
  justify-items: center;
  text-align: center;
}

</style>