<template>
  <section v-if="conversation" class="control-panel">
    <section v-if="activeTab === 'group'" class="panel-section">
      <section class="group-hero">
        <img :src="conversation.groupAvatar || leadAvatar" :alt="conversation.title" />
        <div>
          <span>Group Profile</span>
          <strong>{{ conversation.title }}</strong>
        </div>
      </section>

      <section class="settings-block">
        <header class="section-header"><div><span>Information</span><strong>群资料</strong></div></header>
        <div class="group-avatar-editor">
          <img :src="profileDraft.avatar || leadAvatar" :alt="conversation.title" />
          <div>
            <label class="field"><span>群头像 URL</span><input v-model="profileDraft.avatar" placeholder="留空使用首位成员头像" @change="saveAvatar(profileDraft.avatar)" /></label>
            <label class="avatar-upload-action"><input type="file" accept="image/*" @change="readGroupAvatar" /><span>从本地上传并裁剪</span></label>
          </div>
        </div>
        <template v-if="canManage">
          <label class="field"><span>群名称</span><input v-model="profileDraft.title" maxlength="40" /></label>
          <label class="field"><span>群公告</span><textarea v-model="profileDraft.announcement" maxlength="500" rows="5"></textarea></label>
        </template>
        <div v-else class="read-only-block"><span>群公告</span><p>{{ conversation.groupAnnouncement || '暂无群公告' }}</p></div>
      </section>

      <section v-if="canManage" class="settings-block">
        <header class="section-header"><div><span>Permissions</span><strong>加入与群权限</strong></div></header>
        <div class="two-column-grid">
          <label class="field compact-field"><span>加入方式</span><select v-model="profileDraft.joinPolicy"><option value="open">自由加入</option><option value="approval">需要审核</option><option value="invite-only">仅限邀请</option></select><small>控制新成员如何进入当前群。</small></label>
            <label class="field compact-field"><span>邀请成员</span><select v-model="profileDraft.invitePermission"><option value="members">所有成员</option><option value="admins">仅群主和管理员</option></select><small>限制谁可以邀请绑定角色。</small></label>
          <label class="field compact-field"><span>群内发言</span><select v-model="profileDraft.messagePermission"><option value="members">所有成员</option><option value="admins">仅群主和管理员</option></select><small>可用于公告群或临时禁言。</small></label>
          <label class="switch-card compact-control"><input v-model="profileDraft.historyVisible" type="checkbox" /><span class="switch-track"></span><div><strong>新成员可看历史</strong><span>加入后允许读取此前群聊上下文。</span></div></label>
        </div>
          <button class="primary-action" type="button" :disabled="savingProfile || !profileDraft.title.trim()" @click="saveProfile">{{ savingProfile ? '保存中' : '保存群资料与权限' }}</button>
      </section>

      <section class="settings-block">
        <header class="section-header"><div><span>Personal</span><strong>我的群聊偏好</strong></div></header>
        <label class="field"><span>我的群内昵称</span><input v-model="personalDraft.nickname" maxlength="40" /></label>
        <div class="two-column-grid">
          <label class="switch-card"><input v-model="personalDraft.pinned" type="checkbox" /><span class="switch-track"></span><div><strong>置顶群聊</strong><span>将本群固定在群列表前方。</span></div></label>
          <label class="switch-card"><input v-model="personalDraft.muted" type="checkbox" /><span class="switch-track"></span><div><strong>消息免打扰</strong><span>保留消息但关闭主动提醒。</span></div></label>
        </div>
        <button class="secondary-action" type="button" @click="savePersonalPreferences">保存我的偏好</button>
      </section>
    </section>

    <section v-if="activeTab === 'members'" class="panel-section">
      <section class="members-hero">
        <div><span>Members</span><strong>{{ activeMembers.length }}</strong></div>
      </section>
      <section class="settings-block">
        <header class="section-header"><div><span>Roster</span><strong>群成员</strong></div><em>{{ conversation.groupMembers?.length || 0 }} 人</em></header>
        <div class="member-list">
          <article v-for="member in conversation.groupMembers" :key="member.id" class="member-row">
            <img :src="member.avatar || fallbackAvatar" :alt="member.trueName" />
            <div><strong>{{ member.trueName }}</strong><span>{{ member.nickname || member.trueName }}</span></div>
            <em>{{ memberStatusLabel(member) }}</em>
            <section v-if="member.identityType === 'npc' && isJoined" class="npc-avatar-editor">
              <label class="field"><span>NPC 头像 URL</span><input :value="member.avatar || ''" placeholder="留空使用默认头像" @change="saveNpcAvatarFromInput(member.id, $event)" /></label>
              <label class="avatar-upload-action"><input type="file" accept="image/*" @change="readNpcAvatar(member.id, $event)" /><span>从本地上传并裁剪</span></label>
            </section>
          </article>
        </div>
      </section>
      <section v-if="isJoined" class="settings-block">
        <header class="section-header"><div><span>Invite</span><strong>邀请绑定角色</strong></div></header>
        <div v-if="invitableCharacters.length" class="invite-list">
          <label v-for="character in invitableCharacters" :key="character.id"><img :src="character.avatar" :alt="character.name" /><span><strong>{{ character.name }}</strong><small>{{ character.nickname }}</small></span><input v-model="inviteIds" type="checkbox" :value="character.id" /></label>
        </div>
        <p v-else class="empty-note">当前账号没有可继续邀请的新角色。</p>
        <button class="primary-action" type="button" :disabled="!inviteIds.length || inviting" @click="inviteMembers">{{ inviting ? '邀请中' : '确认邀请' }}</button>
      </section>
    </section>

    <section v-if="activeTab === 'memory'" class="panel-section">
      <section class="memory-hero"><div><span>Group Memory</span><strong>—</strong><p>{{ visibleMessageCount }} 条群聊消息仍完整保留</p></div></section>
      <section class="settings-block">
        <header class="section-header"><div><span>Character brains</span><strong>群聊角色记忆正在准备</strong></div></header>
        <p class="empty-note">人类式记忆必须让每个群成员分别以自己的视角形成独立 brain。当前单角色 GraphRAG 不会冒充群成员共同记忆，旧“群聊总结”也不再作为运行入口。</p>
      </section>
    </section>

    <section v-if="activeTab === 'appearance'" class="panel-section">
      <section class="settings-block">
        <header class="section-header"><div><span>Palette</span><strong>群聊配色</strong></div></header>
        <div class="color-grid">
          <label class="field"><span>聊天背景</span><input :value="chatSettings.appearance.backgroundColor" type="color" @input="updateAppearanceColor('backgroundColor', $event)" /></label>
          <label class="field"><span>我的气泡</span><input :value="chatSettings.appearance.userBubbleColor" type="color" @input="updateAppearanceColor('userBubbleColor', $event)" /></label>
          <label class="field"><span>成员气泡</span><input :value="chatSettings.appearance.characterBubbleColor" type="color" @input="updateAppearanceColor('characterBubbleColor', $event)" /></label>
        </div>
      </section>
      <section class="settings-block display-options-grid">
        <label class="switch-card"><input :checked="chatSettings.appearance.showMessageTime" type="checkbox" @change="updateAppearanceToggle('showMessageTime', $event)" /><span class="switch-track"></span><div><strong>显示消息时间</strong><span>在群消息气泡下显示发送时间。</span></div></label>
        <label class="switch-card"><input :checked="chatSettings.appearance.showReadStatus" type="checkbox" @change="updateAppearanceToggle('showReadStatus', $event)" /><span class="switch-track"></span><div><strong>显示已读状态</strong><span>显示已读与未送达状态。</span></div></label>
        <label class="switch-card"><input :checked="chatSettings.appearance.showUserAvatar" type="checkbox" @change="updateAppearanceToggle('showUserAvatar', $event)" /><span class="switch-track"></span><div><strong>显示我的头像</strong><span>控制当前用户气泡旁的头像。</span></div></label>
        <label class="switch-card"><input :checked="chatSettings.appearance.showCharacterAvatar" type="checkbox" @change="updateAppearanceToggle('showCharacterAvatar', $event)" /><span class="switch-track"></span><div><strong>显示成员头像</strong><span>控制角色与其他成员气泡旁的头像。</span></div></label>
        <label class="switch-card"><input :checked="chatSettings.appearance.showOnlyFirstAvatarInReply" type="checkbox" @change="updateAppearanceToggle('showOnlyFirstAvatarInReply', $event)" /><span class="switch-track"></span><div><strong>连续消息精简头像</strong><span>同一成员连续发言只显示首个头像。</span></div></label>
      </section>
    </section>

    <section v-if="activeTab === 'ai'" class="panel-section">
      <section class="settings-block">
        <header class="section-header"><div><span>Models</span><strong>群聊生成模型</strong></div></header>
        <label class="field"><span>线上群聊模型覆盖</span><input :value="chatSettings.modelOverrides.online" placeholder="留空跟随全局线上模型；未配置则报错" @change="updateModel('online', $event)" /></label>
        <label class="field"><span>群聊线下模型覆盖</span><input :value="chatSettings.modelOverrides.offline" placeholder="留空跟随全局线下模型；未配置则报错" @change="updateModel('offline', $event)" /></label>
      </section>
      <section class="settings-block">
        <header class="section-header"><div><span>Behavior</span><strong>群聊行为与感知</strong></div></header>
        <label class="switch-card"><input :checked="chatSettings.proactiveReply.enabled" type="checkbox" @change="updateProactiveEnabled" /><span class="switch-track"></span><div><strong>主动群消息</strong><span>只在线上模式按群内生活节奏主动发言。</span></div></label>
        <label class="field compact-field"><span>主动群消息频率</span><select :value="chatSettings.proactiveReply.frequency" :disabled="!chatSettings.proactiveReply.enabled" @change="updateProactiveFrequency"><option value="very-low">很低</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="very-high">很高</option><option value="always">频繁</option></select><small>控制群成员主动开启话题的节奏。</small></label>
        <label class="switch-card"><input :checked="chatSettings.timeAwareness.enabled" type="checkbox" @change="updateTimeAwareness" /><span class="switch-track"></span><div><strong>群聊时间感知</strong><span>让群成员理解真实时间间隔与当前时间。</span></div></label>
        <label class="switch-card"><input :checked="chatSettings.stickerVisionEnabled" type="checkbox" @change="updateBooleanSetting('stickerVisionEnabled', $event)" /><span class="switch-track"></span><div><strong>识别 Stickers</strong><span>把最近贴纸内容提供给群聊模型理解。</span></div></label>
      </section>
      <section class="settings-block">
        <header class="section-header"><div><span>Stickers</span><strong>群成员 Stickers</strong></div></header>
        <label class="field compact-field">
          <span>绑定 Stickers 分组</span>
          <select :value="stickerGroupSelectValue" :disabled="!stickerGroupPickerRows.length" @change="toggleStickerGroupFromSelect">
            <option :value="stickerGroupSelectValue" disabled>{{ groupStickerBindingSummary }}</option>
            <option v-for="group in stickerGroupPickerRows" :key="group.id" :value="group.id">{{ chatSettings.characterStickerGroupIds.includes(group.id) ? '✓ ' : '' }}{{ group.name }}</option>
          </select>
          <small>可多选；群内任何 AI 成员都可以从已绑定分组中发送 Stickers。</small>
        </label>
      </section>
    </section>
  </section>
  <AvatarCropperModal v-model="showAvatarEditor" :src="avatarEditorSource" @confirm="applyAvatarCrop" />
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useAppStore } from '@/stores/appStore';
import AvatarCropperModal from '@/components/image/AvatarCropperModal.vue';
import type { ChatAppearanceSettings, ChatModelScope, Conversation, GroupMember, VoomFrequency } from '@/types/domain';
import { readImageFileFromInput } from '@/utils/imageFile';

