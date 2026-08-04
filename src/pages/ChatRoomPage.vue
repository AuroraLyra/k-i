<template>
  <section v-if="conversation && character" class="screen no-tabs chat-room" :style="chatSurfaceStyle">
    <ChatHeader
      :character="character"
      mode="online"
      :offline-disabled="chatActionLocked"
      @offline="enterOffline"
      @search="openChatSearch"
      @open-menu="openChatSettings"
    />

    <section v-if="activeListenTogether" class="listen-status-strip" aria-label="一起听状态">
      <img :src="character.avatar" alt="" aria-hidden="true" />
      <span>正在和{{ characterDisplayName }}一起听</span>
      <button class="listen-status-track" type="button" @click="goToMusicPage">
        <strong>{{ activeListenTrackLabel }}</strong>
      </button>
      <button class="listen-status-close" type="button" aria-label="关闭一起听" @click="showStopListenConfirm = true">
        <X :size="13" />
      </button>
    </section>

    <main ref="messageListRef" class="message-list" :style="messageListStyle" @scroll.passive="handleMessageListScroll">
      <div class="message-virtualizer" :style="{ height: `${virtualMessageTotalSize}px` }">
        <div
          v-for="virtualRow in virtualMessageRows"
          :key="String(virtualRow.key)"
          :ref="measureVirtualMessageElement"
          class="message-virtual-item"
          :data-index="virtualRow.index"
          :style="{ transform: `translateY(${virtualRow.start}px)` }"
        >
          <template v-if="onlineMessageEntries[virtualRow.index]">
            <div v-if="onlineMessageEntries[virtualRow.index].timeLabel" class="message-time-divider">
              <time>{{ onlineMessageEntries[virtualRow.index].timeLabel }}</time>
            </div>
            <MessageBubble
              :message="onlineMessageEntries[virtualRow.index].message"
              :character="character"
              :user="conversationUser ?? undefined"
              :appearance="chatSettings.appearance"
              :group-position="onlineMessageEntries[virtualRow.index].groupPosition"
              :hide-avatar="onlineMessageEntries[virtualRow.index].hideAvatar && onlineMessageEntries[virtualRow.index].message.id !== unreadMindStateMessageId"
              :profile-alert="onlineMessageEntries[virtualRow.index].message.id === unreadMindStateMessageId"
              :can-regenerate-image="canRegenerateChatImage"
              :regenerating-image="regeneratingChatImageMessageIds.includes(onlineMessageEntries[virtualRow.index].message.id)"
              :selection-mode="selectionMode"
              :selected="isMessageSelected(onlineMessageEntries[virtualRow.index].message)"
              :can-quote="canQuoteMessage(onlineMessageEntries[virtualRow.index].message)"
              enable-avatar-double-action
              @apply-image="applyChatImageCandidate"
              @delete-image="deleteChatImageCandidate"
              @accept-music-listen-invite="acceptMusicListenInvite(onlineMessageEntries[virtualRow.index].message)"
              @accept-call="acceptCallMessage(onlineMessageEntries[virtualRow.index].message)"
              @accept-gobang="acceptGobangInvitation(onlineMessageEntries[virtualRow.index].message)"
              @accept-offline-invitation="acceptOfflineInvitation(onlineMessageEntries[virtualRow.index].message)"
              @accept-transfer="respondToTransfer(onlineMessageEntries[virtualRow.index].message.id, 'accepted')"
              @busy-action="store.showConfigAlert"
              @long-press="openMessageActions"
              @open-card-detail="openCardDetail"
              @open-gobang="openGobangMessage"
              @open-profile="openCharacterProfile"
              @open-turn-trace="openTurnApiTrace"
              @open-user-profile="openUserProfile"
              @quote-message="quoteMessage"
              @regenerate-image="regenerateChatImage"
              @request-reply="requestReplyFromUserAvatar"
              @reject-music-listen-invite="rejectMusicListenInvite(onlineMessageEntries[virtualRow.index].message)"
              @reject-call="rejectCallMessage(onlineMessageEntries[virtualRow.index].message)"
              @reject-gobang="rejectGobangInvitation(onlineMessageEntries[virtualRow.index].message)"
              @reject-offline-invitation="rejectOfflineInvitation(onlineMessageEntries[virtualRow.index].message)"
              @reject-transfer="respondToTransfer(onlineMessageEntries[virtualRow.index].message.id, 'rejected')"
              @toggle-select="toggleMessageSelection(onlineMessageEntries[virtualRow.index].message)"
            />
          </template>
        </div>
      </div>
      <div v-if="currentConversationReplying" class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </main>

    <section v-if="selectionMode" class="selection-toolbar">
      <button class="secondary-action" type="button" @click="cancelSelection">
        <span>取消</span>
      </button>
      <strong>已选 {{ selectedMessageCount }} 条</strong>
      <button class="danger-action" type="button" :disabled="!selectedMessageCount" @click="deleteSelectedMessages">
        <span>删除</span>
      </button>
    </section>

    <section v-if="!isFriendRelationship" class="relationship-state-card" aria-live="polite">
      <div>
        <strong>{{ relationshipStateTitle }}</strong>
        <span>{{ relationshipStateDescription }}</span>
      </div>
      <button v-if="relationshipStatus === 'blocked-by-user'" type="button" @click="restoreBlockedFriend">移出黑名单</button>
      <button v-else-if="canSendFriendRequest" type="button" @click="openFriendRequest">重新添加 {{ relationshipCharacterName }}</button>
      <button v-else-if="relationshipStatus === 'pending-user-request'" type="button" disabled>等待验证</button>
      <span v-else-if="relationshipStatus === 'pending-character-request'" class="relationship-request-actions">
        <button type="button" class="secondary" @click="respondToCharacterRequest('rejected')">拒绝</button>
        <button type="button" @click="respondToCharacterRequest('accepted')">通过</button>
      </span>
    </section>

    <MessageComposer
      ref="composerRef"
      :model-value="composerText"
      :can-send-reply="true"
      :disabled="currentConversationReplying"
      :input-disabled="false"
      online
      placeholder="Aa"
      :quote="quoteTarget"
      :sticker-suggestions="composerStickerSuggestions"
      @cancel-quote="quoteTarget = null"
      @draft-text="handleComposerDraftText"
      @prepare-focus="captureKeyboardScrollAnchor"
      @focus="handleComposerFocus"
      @blur="handleComposerBlur"
      @capture-photo="sendCapturedPhoto"
      @file-picker-open="beginFilePicker"
      @file-picker-close="endFilePicker"
      @open-image-panel="openImagePanel"
      @open-menu="showActionMenu = true"
      @open-stickers="openStickerPanel"
      @open-voice-panel="openVoicePanel"
      @reply="sendAndReply"
      @send="sendBubble"
      @send-sticker="sendStickerSuggestion"
    />
    <StickerLibraryModal
      v-model="showStickers"
      :conversation-id="props.id"
      :disabled="chatActionLocked"
      :recommendation-query="composerText"
      :recommended-stickers="stickerModalRecommendations"
      @panel-height-change="handleStickerPanelHeightChange"
    />

    <section v-if="activeCall && !callMinimized" class="call-screen" :class="[`call-screen--${activeCall.mode}`, `call-screen--${activeCall.status}`]" aria-live="polite">
      <img v-if="callScreenBackgroundUrl" class="call-screen-background" :src="callScreenBackgroundUrl" alt="" aria-hidden="true" draggable="false" />
      <div class="call-visual-layer">
        <div class="call-topbar">
          <button class="call-mind-button" type="button" :aria-label="`查看${callPeerName}心声`" @click="openCharacterProfile">查看心声</button>
          <span class="call-topbar-actions">
            <button v-if="activeCall.status !== 'ended'" type="button" aria-label="最小化通话" @click="minimizeActiveCall">
              <Minimize :size="18" />
            </button>
            <button v-if="activeCall.status === 'ended'" type="button" aria-label="关闭通话" @click="closeEndedCall">
              <X :size="18" />
            </button>
          </span>
        </div>

        <section v-if="activeCall.mode === 'video'" class="call-video-stage" :class="[callExpressionClass, { speaking: callCharacterSpeaking, active: activeCall.status === 'active' }]" :style="callVideoStageStyle" aria-label="角色视频画面">
          <div class="call-video-copy">
            <h2>{{ callPeerName }}</h2>
            <p>{{ callPrimaryStatus }}</p>
            <span>{{ activeCallDurationLabel }}</span>
          </div>
        </section>

        <section v-else class="call-profile" :class="{ active: activeCall.status === 'active' }">
          <h2>{{ callPeerName }}</h2>
          <p>{{ callPrimaryStatus }}</p>
          <span>{{ activeCallDurationLabel }}</span>
        </section>

        <section v-if="activeCall.mode === 'video'" class="call-self-preview" :class="{ off: !activeCall.cameraEnabled, mirror: localCameraFacingMode === 'user' }" aria-label="我的视频">
          <video v-if="activeCall.cameraEnabled && localCameraActive" ref="localCameraVideoRef" autoplay muted playsinline></video>
          <img v-else-if="conversationUser?.avatar" :src="conversationUser.avatar" alt="" />
          <VideoOff v-else :size="18" />
          <span>{{ callCameraStatusLabel }}</span>
        </section>

        <section v-if="callTranscriptMessages.length || callReplyWaiting" ref="callSubtitleListRef" class="call-subtitles" aria-label="通话字幕">
          <article v-for="message in callTranscriptMessages" :key="message.id" :data-message-id="message.id" :class="['call-subtitle', message.sender, { narration: message.displayStyle === 'narration' }]">
            <span>{{ callMessageText(message) }}</span>
          </article>
          <article v-if="callReplyWaiting" class="call-subtitle char call-subtitle-waiting" aria-label="正在等待角色回复">
            <span class="call-typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          </article>
        </section>

        <form v-if="activeCall.status === 'active'" class="call-input" :class="{ active: showCallInputActions }" @submit.prevent="sendCallInput">
          <input v-model="callInputDraft" :disabled="callInputDisabled" maxlength="500" :placeholder="callInputPlaceholder" @blur="handleCallInputBlur" @focus="handleCallInputFocus" />
          <template v-if="showCallInputActions">
            <button class="call-input-send" type="submit" :disabled="callInputDisabled || !callInputDraft.trim()" aria-label="发送通话消息" @pointerdown.prevent="keepCallInputActions">发送</button>
            <button class="call-input-reply" type="button" :disabled="callReplyButtonDisabled" @click="submitCallReply" @pointerdown.prevent="keepCallInputActions">回复</button>
          </template>
        </form>

        <nav class="call-controls" aria-label="通话控制">
          <template v-if="activeCall.status === 'incoming-ringing'">
            <button class="call-control-button call-control-danger" type="button" aria-label="拒绝通话" @click="rejectIncomingCall">
              <PhoneOff :size="22" />
              <span>拒绝</span>
            </button>
            <button class="call-control-button call-control-accept" type="button" aria-label="接听通话" @click="acceptIncomingCall">
              <Phone :size="22" />
              <span>接听</span>
            </button>
          </template>
          <template v-else>
            <button class="call-control-button" type="button" :aria-pressed="activeCall.muted" aria-label="静音" @click="toggleCallMute">
              <MicOff v-if="activeCall.muted" :size="20" />
              <Mic v-else :size="20" />
            </button>
            <button v-if="activeCall.mode === 'video'" class="call-control-button" type="button" :aria-pressed="activeCall.cameraEnabled" aria-label="摄像头" @click="toggleCallCamera">
              <Video v-if="activeCall.cameraEnabled" :size="20" />
              <VideoOff v-else :size="20" />
            </button>
            <button v-if="activeCall.mode === 'video'" class="call-control-button" type="button" :disabled="!activeCall.cameraEnabled || !localCameraActive" aria-label="切换前后摄像头" @click="switchCallCameraFacing">
              <RefreshCw :size="20" />
            </button>
            <button class="call-control-button" type="button" :aria-pressed="activeCall.speakerEnabled" aria-label="扬声器" @click="toggleCallSpeaker">
              <Volume2 v-if="activeCall.speakerEnabled" :size="20" />
              <VolumeX v-else :size="20" />
            </button>
            <button class="call-control-button call-control-danger" type="button" aria-label="挂断" @click="handleCallHangup">
              <PhoneOff :size="22" />
            </button>
          </template>
        </nav>
      </div>
    </section>

    <section
      v-if="activeCall && callMinimized"
      class="call-floating-window"
      :class="[`call-floating-window--${activeCall.mode}`, `call-floating-window--${activeCall.status}`]"
      :style="callFloatingStyle"
      aria-label="通话悬浮窗"
      role="button"
      tabindex="0"
      @click="restoreCallFromFloat"
      @keydown.enter.prevent="restoreCallFromFloat"
      @keydown.space.prevent="restoreCallFromFloat"
      @pointercancel="endCallFloatDrag"
      @pointerdown="startCallFloatDrag"
      @pointermove="moveCallFloat"
      @pointerup="endCallFloatDrag"
    >
      <span class="call-floating-icon" aria-hidden="true">
        <img :src="character.avatar" :alt="callPeerName" draggable="false" />
      </span>
      <span class="call-floating-copy">
        <strong>{{ callPeerName }}</strong>
        <small>{{ callFloatingSubtitle }}</small>
      </span>
    </section>

    <input ref="localImageInputRef" class="hidden-file-input" type="file" accept="image/*" @change="sendLocalImageFromInput" />

    <AppModal v-model="showImagePanel" title="发送图片" :show-header="false" variant="ins">
      <section class="image-send-panel">
        <div class="image-panel-head">
          <div>
            <p>Image</p>
            <h3>发送图片给 {{ characterDisplayName }}</h3>
          </div>
        </div>
        <nav class="image-tabs" aria-label="图片发送方式">
          <button type="button" :class="{ active: imageSendTab === 'local' }" @click="imageSendTab = 'local'">本地图片发送</button>
          <button type="button" :class="{ active: imageSendTab === 'description' }" @click="imageSendTab = 'description'">文字描述卡片</button>
        </nav>

        <section v-if="imageSendTab === 'local'" class="local-image-tab">
          <label class="description-field local-image-hint-field">
            <span>图片补充描述（可选）</span>
            <textarea v-model="localImageHintDraft" maxlength="500" rows="3" placeholder="可以写画面重点、场景、人物或你希望 AI 理解到的细节。"></textarea>
          </label>
          <button class="local-image-button" type="button" :disabled="sendingImage" @click="openLocalImagePicker">
            <span>{{ sendingImage ? '处理中' : '选择本地图片' }}</span>
          </button>
          <p>图片会以真实图片发送，支持后续模型识图。</p>
        </section>

        <section v-else class="description-image-tab">
          <figure class="description-preview">
            <figcaption>{{ imageDescriptionDraft.trim() || '写一段画面描述，发送后会显示成模拟图片卡片。' }}</figcaption>
          </figure>
          <label class="description-field">
            <span>图片描述</span>
            <textarea v-model="imageDescriptionDraft" maxlength="500" rows="5" placeholder="例如：傍晚便利店门口的自拍，玻璃上有暖色灯光反射，手里拿着一瓶冰咖啡。"></textarea>
          </label>
          <button class="description-send-button" type="button" :disabled="sendingImage || !imageDescriptionDraft.trim()" @click="sendDescriptionImage">
            {{ sendingImage ? '发送中' : '发送描述卡片' }}
          </button>
        </section>
      </section>
    </AppModal>

    <AppModal v-model="showVoicePanel" title="发送语音" :show-header="false" variant="ins">
      <section class="voice-send-panel">
        <div class="voice-panel-head">
          <div>
            <p>Voice</p>
            <h3>发送语音给 {{ characterDisplayName }}</h3>
          </div>
        </div>
        <nav class="voice-tabs" aria-label="语音发送方式">
          <button type="button" :disabled="recordingVoice" :class="{ active: voiceSendTab === 'record' }" @click="voiceSendTab = 'record'">录音语音</button>
          <button type="button" :disabled="recordingVoice" :class="{ active: voiceSendTab === 'text' }" @click="voiceSendTab = 'text'">文字语音</button>
        </nav>

        <section v-if="voiceSendTab === 'record'" class="voice-record-tab">
          <div class="voice-recorder-card" :class="{ recording: recordingVoice, ready: recordedVoiceDraft }">
            <strong>{{ voiceRecordStatus }}</strong>
            <span>{{ formatVoiceDuration(recordedVoiceSeconds) }}</span>
            <div class="voice-preview-wave" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
          </div>
          <label class="voice-text-field">
            <span>语音内容</span>
            <textarea v-model="voiceTranscriptDraft" maxlength="500" rows="4" placeholder="输入这条语音要表达的内容"></textarea>
          </label>
          <div class="voice-actions">
            <button v-if="!recordingVoice" class="voice-secondary" type="button" :disabled="currentConversationReplying" @click="startVoiceRecording">
              {{ recordedVoiceDraft ? '重录' : '开始录音' }}
            </button>
            <button v-else class="voice-secondary voice-secondary--stop" type="button" @click="stopVoiceRecording">停止</button>
            <button class="voice-primary" type="button" :disabled="!recordedVoiceDraft || !voiceTranscriptDraft.trim() || currentConversationReplying || recordingVoice" @click="sendRecordedVoice">发送语音</button>
          </div>
        </section>

        <section v-else class="voice-text-tab">
          <div class="voice-text-preview">
            <div class="voice-preview-wave" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <strong>{{ formatVoiceDuration(textVoiceDuration) }}</strong>
          </div>
          <label class="voice-text-field">
            <span>语音内容</span>
            <textarea v-model="voiceTextDraft" maxlength="500" rows="5" placeholder="输入要作为语音发送的内容"></textarea>
          </label>
          <button class="voice-primary" type="button" :disabled="!voiceTextDraft.trim() || currentConversationReplying" @click="sendTextVoice">发送语音</button>
        </section>
      </section>
    </AppModal>

    <AppModal v-model="showActionMenu" title="更多操作" :show-header="false" variant="ins">
      <section class="action-menu">
        <section class="action-menu-group">
          <div class="action-menu-group-title"><small>OUR PRIVATE LIFE</small></div>
          <div class="action-menu-grid">
            <button type="button" @click="openRelationshipCommerce('economy')"><span>TA 的钱包</span></button>
            <button type="button" @click="openRelationshipCommerce('cart')"><span>共同购物</span></button>
            <button type="button" @click="openRelationshipCommerce('wishlist')"><span>共同愿望</span></button>
            <button type="button" @click="openRelationshipCommerce('gift')"><span>礼物与卡片</span></button>
            <button type="button" @click="openRelationshipCommerce('stores')"><span>TA 的店铺</span></button>
            <button type="button" @click="openRelationshipCommerce('orders')"><span>关系订单</span></button>
          </div>
        </section>

        <section class="action-menu-group">
          <div class="action-menu-group-title"><small>CHAT TOOLS</small></div>
          <div class="action-menu-grid">
            <button type="button" :disabled="chatActionLocked" @click="openLocationPanel"><span>发送定位</span></button>
            <button type="button" :disabled="chatActionLocked" @click="openTransferPanel"><span>转账</span></button>
            <button type="button" :disabled="chatActionLocked" @click="openMusicListenInvitePanel"><span>邀请一起听</span></button>
            <button type="button" :disabled="chatActionLocked" @click="startOutgoingCall('voice')"><span>语音通话</span></button>
            <button type="button" :disabled="chatActionLocked" @click="startOutgoingCall('video')"><span>视频通话</span></button>
            <button type="button" :disabled="chatActionLocked" @click="openCommercePanel('takeout')"><span>点外卖</span></button>
            <button type="button" :disabled="chatActionLocked" @click="openCommercePanel('gift')"><span>送礼物</span></button>
            <button type="button" :class="{ busy: currentConversationReplying }" :aria-disabled="currentConversationReplying" @click="regenerateReply"><span>重新回复</span></button>
            <button type="button" :disabled="chatActionLocked" @click="openNarrationPanel"><span>添加旁白</span></button>
          </div>
        </section>

        <section class="action-menu-group">
          <div class="action-menu-group-title"><small>CONTENT TOOLS</small></div>
          <div class="action-menu-grid">
            <button type="button" @click="openModelSwitch"><span>模型切换</span></button>
            <button type="button" @click="openThoughtChainThemes"><span>思维链自定义</span></button>
            <button type="button" :disabled="chatActionLocked" @click="startGobangInvitation"><span>五子棋</span></button>
            <button type="button" :class="{ busy: generatingVoom }" :aria-disabled="generatingVoom" @click="generateVoomPost"><span>{{ generatingVoom ? '生成中' : '生成 VOOM' }}</span></button>
            <button type="button" @click="openSmallTheater"><span>小剧场</span></button>
            <button type="button" @click="openCoupleSpace"><span>情侣守护</span></button>
          </div>
        </section>

        <section class="action-menu-group">
          <div class="action-menu-group-title"><small>PROFILES</small></div>
          <div class="action-menu-grid">
            <button type="button" @click="openCharacterProfile"><span>角色主页</span></button>
            <button type="button" @click="openProfileThemes"><span>主页自定义</span></button>
            <button type="button" @click="openUserProfile"><span>我的主页</span></button>
          </div>
        </section>

        <section class="action-menu-group action-menu-group--danger">
          <div class="action-menu-group-title"><small>RELATIONSHIP MANAGEMENT</small></div>
          <div class="action-menu-grid">
            <button class="danger-menu-action" type="button" :disabled="chatActionLocked" @click="openDeleteFriendConfirm"><span>删除好友</span></button>
            <button class="danger-menu-action" type="button" :disabled="chatActionLocked" @click="openBlockFriendConfirm"><span>拉黑好友</span></button>
            <button class="danger-menu-action" type="button" :disabled="chatActionLocked" @click="openClearHistoryConfirm"><span>清空记忆</span></button>
          </div>
        </section>
      </section>
    </AppModal>

    <AppModal v-model="showMusicListenPanel" title="邀请一起听" :show-header="false" variant="ins">
      <section class="listen-invite-send-panel">
        <div class="listen-panel-head">
          <div>
            <p>Listen Together</p>
            <h3>邀请 {{ characterDisplayName }} 一起听</h3>
          </div>
        </div>
        <section class="listen-compose-preview" aria-label="一起听邀请预览">
          <span class="listen-preview-disc" aria-hidden="true">
            <img v-if="musicInviteTrack?.coverUrl" :src="musicInviteTrack.coverUrl" alt="" />
          </span>
          <span class="listen-preview-copy">
            <small>LINK FM</small>
            <strong>{{ musicInviteTrack?.name || '一起听歌' }}</strong>
            <span>{{ musicInviteTrackArtists }}</span>
          </span>
        </section>
        <label class="listen-field">
          <span>邀请备注（可选）</span>
          <input v-model="musicListenNoteDraft" maxlength="80" placeholder="例如：这首想和你一起听" />
        </label>
        <div class="listen-actions-sheet">
          <button class="secondary-action" type="button" @click="showMusicListenPanel = false">取消</button>
          <button class="primary-action" type="button" :disabled="chatActionLocked" @click="sendMusicListenInviteMessage">发送邀请</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showStopListenConfirm" title="关闭一起听" :show-header="false" variant="ins">
      <section class="listen-stop-confirm">
        <span>Listen Together</span>
        <h3>结束和{{ characterDisplayName }}的一起听？</h3>
        <p>关闭后聊天状态栏会消失，音乐页也不再显示对方的一起听状态。</p>
        <div class="listen-stop-actions">
          <button class="secondary-action" type="button" @click="showStopListenConfirm = false">取消</button>
          <button class="primary-action" type="button" @click="confirmStopListenTogether">关闭</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showRegeneratePrompt" title="重新回复引导" :show-header="false" variant="ins">
      <form class="regenerate-prompt-sheet" @submit.prevent="confirmRegenerateReply">
        <span>重新回复</span>
        <h3>引导这次回复</h3>
        <p>可以写剧情方向、禁止事项或语气要求；留空会按当前上下文直接重新生成。</p>
        <label>
          <span>可选引导</span>
          <textarea v-model="regeneratePromptDraft" maxlength="600" rows="5" placeholder="例如：往暧昧拉扯走；不要让角色立刻服软；禁止出现道歉。"></textarea>
        </label>
        <div class="regenerate-prompt-actions">
          <button class="secondary-action" type="button" @click="showRegeneratePrompt = false">取消</button>
          <button class="primary-action" type="submit" :disabled="currentConversationReplying">重新回复</button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showLocationPanel" title="发送定位" :show-header="false" variant="ins">
      <section class="location-send-panel">
        <div class="location-panel-head">
          <div>
            <p>Location</p>
            <h3>发送定位给 {{ characterDisplayName }}</h3>
          </div>
        </div>

        <section class="link-location-card location-preview-card" aria-label="定位预览">
          <span class="link-location-map" aria-hidden="true">
            <span class="link-map-road link-map-road-1"></span>
            <span class="link-map-road link-map-road-2"></span>
            <span class="link-map-road link-map-road-3"></span>
            <span class="link-map-road link-map-road-4"></span>
            <span class="link-map-block link-map-block-1"></span>
            <span class="link-map-block link-map-block-2"></span>
            <span class="link-map-block link-map-block-3"></span>
            <span class="link-map-label link-map-label-top">{{ locationPreviewMapLabel }}</span>
            <span class="link-map-label link-map-label-mid">{{ locationPreviewName }}</span>
            <span class="link-map-pin link-map-pin-main"></span>
            <span class="link-map-pin link-map-pin-secondary"></span>
            <span class="link-map-google"><span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span></span>
          </span>
          <span class="link-location-body">
            <span class="link-location-kicker">Location</span>
            <strong>{{ locationPreviewName }}</strong>
            <span v-if="locationPreviewAddress" class="link-location-detail-address">{{ locationPreviewAddress }}</span>
          </span>
          <span class="link-location-footer">
            <span class="link-location-footer-mark" aria-hidden="true"></span>
            <span>{{ locationPreviewDistanceLabel }}</span>
            <span class="link-location-chevron" aria-hidden="true"></span>
          </span>
        </section>

        <label class="location-field">
          <span>地理位置</span>
          <input v-model="locationNameDraft" maxlength="80" placeholder="例如：市图书馆三楼自习区" />
        </label>
        <label class="location-field">
          <span>详细地址（可选）</span>
          <input v-model="locationAddressDraft" maxlength="140" placeholder="例如：XX路 88 号 / 北门附近" />
        </label>
        <label class="location-field">
          <span>距离角色的位置</span>
          <input v-model="locationDistanceDraft" maxlength="60" placeholder="例如：约 2.4 公里 / 步行 12 分钟" />
        </label>

        <div class="location-actions">
          <button class="secondary-action" type="button" @click="showLocationPanel = false">取消</button>
          <button class="primary-action" type="button" :disabled="!canSendLocation || chatActionLocked" @click="sendLocationMessage">发送定位</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showTransferPanel" title="转账" :show-header="false" variant="ins">
      <section class="transfer-send-panel">
        <div class="transfer-panel-head">
          <div>
            <p>Transfer</p>
            <h3>转账给 {{ characterDisplayName }}</h3>
          </div>
        </div>

        <section class="transfer-compose-preview" aria-label="转账预览">
          <span class="transfer-compose-head">
            <span class="transfer-compose-brand">
              <span aria-hidden="true">¥</span>
              <span>LINK Pay</span>
            </span>
            <span>待发送</span>
          </span>
          <span class="transfer-compose-main">
            <small>转账给</small>
            <strong>¥{{ transferAmountPreview }}</strong>
            <span>{{ characterDisplayName }}</span>
          </span>
          <span class="transfer-compose-note">{{ transferPreviewSummary }}</span>
        </section>

        <label class="transfer-field">
          <span>金额</span>
          <input v-model="transferAmountDraft" inputmode="decimal" maxlength="12" placeholder="例如 52.00" />
        </label>
        <label class="transfer-field">
          <span>备注（可选）</span>
          <input v-model="transferNoteDraft" maxlength="60" placeholder="例如：奶茶钱 / 路费 / 今天辛苦了" />
        </label>

        <div class="transfer-actions-sheet">
          <button class="secondary-action" type="button" @click="showTransferPanel = false">取消</button>
          <button class="primary-action" type="button" :disabled="!canSendTransfer || chatActionLocked" @click="sendTransferMessage">发送转账</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showCommercePanel" :title="commerceKind === 'takeout' ? '点外卖' : '送礼物'" :show-header="false" variant="ins">
      <section class="commerce-send-panel">
        <div class="commerce-panel-head">
          <div>
            <p>{{ commerceKind === 'takeout' ? 'Delivery' : 'Gift' }}</p>
            <h3>{{ commerceKind === 'takeout' ? `给 ${characterDisplayName} 点外卖` : `送礼物给 ${characterDisplayName}` }}</h3>
          </div>
        </div>

        <section class="commerce-compose-preview" :class="`commerce-compose-preview--${commerceKind}`" aria-label="订单预览">
          <span class="commerce-compose-head">
            <span><i>{{ commerceKind === 'takeout' ? '🥡' : '🎁' }}</i> LINK {{ commerceKind === 'takeout' ? 'DELIVERY' : 'GIFT' }}</span>
            <em>待发送</em>
          </span>
          <span class="commerce-compose-main">
            <small>{{ commerceKind === 'takeout' ? `给 ${characterDisplayName} 点的外卖` : `送给 ${characterDisplayName} 的礼物` }}</small>
            <strong>{{ commerceStoreNameDraft.trim() || '店铺名称' }}</strong>
            <em>{{ commerceItemsPreview }}</em>
          </span>
          <span class="commerce-compose-payment"><span>{{ commerceKind === 'takeout' ? commerceEtaDraft.trim() || '订单提交后开始准备' : commerceCardMessageDraft.trim() || '可以附上一张专属卡片' }}</span><strong>¥{{ commerceAmountPreview }}</strong></span>
        </section>

        <label class="commerce-field">
          <span>店铺名称</span>
          <input v-model="commerceStoreNameDraft" maxlength="80" :placeholder="commerceKind === 'takeout' ? '例如：深夜食堂' : '例如：Bloom Letter'" />
        </label>
        <label class="commerce-field">
          <span>{{ commerceKind === 'takeout' ? '餐品' : '礼物' }}（每行一项，可在末尾写 ×数量）</span>
          <textarea v-model="commerceItemsDraft" maxlength="500" rows="3" :placeholder="commerceKind === 'takeout' ? '温泉蛋牛肉拌饭 ×2\n冰柠檬茶' : '纪念日雾粉花束 ×1'"></textarea>
        </label>
        <label class="commerce-field">
          <span>实付金额</span>
          <input v-model="commerceAmountDraft" inputmode="decimal" maxlength="12" placeholder="例如 68.00" />
        </label>
        <label v-if="commerceKind === 'takeout'" class="commerce-field">
          <span>预计送达（可选）</span>
          <input v-model="commerceEtaDraft" maxlength="60" placeholder="例如：预计 35 分钟送达" />
        </label>
        <label v-else class="commerce-field">
          <span>专属卡片（可选）</span>
          <textarea v-model="commerceCardMessageDraft" maxlength="200" rows="2" :placeholder="`写给 ${characterDisplayName} 的话`"></textarea>
        </label>
        <label class="commerce-field">
          <span>订单备注（可选）</span>
          <input v-model="commerceNoteDraft" maxlength="120" :placeholder="commerceKind === 'takeout' ? '例如：少辣，不要香菜' : '例如：礼盒包装，不显示价格'" />
        </label>

        <div class="commerce-actions">
          <button class="secondary-action" type="button" @click="showCommercePanel = false">取消</button>
          <button class="primary-action" type="button" :disabled="!canSendCommerce || chatActionLocked" @click="sendCommerceMessage">确认付款并发送</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showNarrationPanel" title="添加旁白" :show-header="false" variant="ins">
      <section class="narration-send-panel">
        <div class="narration-panel-head">
          <div>
            <p>Narration</p>
            <h3>添加系统旁白</h3>
          </div>
        </div>
        <label class="narration-field">
          <span>旁白内容</span>
          <textarea v-model="narrationDraft" maxlength="500" rows="5" placeholder="例如：窗外忽然下起雨，聊天界面短暂安静下来。"></textarea>
        </label>
        <div class="narration-actions">
          <button class="secondary-action" type="button" @click="showNarrationPanel = false">取消</button>
          <button class="primary-action" type="button" :disabled="!narrationDraft.trim() || chatActionLocked" @click="sendNarrationMessage">发送旁白</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showMessageMenu" title="消息操作" :show-header="false" variant="ins">
      <section class="message-action-menu">
        <button type="button" @click="copyActiveMessage">
          <span>复制</span>
        </button>
        <button type="button" @click="deleteActiveMessage">
          <span>删除</span>
        </button>
        <button type="button" @click="startSelectionFromActive">
          <span>多选</span>
        </button>
        <button type="button" :disabled="!canFavoriteActiveMessage || isActiveMessageFavorited" @click="favoriteActiveMessage">
          <span>{{ favoriteActionLabel }}</span>
        </button>
        <button type="button" :disabled="!canRecallActiveMessage" @click="recallActiveMessage">
          <span>撤回</span>
        </button>
        <button v-if="canRegenerateActiveVoice" type="button" :disabled="regeneratingActiveVoice" @click="regenerateActiveVoice">
          <span>{{ regeneratingActiveVoice ? '生成中' : '重新生成语音' }}</span>
        </button>
        <button type="button" :disabled="!canQuoteActiveMessage" @click="quoteActiveMessage">
          <span>引用</span>
        </button>
        <button type="button" :disabled="!canEditActiveMessage" @click="openEditActiveMessage">
          <span>编辑</span>
        </button>
      </section>
    </AppModal>

    <AppModal v-model="showEditModal" title="编辑消息" :show-header="false" variant="ins">
      <section class="edit-message-sheet">
        <template v-if="activeMessage?.location">
          <label class="location-field">
            <span>地点名称</span>
            <input v-model="editLocationNameDraft" maxlength="80" placeholder="地点名称" />
          </label>
          <label class="location-field">
            <span>详细地址</span>
            <input v-model="editLocationAddressDraft" maxlength="140" placeholder="详细地址可留空" />
          </label>
          <label class="location-field">
            <span>距离</span>
            <input v-model="editLocationDistanceDraft" maxlength="60" placeholder="距离对方多远" />
          </label>
        </template>
        <template v-else-if="activeMessage?.transfer">
          <label class="transfer-field">
            <span>金额</span>
            <input v-model="editTransferAmountDraft" inputmode="decimal" maxlength="12" placeholder="例如 52.00" />
          </label>
          <label class="transfer-field">
            <span>备注</span>
            <input v-model="editTransferNoteDraft" maxlength="60" placeholder="备注可留空" />
          </label>
          <label class="transfer-field">
            <span>处理状态</span>
            <select v-model="editTransferStatusDraft">
              <option v-if="!activeMessageTransferIsReceipt" value="pending">待处理</option>
              <option value="accepted">已接收</option>
              <option value="rejected">已拒绝</option>
            </select>
          </label>
        </template>
        <textarea v-else v-model="editDraft" rows="5" placeholder="编辑消息内容"></textarea>
        <div class="edit-actions">
          <button class="secondary-action" type="button" @click="showEditModal = false">取消</button>
          <button class="primary-action" type="button" :disabled="!canSaveEditedMessage" @click="saveEditedMessage">保存</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showDeleteConfirm" title="确认删除" :show-header="false" variant="ins">
      <section class="delete-confirm-sheet">
        <h3>删除消息？</h3>
        <p>删除后 AI 不会再读取这部分信息。</p>
        <div class="delete-confirm-actions">
          <button class="secondary-action" type="button" @click="cancelDeleteConfirm">取消</button>
          <button class="danger-action" type="button" @click="confirmDeleteMessages">删除</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showDeleteFriendConfirm" title="确认删除" :show-header="false" variant="ins">
      <section class="delete-confirm-sheet">
        <h3>删除 {{ relationshipCharacterName }}？</h3>
        <p>请选择删除方式。两种方式的清理范围不同，请确认后再继续。</p>
        <div class="friend-delete-options">
          <button class="friend-delete-option" type="button" :disabled="deletingFriend || purgingFriend || chatActionLocked" @click="confirmDeleteFriend">
            <strong>{{ deletingFriend ? '删除中' : '仅删除好友' }}</strong>
            <span>保持现在的删除方式：无法继续聊天，但保留聊天记录、角色资料、记忆和世界书，以后仍可重新发送好友验证。</span>
          </button>
          <button class="friend-delete-option friend-delete-option--purge" type="button" :disabled="deletingFriend || purgingFriend || chatActionLocked" @click="openPurgeFriendConfirm">
            <strong>彻底删除并清理</strong>
            <span>永久删除这个好友及其全部专属数据，不保留重新添加所需的旧资料。</span>
          </button>
        </div>
        <button class="secondary-action friend-delete-cancel" type="button" :disabled="deletingFriend || purgingFriend" @click="showDeleteFriendConfirm = false">取消</button>
      </section>
    </AppModal>

    <AppModal v-model="showPurgeFriendConfirm" title="确认彻底删除" :show-header="false" variant="ins">
      <section class="delete-confirm-sheet">
        <h3>彻底删除 {{ relationshipCharacterName }} 的全部专属数据？</h3>
        <p><strong>此操作无法撤销。</strong>会删除角色资料、私聊与线下 RP、消息和收藏、记忆、情侣空间、VOOM、主页、小剧场、专属局部世界书、同人书及商城和钱包关联。共享群聊本身会保留，但会移除 {{ relationshipCharacterName }} 和相关消息。</p>
        <div class="delete-confirm-actions">
          <button class="secondary-action" type="button" :disabled="purgingFriend" @click="showPurgeFriendConfirm = false; showDeleteFriendConfirm = true">返回选择</button>
          <button class="danger-action" type="button" :disabled="purgingFriend || chatActionLocked" @click="confirmPurgeFriend">{{ purgingFriend ? '清理中' : '确认彻底删除' }}</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showBlockFriendConfirm" title="确认拉黑" :show-header="false" variant="ins">
      <section class="delete-confirm-sheet">
        <h3>{{ relationshipUserName }} 将 {{ relationshipCharacterName }} 加入黑名单？</h3>
        <p>拉黑后 {{ relationshipUserName }} 与 {{ relationshipCharacterName }} 无法互发消息，{{ relationshipCharacterName }} 也不会主动联系 {{ relationshipUserName }}；聊天记录会保留，之后 {{ relationshipUserName }} 可随时将 {{ relationshipCharacterName }} 移出黑名单。</p>
        <div class="delete-confirm-actions">
          <button class="secondary-action" type="button" @click="showBlockFriendConfirm = false">取消</button>
          <button class="danger-action" type="button" :disabled="deletingFriend || currentConversationReplying" @click="confirmBlockFriend">加入黑名单</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showFriendRequest" title="好友验证" :show-header="false" variant="ins">
      <form class="friend-request-sheet" @submit.prevent="submitFriendRequest">
        <h3>{{ relationshipUserName }} 重新添加 {{ relationshipCharacterName }}</h3>
        <p>验证消息会交给 {{ relationshipCharacterName }} 阅读。{{ relationshipCharacterName }} 会结合人设、最近冲突和关系记忆决定通过或拒绝 {{ relationshipUserName }} 的申请。</p>
        <textarea v-model="friendRequestDraft" maxlength="120" rows="4" placeholder="填写好友验证"></textarea>
        <div class="delete-confirm-actions">
          <button class="secondary-action" type="button" @click="showFriendRequest = false">取消</button>
          <button class="primary-action" type="submit" :disabled="requestingFriend || currentConversationReplying">{{ requestingFriend ? '等待回应' : '发送申请' }}</button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showClearHistoryConfirm" title="确认清空" :show-header="false" variant="ins">
      <section class="delete-confirm-sheet">
        <h3>清空 {{ characterDisplayName }} 的记忆？</h3>
        <p>会删除该角色的线上聊天、线下 RP、VOOM 关联、记忆手册、主页展示资料和心境状态；好友、聊天设置、角色基础资料和绑定局部世界书都会保留。</p>
        <div class="delete-confirm-actions">
          <button class="secondary-action" type="button" :disabled="clearingHistory" @click="showClearHistoryConfirm = false">取消</button>
          <button class="danger-action" type="button" :disabled="clearingHistory || chatActionLocked" @click="confirmClearHistory">{{ clearingHistory ? '清空中' : '确认清空' }}</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showUserProfile" title="我的主页" :show-header="false" variant="profile-ins">
      <UserProfileSheet v-if="conversationUser" :user="conversationUser" :posts="store.sortedVoomPosts" @save="saveUserProfile" />
    </AppModal>

    <AppModal v-model="showProfile" title="角色主页" :show-header="false" variant="profile-ins">
      <CharacterProfileSheet
        v-if="character"
        :character="character"
        :homepages="store.profileHomepagesForCharacter(character.id)"
        :posts="store.sortedVoomPosts"
        @save="saveCharacterProfile"
        @delete-history-entry="deleteCharacterProfileHistoryEntry"
        @clear-history="clearCharacterProfileHistory"
      />
    </AppModal>
    <ChatModelSwitchPanel v-model="showModelSwitch" :conversation-id="props.id" />
    <ChatTurnTraceModal
      v-model="showTurnTrace"
      :trace="selectedTurnTrace"
      :character-name="characterDisplayName"
      :character-avatar="character.avatar"
    />

  </section>
  <section v-else class="screen no-tabs empty-state">会话不存在</section>
