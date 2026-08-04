<template>
  <section v-if="conversation" class="screen no-tabs group-chat-page" :style="chatSurfaceStyle">
    <ChatHeader
      mode="online"
      :title="groupHeaderTitle"
      :offline-disabled="replying || !isJoined"
      @offline="enterOffline"
      @search="openChatSearch"
      @open-menu="openChatSettings"
    />

    <GroupAnnouncementBanner
      v-if="conversation.groupAnnouncement"
      :announcement="conversation.groupAnnouncement"
      :group-name="conversation.title"
    />

    <main ref="messageList" class="message-list" @scroll.passive="handleMessageListScroll">
      <div class="message-virtualizer" :style="{ height: `${virtualMessageTotalSize}px` }">
        <div
          v-for="virtualRow in virtualMessageRows"
          :key="String(virtualRow.key)"
          :ref="measureVirtualMessageElement"
          class="message-virtual-item"
          :data-index="virtualRow.index"
          :style="{ transform: `translateY(${virtualRow.start}px)` }"
        >
          <template v-if="messageEntries[virtualRow.index]">
            <div v-if="messageEntries[virtualRow.index].timeLabel && messageEntries[virtualRow.index].message.sender !== 'system'" class="message-time-divider"><time>{{ messageEntries[virtualRow.index].timeLabel }}</time></div>
            <MessageBubble
              :message="messageEntries[virtualRow.index].message"
              :character="characterForMessage(messageEntries[virtualRow.index].message)"
              :user="conversationUser"
              :appearance="chatSettings.appearance"
              :group-position="messageEntries[virtualRow.index].groupPosition"
              :author-avatar="avatarForMessage(messageEntries[virtualRow.index].message)"
              :author-name="messageEntries[virtualRow.index].message.authorName || '群成员'"
              :show-author-name="messageEntries[virtualRow.index].message.sender === 'char'"
              :hide-avatar="shouldHideAvatar(virtualRow.index)"
              :hide-message-time="messageEntries[virtualRow.index].message.sender === 'system'"
              :selection-mode="selectionMode"
              :selected="isMessageSelected(messageEntries[virtualRow.index].message)"
              :can-quote="canQuoteMessage(messageEntries[virtualRow.index].message)"
              @avatar-long-press="mentionMessageAuthor"
              @long-press="openMessageMenu"
              @quote-message="quoteMessage"
              @toggle-select="toggleMessageSelection(messageEntries[virtualRow.index].message)"
            />
          </template>
        </div>
      </div>
      <div v-if="replying" class="typing-indicator"><span></span><span></span><span></span></div>
      </main>

    <section v-if="selectionMode" class="selection-toolbar">
      <button class="secondary-action" type="button" @click="cancelSelection"><span>取消</span></button>
      <strong>已选 {{ selectedMessageCount }} 条</strong>
      <button class="danger-action" type="button" :disabled="!selectedMessageCount" @click="deleteSelectedMessages"><span>删除</span></button>
    </section>

    <section v-if="!isJoined" class="left-member-controls">
      <div><strong>{{ membershipStatus === 'pending' ? '入群申请审核中' : '你已退出该群聊' }}</strong><span>仍可查看群消息、让成员继续聊天或使用匿名小号发言</span></div>
      <button type="button" :disabled="membershipStatus === 'pending' || replying" @click="applyToRejoin">{{ membershipStatus === 'pending' ? '等待审核' : '申请加入' }}</button>
      <button type="button" @click="showAnonymousPanel = true">匿名回复</button>
      <button type="button" :disabled="replying" @click="requestObserverReply">群聊继续</button>
    </section>
    <MessageComposer
      v-if="isJoined"
      v-model="composerText"
      online
      :disabled="replying"
      :can-send-reply="allVisibleMessages.length > 0"
      :quote="quoteTarget"
      placeholder="发送消息到群聊"
      @cancel-quote="quoteTarget = null"
      @capture-photo="sendPhoto"
      @file-picker-open="beginFilePicker"
      @file-picker-close="endFilePicker"
      @prepare-focus="captureKeyboardScrollAnchor"
      @focus="handleComposerFocus"
      @blur="handleComposerBlur"
      @open-image-panel="showImagePanel = true"
      @open-menu="showActionMenu = true"
      @open-stickers="openStickerPanel"
      @open-voice-panel="showVoicePanel = true"
      @send="sendOnly"
      @reply="sendAndReply"
    />
    <StickerLibraryModal
      v-model="showStickers"
      :conversation-id="props.id"
      :disabled="replying"
      :quote="quoteTarget"
      @panel-height-change="handleStickerPanelHeightChange"
      @sent="quoteTarget = null"
    />

    <AppModal v-model="showActionMenu" title="群聊操作" :show-header="false" variant="ins">
      <section class="action-menu">
        <button type="button" @click="openModelSwitch">模型切换</button>
        <button type="button" :disabled="replying" @click="openRegenerate">重新回复</button>
        <button type="button" @click="openInvitePanel">邀请群成员</button>
        <button type="button" @click="openLeaveGroup">退出群聊</button>
        <button class="danger" type="button" @click="openDeleteGroup">删除群聊</button>
      </section>
    </AppModal>

    <AppModal v-model="showMessageActions" title="消息操作" :show-header="false" variant="ins">
      <section class="message-action-menu">
        <button type="button" @click="copyActiveMessage"><span>复制</span></button>
        <button type="button" @click="deleteActiveMessage"><span>删除</span></button>
        <button type="button" @click="startSelectionFromActive"><span>多选</span></button>
        <button type="button" :disabled="!canFavoriteActiveMessage || isActiveMessageFavorited" @click="favoriteActiveMessage"><span>{{ favoriteActionLabel }}</span></button>
        <button type="button" :disabled="!canRecallActiveMessage" @click="recallActiveMessage"><span>撤回</span></button>
        <button type="button" :disabled="!canQuoteActiveMessage" @click="quoteActiveMessage"><span>引用</span></button>
        <button type="button" :disabled="!canEditActiveMessage" @click="openEditActiveMessage"><span>编辑</span></button>
      </section>
    </AppModal>

    <AppModal v-model="showEditModal" title="编辑消息" :show-header="false" variant="ins">
      <section class="edit-message-sheet">
        <textarea v-model="editDraft" rows="5" placeholder="编辑消息内容"></textarea>
        <div class="edit-actions">
          <button class="secondary-action" type="button" @click="showEditModal = false">取消</button>
          <button class="primary-action" type="button" :disabled="!editDraft.trim()" @click="saveEditedMessage">保存</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showDeleteMessagesConfirm" title="确认删除" :show-header="false" variant="ins">
      <section class="delete-confirm-sheet">
        <h3>删除消息？</h3>
        <p>删除后群聊 AI 不会再读取这部分信息。</p>
        <div class="delete-confirm-actions">
          <button class="secondary-action" type="button" @click="cancelDeleteMessagesConfirm">取消</button>
          <button class="danger-action" type="button" @click="confirmDeleteMessages">删除</button>
        </div>
      </section>
    </AppModal>

    <input ref="localImageInputRef" class="hidden-file-input" type="file" accept="image/*" @change="sendImageFromInput" />

    <AppModal v-model="showImagePanel" title="发送图片" :show-header="false" variant="ins">
      <section class="image-send-panel">
        <div class="image-panel-head"><div><p>Image</p><h3>发送图片给 {{ conversation.title }}</h3></div></div>
        <nav class="image-tabs" aria-label="图片发送方式">
          <button type="button" :class="{ active: imageSendTab === 'local' }" @click="imageSendTab = 'local'">本地图片发送</button>
          <button type="button" :class="{ active: imageSendTab === 'description' }" @click="imageSendTab = 'description'">文字描述卡片</button>
        </nav>
        <section v-if="imageSendTab === 'local'" class="local-image-tab">
          <label class="description-field local-image-hint-field"><span>图片补充描述（可选）</span><textarea v-model="localImageHintDraft" maxlength="500" rows="3" placeholder="可以写画面重点、场景、人物或你希望 AI 理解到的细节。"></textarea></label>
          <button class="local-image-button" type="button" :disabled="sendingImage" @click="openGroupLocalImagePicker"><span>{{ sendingImage ? '处理中' : '选择本地图片' }}</span></button>
          <p>图片会以真实图片发送，支持后续模型识图。</p>
        </section>
        <section v-else class="description-image-tab">
          <figure class="description-preview"><figcaption>{{ imageDescriptionDraft.trim() || '写一段画面描述，发送后会显示成模拟图片卡片。' }}</figcaption></figure>
          <label class="description-field"><span>图片描述</span><textarea v-model="imageDescriptionDraft" maxlength="500" rows="5" placeholder="例如：傍晚便利店门口的自拍，玻璃上有暖色灯光反射，手里拿着一瓶冰咖啡。"></textarea></label>
          <button class="description-send-button" type="button" :disabled="sendingImage || !imageDescriptionDraft.trim()" @click="sendDescriptionImage">{{ sendingImage ? '发送中' : '发送描述卡片' }}</button>
        </section>
      </section>
    </AppModal>

    <AppModal v-model="showVoicePanel" title="发送语音" :show-header="false" variant="ins">
      <section class="voice-send-panel">
        <div class="voice-panel-head"><div><p>Voice</p><h3>发送语音给 {{ conversation.title }}</h3></div></div>
        <nav class="voice-tabs" aria-label="语音发送方式">
          <button type="button" :disabled="recording" :class="{ active: voiceSendTab === 'record' }" @click="voiceSendTab = 'record'">录音语音</button>
          <button type="button" :disabled="recording" :class="{ active: voiceSendTab === 'text' }" @click="voiceSendTab = 'text'">文字语音</button>
        </nav>
        <section v-if="voiceSendTab === 'record'" class="voice-record-tab">
          <div class="voice-recorder-card" :class="{ recording, ready: recordedAudio }"><strong>{{ voiceRecordStatus }}</strong><span>{{ formatVoiceDuration(recordedVoiceSeconds) }}</span><div class="voice-preview-wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div></div>
          <label class="voice-text-field"><span>语音内容</span><textarea v-model="voiceTranscriptDraft" maxlength="500" rows="4" placeholder="输入这条语音要表达的内容"></textarea></label>
          <div class="voice-actions"><button v-if="!recording" class="voice-secondary" type="button" :disabled="replying" @click="startRecording">{{ recordedAudio ? '重录' : '开始录音' }}</button><button v-else class="voice-secondary voice-secondary--stop" type="button" @click="stopRecording">停止</button><button class="voice-primary" type="button" :disabled="!recordedAudio || !voiceTranscriptDraft.trim() || replying || recording" @click="sendRecordedVoice">发送语音</button></div>
        </section>
        <section v-else class="voice-text-tab">
          <div class="voice-text-preview"><div class="voice-preview-wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div><strong>{{ formatVoiceDuration(textVoiceDuration) }}</strong></div>
          <label class="voice-text-field"><span>语音内容</span><textarea v-model="voiceTextDraft" maxlength="500" rows="5" placeholder="输入要作为语音发送的内容"></textarea></label>
          <button class="voice-primary" type="button" :disabled="!voiceTextDraft.trim() || replying" @click="sendTextVoice">发送语音</button>
        </section>
      </section>
    </AppModal>

    <AppModal v-model="showRegenerate" title="重新回复" :show-header="false" variant="ins">
      <section class="send-panel"><h3>重新生成上一轮群回复</h3><textarea v-model="regenerateInstruction" maxlength="600" rows="5" placeholder="可选：补充本次回复方向"></textarea><button class="primary" type="button" :disabled="replying" @click="confirmRegenerate">重新生成</button></section>
    </AppModal>

    <AppModal v-model="showDeleteConfirm" title="删除群聊" :show-header="false" variant="ins">
      <section class="send-panel"><h3>删除「{{ conversation.title }}」？</h3><p>会删除群消息、群记忆以及同步到角色私聊的群事件，操作不可恢复。</p><div class="confirm-actions"><button type="button" @click="showDeleteConfirm = false">取消</button><button class="danger solid" type="button" @click="confirmDeleteGroup">确认删除</button></div></section>
    </AppModal>

    <AppModal v-model="showLeaveConfirm" title="退出群聊" :show-header="false" variant="ins">
      <section class="send-panel"><h3>退出「{{ conversation.title }}」？</h3><p>群聊和历史仍会保留。退出后可以匿名发言、继续调用 API 观察群聊，也可以重新申请加入。</p><div class="confirm-actions"><button type="button" @click="showLeaveConfirm = false">取消</button><button class="danger solid" type="button" @click="confirmLeaveGroup">确认退出</button></div></section>
    </AppModal>

    <AppModal v-model="showAnonymousPanel" title="匿名小号" :show-header="false" variant="ins">
      <section class="send-panel"><h3>{{ conversation.groupAnonymousName || '匿名用户' }}</h3><p>群成员和 AI 不会获知该匿名账号与当前用户真名的关系。</p><textarea v-model="anonymousDraft" maxlength="500" rows="5" placeholder="匿名发送一条群消息"></textarea><div class="confirm-actions"><button type="button" :disabled="!anonymousDraft.trim()" @click="sendAnonymous(false)">仅发送</button><button class="primary" type="button" :disabled="!anonymousDraft.trim() || replying" @click="sendAnonymous(true)">发送并回复</button></div></section>
    </AppModal>

    <AppModal v-model="showInvitePanel" title="邀请群成员" :show-header="false" variant="ins">
      <section class="send-panel"><h3>邀请当前账号绑定角色</h3><p>角色会作为真实成员加入群聊，并继承其已有设定和连续记忆。</p><div class="invite-list"><label v-for="character in invitableCharacters" :key="character.id"><img :src="character.avatar" :alt="character.name" /><span><b>{{ character.name }}</b><small>{{ character.nickname }}</small></span><input v-model="inviteCharacterIds" type="checkbox" :value="character.id" /></label><p v-if="!invitableCharacters.length">当前没有可邀请的新角色。</p></div><button class="primary" type="button" :disabled="!inviteCharacterIds.length" @click="confirmInviteCharacters">确认邀请</button></section>
    </AppModal>

    <Teleport to="body">
      <div v-if="showDetails" class="details-mask" @click.self="showDetails = false">
        <section class="details-sheet" role="dialog" aria-modal="true" aria-label="群聊资料">
          <header><strong>群聊资料</strong><button type="button" @click="showDetails = false"><X :size="22" /></button></header>
          <template v-if="canManageGroup"><label class="group-edit-field"><span>群名称</span><input v-model="groupTitleDraft" maxlength="40" /></label><label class="group-edit-field"><span>群公告</span><textarea v-model="groupAnnouncementDraft" maxlength="500" rows="4"></textarea></label><button class="group-save-button" type="button" @click="saveGroupProfile">保存群资料</button></template>
          <template v-else><h2>{{ conversation.title }}</h2><p>{{ conversation.groupAnnouncement || '暂无群公告' }}</p></template>
          <section class="proactive-settings"><label><span>主动群消息</span><input :checked="chatSettings.proactiveReply.enabled" type="checkbox" @change="updateProactiveEnabled" /></label><label><span>频率</span><select :value="chatSettings.proactiveReply.frequency" :disabled="!chatSettings.proactiveReply.enabled" @change="updateProactiveFrequency"><option value="very-low">很低</option><option value="low">低</option><option value="medium">中</option><option value="high">高</option><option value="very-high">很高</option><option value="always">频繁</option></select></label></section>
          <div class="member-grid"><button v-for="member in conversation.groupMembers" :key="member.id" type="button" @click="insertMention(member.trueName)"><img :src="member.avatar || fallbackAvatar" :alt="member.trueName" /><strong>{{ member.trueName }}</strong><span>{{ member.nickname }}<small v-if="member.role !== 'member'"> · {{ member.role === 'owner' ? '群主' : '管理员' }}</small></span></button></div>
        </section>
      </div>
    </Teleport>

    <ChatModelSwitchPanel v-model="showModelSwitch" :conversation-id="props.id" />
  </section>
  <section v-else class="screen no-tabs missing-group"><p>群聊不存在或已被删除</p><button type="button" @click="router.replace({ name: 'home' })">返回聊天列表</button></section>