export type GroupSettingsTab = 'group' | 'members' | 'memory' | 'appearance' | 'ai';
const props = defineProps<{ conversationId: string; activeTab: GroupSettingsTab }>();
const store = useAppStore();
const inviteIds = ref<string[]>([]);
const savingProfile = ref(false);
const showAvatarEditor = ref(false);
const avatarEditorSource = ref('');
const avatarEditorNpcMemberId = ref<string | null>(null);
const inviting = ref(false);
const profileDraft = reactive({ title: '', announcement: '', avatar: '', joinPolicy: 'approval' as NonNullable<Conversation['groupJoinPolicy']>, invitePermission: 'members' as NonNullable<Conversation['groupInvitePermission']>, messagePermission: 'members' as NonNullable<Conversation['groupMessagePermission']>, historyVisible: true });
const personalDraft = reactive({ nickname: '', pinned: false, muted: false });
const conversation = computed(() => { const item = store.conversationById(props.conversationId); return item?.kind === 'group' ? item : null; });
const chatSettings = computed(() => store.settingsForConversation(props.conversationId));
const currentMember = computed(() => conversation.value?.groupMembers?.find((member) => member.identityType === 'user' && member.identityId === conversation.value?.userId));
const isJoined = computed(() => (currentMember.value?.membershipStatus ?? 'active') === 'active');
const canManage = computed(() => isJoined.value && (currentMember.value?.role === 'owner' || currentMember.value?.role === 'admin'));
const activeMembers = computed(() => conversation.value?.groupMembers?.filter((member) => (member.membershipStatus ?? 'active') === 'active') ?? []);
const existingCharacterIds = computed(() => new Set(conversation.value?.groupMembers?.filter((member) => member.identityType === 'character').map((member) => member.identityId) ?? []));
const invitableCharacters = computed(() => store.charactersForActiveUser.filter((character) => !existingCharacterIds.value.has(character.id)));
const visibleMessageCount = computed(() => store.messagesForConversation(props.conversationId).filter((message) => !message.contextOnly).length);
const fallbackAvatar = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#eaf5ee"/><circle cx="25" cy="27" r="10" fill="#79b88e"/><circle cx="43" cy="29" r="8" fill="#9ac9aa"/><path d="M10 57c2-13 11-20 22-20s20 7 22 20" fill="#79b88e"/></svg>')}`;
const leadAvatar = computed(() => activeMembers.value.find((member) => member.identityType === 'character' && member.avatar)?.avatar || fallbackAvatar);
const stickerGroupSelectValue = '__group_sticker_summary__';
const stickerGroupPickerRows = computed(() => store.sortedStickerGroups.map((group) => ({ id: group.id, name: group.name })));
const groupStickerBindingSummary = computed(() => {
  if (!stickerGroupPickerRows.value.length) return '暂无 Stickers 分组';
  const selectedIds = new Set(chatSettings.value.characterStickerGroupIds);
  const names = stickerGroupPickerRows.value.filter((group) => selectedIds.has(group.id)).map((group) => group.name);
  if (!names.length) return '请选择 Stickers 分组';
  return names.length === 1 ? names[0] : `已绑定 ${names.length} 个 Stickers 分组`;
});