</template>

<script setup lang="ts">
import { Capacitor } from '@capacitor/core';
import { useVirtualizer } from '@tanstack/vue-virtual';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Mic, MicOff, Minimize, Phone, PhoneOff, RefreshCw, Video, VideoOff, Volume2, VolumeX, X } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import ChatHeader from '@/components/chat/ChatHeader.vue';
import ChatModelSwitchPanel from '@/components/chat/ChatModelSwitchPanel.vue';
import ChatTurnTraceModal from '@/components/chat/ChatTurnTraceModal.vue';
import CharacterProfileSheet from '@/components/chat/CharacterProfileSheet.vue';
import MessageBubble from '@/components/chat/MessageBubble.vue';
import MessageComposer from '@/components/chat/MessageComposer.vue';
import UserProfileSheet from '@/components/chat/UserProfileSheet.vue';
import StickerLibraryModal from '@/components/stickers/StickerLibraryModal.vue';
import { useAppStore, type AppActiveCallState } from '@/stores/appStore';
import { useMusicPlayerStore } from '@/stores/musicPlayerStore';
import { generateImageByProvider } from '@/services/ai';
import { purgeFriendData } from '@/services/friendDeletion';
import { synthesizeSpeech } from '@/services/tts';
import type { AppSettings, CharacterImageProfile, CharacterProfile, ChatApiTrace, ChatCallMode, ChatCallStatus, ChatImageAttachment, ChatLocationAttachment, ChatMessage, ChatMessageQuote, ChatTransferStatus, ChatVoiceAttachment, ImageProviderType, Sticker, UserProfile } from '@/types/domain';
import { getCharacterAiName, getCharacterDisplayName, getFriendRelationship } from '@/utils/character';
import { collectCharacterPhotoImages, createCharacterPhotoRecord, normalizeCharacterPhotoRecords, normalizeHiddenSourcePhotoKeys } from '@/utils/characterPhotos';
import { readChatImageFile } from '@/utils/imageFile';
import { useKeyboardScrollGuard } from '@/utils/keyboardScrollGuard';
import { resolveMessageGroupPositions, type MessageGroupPosition } from '@/utils/messageGrouping';
import { firstUnreadCharacterMessageId, scrollMessageContainerToUnreadOrBottom } from '@/utils/messageScroll';
import { defaultProfileAvatar, getUserAiName, normalizeUserProfile, normalizeVisualProfile } from '@/utils/profile';
import { normalizeRingtoneSettings } from '@/utils/settings';
import { defaultImageNegativePrompt, getImagePromptPresetForProvider, getSelectedImageModelOption } from '@/utils/settings';
import { RECOMMENDED_STICKER_LIMIT, recommendStickers } from '@/utils/stickerRecommendations';
import { formatChatTimeDivider, shouldShowChatTimeDivider } from '@/utils/time';
import { isVoomNarrationMessage, mergeVoomLikeMessages } from '@/utils/voomMessages';
import { createId } from '@/utils/id';
import { createGobangGame } from '@/utils/gobang';

type BrowserSpeechRecognitionAlternative = {
  transcript: string;
};

type BrowserSpeechRecognitionResult = {
  isFinal: boolean;
  length: number;
  [index: number]: BrowserSpeechRecognitionAlternative | undefined;
};

type BrowserSpeechRecognitionResultList = {
  length: number;
  [index: number]: BrowserSpeechRecognitionResult | undefined;
};

type BrowserSpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: BrowserSpeechRecognitionResultList;
};

type BrowserSpeechRecognitionErrorEvent = Event & {
  error?: string;
};

type BrowserSpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: BrowserSpeechRecognitionConstructor;
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
};

type AudioContextWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

type MessageComposerExpose = {
  focusInput: () => void;
};

type OnlineMessageEntry = {
  message: ChatMessage;
  messageIndex: number;
  timeLabel: string;
  hideAvatar: boolean;
  groupPosition: MessageGroupPosition;
};

type ActiveCallState = Omit<AppActiveCallState, 'conversationId' | 'peerName' | 'avatar' | 'subtitle' | 'minimized' | 'floatPosition' | 'updatedAt'>;

type QueuedCallReply = {
  callId: string;
  mode: ChatCallMode;
  instruction: string;
};

type CallFloatDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

type CallCameraFacingMode = 'user' | 'environment';

type UserCommerceKind = 'takeout' | 'gift';

type CallVoicePlayback = {
  messageId: string;
  audioUrls: Array<Promise<string>>;
};

type SelectedImageModelOption = NonNullable<ReturnType<typeof getSelectedImageModelOption>>;

const voiceTranscriptLimit = 500;
const composerDraftStoragePrefix = 'link.chat.composerDraft.';
const defaultCallFloatPosition = { x: 16, y: 92 };
const callBackgroundImageSize = { size: '832x1216', width: 832, height: 1216 };
const callBackgroundRotationIntervalMs = 20_000;
const callBackgroundNegativePrompt = 'crowd, multiple people, extra person, duplicate face, bad anatomy, deformed hands, extra fingers, text, watermark, logo, user interface, phone frame, notification badge, blurry, distorted perspective';
const composerDrafts = new Map<string, string>();

function composerDraftKey(conversationId: string) {
  return `${composerDraftStoragePrefix}${conversationId}`;
}

function readComposerDraft(conversationId: string) {
  if (composerDrafts.has(conversationId)) return composerDrafts.get(conversationId) ?? '';
  try {
    return window.sessionStorage.getItem(composerDraftKey(conversationId)) ?? '';
  } catch {
    return '';
  }
}

function writeComposerDraft(conversationId: string, content: string) {
  composerDrafts.set(conversationId, content);
  try {
    const key = composerDraftKey(conversationId);
    if (content) window.sessionStorage.setItem(key, content);
    else window.sessionStorage.removeItem(key);
  } catch {}
}

const props = defineProps<{
  id: string;
}>();

const store = useAppStore();
const musicPlayer = useMusicPlayerStore();
const router = useRouter();
const route = useRoute();
const showProfile = ref(false);
const showUserProfile = ref(false);
const showActionMenu = ref(false);
const showRegeneratePrompt = ref(false);
const showModelSwitch = ref(false);
const showTurnTrace = ref(false);
const selectedTurnTrace = ref<ChatApiTrace | null>(null);
const showStickers = ref(false);
const stickerPanelHeight = ref(0);
const showImagePanel = ref(false);
const showVoicePanel = ref(false);
const showLocationPanel = ref(false);
const showTransferPanel = ref(false);
const showCommercePanel = ref(false);
const showMusicListenPanel = ref(false);
const showStopListenConfirm = ref(false);
const showNarrationPanel = ref(false);
const showMessageMenu = ref(false);
const showEditModal = ref(false);
const showDeleteConfirm = ref(false);
const showDeleteFriendConfirm = ref(false);
const showPurgeFriendConfirm = ref(false);
const showBlockFriendConfirm = ref(false);
const showFriendRequest = ref(false);
const showClearHistoryConfirm = ref(false);
const generatingVoom = ref(false);
const deletingFriend = ref(false);
const purgingFriend = ref(false);
const requestingFriend = ref(false);
const friendRequestDraft = ref('');
const clearingHistory = ref(false);
const regeneratingChatImageMessageIds = ref<string[]>([]);
const regeneratingVoiceMessageIds = ref<string[]>([]);
const messageListRef = ref<HTMLElement | null>(null);
const composerRef = ref<MessageComposerExpose | null>(null);
const localImageInputRef = ref<HTMLInputElement | null>(null);
const callSubtitleListRef = ref<HTMLElement | null>(null);
const localCameraVideoRef = ref<HTMLVideoElement | null>(null);
const activeMessage = ref<ChatMessage | null>(null);
const selectionMode = ref(false);
const selectedMessageIds = ref<string[]>([]);
const quoteTarget = ref<ChatMessageQuote | null>(null);
let composerFocused = false;
const composerText = ref(readComposerDraft(props.id));
const editDraft = ref('');
const editLocationNameDraft = ref('');
const editLocationAddressDraft = ref('');
const editLocationDistanceDraft = ref('');
const editTransferAmountDraft = ref('');
const editTransferNoteDraft = ref('');
const editTransferStatusDraft = ref<ChatTransferStatus>('pending');
const pendingDeleteIds = ref<string[]>([]);
const pendingDeleteFromSelection = ref(false);
const shouldStickToBottom = ref(true);
const imageSendTab = ref<'local' | 'description'>('local');
const localImageHintDraft = ref('');
const imageDescriptionDraft = ref('');
const sendingImage = ref(false);
const voiceSendTab = ref<'record' | 'text'>('record');
const voiceTranscriptDraft = ref('');
const voiceTextDraft = ref('');
const locationNameDraft = ref('');
const locationAddressDraft = ref('');
const locationDistanceDraft = ref('');
const transferAmountDraft = ref('');
const transferNoteDraft = ref('');
const commerceKind = ref<UserCommerceKind>('takeout');
const commerceStoreNameDraft = ref('');
const commerceItemsDraft = ref('');
const commerceAmountDraft = ref('');
const commerceEtaDraft = ref('');
const commerceNoteDraft = ref('');
const commerceCardMessageDraft = ref('');
const musicListenNoteDraft = ref('');
const narrationDraft = ref('');
const regeneratePromptDraft = ref('');
const recordedVoiceDraft = ref<Pick<ChatVoiceAttachment, 'audioUrl' | 'duration' | 'mimeType'> | null>(null);
const recordingVoice = ref(false);
const recordingStartedAt = ref(0);
const recordingElapsed = ref(0);
const recognizingVoice = ref(false);
const voiceRecognitionNotice = ref('');
const activeCall = computed<ActiveCallState | null>({
  get() {
    const call = store.activeCall;
    if (!call || call.conversationId !== props.id) return null;
    return {
      callId: call.callId,
      eventMessageId: call.eventMessageId,
      mode: call.mode,
      direction: call.direction,
      status: call.status,
      startedAt: call.startedAt,
      connectedAt: call.connectedAt,
      endedAt: call.endedAt,
      muted: call.muted,
      cameraEnabled: call.cameraEnabled,
      speakerEnabled: call.speakerEnabled,
      generatedBackgroundUrl: call.generatedBackgroundUrl
    };
  },
  set(call) {
    if (!call) {
      store.clearActiveCall(props.id);
      return;
    }
    store.setActiveCall({
      ...call,
      conversationId: props.id,
      minimized: callMinimized.value,
      floatPosition: callFloatPosition.value,
      peerName: callPeerName.value,
      avatar: character.value?.avatar || '',
      subtitle: callFloatingSubtitle.value || callStatusText.value || '',
    });
  }
});
const callMinimized = computed({
  get: () => store.activeCall?.conversationId === props.id ? store.activeCall.minimized : false,
  set: (minimized: boolean) => store.patchActiveCall(props.id, { minimized })
});
const callInputDraft = ref('');
const callInputFocused = ref(false);
const callElapsed = ref(0);
const callStatusText = ref('');
const callBusy = ref(false);
const callReplyTextPending = ref(false);
const callReplyPendingCallId = ref('');
const callReplyPendingCharCount = ref(0);
const callUnreadStartMessageId = ref('');
const callFloatPosition = computed({
  get: () => store.activeCall?.conversationId === props.id ? store.activeCall.floatPosition : defaultCallFloatPosition,
  set: (position: { x: number; y: number }) => store.patchActiveCall(props.id, { floatPosition: position })
});
const callSpeechListening = ref(false);
const callSpeechNotice = ref('');
const callSpeechInterimText = ref('');
const localCameraActive = ref(false);
const localCameraError = ref('');
const localCameraFacingMode = ref<CallCameraFacingMode>('user');
const callVoiceActive = ref(false);
const callMouthLevel = ref(0);
const callGeneratedBackgroundUrl = ref('');
const callRotatingBackgroundUrl = ref('');
const callBackgroundRequestKey = ref('');
const callBackgroundGenerating = ref(false);
const callBackgroundRunId = ref(0);
const callBackgroundPendingRefresh = ref(false);
let voiceRecorder: MediaRecorder | null = null;
let voiceStream: MediaStream | null = null;
let voiceChunks: Blob[] = [];
let voiceRecognition: BrowserSpeechRecognition | null = null;
let voiceTimer: number | undefined;
let callTimer: number | undefined;
let callBackgroundRotationTimer: number | undefined;
let callAudio: HTMLAudioElement | null = null;
let callRingtoneAudio: HTMLAudioElement | null = null;
let callAmbientAudio: HTMLAudioElement | null = null;
let localCameraStream: MediaStream | null = null;
let callRecognition: BrowserSpeechRecognition | null = null;
let callPlaybackRunId = 0;
let callFloatDrag: CallFloatDragState | null = null;
let suppressCallFloatClick = false;
let callInputBlurTimer: number | undefined;
let callSpeechFlushTimer: number | undefined;
const callReplyQueue = ref<QueuedCallReply[]>([]);
let conversationReadTimer: number | undefined;
let bottomRestoreQueued = false;
let bottomRestoreFrameId = 0;
let bottomRestoreTimerId = 0;
let discardRecording = false;
let voiceRecognitionStartText = '';
let voiceRecognitionFinalText = '';
let voiceRecognitionStopping = false;
let voiceRecognitionRunId = 0;
let callSpeechFinalText = '';
let callRecognitionStopping = false;
let callRecognitionRunId = 0;
let callVadStream: MediaStream | null = null;
let callVadContext: AudioContext | null = null;
let callVadAnalyser: AnalyserNode | null = null;
let callVadFrame: number | undefined;
let callVadRunId = 0;
let callVadLastVoiceAt = 0;
let callLipSyncFrame: number | undefined;