</template>

<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { X } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import ChatHeader from '@/components/chat/ChatHeader.vue';
import ChatModelSwitchPanel from '@/components/chat/ChatModelSwitchPanel.vue';
import GroupAnnouncementBanner from '@/components/chat/GroupAnnouncementBanner.vue';
import MessageBubble from '@/components/chat/MessageBubble.vue';
import MessageComposer from '@/components/chat/MessageComposer.vue';
import StickerLibraryModal from '@/components/stickers/StickerLibraryModal.vue';
import { useAppStore } from '@/stores/appStore';
import type { CharacterProfile, ChatMessage, ChatMessageQuote, VoomFrequency } from '@/types/domain';
import { readChatImageFile } from '@/utils/imageFile';
import { useKeyboardScrollGuard } from '@/utils/keyboardScrollGuard';
import { resolveMessageGroupPositions } from '@/utils/messageGrouping';
import { formatChatTimeDivider, shouldShowChatTimeDivider } from '@/utils/time';

const props = defineProps<{ id: string }>();
const store = useAppStore();
const router = useRouter();
const messageList = ref<HTMLElement | null>(null);
const shouldStickToBottom = ref(true);
const showDetails = ref(false);
const showActionMenu = ref(false);
const showModelSwitch = ref(false);
const showMessageActions = ref(false);
const showEditModal = ref(false);
const showDeleteMessagesConfirm = ref(false);
const showImagePanel = ref(false);
const showVoicePanel = ref(false);
const showRegenerate = ref(false);
const showDeleteConfirm = ref(false);
const showLeaveConfirm = ref(false);
const showAnonymousPanel = ref(false);
const showInvitePanel = ref(false);
const showStickers = ref(false);
const stickerPanelHeight = ref(0);
const composerText = ref('');
const quoteTarget = ref<ChatMessageQuote | null>(null);
const activeMessage = ref<ChatMessage | null>(null);
const selectionMode = ref(false);
const selectedMessageIds = ref<string[]>([]);
const pendingDeleteIds = ref<string[]>([]);
const pendingDeleteFromSelection = ref(false);
const editDraft = ref('');
const imageSendTab = ref<'local' | 'description'>('local');
const localImageHintDraft = ref('');
const imageDescriptionDraft = ref('');
const sendingImage = ref(false);
const localImageInputRef = ref<HTMLInputElement | null>(null);
const voiceSendTab = ref<'record' | 'text'>('record');
const voiceTranscriptDraft = ref('');
const voiceTextDraft = ref('');
const regenerateInstruction = ref('');
const anonymousDraft = ref('');
const inviteCharacterIds = ref<string[]>([]);
const groupTitleDraft = ref('');
const groupAnnouncementDraft = ref('');
const recording = ref(false);
const recordingSeconds = ref(0);
const recordedAudio = ref<{ audioUrl: string; duration: number; mimeType: string } | null>(null);
let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let mediaChunks: Blob[] = [];
let recordingStartedAt = 0;
let recordingTimer: number | undefined;
const { captureKeyboardScrollAnchor, startKeyboardScrollGuard, stopKeyboardScrollGuard } = useKeyboardScrollGuard(messageList);