watch(conversation, (value) => {
  profileDraft.title = value?.title ?? '';
  profileDraft.announcement = value?.groupAnnouncement ?? '';
  profileDraft.avatar = value?.groupAvatar ?? '';
  profileDraft.joinPolicy = value?.groupJoinPolicy ?? 'approval';
  profileDraft.invitePermission = value?.groupInvitePermission ?? 'members';
  profileDraft.messagePermission = value?.groupMessagePermission ?? 'members';
  profileDraft.historyVisible = value?.groupHistoryVisibleToNewMembers ?? true;
  personalDraft.nickname = currentMember.value?.nickname || currentMember.value?.trueName || '';
  personalDraft.pinned = value?.groupPinned ?? false;
  personalDraft.muted = value?.groupMuted ?? false;
}, { immediate: true });
function memberStatusLabel(member: GroupMember) { const role = member.role === 'owner' ? '群主' : member.role === 'admin' ? '管理员' : '成员'; const status = (member.membershipStatus ?? 'active') === 'left' ? '已退出' : member.membershipStatus === 'pending' ? '待审核' : ''; return status ? `${role} · ${status}` : role; }
async function saveSettings(next: ReturnType<typeof store.settingsForConversation>) { await store.saveConversationSettings(next); }
async function saveProfile() { if (!conversation.value || !profileDraft.title.trim()) return; savingProfile.value = true; try { await store.updateManagedGroupProfile(props.conversationId, { title: profileDraft.title, announcement: profileDraft.announcement, joinPolicy: profileDraft.joinPolicy, invitePermission: profileDraft.invitePermission, messagePermission: profileDraft.messagePermission, historyVisibleToNewMembers: profileDraft.historyVisible }); } finally { savingProfile.value = false; } }
async function saveAvatar(value: string) { if (!isJoined.value) return; await store.updateGroupAvatar(props.conversationId, value); }
async function readGroupAvatar(event: Event) { const image = await readImageFileFromInput(event); if (!image) return; avatarEditorNpcMemberId.value = null; avatarEditorSource.value = image; showAvatarEditor.value = true; }
async function saveNpcAvatar(memberId: string, value: string) { if (!isJoined.value) return; await store.updateGroupNpcAvatar(props.conversationId, memberId, value); }
async function saveNpcAvatarFromInput(memberId: string, event: Event) { await saveNpcAvatar(memberId, (event.target as HTMLInputElement).value); }
async function readNpcAvatar(memberId: string, event: Event) { const image = await readImageFileFromInput(event); if (!image) return; avatarEditorNpcMemberId.value = memberId; avatarEditorSource.value = image; showAvatarEditor.value = true; }
async function applyAvatarCrop(value: string) { const memberId = avatarEditorNpcMemberId.value; if (memberId) await saveNpcAvatar(memberId, value); else { profileDraft.avatar = value; await saveAvatar(value); } avatarEditorNpcMemberId.value = null; }
async function savePersonalPreferences() { await store.updateGroupPersonalPreferences(props.conversationId, personalDraft); }
async function inviteMembers() { if (!inviteIds.value.length) return; inviting.value = true; try { await store.inviteCharactersToGroup(props.conversationId, inviteIds.value); inviteIds.value = []; } finally { inviting.value = false; } }
async function updateAppearanceColor(key: keyof Pick<ChatAppearanceSettings, 'backgroundColor' | 'userBubbleColor' | 'characterBubbleColor'>, event: Event) { await saveSettings({ ...chatSettings.value, appearance: { ...chatSettings.value.appearance, [key]: (event.target as HTMLInputElement).value } }); }
async function updateAppearanceToggle(key: keyof Pick<ChatAppearanceSettings, 'showMessageTime' | 'showReadStatus' | 'showUserAvatar' | 'showCharacterAvatar' | 'showOnlyFirstAvatarInReply'>, event: Event) { await saveSettings({ ...chatSettings.value, appearance: { ...chatSettings.value.appearance, [key]: (event.target as HTMLInputElement).checked } }); }
async function updateModel(scope: Extract<ChatModelScope, 'online' | 'offline'>, event: Event) { await saveSettings({ ...chatSettings.value, modelOverrides: { ...chatSettings.value.modelOverrides, [scope]: (event.target as HTMLInputElement).value.trim() } }); }
async function updateProactiveEnabled(event: Event) { await saveSettings({ ...chatSettings.value, proactiveReply: { ...chatSettings.value.proactiveReply, enabled: (event.target as HTMLInputElement).checked } }); }
async function updateProactiveFrequency(event: Event) { await saveSettings({ ...chatSettings.value, proactiveReply: { ...chatSettings.value.proactiveReply, frequency: (event.target as HTMLSelectElement).value as VoomFrequency } }); }
async function updateTimeAwareness(event: Event) { await saveSettings({ ...chatSettings.value, timeAwareness: { enabled: (event.target as HTMLInputElement).checked } }); }
async function updateBooleanSetting(key: 'stickerVisionEnabled', event: Event) { await saveSettings({ ...chatSettings.value, [key]: (event.target as HTMLInputElement).checked }); }
async function toggleStickerGroupFromSelect(event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return;
  const groupId = event.target.value;
  event.target.value = stickerGroupSelectValue;
  if (!groupId || groupId === stickerGroupSelectValue) return;
  const selectedIds = new Set(chatSettings.value.characterStickerGroupIds);
  if (selectedIds.has(groupId)) selectedIds.delete(groupId);
  else selectedIds.add(groupId);
  const orderedIds = store.sortedStickerGroups.map((group) => group.id).filter((id) => selectedIds.has(id));
  await saveSettings({ ...chatSettings.value, characterStickerGroupIds: orderedIds });
}
</script>