const bottomStickThreshold = 72;
const bottomRestoreSettleMs = 220;

const conversation = computed(() => store.conversationById(props.id));
const character = computed(() => (conversation.value ? store.characterById(conversation.value.charId) : undefined));
const relationship = computed(() => getFriendRelationship(character.value ?? { relationship: undefined }));
const relationshipStatus = computed(() => relationship.value.status);
const isFriendRelationship = computed(() => relationshipStatus.value === 'friend');
const canSendFriendRequest = computed(() => ['blocked-by-character', 'deleted-by-character', 'deleted-by-user'].includes(relationshipStatus.value));
const relationshipStateTitle = computed(() => ({
  friend: `${relationshipUserName.value}与${relationshipCharacterName.value}是好友`,
  'blocked-by-user': `${relationshipUserName.value}已将${relationshipCharacterName.value}加入黑名单`,
  'blocked-by-character': `${relationshipCharacterName.value}已拒收${relationshipUserName.value}的消息`,
  'pending-user-request': `${relationshipUserName.value}已向${relationshipCharacterName.value}发送好友验证`,
  'pending-character-request': `${relationshipCharacterName.value}请求添加${relationshipUserName.value}为好友`,
  'deleted-by-user': `${relationshipUserName.value}已删除${relationshipCharacterName.value}`,
  'deleted-by-character': `${relationshipCharacterName.value}已删除与${relationshipUserName.value}的好友关系`
}[relationshipStatus.value] ?? '暂时无法聊天'));
const relationshipStateDescription = computed(() => {
  if (relationshipStatus.value === 'blocked-by-user') return `${relationshipUserName.value}将${relationshipCharacterName.value}移出黑名单后即可恢复好友关系。`;
  if (relationshipStatus.value === 'pending-user-request') return `正在等待${relationshipCharacterName.value}决定是否重新与${relationshipUserName.value}成为好友。`;
  if (relationshipStatus.value === 'pending-character-request') return relationship.value.requestMessage || `${relationshipCharacterName.value}想重新与${relationshipUserName.value}成为好友。`;
  return relationship.value.reason || `${relationshipUserName.value}可以向${relationshipCharacterName.value}发送好友验证，尝试重新建立联系。`;
});
const characterDisplayName = computed(() => character.value ? getCharacterDisplayName(character.value) : '该好友');
const boundUser = computed(() => {
  const userId = conversation.value?.userId || character.value?.boundUserId || '';
  return userId ? store.userById(userId) ?? null : null;
});
const relationshipCharacterName = computed(() => character.value ? getCharacterAiName(character.value) : '好友');
const relationshipUserName = computed(() => getUserAiName(boundUser.value));
const conversationUser = computed(() => {
  const user = boundUser.value;
  if (!user) return null;

  const profile = normalizeVisualProfile(character.value?.boundUserProfile, user);
  return {
    ...user,
    avatar: profile.avatar || user.avatar,
    nickname: user.nickname,
    signature: user.signature,
    profile: normalizeVisualProfile({
      ...profile,
      nickname: user.nickname,
      bio: user.signature
    }, user)
  };
});
const chatSettings = computed(() => store.settingsForConversation(props.id));
const characterImageProfile = computed<CharacterImageProfile>(() => ({
  appearancePrompt: String(character.value?.imageProfile?.appearancePrompt ?? '').trim(),
  facePrompt: String(character.value?.imageProfile?.facePrompt ?? '').trim(),
  referenceImage: String(character.value?.imageProfile?.referenceImage ?? '').trim(),
  referenceImageEnabled: character.value?.imageProfile?.referenceImageEnabled !== false,
  voomPortraitModeEnabled: character.value?.imageProfile?.voomPortraitModeEnabled !== false,
  seed: String(character.value?.imageProfile?.seed ?? '').trim(),
  photos: normalizeCharacterPhotoRecords(character.value?.imageProfile?.photos),
  hiddenSourcePhotoKeys: normalizeHiddenSourcePhotoKeys(character.value?.imageProfile?.hiddenSourcePhotoKeys)
}));
const characterPhotoPool = computed(() => {
  const currentCharacter = character.value;
  if (!currentCharacter) return [];
  return collectCharacterPhotoImages({
    character: currentCharacter,
    conversations: store.conversations,
    messages: store.messages,
    voomPosts: store.voomPosts
  });
});
const callBackgroundPhotoPoolKey = computed(() => activeCall.value ? characterPhotoPool.value.join('|') : '');
const allOnlineMessages = computed(() => {
  const messages = store.messagesForConversation(props.id).filter((message) => message.mode === 'online');
  const displayMessages = messages.filter((message) => !message.contextOnly && !message.gobangId && !isVoomNarrationMessage(message) && !isCallSubtitleMessage(message));
  return mergeVoomLikeMessages(displayMessages);
});
const onlineMessageEntries = computed<OnlineMessageEntry[]>(() => {
  const messages = allOnlineMessages.value;
  const timeLabels = messages.map((message, messageIndex) => {
    const previousMessage = messages[messageIndex - 1];
    return shouldShowChatTimeDivider(message.createdAt, previousMessage?.createdAt)
      ? formatChatTimeDivider(message.createdAt)
      : '';
  });
  const groupPositions = resolveMessageGroupPositions(messages, timeLabels.map(Boolean));
  return messages.map((message, messageIndex) => ({
    message,
    messageIndex,
    timeLabel: timeLabels[messageIndex],
    hideAvatar: shouldHideAvatar(messageIndex),
    groupPosition: groupPositions[messageIndex]
  }));
});
const messageVirtualizer = useVirtualizer(computed(() => ({
  count: onlineMessageEntries.value.length,
  getScrollElement: () => messageListRef.value,
  estimateSize: () => 84,
  getItemKey: (index: number) => onlineMessageEntries.value[index]?.message.id ?? index,
  overscan: 8,
  anchorTo: 'end' as const,
  followOnAppend: 'auto' as const,
  scrollEndThreshold: bottomStickThreshold,
  useAnimationFrameWithResizeObserver: true
})));
const virtualMessageRows = computed(() => messageVirtualizer.value.getVirtualItems());
const virtualMessageTotalSize = computed(() => messageVirtualizer.value.getTotalSize());
function measureVirtualMessageElement(element: unknown) {
  if (element instanceof Element) messageVirtualizer.value.measureElement(element);
}
const selectedMessageIdSet = computed(() => new Set(selectedMessageIds.value));
function shouldHideAvatar(index: number) {
  if (!chatSettings.value.appearance.showOnlyFirstAvatarInReply) return false;
  const message = allOnlineMessages.value[index];
  const previousMessage = allOnlineMessages.value[index - 1];
  const sender = message ? getMessageVisualSender(message) : 'system';
  const previousSender = previousMessage ? getMessageVisualSender(previousMessage) : 'system';
  return Boolean(message && previousMessage && sender !== 'system' && sender === previousSender);
}

function getMessageVisualSender(message: ChatMessage): ChatMessage['sender'] {
  if (!message.call) return message.sender;
  return message.call.direction === 'incoming' ? 'char' : 'user';
}

const chatSurfaceStyle = computed(() => ({
  backgroundColor: chatSettings.value.appearance.backgroundColor,
  backgroundImage: chatSettings.value.appearance.backgroundImage ? `url(${chatSettings.value.appearance.backgroundImage})` : 'none'
}));
const messageListStyle = computed(() => ({
  backgroundColor: 'transparent',
  backgroundImage: 'none'
}));
const currentConversationReplying = computed(() => store.isConversationReplying(props.id));
const selectedMessageCount = computed(() => selectedMessageIds.value.length);
const hasUnreadMindState = computed(() => Boolean(character.value?.mindState?.lines.length
  && character.value.mindState.updatedAt > character.value.mindState.readAt));
const unreadMindStateMessageId = computed(() => {
  if (!hasUnreadMindState.value) return '';
  return [...allOnlineMessages.value].reverse().find((message) => getMessageVisualSender(message) === 'char')?.id ?? '';
});
const activeMessageIsSynthetic = computed(() => Boolean(activeMessage.value?.id.includes('__')));
const activeMessageTransferIsReceipt = computed(() => Boolean(activeMessage.value?.transfer?.responseToMessageId));
const canRecallActiveMessage = computed(() => Boolean(activeMessage.value && activeMessage.value.sender === 'user' && !activeMessageIsSynthetic.value));
const canQuoteActiveMessage = computed(() => Boolean(activeMessage.value && canQuoteMessage(activeMessage.value)));
const canEditActiveMessage = computed(() => Boolean(activeMessage.value && !activeMessageIsSynthetic.value && !activeMessageTransferIsReceipt.value && !activeMessage.value.musicListenInvite && !activeMessage.value.linkPreview && !activeMessage.value.theaterLink && !activeMessage.value.call && !activeMessage.value.gobang));
const canFavoriteActiveMessage = computed(() => Boolean(activeMessage.value && !activeMessageIsSynthetic.value && store.canFavoriteMessage(activeMessage.value)));
const isActiveMessageFavorited = computed(() => Boolean(activeMessage.value && store.isMessageFavorited(activeMessage.value.id)));
const favoriteActionLabel = computed(() => {
  if (isActiveMessageFavorited.value) return '已收藏';
  if (!canFavoriteActiveMessage.value) return '不可收藏';
  return '收藏';
});
const canRegenerateActiveVoice = computed(() => Boolean(activeMessage.value?.sender === 'char'
  && activeMessage.value.voice?.transcript.trim()
  && !activeMessageIsSynthetic.value));
const regeneratingActiveVoice = computed(() => Boolean(activeMessage.value && regeneratingVoiceMessageIds.value.includes(activeMessage.value.id)));
const canRegenerateChatImage = computed(() => Boolean(getSelectedImageModelOption(store.settings, 'onlineChat')));
const recordedVoiceSeconds = computed(() => recordingVoice.value
  ? Math.max(1, Math.round(recordingElapsed.value))
  : recordedVoiceDraft.value?.duration ?? 0);
const textVoiceDuration = computed(() => estimateVoiceDuration(voiceTextDraft.value));
const voiceRecordStatus = computed(() => {
  if (recordingVoice.value) {
    if (recognizingVoice.value) return '正在录音 · 转文字中';
    if (voiceRecognitionNotice.value) return `正在录音 · ${voiceRecognitionNotice.value}`;
    return '正在录音';
  }
  if (recordedVoiceDraft.value) return '录音已就绪';
  return '等待录音';
});
const canSendLocation = computed(() => Boolean(locationNameDraft.value.trim() && locationDistanceDraft.value.trim()));
const normalizedTransferAmount = computed(() => transferAmountDraft.value.replace(/[￥¥,\s]/g, '').trim());
const transferAmountPreview = computed(() => normalizedTransferAmount.value || '0.00');
const canSendTransfer = computed(() => /^\d+(?:\.\d{1,2})?$/.test(normalizedTransferAmount.value) && Number(normalizedTransferAmount.value) > 0);
const commerceItems = computed(() => commerceItemsDraft.value
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .slice(0, 8)
  .flatMap((line) => {
    const quantityMatch = line.match(/\s*[×x*]\s*(\d+)\s*$/i);
    const quantity = Math.min(99, Math.max(1, Number(quantityMatch?.[1]) || 1));
    const name = quantityMatch?.index === undefined ? line : line.slice(0, quantityMatch.index).trim();
    return name ? [{ name, quantity }] : [];
  }));
const normalizedCommerceAmount = computed(() => commerceAmountDraft.value.replace(/[￥¥,\s]/g, '').trim());
const commerceAmountPreview = computed(() => normalizedCommerceAmount.value || '0.00');
const commerceItemsPreview = computed(() => commerceItems.value.length
  ? commerceItems.value.map((item) => `${item.name} ×${item.quantity}`).join(' · ')
  : `填写${commerceKind.value === 'takeout' ? '餐品' : '礼物'}后会显示在这里`);
const canSendCommerce = computed(() => Boolean(
  commerceStoreNameDraft.value.trim()
  && commerceItems.value.length
  && /^\d+(?:\.\d{1,2})?$/.test(normalizedCommerceAmount.value)
  && Number(normalizedCommerceAmount.value) > 0
));
const locationPreviewName = computed(() => locationNameDraft.value.trim() || '地点名称');
const locationPreviewAddress = computed(() => locationAddressDraft.value.trim());
const locationPreviewDistance = computed(() => locationDistanceDraft.value.trim() || '未知');
const locationPreviewDistanceLabel = computed(() => `距离对方 ${locationPreviewDistance.value}`);
const locationPreviewMapLabel = computed(() => createLinkMapLabel(locationPreviewAddress.value || locationPreviewName.value, locationPreviewName.value));
const transferPreviewSummary = computed(() => transferNoteDraft.value.trim() || '添加备注后会随转账一起显示');
const musicInviteTrack = computed(() => musicPlayer.currentTrack);
const musicInviteTrackArtists = computed(() => musicInviteTrack.value?.artists.join(' / ') || '会从当前播放或音乐页继续');
const activeListenTogether = computed(() => Boolean(conversation.value && musicPlayer.isListeningWithConversation(props.id)));
const activeListenTrackLabel = computed(() => {
  const track = musicPlayer.currentTrack;
  if (!track) return '等待选歌';
  return `${track.name}-${track.artists.join('/') || '未知歌手'}`;
});
const chatActionLocked = computed(() => currentConversationReplying.value || !isFriendRelationship.value);
const pendingIncomingCallMessage = computed(() => [...store.messagesForConversation(props.id)]
  .reverse()
  .find((message) => message.call?.direction === 'incoming' && message.call.status === 'ringing') ?? null);
const callTranscriptMessages = computed(() => {
  const callId = activeCall.value?.callId;
  if (!callId) return [];
  return store.messagesForConversation(props.id)
    .filter((message) => message.callId === callId && isCallSubtitleMessage(message));
});
const latestCallTranscriptMessage = computed(() => callTranscriptMessages.value.at(-1) ?? null);
const latestCharacterCallMessage = computed(() => [...callTranscriptMessages.value].reverse().find((message) => message.sender === 'char') ?? null);
const callCharacterAiName = computed(() => character.value ? getCharacterAiName(character.value) : '角色');
const callUserAiName = computed(() => getUserAiName(conversationUser.value ?? boundUser.value));
const callPeerName = computed(() => characterDisplayName.value);
const callModeLabel = computed(() => activeCall.value?.mode === 'video' ? '视频通话' : '语音通话');
const callPrimaryStatus = computed(() => {
  const call = activeCall.value;
  if (!call) return '';
  if (call.status === 'incoming-ringing') return `${callPeerName.value} 来电`;
  if (call.status === 'outgoing-ringing') return `正在呼叫 ${callPeerName.value}`;
  if (call.status === 'ended') return callStatusText.value || '通话已结束';
  return callStatusText.value || `${callModeLabel.value}中`;
});
const activeCallDurationLabel = computed(() => {
  const call = activeCall.value;
  if (!call) return '';
  if (call.status !== 'active' && call.status !== 'ended') return callModeLabel.value;
  const seconds = call.status === 'ended' && call.connectedAt && call.endedAt
    ? Math.max(0, Math.round((call.endedAt - call.connectedAt) / 1000))
    : callElapsed.value;
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return `${minutes}:${String(restSeconds).padStart(2, '0')}`;
});
const callInputDisabled = computed(() => !activeCall.value || activeCall.value.status !== 'active');
const callInputPlaceholder = computed(() => {
  if (callSpeechListening.value && callSpeechInterimText.value) return callSpeechInterimText.value;
  if (callSpeechListening.value && callVoiceActive.value) return '正在听你说话';
  if (callSpeechListening.value) return '正在听你说话';
  if (callSpeechNotice.value) return callSpeechNotice.value;
  return '说点什么';
});
const callReplyWaiting = computed(() => Boolean(activeCall.value?.status === 'active' && (callReplyTextPending.value || callReplyQueue.value.length)));
const callReplyButtonDisabled = computed(() => callInputDisabled.value || callBusy.value || callReplyTextPending.value || currentConversationReplying.value || callReplyQueue.value.length > 0);
const showCallInputActions = computed(() => callInputFocused.value);
const callFloatingStyle = computed(() => ({
  transform: `translate3d(${callFloatPosition.value.x}px, ${callFloatPosition.value.y}px, 0)`
}));
const callFloatingSubtitle = computed(() => {
  const latestMessage = latestCallTranscriptMessage.value;
  if (latestMessage) return callMessageText(latestMessage);
  return activeCallDurationLabel.value || callPrimaryStatus.value;
});

function syncActiveCallMetadata() {
  if (!activeCall.value) return;
  store.patchActiveCall(props.id, {
    peerName: callPeerName.value,
    avatar: character.value?.avatar || '',
    subtitle: callFloatingSubtitle.value,
    minimized: callMinimized.value,
    floatPosition: callFloatPosition.value
  });
}

const callLockedBackgroundUrl = computed(() => activeCall.value ? callGeneratedBackgroundUrl.value || activeCall.value.generatedBackgroundUrl || '' : '');
const callPhotoBackgroundUrl = computed(() => activeCall.value ? callLockedBackgroundUrl.value || callRotatingBackgroundUrl.value : '');
const callScreenBackgroundUrl = computed(() => callPhotoBackgroundUrl.value || character.value?.avatar || '');
const callCharacterSpeaking = computed(() => Boolean(activeCall.value?.status === 'active' && (callStatusText.value.includes('正在说话') || callMouthLevel.value > 0.08)));
const callVideoStageStyle = computed(() => ({
  '--call-mouth-height': `${Math.round(5 + callMouthLevel.value * 13)}px`,
  '--call-mouth-scale': (0.55 + callMouthLevel.value * 1.28).toFixed(2)
}));
const callExpressionClass = computed(() => {
  const text = callMessageText(latestCharacterCallMessage.value ?? latestCallTranscriptMessage.value ?? ({ content: '' } as ChatMessage));
  if (/惊|诶|啊|真的吗|不会吧|怎么会/.test(text)) return 'is-surprised';
  if (/害羞|脸红|不好意思|想你|喜欢|抱/.test(text)) return 'is-shy';
  if (/难过|抱歉|对不起|累|痛|哭|低落/.test(text)) return 'is-soft';
  if (/哈哈|开心|太好了|笑|高兴|喜欢/.test(text)) return 'is-happy';
  if (/嗯|想想|等等|也许|可能|为什么/.test(text)) return 'is-thinking';
  return 'is-neutral';
});
const callCameraStatusLabel = computed(() => {
  if (activeCall.value?.mode !== 'video') return '';
  if (localCameraError.value) return localCameraError.value;
  if (activeCall.value.cameraEnabled && localCameraActive.value) return localCameraFacingMode.value === 'user' ? '前置' : '后置';
  return '头像';
});

const recentCallSceneText = computed(() => callTranscriptMessages.value
  .slice(-8)
  .map((message) => `${message.sender === 'char' ? callCharacterAiName.value : callUserAiName.value}: ${callMessageText(message)}`.trim())
  .filter(Boolean)
  .join('\n')
  .slice(0, 900));

function joinCallBackgroundPromptPieces(...pieces: Array<string | undefined>) {
  return pieces.map((piece) => String(piece ?? '').trim()).filter(Boolean).join('\n');
}

function buildCallCharacterAppearancePrompt() {
  const imageProfile = characterImageProfile.value;
  return joinCallBackgroundPromptPieces(
    imageProfile.appearancePrompt ? `Character appearance: ${imageProfile.appearancePrompt}` : '',
    imageProfile.facePrompt ? `Face identity lock: ${imageProfile.facePrompt}` : ''
  );
}

function buildCallSceneDescription() {
  const call = activeCall.value;
  const currentCharacter = character.value;
  const profile = currentCharacter?.profile;
  const identityContext = [
    currentCharacter?.description,
    currentCharacter?.signature,
    currentCharacter?.subtitle,
    profile?.location,
    profile?.bio
  ].map((value) => String(value ?? '').trim()).filter(Boolean).join('; ').slice(0, 500);
  const modeText = call?.mode === 'video' ? 'video call' : 'voice call';
  const statusText = call?.status === 'active' ? 'connected' : call?.status === 'incoming-ringing' || call?.status === 'outgoing-ringing' ? 'ringing' : 'in-call';
  return joinCallBackgroundPromptPieces(
    `${callCharacterAiName.value} during a ${statusText} ${modeText} in LINK.`,
    identityContext ? `Character context: ${identityContext}.` : '',
    recentCallSceneText.value ? `Recent call dialogue and mood:\n${recentCallSceneText.value}` : '',
    'Infer the character\'s current real environment, pose, outfit, styling, and facial expression from the dialogue, time, profile, and relationship context. If details are not explicit, choose a believable everyday moment that fits the character instead of a generic portrait.'
  );
}

function buildCallBackgroundPrompt() {
  const sceneDescription = buildCallSceneDescription();
  const characterAppearance = buildCallCharacterAppearancePrompt();
  const faceConsistency = characterImageProfile.value.referenceImageEnabled && characterImageProfile.value.referenceImage
    ? 'Use the character reference image as identity guidance; keep the same facial structure, eyes, nose, mouth, hairstyle, and overall likeness across call photos.'
    : 'Keep the same character identity and consistent facial features across call photos.';
  return joinCallBackgroundPromptPieces(
    'A vertical 9:16 full-screen realistic character photo for a mobile call background.',
    `Subject: ${callCharacterAiName.value}, one person only, shown as the clear main subject in the current moment of the call.`,
    sceneDescription,
    characterAppearance,
    faceConsistency,
    'Show a believable current background, natural pose, outfit, hairstyle, and facial expression; the image should feel like a fresh live call snapshot, not a staged studio portrait.',
    'The image fills the whole phone screen, immersive but not visually busy, with gentle space near the top and bottom for call controls, no text, no watermark, no user interface, no phone frame.'
  );
}

function buildCallBackgroundNegativePrompt(settings: AppSettings, provider: ImageProviderType) {
  const promptPreset = getImagePromptPresetForProvider(settings, provider);
  return joinCallBackgroundPromptPieces(
    promptPreset.negativePrompt,
    promptPreset.defaultNegativePrompt,
    defaultImageNegativePrompt,
    callBackgroundNegativePrompt
  );
}

function buildCallBackgroundPositivePrompt(settings: AppSettings, provider: ImageProviderType) {
  const promptPreset = getImagePromptPresetForProvider(settings, provider);
  return joinCallBackgroundPromptPieces(promptPreset.positivePrompt, buildCallBackgroundPrompt());
}

async function generateCallBackgroundImage(settings: AppSettings, selectedModel: SelectedImageModelOption) {
  const provider = selectedModel.provider;
  let imageSettings = settings;
  let model = selectedModel.model;
  if (provider === 'openai') {
    const [vendorId, ...modelParts] = selectedModel.model.split('::');
    imageSettings = {
      ...settings,
      imageOpenAi: {
        ...settings.imageOpenAi,
        activeVendorId: vendorId || settings.imageOpenAi.activeVendorId
      }
    };
    model = modelParts.join('::') || settings.imageModel;
  }
  const imageProfile = characterImageProfile.value;
  const positivePrompt = buildCallBackgroundPositivePrompt(settings, provider);
  const negativePrompt = buildCallBackgroundNegativePrompt(settings, provider);
  const result = await generateImageByProvider(provider, imageSettings, {
    positivePrompt,
    negativePrompt,
    referenceImage: imageProfile.referenceImageEnabled ? imageProfile.referenceImage : '',
    size: callBackgroundImageSize.size,
    width: callBackgroundImageSize.width,
    height: callBackgroundImageSize.height,
    model,
    seed: imageProfile.seed
  });
  return { imageUrl: result.imageUrl, provider: result.provider, model, positivePrompt, negativePrompt };
}

function resetCallBackgroundImage() {
  callBackgroundRunId.value += 1;
  callGeneratedBackgroundUrl.value = '';
  callRotatingBackgroundUrl.value = '';
  callBackgroundRequestKey.value = '';
  callBackgroundGenerating.value = false;
  callBackgroundPendingRefresh.value = false;
}

function stopCallBackgroundRotation() {
  if (callBackgroundRotationTimer === undefined) return;
  window.clearInterval(callBackgroundRotationTimer);
  callBackgroundRotationTimer = undefined;
}

function pickCallRotatingBackground() {
  const pool = characterPhotoPool.value;
  if (!pool.length) {
    callRotatingBackgroundUrl.value = '';
    return;
  }
  if (pool.length === 1) {
    callRotatingBackgroundUrl.value = pool[0] ?? '';
    return;
  }
  const candidates = pool.filter((imageUrl) => imageUrl !== callRotatingBackgroundUrl.value);
  const nextPool = candidates.length ? candidates : pool;
  callRotatingBackgroundUrl.value = nextPool[Math.floor(Math.random() * nextPool.length)] ?? '';
}

function syncCallBackgroundRotation() {
  const call = activeCall.value;
  if (!call) {
    stopCallBackgroundRotation();
    callRotatingBackgroundUrl.value = '';
    return;
  }
  const lockedBackgroundUrl = callLockedBackgroundUrl.value;
  if (lockedBackgroundUrl) {
    stopCallBackgroundRotation();
    callRotatingBackgroundUrl.value = lockedBackgroundUrl;
    return;
  }
  if (!characterPhotoPool.value.length) {
    stopCallBackgroundRotation();
    callRotatingBackgroundUrl.value = '';
    return;
  }
  if (!callRotatingBackgroundUrl.value || !characterPhotoPool.value.includes(callRotatingBackgroundUrl.value)) pickCallRotatingBackground();
  if (callBackgroundRotationTimer !== undefined) return;
  callBackgroundRotationTimer = window.setInterval(pickCallRotatingBackground, callBackgroundRotationIntervalMs);
}