const conversation = computed(() => { const value = store.conversationById(props.id); return value?.kind === 'group' ? value : null; });
const allVisibleMessages = computed(() => store.messagesForConversation(props.id).filter((message) => !message.contextOnly && message.mode === 'online'));
const selectedMessageCount = computed(() => selectedMessageIds.value.length);
const activeMessageIsSynthetic = computed(() => Boolean(activeMessage.value?.id.includes('__')));
const canRecallActiveMessage = computed(() => Boolean(activeMessage.value && activeMessage.value.sender !== 'system' && !activeMessageIsSynthetic.value));
const canQuoteActiveMessage = computed(() => Boolean(activeMessage.value && canQuoteMessage(activeMessage.value)));
const canEditActiveMessage = computed(() => Boolean(activeMessage.value && activeMessage.value.sender !== 'system' && !activeMessageIsSynthetic.value));
const canFavoriteActiveMessage = computed(() => Boolean(activeMessage.value && !activeMessageIsSynthetic.value && store.canFavoriteMessage(activeMessage.value)));
const isActiveMessageFavorited = computed(() => Boolean(activeMessage.value && store.isMessageFavorited(activeMessage.value.id)));
const favoriteActionLabel = computed(() => isActiveMessageFavorited.value ? '已收藏' : canFavoriteActiveMessage.value ? '收藏' : '不可收藏');
const replying = computed(() => store.isConversationReplying(props.id));
const chatSettings = computed(() => store.settingsForConversation(props.id));
const conversationUser = computed(() => conversation.value ? store.userById(conversation.value.userId) : undefined);
const primaryCharacter = computed(() => conversation.value?.groupMembers?.flatMap((member) => member.identityType === 'character' && member.identityId ? [store.characterById(member.identityId)] : []).find(Boolean));
const activeMemberCount = computed(() => conversation.value?.groupMembers?.filter((member) => (member.membershipStatus ?? 'active') === 'active').length ?? 0);
const groupHeaderTitle = computed(() => `${conversation.value?.title ?? '群聊'}（${activeMemberCount.value}）`);
const chatSurfaceStyle = computed(() => ({
  backgroundColor: chatSettings.value.appearance.backgroundColor,
  backgroundImage: chatSettings.value.appearance.backgroundImage ? `url(${chatSettings.value.appearance.backgroundImage})` : 'none'
}));
const messageEntries = computed(() => {
  const messages = allVisibleMessages.value;
  const timeLabels = messages.map((message, messageIndex) => {
    const previousMessage = messages[messageIndex - 1];
    return shouldShowChatTimeDivider(message.createdAt, previousMessage?.createdAt) ? formatChatTimeDivider(message.createdAt) : '';
  });
  const groupPositions = resolveMessageGroupPositions(messages, timeLabels.map(Boolean));
  return messages.map((message, messageIndex) => ({
    message,
    messageIndex,
    timeLabel: timeLabels[messageIndex],
    groupPosition: groupPositions[messageIndex]
  }));
});
const messageVirtualizer = useVirtualizer(computed(() => ({
  count: messageEntries.value.length,
  getScrollElement: () => messageList.value,
  estimateSize: () => 88,
  getItemKey: (index: number) => messageEntries.value[index]?.message.id ?? index,
  overscan: 8,
  anchorTo: 'end' as const,
  followOnAppend: 'auto' as const,
  scrollEndThreshold: 80,
  useAnimationFrameWithResizeObserver: true
})));
const virtualMessageRows = computed(() => messageVirtualizer.value.getVirtualItems());
const virtualMessageTotalSize = computed(() => messageVirtualizer.value.getTotalSize());
function measureVirtualMessageElement(element: unknown) { if (element instanceof Element) messageVirtualizer.value.measureElement(element); }
const currentUserMember = computed(() => conversation.value?.groupMembers?.find((member) => member.identityType === 'user' && member.identityId === conversation.value?.userId) ?? null);
const membershipStatus = computed(() => currentUserMember.value?.membershipStatus ?? 'active');
const isJoined = computed(() => membershipStatus.value === 'active');
const canManageGroup = computed(() => isJoined.value && (currentUserMember.value?.role === 'owner' || currentUserMember.value?.role === 'admin'));
const existingCharacterIds = computed(() => new Set(conversation.value?.groupMembers?.filter((member) => member.identityType === 'character').map((member) => member.identityId) ?? []));
const invitableCharacters = computed(() => store.charactersForActiveUser.filter((character) => !existingCharacterIds.value.has(character.id)));
const fallbackAvatar = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#eaf5ee"/><circle cx="25" cy="27" r="10" fill="#79b88e"/><circle cx="43" cy="29" r="8" fill="#9ac9aa"/><path d="M10 57c2-13 11-20 22-20s20 7 22 20" fill="#79b88e"/></svg>')}`;