<style scoped>
.control-panel,.panel-section{position:relative;display:grid;gap:12px;color:#171717}.group-hero,.members-hero,.memory-hero{display:flex;align-items:center;gap:14px;min-height:118px;padding:18px;border:1px solid rgba(19,24,22,.05);border-radius:24px;background:radial-gradient(circle at 92% 4%,rgba(6,199,85,.16),transparent 34%),linear-gradient(145deg,rgba(255,255,255,.98),rgba(247,249,248,.92));box-shadow:0 18px 42px rgba(18,25,22,.08)}.group-hero img{width:68px;height:68px;border-radius:50%;object-fit:cover;box-shadow:0 10px 24px rgba(17,17,17,.12)}.group-hero div,.members-hero div,.memory-hero div{display:grid;gap:4px;min-width:0}.group-hero span,.members-hero span,.memory-hero span{color:#8a8f94;font-size:12px;font-weight:700}.group-hero strong{overflow:hidden;font-size:23px;line-height:1.1;text-overflow:ellipsis;white-space:nowrap}.members-hero strong,.memory-hero strong{font-size:32px;line-height:1}.group-hero p,.members-hero p,.memory-hero p{margin:0;color:#74797d;font-size:12px}.settings-block{display:grid;gap:12px;min-width:0;padding:14px;border:1px solid rgba(19,24,22,.06);border-radius:20px;background:linear-gradient(160deg,rgba(255,255,255,.96),rgba(247,250,248,.9)),radial-gradient(circle at top right,rgba(6,199,85,.09),transparent 34%);box-shadow:0 14px 34px rgba(16,24,20,.07)}.section-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.section-header div{display:grid;gap:2px}.section-header span{color:#8a8f94;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.section-header strong{font-size:16px;font-weight:900}.section-header em{align-self:center;color:#898e93;font-size:12px;font-style:normal;font-weight:800}.field{display:grid;gap:6px}.field>span{color:#767b81;font-size:12px;font-weight:800}.field input,.field textarea,.field select,.read-only-block,.empty-note{width:100%;min-width:0;border:1px solid rgba(20,24,22,.05);border-radius:16px;background:#f6f7f7;color:#171717;font:inherit;font-weight:700;outline:0;padding:10px 12px}.field input,.field select{min-height:42px}.field input[type=color]{height:46px;padding:6px}.field textarea{min-height:112px;line-height:1.55;resize:vertical}.field small,.compact-control span,.permission-note,.empty-note{color:#85898e;font-size:11px;line-height:1.45}.compact-field{min-height:92px;align-content:center;padding:12px;border:1px solid rgba(20,24,22,.05);border-radius:16px;background:#f6f7f7}.compact-field input,.compact-field select{background:#fff}.two-column-grid,.display-options-grid,.color-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.color-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.switch-card{display:flex;align-items:center;gap:12px;min-height:62px;padding:12px;border:1px solid rgba(20,24,22,.05);border-radius:16px;background:#f6f7f7}.switch-card input{position:absolute;opacity:0;pointer-events:none}.switch-track{position:relative;width:46px;height:28px;border-radius:999px;background:#dedad7;flex:0 0 auto;transition:.2s}.switch-track::after{position:absolute;top:4px;left:4px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.16);content:"";transition:.2s}.switch-card input:checked+.switch-track{background:#171717}.switch-card input:checked+.switch-track::after{transform:translateX(18px)}.switch-card div{display:grid;gap:2px;min-width:0}.switch-card strong{font-size:14px;font-weight:900}.switch-card div span{color:#85898e;font-size:12px;line-height:1.35}.primary-action,.secondary-action{min-height:42px;border-radius:14px;font-weight:900}.primary-action{background:#171717;color:#fff;box-shadow:0 12px 24px rgba(17,17,17,.15)}.secondary-action{border:1px solid rgba(17,17,17,.08);background:#fff;color:#171717}.primary-action:disabled{opacity:.45}.read-only-block{display:grid;gap:5px}.read-only-block span{color:#6e7672;font-size:11px;font-weight:850}.read-only-block p{margin:0;line-height:1.6;white-space:pre-wrap}.member-list,.invite-list,.memory-list{display:grid;gap:8px}.member-row,.invite-list label{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:10px;padding:9px;border-radius:16px;background:#f6f7f7}.member-row img,.invite-list img{width:44px;height:44px;border-radius:50%;object-fit:cover}.member-row div,.invite-list span{display:grid;gap:2px;min-width:0}.member-row strong,.invite-list strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.member-row span,.invite-list small{overflow:hidden;color:#838a86;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.member-row em{color:#171717;font-size:10px;font-style:normal;font-weight:850}.invite-list input{width:18px;height:18px;accent-color:#171717}.memory-list article{padding:12px;border-radius:16px;background:#f6f7f7}.memory-list span{color:#85898e;font-size:10px;font-weight:850}.memory-list p{margin:6px 0 0;font-size:12px;line-height:1.6;white-space:pre-wrap}.empty-note{margin:0;color:#85898e;font-size:12px}@media(max-width:420px){.two-column-grid,.display-options-grid{grid-template-columns:1fr}.color-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
</style>

<style scoped>
.group-avatar-editor { display:grid;grid-template-columns:68px minmax(0,1fr);align-items:center;gap:12px }.group-avatar-editor>img { width:68px;height:68px;border-radius:50%;object-fit:cover;box-shadow:0 8px 20px rgba(17,17,17,.1) }.group-avatar-editor>div { display:grid;gap:8px;min-width:0 }.avatar-upload-action { position:relative;display:grid;place-items:center;min-height:38px;border:1px solid rgba(20,24,22,.06);border-radius:13px;background:#eef7f1;color:#187341;font-size:11px;font-weight:900;cursor:pointer }.avatar-upload-action input { position:absolute;width:1px;height:1px;overflow:hidden;opacity:0 }
.npc-avatar-editor { grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) minmax(120px,.55fr);align-items:end;gap:8px;padding-top:8px;border-top:1px solid rgba(20,24,22,.06) }
@media(max-width:420px){.npc-avatar-editor{grid-template-columns:1fr}}
</style>

<style scoped>
.control-panel,
.panel-section,
.settings-block {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.control-panel *,
.panel-section * {
  min-width: 0;
}

.switch-card {
  position: relative;
}

.switch-card > input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  padding: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
}
</style>