async function saveGeneratedCallPhoto(result: { imageUrl: string; provider: ImageProviderType; model: string; positivePrompt: string; negativePrompt: string }) {
  const currentCharacter = character.value;
  if (!currentCharacter) return;
  const existingPhotos = normalizeCharacterPhotoRecords(currentCharacter.imageProfile?.photos);
  if (existingPhotos.some((photo) => photo.imageUrl.trim() === result.imageUrl.trim())) return;
  await store.saveCharacter({
    ...currentCharacter,
    imageProfile: {
      ...characterImageProfile.value,
      photos: [
        createCharacterPhotoRecord({
          imageUrl: result.imageUrl,
          source: 'call-generated',
          title: '通话角色照片',
          prompt: result.positivePrompt,
          negativePrompt: result.negativePrompt,
          provider: result.provider,
          model: result.model,
          size: callBackgroundImageSize.size
        }),
        ...existingPhotos
      ]
    }
  });
}

async function ensureCallBackgroundImage() {
  const call = activeCall.value;
  if (!call) {
    resetCallBackgroundImage();
    return;
  }
  syncCallBackgroundRotation();
  const settings = store.settings;
  const selectedModel = settings && settings.imageGenerationEnabled !== false ? getSelectedImageModelOption(settings, 'callBackground') : null;
  const imageProfile = characterImageProfile.value;
  const sceneKey = buildCallSceneDescription();
  const requestKey = [props.id, character.value?.id ?? '', call.callId, call.mode, selectedModel?.key ?? 'none', imageProfile.appearancePrompt, imageProfile.facePrompt, imageProfile.referenceImageEnabled ? imageProfile.referenceImage : '', imageProfile.seed, sceneKey].join(':');
  if (callBackgroundRequestKey.value === requestKey && (callGeneratedBackgroundUrl.value || callBackgroundGenerating.value)) return;
  if (callBackgroundGenerating.value) {
    callBackgroundPendingRefresh.value = true;
    return;
  }

  const runId = callBackgroundRunId.value + 1;
  callBackgroundRunId.value = runId;
  callBackgroundRequestKey.value = requestKey;
  callBackgroundGenerating.value = false;

  if (!settings || !selectedModel) return;

  callBackgroundGenerating.value = true;
  try {
    const result = await generateCallBackgroundImage(settings, selectedModel);
    if (runId !== callBackgroundRunId.value || callBackgroundRequestKey.value !== requestKey) return;
    callGeneratedBackgroundUrl.value = result.imageUrl;
    store.patchActiveCall(props.id, { generatedBackgroundUrl: result.imageUrl });
    stopCallBackgroundRotation();
    await saveGeneratedCallPhoto(result);
    callRotatingBackgroundUrl.value = result.imageUrl;
  } catch (error) {
    console.warn('Call character photo generation failed, using photo pool fallback.', error);
  } finally {
    if (runId === callBackgroundRunId.value && callBackgroundRequestKey.value === requestKey) {
      callBackgroundGenerating.value = false;
      if (callBackgroundPendingRefresh.value) {
        callBackgroundPendingRefresh.value = false;
        void ensureCallBackgroundImage();
      }
    }
  }
}

function refreshCallBackground() {
  syncCallBackgroundRotation();
  void ensureCallBackgroundImage();
}
const stickerRecommendationBase = computed(() => {
  if (!chatSettings.value.stickerSuggestionsEnabled) return [];
  return recommendStickers({
    query: composerText.value,
    stickers: store.stickers,
    groups: store.sortedStickerGroups,
    messages: store.messagesForConversation(props.id),
    conversationId: props.id,
    boundGroupIds: chatSettings.value.characterStickerGroupIds,
    limit: RECOMMENDED_STICKER_LIMIT
  });
});
const composerStickerSuggestions = computed(() => composerText.value.trim() ? stickerRecommendationBase.value.slice(0, 6) : []);
const stickerModalRecommendations = computed(() => chatSettings.value.stickerSuggestionsEnabled ? stickerRecommendationBase.value : []);
const normalizedEditTransferAmount = computed(() => editTransferAmountDraft.value.replace(/[￥¥,\s]/g, '').trim());
const canSaveEditedMessage = computed(() => {
  const message = activeMessage.value;
  if (!message) return false;
  if (message.location) return Boolean(editLocationNameDraft.value.trim() && editLocationDistanceDraft.value.trim());
  if (message.transfer) return /^\d+(?:\.\d{1,2})?$/.test(normalizedEditTransferAmount.value)
    && Number(normalizedEditTransferAmount.value) > 0
    && (!activeMessageTransferIsReceipt.value || editTransferStatusDraft.value !== 'pending');
  return Boolean(editDraft.value.trim());
});
const { captureKeyboardScrollAnchor, releaseKeyboardScrollGuard, startKeyboardScrollGuard, stopKeyboardScrollGuard } = useKeyboardScrollGuard(messageListRef);

function isMessageListNearBottom() {
  const messageList = messageListRef.value;
  if (!messageList) return false;
  const bottomOffset = Math.max(0, messageList.scrollHeight - messageList.clientHeight - messageList.scrollTop);
  return bottomOffset <= bottomStickThreshold;
}

function scrollMessagesToBottomNow() {
  const messageList = messageListRef.value;
  if (!messageList) return;
  messageVirtualizer.value.scrollToEnd({ behavior: 'auto' });
  messageList.scrollTop = messageList.scrollHeight;
  shouldStickToBottom.value = true;
}

function clearQueuedBottomRestores() {
  if (bottomRestoreFrameId) {
    window.cancelAnimationFrame(bottomRestoreFrameId);
    bottomRestoreFrameId = 0;
  }
  if (bottomRestoreTimerId) {
    window.clearTimeout(bottomRestoreTimerId);
    bottomRestoreTimerId = 0;
  }
}

function restoreMessagesToBottomAfterLayout() {
  clearQueuedBottomRestores();
  bottomRestoreFrameId = window.requestAnimationFrame(() => {
    bottomRestoreFrameId = 0;
    scrollMessagesToBottomNow();
  });
  bottomRestoreTimerId = window.setTimeout(() => {
    bottomRestoreTimerId = 0;
    scrollMessagesToBottomNow();
  }, bottomRestoreSettleMs);
}

function focusComposerInput() {
  captureKeyboardScrollAnchor();
  composerRef.value?.focusInput();
  void nextTick(() => {
    composerRef.value?.focusInput();
    queueMessagesToBottomAfterLayout();
  });
  window.setTimeout(() => {
    composerRef.value?.focusInput();
    queueMessagesToBottomAfterLayout();
  }, 80);
}

function queueMessagesToBottomAfterLayout() {
  if (bottomRestoreQueued) return;
  bottomRestoreQueued = true;
  void nextTick(() => {
    bottomRestoreQueued = false;
    restoreMessagesToBottomAfterLayout();
  });
}

async function syncConversationState(id: string) {
  const currentConversation = store.conversationById(id);
  if (currentConversation?.activeMode !== 'online') {
    await store.updateConversationMode(id, 'online');
  }
}

function clearConversationReadTimer() {
  if (conversationReadTimer === undefined) return;
  window.clearTimeout(conversationReadTimer);
  conversationReadTimer = undefined;
}

function scheduleConversationRead() {
  clearConversationReadTimer();
  if (document.visibilityState !== 'visible') return;
  const conversationId = props.id;
  conversationReadTimer = window.setTimeout(() => {
    conversationReadTimer = undefined;
    if (document.visibilityState === 'visible' && props.id === conversationId) {
      void store.markConversationRead(conversationId);
    }
  }, 650);
}

function handleDocumentVisibilityChange() {
  if (document.visibilityState === 'visible') scheduleConversationRead();
  else clearConversationReadTimer();
}

async function scrollMessagesToBottom() {
  await nextTick();
  restoreMessagesToBottomAfterLayout();
}

function focusedMessageId() {
  const value = route.query.focus;
  if (Array.isArray(value)) return value[0] ?? '';
  return typeof value === 'string' ? value : '';
}

async function scrollToOnlineMessage(messageId: string) {
  const targetIndex = allOnlineMessages.value.findIndex((message) => message.id === messageId);
  if (targetIndex < 0) return false;
  shouldStickToBottom.value = false;
  messageVirtualizer.value.scrollToIndex(targetIndex, { align: 'center', behavior: 'auto' });
  await nextTick();
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  const target = messageListRef.value?.querySelector<HTMLElement>(`[data-message-id="${messageId}"]`);
  if (!target) return false;
  target.classList.add('message-focus-pulse');
  window.setTimeout(() => target.classList.remove('message-focus-pulse'), 1400);
  return true;
}

function handleComposerFocus() {
  const shouldStickToBottom = isMessageListNearBottom();
  composerFocused = true;
  startKeyboardScrollGuard();
  if (shouldStickToBottom) queueMessagesToBottomAfterLayout();
}

function handleComposerBlur() {
  composerFocused = false;
  stopKeyboardScrollGuard();
}

function handleComposerDraftText(content: string) {
  composerText.value = content;
  writeComposerDraft(props.id, content);
  store.setAppUpdateTransientOperation(`chat-draft:${props.id}`, '存在未发送的私聊草稿', Boolean(content.trim()));
}

function beginFilePicker(kind: 'camera' | 'local' = 'local') {
  store.setAppUpdateTransientOperation(`chat-file-picker:${props.id}`, kind === 'camera' ? '正在选择相机图片' : '正在选择本地图片', true);
  window.setTimeout(() => window.addEventListener('focus', endFilePicker, { once: true }), 0);
}

function endFilePicker() {
  window.setTimeout(() => store.setAppUpdateTransientOperation(`chat-file-picker:${props.id}`, '', false), 250);
}

function openLocalImagePicker() {
  beginFilePicker('local');
  localImageInputRef.value?.click();
}

function syncChatTransientOperations() {
  const conversationKey = props.id;
  store.setAppUpdateTransientOperation(`chat-image:${conversationKey}`, '正在处理私聊图片或图片草稿', sendingImage.value || Boolean(localImageHintDraft.value.trim()) || Boolean(imageDescriptionDraft.value.trim()));
  store.setAppUpdateTransientOperation(`chat-recording:${conversationKey}`, '正在录音或保留语音草稿', recordingVoice.value || Boolean(recordedVoiceDraft.value) || Boolean(voiceTranscriptDraft.value.trim()) || Boolean(voiceTextDraft.value.trim()));
  store.setAppUpdateTransientOperation(`chat-call-draft:${conversationKey}`, '存在未发送的通话输入', Boolean(callInputDraft.value.trim()));
  store.setAppUpdateTransientOperation(`chat-edit:${conversationKey}`, '存在未保存的消息编辑', showEditModal.value && Boolean(editDraft.value.trim()));
}

watch([
  sendingImage,
  localImageHintDraft,
  imageDescriptionDraft,
  recordingVoice,
  recordedVoiceDraft,
  voiceTranscriptDraft,
  voiceTextDraft,
  callInputDraft,
  showEditModal,
  editDraft
], syncChatTransientOperations, { immediate: true });

function blurActiveKeyboardInput() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLSelectElement) {
    activeElement.blur();
  }
}

function openStickerPanel() {
  const shouldStickToBottom = composerFocused || isMessageListNearBottom();
  blurActiveKeyboardInput();
  showStickers.value = true;
  if (shouldStickToBottom) queueMessagesToBottomAfterLayout();
}

function handleStickerPanelHeightChange(height: number) {
  const previousHeight = stickerPanelHeight.value;
  if (previousHeight === height) return;
  const shouldStickToBottom = showStickers.value && (previousHeight === 0 || isMessageListNearBottom());
  stickerPanelHeight.value = height;
  if (shouldStickToBottom) queueMessagesToBottomAfterLayout();
}

function handleMessageListScroll() {
  shouldStickToBottom.value = isMessageListNearBottom();
}

function resumeActiveCallFromStore() {
  const call = activeCall.value;
  if (!call) return;
  if (!callStatusText.value) {
    if (call.status === 'active') callStatusText.value = `${call.mode === 'video' ? '视频通话' : '语音通话'}中`;
    else if (call.status === 'outgoing-ringing') callStatusText.value = '正在等待接听';
  }
  if (call.status === 'active' && call.connectedAt) startCallTimer(call.connectedAt);
  syncCallRingtonePlayback();
  syncCallAmbientPlayback();
  if (call.status === 'active' && !call.muted) void startCallTranscription();
  syncActiveCallMetadata();
  if (callMinimized.value) callUnreadStartMessageId.value = firstUnreadCharacterMessageId(callTranscriptMessages.value);
  else void scrollCallTranscript({ preferUnread: true });
}

onMounted(async () => {
  await store.hydrate();
  await store.ensureConversationMessagesLoaded(props.id);
  store.setActiveConversation(props.id);
  document.addEventListener('visibilitychange', handleDocumentVisibilityChange);
  await syncConversationState(props.id);
  scheduleConversationRead();
  resumeActiveCallFromStore();
  shouldStickToBottom.value = true;
  const focusId = focusedMessageId();
  if (focusId) {
    await scrollToOnlineMessage(focusId);
  } else {
    await scrollMessagesToBottom();
  }
});

watch(() => props.id, (id) => {
  void (async () => {
    await store.ensureConversationMessagesLoaded(id);
    store.setActiveConversation(id);
    composerText.value = readComposerDraft(id);
    shouldStickToBottom.value = true;
    await syncConversationState(id);
    scheduleConversationRead();
    const focusId = focusedMessageId();
    if (focusId) {
      await scrollToOnlineMessage(focusId);
    } else {
      await scrollMessagesToBottom();
    }
  })();
});

watch(() => allOnlineMessages.value
  .filter((message) => message.sender === 'char' && message.readAt === null)
  .map((message) => message.id)
  .join('|'), scheduleConversationRead, { flush: 'post' });

watch(() => route.query.focus, (value) => {
  const focusId = Array.isArray(value) ? value[0] ?? '' : typeof value === 'string' ? value : '';
  if (focusId) void scrollToOnlineMessage(focusId);
}, { flush: 'post' });

watch(() => [allOnlineMessages.value.length, currentConversationReplying.value], () => {
  if (focusedMessageId()) return;
  if (shouldStickToBottom.value) void scrollMessagesToBottom();
}, {
  flush: 'post'
});

watch(currentConversationReplying, (replying) => {
  if (!replying) void drainCallReplyQueue();
});

watch(() => callTranscriptMessages.value.map((message) => message.id), (_messageIds, previousMessageIds) => {
  if (activeCall.value) {
    if (callMinimized.value) {
      const previousIds = new Set(previousMessageIds);
      const newTranscriptMessages = callTranscriptMessages.value.filter((message) => !previousIds.has(message.id));
      const firstNewUnreadMessageId = firstUnreadCharacterMessageId(newTranscriptMessages);
      if (!callUnreadStartMessageId.value && firstNewUnreadMessageId) callUnreadStartMessageId.value = firstNewUnreadMessageId;
    } else {
      void scrollCallTranscript();
    }
  }
  if (!callReplyTextPending.value || !callReplyPendingCallId.value || activeCall.value?.callId !== callReplyPendingCallId.value) return;
  const charMessageCount = callTranscriptMessages.value.filter((message) => message.sender === 'char').length;
  if (charMessageCount > callReplyPendingCharCount.value) clearCallReplyTextPending();
}, { flush: 'post' });

watch([
  () => activeCall.value?.callId,
  () => activeCall.value?.status,
  () => callMinimized.value,
  () => callFloatPosition.value.x,
  () => callFloatPosition.value.y,
  () => callFloatingSubtitle.value,
  () => callPeerName.value,
  () => character.value?.avatar
], syncActiveCallMetadata, { flush: 'post' });

watch([
  () => activeCall.value?.callId,
  () => activeCall.value?.mode,
  () => character.value?.id,
  () => callBackgroundPhotoPoolKey.value,
  () => characterImageProfile.value.appearancePrompt,
  () => characterImageProfile.value.facePrompt,
  () => characterImageProfile.value.referenceImageEnabled,
  () => characterImageProfile.value.referenceImage,
  () => characterImageProfile.value.seed,
  () => recentCallSceneText.value,
  () => store.settings?.imageGenerationEnabled,
  () => getSelectedImageModelOption(store.settings, 'callBackground')?.key ?? ''
], () => {
  syncCallBackgroundRotation();
  void ensureCallBackgroundImage();
}, { flush: 'post', immediate: true });

watch(() => composerStickerSuggestions.value.length, () => {
  if (composerFocused || isMessageListNearBottom()) queueMessagesToBottomAfterLayout();
});

watch(showStickers, (open) => {
  if (!open) {
    stickerPanelHeight.value = 0;
    if (isMessageListNearBottom()) queueMessagesToBottomAfterLayout();
  }
});

watch(showVoicePanel, (open) => {
  if (!open) resetVoicePanel();
});

watch(pendingIncomingCallMessage, (message) => {
  if (!message || activeCall.value) return;
  openIncomingCall(message);
}, { flush: 'post', immediate: true });

watch(() => localCameraVideoRef.value, () => {
  bindLocalCameraStream();
});

watch(() => [activeCall.value?.status, activeCall.value?.callId, character.value?.id, store.settings?.ringtoneSettings] as const, () => {
  syncCallRingtonePlayback();
});

watch(() => [activeCall.value?.status, activeCall.value?.callId, chatSettings.value.call.ambientSound?.url, chatSettings.value.call.ambientEnabled, chatSettings.value.call.ambientVolume] as const, () => {
  syncCallAmbientPlayback();
});

async function sendBubble(content: string) {
  releaseKeyboardScrollGuard();
  await store.appendUserMessage(props.id, content, quoteTarget.value);
  quoteTarget.value = null;
  writeComposerDraft(props.id, '');
}

async function sendAndReply(content: string) {
  releaseKeyboardScrollGuard();
  if (content.trim()) {
    await store.appendUserMessage(props.id, content, quoteTarget.value);
    quoteTarget.value = null;
    writeComposerDraft(props.id, '');
  }
  const blockedInteraction = !isFriendRelationship.value;
  const relationshipInstruction = blockedInteraction
    ? relationshipStatus.value === 'blocked-by-user' || relationshipStatus.value === 'deleted-by-user'
      ? `黑名单互动：${relationshipUserName.value}已拉黑或删除${relationshipCharacterName.value}，${relationshipCharacterName.value}的普通消息会发送失败并显示感叹号，但${relationshipUserName.value}点击了“回复”让${relationshipCharacterName.value}继续行动。${relationshipCharacterName.value}可以按人设尝试发送消息，也可以在确实想恢复关系时用 relationshipAction.request_friend 重新申请${relationshipUserName.value}为好友；不要假装消息已正常送达。`
      : `黑名单互动：${relationshipCharacterName.value}已拉黑或删除${relationshipUserName.value}，但${relationshipUserName.value}点击了“回复”让关系继续发展。请按${relationshipCharacterName.value}的人设决定保持边界、说出反应，或等待${relationshipUserName.value}通过正式好友验证恢复关系；不要把当前状态假装成正常好友聊天。`
    : undefined;
  await store.requestRoleplayReply(props.id, {
    blockedInteraction,
    replyInstruction: relationshipInstruction
  });
}

async function requestReplyFromUserAvatar() {
  if (currentConversationReplying.value) {
    store.showConfigAlert('正在生成回复，请等待当前生成完成。', '正在生成');
    return;
  }
  await sendAndReply('');
}

async function sendStickerSuggestion(sticker: Sticker) {
  releaseKeyboardScrollGuard();
  await store.sendStickerMessage(props.id, sticker, quoteTarget.value);
  quoteTarget.value = null;
}

function openImagePanel() {
  imageSendTab.value = 'local';
  showImagePanel.value = true;
}

async function appendImageMessage(image: ChatImageAttachment, content: string) {
  releaseKeyboardScrollGuard();
  const userMessage = await store.appendUserImageMessage(props.id, content, image, quoteTarget.value);
  if (!userMessage) return;
  quoteTarget.value = null;
}

async function sendImageFile(file: File, kind: 'photo' | 'local') {
  if (sendingImage.value || currentConversationReplying.value) return;
  sendingImage.value = true;
  try {
    const image = await readChatImageFile(file);
    const isPhoto = kind === 'photo';
    const description = isPhoto ? '相机照片' : '本地图片';
    await appendImageMessage({
      kind,
      description,
      aiHint: kind === 'local' ? localImageHintDraft.value.trim() || undefined : undefined,
      url: image.dataUrl,
      fileName: file.name,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height
    }, '[图片]');
    if (kind === 'local') localImageHintDraft.value = '';
    showImagePanel.value = false;
  } catch (error) {
    store.showConfigAlert(error instanceof Error ? error.message : '图片读取失败。', '无法发送图片');
  } finally {
    sendingImage.value = false;
  }
}

async function sendCapturedPhoto(file: File) {
  await sendImageFile(file, 'photo');
}

async function sendLocalImageFromInput(event: Event) {
  endFilePicker();
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file?.type.startsWith('image/')) return;
  await sendImageFile(file, 'local');
}

async function sendDescriptionImage() {
  const description = imageDescriptionDraft.value.trim();
  if (!description || sendingImage.value || currentConversationReplying.value) return;
  sendingImage.value = true;
  try {
    await appendImageMessage({
      kind: 'description',
      description
    }, `[图片描述卡片] ${description}`);
    imageDescriptionDraft.value = '';
    showImagePanel.value = false;
  } finally {
    sendingImage.value = false;
  }
}

function estimateVoiceDuration(content: string) {
  const textLength = content.trim().length;
  return Math.max(1, Math.min(60, Math.ceil(textLength / 4)));
}

function formatVoiceDuration(seconds: number) {
  if (!seconds) return '0"';
  return `${Math.max(1, Math.round(seconds))}"`;
}

function openVoicePanel() {
  voiceSendTab.value = 'record';
  showVoicePanel.value = true;
}

function openLocationPanel() {
  if (chatActionLocked.value) return;
  showActionMenu.value = false;
  locationNameDraft.value = '';
  locationAddressDraft.value = '';
  locationDistanceDraft.value = '';
  showLocationPanel.value = true;
}

function openTransferPanel() {
  if (chatActionLocked.value) return;
  showActionMenu.value = false;
  transferAmountDraft.value = '';
  transferNoteDraft.value = '';
  showTransferPanel.value = true;
}

function openCommercePanel(kind: UserCommerceKind) {
  if (chatActionLocked.value) return;
  showActionMenu.value = false;
  commerceKind.value = kind;
  commerceStoreNameDraft.value = '';
  commerceItemsDraft.value = '';
  commerceAmountDraft.value = '';
  commerceEtaDraft.value = '';
  commerceNoteDraft.value = '';
  commerceCardMessageDraft.value = '';
  showCommercePanel.value = true;
}

function openMusicListenInvitePanel() {
  if (chatActionLocked.value) return;
  showActionMenu.value = false;
  musicListenNoteDraft.value = '';
  showMusicListenPanel.value = true;
}

async function goToMusicPage() {
  await router.push({ name: 'music' });
}

async function confirmStopListenTogether() {
  await store.stopMusicListenTogether(props.id, 'user');
  showStopListenConfirm.value = false;
  await scrollMessagesToBottom();
}

function openNarrationPanel() {
  if (chatActionLocked.value) return;
  showActionMenu.value = false;
  narrationDraft.value = '';
  showNarrationPanel.value = true;
}

async function sendTransferMessage() {
  if (!canSendTransfer.value || chatActionLocked.value) return;
  releaseKeyboardScrollGuard();
  const userMessage = await store.appendUserTransferMessage(props.id, {
    amount: normalizedTransferAmount.value,
    note: transferNoteDraft.value.trim() || undefined
  }, quoteTarget.value);
  if (!userMessage) return;
  quoteTarget.value = null;
  showTransferPanel.value = false;
  await scrollMessagesToBottom();
}

async function sendCommerceMessage() {
  if (!canSendCommerce.value || chatActionLocked.value) return;
  releaseKeyboardScrollGuard();
  try {
    const userMessage = await store.appendUserCommerceMessage(props.id, {
      kind: commerceKind.value,
      storeName: commerceStoreNameDraft.value.trim(),
      items: commerceItems.value,
      totalAmount: normalizedCommerceAmount.value,
      eta: commerceKind.value === 'takeout' ? commerceEtaDraft.value.trim() || undefined : undefined,
      note: commerceNoteDraft.value.trim() || undefined,
      cardMessage: commerceKind.value === 'gift' ? commerceCardMessageDraft.value.trim() || undefined : undefined
    });
    if (!userMessage) return;
    showCommercePanel.value = false;
    await scrollMessagesToBottom();
  } catch (error) {
    store.showConfigAlert(error instanceof Error ? error.message : '订单发送失败。', '无法发送订单');
  }
}

async function respondToTransfer(messageId: string, status: Exclude<ChatTransferStatus, 'pending'>) {
  return store.updateTransferStatus(messageId, status, 'user');
}

async function sendMusicListenInviteMessage() {
  if (chatActionLocked.value) return;
  releaseKeyboardScrollGuard();
  const userMessage = await store.appendUserMusicListenInviteMessage(props.id, {
    note: musicListenNoteDraft.value.trim() || undefined,
    track: musicInviteTrack.value ?? undefined
  }, quoteTarget.value);
  if (!userMessage) return;
  quoteTarget.value = null;
  showMusicListenPanel.value = false;
  await scrollMessagesToBottom();
}

async function acceptMusicListenInvite(message: ChatMessage) {
  if (!message.musicListenInvite || message.musicListenInvite.status !== 'pending') return;
  await store.acceptMusicListenInvite(message.id);
}

async function rejectMusicListenInvite(message: ChatMessage) {
  if (!message.musicListenInvite || message.musicListenInvite.status !== 'pending') return;
  await store.rejectMusicListenInvite(message.id);
}

async function rejectOfflineInvitation(message: ChatMessage) {
  if (!message.offlineInvitation || message.offlineInvitation.status !== 'pending') return;
  await store.rejectOfflineInvitation(message.id);
}

async function acceptOfflineInvitation(message: ChatMessage) {
  if (!message.offlineInvitation || message.offlineInvitation.status !== 'pending') return;
  const accepted = await store.acceptOfflineInvitation(message.id);
  if (!accepted) return;
  await router.replace({ name: 'offline-room', params: { id: props.id } });
}