function avatarForMessage(message: ChatMessage) { return conversation.value?.groupMembers?.find((item) => item.identityId === message.authorId || item.id === message.authorId)?.avatar || fallbackAvatar; }
function characterForMessage(message: ChatMessage): CharacterProfile { return (message.authorId ? store.characterById(message.authorId) : undefined) ?? primaryCharacter.value!; }
function shouldHideAvatar(index: number) { const current = allVisibleMessages.value[index]; const previous = allVisibleMessages.value[index - 1]; return Boolean(chatSettings.value.appearance.showOnlyFirstAvatarInReply && current && previous && current.sender !== 'system' && current.sender === previous.sender && current.authorId === previous.authorId); }
function messageText(message: ChatMessage) { if (message.sticker) return `[Sticker] ${message.sticker.description}`; if (message.image) return `[图片] ${message.image.description}`; if (message.voice) return `[语音] ${message.voice.transcript}`; return message.content; }
async function scrollToBottom() { await nextTick(); if (messageList.value) { messageVirtualizer.value.scrollToEnd({ behavior: 'auto' }); messageList.value.scrollLeft = 0; messageList.value.scrollTop = messageList.value.scrollHeight; shouldStickToBottom.value = true; } }
function handleMessageListScroll() { const list = messageList.value; if (!list) return; shouldStickToBottom.value = list.scrollHeight - list.clientHeight - list.scrollTop <= 80; }
function handleComposerFocus() { const keepBottom = shouldStickToBottom.value; startKeyboardScrollGuard(); if (keepBottom) void scrollToBottom(); }
function handleComposerBlur() { stopKeyboardScrollGuard(); }

async function sendOnly(content: string) { await store.appendGroupUserMessage(props.id, content, quoteTarget.value); quoteTarget.value = null; await scrollToBottom(); }
async function sendAndReply(content: string) { if (content.trim()) await store.appendGroupUserMessage(props.id, content, quoteTarget.value); quoteTarget.value = null; await scrollToBottom(); await store.requestGroupReply(props.id); await scrollToBottom(); }

function insertMention(name: string) { composerText.value = `${composerText.value}${composerText.value && !composerText.value.endsWith(' ') ? ' ' : ''}@${name} `; showDetails.value = false; }
function mentionMessageAuthor(message: ChatMessage) { if (message.sender !== 'system' && message.authorType !== 'user' && message.authorName) insertMention(message.authorName); }
function createQuoteSnapshot(message: ChatMessage) { if (message.sender === 'system' || message.id.includes('__')) return null; try { return store.createMessageQuoteSnapshot(message); } catch { return null; } }
function canQuoteMessage(message: ChatMessage) { return Boolean(createQuoteSnapshot(message)); }
function quoteMessage(message: ChatMessage) { const quote = createQuoteSnapshot(message); if (quote) quoteTarget.value = quote; }
function openStickerPanel() { const keepBottom = shouldStickToBottom.value; showStickers.value = true; if (keepBottom) void scrollToBottom(); }
function handleStickerPanelHeightChange(height: number) { const keepBottom = shouldStickToBottom.value; stickerPanelHeight.value = Math.max(0, height); if (keepBottom) void scrollToBottom(); }
function openChatSearch() { void router.push({ name: 'chat-search', params: { id: props.id } }); }
function openChatSettings() { void router.push({ name: 'chat-settings', params: { id: props.id } }); }
function openModelSwitch() { showActionMenu.value = false; showModelSwitch.value = true; }
async function enterOffline() { if (replying.value || !isJoined.value) return; await store.updateConversationMode(props.id, 'offline'); await router.replace({ name: 'offline-room', params: { id: props.id } }); }
function openRegenerate() { showActionMenu.value = false; regenerateInstruction.value = ''; showRegenerate.value = true; }
function openDeleteGroup() { showActionMenu.value = false; showDeleteConfirm.value = true; }
function openLeaveGroup() { showActionMenu.value = false; showLeaveConfirm.value = true; }
function openInvitePanel() { showActionMenu.value = false; inviteCharacterIds.value = []; showInvitePanel.value = true; }

function openMessageMenu(message: ChatMessage) { activeMessage.value = message; showMessageActions.value = true; }
function messageIdsForAction(message: ChatMessage) { return message.id.split('__').map((id) => id.trim()).filter(Boolean); }
function isMessageSelected(message: ChatMessage) { const selectedIds = new Set(selectedMessageIds.value); const ids = messageIdsForAction(message); return ids.length > 0 && ids.every((id) => selectedIds.has(id)); }
function toggleMessageSelection(message: ChatMessage) { const ids = messageIdsForAction(message); const selectedIds = new Set(selectedMessageIds.value); const allSelected = ids.every((id) => selectedIds.has(id)); ids.forEach((id) => allSelected ? selectedIds.delete(id) : selectedIds.add(id)); selectedMessageIds.value = [...selectedIds]; }
function cancelSelection() { selectionMode.value = false; selectedMessageIds.value = []; }
function clearQuoteIfMessagesRemoved(messageIds: string[]) { if (quoteTarget.value && messageIds.includes(quoteTarget.value.messageId)) quoteTarget.value = null; }
async function copyActiveMessage() { if (!activeMessage.value) return; try { await navigator.clipboard.writeText(messageText(activeMessage.value)); store.showConfigAlert('已复制消息内容。', '已复制'); } catch { store.showConfigAlert('当前浏览器不允许写入剪贴板。', '复制失败'); } showMessageActions.value = false; }
function quoteActiveMessage() { if (!activeMessage.value || !canQuoteActiveMessage.value) return; quoteMessage(activeMessage.value); showMessageActions.value = false; }
async function recallActiveMessage() { const message = activeMessage.value; if (!message || !canRecallActiveMessage.value || message.sender === 'system') return; await store.recallMessage(message.id, { actor: message.sender }); clearQuoteIfMessagesRemoved([message.id]); showMessageActions.value = false; }
function deleteActiveMessage() { if (!activeMessage.value) return; pendingDeleteIds.value = messageIdsForAction(activeMessage.value); pendingDeleteFromSelection.value = false; showMessageActions.value = false; showDeleteMessagesConfirm.value = true; }
function startSelectionFromActive() { if (activeMessage.value) selectedMessageIds.value = messageIdsForAction(activeMessage.value); selectionMode.value = true; showMessageActions.value = false; }
async function favoriteActiveMessage() { const message = activeMessage.value; if (!message || !canFavoriteActiveMessage.value || isActiveMessageFavorited.value) return; const favorite = await store.addFavoriteMessage(message); if (!favorite) return; showMessageActions.value = false; store.showConfigAlert('已加入收藏。', '收藏成功'); }
function deleteSelectedMessages() { if (!selectedMessageIds.value.length) return; pendingDeleteIds.value = [...selectedMessageIds.value]; pendingDeleteFromSelection.value = true; showDeleteMessagesConfirm.value = true; }
function cancelDeleteMessagesConfirm() { pendingDeleteIds.value = []; pendingDeleteFromSelection.value = false; showDeleteMessagesConfirm.value = false; }
async function confirmDeleteMessages() { const ids = [...pendingDeleteIds.value]; if (!ids.length) return cancelDeleteMessagesConfirm(); await store.deleteMessages(ids); clearQuoteIfMessagesRemoved(ids); if (pendingDeleteFromSelection.value) cancelSelection(); cancelDeleteMessagesConfirm(); }
function openEditActiveMessage() { const message = activeMessage.value; if (!message || !canEditActiveMessage.value) return; editDraft.value = message.voice?.transcript ?? message.sticker?.description ?? message.image?.description ?? message.content; showMessageActions.value = false; showEditModal.value = true; }
async function saveEditedMessage() { const message = activeMessage.value; if (!message || !canEditActiveMessage.value || !editDraft.value.trim()) return; await store.updateMessageContent(message.id, editDraft.value); showEditModal.value = false; }