async function appendLocationMessage(location: ChatLocationAttachment) {
  releaseKeyboardScrollGuard();
  const userMessage = await store.appendUserLocationMessage(props.id, location, quoteTarget.value);
  if (!userMessage) return;
  quoteTarget.value = null;
  await scrollMessagesToBottom();
}

async function sendLocationMessage() {
  const name = locationNameDraft.value.trim();
  const distance = locationDistanceDraft.value.trim();
  if (!name || !distance || chatActionLocked.value) return;
  await appendLocationMessage({
    name,
    address: locationAddressDraft.value.trim() || undefined,
    distance
  });
  showLocationPanel.value = false;
}

async function sendNarrationMessage() {
  const content = narrationDraft.value.trim();
  if (!content || chatActionLocked.value) return;
  releaseKeyboardScrollGuard();
  const message = await store.appendConversationEvent(props.id, content, { mode: 'online' });
  if (!message) return;
  narrationDraft.value = '';
  showNarrationPanel.value = false;
  await scrollMessagesToBottom();
}

function clearCallTimer() {
  if (callTimer === undefined) return;
  window.clearInterval(callTimer);
  callTimer = undefined;
}

function startCallTimer(connectedAt = Date.now()) {
  clearCallTimer();
  callElapsed.value = Math.max(0, Math.floor((Date.now() - connectedAt) / 1000));
  callTimer = window.setInterval(() => {
    callElapsed.value = Math.max(0, Math.floor((Date.now() - connectedAt) / 1000));
  }, 1000);
}

function stopCallAudio() {
  callPlaybackRunId += 1;
  stopCallLipSync();
  if (!callAudio) return;
  callAudio.pause();
  callAudio.src = '';
  callAudio = null;
}

function stopLoopingAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  audio.pause();
  audio.src = '';
}

function stopCallRingtone() {
  stopLoopingAudio(callRingtoneAudio);
  callRingtoneAudio = null;
}

function stopCallAmbient() {
  stopLoopingAudio(callAmbientAudio);
  callAmbientAudio = null;
}

function playLoopingAudio(url: string, currentAudio: HTMLAudioElement | null, volume: number) {
  if (!url) return null;
  const audio = currentAudio ?? new Audio();
  audio.loop = true;
  audio.preload = 'auto';
  audio.setAttribute('playsinline', 'true');
  audio.volume = Math.min(1, Math.max(0, volume));
  audio.muted = false;
  if (audio.getAttribute('src') !== url) {
    audio.src = url;
    audio.load();
  }
  void audio.play().catch(() => undefined);
  return audio;
}

function syncCallRingtonePlayback() {
  const call = activeCall.value;
  const shouldPlay = Boolean(call && (call.status === 'incoming-ringing' || call.status === 'outgoing-ringing'));
  const ringtoneSettings = normalizeRingtoneSettings(store.settings?.ringtoneSettings);
  if (!ringtoneSettings.enabled) {
    stopCallRingtone();
    return;
  }
  const characterId = character.value?.id ?? '';
  const ringtoneUrl = (characterId ? ringtoneSettings.characters[characterId]?.call?.url : '')?.trim() || ringtoneSettings.global.call.url.trim();
  if (!shouldPlay || !ringtoneUrl) {
    stopCallRingtone();
    return;
  }
  callRingtoneAudio = playLoopingAudio(ringtoneUrl, callRingtoneAudio, 0.9);
}

function setCallAmbientDucked(ducked: boolean) {
  if (!callAmbientAudio) return;
  const baseVolume = chatSettings.value.call.ambientVolume;
  callAmbientAudio.volume = Math.min(0.6, Math.max(0.02, baseVolume)) * (ducked ? 0.35 : 1);
}

function syncCallAmbientPlayback() {
  const call = activeCall.value;
  const callSettings = chatSettings.value.call;
  const shouldPlay = Boolean(call?.status === 'active' && callSettings.ambientEnabled && callSettings.ambientSound?.url);
  if (!shouldPlay || !callSettings.ambientSound?.url) {
    stopCallAmbient();
    return;
  }
  callAmbientAudio = playLoopingAudio(callSettings.ambientSound.url, callAmbientAudio, callSettings.ambientVolume);
}

function bindLocalCameraStream() {
  const video = localCameraVideoRef.value;
  if (!video || !localCameraStream) return;
  if (video.srcObject !== localCameraStream) video.srcObject = localCameraStream;
  void video.play().catch(() => undefined);
}

function getAudioContextConstructor() {
  if (typeof window === 'undefined') return null;
  const audioWindow = window as AudioContextWindow;
  return window.AudioContext ?? audioWindow.webkitAudioContext ?? null;
}

async function startLocalCamera() {
  if (localCameraStream) {
    bindLocalCameraStream();
    localCameraActive.value = true;
    localCameraError.value = '';
    return true;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    localCameraError.value = '摄像头不可用';
    return false;
  }
  try {
    localCameraError.value = '';
    localCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: localCameraFacingMode.value } }, audio: false });
    localCameraActive.value = true;
    bindLocalCameraStream();
    return true;
  } catch (error) {
    localCameraActive.value = false;
    localCameraError.value = error instanceof Error && error.name === 'NotAllowedError' ? '未授权摄像头' : '摄像头开启失败';
    return false;
  }
}

async function switchCallCameraFacing() {
  const call = activeCall.value;
  if (!call || call.mode !== 'video' || !call.cameraEnabled || !localCameraActive.value) return;
  const previousFacingMode = localCameraFacingMode.value;
  localCameraFacingMode.value = previousFacingMode === 'user' ? 'environment' : 'user';
  stopLocalCamera();
  const started = await startLocalCamera();
  if (started) return;
  localCameraFacingMode.value = previousFacingMode;
  await startLocalCamera();
}

function stopLocalCamera() {
  localCameraStream?.getTracks().forEach((track) => track.stop());
  localCameraStream = null;
  localCameraActive.value = false;
  const video = localCameraVideoRef.value;
  if (video) video.srcObject = null;
}

function captureLocalCameraFrame() {
  const video = localCameraVideoRef.value;
  if (!video || !localCameraStream || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null;
  const maxDimension = 640;
  const scale = Math.min(1, maxDimension / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(video, 0, 0, width, height);
  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.72),
    width,
    height
  };
}

async function appendCallCameraFrameContext(call: ActiveCallState, cue: string) {
  if (call.mode !== 'video' || !call.cameraEnabled || !localCameraActive.value) return;
  const frame = captureLocalCameraFrame();
  if (!frame) return;
  await store.appendUserCallImageMessage(props.id, {
    kind: 'photo',
    description: '视频通话实时画面',
    aiHint: cue,
    url: frame.dataUrl,
    mimeType: 'image/jpeg',
    width: frame.width,
    height: frame.height
  }, call.callId, call.mode);
}

function clearCallSpeechFlushTimer() {
  if (callSpeechFlushTimer === undefined) return;
  window.clearTimeout(callSpeechFlushTimer);
  callSpeechFlushTimer = undefined;
}

function stopCallTranscription(abort = false) {
  if (abort) callRecognitionRunId += 1;
  stopCallVoiceActivityDetection();
  callRecognitionStopping = true;
  callSpeechListening.value = false;
  callSpeechInterimText.value = '';
  const recognition = callRecognition;
  callRecognition = null;
  if (!recognition) return;
  try {
    if (abort) recognition.abort();
    else recognition.stop();
  } catch {}
}

function stopCallVoiceActivityDetection() {
  callVadRunId += 1;
  if (callVadFrame !== undefined) {
    window.cancelAnimationFrame(callVadFrame);
    callVadFrame = undefined;
  }
  callVadStream?.getTracks().forEach((track) => track.stop());
  callVadStream = null;
  callVadAnalyser = null;
  void callVadContext?.close().catch(() => undefined);
  callVadContext = null;
  callVoiceActive.value = false;
}

function getAudioLevel(analyser: AnalyserNode, data: Uint8Array) {
  analyser.getByteTimeDomainData(data);
  const total = data.reduce((sum, value) => {
    const centered = (value - 128) / 128;
    return sum + centered * centered;
  }, 0);
  return Math.sqrt(total / Math.max(1, data.length));
}

async function startCallVoiceActivityDetection() {
  stopCallVoiceActivityDetection();
  if (!navigator.mediaDevices?.getUserMedia) return;
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) return;
  const runId = ++callVadRunId;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    });
    if (runId !== callVadRunId) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    const context = new AudioContextConstructor();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    callVadStream = stream;
    callVadContext = context;
    callVadAnalyser = analyser;
    callVadLastVoiceAt = 0;
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      if (runId !== callVadRunId || !callVadAnalyser || activeCall.value?.status !== 'active' || activeCall.value.muted) return;
      const now = Date.now();
      const level = getAudioLevel(callVadAnalyser, data);
      const speaking = level > 0.035;
      if (speaking) callVadLastVoiceAt = now;
      callVoiceActive.value = speaking || (callVadLastVoiceAt > 0 && now - callVadLastVoiceAt < 220);
      if (!speaking && callSpeechFinalText.trim() && callVadLastVoiceAt > 0 && now - callVadLastVoiceAt > 460) {
        clearCallSpeechFlushTimer();
        void flushCallSpeechFinalText();
      }
      callVadFrame = window.requestAnimationFrame(tick);
    };
    callVadFrame = window.requestAnimationFrame(tick);
  } catch {
    stopCallVoiceActivityDetection();
  }
}

async function ensureNativeCallMicrophoneAccess(runId: number) {
  if (!Capacitor.isNativePlatform()) return true;
  if (!navigator.mediaDevices?.getUserMedia) {
    callSpeechNotice.value = '麦克风不可用';
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    });
    stream.getTracks().forEach((track) => track.stop());
    return runId === callRecognitionRunId;
  } catch (error) {
    if (runId === callRecognitionRunId) {
      callSpeechNotice.value = error instanceof Error && error.name === 'NotAllowedError' ? '未授权麦克风' : '麦克风开启失败';
    }
    return false;
  }
}

function scheduleCallSpeechFlush() {
  clearCallSpeechFlushTimer();
  callSpeechFlushTimer = window.setTimeout(() => {
    callSpeechFlushTimer = undefined;
    void flushCallSpeechFinalText();
  }, 850);
}

async function flushCallSpeechFinalText() {
  const call = activeCall.value;
  const content = callSpeechFinalText.trim();
  callSpeechFinalText = '';
  callSpeechInterimText.value = '';
  if (!call || call.status !== 'active' || call.muted || !content) return;
  if (!callInputFocused.value) callInputDraft.value = '';
  await store.appendUserCallMessage(props.id, content, call.callId, call.mode);
  await scrollCallTranscript();
  const scene = call.mode === 'video' ? '视频通话' : '语音通话';
  void requestCallReply(`当前正在${scene}中，${callUserAiName.value}刚刚直接说：“${content}”。请让${callCharacterAiName.value}像真实通话一样用适合朗读的短句回应；可以连续发送多个短句，每个短句会显示成字幕并播放 TTS。不要替${callUserAiName.value}补充未说出口的动作、位置或心理。`);
}

async function startCallTranscription() {
  stopCallTranscription(true);
  callRecognitionRunId += 1;
  const runId = callRecognitionRunId;
  callRecognitionStopping = false;
  callSpeechNotice.value = '';
  callSpeechFinalText = '';

  const SpeechRecognition = getVoiceRecognitionConstructor();
  if (!SpeechRecognition) {
    callSpeechNotice.value = '语音转文字不可用';
    return;
  }
  if (!await ensureNativeCallMicrophoneAccess(runId)) return;
  if (runId !== callRecognitionRunId || activeCall.value?.status !== 'active' || activeCall.value.muted) return;

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = getVoiceRecognitionLanguage();
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    if (runId !== callRecognitionRunId) return;
    let interimText = '';
    for (let resultIndex = event.resultIndex; resultIndex < event.results.length; resultIndex += 1) {
      const result = event.results[resultIndex];
      const transcript = result?.[0]?.transcript.trim() ?? '';
      if (!transcript) continue;
      if (result?.isFinal) {
        callSpeechFinalText = joinVoiceRecognitionParts([callSpeechFinalText, transcript]);
        scheduleCallSpeechFlush();
      } else {
        interimText = joinVoiceRecognitionParts([interimText, transcript]);
      }
    }
    callSpeechInterimText.value = interimText;
    if (interimText && !callInputFocused.value) callInputDraft.value = interimText.slice(0, voiceTranscriptLimit);
  };
  recognition.onerror = (event) => {
    if (runId !== callRecognitionRunId || callRecognitionStopping) return;
    callSpeechNotice.value = getVoiceRecognitionErrorText(event.error);
    if (isFatalVoiceRecognitionError(event.error)) callRecognitionStopping = true;
  };
  recognition.onend = () => {
    if (runId !== callRecognitionRunId) return;
    callSpeechListening.value = false;
    const call = activeCall.value;
    if (!callRecognitionStopping && call?.status === 'active' && !call.muted && callRecognition === recognition) {
      window.setTimeout(() => {
        if (runId !== callRecognitionRunId || callRecognitionStopping || activeCall.value?.status !== 'active' || activeCall.value.muted || callRecognition !== recognition) return;
        try {
          recognition.start();
          callSpeechListening.value = true;
          callSpeechNotice.value = '';
        } catch {
          callSpeechNotice.value = '语音转文字暂停';
        }
      }, 180);
      return;
    }
    if (callRecognition === recognition) callRecognition = null;
    if (callRecognitionStopping) stopCallVoiceActivityDetection();
  };
  callRecognition = recognition;

  try {
    recognition.start();
    callSpeechListening.value = true;
    if (!Capacitor.isNativePlatform()) void startCallVoiceActivityDetection();
  } catch {
    callRecognition = null;
    callSpeechNotice.value = '语音转文字启动失败';
  }
}

function clearCallInputBlurTimer() {
  if (callInputBlurTimer === undefined) return;
  window.clearTimeout(callInputBlurTimer);
  callInputBlurTimer = undefined;
}

function keepCallInputActions() {
  clearCallInputBlurTimer();
  callInputFocused.value = true;
}

function handleCallInputFocus() {
  clearCallInputBlurTimer();
  callInputFocused.value = true;
}

function handleCallInputBlur() {
  clearCallInputBlurTimer();
  callInputBlurTimer = window.setTimeout(() => {
    callInputFocused.value = false;
    callInputBlurTimer = undefined;
  }, 120);
}

function stopCallLipSync() {
  if (callLipSyncFrame !== undefined) {
    window.cancelAnimationFrame(callLipSyncFrame);
    callLipSyncFrame = undefined;
  }
  callMouthLevel.value = 0;
}

function startCallLipSync(audio: HTMLAudioElement, runId: number) {
  stopCallLipSync();
  const tick = () => {
    if (runId !== callPlaybackRunId || audio.ended || audio.paused) {
      callMouthLevel.value = 0;
      return;
    }
    const time = audio.currentTime || 0;
    const pulse = Math.abs(Math.sin(time * 18.5)) * 0.55 + Math.abs(Math.sin(time * 7.25)) * 0.32;
    callMouthLevel.value = Math.min(1, Math.max(0.18, pulse));
    callLipSyncFrame = window.requestAnimationFrame(tick);
  };
  callLipSyncFrame = window.requestAnimationFrame(tick);
}

function playCallAudioUrl(audioUrl: string, runId: number) {
  return new Promise<void>((resolve) => {
    if (runId !== callPlaybackRunId) return resolve();
    const audio = new Audio(audioUrl);
    callAudio = audio;
    audio.muted = !activeCall.value?.speakerEnabled;
    audio.onplay = () => startCallLipSync(audio, runId);
    audio.onended = () => {
      stopCallLipSync();
      resolve();
    };
    audio.onerror = () => {
      stopCallLipSync();
      resolve();
    };
    void audio.play().then(() => undefined, () => resolve());
  });
}

function splitCallVoiceTranscript(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const sentences = normalized.match(/[^。！？!?；;…]+[。！？!?；;…]*/g)?.map((part) => part.trim()).filter(Boolean) ?? [normalized];
  const chunks: string[] = [];
  let currentChunk = '';
  for (const sentence of sentences) {
    if (sentence.length > 96) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      for (let index = 0; index < sentence.length; index += 72) {
        chunks.push(sentence.slice(index, index + 72).trim());
      }
      continue;
    }
    const nextChunk = currentChunk ? `${currentChunk}${sentence}` : sentence;
    if (nextChunk.length > 96 && currentChunk) {
      chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      currentChunk = nextChunk;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks.slice(0, 8);
}

async function synthesizeCallVoiceChunk(content: string) {
  const currentSettings = store.settings;
  if (!currentSettings) throw new Error('设置尚未载入。');
  return (await synthesizeSpeech(content, currentSettings, {
    minimaxVoiceId: character.value?.minimaxVoiceId
  })).audioUrl;
}

function prepareCallVoicePlayback(message: ChatMessage): CallVoicePlayback {
  const cachedAudioUrl = message.voice?.audioUrl?.trim();
  if (cachedAudioUrl) return guardCallVoicePlayback({ messageId: message.id, audioUrls: [Promise.resolve(cachedAudioUrl)] });
  const transcript = message.voice?.transcript.trim() ?? '';
  const chunks = splitCallVoiceTranscript(transcript);
  if (chunks.length <= 1) return guardCallVoicePlayback({ messageId: message.id, audioUrls: [store.generateMessageVoiceAudio(message.id)] });
  return guardCallVoicePlayback({
    messageId: message.id,
    audioUrls: chunks.map((chunk) => synthesizeCallVoiceChunk(chunk))
  });
}

function guardCallVoicePlayback(playback: CallVoicePlayback) {
  void Promise.allSettled(playback.audioUrls);
  return playback;
}

async function playCallVoiceMessages(newMessages: ChatMessage[]) {
  const voiceMessages = newMessages.filter((message) => message.sender === 'char' && message.voice?.transcript.trim());
  if (!voiceMessages.length) return;
  const runId = ++callPlaybackRunId;
  let preparedPlayback: CallVoicePlayback | null = prepareCallVoicePlayback(voiceMessages[0]);
  for (let index = 0; index < voiceMessages.length; index += 1) {
    const playback = preparedPlayback;
    preparedPlayback = voiceMessages[index + 1] ? prepareCallVoicePlayback(voiceMessages[index + 1]) : null;
    if (!activeCall.value || activeCall.value.status !== 'active' || runId !== callPlaybackRunId) break;
    try {
      callStatusText.value = '正在生成语音';
      setCallAmbientDucked(true);
      for (const audioUrlPromise of playback?.audioUrls ?? []) {
        const audioUrl = await audioUrlPromise;
        if (!activeCall.value || activeCall.value.status !== 'active' || runId !== callPlaybackRunId) break;
        callStatusText.value = `${callPeerName.value} 正在说话`;
        await playCallAudioUrl(audioUrl, runId);
      }
    } catch {
      callStatusText.value = '语音暂不可用';
    } finally {
      setCallAmbientDucked(false);
    }
  }
  if (activeCall.value?.status === 'active' && runId === callPlaybackRunId) callStatusText.value = `${callModeLabel.value}中`;
}

function callMessageText(message: ChatMessage) {
  return message.voice?.transcript || message.content;
}

function isCallSubtitleMessage(message: ChatMessage) {
  if (!message.callId || message.call || message.contextOnly) return false;
  if (message.displayStyle === 'narration') return true;
  if (message.sender !== 'user' && message.sender !== 'char') return false;
  if (message.sticker || message.image || message.location || message.transfer || message.commerce || message.shopShare || message.musicListenInvite || message.linkPreview || message.theaterLink || message.offlineInvitation) return false;
  return Boolean(message.voice?.transcript.trim() || message.content.trim());
}

async function scrollCallTranscript(options: { preferUnread?: boolean; unreadMessageId?: string } = {}) {
  await nextTick();
  const transcriptList = callSubtitleListRef.value;
  if (!transcriptList) return;
  if (options.preferUnread) {
    scrollMessageContainerToUnreadOrBottom(transcriptList, callTranscriptMessages.value, options.unreadMessageId);
  } else {
    transcriptList.scrollTop = transcriptList.scrollHeight;
  }
}

function closeActiveCall() {
  clearCallTimer();
  stopCallBackgroundRotation();
  resetCallBackgroundImage();
  stopCallAudio();
  stopCallRingtone();
  stopCallAmbient();
  stopLocalCamera();
  stopCallTranscription(true);
  clearCallSpeechFlushTimer();
  clearCallInputBlurTimer();
  callReplyQueue.value = [];
  clearCallReplyTextPending();
  callUnreadStartMessageId.value = '';
  activeCall.value = null;
  callMinimized.value = false;
  callInputDraft.value = '';
  callInputFocused.value = false;
  callStatusText.value = '';
  callElapsed.value = 0;
  callBusy.value = false;
  callSpeechNotice.value = '';
  callSpeechFinalText = '';
  callSpeechInterimText.value = '';
  localCameraFacingMode.value = 'user';
  localCameraError.value = '';
}

function closeEndedCall() {
  if (activeCall.value?.status !== 'ended') return;
  closeActiveCall();
}

function clampCallFloatPosition(x: number, y: number) {
  if (typeof window === 'undefined') return { x, y };
  const padding = 8;
  const floatWidth = 166;
  const floatHeight = 64;
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  return {
    x: Math.min(Math.max(padding, x), Math.max(padding, window.innerWidth - floatWidth - padding)),
    y: Math.min(Math.max(padding + 36, y), Math.max(padding + 36, viewportHeight - floatHeight - padding))
  };
}

function minimizeActiveCall() {
  if (!activeCall.value) return;
  callFloatPosition.value = clampCallFloatPosition(callFloatPosition.value.x, callFloatPosition.value.y);
  callUnreadStartMessageId.value = '';
  callMinimized.value = true;
}

function restoreCallFromFloat() {
  if (suppressCallFloatClick) {
    suppressCallFloatClick = false;
    return;
  }
  const unreadMessageId = callUnreadStartMessageId.value || firstUnreadCharacterMessageId(callTranscriptMessages.value);
  callMinimized.value = false;
  void scrollCallTranscript({ preferUnread: true, unreadMessageId }).finally(() => {
    callUnreadStartMessageId.value = '';
  });
}

function startCallFloatDrag(event: PointerEvent) {
  if (event.button !== 0) return;
  const target = event.currentTarget as HTMLElement | null;
  target?.setPointerCapture?.(event.pointerId);
  callFloatDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: callFloatPosition.value.x,
    originY: callFloatPosition.value.y,
    moved: false
  };
}

function moveCallFloat(event: PointerEvent) {
  const drag = callFloatDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - drag.startX;
  const deltaY = event.clientY - drag.startY;
  if (Math.abs(deltaX) + Math.abs(deltaY) > 4) drag.moved = true;
  callFloatPosition.value = clampCallFloatPosition(drag.originX + deltaX, drag.originY + deltaY);
}

function endCallFloatDrag(event: PointerEvent) {
  const drag = callFloatDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const target = event.currentTarget as HTMLElement | null;
  target?.releasePointerCapture?.(event.pointerId);
  suppressCallFloatClick = drag.moved;
  callFloatDrag = null;
  if (suppressCallFloatClick) window.setTimeout(() => {
    suppressCallFloatClick = false;
  }, 0);
}

async function requestCallReply(replyInstruction: string, options: { captureCamera?: boolean } = {}) {
  const call = activeCall.value;
  if (!call || call.status !== 'active') return;
  const instruction = replyInstruction;
  if (options.captureCamera !== false) await appendCallCameraFrameContext(call, instruction);
  callStatusText.value = `正在等待 ${callPeerName.value} 回复`;
  callReplyQueue.value.push({
    callId: call.callId,
    mode: call.mode,
    instruction
  });
  void drainCallReplyQueue();
}

function clearCallReplyTextPending() {
  callReplyTextPending.value = false;
  callReplyPendingCallId.value = '';
  callReplyPendingCharCount.value = 0;
}

async function drainCallReplyQueue() {
  if (callBusy.value || currentConversationReplying.value) return;
  const queuedReply = callReplyQueue.value[0];
  if (!queuedReply) return;
  const call = activeCall.value;
  if (!call || call.status !== 'active') {
    callReplyQueue.value = [];
    return;
  }
  if (call.callId !== queuedReply.callId) {
    callReplyQueue.value.shift();
    void drainCallReplyQueue();
    return;
  }
  callBusy.value = true;
  callReplyPendingCallId.value = queuedReply.callId;
  callReplyPendingCharCount.value = store.messagesForConversation(props.id)
    .filter((message) => message.callId === queuedReply.callId && !message.call && message.sender === 'char')
    .length;
  callReplyTextPending.value = true;
  callReplyQueue.value.shift();
  const existingMessageIds = new Set(store.messagesForConversation(props.id).map((message) => message.id));
  try {
    callStatusText.value = `${callPeerName.value} 正在回复`;
    const generatedMessages = await store.requestRoleplayReply(props.id, {
      replyInstruction: queuedReply.instruction,
      callSession: {
        callId: queuedReply.callId,
        mode: queuedReply.mode,
        forceVoice: true
      }
    });
    clearCallReplyTextPending();
    const newMessages = (Array.isArray(generatedMessages) ? generatedMessages : store.messagesForConversation(props.id).filter((message) => !existingMessageIds.has(message.id)))
      .filter((message) => message.callId === queuedReply.callId && message.sender === 'char');
    await scrollCallTranscript();
    await playCallVoiceMessages(newMessages);
  } finally {
    clearCallReplyTextPending();
    callBusy.value = false;
    if (callReplyQueue.value.length) void drainCallReplyQueue();
  }
}

async function startCallOpeningReply(direction: 'incoming' | 'outgoing') {
  const call = activeCall.value;
  if (!call || call.status !== 'active') return;
  const scene = call.mode === 'video' ? '视频通话' : '语音通话';
  const instruction = direction === 'incoming'
    ? `${callUserAiName.value}刚刚接听了${callCharacterAiName.value}主动拨来的${scene}。当前正在通话中，请让${callCharacterAiName.value}先用适合朗读的短句自然开口，可以连续发送 1-3 个短句；这些句子会作为通话字幕并播放 TTS。`
    : `${callCharacterAiName.value}刚刚接听了${callUserAiName.value}拨来的${scene}。当前正在通话中，请让${callCharacterAiName.value}先用适合朗读的短句自然开口，可以连续发送 1-3 个短句；这些句子会作为通话字幕并播放 TTS。`;
  await requestCallReply(instruction, { captureCamera: false });
}

async function connectActiveCall(direction: 'incoming' | 'outgoing', options: { requestOpeningReply?: boolean } = {}) {
  const call = activeCall.value;
  if (!call) return;
  const eventMessage = store.messages.find((message) => message.id === call.eventMessageId);
  const connectedAt = eventMessage?.call?.connectedAt ?? Date.now();
  if (eventMessage?.call?.status !== 'accepted') await store.updateCallEventMessage(call.eventMessageId, { status: 'accepted', connectedAt });
  activeCall.value = {
    ...call,
    status: 'active',
    connectedAt
  };
  refreshCallBackground();
  callStatusText.value = '已接通';
  stopCallRingtone();
  syncCallAmbientPlayback();
  startCallTimer(connectedAt);
  if (!activeCall.value.muted) await startCallTranscription();
  if (options.requestOpeningReply !== false) await startCallOpeningReply(direction);
}

async function startOutgoingCall(mode: ChatCallMode) {
  if (chatActionLocked.value || activeCall.value) return;
  showActionMenu.value = false;
  const callId = createId('call');
  const startedAt = Date.now();
  const callEvent = await store.appendCallEventMessage(props.id, {
    callId,
    mode,
    direction: 'outgoing',
    status: 'ringing',
    startedAt
  });
  if (!callEvent?.call) return;
  activeCall.value = {
    callId,
    eventMessageId: callEvent.id,
    mode,
    direction: 'outgoing',
    status: 'outgoing-ringing',
    startedAt,
    muted: false,
    cameraEnabled: false,
    speakerEnabled: true,
    generatedBackgroundUrl: ''
  };
  refreshCallBackground();
  callStatusText.value = '正在等待接听';
  syncCallRingtonePlayback();
  await scrollMessagesToBottom();
  const scene = mode === 'video' ? '视频通话' : '语音通话';
  await store.requestRoleplayReply(props.id, {
    callResponseTargetMessageId: callEvent.id,
    replyInstruction: `${callUserAiName.value}刚刚在 LINK 里向${callCharacterAiName.value}拨打${scene}。这仍然是一轮正常线上聊天回复：请让${callCharacterAiName.value}像平时一样发送 text、voice、sticker、image、location、transfer 等消息气泡，但必须同时在 messageActions.callResponse 写 accepted、rejected、busy 或 missed 表示${callCharacterAiName.value}是否接听。不要输出来电理由或拒绝说明字段；只有 accepted 才表示进入通话。如果接听，不要把接通后的通话内容放进普通 messages，通话页会单独承接后续内容。`
  });
  if (!activeCall.value || activeCall.value.callId !== callId || activeCall.value.status !== 'outgoing-ringing') return;
  const latestCall = store.messages.find((message) => message.id === callEvent.id)?.call;
  if (latestCall?.status === 'accepted') {
    await connectActiveCall('outgoing');
    return;
  }
  if (latestCall?.status === 'ringing') await store.updateCallEventMessage(callEvent.id, { status: 'missed', endedAt: Date.now() });
  closeActiveCall();
}

function openIncomingCall(message: ChatMessage) {
  const call = message.call;
  if (!call || activeCall.value) return;
  clearCallTimer();
  stopCallAudio();
  activeCall.value = {
    callId: call.callId,
    eventMessageId: message.id,
    mode: call.mode,
    direction: 'incoming',
    status: 'incoming-ringing',
    startedAt: call.startedAt,
    muted: false,
    cameraEnabled: false,
    speakerEnabled: true,
    generatedBackgroundUrl: ''
  };
  refreshCallBackground();
  callStatusText.value = '';
  syncCallRingtonePlayback();
}

async function acceptIncomingCall() {
  const call = activeCall.value;
  if (!call || call.status !== 'incoming-ringing') return;
  await connectActiveCall('incoming');
}

async function rejectIncomingCall() {
  const call = activeCall.value;
  if (!call || call.status !== 'incoming-ringing') return;
  const updatedMessage = await store.updateCallEventMessage(call.eventMessageId, { status: 'rejected', endedAt: Date.now() });
  if (updatedMessage?.call) await store.appendCallEndPromptMessage(props.id, updatedMessage.call, 'user');
  closeActiveCall();
}

async function acceptCallMessage(message: ChatMessage) {
  if (!message.call || message.call.direction !== 'incoming' || message.call.status !== 'ringing') return;
  if (!activeCall.value) openIncomingCall(message);
  if (activeCall.value?.callId !== message.call.callId) return;
  await acceptIncomingCall();
}

async function rejectCallMessage(message: ChatMessage) {
  if (!message.call || message.call.direction !== 'incoming' || message.call.status !== 'ringing') return;
  if (!activeCall.value) openIncomingCall(message);
  if (activeCall.value?.callId !== message.call.callId) return;
  await rejectIncomingCall();
}

async function finishActiveCall(status: ChatCallStatus = 'ended') {
  const call = activeCall.value;
  if (!call) return;
  if (call.status === 'incoming-ringing') {
    await rejectIncomingCall();
    return;
  }
  const endedAt = Date.now();
  const duration = call.connectedAt ? Math.max(1, Math.round((endedAt - call.connectedAt) / 1000)) : undefined;
  const updatedMessage = await store.updateCallEventMessage(call.eventMessageId, {
    status,
    endedAt,
    duration
  });
  if (updatedMessage?.call) await store.appendCallEndPromptMessage(props.id, updatedMessage.call, 'user');
  closeActiveCall();
}

async function handleCallHangup() {
  const call = activeCall.value;
  if (!call) return;
  if (call.status === 'ended') {
    closeEndedCall();
    return;
  }
  if (call.status === 'outgoing-ringing') {
    await finishActiveCall('cancelled');
    store.cancelConversationReply(props.id);
    const scene = call.mode === 'video' ? '视频通话' : '语音通话';
    void store.requestRoleplayReply(props.id, {
      replyInstruction: `${callUserAiName.value}刚刚向${callCharacterAiName.value}拨打${scene}，但在${callCharacterAiName.value}接听或拒绝前，${callUserAiName.value}已经主动取消了呼叫。请立刻终止“是否接听通话”的判断，把这当成线上聊天里一次未接通的小插曲，自然回应最近聊天；绝对不要说${callCharacterAiName.value}拒绝了、挂断了或接听了这次呼叫。`
    });
    return;
  }
  await finishActiveCall('ended');
}

function toggleCallMute() {
  const call = activeCall.value;
  if (!call) return;
  const muted = !call.muted;
  activeCall.value = { ...call, muted };
  if (muted) stopCallTranscription();
  else if (activeCall.value.status === 'active') void startCallTranscription();
}

function toggleCallSpeaker() {
  const call = activeCall.value;
  if (!call) return;
  const speakerEnabled = !call.speakerEnabled;
  activeCall.value = { ...call, speakerEnabled };
  if (callAudio) callAudio.muted = !speakerEnabled;
}

async function toggleCallCamera() {
  const call = activeCall.value;
  if (!call || call.mode !== 'video') return;
  if (call.cameraEnabled) {
    stopLocalCamera();
    activeCall.value = { ...call, cameraEnabled: false };
    return;
  }
  activeCall.value = { ...call, cameraEnabled: true };
  const started = await startLocalCamera();
  if (!started && activeCall.value?.callId === call.callId) activeCall.value = { ...activeCall.value, cameraEnabled: false };
}

async function sendCallInput() {
  const call = activeCall.value;
  const content = callInputDraft.value.trim();
  if (!call || callInputDisabled.value || !content) return;
  callInputDraft.value = '';
  await store.appendUserCallMessage(props.id, content, call.callId, call.mode);
  await scrollCallTranscript();
}

async function submitCallReply() {
  const call = activeCall.value;
  if (!call || callReplyButtonDisabled.value) return;
  const content = callInputDraft.value.trim();
  if (content) {
    callInputDraft.value = '';
    await store.appendUserCallMessage(props.id, content, call.callId, call.mode);
    await scrollCallTranscript();
  }
  const scene = call.mode === 'video' ? '视频通话' : '语音通话';
  const userCue = content ? `${callUserAiName.value}刚在通话里说：“${content}”。` : `${callUserAiName.value}点击了“回复”，希望${callCharacterAiName.value}回应当前通话里最近还未回应的内容。`;
  await requestCallReply(`当前正在${scene}中，${userCue}请让${callCharacterAiName.value}像真实通话一样用适合朗读的短句回应；如果${callUserAiName.value}连续说了多条，请合并理解后回复。可以连续发送多个短句；每个短句会显示成字幕并播放 TTS。不要替${callUserAiName.value}补充未说出口的动作、位置或心理。`);
}

function getPreferredAudioMimeType() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
    .find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
}

function getVoiceRecognitionConstructor() {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function getVoiceRecognitionLanguage() {
  if (typeof navigator === 'undefined') return 'zh-CN';
  const language = navigator.language || 'zh-CN';
  return language.toLowerCase().startsWith('zh') ? language : 'zh-CN';
}

function getVoiceRecognitionErrorText(error?: string) {
  if (error === 'not-allowed' || error === 'service-not-allowed') return '未允许转文字';
  if (error === 'audio-capture') return '无法转文字';
  if (error === 'network') return '转文字网络异常';
  if (error === 'language-not-supported') return '语言不支持';
  if (error === 'no-speech') return '等待说话';
  return '转文字暂停';
}

function isFatalVoiceRecognitionError(error?: string) {
  return ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(error ?? '');
}

function joinVoiceRecognitionParts(parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean).join(' ');
}

function syncVoiceRecognitionDraft(interimText = '') {
  const recognizedText = joinVoiceRecognitionParts([voiceRecognitionFinalText, interimText]);
  if (!recognizedText) return;
  const nextText = voiceRecognitionStartText
    ? `${voiceRecognitionStartText}\n${recognizedText}`
    : recognizedText;
  voiceTranscriptDraft.value = nextText.slice(0, voiceTranscriptLimit);
}

function stopVoiceTranscription(abort = false) {
  if (abort) voiceRecognitionRunId += 1;
  voiceRecognitionStopping = true;
  recognizingVoice.value = false;
  const recognition = voiceRecognition;
  voiceRecognition = null;
  if (!recognition) return;
  try {
    if (abort) recognition.abort();
    else recognition.stop();
  } catch {}
}

function startVoiceTranscription() {
  stopVoiceTranscription(true);
  voiceRecognitionRunId += 1;
  const runId = voiceRecognitionRunId;
  voiceRecognitionStopping = false;
  recognizingVoice.value = false;
  voiceRecognitionNotice.value = '';
  voiceRecognitionFinalText = '';

  const SpeechRecognition = getVoiceRecognitionConstructor();
  if (!SpeechRecognition) {
    voiceRecognitionNotice.value = '转文字不可用';
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = getVoiceRecognitionLanguage();
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    if (runId !== voiceRecognitionRunId) return;
    let interimText = '';
    for (let resultIndex = event.resultIndex; resultIndex < event.results.length; resultIndex += 1) {
      const result = event.results[resultIndex];
      const transcript = result?.[0]?.transcript.trim() ?? '';
      if (!transcript) continue;
      if (result?.isFinal) {
        voiceRecognitionFinalText = joinVoiceRecognitionParts([voiceRecognitionFinalText, transcript]);
      } else {
        interimText = joinVoiceRecognitionParts([interimText, transcript]);
      }
    }
    syncVoiceRecognitionDraft(interimText);
  };
  recognition.onerror = (event) => {
    if (runId !== voiceRecognitionRunId || voiceRecognitionStopping) return;
    voiceRecognitionNotice.value = getVoiceRecognitionErrorText(event.error);
    if (isFatalVoiceRecognitionError(event.error)) voiceRecognitionStopping = true;
  };
  recognition.onend = () => {
    if (runId !== voiceRecognitionRunId) return;
    recognizingVoice.value = false;
    if (!voiceRecognitionStopping && recordingVoice.value && voiceRecognition === recognition) {
      window.setTimeout(() => {
        if (runId !== voiceRecognitionRunId || voiceRecognitionStopping || !recordingVoice.value || voiceRecognition !== recognition) return;
        try {
          recognition.start();
          recognizingVoice.value = true;
          voiceRecognitionNotice.value = '';
        } catch {
          voiceRecognitionNotice.value = '转文字暂停';
        }
      }, 160);
      return;
    }
    if (voiceRecognition === recognition) voiceRecognition = null;
  };
  voiceRecognition = recognition;

  try {
    recognition.start();
    recognizingVoice.value = true;
  } catch {
    voiceRecognition = null;
    voiceRecognitionNotice.value = '转文字启动失败';
  }
}

function resetVoiceTranscription() {
  stopVoiceTranscription(true);
  voiceRecognitionNotice.value = '';
  voiceRecognitionStartText = '';
  voiceRecognitionFinalText = '';
  voiceRecognitionStopping = false;
}

function cleanupVoiceRecorder() {
  if (voiceTimer !== undefined) {
    window.clearInterval(voiceTimer);
    voiceTimer = undefined;
  }
  voiceStream?.getTracks().forEach((track) => track.stop());
  voiceStream = null;
  voiceRecorder = null;
  voiceChunks = [];
  recordingVoice.value = false;
  recordingStartedAt.value = 0;
  recordingElapsed.value = 0;
}

function abortVoiceRecording() {
  discardRecording = true;
  stopVoiceTranscription(true);
  if (voiceRecorder) {
    if (voiceRecorder.state !== 'inactive') voiceRecorder.stop();
    return;
  }
  cleanupVoiceRecorder();
  discardRecording = false;
}

function resetVoicePanel() {
  abortVoiceRecording();
  resetVoiceTranscription();
  voiceSendTab.value = 'record';
  voiceTranscriptDraft.value = '';
  voiceTextDraft.value = '';
  recordedVoiceDraft.value = null;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('语音读取失败。'));
    reader.readAsDataURL(blob);
  });
}

async function finalizeVoiceRecording(recorder: MediaRecorder) {
  const shouldDiscard = discardRecording;
  discardRecording = false;
  stopVoiceTranscription(shouldDiscard);
  const chunks = [...voiceChunks];
  const duration = Math.max(1, Math.round((Date.now() - recordingStartedAt.value) / 1000) || Math.round(recordingElapsed.value));
  const mimeType = recorder.mimeType || chunks[0]?.type || 'audio/webm';
  cleanupVoiceRecorder();
  if (shouldDiscard) return;
  if (!chunks.length) {
    store.showConfigAlert('没有录到可发送的语音。', '录音为空');
    return;
  }

  try {
    const blob = new Blob(chunks, { type: mimeType });
    recordedVoiceDraft.value = {
      audioUrl: await blobToDataUrl(blob),
      duration,
      mimeType: blob.type || mimeType
    };
  } catch (error) {
    store.showConfigAlert(error instanceof Error ? error.message : '语音读取失败。', '无法读取语音');
  }
}

async function startVoiceRecording() {
  if (recordingVoice.value || currentConversationReplying.value) return;
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    showVoicePanel.value = false;
    store.showConfigAlert('当前浏览器不支持录音。', '无法录音');
    return;
  }

  try {
    const replacingRecordedDraft = Boolean(recordedVoiceDraft.value);
    recordedVoiceDraft.value = null;
    if (replacingRecordedDraft) voiceTranscriptDraft.value = '';
    recordingElapsed.value = 0;
    voiceRecognitionStartText = voiceTranscriptDraft.value.trim();
    voiceRecognitionFinalText = '';
    voiceRecognitionNotice.value = '';
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const preferredMimeType = getPreferredAudioMimeType();
    const recorder = preferredMimeType
      ? new MediaRecorder(stream, { mimeType: preferredMimeType })
      : new MediaRecorder(stream);
    voiceStream = stream;
    voiceRecorder = recorder;
    voiceChunks = [];
    discardRecording = false;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) voiceChunks.push(event.data);
    };
    recorder.onstop = () => {
      void finalizeVoiceRecording(recorder);
    };
    recordingStartedAt.value = Date.now();
    recordingVoice.value = true;
    voiceTimer = window.setInterval(() => {
      recordingElapsed.value = (Date.now() - recordingStartedAt.value) / 1000;
    }, 200);
    recorder.start();
    startVoiceTranscription();
  } catch (error) {
    stopVoiceTranscription(true);
    cleanupVoiceRecorder();
    showVoicePanel.value = false;
    store.showConfigAlert(error instanceof Error ? error.message : '请允许浏览器访问麦克风。', '无法录音');
  }
}

function stopVoiceRecording() {
  if (!voiceRecorder || voiceRecorder.state === 'inactive') return;
  stopVoiceTranscription();
  recordingElapsed.value = (Date.now() - recordingStartedAt.value) / 1000;
  voiceRecorder.stop();
}

async function appendVoiceMessage(voice: ChatVoiceAttachment) {
  releaseKeyboardScrollGuard();
  const userMessage = await store.appendUserVoiceMessage(props.id, voice, quoteTarget.value);
  if (!userMessage) return;
  quoteTarget.value = null;
  await scrollMessagesToBottom();
}

async function sendRecordedVoice() {
  const draft = recordedVoiceDraft.value;
  const transcript = voiceTranscriptDraft.value.trim();
  if (!draft?.audioUrl || !transcript || recordingVoice.value || currentConversationReplying.value) return;
  await appendVoiceMessage({
    source: 'recorded',
    transcript,
    duration: draft.duration,
    audioUrl: draft.audioUrl,
    mimeType: draft.mimeType
  });
  showVoicePanel.value = false;
}

async function sendTextVoice() {
  const transcript = voiceTextDraft.value.trim();
  if (!transcript || currentConversationReplying.value) return;
  await appendVoiceMessage({
    source: 'text',
    transcript,
    duration: estimateVoiceDuration(transcript)
  });
  showVoicePanel.value = false;
}

async function regenerateChatImage(messageId: string, description: string, generationPrompt: string) {
  if (regeneratingChatImageMessageIds.value.includes(messageId)) {
    store.showConfigAlert('正在重新生成聊天图片，请等待当前生成完成。', '正在生成');
    return;
  }
  regeneratingChatImageMessageIds.value = [...regeneratingChatImageMessageIds.value, messageId];
  try {
    await store.regenerateChatMessageImage(messageId, description, generationPrompt);
  } finally {
    regeneratingChatImageMessageIds.value = regeneratingChatImageMessageIds.value.filter((id) => id !== messageId);
  }
}

async function applyChatImageCandidate(messageId: string, candidateId: string) {
  await store.applyChatMessageImageCandidate(messageId, candidateId);
}

async function deleteChatImageCandidate(messageId: string, candidateId: string, imageUrl: string) {
  await store.deleteChatMessageImageCandidate(messageId, candidateId, imageUrl);
}

function messageIdsForAction(message: ChatMessage) {
  return message.id.split('__').map((id) => id.trim()).filter(Boolean);
}

function messageActionText(message: ChatMessage) {
  if (message.sticker) return `[Sticker] ${message.sticker.description}`;
  if (message.image) return `[图片] ${message.image.description}`;
  if (message.voice) return `[语音] ${message.voice.transcript}`;
  if (message.location) return `[定位] ${[message.location.name, message.location.address, message.location.distance].filter(Boolean).join(' · ')}`;
  if (message.transfer) return `${message.transfer.responseToMessageId ? '[转账回执]' : '[转账]'} ¥${message.transfer.amount} · ${message.transfer.status === 'pending' ? '待处理' : message.transfer.status === 'accepted' ? '已接收' : '已拒绝'}`;
  if (message.commerce) return `[${message.commerce.kind === 'takeout' ? '外卖' : message.commerce.kind === 'gift' ? '礼物' : '购物'}] ${message.commerce.storeName} · ${message.commerce.items.map((item) => item.name).join('、')} · ¥${message.commerce.totalAmount}`;
  if (message.shopShare) return `[商城${message.shopShare.kind === 'character-pick' ? '共同挑选' : '分享'}] ${message.shopShare.title} · ${message.shopShare.storeName}${message.shopShare.note ? ` · ${message.shopShare.note}` : ''}`;
  if (message.linkPreview) return `[链接] ${message.linkPreview.title} · ${message.linkPreview.description} · ${message.linkPreview.url}`;
  if (message.theaterLink) return `[网站链接] ${message.theaterLink.title} · ${message.theaterLink.summary} · ${message.theaterLink.url}`;
  if (message.call) return `[${message.call.mode === 'video' ? '视频通话' : '语音通话'}] ${message.call.status}`;
  return message.content;
}

function canQuoteMessage(message: ChatMessage) {
  if (message.sender === 'system' || message.id.includes('__')) return false;
  try {
    return Boolean(store.createMessageQuoteSnapshot(message));
  } catch {
    return false;
  }
}

function quoteMessage(message: ChatMessage) {
  if (message.sender === 'system' || message.id.includes('__')) return;
  let quote: ChatMessageQuote | null = null;
  try {
    quote = store.createMessageQuoteSnapshot(message);
  } catch {
    return;
  }
  if (!quote) return;
  quoteTarget.value = quote;
  focusComposerInput();
}

function createLinkMapLabel(address: string, fallback: string) {
  const match = address.match(/([^市区县]+(?:街|路|巷|道)\d*[^\s,，。]*)/);
  return match?.[1] || fallback || '目前位置';
}

function openCardDetail(message: ChatMessage) {
  if (message.shopShare) {
    const share = message.shopShare;
    if (share.orderId) void router.push({ name: 'wallet-shop', query: relationshipCommerceQuery({ order: share.orderId }) });
    else if (share.momentId) void router.push({ name: 'wallet-shop', query: relationshipCommerceQuery({ section: 'moments', moment: share.momentId }) });
    else if (share.storeId) void router.push({ name: 'wallet-shop', query: relationshipCommerceQuery({ store: share.storeId, ...(share.productId ? { product: share.productId } : {}) }) });
    else void router.push({ name: 'wallet-shop', query: relationshipCommerceQuery({ ...(share.productId ? { product: share.productId } : {}) }) });
    return;
  }
  if (message.commerce?.orderId) {
    void router.push({ name: 'wallet-shop', query: relationshipCommerceQuery({ order: message.commerce.orderId }) });
    return;
  }
  if (message.theaterLink?.theaterId) {
    void router.push({ name: 'small-theater-detail', params: { theaterId: message.theaterLink.theaterId } });
  }
}

function editableMessageText(message: ChatMessage) {
  if (message.voice) return message.voice.transcript;
  if (message.location) return message.location.name;
  if (message.transfer) return message.transfer.amount;
  return message.sticker?.description ?? message.image?.description ?? message.content;
}

function isMessageSelected(message: ChatMessage) {
  const ids = messageIdsForAction(message);
  return ids.length > 0 && ids.every((id) => selectedMessageIdSet.value.has(id));
}

function toggleMessageSelection(message: ChatMessage) {
  const ids = messageIdsForAction(message);
  const selectedIds = new Set(selectedMessageIds.value);
  const allSelected = ids.every((id) => selectedIds.has(id));
  for (const id of ids) {
    if (allSelected) selectedIds.delete(id);
    else selectedIds.add(id);
  }
  selectedMessageIds.value = [...selectedIds];
}

function openMessageActions(message: ChatMessage) {
  activeMessage.value = message;
  showMessageMenu.value = true;
}

function cancelSelection() {
  selectionMode.value = false;
  selectedMessageIds.value = [];
}

function clearQuoteIfMessagesRemoved(messageIds: string[]) {
  if (quoteTarget.value && messageIds.includes(quoteTarget.value.messageId)) quoteTarget.value = null;
}

async function copyActiveMessage() {
  const message = activeMessage.value;
  if (!message) return;
  try {
    await navigator.clipboard.writeText(messageActionText(message));
    store.showConfigAlert('已复制消息内容。', '已复制');
  } catch {
    store.showConfigAlert('当前浏览器不允许写入剪贴板。', '复制失败');
  } finally {
    showMessageMenu.value = false;
  }
}

async function deleteActiveMessage() {
  const message = activeMessage.value;
  if (!message) return;
  pendingDeleteIds.value = messageIdsForAction(message);
  pendingDeleteFromSelection.value = false;
  showMessageMenu.value = false;
  showDeleteConfirm.value = true;
}

function startSelectionFromActive() {
  const message = activeMessage.value;
  if (message) selectedMessageIds.value = messageIdsForAction(message);
  selectionMode.value = true;
  showMessageMenu.value = false;
}

async function favoriteActiveMessage() {
  const message = activeMessage.value;
  if (!message || !canFavoriteActiveMessage.value || isActiveMessageFavorited.value) return;
  const favorite = await store.addFavoriteMessage(message);
  if (!favorite) return;
  showMessageMenu.value = false;
  store.showConfigAlert('已加入收藏。', '收藏成功');
}

async function deleteSelectedMessages() {
  const ids = [...selectedMessageIds.value];
  if (!ids.length) return;
  pendingDeleteIds.value = ids;
  pendingDeleteFromSelection.value = true;
  showDeleteConfirm.value = true;
}

function cancelDeleteConfirm() {
  pendingDeleteIds.value = [];
  pendingDeleteFromSelection.value = false;
  showDeleteConfirm.value = false;
}

async function confirmDeleteMessages() {
  const ids = [...pendingDeleteIds.value];
  if (!ids.length) {
    cancelDeleteConfirm();
    return;
  }
  const shouldCloseDeletedActiveCall = Boolean(activeCall.value && ids.includes(activeCall.value.eventMessageId));
  await store.deleteMessages(ids);
  if (shouldCloseDeletedActiveCall) closeActiveCall();
  clearQuoteIfMessagesRemoved(ids);
  if (pendingDeleteFromSelection.value) cancelSelection();
  cancelDeleteConfirm();
}

async function recallActiveMessage() {
  const message = activeMessage.value;
  if (!message || !canRecallActiveMessage.value) return;
  await store.recallMessage(message.id, { actor: 'user' });
  clearQuoteIfMessagesRemoved([message.id]);
  showMessageMenu.value = false;
}

function quoteActiveMessage() {
  const message = activeMessage.value;
  if (!message || !canQuoteActiveMessage.value) return;
  showMessageMenu.value = false;
  quoteMessage(message);
}

async function regenerateActiveVoice() {
  const message = activeMessage.value;
  if (!message || !canRegenerateActiveVoice.value || regeneratingVoiceMessageIds.value.includes(message.id)) return;
  regeneratingVoiceMessageIds.value = [...regeneratingVoiceMessageIds.value, message.id];
  try {
    await store.generateMessageVoiceAudio(message.id, { force: true });
    showMessageMenu.value = false;
    store.showConfigAlert('已按当前 TTS 配置重新生成这条语音。', '语音已更新');
  } catch (error) {
    store.showConfigAlert(error instanceof Error ? error.message : '语音重新生成失败，请检查 TTS 配置。', '生成失败');
  } finally {
    regeneratingVoiceMessageIds.value = regeneratingVoiceMessageIds.value.filter((id) => id !== message.id);
  }
}

function openEditActiveMessage() {
  const message = activeMessage.value;
  if (!message || !canEditActiveMessage.value) return;
  editDraft.value = editableMessageText(message);
  editLocationNameDraft.value = message.location?.name ?? '';
  editLocationAddressDraft.value = message.location?.address ?? '';
  editLocationDistanceDraft.value = message.location?.distance ?? '';
  editTransferAmountDraft.value = message.transfer?.amount ?? '';
  editTransferNoteDraft.value = message.transfer?.note ?? '';
  editTransferStatusDraft.value = message.transfer?.responseToMessageId && message.transfer.status === 'pending'
    ? 'accepted'
    : message.transfer?.status ?? 'pending';
  showMessageMenu.value = false;
  showEditModal.value = true;
}