async function sendImageFile(file: File, kind: 'photo' | 'local') { const image = await readChatImageFile(file); await store.appendUserImageMessage(props.id, '[图片]', { kind, description: kind === 'photo' ? '相机照片' : '本地图片', aiHint: kind === 'local' ? localImageHintDraft.value.trim() || undefined : undefined, url: image.dataUrl, fileName: file.name, mimeType: image.mimeType, width: image.width, height: image.height }, quoteTarget.value); if (kind === 'local') localImageHintDraft.value = ''; quoteTarget.value = null; showImagePanel.value = false; }
async function sendPhoto(file: File) { try { await sendImageFile(file, 'photo'); } catch (error) { store.showConfigAlert(error instanceof Error ? error.message : '图片读取失败。', '无法发送图片'); } }
async function sendImageFromInput(event: Event) { endFilePicker(); const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file?.type.startsWith('image/')) return; sendingImage.value = true; try { await sendImageFile(file, 'local'); } finally { sendingImage.value = false; } }
function beginFilePicker(kind: 'camera' | 'local' = 'local') { store.setAppUpdateTransientOperation(`group-file-picker:${props.id}`, kind === 'camera' ? '正在选择群聊相机图片' : '正在选择群聊本地图片', true); window.setTimeout(() => window.addEventListener('focus', endFilePicker, { once: true }), 0); }
function endFilePicker() { window.setTimeout(() => store.setAppUpdateTransientOperation(`group-file-picker:${props.id}`, '', false), 250); }
function openGroupLocalImagePicker() { beginFilePicker('local'); localImageInputRef.value?.click(); }
async function sendDescriptionImage() { const description = imageDescriptionDraft.value.trim(); if (!description) return; sendingImage.value = true; try { await store.appendUserImageMessage(props.id, `[图片描述卡片] ${description}`, { kind: 'description', description }, quoteTarget.value); imageDescriptionDraft.value = ''; quoteTarget.value = null; showImagePanel.value = false; } finally { sendingImage.value = false; } }