async function saveEditedMessage() {
  const message = activeMessage.value;
  if (!message || !canSaveEditedMessage.value) return;
  if (message.location) {
    await store.updateMessageLocation(message.id, {
      name: editLocationNameDraft.value,
      address: editLocationAddressDraft.value || undefined,
      distance: editLocationDistanceDraft.value
    });
  } else if (message.transfer) {
    await store.updateMessageTransfer(message.id, {
      amount: normalizedEditTransferAmount.value,
      note: editTransferNoteDraft.value || undefined,
      status: editTransferStatusDraft.value
    });
  } else {
    await store.updateMessageContent(message.id, editDraft.value);
  }
  showEditModal.value = false;
}

function openUserProfile() {
  showActionMenu.value = false;
  showUserProfile.value = true;
}

function openTurnApiTrace(message: ChatMessage) {
  const batchTrace = message.replyBatchId
    ? store.messagesForConversation(props.id).find((entry) => entry.replyBatchId === message.replyBatchId && entry.apiTrace)?.apiTrace
    : undefined;
  selectedTurnTrace.value = message.apiTrace ?? batchTrace ?? null;
  showTurnTrace.value = true;
}

function openCoupleSpace() {
  showActionMenu.value = false;
  void router.push({ name: 'couple-space', params: { id: props.id } });
}

function relationshipCommerceQuery(extra: Record<string, string> = {}) {
  const currentCharacter = character.value;
  const currentConversation = conversation.value;
  if (!currentCharacter || !currentConversation) return extra;
  return { character: currentCharacter.id, conversation: currentConversation.id, ...extra };
}

function openRelationshipCommerce(section: 'economy' | 'cart' | 'wishlist' | 'gift' | 'stores' | 'orders') {
  if (!character.value || !conversation.value) return;
  showActionMenu.value = false;
  void router.push({ name: 'wallet-shop', query: relationshipCommerceQuery({ section }) });
}

async function openCharacterProfile() {
  showActionMenu.value = false;
  showProfile.value = true;
  if (character.value) await store.markCharacterMindStateRead(character.value.id);
}

function openModelSwitch() {
  showActionMenu.value = false;
  showModelSwitch.value = true;
}

function openThoughtChainThemes() {
  showActionMenu.value = false;
  void router.push({ name: 'thought-chain-themes', params: { id: props.id } });
}

function openDeleteFriendConfirm() {
  if (chatActionLocked.value) return;
  showActionMenu.value = false;
  showPurgeFriendConfirm.value = false;
  showDeleteFriendConfirm.value = true;
}

function openPurgeFriendConfirm() {
  if (deletingFriend.value || purgingFriend.value || chatActionLocked.value) return;
  showDeleteFriendConfirm.value = false;
  showPurgeFriendConfirm.value = true;
}

function openBlockFriendConfirm() {
  if (chatActionLocked.value) return;
  showActionMenu.value = false;
  showBlockFriendConfirm.value = true;
}

async function confirmBlockFriend() {
  const currentCharacter = character.value;
  if (!currentCharacter || deletingFriend.value || currentConversationReplying.value) return;
  deletingFriend.value = true;
  try {
    await store.blockCharacter(currentCharacter.id);
    showBlockFriendConfirm.value = false;
    store.showConfigAlert(`${relationshipUserName.value}已将${relationshipCharacterName.value}加入黑名单，聊天记录仍会保留。`, '已拉黑');
  } finally {
    deletingFriend.value = false;
  }
}

async function restoreBlockedFriend() {
  const currentCharacter = character.value;
  if (!currentCharacter) return;
  await store.unblockCharacter(currentCharacter.id);
  store.showConfigAlert(`${relationshipUserName.value}已将${relationshipCharacterName.value}移出黑名单，双方已恢复好友关系。`, '已移出黑名单');
}

async function respondToCharacterRequest(decision: 'accepted' | 'rejected') {
  const currentCharacter = character.value;
  if (!currentCharacter) return;
  await store.respondCharacterFriendRequest(currentCharacter.id, decision);
  store.showConfigAlert(decision === 'accepted'
    ? `${relationshipUserName.value}已通过${relationshipCharacterName.value}的好友申请，双方已恢复好友关系。`
    : `${relationshipUserName.value}已拒绝${relationshipCharacterName.value}的好友申请。`, decision === 'accepted' ? '已通过' : '已拒绝');
}

function openFriendRequest() {
  friendRequestDraft.value = `${relationshipUserName.value}想重新添加${relationshipCharacterName.value}为好友。`;
  showFriendRequest.value = true;
}

async function submitFriendRequest() {
  const currentCharacter = character.value;
  if (!currentCharacter || requestingFriend.value || currentConversationReplying.value) return;
  requestingFriend.value = true;
  try {
    showFriendRequest.value = false;
    await store.requestCharacterFriend(currentCharacter.id, friendRequestDraft.value);
  } finally {
    requestingFriend.value = false;
  }
}

function openClearHistoryConfirm() {
  if (chatActionLocked.value) return;
  showActionMenu.value = false;
  showClearHistoryConfirm.value = true;
}

async function confirmDeleteFriend() {
  const currentCharacter = character.value;
  if (!currentCharacter || deletingFriend.value || chatActionLocked.value) return;
  deletingFriend.value = true;
  try {
    await store.removeCharacterFriend(currentCharacter.id);
    showDeleteFriendConfirm.value = false;
    store.showConfigAlert(`${relationshipUserName.value}已删除${relationshipCharacterName.value}，聊天记录和${relationshipCharacterName.value}的资料已保留。`, '删除完成');
  } finally {
    deletingFriend.value = false;
  }
}

async function confirmPurgeFriend() {
  const currentCharacter = character.value;
  if (!currentCharacter || purgingFriend.value || chatActionLocked.value) return;
  const userName = relationshipUserName.value;
  const characterName = relationshipCharacterName.value;
  purgingFriend.value = true;
  try {
    const purged = await purgeFriendData(currentCharacter.id);
    if (!purged) throw new Error('好友资料不存在或已经被删除。');
    showPurgeFriendConfirm.value = false;
    writeComposerDraft(props.id, '');
    await router.replace({ name: 'home' });
    store.showConfigAlert(`${characterName}及其全部专属数据已彻底删除，无法恢复。`, '彻底删除完成');
  } catch (error) {
    store.showConfigAlert(error instanceof Error ? error.message : `无法彻底删除${characterName}，请稍后再试。`, '彻底删除失败');
  } finally {
    purgingFriend.value = false;
  }
}

async function confirmClearHistory() {
  const currentCharacter = character.value;
  if (!currentCharacter || clearingHistory.value || chatActionLocked.value) return;
  clearingHistory.value = true;
  try {
    const cleared = await store.clearCharacterHistory(currentCharacter.id);
    showClearHistoryConfirm.value = false;
    if (cleared) {
      quoteTarget.value = null;
      cancelSelection();
      store.showConfigAlert('已清空该角色记忆，好友状态已回到初始。', '清空完成');
      await store.updateConversationMode(props.id, 'online');
      await router.replace({ name: 'chat-room', params: { id: props.id } });
      await scrollMessagesToBottom();
    }
  } finally {
    clearingHistory.value = false;
  }
}

function openChatSettings() {
  void router.push({ name: 'chat-settings', params: { id: props.id } });
}

function openSmallTheater() {
  showActionMenu.value = false;
  void router.push({ name: 'small-theater', params: { id: props.id } });
}

function openProfileThemes() {
  showActionMenu.value = false;
  void router.push({ name: 'profile-themes', params: { id: props.id } });
}

function openChatSearch() {
  void router.push({ name: 'chat-search', params: { id: props.id } });
}

function regenerateReply() {
  if (currentConversationReplying.value) {
    store.showConfigAlert('正在生成回复，请等待当前生成完成。', '正在生成');
    return;
  }
  showActionMenu.value = false;
  regeneratePromptDraft.value = '';
  showRegeneratePrompt.value = true;
}

function regenerateReplyInstruction() {
  const instruction = regeneratePromptDraft.value.trim();
  if (!instruction) return undefined;
  return `本次是用户点击“重新回复”要求重新生成上一条线上回复。请优先遵守以下额外引导，同时继续遵守角色设定、聊天规则和边界：${instruction}`;
}

async function confirmRegenerateReply() {
  if (currentConversationReplying.value) return;
  const replyInstruction = regenerateReplyInstruction();
  showRegeneratePrompt.value = false;
  await store.regenerateLatestReply(props.id, { replyInstruction });
}

async function openGobangMessage(message: ChatMessage) {
  const game = message.gobang;
  if (!game) return;
  const invitationStatus = game.invitationStatus ?? 'accepted';
  if (invitationStatus === 'pending') {
    if (game.direction === 'outgoing') await requestGobangInvitationResponse(message);
    return;
  }
  if (invitationStatus !== 'accepted') return;
  await store.recoverInterruptedGobangMessage(message.id);
  await router.push({ name: 'gobang-room', params: { id: props.id, messageId: message.id } });
}

async function requestGobangInvitationResponse(message: ChatMessage) {
  if (!message.gobang || message.gobang.direction !== 'outgoing' || message.gobang.invitationStatus !== 'pending' || chatActionLocked.value) return;
  await store.requestRoleplayReply(props.id, {
    gobangResponseTargetMessageId: message.id,
    replyInstruction: `${callUserAiName.value}刚刚在 LINK 里向${callCharacterAiName.value}发出五子棋邀请。请让${callCharacterAiName.value}继续像平时线上聊天一样自然发送符合此刻人设和关系的消息，同时必须在 messageActions.gobangResponse 写 accepted 或 rejected，真实决定是否接受。不要固定接受，不要随机决定；只有 accepted 才表示开局，开局后由${callUserAiName.value}执黑先行。`
  });
  const resolvedMessage = store.messagesForConversation(props.id).find((item) => item.id === message.id);
  const invitationStatus = resolvedMessage?.gobang?.invitationStatus ?? 'pending';
  if (invitationStatus === 'accepted' && resolvedMessage) await openGobangMessage(resolvedMessage);
  else if (invitationStatus === 'pending') store.showConfigAlert('角色模型没有返回可识别的接受或拒绝决定。点击邀请卡可以重新调用 API。', '邀请未完成');
}

async function startGobangInvitation() {
  if (chatActionLocked.value) return;
  showActionMenu.value = false;
  const existing = [...store.messagesForConversation(props.id)].reverse().find((message) => {
    const game = message.gobang;
    if (!game) return false;
    const invitationStatus = game.invitationStatus ?? 'accepted';
    return invitationStatus === 'pending' || (invitationStatus === 'accepted' && game.status === 'active');
  });
  if (existing?.gobang) {
    if ((existing.gobang.invitationStatus ?? 'accepted') === 'accepted') await openGobangMessage(existing);
    else if (existing.gobang.direction === 'outgoing') await requestGobangInvitationResponse(existing);
    else store.showConfigAlert('当前已有一条来自角色的五子棋邀请，请先接受或拒绝。', '五子棋邀请');
    return;
  }
  const game = createGobangGame({
    gameId: createId('gobang'),
    starter: 'user',
    direction: 'outgoing',
    invitationStatus: 'pending'
  });
  const message = await store.appendUserGobangMessage(props.id, game);
  if (!message) return;
  await scrollMessagesToBottom();
}

async function acceptGobangInvitation(message: ChatMessage) {
  const game = message.gobang;
  if (!game || game.direction !== 'incoming' || game.invitationStatus !== 'pending' || chatActionLocked.value) return;
  const updatedMessage = await store.updateGobangInvitationStatus(message.id, 'accepted');
  if (!updatedMessage?.gobang) return;
  await store.appendConversationEvent(props.id, `${callUserAiName.value}接受了${callCharacterAiName.value}发来的五子棋邀请。`, { mode: 'online' });
  await openGobangMessage(updatedMessage);
}

async function rejectGobangInvitation(message: ChatMessage) {
  const game = message.gobang;
  if (!game || game.direction !== 'incoming' || game.invitationStatus !== 'pending' || chatActionLocked.value) return;
  const updatedMessage = await store.updateGobangInvitationStatus(message.id, 'rejected');
  if (!updatedMessage?.gobang) return;
  await store.appendConversationEvent(props.id, `${callUserAiName.value}拒绝了${callCharacterAiName.value}发来的五子棋邀请。`, { mode: 'online' });
  await scrollMessagesToBottom();
}

async function generateVoomPost() {
  if (generatingVoom.value) {
    store.showConfigAlert('正在生成 VOOM，请等待当前生成完成。', '正在生成');
    return;
  }
  showActionMenu.value = false;
  generatingVoom.value = true;
  try {
    await store.createMomentFromConversation(props.id);
  } catch (error) {
    store.showConfigAlert(error instanceof Error ? error.message : 'VOOM 生成失败。', '无法生成 VOOM');
  } finally {
    generatingVoom.value = false;
  }
}

async function saveUserProfile(user: UserProfile) {
  if (!character.value || !boundUser.value) {
    await store.saveUserProfile(user);
    return;
  }

  const normalizedUser = normalizeUserProfile({
    ...boundUser.value,
    nickname: user.nickname,
    signature: user.signature
  });

  await store.saveUserProfile(normalizedUser);

  await store.saveCharacter({
    ...character.value,
    boundUserProfile: normalizeVisualProfile({
      ...user.profile,
      nickname: normalizedUser.nickname,
      bio: normalizedUser.signature
    }, {
      ...normalizedUser,
      avatar: user.avatar || normalizedUser.avatar
    })
  });
}

async function saveCharacterProfile(nextCharacter: CharacterProfile) {
  await store.saveCharacter(nextCharacter);
}

async function deleteCharacterProfileHistoryEntry(entryId: string) {
  const currentCharacter = character.value;
  if (!currentCharacter) return;
  await store.deleteCharacterProfileHistoryEntry(currentCharacter.id, entryId);
}

async function clearCharacterProfileHistory() {
  const currentCharacter = character.value;
  if (!currentCharacter) return;
  await store.clearCharacterProfileHistory(currentCharacter.id);
}

async function enterOffline() {
  if (chatActionLocked.value) return;
  await store.updateConversationMode(props.id, 'offline');
  await router.replace({ name: 'offline-room', params: { id: props.id } });
}

onBeforeUnmount(() => {
  writeComposerDraft(props.id, composerText.value);
  store.setAppUpdateTransientOperation(`chat-draft:${props.id}`, '存在未发送的私聊草稿', false);
  store.setAppUpdateTransientOperation(`chat-file-picker:${props.id}`, '', false);
  store.setAppUpdateTransientOperation(`chat-image:${props.id}`, '正在处理私聊图片', false);
  store.setAppUpdateTransientOperation(`chat-recording:${props.id}`, '正在录音或保留语音草稿', false);
  void store.flushConversationMemory(props.id);
  clearConversationReadTimer();
  document.removeEventListener('visibilitychange', handleDocumentVisibilityChange);
  store.setActiveConversation(null);
  abortVoiceRecording();
  if (activeCall.value) {
    callMinimized.value = true;
    syncActiveCallMetadata();
  }
  clearCallTimer();
  stopCallBackgroundRotation();
  stopCallAudio();
  stopCallRingtone();
  stopCallAmbient();
  stopLocalCamera();
  stopCallTranscription(true);
  clearCallSpeechFlushTimer();
  clearCallInputBlurTimer();
  clearQueuedBottomRestores();
});
</script>

<style scoped>
.chat-room {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 0;
  background-position: center;
  background-size: cover;
}

.chat-room :deep(.chat-header),
.chat-room :deep(.composer) {
  background: transparent;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.message-list {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px 10px calc(8px + var(--keyboard-inset));
  -webkit-overflow-scrolling: touch;
  overflow-anchor: none;
  scroll-padding-bottom: calc(8px + var(--keyboard-inset));
}

.message-virtualizer {
  position: relative;
  width: 100%;
}

.message-virtual-item {
  position: absolute;
  top: 0;
  left: 0;
  display: flow-root;
  width: 100%;
}

.call-screen {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  height: var(--app-height);
  overflow: hidden;
  background: #111111;
  color: #ffffff;
  font-family: var(--app-current-font-family);
}

.call-screen::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  width: 100vw;
  height: var(--app-height);
  transform: translateZ(0) scale(1.01);
  transform-origin: center;
}

.call-screen-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  width: 100vw;
  height: var(--app-height);
  object-fit: cover;
  object-position: center;
  pointer-events: none;
  transform: translateZ(0) scale(1.01);
  transform-origin: center;
  user-select: none;
}

.call-screen::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  width: 100vw;
  height: var(--app-height);
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.44), rgba(0, 0, 0, 0.28) 42%, rgba(0, 0, 0, 0.58));
}

.call-screen--video {
  background: #111111;
}

.call-visual-layer {
  position: relative;
  z-index: 2;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: calc(16px + var(--safe-top)) 18px calc(18px + var(--safe-bottom));
}

.call-visual-layer::before,
.call-visual-layer::after {
  content: '';
  position: absolute;
  pointer-events: none;
}

.call-visual-layer::before {
  display: none;
}

.call-visual-layer::after {
  inset: 0;
  background: rgba(0, 0, 0, 0.34);
}

.call-topbar,
.call-profile,
.call-video-stage,
.call-self-preview,
.call-subtitles,
.call-input,
.call-controls {
  position: relative;
  z-index: 1;
}

.call-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  color: rgba(255, 255, 255, 0.78);
  font-size: 13px;
}

.call-topbar-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.call-topbar button,
.call-input button,
.call-control-button {
  border: 0;
  color: inherit;
  font: inherit;
}

.call-topbar button {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
}

.call-topbar .call-mind-button {
  display: inline-flex;
  width: auto;
  height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: rgba(255, 255, 255, 0.86);
  white-space: nowrap;
}

.call-profile {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 24px 0 130px;
  text-align: center;
}

.call-profile.active {
  justify-content: flex-start;
  padding-top: 56px;
}

.call-profile h2 {
  max-width: min(78vw, 360px);
  margin: 12px 0 5px;
  overflow: hidden;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-profile p {
  margin: 0;
  color: rgba(255, 255, 255, 0.84);
  font-size: 14px;
}

.call-profile > span {
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.66);
  font-size: 13px;
}

.call-video-stage {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 0;
  overflow: visible;
  border-radius: 0;
  margin: 0 0 96px;
  padding: 42px 0 18px;
  isolation: isolate;
  text-align: center;
}

.call-video-stage.active {
  margin-bottom: 18px;
  padding-top: 54px;
}

.call-video-copy {
  position: static;
  display: grid;
  justify-items: center;
  gap: 5px;
  width: min(100%, 280px);
  min-width: 0;
  padding: 0 8px;
  text-align: center;
}

.call-video-stage.active .call-video-copy {
  position: static;
}

.call-video-copy h2,
.call-video-copy p,
.call-video-copy span {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-video-copy h2 {
  max-width: 100%;
  font-size: 22px;
  font-weight: 850;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.36);
}

.call-video-copy p {
  color: rgba(255, 255, 255, 0.82);
  font-size: 13px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.32);
}

.call-video-copy span {
  color: rgba(255, 255, 255, 0.66);
  font-size: 12px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.call-self-preview {
  position: absolute;
  top: calc(58px + var(--safe-top));
  right: 16px;
  z-index: 2;
  display: grid;
  width: 86px;
  height: 124px;
  place-items: center;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.32);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24);
}

.call-self-preview img,
.call-self-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.call-self-preview.mirror video {
  transform: scaleX(-1);
}

.call-self-preview > span {
  position: absolute;
  left: 6px;
  bottom: 6px;
  max-width: calc(100% - 12px);
  overflow: hidden;
  padding: 3px 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.42);
  color: rgba(255, 255, 255, 0.82);
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-self-preview.off {
  color: rgba(255, 255, 255, 0.74);
}

.call-subtitles {
  display: flex;
  flex: 0 1 auto;
  flex-direction: column;
  gap: 8px;
  max-height: min(34vh, 240px);
  margin-bottom: 12px;
  overflow-y: auto;
  padding: 0 2px;
}

.call-subtitle {
  display: flex;
}

.call-subtitle.user {
  justify-content: flex-end;
}

.call-subtitle.narration {
  justify-content: center;
}

.call-subtitle span {
  max-width: min(78vw, 360px);
  padding: 8px 11px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.17);
  color: #ffffff;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.call-subtitle.user span {
  background: #ffffff;
  color: #202329;
}

.call-subtitle.narration span {
  max-width: min(78vw, 340px);
  background: rgba(255, 255, 255, 0.7);
  color: #47515a;
  font-style: italic;
  text-align: center;
}

.call-subtitle-waiting span {
  display: inline-flex;
  align-items: center;
  min-width: 44px;
  min-height: 34px;
}

.call-typing-dots {
  display: inline-flex;
  gap: 4px;
  padding: 0;
  background: transparent;
}

.call-typing-dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.78);
  animation: typing 0.9s infinite ease-in-out;
}

.call-typing-dots i:nth-child(2) {
  animation-delay: 0.12s;
}

.call-typing-dots i:nth-child(3) {
  animation-delay: 0.24s;
}

.call-input {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  margin-bottom: 14px;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.call-input.active {
  grid-template-columns: minmax(0, 1fr) auto auto;
}

.call-input input {
  position: relative;
  z-index: 1;
  min-width: 0;
  height: 42px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  font: inherit;
  outline: none;
  padding: 0 15px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.call-input input::placeholder {
  color: rgba(255, 255, 255, 0.52);
}

.call-input button {
  position: relative;
  z-index: 1;
  display: grid;
  min-width: 0;
  height: 42px;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: rgba(238, 241, 244, 0.92);
  color: #17191d;
  font: inherit;
  font-size: 12px;
  font-weight: 820;
  letter-spacing: 0;
  box-shadow: none;
}

.call-input button:disabled {
  opacity: 0.48;
}

.call-input-send {
  width: 48px;
}

.call-input-reply {
  width: 48px;
}

.call-controls {
  --call-control-size: clamp(46px, 12vw, 56px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(7px, 2.4vw, 14px);
  width: 100%;
  min-height: 58px;
  overflow: hidden;
}

.call-control-button {
  display: grid;
  flex: 0 0 var(--call-control-size);
  width: var(--call-control-size);
  min-width: 0;
  height: var(--call-control-size);
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
}

.call-control-button[aria-pressed="true"] {
  background: rgba(255, 255, 255, 0.28);
}

.call-control-button:disabled {
  cursor: default;
  opacity: 0.42;
}

.call-control-button span {
  display: none;
}

.call-control-danger {
  background: #ef4444;
}

.call-control-accept {
  background: #22c55e;
}

.call-screen--incoming-ringing .call-controls {
  gap: clamp(42px, 14vw, 52px);
}

.call-screen--incoming-ringing .call-control-button {
  --call-control-size: clamp(58px, 18vw, 64px);
}

.call-floating-window {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 82;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: 166px;
  min-height: 64px;
  overflow: hidden;
  padding: 7px 10px 7px 8px;
  border: 1px solid rgba(255, 255, 255, 0.54);
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(255, 246, 249, 0.78) 46%, rgba(243, 250, 255, 0.84)),
    rgba(255, 255, 255, 0.82);
  color: #2c2630;
  box-shadow: 0 16px 36px rgba(30, 24, 36, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-backdrop-filter: blur(20px) saturate(1.08);
  backdrop-filter: blur(20px) saturate(1.08);
}

.call-floating-window--video {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(247, 245, 255, 0.82) 45%, rgba(241, 252, 255, 0.84)),
    rgba(255, 255, 255, 0.82);
}

.call-floating-window:active {
  cursor: grabbing;
}

.call-floating-window:focus-visible {
  outline: 2px solid rgba(255, 143, 183, 0.72);
  outline-offset: 3px;
}

.call-floating-icon {
  position: relative;
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  margin-left: 4px;
  border: 1px solid rgba(255, 255, 255, 0.68);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.55);
  box-shadow: 0 10px 20px rgba(54, 42, 64, 0.12), inset 0 0 0 4px rgba(255, 255, 255, 0.35);
}

.call-floating-icon img {
  width: 36px;
  height: 36px;
  border: 2px solid rgba(255, 255, 255, 0.92);
  border-radius: 50%;
  object-fit: cover;
}

.call-floating-copy {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.call-floating-copy strong,
.call-floating-copy small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-floating-copy strong {
  color: #2a2430;
  font-size: 12px;
  font-weight: 920;
  line-height: 1.12;
}

.call-floating-copy small {
  color: #756a77;
  font-size: 9.5px;
  font-weight: 720;
  line-height: 1.2;
}

.listen-status-strip {
  display: grid;
  grid-template-columns: 24px minmax(0, auto) minmax(0, 1fr) 22px;
  align-items: center;
  gap: 4px;
  min-height: 34px;
  margin: 0 10px 4px;
  padding: 5px 6px 5px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: #202329;
  box-shadow: 0 8px 22px rgba(17, 20, 24, 0.08);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}

.listen-status-strip img {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

.listen-status-strip span,
.listen-status-strip strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listen-status-track,
.listen-status-close {
  display: grid;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 0;
}

.listen-status-track {
  width: 100%;
  overflow: hidden;
  justify-items: start;
  cursor: pointer;
}

.listen-status-close {
  place-items: center;
  justify-self: end;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: rgba(89, 96, 106, 0.76);
}

.listen-status-close:active {
  background: rgba(226, 59, 88, 0.08);
  color: #e23b58;
}

.listen-status-strip span {
  max-width: 112px;
  color: #e23b58;
  font-size: 11px;
  font-weight: 860;
}

.listen-status-strip strong {
  display: block;
  width: 100%;
  color: #59606a;
  font-size: 11px;
  font-weight: 760;
}

.chat-room :deep(.composer) {
  transform: translate3d(0, calc(0px - var(--keyboard-inset)), 0);
}

.message-list :deep(.message-focus-pulse .bubble) {
  animation: message-focus-pulse 1.2s ease-out;
}

@keyframes message-focus-pulse {
  0%, 100% {
    box-shadow: none;
  }
  35% {
    box-shadow: 0 0 0 4px rgba(104, 113, 122, 0.18);
  }
}

.message-time-divider {
  display: flex;
  justify-content: center;
  margin: 12px 0 8px;
  pointer-events: none;
}

.message-time-divider time {
  max-width: calc(100% - 32px);
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(245, 246, 248, 0.82);
  color: #7b828a;
  font-size: 11px;
  font-weight: 680;
  line-height: 1.2;
  box-shadow: 0 1px 6px rgba(17, 20, 24, 0.06);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

.hidden-file-input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.image-send-panel {
  display: grid;
  gap: 12px;
  width: 100%;
  min-width: 0;
  container-type: inline-size;
}

.listen-invite-send-panel {
  display: grid;
  gap: 12px;
}

.listen-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.listen-panel-head p,
.listen-panel-head h3 {
  margin: 0;
}

.listen-panel-head p {
  color: #e23b58;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.listen-panel-head h3 {
  color: #202329;
  font-size: 18px;
  line-height: 1.2;
}

.listen-compose-preview {
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 74px;
  overflow: hidden;
  border-radius: 12px;
  background:
    radial-gradient(circle at 33px 37px, rgba(226, 59, 88, 0.13), transparent 46px),
    linear-gradient(135deg, #ffffff 0%, #fff8fa 58%, #f7fbf9 100%);
  padding: 12px;
  box-shadow: inset 0 0 0 1px rgba(226, 59, 88, 0.12), 0 10px 24px rgba(226, 59, 88, 0.06);
}

.listen-preview-disc {
  display: grid;
  place-items: center;
  width: 50px;
  height: 50px;
  overflow: hidden;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, #ffffff 0 12px, transparent 13px),
    repeating-radial-gradient(circle, rgba(226, 59, 88, 0.10) 0 1px, rgba(255, 255, 255, 0.82) 2px 6px),
    linear-gradient(135deg, #fff3f6, #edf9f3);
  box-shadow: inset 0 0 0 1px rgba(226, 59, 88, 0.16), 0 10px 20px rgba(226, 59, 88, 0.10);
}

.listen-preview-disc img {
  width: 72%;
  height: 72%;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 3px 10px rgba(17, 20, 24, 0.10);
}

.listen-preview-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.listen-preview-copy small,
.listen-preview-copy span {
  overflow: hidden;
  color: #737983;
  font-size: 11px;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listen-preview-copy strong {
  overflow: hidden;
  color: #202329;
  font-size: 16px;
  font-weight: 930;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listen-field {
  display: grid;
  gap: 7px;
}

.listen-field span {
  color: #69717b;
  font-size: 12px;
  font-weight: 820;
}

.listen-field input {
  width: 100%;
  min-height: 44px;
  border: 0;
  border-radius: 12px;
  background: #f4f5f7;
  color: #202329;
  padding: 0 13px;
  outline: none;
}

.listen-actions-sheet {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.listen-stop-confirm {
  display: grid;
  gap: 10px;
}

.listen-stop-confirm > span {
  color: #e23b58;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.listen-stop-confirm h3,
.listen-stop-confirm p {
  margin: 0;
}

.listen-stop-confirm h3 {
  color: #202329;
  font-size: 18px;
  line-height: 1.2;
}

.listen-stop-confirm p {
  color: #69717b;
  font-size: 12px;
  line-height: 1.55;
}

.listen-stop-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 4px;
}

.image-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.image-panel-head > div {
  min-width: 0;
}

.image-panel-head p {
  margin: 0 0 3px;
  color: #8a6672;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.image-panel-head h3 {
  margin: 0;
  color: #211f24;
  font-size: 16px;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.image-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.74);
}

.image-tabs button {
  min-width: 0;
  min-height: 34px;
  padding: 6px 8px;
  border-radius: 8px;
  color: #59606a;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.image-tabs button.active {
  background: #ffffff;
  color: #171717;
  box-shadow: 0 1px 8px rgba(37, 31, 37, 0.08);
}

.local-image-tab,
.description-image-tab {
  display: grid;
  gap: 10px;
  min-width: 0;
  max-width: 100%;
}

.local-image-button {
  display: grid;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 46px;
  padding: 8px 12px;
  border-radius: 10px;
  background: #eff1f3;
  color: #2d333a;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.local-image-tab p {
  margin: 0;
  color: #737983;
  font-size: 12px;
  line-height: 1.45;
}

.description-preview {
  display: grid;
  place-items: center;
  width: min(100%, 220px);
  min-width: 0;
  margin: 0 auto;
  aspect-ratio: 1 / 1;
  padding: 20px;
  overflow: hidden;
  border: 1px solid #edf0f2;
  border-radius: 18px;
  background: #ffffff;
  color: #222222;
  box-shadow: 0 8px 26px rgba(37, 31, 37, 0.08);
}

.description-preview figcaption {
  max-width: 100%;
  max-height: 100%;
  overflow: auto;
  margin: 0;
  font-size: 13px;
  font-weight: 820;
  line-height: 1.65;
  text-align: center;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  -webkit-overflow-scrolling: touch;
}

.description-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.description-field span {
  color: #686b70;
  font-size: 12px;
  font-weight: 900;
}

.description-field textarea {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 112px;
  max-height: min(34dvh, 180px);
  resize: none;
  overflow: auto;
  border: 1px solid #edf0f2;
  border-radius: 10px;
  padding: 10px;
  background: #ffffff;
  color: #171717;
  font: inherit;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  -webkit-overflow-scrolling: touch;
}

.local-image-hint-field textarea {
  min-height: 78px;
}

.description-send-button {
  min-width: 0;
  min-height: 42px;
  padding: 9px 12px;
  border-radius: 10px;
  background: #eff1f3;
  color: #2d333a;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.voice-send-panel {
  display: grid;
  gap: 12px;
  width: 100%;
  min-width: 0;
  container-type: inline-size;
}

.location-send-panel {
  display: grid;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.transfer-send-panel,
.commerce-send-panel,
.narration-send-panel {
  display: grid;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.transfer-panel-head,
.commerce-panel-head,
.narration-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.transfer-panel-head > div,
.commerce-panel-head > div,
.narration-panel-head > div {
  min-width: 0;
}

.transfer-panel-head p,
.commerce-panel-head p,
.narration-panel-head p {
  margin: 0 0 3px;
  color: #60646b;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.transfer-panel-head h3,
.commerce-panel-head h3,
.narration-panel-head h3 {
  margin: 0;
  color: #211f24;
  font-size: 16px;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.link-location-card {
  display: grid;
  grid-template-rows: 70px auto 23px;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 10px;
  background: #ffffff;
  color: #111111;
}

.link-location-map {
  position: relative;
  min-width: 0;
  min-height: 70px;
  overflow: hidden;
  background:
    linear-gradient(112deg, transparent 0 54%, rgba(216, 219, 222, 0.7) 55% 100%),
    linear-gradient(22deg, rgba(205, 231, 215, 0.72) 0 26%, transparent 27% 100%),
    linear-gradient(164deg, rgba(255, 255, 255, 0.94) 0 7%, transparent 8% 100%),
    #f0f1f3;
}

.link-location-map::after {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(180deg, transparent 54%, rgba(255, 255, 255, 0.1));
  content: '';
  pointer-events: none;
}

.link-map-road {
  position: absolute;
  display: block;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 0 0 1px rgba(222, 225, 229, 0.86);
}

.link-map-road-1 {
  left: -15px;
  top: 15px;
  width: 119px;
  height: 7px;
  transform: rotate(-27deg);
}

.link-map-road-2 {
  right: -12px;
  top: 20px;
  width: 103px;
  height: 7px;
  transform: rotate(12deg);
}

.link-map-road-3 {
  left: 40px;
  top: 39px;
  width: 106px;
  height: 7px;
  transform: rotate(-38deg);
}

.link-map-road-4 {
  left: 97px;
  top: 29px;
  width: 90px;
  height: 7px;
  transform: rotate(82deg);
}

.link-map-block {
  position: absolute;
  display: block;
  border: 1px solid rgba(222, 225, 229, 0.9);
  border-radius: 3px;
  background: rgba(246, 247, 248, 0.88);
}

.link-map-block-1 {
  left: 10px;
  top: 4px;
  width: 42px;
  height: 23px;
  transform: rotate(14deg);
}

.link-map-block-2 {
  right: 13px;
  top: 3px;
  width: 51px;
  height: 25px;
  transform: rotate(-6deg);
}

.link-map-block-3 {
  right: 5px;
  bottom: 6px;
  width: 51px;
  height: 24px;
  transform: rotate(-18deg);
}

.link-map-label {
  position: absolute;
  z-index: 2;
  max-width: 75px;
  overflow: hidden;
  color: rgba(70, 74, 82, 0.76);
  font-size: 8px;
  font-weight: 580;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.88);
}

.link-map-label-top {
  right: 21px;
  top: 8px;
}

.link-map-label-mid {
  left: 50%;
  top: 49px;
  max-width: 130px;
  padding: 1px 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
  transform: translateX(-50%);
}

.link-map-pin {
  position: absolute;
  z-index: 3;
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 50% 50% 50% 0;
  background: #ef4c43;
  transform: rotate(-45deg);
  box-shadow: 0 1px 4px rgba(17, 17, 17, 0.2);
}

.link-map-pin::after {
  position: absolute;
  left: 5px;
  top: 5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ffffff;
  content: '';
}

.link-map-pin-main {
  left: 50%;
  top: 35px;
  transform: translate(-50%, -50%) rotate(-45deg);
}

.link-map-pin-secondary {
  right: 15px;
  bottom: 10px;
  width: 14px;
  height: 14px;
  background: #5f7180;
}

.link-map-pin-secondary::after {
  left: 4px;
  top: 4px;
  width: 6px;
  height: 6px;
}

.link-map-google {
  position: absolute;
  left: 7px;
  bottom: 5px;
  z-index: 4;
  display: inline-flex;
  align-items: baseline;
  font-family: Arial, sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: -1px;
  line-height: 1;
}

.link-map-google span:nth-child(1),
.link-map-google span:nth-child(4) {
  color: #4285f4;
}

.link-map-google span:nth-child(2),
.link-map-google span:nth-child(6) {
  color: #db4437;
}

.link-map-google span:nth-child(3) {
  color: #f4b400;
}

.link-map-google span:nth-child(5) {
  color: #0f9d58;
}

.link-location-body {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 5px 7px 6px;
  border-bottom: 1px solid #eeeeee;
  background: #ffffff;
}

.link-location-kicker {
  color: #04a64b;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1.05;
  text-transform: uppercase;
}

.link-location-body strong {
  display: -webkit-box;
  min-width: 0;
  color: #101010;
  font-size: 10px;
  font-weight: 930;
  line-height: 1.2;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.link-location-detail-address {
  display: -webkit-box;
  min-width: 0;
  color: #6b7078;
  font-size: 8px;
  font-weight: 560;
  line-height: 1.35;
  overflow: hidden;
  overflow-wrap: anywhere;
  word-break: break-word;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.link-location-footer {
  display: grid;
  grid-template-columns: 13px minmax(0, 1fr) 5px;
  align-items: center;
  gap: 4px;
  min-width: 0;
  min-height: 22px;
  padding: 0 6px;
  background: #ffffff;
  color: #5f6670;
  font-size: 8px;
  font-weight: 820;
}

.link-location-footer > span:nth-child(2) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link-location-footer-mark {
  position: relative;
  display: block;
  width: 11px;
  height: 11px;
  border-radius: 50% 50% 50% 0;
  background: #04c755;
  transform: rotate(-45deg);
}

.link-location-footer-mark::after {
  position: absolute;
  left: 3px;
  top: 3px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #ffffff;
  content: '';
}

.link-location-chevron {
  width: 5px;
  height: 5px;
  border-top: 2px solid #c6c6c6;
  border-right: 2px solid #c6c6c6;
  transform: rotate(45deg);
}

.transfer-compose-preview {
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(12, 20, 28, 0.08);
  border-radius: 14px;
  background: #ffffff;
  color: #111111;
  box-shadow: 0 14px 34px rgba(26, 32, 38, 0.1);
}

.transfer-compose-preview {
  display: grid;
  justify-self: center;
  width: min(286px, 100%);
}

.transfer-compose-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 14px 14px 10px;
  background: #ffffff;
}

.transfer-compose-brand {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: #252a31;
  font-size: 12px;
  font-weight: 920;
  line-height: 1;
}

.transfer-compose-brand > span:first-child {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: #04c755;
  color: #ffffff;
  font-size: 13px;
  font-weight: 950;
}

.transfer-compose-head > span:last-child {
  flex: 0 0 auto;
  padding: 5px 10px;
  border-radius: 999px;
  background: #effaf3;
  color: #05883f;
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
}

.transfer-compose-main {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 0 14px 16px;
  background:
    linear-gradient(135deg, rgba(4, 199, 85, 0.16), rgba(4, 199, 85, 0.04) 72%),
    #f8fffa;
}

.transfer-compose-main small {
  color: #168447;
  font-size: 11px;
  font-weight: 920;
  line-height: 1;
}

.transfer-compose-main strong {
  min-width: 0;
  color: #101713;
  font-size: 40px;
  font-weight: 950;
  letter-spacing: 0;
  line-height: 1;
  overflow-wrap: anywhere;
}

.transfer-compose-main span {
  min-width: 0;
  color: #2f373f;
  font-size: 17px;
  font-weight: 930;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.transfer-compose-note {
  min-width: 0;
  padding: 12px 14px;
  border-top: 1px solid rgba(17, 17, 17, 0.06);
  color: #737983;
  font-size: 12px;
  font-weight: 720;
  line-height: 1.35;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.commerce-compose-preview {
  display: grid;
  justify-self: center;
  width: min(286px, 100%);
  overflow: hidden;
  border: 1px solid rgba(12, 20, 28, 0.08);
  border-radius: 14px;
  background: #ffffff;
  color: #111111;
  box-shadow: 0 14px 34px rgba(26, 32, 38, 0.1);
}

.commerce-compose-head,
.commerce-compose-payment {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 12px 14px;
}

.commerce-compose-head > span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: #303238;
  font-size: 11px;
  font-weight: 920;
}

.commerce-compose-head i {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: #f2e9e2;
  font-size: 13px;
  font-style: normal;
}

.commerce-compose-head em {
  flex: 0 0 auto;
  padding: 5px 9px;
  border-radius: 999px;
  background: #f3f5f6;
  color: #737983;
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
}

.commerce-compose-main {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 13px 14px 15px;
  background: linear-gradient(135deg, rgba(228, 205, 190, 0.58), rgba(249, 244, 239, 0.94));
}

.commerce-compose-preview--gift .commerce-compose-main {
  background: linear-gradient(135deg, rgba(232, 208, 218, 0.62), rgba(249, 242, 245, 0.94));
}

.commerce-compose-main small {
  color: #8c6860;
  font-size: 10px;
  font-weight: 900;
}

.commerce-compose-main strong {
  color: #342c2a;
  font-size: 17px;
  overflow-wrap: anywhere;
}

.commerce-compose-main em {
  color: #756b69;
  font-size: 11px;
  font-style: normal;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.commerce-compose-payment {
  border-top: 1px solid rgba(17, 17, 17, 0.06);
  color: #737983;
  font-size: 10px;
}

.commerce-compose-payment span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commerce-compose-payment strong {
  flex: 0 0 auto;
  color: #282226;
  font-size: 15px;
}

.transfer-field,
.commerce-field,
.narration-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.transfer-field span,
.commerce-field span,
.narration-field span {
  color: #686b70;
  font-size: 12px;
  font-weight: 900;
}

.transfer-field input,
.transfer-field select,
.commerce-field input,
.commerce-field textarea,
.narration-field textarea {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  border: 1px solid #edf0f2;
  border-radius: 10px;
  padding: 0 10px;
  background: #ffffff;
  color: #171717;
  font: inherit;
}

.commerce-field textarea {
  min-height: 64px;
  padding: 9px 10px;
  line-height: 1.45;
  resize: vertical;
}

.narration-field textarea {
  min-height: 118px;
  padding: 10px;
  resize: vertical;
  line-height: 1.45;
}

.transfer-actions-sheet,
.commerce-actions,
.narration-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.transfer-actions-sheet button,
.commerce-actions button,
.narration-actions button {
  min-height: 40px;
}

.transfer-actions-sheet .primary-action,
.commerce-actions .primary-action,
.narration-actions .primary-action {
  background: #d8dce0;
  color: #202329;
}

.transfer-actions-sheet .primary-action:disabled,
.commerce-actions .primary-action:disabled,
.narration-actions .primary-action:disabled {
  background: #eceef1;
  color: #9ba1a8;
}

.location-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.location-panel-head > div {
  min-width: 0;
}

.location-panel-head p {
  margin: 0 0 3px;
  color: #60646b;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.location-panel-head h3 {
  margin: 0;
  color: #211f24;
  font-size: 16px;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.location-preview-card {
  justify-self: center;
  width: min(188px, 100%);
}

.location-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.location-field span {
  color: #686b70;
  font-size: 12px;
  font-weight: 900;
}

.location-field input,
.location-field select {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  border: 1px solid #edf0f2;
  border-radius: 10px;
  padding: 0 10px;
  background: #ffffff;
  color: #171717;
  font: inherit;
}

.location-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.location-actions button {
  min-height: 40px;
}

.location-actions .primary-action {
  background: #d8dce0;
  color: #202329;
}

.location-actions .primary-action:disabled {
  background: #eceef1;
  color: #9ba1a8;
}

.voice-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.voice-panel-head > div {
  min-width: 0;
}

.voice-panel-head p {
  margin: 0 0 3px;
  color: #3c6f63;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.voice-panel-head h3 {
  margin: 0;
  color: #211f24;
  font-size: 16px;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.voice-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.74);
}

.voice-tabs button {
  min-width: 0;
  min-height: 34px;
  padding: 6px 8px;
  border-radius: 8px;
  color: #59606a;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.voice-tabs button.active {
  background: #ffffff;
  color: #171717;
  box-shadow: 0 1px 8px rgba(37, 31, 37, 0.08);
}

.voice-tabs button:disabled {
  opacity: 0.52;
  cursor: default;
}

.voice-record-tab,
.voice-text-tab {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.voice-recorder-card,
.voice-text-preview {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 54px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f4f6f5;
  color: #27342f;
}

.voice-recorder-card.recording {
  background: #e9f8ef;
  color: #0a6231;
}

.voice-recorder-card.ready {
  background: #eef6f1;
}

.voice-recorder-card strong,
.voice-text-preview strong {
  min-width: 0;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.voice-recorder-card > span {
  font-size: 12px;
  font-weight: 850;
  opacity: 0.68;
}

.voice-preview-wave {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 3px;
  min-height: 18px;
}

.voice-preview-wave span {
  width: 3px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.62;
}

.voice-preview-wave span:nth-child(1) { height: 8px; }
.voice-preview-wave span:nth-child(2) { height: 14px; }
.voice-preview-wave span:nth-child(3) { height: 18px; }
.voice-preview-wave span:nth-child(4) { height: 12px; }
.voice-preview-wave span:nth-child(5) { height: 16px; }

.voice-text-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.voice-text-field span {
  color: #686b70;
  font-size: 12px;
  font-weight: 900;
}

.voice-text-field textarea {
  display: block;
  width: 100%;
  min-width: 0;
  min-height: 98px;
  max-height: min(34dvh, 170px);
  resize: none;
  overflow: auto;
  border: 1px solid #edf0f2;
  border-radius: 10px;
  padding: 10px;
  background: #ffffff;
  color: #171717;
  font: inherit;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  -webkit-overflow-scrolling: touch;
}

.voice-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}

.voice-secondary,
.voice-primary {
  min-width: 0;
  min-height: 42px;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.voice-secondary {
  background: #eef1f2;
  color: #20272d;
}

.voice-secondary--stop {
  background: #1f2f28;
  color: #ffffff;
}

.voice-primary {
  background: #eff1f3;
  color: #2d333a;
}

.voice-secondary:disabled,
.voice-primary:disabled {
  opacity: 0.45;
  cursor: default;
}

@container (max-width: 320px) {
  .image-send-panel {
    gap: 10px;
  }

  .description-preview {
    width: min(100%, 190px);
    padding: 16px;
    border-radius: 16px;
  }

  .description-preview figcaption {
    font-size: 12px;
    line-height: 1.55;
  }

  .description-field textarea {
    min-height: 96px;
  }
}

@media (max-width: 360px) {
  .image-send-panel {
    gap: 10px;
  }

  .description-preview {
    width: min(100%, 190px);
    padding: 16px;
    border-radius: 16px;
  }

  .description-preview figcaption {
    font-size: 12px;
    line-height: 1.55;
  }

  .description-field textarea {
    min-height: 96px;
  }
}

@media (max-height: 700px) {
  .image-send-panel {
    gap: 10px;
  }

  .description-preview {
    width: min(100%, 180px);
    padding: 16px;
  }

  .description-field textarea {
    min-height: 92px;
    max-height: 28dvh;
  }
}

.local-image-button:disabled,
.description-send-button:disabled {
  opacity: 0.45;
  cursor: default;
}

.typing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin: 7px 0 7px 38px;
  padding: 8px 11px;
  border-radius: 15px;
  background: #ffffff;
}

.typing-indicator span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #9da1a6;
  animation: typing 0.9s infinite ease-in-out;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.12s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.24s;
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
  will-change: transform;
}

.selection-toolbar strong {
  overflow: hidden;
  color: #2b3036;
  font-size: 13px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selection-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  font-weight: 800;
}

.selection-toolbar .secondary-action {
  background: transparent;
}

.selection-toolbar button:disabled {
  opacity: 0.45;
}

.relationship-state-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 12px calc(10px + var(--safe-bottom));
  padding: 13px 14px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 8px 24px rgba(35, 45, 40, 0.08);
}

.relationship-state-card div {
  display: grid;
  flex: 1;
  gap: 3px;
  min-width: 0;
}

.relationship-state-card strong {
  font-size: 13px;
}

.relationship-state-card span {
  color: rgba(17, 17, 17, 0.58);
  font-size: 11px;
  line-height: 1.45;
}

.relationship-state-card button {
  flex: 0 0 auto;
  min-height: 34px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: #111;
  color: #fff;
  font: inherit;
}

.relationship-state-card button:disabled {
  background: rgba(17, 17, 17, 0.1);
  color: rgba(17, 17, 17, 0.42);
}

.relationship-request-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 6px;
}

.relationship-state-card .relationship-request-actions .secondary {
  background: rgba(17, 17, 17, 0.08);
  color: #111;
}

.friend-request-sheet {
  display: grid;
  gap: 12px;
}

.friend-request-sheet h3,
.friend-request-sheet p {
  margin: 0;
}

.friend-request-sheet p {
  color: rgba(17, 17, 17, 0.58);
  line-height: 1.6;
}

.friend-request-sheet textarea {
  width: 100%;
  resize: none;
  border: 1px solid rgba(17, 17, 17, 0.12);
  border-radius: 13px;
  padding: 12px;
  background: rgba(248, 249, 248, 0.92);
  color: inherit;
  font: inherit;
  line-height: 1.55;
}

.action-menu {
  display: grid;
  gap: 9px;
  min-width: 0;
}

.action-menu-group-title small {
  color: #9b7f88;
  font-size: 8px;
  line-height: 1;
  font-weight: 900;
  letter-spacing: 0.13em;
}

.action-menu-group {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.action-menu-group-title {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 10px;
}

.action-menu-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.message-action-menu {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.message-action-menu button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 68px;
  padding: 8px 4px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: #202329;
  font-size: 12px;
  font-weight: 800;
}

.message-action-menu button:active {
  background: rgba(6, 199, 85, 0.12);
}

.message-action-menu button:disabled {
  opacity: 0.38;
}

.edit-message-sheet {
  display: grid;
  gap: 10px;
}

.edit-message-sheet textarea {
  width: 100%;
  min-height: 112px;
  resize: vertical;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 10px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.86);
  color: #202329;
  font: inherit;
  line-height: 1.5;
}

.edit-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.edit-actions button {
  min-height: 38px;
}

.edit-actions .primary-action {
  background: #d7dbe0;
  color: #22262c;
}

.edit-actions .primary-action:disabled {
  background: #e6e8eb;
  color: #9a9fa6;
}

.delete-confirm-sheet {
  display: grid;
  gap: 10px;
  color: #202329;
}

.delete-confirm-sheet h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
}

.delete-confirm-sheet p {
  margin: 0;
  color: #646a72;
  font-size: 13px;
  line-height: 1.45;
}

.delete-confirm-sheet p strong {
  color: #b42332;
}

.friend-delete-options {
  display: grid;
  gap: 8px;
}

.friend-delete-option {
  display: grid;
  gap: 4px;
  min-height: 0;
  padding: 11px 12px;
  border: 1px solid rgba(60, 66, 75, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  color: #252930;
  text-align: left;
}

.friend-delete-option strong {
  font-size: 13px;
  font-weight: 900;
}

.friend-delete-option span {
  color: #69707a;
  font-size: 11px;
  line-height: 1.5;
}

.friend-delete-option--purge {
  border-color: rgba(188, 53, 69, 0.22);
  background: rgba(255, 241, 243, 0.82);
}

.friend-delete-option--purge strong {
  color: #b42332;
}

.friend-delete-cancel {
  width: 100%;
  min-height: 38px;
}

.delete-confirm-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.delete-confirm-actions button {
  min-height: 38px;
}

.regenerate-prompt-sheet {
  display: grid;
  gap: 10px;
  color: #202329;
}

.regenerate-prompt-sheet > span {
  color: #6a7079;
  font-size: 11px;
  font-weight: 900;
}

.regenerate-prompt-sheet h3,
.regenerate-prompt-sheet p {
  margin: 0;
}

.regenerate-prompt-sheet h3 {
  font-size: 16px;
  font-weight: 900;
}

.regenerate-prompt-sheet p {
  color: #646a72;
  font-size: 13px;
  line-height: 1.45;
}

.regenerate-prompt-sheet label {
  display: grid;
  gap: 7px;
}

.regenerate-prompt-sheet label span {
  color: #4f565f;
  font-size: 12px;
  font-weight: 850;
}

.regenerate-prompt-sheet textarea {
  width: 100%;
  min-height: 118px;
  resize: vertical;
  padding: 10px;
  border: 1px solid rgba(20, 20, 20, 0.08);
  border-radius: 10px;
  outline: 0;
  background: rgba(255, 255, 255, 0.86);
  color: #202329;
  font: inherit;
  line-height: 1.5;
}

.regenerate-prompt-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.regenerate-prompt-actions button {
  min-height: 38px;
}

.action-menu button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: #202329;
  font-size: 13px;
  font-weight: 800;
  text-align: center;
  line-height: 1.2;
}

.action-menu button span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.action-menu button:active {
  background: rgba(6, 199, 85, 0.12);
}

.action-menu button:disabled,
.action-menu button.busy {
  opacity: 0.5;
}

.action-menu button.busy {
  cursor: progress;
}

.action-menu .danger-menu-action {
  color: #e5484d;
}

@keyframes typing {
  0%, 100% { transform: translateY(0); opacity: 0.45; }
  50% { transform: translateY(-3px); opacity: 1; }
}
</style>