function blobToDataUrl(blob: Blob) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? '')); reader.onerror = () => reject(new Error('语音读取失败。')); reader.readAsDataURL(blob); }); }
async function startRecording() { if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { store.showConfigAlert('当前浏览器不支持录音。', '无法录音'); return; } cleanupRecording(); try { mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true }); mediaRecorder = new MediaRecorder(mediaStream); mediaChunks = []; mediaRecorder.ondataavailable = (event) => { if (event.data.size) mediaChunks.push(event.data); }; mediaRecorder.onstop = () => { void finishRecording(); }; recordingStartedAt = Date.now(); recording.value = true; recordingTimer = window.setInterval(() => { recordingSeconds.value = Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000)); }, 250); mediaRecorder.start(); } catch (error) { cleanupRecording(); store.showConfigAlert(error instanceof Error ? error.message : '请允许麦克风权限。', '无法录音'); } }
function stopRecording() { if (mediaRecorder?.state !== 'inactive') mediaRecorder?.stop(); }
async function finishRecording() { const duration = Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000)); const mimeType = mediaRecorder?.mimeType || mediaChunks[0]?.type || 'audio/webm'; const blob = new Blob(mediaChunks, { type: mimeType }); const audioUrl = await blobToDataUrl(blob); cleanupRecording(); recordedAudio.value = { audioUrl, duration, mimeType }; }
function cleanupRecording() { if (recordingTimer !== undefined) window.clearInterval(recordingTimer); recordingTimer = undefined; recording.value = false; recordingSeconds.value = 0; mediaStream?.getTracks().forEach((track) => track.stop()); mediaStream = null; mediaRecorder = null; mediaChunks = []; }
const recordedVoiceSeconds = computed(() => recording.value ? recordingSeconds.value : recordedAudio.value?.duration ?? 0);
const textVoiceDuration = computed(() => Math.max(1, Math.ceil(voiceTextDraft.value.trim().length / 4)));
const voiceRecordStatus = computed(() => recording.value ? '正在录音' : recordedAudio.value ? '录音已就绪' : '等待录音');
function formatVoiceDuration(seconds: number) { const safeSeconds = Math.max(0, Math.round(seconds)); return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`; }
async function sendRecordedVoice() { const transcript = voiceTranscriptDraft.value.trim(); const audio = recordedAudio.value; if (!transcript || !audio) return; await store.appendUserVoiceMessage(props.id, { source: 'recorded', transcript, duration: audio.duration, audioUrl: audio.audioUrl, mimeType: audio.mimeType }, quoteTarget.value); voiceTranscriptDraft.value = ''; recordedAudio.value = null; quoteTarget.value = null; showVoicePanel.value = false; }
async function sendTextVoice() { const transcript = voiceTextDraft.value.trim(); if (!transcript) return; await store.appendUserVoiceMessage(props.id, { source: 'text', transcript, duration: textVoiceDuration.value }, quoteTarget.value); voiceTextDraft.value = ''; quoteTarget.value = null; showVoicePanel.value = false; }

function syncGroupTransientOperations() {
  const conversationKey = props.id;
  store.setAppUpdateTransientOperation(`group-draft:${conversationKey}`, '存在未发送的群聊草稿', Boolean(composerText.value.trim()) || Boolean(anonymousDraft.value.trim()));
  store.setAppUpdateTransientOperation(`group-image:${conversationKey}`, '正在处理群聊图片或图片草稿', sendingImage.value || Boolean(localImageHintDraft.value.trim()) || Boolean(imageDescriptionDraft.value.trim()));
  store.setAppUpdateTransientOperation(`group-recording:${conversationKey}`, '正在录音或保留群聊语音草稿', recording.value || Boolean(recordedAudio.value) || Boolean(voiceTranscriptDraft.value.trim()) || Boolean(voiceTextDraft.value.trim()));
  store.setAppUpdateTransientOperation(`group-edit:${conversationKey}`, '存在未保存的群聊编辑', showEditModal.value && Boolean(editDraft.value.trim()));
  store.setAppUpdateTransientOperation(`group-profile:${conversationKey}`, '存在未保存的群资料草稿', showDetails.value && Boolean(groupTitleDraft.value.trim() || groupAnnouncementDraft.value.trim()));
  store.setAppUpdateTransientOperation(`group-regenerate:${conversationKey}`, '存在未提交的群聊回复指令', showRegenerate.value && Boolean(regenerateInstruction.value.trim()));
}

watch([
  composerText,
  anonymousDraft,
  sendingImage,
  localImageHintDraft,
  imageDescriptionDraft,
  recording,
  recordedAudio,
  voiceTranscriptDraft,
  voiceTextDraft,
  showEditModal,
  editDraft,
  showDetails,
  groupTitleDraft,
  groupAnnouncementDraft,
  showRegenerate,
  regenerateInstruction
], syncGroupTransientOperations, { immediate: true });

async function confirmRegenerate() { showRegenerate.value = false; await store.regenerateLatestGroupReply(props.id, regenerateInstruction.value); await scrollToBottom(); }
async function confirmDeleteGroup() { const deleted = await store.deleteGroupConversation(props.id); if (deleted) await router.replace({ name: 'home' }); }
async function confirmLeaveGroup() { const left = await store.leaveGroupConversation(props.id); if (left) { showLeaveConfirm.value = false; quoteTarget.value = null; } }
async function applyToRejoin() { await store.applyToRejoinGroup(props.id); await scrollToBottom(); }
async function requestObserverReply() { await store.requestGroupReply(props.id, { instruction: '用户当前不在群内，只是在旁观。请让群内成员基于既有话题和各自生活状态自然继续聊天，不要把旁观用户写成已在群内发言。', allowPrivateInitiation: false }); await scrollToBottom(); }
async function sendAnonymous(withReply: boolean) { const content = anonymousDraft.value.trim(); if (!content) return; await store.appendAnonymousGroupMessage(props.id, content); anonymousDraft.value = ''; showAnonymousPanel.value = false; if (withReply) await store.requestGroupReply(props.id, { instruction: '群里刚出现了一条匿名小号消息。群成员可以按语境自然回应，但绝对不能推断或泄露匿名账号对应的真实用户身份。' }); await scrollToBottom(); }
async function confirmInviteCharacters() { try { await store.inviteCharactersToGroup(props.id, inviteCharacterIds.value); inviteCharacterIds.value = []; showInvitePanel.value = false; await scrollToBottom(); } catch (error) { store.showConfigAlert(error instanceof Error ? error.message : '邀请成员失败。', '无法邀请'); } }
async function saveGroupProfile() { try { await store.updateManagedGroupProfile(props.id, { title: groupTitleDraft.value, announcement: groupAnnouncementDraft.value }); showDetails.value = false; } catch (error) { store.showConfigAlert(error instanceof Error ? error.message : '群资料保存失败。', '无法保存'); } }
async function updateProactiveEnabled(event: Event) { await store.saveConversationSettings({ ...chatSettings.value, proactiveReply: { ...chatSettings.value.proactiveReply, enabled: (event.target as HTMLInputElement).checked } }); }
async function updateProactiveFrequency(event: Event) { await store.saveConversationSettings({ ...chatSettings.value, proactiveReply: { ...chatSettings.value.proactiveReply, frequency: (event.target as HTMLSelectElement).value as VoomFrequency } }); }

watch(() => allVisibleMessages.value.length, (nextLength, previousLength) => {
  const addedCount = Math.max(0, nextLength - previousLength);
  if (!addedCount) return;
  if (shouldStickToBottom.value) void scrollToBottom();
});
watch(() => props.id, (id, previousId) => {
  if (previousId) {
    store.setAppUpdateTransientOperation(`group-draft:${previousId}`, '', false);
    store.setAppUpdateTransientOperation(`group-file-picker:${previousId}`, '', false);
    store.setAppUpdateTransientOperation(`group-image:${previousId}`, '', false);
    store.setAppUpdateTransientOperation(`group-recording:${previousId}`, '', false);
    store.setAppUpdateTransientOperation(`group-edit:${previousId}`, '', false);
    store.setAppUpdateTransientOperation(`group-profile:${previousId}`, '', false);
    store.setAppUpdateTransientOperation(`group-regenerate:${previousId}`, '', false);
    void store.flushConversationMemory(previousId);
  }
  void (async () => {
    await store.ensureConversationMessagesLoaded(id);
    store.setActiveConversation(id);
    await store.markConversationRead(id);
    shouldStickToBottom.value = true;
    await scrollToBottom();
  })();
});
watch(conversation, (value) => { groupTitleDraft.value = value?.title ?? ''; groupAnnouncementDraft.value = value?.groupAnnouncement ?? ''; }, { immediate: true });
onMounted(async () => {
  await store.hydrate();
  await store.ensureConversationMessagesLoaded(props.id);
  store.setActiveConversation(props.id);
  await store.markConversationRead(props.id);
  await scrollToBottom();
});
onBeforeUnmount(() => {
  cleanupRecording();
  store.setAppUpdateTransientOperation(`group-draft:${props.id}`, '', false);
  store.setAppUpdateTransientOperation(`group-file-picker:${props.id}`, '', false);
  store.setAppUpdateTransientOperation(`group-image:${props.id}`, '', false);
  store.setAppUpdateTransientOperation(`group-recording:${props.id}`, '', false);
  store.setAppUpdateTransientOperation(`group-edit:${props.id}`, '', false);
  store.setAppUpdateTransientOperation(`group-profile:${props.id}`, '', false);
  store.setAppUpdateTransientOperation(`group-regenerate:${props.id}`, '', false);
  void store.flushConversationMemory(props.id);
  store.setActiveConversation(null);
});
</script>

<style scoped>
.group-chat-page :deep(.chat-header),
.group-chat-page :deep(.composer) { background:transparent;backdrop-filter:none }
.message-list { flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:8px 10px calc(8px + var(--keyboard-inset));-webkit-overflow-scrolling:touch;overflow-anchor:none;scroll-padding-bottom:calc(8px + var(--keyboard-inset)) }
.message-virtualizer { position:relative;width:100% }
.message-virtual-item { position:absolute;top:0;left:0;display:flow-root;width:100% }
.group-chat-page :deep(.composer) { transform:translate3d(0,calc(0px - var(--keyboard-inset)),0) }
.message-time-divider { display:flex;justify-content:center;margin:12px 0 8px;pointer-events:none }
.message-time-divider time { max-width:calc(100% - 32px);padding:3px 8px;border-radius:999px;background:rgba(245,246,248,.82);color:#7b828a;font-size:11px;font-weight:680;line-height:1.2;box-shadow:0 1px 6px rgba(17,20,24,.06);backdrop-filter:blur(12px) }
.typing-indicator { display:inline-flex;align-items:center;gap:3px;margin:7px 0 7px 38px;padding:8px 11px;border-radius:15px;background:#fff }
.typing-indicator span { width:5px;height:5px;border-radius:50%;background:#9da1a6;animation:typing .9s infinite ease-in-out }
.typing-indicator span:nth-child(2) { animation-delay:.12s }.typing-indicator span:nth-child(3) { animation-delay:.24s }
.hidden-file-input { position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap }
.image-send-panel,.voice-send-panel { display:grid;gap:12px;width:100%;min-width:0;container-type:inline-size }
.image-panel-head,.voice-panel-head { display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0 }
.image-panel-head>div,.voice-panel-head>div { min-width:0 }
.image-panel-head p,.voice-panel-head p { margin:0 0 3px;font-size:10px;font-weight:900;letter-spacing:.08em;text-transform:uppercase }
.image-panel-head p { color:#8a6672 }.voice-panel-head p { color:#3c6f63 }
.image-panel-head h3,.voice-panel-head h3 { margin:0;color:#211f24;font-size:16px;line-height:1.2;overflow-wrap:anywhere }
.image-tabs,.voice-tabs { display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:3px;border-radius:10px;background:rgba(255,255,255,.74) }
.image-tabs button,.voice-tabs button { min-width:0;min-height:34px;padding:6px 8px;border-radius:8px;color:#59606a;font-size:12px;font-weight:900;line-height:1.2;overflow-wrap:anywhere }
.image-tabs button.active,.voice-tabs button.active { background:#fff;color:#171717;box-shadow:0 1px 8px rgba(37,31,37,.08) }
.voice-tabs button:disabled { opacity:.52;cursor:default }
.local-image-tab,.description-image-tab,.voice-record-tab,.voice-text-tab { display:grid;gap:10px;min-width:0;max-width:100% }
.local-image-button { display:grid;align-items:center;justify-content:center;min-width:0;min-height:46px;padding:8px 12px;border-radius:10px;background:#eff1f3;color:#2d333a;font-size:13px;font-weight:900;line-height:1.25;overflow-wrap:anywhere }
.local-image-tab p { margin:0;color:#737983;font-size:12px;line-height:1.45 }
.description-preview { display:grid;place-items:center;width:min(100%,220px);min-width:0;margin:0 auto;aspect-ratio:1/1;padding:20px;overflow:hidden;border:1px solid #edf0f2;border-radius:18px;background:#fff;color:#222;box-shadow:0 8px 26px rgba(37,31,37,.08) }
.description-preview figcaption { max-width:100%;max-height:100%;overflow:auto;margin:0;font-size:13px;font-weight:820;line-height:1.65;text-align:center;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word }
.description-field,.voice-text-field { display:grid;gap:6px;min-width:0 }
.description-field span,.voice-text-field span { color:#686b70;font-size:12px;font-weight:900 }
.description-field textarea,.voice-text-field textarea { display:block;width:100%;min-width:0;resize:none;overflow:auto;border:1px solid #edf0f2;border-radius:10px;padding:10px;background:#fff;color:#171717;font:inherit;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word }
.description-field textarea { min-height:112px;max-height:min(34dvh,180px) }.local-image-hint-field textarea { min-height:78px }
.voice-text-field textarea { min-height:98px;max-height:min(34dvh,170px) }
.description-send-button,.voice-secondary,.voice-primary { min-width:0;min-height:42px;padding:9px 12px;border-radius:10px;background:#eff1f3;color:#2d333a;font-size:13px;font-weight:900;line-height:1.25;overflow-wrap:anywhere }
.voice-recorder-card,.voice-text-preview { display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;min-height:54px;padding:10px 12px;border-radius:12px;background:#f4f6f5;color:#27342f }
.voice-recorder-card.recording { background:#e9f8ef;color:#0a6231 }.voice-recorder-card.ready { background:#eef6f1 }
.voice-recorder-card strong,.voice-text-preview strong { min-width:0;font-size:13px;font-weight:900;line-height:1.25;overflow-wrap:anywhere }.voice-recorder-card>span { font-size:12px;font-weight:850;opacity:.68 }
.voice-preview-wave { grid-column:1/-1;display:flex;align-items:center;gap:3px;min-height:18px }.voice-preview-wave span { width:3px;border-radius:999px;background:currentColor;opacity:.62 }.voice-preview-wave span:nth-child(1){height:8px}.voice-preview-wave span:nth-child(2){height:14px}.voice-preview-wave span:nth-child(3){height:18px}.voice-preview-wave span:nth-child(4){height:12px}.voice-preview-wave span:nth-child(5){height:16px}
.voice-actions { display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px }.voice-secondary { background:#eef1f2;color:#20272d }.voice-secondary--stop { background:#1f2f28;color:#fff }
.local-image-button:disabled,.description-send-button:disabled,.voice-secondary:disabled,.voice-primary:disabled { opacity:.45;cursor:default }
@media(max-width:360px),(max-height:700px){.image-send-panel{gap:10px}.description-preview{width:min(100%,190px);padding:16px}.description-field textarea{min-height:92px}}
.group-chat-page{display:flex;flex-direction:column;height:100%;overflow:hidden;padding-bottom:0;background:#f1f4f2}.group-header{display:grid;grid-template-columns:44px minmax(0,1fr) 44px;align-items:center;min-height:56px;padding:var(--safe-top) calc(8px + var(--safe-right)) 0 calc(8px + var(--safe-left));background:rgba(255,255,255,.94);border-bottom:1px solid rgba(17,17,17,.05);backdrop-filter:blur(18px)}.group-header>button{display:flex;align-items:center;justify-content:center;min-height:44px}.group-title{display:grid!important;gap:1px;min-width:0}.group-title strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px}.group-title span{color:#8a9093;font-size:10px}.group-messages{flex:1;min-height:0;overflow-y:auto;padding:12px calc(13px + var(--safe-right)) 16px calc(13px + var(--safe-left));overscroll-behavior:contain}.announcement-bar{display:flex;align-items:flex-start;gap:7px;margin-bottom:15px;padding:9px 11px;border-radius:13px;background:rgba(255,255,255,.75);color:#68706c;line-height:1.45}.system-message{width:fit-content;max-width:84%;margin:10px auto;padding:4px 9px;border-radius:999px;background:rgba(118,128,123,.13);color:#858c88;font-size:10px}.group-message{display:flex;align-items:flex-start;gap:9px;margin:13px 0;touch-action:pan-y}.group-message>img{width:38px;height:38px;border-radius:12px;object-fit:cover;flex:0 0 auto}.message-main{display:grid;justify-items:start;gap:3px;max-width:min(76%,520px)}.author-name{color:#7b827e;font-size:10px}.bubble{max-width:100%;padding:9px 12px;border-radius:5px 17px 17px 17px;background:#fff;box-shadow:0 4px 14px rgba(35,45,39,.05);line-height:1.55;overflow-wrap:anywhere;white-space:pre-wrap}.bubble.sticker,.bubble.image{padding:4px;background:transparent;box-shadow:none}.message-main time{color:#a5aaa7;font-size:9px}.group-message.mine{flex-direction:row-reverse}.group-message.mine .message-main{justify-items:end}.group-message.mine .bubble:not(.sticker):not(.image){border-radius:17px 5px 17px 17px;background:#c9f4d5}.sticker-message{display:block;width:112px;height:112px;object-fit:contain}.image-message{max-width:230px;margin:0;overflow:hidden;border-radius:15px;background:#fff}.image-message img{display:block;width:100%;max-height:300px;object-fit:cover}.image-message figcaption{padding:11px;line-height:1.45}.voice-message{display:flex;align-items:center;gap:10px;min-width:130px;padding:0;color:inherit}.voice-wave{display:flex;align-items:center;gap:2px;height:22px}.voice-wave i{width:3px;height:8px;border-radius:2px;background:currentColor}.voice-wave i:nth-child(2),.voice-wave i:nth-child(4){height:17px}.voice-wave i:nth-child(3){height:22px}.voice-transcript{max-width:100%;margin:2px 0 0;color:#747b77;font-size:10px}.quoted-message{display:grid;gap:2px;margin-top:7px;padding:6px 8px;border-left:3px solid rgba(52,87,65,.25);border-radius:6px;background:rgba(255,255,255,.38);font-size:10px}.quoted-message span{opacity:.72}.typing-row{display:flex;align-items:center;gap:4px;width:fit-content;margin:8px 0 8px 47px;color:#8a918d;font-size:10px}.typing-row>span{width:5px;height:5px;border-radius:50%;background:#8bb89a;animation:typing 1s infinite alternate}.typing-row span:nth-child(2){animation-delay:.2s}.typing-row span:nth-child(3){animation-delay:.4s}@keyframes typing{to{transform:translateY(-4px);opacity:.45}}.mention-picker{display:flex;gap:7px;padding:8px 12px;overflow-x:auto;background:rgba(255,255,255,.96);border-top:1px solid #eee}.mention-picker button{flex:0 0 auto;padding:7px 10px;border-radius:999px;background:#edf7f0;color:#257344}.left-member-controls{display:grid;grid-template-columns:minmax(0,1fr) repeat(3,auto);gap:7px;align-items:center;padding:8px calc(10px + var(--safe-right)) calc(8px + var(--safe-bottom)) calc(10px + var(--safe-left));border-top:1px solid #e5e8e6;background:rgba(255,255,255,.97)}.left-member-controls div{display:grid;gap:2px;min-width:0}.left-member-controls span{color:#858b88;font-size:9px}.left-member-controls button{min-height:38px;padding:0 9px;border-radius:12px;background:#edf5ef;font-size:10px;font-weight:800}.left-member-controls button:disabled{opacity:.45}.group-chat-page :deep(.composer){flex:0 0 auto;padding-bottom:calc(8px + var(--safe-bottom));border-top:1px solid rgba(17,17,17,.05);background:rgba(255,255,255,.96)}.action-menu{display:grid;gap:6px}.action-menu button{min-height:46px;padding:0 14px;border-radius:14px;background:#f5f7f6;text-align:left;font-weight:700}.action-menu .danger,.danger{color:#d6334c}.send-panel{display:grid;gap:13px}.send-panel h3,.send-panel p{margin:0}.send-panel label{display:grid;gap:7px}.send-panel textarea,.group-edit-field input,.group-edit-field textarea{width:100%;padding:11px;border:1px solid #e2e6e3;border-radius:14px;background:#fff;font-size:16px;resize:vertical}.file-action{display:flex!important;align-items:center;justify-content:center;gap:8px;min-height:48px;border-radius:15px;background:#edf7f0;color:#267244;font-weight:800}.file-action input{display:none}.primary{min-height:46px;border-radius:15px;background:#111;color:#fff;font-weight:800}.primary:disabled{opacity:.4}.record-actions,.confirm-actions{display:flex;align-items:center;gap:10px}.record-actions button,.confirm-actions button{min-height:42px;padding:0 14px;border-radius:13px;background:#f1f3f2}.record-actions span{color:#848a87;font-size:11px}.solid{background:#d6334c!important;color:#fff!important}.invite-list{display:grid;gap:7px;max-height:42vh;overflow-y:auto}.invite-list label{display:flex!important;align-items:center;gap:10px;padding:8px;border-radius:14px;background:#f5f7f6}.invite-list img{width:40px;height:40px;border-radius:12px;object-fit:cover}.invite-list label>span{display:grid;gap:2px;min-width:0;flex:1}.invite-list small{color:#888}.invite-list input{width:20px;height:20px}.details-mask{position:fixed;inset:0;z-index:120;display:flex;align-items:flex-end;justify-content:center;padding:20px;background:rgba(15,18,16,.28)}.details-sheet{width:min(100%,560px);max-height:78dvh;overflow-y:auto;padding:17px;padding-bottom:calc(20px + var(--safe-bottom));border-radius:26px 26px 18px 18px;background:#fff}.details-sheet header{display:flex;align-items:center;justify-content:space-between}.details-sheet header button{min-width:44px;min-height:44px}.details-sheet h2{margin:10px 0 5px}.details-sheet>p{margin:0 0 16px;color:#767d79;line-height:1.55}.group-edit-field{display:grid;gap:6px;margin-bottom:10px}.group-save-button{width:100%;min-height:42px;margin-bottom:14px;border-radius:13px;background:#111;color:#fff;font-weight:800}.proactive-settings{display:grid;gap:8px;margin-bottom:17px;padding:12px;border-radius:16px;background:#f5f7f6}.proactive-settings label{display:flex;align-items:center;justify-content:space-between;gap:12px}.proactive-settings select{min-height:36px;padding:0 8px;border-radius:10px;background:#fff}.member-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px 8px}.member-grid button{display:grid;justify-items:center;gap:3px;min-width:0;padding:0;text-align:center}.member-grid img{width:48px;height:48px;border-radius:15px;object-fit:cover}.member-grid strong,.member-grid span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.member-grid span{color:#929794;font-size:9px}.member-grid small{color:#079147}.missing-group{display:grid;place-content:center;justify-items:center;gap:12px}.missing-group button{padding:10px 16px;border-radius:14px;background:#111;color:#fff}@media(max-width:420px){.left-member-controls{grid-template-columns:1fr repeat(3,auto)}.left-member-controls div{grid-column:1/-1}.left-member-controls button{padding:0 7px}}
</style>

<style scoped>
.message-list {
  min-width: 0;
  overflow-x: clip;
}

.group-chat-page :deep(.composer) {
  border-top-color: transparent;
}

.selection-toolbar {
  position: relative;
  z-index: 13;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px calc(10px + var(--safe-right)) 8px calc(10px + var(--safe-left));
  border-top: 1px solid rgba(20, 20, 20, 0.08);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  transform: translate3d(0, calc(0px - var(--keyboard-inset)), 0);
}

.selection-toolbar strong { overflow:hidden;color:#2b3036;font-size:13px;text-align:center;text-overflow:ellipsis;white-space:nowrap }
.selection-toolbar button { display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 10px;border-radius:8px;font-weight:800 }
.selection-toolbar .secondary-action { background:transparent }
.selection-toolbar button:disabled { opacity:.45 }
.message-action-menu { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px }
.message-action-menu button { display:flex;align-items:center;justify-content:center;min-height:68px;padding:8px 4px;border-radius:8px;background:rgba(255,255,255,.72);color:#202329;font-size:12px;font-weight:800 }
.message-action-menu button:active { background:rgba(6,199,85,.12) }
.message-action-menu button:disabled { opacity:.38 }
.edit-message-sheet,.delete-confirm-sheet { display:grid;gap:10px;color:#202329 }
.edit-message-sheet textarea { width:100%;min-height:112px;resize:vertical;border:1px solid rgba(20,20,20,.08);border-radius:10px;padding:10px;background:rgba(255,255,255,.86);color:#202329;font:inherit;line-height:1.5 }
.edit-actions,.delete-confirm-actions { display:grid;grid-template-columns:1fr 1fr;gap:8px }
.edit-actions button,.delete-confirm-actions button { min-height:38px }
.edit-actions .primary-action { background:#d7dbe0;color:#22262c }
.edit-actions .primary-action:disabled { background:#e6e8eb;color:#9a9fa6 }
.delete-confirm-sheet h3 { margin:0;font-size:16px;font-weight:900 }
.delete-confirm-sheet p { margin:0;color:#646a72;font-size:13px;line-height:1.45 }
</style>