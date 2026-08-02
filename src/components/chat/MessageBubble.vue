<template>
  <article :data-message-id="message.id" :class="['message-row', messageVisualSender, { selecting: selectionMode, selected, 'hide-avatar': hideAvatar, 'profile-alert': showProfileAlert }]">
    <button v-if="selectionMode" class="selection-dot" type="button" :aria-pressed="selected" @click.stop="emit('toggle-select')">
      <span></span>
    </button>
    <button
      v-if="showAvatarButton"
      class="avatar-button"
      type="button"
      :aria-hidden="hideAvatar"
      :aria-label="avatarActionLabel"
      :tabindex="hideAvatar ? -1 : 0"
      @click.stop="handleAvatarClick"
      @dblclick.prevent.stop
      @contextmenu.prevent.stop="emitAvatarLongPress"
      @pointercancel="cancelAvatarLongPress"
      @pointerdown.stop="startAvatarLongPress"
      @pointerleave="cancelAvatarLongPress"
      @pointermove.stop="trackAvatarLongPress"
      @pointerup.stop="cancelAvatarLongPress"
    >
      <img class="avatar mini" :src="avatarSource" :alt="avatarAlt" />
      <span v-if="showProfileAlert" class="mind-state-hearts" aria-hidden="true"><Heart /><Heart /><Heart /></span>
    </button>
    <div class="bubble-wrap" :class="{ 'shop-share-wrap': message.shopShare, 'mcp-result-wrap': message.mcpResult }">
      <span v-if="canQuote" class="swipe-quote-cue" :class="{ visible: swipeOffset > 0, ready: swipeQuoteReady }" aria-hidden="true">
        <Quote :size="16" />
      </span>
      <div
        class="bubble-stack"
        :class="{ swiping: swipeOffset > 0, 'quote-ready': swipeQuoteReady }"
        :style="swipeStyle"
        @click.capture="suppressClickAfterSwipe"
        @click="handleBubbleClick"
        @contextmenu.prevent.stop="emitLongPress"
        @copy.prevent.stop="suppressNativeSelection"
        @dragstart.prevent.stop="suppressNativeSelection"
        @pointercancel="handlePointerCancel"
        @pointerdown="handlePointerDown"
        @pointerleave="handlePointerLeave"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @selectstart.prevent.stop="suppressNativeSelection"
      >
        <span v-if="authorLabel" class="message-author-label">{{ authorLabel }}</span>
        <div class="bubble" :class="{ narration: message.displayStyle === 'narration', sticker: message.sticker, image: message.image, voice: message.voice, location: message.location, mcpOperation: message.mcpOperations?.length, mcpResult: message.mcpResult, transfer: message.transfer, commerce: message.commerce, shopShare: message.shopShare, musicListenInvite: message.musicListenInvite, linkPreview: message.linkPreview, theaterLink: message.theaterLink, offlineInvitation: message.offlineInvitation, call: message.call, gobang: message.gobang }" :style="bubbleStyle">
          <template v-if="message.call">
            <section class="call-message-card" :class="[`call-message-card--${message.call.status}`, `call-message-card--${message.call.mode}`, `call-message-card--${message.call.direction}`]" aria-label="通话消息">
              <div class="call-message-head">
                <span class="call-message-media" aria-hidden="true">
                  <img :src="callCardAvatar" :alt="callCardKicker" draggable="false" />
                </span>
                <span class="call-message-identity">
                  <small>{{ callCardKicker }}</small>
                  <strong>{{ callCardTitle }}</strong>
                </span>
              </div>
              <div class="call-message-meta">
                <em>{{ callCardModePill }}</em>
                <span>{{ callCardDetail }}</span>
              </div>
              <div v-if="canRespondCallCard" class="call-message-actions" @pointerdown.stop @pointerup.stop>
                <button class="call-message-action call-message-action--reject" type="button" @click.stop="emit('reject-call')">拒绝</button>
                <button class="call-message-action call-message-action--accept" type="button" @click.stop="emit('accept-call')">接听</button>
              </div>
            </section>
          </template>
          <template v-else-if="message.sticker">
            <img class="sticker-image" :src="getStickerDisplayImageUrl(message.sticker)" :alt="message.sticker.description" draggable="false" />
          </template>
          <template v-else-if="message.image">
            <figure class="chat-image-card" :class="[`chat-image-card--${message.image.kind}`, { interactive: message.sender === 'char' }]" :style="imageCardStyle" @click="handleImageCardClick">
              <img v-if="message.image.url && !isBrokenImageSource(message.image.url)" :src="message.image.url" :alt="message.image.description" draggable="false" @error="markBrokenImageSource(message.image.url)" />
              <figcaption v-if="message.image.kind === 'description' || isBrokenImageSource(message.image.url)">{{ message.image.description }}</figcaption>
            </figure>
          </template>
          <template v-else-if="message.voice">
            <div class="voice-message" :class="{ playing: playingVoice, loading: voiceLoading }" :style="voiceMessageStyle" role="button" tabindex="0" :aria-label="voiceButtonLabel" :aria-expanded="showVoiceTranscript" @click.stop="toggleVoiceTranscript" @keydown.enter.prevent="toggleVoiceTranscript" @keydown.space.prevent="toggleVoiceTranscript">
              <span class="voice-wave" aria-hidden="true">
                <span v-for="bar in voiceWaveBars" :key="bar" :style="{ '--voice-bar-index': bar }"></span>
              </span>
              <span class="voice-duration">{{ voiceDurationLabel }}</span>
              <button class="voice-play-button" type="button" :aria-label="voicePlaybackLabel" :disabled="voicePlayDisabled" @click.stop="handleVoicePlayback">
                <LoaderCircle v-if="voiceLoading" class="voice-loading-icon" :size="14" />
                <Pause v-else-if="playingVoice" :size="13" fill="currentColor" />
                <Play v-else :size="13" fill="currentColor" />
              </button>
            </div>
          </template>
          <template v-else-if="message.gobang">
            <section
              class="gobang-message-card"
              :class="[
                `gobang-message-card--${message.gobang.status}`,
                {
                  'gobang-message-card--api-failed': gobangApiFailed
                }
              ]"
              aria-label="五子棋对局"
            >
              <span class="gobang-message-head">
                <span>
                  <small>LINK PLAY</small>
                  <strong>五子棋</strong>
                </span>
                <em>{{ gobangCardChip }}</em>
              </span>
              <span class="gobang-message-board" aria-hidden="true">
                <i v-for="point in gobangPreviewCells" :key="point.key" class="gobang-message-point">
                  <span v-if="point.stone" :class="[`gobang-message-stone--${point.stone}`, { latest: point.latest }]"></span>
                </i>
              </span>
              <div v-if="canRespondGobangCard" class="call-message-actions gobang-message-actions" @pointerdown.stop @pointerup.stop>
                <button class="call-message-action call-message-action--reject" type="button" @click.stop="emit('reject-gobang')">拒绝</button>
                <button class="call-message-action call-message-action--accept" type="button" @click.stop="emit('accept-gobang')">接受</button>
              </div>
              <span class="gobang-message-footer">
                <span><strong>{{ gobangCardTitle }}</strong><small>{{ gobangCardDetail }}</small></span>
                <ChevronRight :size="15" />
              </span>
            </section>
          </template>
          <template v-else-if="message.location">
            <section class="line-location-card" aria-label="定位消息">
              <span class="line-location-map" aria-hidden="true">
                <span class="line-map-road line-map-road-1"></span>
                <span class="line-map-road line-map-road-2"></span>
                <span class="line-map-road line-map-road-3"></span>
                <span class="line-map-road line-map-road-4"></span>
                <span class="line-map-block line-map-block-1"></span>
                <span class="line-map-block line-map-block-2"></span>
                <span class="line-map-block line-map-block-3"></span>
                <span class="line-map-label line-map-label-top">{{ lineLocationMapLabel }}</span>
                <span class="line-map-label line-map-label-mid">{{ message.location.name }}</span>
                <span class="line-map-pin line-map-pin-main"></span>
                <span class="line-map-pin line-map-pin-secondary"></span>
                <span class="line-map-google"><span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span></span>
              </span>
              <span class="line-location-body">
                <span class="line-location-kicker">Location</span>
                <strong>{{ lineLocationName }}</strong>
                <span v-if="lineLocationAddress" class="line-location-detail-address">{{ lineLocationAddress }}</span>
              </span>
              <span class="line-location-footer">
                <span class="line-location-footer-mark" aria-hidden="true"></span>
                <span>{{ lineLocationDistanceLabel }}</span>
                <span class="line-location-chevron" aria-hidden="true"></span>
              </span>
            </section>
          </template>
          <template v-else-if="message.transfer">
            <section class="transfer-request-card" :class="[`transfer-request-card--${linePayStatus}`, { 'transfer-request-card--actionable': canRespondTransferCard, 'transfer-request-card--receipt': linePayIsReceipt }]" :aria-label="linePayIsReceipt ? '转账回执' : '转账消息'">
              <span class="transfer-request-head">
                <span class="transfer-request-brand">
                  <span class="transfer-request-mark" aria-hidden="true">¥</span>
                  <span>LINK Pay</span>
                </span>
                <span class="transfer-request-chip">{{ linePayCardChip }}</span>
              </span>
              <span class="transfer-request-main">
                <small>{{ linePayDirectionLabel }}</small>
                <strong>¥{{ linePayAmount }}</strong>
                <span>{{ linePayCardSubtext }}</span>
              </span>
              <span class="transfer-request-note">{{ linePayRequestNoteText }}</span>
              <span v-if="canRespondTransferCard" class="transfer-request-actions" @pointerdown.stop @pointerup.stop>
                <button class="transfer-request-action transfer-request-action--reject" type="button" @click.stop="emit('reject-transfer')">拒绝</button>
                <button class="transfer-request-action transfer-request-action--accept" type="button" @click.stop="emit('accept-transfer')">接收</button>
              </span>
            </section>
          </template>
          <template v-else-if="message.commerce">
            <section class="commerce-order-card" :class="`commerce-order-card--${message.commerce.kind}`" aria-label="订单消息">
              <span class="commerce-order-head">
                <span class="commerce-order-brand"><i>{{ commerceOrderMark }}</i><span>LINK {{ commerceKindEnglish }}</span></span>
                <span class="commerce-order-chip">{{ commerceStatusLabel }}</span>
              </span>
              <span class="commerce-order-main">
                <span class="commerce-order-visual">{{ commerceOrderMark }}</span>
                <span class="commerce-order-copy">
                  <small>{{ commerceKindLabel }}</small>
                  <strong>{{ message.commerce.storeName }}</strong>
                  <em>{{ commerceItemsText }}</em>
                </span>
              </span>
              <span class="commerce-order-payment">
                <span><small>{{ commercePayerName }} 已付款</small><strong>¥{{ message.commerce.totalAmount }}</strong></span>
                <span>{{ message.commerce.eta || '订单已提交' }} <ChevronRight :size="13" /></span>
              </span>
              <span v-if="commerceCardMessage" class="commerce-order-note">“{{ commerceCardMessage }}”</span>
            </section>
          </template>
          <template v-else-if="message.shopShare">
            <section class="shop-share-card" :class="`shop-share-card--${message.shopShare.kind}`" aria-label="商城分享消息">
              <span class="shop-share-head"><span><i>{{ message.shopShare.mark }}</i> LINK SHOP</span><em>{{ shopShareChip }}</em></span>
              <span class="shop-share-main">
                <img v-if="message.shopShare.imageUrl" :src="message.shopShare.imageUrl" :alt="message.shopShare.title" />
                <i v-else>{{ message.shopShare.mark }}</i>
                <span><small>{{ shopShareKindLabel }}</small><strong>{{ message.shopShare.title }}</strong><em>{{ message.shopShare.subtitle }}</em></span>
              </span>
              <span class="shop-share-footer"><span><small>{{ message.shopShare.storeName }}</small><strong v-if="shopSharePrice">{{ shopSharePrice }}</strong></span><span>打开 Shop <ChevronRight :size="13" /></span></span>
              <span v-if="message.shopShare.note" class="shop-share-note">“{{ message.shopShare.note }}”</span>
            </section>
          </template>
          <template v-else-if="message.mcpOperations?.length">
            <p class="mcp-operation-text" aria-label="角色 MCP 行动">{{ mcpOperationText }}</p>
          </template>
          <template v-else-if="message.mcpResult">
            <section class="mcp-result-card" aria-label="MCP 联网搜索结果">
              <header class="mcp-result-head">
                <span class="mcp-result-mark"><Globe2 :size="15" /></span>
                <span><small>MCP SEARCH</small><strong>{{ message.mcpResult.serverName }}</strong></span>
                <em>{{ message.mcpResult.toolName }}</em>
              </header>
              <div class="mcp-result-list">
                <article v-for="(item, index) in message.mcpResult.items" :key="`${item.url || item.title}-${index}`" class="mcp-result-item" :class="{ 'has-image': item.imageUrl && !isBrokenImageSource(item.imageUrl) }">
                  <img
                    v-if="item.imageUrl && !isBrokenImageSource(item.imageUrl)"
                    :src="item.imageUrl"
                    :alt="item.title"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    draggable="false"
                    @error="markBrokenImageSource(item.imageUrl)"
                  />
                  <span class="mcp-result-copy">
                    <small>{{ item.source || mcpResultKindLabel(item.kind) }}</small>
                    <strong>{{ item.title }}</strong>
                    <span v-if="item.description" class="mcp-result-description">{{ item.description }}</span>
                    <span v-if="item.address" class="mcp-result-address">{{ item.address }}</span>
                    <span v-if="item.price || item.distance || item.eta" class="mcp-result-meta">
                      <em v-if="item.price" class="price">{{ item.price }}</em>
                      <em v-if="item.distance">{{ item.distance }}</em>
                      <em v-if="item.eta">{{ item.eta }}</em>
                    </span>
                    <a
                      v-if="mcpResultItemUrl(item)"
                      :href="mcpResultItemUrl(item)"
                      target="_blank"
                      rel="noopener noreferrer"
                      referrerpolicy="no-referrer"
                      @click.stop
                      @pointerdown.stop
                      @pointerup.stop
                    >
                      <span>{{ item.url ? '查看原始结果' : '在地图中查看' }}</span><ChevronRight :size="13" />
                    </a>
                  </span>
                </article>
              </div>
              <footer>字段直接来自工具结构化响应</footer>
            </section>
          </template>
          <template v-else-if="message.musicListenInvite">
            <section class="listen-invite-card" :class="`listen-invite-card--${musicInviteStatus}`" aria-label="一起听邀请">
              <span class="listen-invite-disc" aria-hidden="true">
                <img v-if="message.musicListenInvite.track?.coverUrl" :src="message.musicListenInvite.track.coverUrl" alt="" draggable="false" />
                <Music2 v-else :size="22" />
              </span>
              <span class="listen-invite-copy">
                <small>{{ musicInviteKicker }}</small>
                <strong>{{ musicInviteTitle }}</strong>
                <span>{{ musicInviteSubtitle }}</span>
              </span>
              <span class="listen-invite-chip">{{ musicInviteChip }}</span>
              <span v-if="canRespondMusicInviteCard" class="listen-invite-actions" @pointerdown.stop @pointerup.stop>
                <button type="button" @click.stop="emit('reject-music-listen-invite')">拒绝</button>
                <button type="button" @click.stop="emit('accept-music-listen-invite')">同意</button>
              </span>
            </section>
          </template>
          <template v-else-if="message.linkPreview">
            <section class="chat-link-preview-message" :class="`platform-${message.linkPreview.platform}`" aria-label="链接预览">
              <p v-if="linkPreviewCaption" class="chat-link-preview-caption">{{ linkPreviewCaption }}</p>
              <a
                class="chat-link-preview-card"
                :href="message.linkPreview.url"
                target="_blank"
                rel="noopener noreferrer"
                referrerpolicy="no-referrer"
                @click.stop
                @pointerdown.stop
                @pointerup.stop
              >
                <span class="chat-link-preview-visual">
                  <img
                    v-if="message.linkPreview.imageUrl && !isBrokenImageSource(message.linkPreview.imageUrl)"
                    :src="message.linkPreview.imageUrl"
                    :alt="message.linkPreview.title"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    draggable="false"
                    @error="markBrokenImageSource(message.linkPreview.imageUrl)"
                  />
                  <span v-else class="chat-link-preview-placeholder" aria-hidden="true">
                    <Heart v-if="message.linkPreview.platform === 'xiaohongshu'" :size="24" />
                    <Play v-else-if="message.linkPreview.platform === 'douyin'" :size="24" fill="currentColor" />
                    <ShoppingBag v-else-if="message.linkPreview.platform === 'taobao'" :size="24" />
                    <Globe2 v-else :size="24" />
                  </span>
                </span>
                <span class="chat-link-preview-copy">
                  <small>{{ linkPreviewPlatformLabel }}</small>
                  <strong>{{ message.linkPreview.title }}</strong>
                  <span>{{ message.linkPreview.description }}</span>
                  <em>{{ linkPreviewHostname }} <ChevronRight :size="12" /></em>
                </span>
              </a>
            </section>
          </template>
          <template v-else-if="message.theaterLink">
            <section class="line-website-card" aria-label="网站链接">
              <span class="line-website-thumb" aria-hidden="true">
                <Globe2 :size="22" stroke-width="2.4" />
              </span>
              <span class="line-website-body">
                <span class="line-website-kicker">Website Link</span>
                <strong>{{ message.theaterLink.title }}</strong>
                <small>{{ message.theaterLink.summary }}</small>
                <em>{{ message.theaterLink.url }}</em>
              </span>
            </section>
          </template>
          <template v-else-if="message.offlineInvitation">
            <section class="offline-invitation-message" :class="`offline-invitation-message--${message.offlineInvitation.status}`" aria-label="线下模块邀请">
              <div class="offline-invitation-copy">
                <span>发起线下邀约</span>
                <strong>{{ offlineInvitationStatusLabel }}</strong>
                <small>{{ offlineInvitationDetail }}</small>
              </div>
              <div v-if="message.offlineInvitation.status === 'pending'" class="offline-invitation-actions">
                <button type="button" @click.stop="emit('reject-offline-invitation')">
                  <X :size="14" />
                  <span>拒绝</span>
                </button>
                <button type="button" @click.stop="emit('accept-offline-invitation')">
                  <DoorOpen :size="14" />
                  <span>接受</span>
                </button>
              </div>
            </section>
          </template>
          <template v-else>
            <span v-if="displayContentHtml" class="message-html-content" v-html="displayContentHtml"></span>
            <span v-else>{{ displayContent }}</span>
            <template v-if="showInlineTranslation">
              <span class="translation-divider" aria-hidden="true"></span>
              <span v-if="displayTranslationHtml" class="translation-copy message-html-content" v-html="displayTranslationHtml"></span>
              <span v-else class="translation-copy">{{ displayTranslation }}</span>
            </template>
          </template>
        </div>
        <p v-if="message.voice && showVoiceTranscript" class="voice-transcript">
          <span>{{ message.voice.transcript }}</span>
          <template v-if="showVoiceTranslation">
            <span class="translation-divider" aria-hidden="true"></span>
            <span class="translation-copy">{{ displayTranslation }}</span>
          </template>
        </p>
        <div
          v-if="message.quote"
          class="quote-card"
          :class="{ 'quote-card--online': message.mode === 'online', 'quote-card--overflowing': quoteOverflowing }"
        >
          <p ref="quoteContentRef">
            <strong>{{ quoteAuthorLabel }}</strong>
            <span>{{ quoteText }}</span>
          </p>
          <img v-if="quoteThumbnail" class="quote-thumbnail" :src="quoteThumbnail" :alt="quoteText" draggable="false" />
        </div>
      </div>
      <span v-if="message.status === 'failed'" class="message-failed-indicator" title="消息发送失败" aria-label="消息发送失败">!</span>
        <div v-if="showMessageMeta" class="message-meta">
          <span v-if="showReadState" class="read-state">{{ statusLabel }}</span>
          <time v-if="showMessageTime">{{ formatChatTime(message.createdAt) }}</time>
        </div>
    </div>
  </article>

  <AppModal v-if="message.image && message.sender === 'char'" v-model="showImageModal" title="聊天图片" variant="ins">
    <section class="image-viewer" :class="{ flipped: imageFlipped }" :style="imageViewerStyle">
      <button class="image-flip-card" type="button" @click="toggleImageFlip">
        <span class="image-face image-picture-face">
          <img v-if="modalImageSrc && !isBrokenImageSource(modalImageSrc)" :src="modalImageSrc" :alt="selectedImageDescription" @error="markBrokenImageSource(modalImageSrc)" />
          <span v-else>{{ selectedImageDescription }}</span>
        </span>
        <span class="image-face image-text-face">
          <span>{{ imageDescriptionDraft || selectedImageDescription }}</span>
        </span>
      </button>

      <div v-if="imageCandidates.length" class="image-history" aria-label="聊天图片历史">
        <button
          v-for="(candidate, index) in imageCandidates"
          :key="candidate.id"
          class="image-thumb"
          :class="{ active: candidate.id === selectedCandidateId }"
          type="button"
          :aria-label="`查看图片 ${index + 1}`"
          @click="selectCandidate(candidate.id)"
        >
          <img :src="candidate.image" :alt="candidate.description || '聊天图片'" @error="markBrokenImageSource(candidate.image)" />
        </button>
      </div>

      <label v-if="canRegenerateImage" class="image-description-field">
        <span>Description</span>
        <textarea v-model="imageDescriptionDraft" maxlength="500" placeholder="修改图片描述后重新生成。"></textarea>
      </label>

      <div class="image-actions">
        <button class="image-secondary" type="button" @click="toggleImageFlip">翻转</button>
        <button class="image-secondary" type="button" :disabled="!modalImageSrc" @click="downloadCurrentImage">下载</button>
        <button class="image-secondary" type="button" :disabled="regeneratingImage || !canApplySelectedCandidate" @click="applySelectedCandidate">应用</button>
        <button
          class="image-primary"
          type="button"
          :class="{ busy: regeneratingImage }"
          :aria-disabled="regeneratingImage || !canRegenerateImage"
          :disabled="regeneratingImage || !canRegenerateImage || !imageDescriptionDraft.trim()"
          @click="regenerateImage"
        >
          <LoaderCircle v-if="regeneratingImage" class="loading-icon" :size="15" />
          <span>{{ regeneratingImage ? '生成中' : '重新生成' }}</span>
        </button>
      </div>
    </section>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ChevronRight, DoorOpen, Globe2, Heart, LoaderCircle, Music2, Pause, Play, Quote, ShoppingBag, X } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import type { CharacterProfile, ChatAppearanceSettings, ChatImageCandidate, ChatMcpResultItem, ChatMessage, UserProfile } from '@/types/domain';
import { useAppStore } from '@/stores/appStore';
import { normalizeLooseModelReply, parseModelJsonResponse } from '@/utils/aiResponse';
import { getCharacterDisplayName } from '@/utils/character';
import { formatChatTime } from '@/utils/time';
import { defaultConversationSettings } from '@/utils/memory';
import { renderSafeMessageHtml } from '@/utils/messageHtml';
import { defaultProfileAvatar } from '@/utils/profile';
import { downloadImageUrl } from '@/utils/download';
import { getStickerDisplayImageUrl } from '@/utils/stickers';
import { normalizeTranslationText, shouldShowChineseTranslation } from '@/utils/translation';
import { gobangStoneForPlayer } from '@/utils/gobang';
import { mcpOperationStateLabel } from '@/utils/mcpOperations';

const props = withDefaults(defineProps<{
  message: ChatMessage;
  character: CharacterProfile;
  user?: UserProfile;
  appearance?: ChatAppearanceSettings;
  hideAvatar?: boolean;
  hideMessageTime?: boolean;
  profileAlert?: boolean;
  canRegenerateImage?: boolean;
  regeneratingImage?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  canQuote?: boolean;
  authorAvatar?: string;
  authorName?: string;
  showAuthorName?: boolean;
  enableAvatarDoubleAction?: boolean;
}>(), {
  appearance: () => defaultConversationSettings.appearance,
  canRegenerateImage: false,
  canQuote: false,
  hideAvatar: false,
  hideMessageTime: false,
  profileAlert: false,
  regeneratingImage: false,
  selectionMode: false,
  selected: false,
  authorAvatar: '',
  authorName: '',
  showAuthorName: false,
  enableAvatarDoubleAction: false
});

const emit = defineEmits<{
  'open-profile': [];
  'open-user-profile': [];
  'open-turn-trace': [message: ChatMessage];
  'request-reply': [];
  'avatar-long-press': [message: ChatMessage];
  'long-press': [message: ChatMessage];
  'toggle-select': [];
  'regenerate-image': [messageId: string, description: string];
  'apply-image': [messageId: string, candidateId: string];
  'busy-action': [message: string, title: string];
  'open-card-detail': [message: ChatMessage];
  'quote-message': [message: ChatMessage];
  'accept-offline-invitation': [];
  'reject-offline-invitation': [];
  'accept-transfer': [];
  'reject-transfer': [];
  'accept-music-listen-invite': [];
  'reject-music-listen-invite': [];
  'accept-call': [];
  'reject-call': [];
  'accept-gobang': [];
  'reject-gobang': [];
  'open-gobang': [message: ChatMessage];
}>();

const store = useAppStore();

let longPressTimer: number | undefined;
let longPressStart: { x: number; y: number } | null = null;
let avatarLongPressTimer: number | undefined;
let avatarLongPressStart: { x: number; y: number } | null = null;
let avatarClickTimer: number | undefined;
let longPressTriggered = false;
let suppressingSelection = false;
let swipeStart: { x: number; y: number; pointerId: number } | null = null;
let swipeTracking = false;
let suppressNextClick = false;
const showImageModal = ref(false);
const imageFlipped = ref(false);
const imageDescriptionDraft = ref('');
const selectedCandidateId = ref('');
const brokenImageSources = ref<string[]>([]);
const playingVoice = ref(false);
const showVoiceTranscript = ref(true);
const voiceLoading = ref(false);
const swipeOffset = ref(0);
const quoteContentRef = ref<HTMLParagraphElement | null>(null);
const quoteOverflowing = ref(false);
let activeVoiceAudio: HTMLAudioElement | null = null;
let quoteResizeObserver: ResizeObserver | null = null;

const swipeTriggerDistance = 54;
const swipeMaxDistance = 74;

function normalizeTextFragments(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeTextFragments(item));
  if (typeof value === 'string' || typeof value === 'number') {
    const content = String(value).trim();
    return content ? [content] : [];
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [record.content, record.text, record.message, record.reply];
    for (const candidate of candidates) {
      const fragments = normalizeTextFragments(candidate);
      if (fragments.length) return fragments;
    }
  }
  return [];
}

const displayContent = computed(() => {
  if (props.message.sender !== 'char') return props.message.content;
  try {
    const parsed = parseModelJsonResponse(props.message.content) as Record<string, unknown>;
    const fragments = normalizeTextFragments(parsed.replies ?? parsed.reply ?? parsed.messages ?? parsed.content ?? parsed.message ?? parsed.text);
    return fragments.length ? fragments.join('\n') : normalizeLooseModelReply(props.message.content);
  } catch {
    return normalizeLooseModelReply(props.message.content);
  }
});

function normalizeTranslationFragments(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeTranslationFragments(item));
  if (typeof value === 'string' || typeof value === 'number') {
    const content = normalizeTranslationText(value);
    return content ? [content] : [];
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [record.contentTranslation, record.translation, record.translationZh, record.chineseTranslation, record.chinese, record.zh, record.cn, record.translatedContent];
    for (const candidate of candidates) {
      const fragments = normalizeTranslationFragments(candidate);
      if (fragments.length) return fragments;
    }
  }
  return [];
}

const parsedTranslation = computed(() => {
  if (props.message.sender !== 'char') return '';
  try {
    const parsed = parseModelJsonResponse(props.message.content) as Record<string, unknown>;
    const topLevelTranslations = normalizeTranslationFragments(
      parsed.replyTranslations
      ?? parsed.translations
      ?? parsed.translationTexts
      ?? parsed.chineseTranslations
      ?? parsed.translation
      ?? parsed.contentTranslation
    );
    if (topLevelTranslations.length) return topLevelTranslations.join('\n');
    return normalizeTranslationFragments(parsed.replies ?? parsed.reply ?? parsed.content ?? parsed.message ?? parsed.text).join('\n');
  } catch {
    return '';
  }
});

const displayTranslation = computed(() => normalizeTranslationText(props.message.translation) || parsedTranslation.value);
const displayContentHtml = computed(() => renderSafeMessageHtml(displayContent.value));
const displayTranslationHtml = computed(() => renderSafeMessageHtml(displayTranslation.value));
const showInlineTranslation = computed(() => props.message.sender === 'char'
  && props.message.mode === 'online'
  && !props.message.sticker
  && !props.message.voice
  && !props.message.location
  && !props.message.mcpResult
  && !props.message.commerce
  && !props.message.shopShare
  && !props.message.linkPreview
  && !props.message.theaterLink
  && !props.message.gobang
  && shouldShowChineseTranslation(displayContent.value, displayTranslation.value));
const showVoiceTranslation = computed(() => props.message.sender === 'char'
  && props.message.mode === 'online'
  && Boolean(props.message.voice)
  && shouldShowChineseTranslation(props.message.voice?.transcript ?? '', displayTranslation.value));
const linkPreviewCaption = computed(() => props.message.linkPreview
  ? props.message.content.replace(/https?:\/\/[^\s<>"']+/i, '').replace(/^[\s，。！？；：、…]+|[\s，。！？；：、…]+$/g, '').trim()
  : '');
const linkPreviewPlatformLabel = computed(() => {
  const platform = props.message.linkPreview?.platform;
  const labels: Partial<Record<NonNullable<typeof platform>, string>> = {
    xiaohongshu: '小红书 · 笔记分享', douyin: '抖音 · 视频分享', taobao: '淘宝 · 商品链接', pinduoduo: '拼多多 · 商品链接', jd: '京东 · 商品链接',
    xianyu: '闲鱼 · 商品链接', bilibili: '哔哩哔哩 · 视频分享', weibo: '微博 · 内容分享', zhihu: '知乎 · 内容分享', kuaishou: '快手 · 视频分享',
    wechat: '微信 · 文章分享', meituan: '美团 · 服务分享', dianping: '大众点评 · 门店分享', ctrip: '携程 · 旅行分享', eleme: '饿了么 · 商家分享', dewu: '得物 · 商品链接'
  };
  if (platform && labels[platform]) return labels[platform];
  return props.message.linkPreview?.siteName || '网站链接';
});
const linkPreviewHostname = computed(() => {
  const url = props.message.linkPreview?.url;
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return props.message.linkPreview?.siteName || '网页';
  }
});

const characterDisplayName = computed(() => getCharacterDisplayName(props.character));
const userDisplayName = computed(() => {
  const user = props.user ?? store.user;
  return user?.nickname || user?.name || '我';
});
const userAvatar = computed(() => {
  const currentUser = props.user ?? store.user;
  return currentUser?.avatar || defaultProfileAvatar;
});
const messageVisualSender = computed<ChatMessage['sender']>(() => {
  if (!props.message.call) return props.message.sender;
  return props.message.call.direction === 'incoming' ? 'char' : 'user';
});
const showAvatarButton = computed(() => (messageVisualSender.value === 'char' && props.appearance.showCharacterAvatar)
  || (messageVisualSender.value === 'user' && props.appearance.showUserAvatar));
const avatarSource = computed(() => props.authorAvatar || (messageVisualSender.value === 'user' ? userAvatar.value : props.character.avatar));
const avatarAlt = computed(() => props.authorName || (messageVisualSender.value === 'user' ? userDisplayName.value : characterDisplayName.value));
const avatarActionLabel = computed(() => props.enableAvatarDoubleAction
  ? messageVisualSender.value === 'user'
    ? `单击查看${avatarAlt.value}主页，双击触发回复`
    : `单击查看${avatarAlt.value}主页，双击查看本轮 API 记录`
  : `查看${avatarAlt.value}主页`);
const authorLabel = computed(() => props.showAuthorName && messageVisualSender.value === 'char' ? avatarAlt.value : '');
const showProfileAlert = computed(() => props.profileAlert && messageVisualSender.value === 'char');
const quoteText = computed(() => props.message.quote?.sticker
  ? props.message.quote.sticker.description
  : props.message.quote?.image
    ? props.message.quote.image.description
    : props.message.quote?.voice
      ? props.message.quote.voice.transcript
      : props.message.quote?.location
        ? props.message.quote.location.name
        : props.message.quote?.transfer
          ? `${props.message.quote.transfer.responseToMessageId ? '转账回执 ' : ''}¥${props.message.quote.transfer.amount}`
          : props.message.quote?.commerce
            ? `${props.message.quote.commerce.kind === 'takeout' ? '外卖' : props.message.quote.commerce.kind === 'gift' ? '礼物' : '购物'} ${props.message.quote.commerce.storeName}`
            : props.message.quote?.shopShare
              ? `${props.message.quote.shopShare.title} · ${props.message.quote.shopShare.storeName}`
              : props.message.quote?.musicListenInvite
              ? `一起听 ${props.message.quote.musicListenInvite.track?.name || props.message.quote.musicListenInvite.status}`
              : props.message.quote?.linkPreview
                ? props.message.quote.linkPreview.title
              : props.message.quote?.theaterLink
            ? props.message.quote.theaterLink.title
            : props.message.quote?.call
              ? `${props.message.quote.call.mode === 'video' ? '视频通话' : '语音通话'} ${props.message.quote.call.status}`
  : props.message.quote?.content ?? '');
const quoteThumbnail = computed(() => props.message.quote?.sticker?.imageUrl ?? props.message.quote?.image?.url ?? props.message.quote?.shopShare?.imageUrl ?? props.message.quote?.linkPreview?.imageUrl ?? '');
const quoteAuthorLabel = computed(() => (props.message.quote?.authorName ? `${props.message.quote.authorName}：` : ''));

function measureQuoteOverflow() {
  const quoteContent = quoteContentRef.value;
  quoteOverflowing.value = props.message.mode === 'online'
    && Boolean(quoteContent && quoteContent.scrollHeight > quoteContent.clientHeight + 1);
}

function observeQuoteOverflow() {
  quoteResizeObserver?.disconnect();
  quoteResizeObserver = null;
  measureQuoteOverflow();
  if (!quoteContentRef.value || typeof ResizeObserver === 'undefined') return;
  quoteResizeObserver = new ResizeObserver(measureQuoteOverflow);
  quoteResizeObserver.observe(quoteContentRef.value);
}

const bubbleStyle = computed(() => {
  if (props.message.sticker || props.message.image || props.message.location || props.message.mcpResult || props.message.transfer || props.message.commerce || props.message.shopShare || props.message.musicListenInvite || props.message.linkPreview || props.message.theaterLink || props.message.offlineInvitation || props.message.call || props.message.gobang) return {};
  if (props.message.displayStyle === 'narration') {
    return {
      background: props.appearance.narrationBubbleColor,
      color: props.appearance.narrationTextColor
    };
  }
  if (props.message.sender === 'user') {
    return {
      background: props.appearance.userBubbleColor,
      color: props.appearance.userTextColor
    };
  }
  if (props.message.sender === 'char') {
    return {
      background: props.appearance.characterBubbleColor,
      color: props.appearance.characterTextColor
    };
  }
  return {};
});

const imageCardStyle = computed(() => {
  const image = props.message.image;
  if (!image?.width || !image.height) return { '--chat-image-ratio': '1 / 1' };
  return { '--chat-image-ratio': `${image.width} / ${image.height}` };
});

const imageCandidates = computed<ChatImageCandidate[]>(() => {
  const image = props.message.image;
  const candidates = [...(image?.candidates ?? [])].filter((candidate) => candidate.image && !isBrokenImageSource(candidate.image));
  if (image?.url && !candidates.some((candidate) => candidate.image === image.url)) {
    candidates.unshift({
      id: `${props.message.id}-current-image`,
      image: image.url,
      description: image.description,
      provider: image.provider || 'local',
      model: image.model,
      size: image.size,
      createdAt: props.message.createdAt
    });
  }
  return candidates;
});
const selectedCandidate = computed(() => imageCandidates.value.find((candidate) => candidate.id === selectedCandidateId.value) ?? imageCandidates.value.find((candidate) => candidate.image === props.message.image?.url));
const selectedImageDescription = computed(() => selectedCandidate.value?.description || props.message.image?.description || '图片描述暂未保存。');
const modalImageSrc = computed(() => selectedCandidate.value?.image || props.message.image?.url || '');
const canApplySelectedCandidate = computed(() => Boolean(selectedCandidate.value && selectedCandidate.value.image !== props.message.image?.url && !selectedCandidate.value.id.endsWith('-current-image')));
const imageViewerAspectRatio = computed(() => {
  const size = selectedCandidate.value?.size || props.message.image?.size || '';
  const [width, height] = size.split('x').map((value) => Number.parseInt(value, 10));
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) return `${width} / ${height}`;
  if (props.message.image?.width && props.message.image.height) return `${props.message.image.width} / ${props.message.image.height}`;
  return '1 / 1';
});
const imageViewerStyle = computed(() => ({ '--chat-viewer-ratio': imageViewerAspectRatio.value }));
const lineLocationName = computed(() => props.message.location?.name.trim() || '地点名称');
const lineLocationAddress = computed(() => props.message.location?.address?.trim() || '');
const lineLocationDistanceLabel = computed(() => {
  const distance = props.message.location?.distance.trim() || '未知';
  return props.message.sender === 'user' ? `距离对方 ${distance}` : `距离你 ${distance}`;
});
const lineLocationMapLabel = computed(() => {
  const address = props.message.location?.address?.trim() || lineLocationName.value;
  const match = address.match(/([^市区县]+(?:街|路|巷|道)\d*[^\s,，。]*)/);
  return match?.[1] || lineLocationName.value;
});

function mcpResultKindLabel(kind: ChatMcpResultItem['kind']) {
  return kind === 'product' ? '商品结果' : kind === 'place' ? '地点结果' : kind === 'media' ? '内容结果' : kind === 'link' ? '网页结果' : '搜索结果';
}

function mcpResultItemUrl(item: ChatMcpResultItem) {
  if (item.url) return item.url;
  if (item.longitude === undefined || item.latitude === undefined) return '';
  const position = `${item.longitude},${item.latitude}`;
  return `https://uri.amap.com/marker?position=${encodeURIComponent(position)}&name=${encodeURIComponent(item.title)}&src=BabyLink`;
}

const mcpOperationText = computed(() => props.message.mcpOperations?.map((operation) => {
  const detail = [operation.receipt ? `回执 ${operation.receipt}` : '', operation.result]
    .filter(Boolean)
    .join(' · ')
    .replace(/\s+/g, ' ')
    .trim();
  return `MCP · ${operation.serverName} · ${operation.toolName} · ${mcpOperationStateLabel(operation.state)}${detail ? `：${detail}` : ''}`;
}).join('；') ?? '');

const linePayAmount = computed(() => props.message.transfer?.amount || '0.00');
const linePayStatus = computed(() => props.message.transfer?.status ?? 'pending');
const linePayIsReceipt = computed(() => Boolean(props.message.transfer?.responseToMessageId));
const linePayOriginalTransferMessage = computed(() => {
  const sourceMessageId = props.message.transfer?.responseToMessageId;
  if (!sourceMessageId) return null;
  return store.messages.find((message) => message.id === sourceMessageId && message.transfer && !message.transfer.responseToMessageId) ?? null;
});
const linePayOriginalSender = computed(() => {
  if (!linePayIsReceipt.value) return props.message.sender;
  return linePayOriginalTransferMessage.value?.sender ?? (props.message.sender === 'user' ? 'char' : 'user');
});
const linePayTransferSender = computed(() => (linePayIsReceipt.value ? linePayOriginalSender.value : props.message.sender));
const linePayStatusText = computed(() => ({
  pending: '待确认',
  accepted: '已接收',
  rejected: '已拒绝'
}[linePayStatus.value]));
const linePayReceiptDirectionLabel = computed(() => {
  if (linePayStatus.value === 'accepted') return linePayTransferSender.value === 'user' ? '对方已接收转账' : '你已接收转账';
  if (linePayStatus.value === 'rejected') return linePayTransferSender.value === 'user' ? '对方已拒收转账' : '你已拒收转账';
  return linePayTransferSender.value === 'user' ? '对方已回应转账' : '你已回应转账';
});
const linePayDirectionLabel = computed(() => {
  if (linePayIsReceipt.value) return linePayReceiptDirectionLabel.value;
  return linePayTransferSender.value === 'user' ? '转账给对方' : '对方向你转账';
});
const linePayCounterpartyText = computed(() => (linePayTransferSender.value === 'user' ? `收款方 ${characterDisplayName.value}` : `来自 ${characterDisplayName.value}`));
const linePayPendingChip = computed(() => (linePayTransferSender.value === 'user' ? '等待确认' : '待处理'));
const linePayCardChip = computed(() => (linePayStatus.value === 'pending' ? linePayPendingChip.value : linePayStatusText.value));
const linePaySettledTitle = computed(() => {
  if (linePayStatus.value === 'accepted') return linePayTransferSender.value === 'user' ? '对方已收款' : '你已收款';
  return linePayTransferSender.value === 'user' ? '对方已拒收' : '你已拒收';
});
const linePayNote = computed(() => props.message.transfer?.note?.trim() || '');
const blankTransferRequestLine = '\u00a0';
const linePayRequestSubtext = computed(() => linePayCounterpartyText.value);
const linePayCardSubtext = computed(() => {
  if (linePayIsReceipt.value || linePayStatus.value === 'pending') return linePayRequestSubtext.value;
  return linePaySettledTitle.value;
});
const linePayRequestNoteText = computed(() => linePayNote.value || blankTransferRequestLine);
const canRespondTransferCard = computed(() => props.message.sender === 'char' && !linePayIsReceipt.value && linePayStatus.value === 'pending');
const commerceKindLabel = computed(() => props.message.sender === 'user'
  ? ({ takeout: `给${characterDisplayName.value}点的外卖`, gift: `送给${characterDisplayName.value}的礼物`, shopping: '共同购买的东西' })[props.message.commerce?.kind ?? 'shopping']
  : ({ takeout: '给你点的外卖', gift: '送给你的礼物', shopping: '刚买到的东西' })[props.message.commerce?.kind ?? 'shopping']);
const commerceKindEnglish = computed(() => ({ takeout: 'DELIVERY', gift: 'GIFT', shopping: 'ORDER' })[props.message.commerce?.kind ?? 'shopping']);
const commerceOrderMark = computed(() => ({ takeout: '🥡', gift: '🎁', shopping: '🛍️' })[props.message.commerce?.kind ?? 'shopping']);
const commerceItemsText = computed(() => props.message.commerce?.items.map((item) => `${item.name} ×${item.quantity}`).join(' · ') || '订单商品');
const commerceStatusLabel = computed(() => ({ paid: '已付款', preparing: '准备中', delivering: '配送中', delivered: '已送达', cancelled: '已取消' })[props.message.commerce?.status ?? 'paid']);
const commerceCardMessage = computed(() => props.message.commerce?.cardMessage?.trim() || props.message.commerce?.note?.trim() || '');
const commercePayerName = computed(() => props.message.commerce?.purchaserName || (props.message.sender === 'user' ? userDisplayName.value : characterDisplayName.value));
const shopShareKindLabel = computed(() => ({ product: '分享给你的商品', 'character-pick': 'TA 放进共同购物车', wishlist: '共同愿望单', storefront: '想和你逛的店', moment: '商城里的新动态', order: '共同购物订单' })[props.message.shopShare?.kind ?? 'product']);
const shopShareChip = computed(() => props.message.shopShare?.kind === 'character-pick' ? 'TA PICKED' : props.message.sender === 'user' ? 'SHARED' : 'FOR YOU');
const shopSharePrice = computed(() => typeof props.message.shopShare?.priceCents === 'number' ? `¥${(props.message.shopShare.priceCents / 100).toFixed(2)}` : '');
const musicInviteStatus = computed(() => props.message.musicListenInvite?.status ?? 'pending');
const musicInviteTrack = computed(() => props.message.musicListenInvite?.track ?? null);
const musicInviteTitle = computed(() => musicInviteTrack.value?.name || '邀请一起听');
const musicInviteSubtitle = computed(() => {
  const artists = musicInviteTrack.value?.artists?.filter(Boolean).join(' / ') || '';
  return artists || props.message.musicListenInvite?.note || (props.message.sender === 'char' ? '对方想和你一起听歌' : '等待对方加入音乐房间');
});
const musicInviteKicker = computed(() => (props.message.sender === 'char' ? `${characterDisplayName.value} 发起` : `${userDisplayName.value} 发起`));
const musicInviteChip = computed(() => ({
  pending: props.message.sender === 'char' ? '待你选择' : '等待对方',
  accepted: '已连接',
  rejected: '已拒绝'
}[musicInviteStatus.value]));
const canRespondMusicInviteCard = computed(() => props.message.sender === 'char' && musicInviteStatus.value === 'pending');
const offlineInvitationStatusLabel = computed(() => ({
  pending: '要进入线下模式继续这一幕吗？',
  accepted: '已进入线下模块',
  rejected: '已保持线上网聊'
}[props.message.offlineInvitation?.status ?? 'pending']));
const offlineInvitationDetail = computed(() => ({
  pending: '接受后会切到线下页面，并自动生成新的章节。',
  accepted: '新的故事篇章会在线下页面继续生成。',
  rejected: '继续在线上聊天。'
}[props.message.offlineInvitation?.status ?? 'pending']));
const callModeText = computed(() => props.message.call?.mode === 'video' ? '视频通话' : '语音通话');
const callStatusText = computed(() => ({
  ringing: '呼叫中',
  accepted: '已接听',
  rejected: '已拒绝',
  missed: '未接听',
  busy: '忙线',
  cancelled: '已取消呼叫',
  ended: '已结束',
  failed: '呼叫失败'
}[props.message.call?.status ?? 'ringing']));
const callDurationText = computed(() => {
  const duration = Math.max(0, Math.round(Number(props.message.call?.duration) || 0));
  if (!duration) return '';
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
});
const callCardKicker = computed(() => props.message.call?.direction === 'incoming' ? characterDisplayName.value : userDisplayName.value);
const callCardAvatar = computed(() => props.message.call?.direction === 'incoming' ? props.character.avatar : userAvatar.value);
const callCardTitle = computed(() => callModeText.value);
const callCardModePill = computed(() => props.message.call?.mode === 'video' ? 'Video' : 'Voice');
const callCardDetail = computed(() => {
  const call = props.message.call;
  if (!call) return '';
  const duration = callDurationText.value;
  if (call.status === 'ringing') return call.direction === 'incoming' ? '对方正在等待你接听' : '等待对方接听';
  if (call.status === 'ended') return duration ? `通话时长 ${duration}` : '通话已结束';
  if (call.status === 'cancelled') return call.direction === 'outgoing' ? '你已取消呼叫' : '呼叫已取消';
  if (call.status === 'accepted') return '正在通话';
  return callStatusText.value;
});
const canRespondCallCard = computed(() => props.message.call?.direction === 'incoming' && props.message.call.status === 'ringing');
const gobangPreviewCells = computed(() => {
  const game = props.message.gobang;
  if (!game) return [];
  const latestMove = game.moves[game.moves.length - 1];
  const startRow = Math.max(0, Math.min(6, (latestMove?.row ?? 7) - 4));
  const startColumn = Math.max(0, Math.min(6, (latestMove?.column ?? 7) - 4));
  const moveMap = new Map(game.moves.map((move) => [`${move.row}:${move.column}`, move]));
  return Array.from({ length: 81 }, (_, index) => {
    const row = startRow + Math.floor(index / 9);
    const column = startColumn + index % 9;
    const move = moveMap.get(`${row}:${column}`);
    return {
      key: `${row}:${column}`,
      stone: move ? gobangStoneForPlayer(game, move.player) : '',
      latest: latestMove?.row === row && latestMove.column === column
    };
  });
});
const gobangCardTitle = computed(() => {
  const game = props.message.gobang;
  if (!game) return '';
  const invitationStatus = game.invitationStatus ?? 'accepted';
  if (invitationStatus === 'pending') return game.direction === 'incoming' ? `${characterDisplayName.value} 邀请你对弈` : `等待 ${characterDisplayName.value} 回应`;
  if (invitationStatus === 'rejected') return '五子棋邀请已拒绝';
  if (invitationStatus === 'cancelled') return '五子棋邀请已取消';
  if (game.status === 'user-won') return '你赢了这一局';
  if (game.status === 'char-won') return `${characterDisplayName.value} 赢了`;
  if (game.status === 'draw') return '这一局是平局';
  if (game.status === 'resigned') return '对局已结束';
  if (['failed', 'interrupted'].includes(game.apiState?.status ?? '')) return `${characterDisplayName.value} 落子失败`;
  return game.turn === 'user' ? '轮到你落子' : `${characterDisplayName.value} 正在想`;
});
const gobangCardDetail = computed(() => {
  const game = props.message.gobang;
  if (!game) return '';
  const invitationStatus = game.invitationStatus ?? 'accepted';
  if (invitationStatus === 'pending') return game.direction === 'incoming' ? '接受后进入独立棋局页面' : '角色会根据当前会话决定是否接受';
  if (invitationStatus === 'rejected') return '本局没有开始';
  if (invitationStatus === 'cancelled') return '邀请没有生效';
  return `当前${game.moves.length} 手，点此${game.status === 'active' ? '继续' : '查看'}`;
});
const canRespondGobangCard = computed(() => props.message.gobang?.direction === 'incoming' && props.message.gobang.invitationStatus === 'pending');
const gobangApiFailed = computed(() => ['failed', 'interrupted'].includes(props.message.gobang?.apiState?.status ?? ''));
const gobangCardChip = computed(() => {
  const invitationStatus = props.message.gobang?.invitationStatus ?? 'accepted';
  if (invitationStatus === 'pending') return props.message.gobang?.direction === 'incoming' ? '邀请你' : '等待中';
  if (invitationStatus === 'rejected') return '已拒绝';
  if (invitationStatus === 'cancelled') return '已取消';
  const status = props.message.gobang?.status;
  if (gobangApiFailed.value) return '需重试';
  if (status === 'active') return '进行中';
  if (status === 'user-won') return '胜';
  if (status === 'char-won') return '负';
  if (status === 'draw') return '和';
  return '结束';
});
const voiceDuration = computed(() => {
  const duration = props.message.voice?.duration ?? 0;
  if (Number.isFinite(duration) && duration > 0) return Math.max(1, Math.round(duration));
  const transcriptLength = props.message.voice?.transcript.trim().length ?? 0;
  return Math.max(1, Math.ceil(transcriptLength / 4));
});
const voiceDurationLabel = computed(() => `${voiceDuration.value}"`);
const voiceMessageStyle = computed(() => ({
  '--voice-width': `${Math.min(144, Math.max(98, 64 + voiceDuration.value * 2))}px`
}));
const voiceWaveBars = computed(() => Array.from({
  length: Math.min(18, Math.max(4, Math.ceil(voiceDuration.value / 4) + 4))
}, (_, index) => index));
const canGenerateVoiceAudio = computed(() => props.message.sender === 'char' && Boolean(props.message.voice?.transcript.trim()));
const voicePlayDisabled = computed(() => voiceLoading.value || (!props.message.voice?.audioUrl && !canGenerateVoiceAudio.value));
const voiceButtonLabel = computed(() => (showVoiceTranscript.value ? '收起语音文字' : '显示语音文字'));
const voicePlaybackLabel = computed(() => {
  if (voiceLoading.value) return '正在生成语音';
  if (playingVoice.value) return '暂停语音';
  return props.message.voice?.audioUrl ? '播放语音' : '生成并播放语音';
});

const isSystemNarration = computed(() => props.message.sender === 'system' && props.message.displayStyle === 'narration');
const showMessageTime = computed(() => props.appearance.showMessageTime && !props.hideMessageTime && !isSystemNarration.value && !props.message.mcpOperations?.length && !props.message.voomEventType && !props.message.voomPostId);
const showReadState = computed(() => props.appearance.showReadStatus && messageVisualSender.value !== 'system' && !props.message.voomEventType && !props.message.voomPostId);
const showMessageMeta = computed(() => showMessageTime.value || showReadState.value);

const statusLabel = computed(() => props.message.readAt === null ? '未读' : '已读');
const swipeQuoteReady = computed(() => swipeOffset.value >= swipeTriggerDistance);
const swipeStyle = computed(() => ({
  '--swipe-quote-offset': `${0 - swipeOffset.value}px`
}));

function clearLongPressTimer() {
  if (longPressTimer === undefined) return;
  window.clearTimeout(longPressTimer);
  longPressTimer = undefined;
}

function clearNativeTextSelection() {
  window.getSelection()?.removeAllRanges();
}

function handleSelectionChange() {
  if (!suppressingSelection) return;
  clearNativeTextSelection();
}

function startSuppressingNativeSelection() {
  if (suppressingSelection) return;
  suppressingSelection = true;
  document.addEventListener('selectionchange', handleSelectionChange);
}

function stopSuppressingNativeSelection() {
  if (!suppressingSelection) return;
  suppressingSelection = false;
  document.removeEventListener('selectionchange', handleSelectionChange);
  clearNativeTextSelection();
}

function suppressNativeSelection(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  clearNativeTextSelection();
}

function startLongPress(event: PointerEvent) {
  if (props.selectionMode || event.button !== 0) return;
  longPressStart = { x: event.clientX, y: event.clientY };
  longPressTriggered = false;
  clearLongPressTimer();
  startSuppressingNativeSelection();
  longPressTimer = window.setTimeout(() => {
    longPressTriggered = true;
    clearNativeTextSelection();
    emit('long-press', props.message);
  }, 520);
}

function trackPointerMove(event: PointerEvent) {
  if (!longPressStart) return;
  const moved = Math.hypot(event.clientX - longPressStart.x, event.clientY - longPressStart.y);
  if (moved > 10) cancelLongPress();
}

function cancelLongPress() {
  clearLongPressTimer();
  longPressStart = null;
  stopSuppressingNativeSelection();
}

function resetSwipe() {
  swipeStart = null;
  swipeTracking = false;
  swipeOffset.value = 0;
}

function canStartSwipe(event: PointerEvent) {
  return props.canQuote && !props.selectionMode && event.button === 0 && event.isPrimary !== false;
}

function handlePointerDown(event: PointerEvent) {
  if (canStartSwipe(event)) {
    swipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    swipeTracking = false;
    swipeOffset.value = 0;
  }
  startLongPress(event);
}

function handlePointerMove(event: PointerEvent) {
  if (!swipeStart || event.pointerId !== swipeStart.pointerId) {
    trackPointerMove(event);
    return;
  }

  const deltaX = event.clientX - swipeStart.x;
  const deltaY = event.clientY - swipeStart.y;
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (!swipeTracking) {
    if (verticalDistance > 12 && verticalDistance > horizontalDistance) {
      resetSwipe();
      trackPointerMove(event);
      return;
    }
    if (deltaX < -10 && horizontalDistance > verticalDistance * 1.15) {
      swipeTracking = true;
      clearLongPressTimer();
    }
  }

  if (!swipeTracking) {
    trackPointerMove(event);
    return;
  }

  swipeOffset.value = Math.min(swipeMaxDistance, Math.max(0, 0 - deltaX));
  event.preventDefault();
  event.stopPropagation();
}

function handlePointerUp(event: PointerEvent) {
  if (!swipeTracking) {
    cancelLongPress();
    resetSwipe();
    return;
  }

  const shouldQuote = swipeQuoteReady.value;
  event.preventDefault();
  event.stopPropagation();
  resetSwipe();
  cancelLongPress();
  if (!shouldQuote) return;
  suppressNextClick = true;
  emit('quote-message', props.message);
  window.setTimeout(() => {
    suppressNextClick = false;
  }, 120);
}

function handlePointerCancel() {
  cancelLongPress();
  resetSwipe();
}

function handlePointerLeave() {
  if (swipeTracking) return;
  cancelLongPress();
  resetSwipe();
}

function suppressClickAfterSwipe(event: MouseEvent) {
  if (!suppressNextClick) return;
  suppressNextClick = false;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
}

function handleAvatarClick() {
  if (props.hideAvatar) return;
  if (props.selectionMode) {
    emit('toggle-select');
    return;
  }
  if (!props.enableAvatarDoubleAction) {
    emitAvatarPrimaryAction();
    return;
  }
  if (avatarClickTimer !== undefined) {
    window.clearTimeout(avatarClickTimer);
    avatarClickTimer = undefined;
    if (messageVisualSender.value === 'user') emit('request-reply');
    else emit('open-turn-trace', props.message);
    return;
  }
  avatarClickTimer = window.setTimeout(() => {
    avatarClickTimer = undefined;
    emitAvatarPrimaryAction();
  }, 300);
}

function emitAvatarPrimaryAction() {
  if (messageVisualSender.value === 'user') emit('open-user-profile');
  else emit('open-profile');
}

function clearAvatarLongPressTimer() {
  if (avatarLongPressTimer === undefined) return;
  window.clearTimeout(avatarLongPressTimer);
  avatarLongPressTimer = undefined;
}

function startAvatarLongPress(event: PointerEvent) {
  if (props.hideAvatar || props.selectionMode || event.button !== 0) return;
  clearAvatarLongPressTimer();
  avatarLongPressStart = { x: event.clientX, y: event.clientY };
  avatarLongPressTimer = window.setTimeout(() => {
    clearAvatarLongPressTimer();
    emit('avatar-long-press', props.message);
  }, 520);
}

function trackAvatarLongPress(event: PointerEvent) {
  if (!avatarLongPressStart) return;
  if (Math.hypot(event.clientX - avatarLongPressStart.x, event.clientY - avatarLongPressStart.y) > 10) cancelAvatarLongPress();
}

function cancelAvatarLongPress() {
  clearAvatarLongPressTimer();
  avatarLongPressStart = null;
}

function emitAvatarLongPress() {
  cancelAvatarLongPress();
  emit('avatar-long-press', props.message);
}

function emitLongPress(event?: Event) {
  if (props.selectionMode) return;
  event?.preventDefault();
  event?.stopPropagation();
  clearLongPressTimer();
  clearNativeTextSelection();
  stopSuppressingNativeSelection();
  emit('long-press', props.message);
}

function handleBubbleClick(event: MouseEvent) {
  if (longPressTriggered) {
    longPressTriggered = false;
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (props.selectionMode) emit('toggle-select');
  else if (props.message.theaterLink || props.message.commerce || props.message.shopShare) emit('open-card-detail', props.message);
  else if (props.message.gobang) emit('open-gobang', props.message);
}

function stopVoicePlayback() {
  if (activeVoiceAudio) {
    activeVoiceAudio.pause();
    activeVoiceAudio.onended = null;
    activeVoiceAudio.onerror = null;
  }
  activeVoiceAudio = null;
  playingVoice.value = false;
}

function toggleVoiceTranscript() {
  if (props.selectionMode) {
    emit('toggle-select');
    return;
  }
  showVoiceTranscript.value = !showVoiceTranscript.value;
}

function playVoiceAudio(audioUrl: string) {
  stopVoicePlayback();
  const audio = new Audio(audioUrl);
  activeVoiceAudio = audio;
  playingVoice.value = true;
  audio.onended = stopVoicePlayback;
  audio.onerror = () => {
    stopVoicePlayback();
    emit('busy-action', '当前浏览器无法播放这条语音。', '播放失败');
  };
  void audio.play().catch(() => {
    stopVoicePlayback();
    emit('busy-action', '当前浏览器阻止了语音播放，请再点一次播放按钮。', '播放失败');
  });
}

async function resolveVoiceAudioUrl() {
  const audioUrl = props.message.voice?.audioUrl;
  if (audioUrl) return audioUrl;
  if (!canGenerateVoiceAudio.value) throw new Error('这条语音没有可播放的本地录音。');
  voiceLoading.value = true;
  try {
    return await store.generateMessageVoiceAudio(props.message.id);
  } finally {
    voiceLoading.value = false;
  }
}

async function handleVoicePlayback() {
  if (props.selectionMode) {
    emit('toggle-select');
    return;
  }
  if (activeVoiceAudio && !activeVoiceAudio.paused) {
    stopVoicePlayback();
    return;
  }

  try {
    playVoiceAudio(await resolveVoiceAudioUrl());
  } catch (error) {
    stopVoicePlayback();
    emit('busy-action', error instanceof Error ? error.message : '语音生成失败，请检查 TTS 配置。', '播放失败');
  }
}

function openImageModal() {
  if (!props.message.image || props.message.sender !== 'char') return;
  if (props.selectionMode) {
    emit('toggle-select');
    return;
  }
  imageDescriptionDraft.value = props.message.image.description;
  selectedCandidateId.value = imageCandidates.value.find((candidate) => candidate.image === props.message.image?.url)?.id ?? imageCandidates.value[0]?.id ?? '';
  imageFlipped.value = !props.message.image.url;
  showImageModal.value = true;
}

function handleImageCardClick(event: MouseEvent) {
  if (props.message.sender !== 'char') return;
  event.stopPropagation();
  openImageModal();
}

function selectCandidate(candidateId: string) {
  selectedCandidateId.value = candidateId;
  imageFlipped.value = false;
}

function toggleImageFlip() {
  imageFlipped.value = !imageFlipped.value;
}

function isBrokenImageSource(source: string | undefined) {
  return Boolean(source && brokenImageSources.value.includes(source));
}

function markBrokenImageSource(source: string | undefined) {
  if (!source || brokenImageSources.value.includes(source)) return;
  brokenImageSources.value = [...brokenImageSources.value, source];
}

function regenerateImage() {
  const description = imageDescriptionDraft.value.trim();
  if (!description) return;
  if (props.regeneratingImage) {
    emit('busy-action', '正在重新生成聊天图片，请等待当前生成完成。', '正在生成');
    return;
  }
  emit('regenerate-image', props.message.id, description);
  imageFlipped.value = false;
}

function applySelectedCandidate() {
  if (props.regeneratingImage) {
    emit('busy-action', '正在重新生成聊天图片，请等待当前生成完成。', '正在生成');
    return;
  }
  if (!selectedCandidate.value || !canApplySelectedCandidate.value) return;
  emit('apply-image', props.message.id, selectedCandidate.value.id);
}

async function downloadCurrentImage() {
  if (!modalImageSrc.value) return;
  try {
    await downloadImageUrl(modalImageSrc.value, `link-chat-image-${props.message.id}`);
  } catch (error) {
    emit('busy-action', error instanceof Error ? error.message : '图片下载失败。', '下载失败');
  }
}

watch(() => props.message.image?.url, () => {
  if (!showImageModal.value) return;
  selectedCandidateId.value = imageCandidates.value.find((candidate) => candidate.image === props.message.image?.url)?.id ?? selectedCandidateId.value;
  imageFlipped.value = false;
});

watch(() => props.message.voice?.audioUrl, stopVoicePlayback);
watch(() => props.message.id, () => {
  showVoiceTranscript.value = true;
  voiceLoading.value = false;
  stopVoicePlayback();
});
watch([() => props.message.mode, () => props.message.quote, quoteText], async () => {
  await nextTick();
  observeQuoteOverflow();
}, { flush: 'post' });

onMounted(observeQuoteOverflow);

onBeforeUnmount(() => {
  if (avatarClickTimer !== undefined) window.clearTimeout(avatarClickTimer);
  cancelAvatarLongPress();
  quoteResizeObserver?.disconnect();
  stopVoicePlayback();
  stopSuppressingNativeSelection();
});
</script>

<style scoped>
.message-row {
  position: relative;
  display: flex;
  gap: 10px;
  margin: 7px 0;
}

.message-row.user {
  justify-content: flex-end;
}

.message-row.user .avatar-button {
  order: 2;
}

.message-row.system {
  justify-content: center;
}

.message-row.selecting {
  padding-left: 30px;
}

.message-row.user.selecting {
  padding-right: 30px;
  padding-left: 0;
}

.selection-dot {
  position: absolute;
  left: 2px;
  top: 50%;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1px solid rgba(20, 20, 20, 0.18);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.94);
}

.message-row.user .selection-dot {
  right: 2px;
  left: auto;
}

.selection-dot span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: transparent;
}

.message-row.selected .selection-dot span {
  background: var(--link-green);
}

.avatar-button {
  position: relative;
  display: block;
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  line-height: 0;
  touch-action: manipulation;
}

.message-row.profile-alert .avatar-button {
  z-index: 1;
  overflow: visible;
}

.mind-state-hearts {
  position: absolute;
  top: -16px;
  right: -12px;
  width: 40px;
  height: 32px;
  pointer-events: none;
}

.mind-state-hearts svg {
  position: absolute;
  bottom: 0;
  display: block;
  overflow: visible;
  fill: rgba(255, 255, 255, 0.98);
  stroke: rgba(82, 91, 103, 0.62);
  stroke-width: 1.5px;
  filter: drop-shadow(0 2px 3px rgba(53, 61, 72, 0.42)) drop-shadow(0 0 2px rgba(255, 255, 255, 0.98));
  animation: mind-state-heart-drift 2.7s ease-in-out infinite;
}

.mind-state-hearts svg:nth-child(1) {
  left: 0;
  width: 11px;
  height: 11px;
  animation-delay: -1.55s;
}

.mind-state-hearts svg:nth-child(2) {
  left: 13px;
  width: 15px;
  height: 15px;
  animation-delay: -0.75s;
}

.mind-state-hearts svg:nth-child(3) {
  left: 28px;
  width: 10px;
  height: 10px;
  animation-delay: -0.1s;
}

@keyframes mind-state-heart-drift {
  0% {
    opacity: 0.38;
    transform: translateY(7px) scale(0.55);
  }

  22% {
    opacity: 0.98;
    transform: translateY(2px) scale(1);
  }

  72% {
    opacity: 0.7;
    transform: translateY(-10px) scale(0.9);
  }

  100% {
    opacity: 0.38;
    transform: translateY(-17px) scale(0.72);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mind-state-hearts svg {
    opacity: 0.88;
    animation: none;
    transform: none;
  }
}

.message-row.hide-avatar .avatar-button {
  visibility: hidden;
  pointer-events: none;
}

.mini {
  display: block;
  width: 32px;
  height: 32px;
}

.bubble-wrap {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 5px;
  min-width: 0;
  max-width: min(80%, 300px);
}

.message-row.user .bubble-wrap {
  order: 1;
  flex-direction: row-reverse;
}

.message-failed-indicator {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 18px;
  height: 18px;
  margin-bottom: 7px;
  border-radius: 50%;
  background: #f04444;
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  box-shadow: 0 2px 6px rgba(240, 68, 68, 0.28);
}

.bubble-stack {
  display: grid;
  gap: 6px;
  justify-items: start;
  max-width: 100%;
  min-width: 0;
  cursor: default;
  touch-action: pan-y;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
  transform: translate3d(var(--swipe-quote-offset, 0), 0, 0);
  transition: transform 0.18s ease;
}

.message-author-label {
  max-width: 100%;
  overflow: hidden;
  color: rgba(30, 34, 32, 0.52);
  font-size: 10px;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bubble-stack *,
.message-row img {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

.message-row img {
  -webkit-user-drag: none;
}

.bubble-stack.swiping {
  user-select: none;
  transition: none;
}

.swipe-quote-cue {
  position: absolute;
  right: -34px;
  top: 50%;
  z-index: 0;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #7a828b;
  opacity: 0;
  transform: translate3d(-8px, -50%, 0) scale(0.88);
  transition: opacity 0.16s ease, transform 0.16s ease, color 0.16s ease;
  pointer-events: none;
  box-shadow: 0 6px 18px rgba(17, 20, 24, 0.12);
}

.swipe-quote-cue.visible,
.swipe-quote-cue.ready {
  opacity: 1;
  transform: translate3d(0, -50%, 0) scale(1);
}

.swipe-quote-cue.ready {
  color: var(--link-green);
}

.message-row.user .bubble-stack {
  justify-items: end;
}

.message-row.selected .bubble-stack {
  border-radius: 16px;
  outline: 2px solid rgba(6, 199, 85, 0.38);
  outline-offset: 2px;
}

.bubble {
  min-width: 32px;
  max-width: 100%;
  padding: 7px 11px;
  border-radius: 15px;
  background: #ffffff;
  color: #111111;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.4;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
}

.bubble > span {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.message-row.user .bubble {
  background: #5ce46f;
}

.message-row.system .bubble {
  background: rgba(0, 0, 0, 0.08);
  color: #ffffff;
  font-size: 11px;
}

.message-row.system .bubble.narration {
  background: rgba(17, 17, 17, 0.06);
  color: #5f6872;
}

.bubble.narration {
  background: rgba(255, 255, 255, 0.7);
  color: #47515a;
  font-style: italic;
}

.bubble.sticker {
  min-width: 0;
  padding: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.bubble.image {
  min-width: 0;
  padding: 0;
  border-radius: 16px;
  background: transparent;
  box-shadow: none;
}

.bubble.voice {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid rgba(17, 17, 17, 0.05);
  box-shadow: 0 8px 24px rgba(17, 20, 24, 0.08);
}

.bubble.location,
.bubble.transfer,
.bubble.commerce,
.bubble.musicListenInvite,
.bubble.linkPreview,
.bubble.theaterLink,
.bubble.gobang {
  padding: 0;
  overflow: hidden;
  border-radius: 10px;
  color: #111111;
  box-shadow: none;
}

.bubble.location {
  width: min(188px, 55vw);
  min-width: min(168px, 49vw);
  background: #ffffff;
  border: 0;
  box-shadow: 0 9px 22px rgba(22, 27, 33, 0.08);
}

.bubble.location .line-location-card {
  grid-template-rows: 70px auto 23px;
  width: 100%;
  box-shadow: none;
}

.bubble.location .line-location-map {
  height: 70px;
  min-height: 70px;
}

.bubble.location .line-location-body {
  gap: 2px;
  padding: 5px 7px 6px;
}

.bubble.location .line-location-footer {
  min-height: 23px;
  padding: 0 6px;
}

.bubble.transfer {
  width: min(178px, 52vw);
  min-width: min(158px, 46vw);
  background: #ffffff;
  border: 0;
  box-shadow: 0 9px 22px rgba(22, 27, 33, 0.08);
}

.bubble.commerce {
  width: min(218px, 64vw);
  min-width: min(194px, 56vw);
  background: #ffffff;
  border: 0;
  box-shadow: 0 10px 25px rgba(53, 43, 46, 0.1);
}

.bubble.musicListenInvite {
  width: min(196px, 58vw);
  min-width: min(172px, 50vw);
  background: #ffffff;
  border: 0;
  box-shadow: 0 9px 22px rgba(22, 27, 33, 0.08);
}

.bubble.linkPreview {
  width: min(236px, 70vw);
  min-width: min(204px, 60vw);
  background: #ffffff;
  border: 0;
  box-shadow: 0 9px 22px rgba(22, 27, 33, 0.08);
}

.bubble.theaterLink {
  width: min(222px, 64vw);
  min-width: min(189px, 55vw);
  background: #ffffff;
  border: 0;
  box-shadow: 0 9px 22px rgba(22, 27, 33, 0.08);
}

.bubble.offlineInvitation {
  width: min(196px, 58vw);
  min-width: min(178px, 52vw);
  padding: 0;
  overflow: hidden;
  border-radius: 14px;
  background: #ffffff;
  color: #202329;
  border: 1px solid #e6e8eb;
  box-shadow: 0 8px 20px rgba(17, 20, 24, 0.06);
}

.bubble.call {
  width: min(176px, 52vw);
  min-width: min(154px, 46vw);
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 13px;
  background: transparent;
  box-shadow: none;
}

.bubble.gobang {
  width: min(178px, 52vw);
  min-width: min(158px, 46vw);
  background: transparent;
  border: 0;
  box-shadow: 0 10px 24px rgba(72, 45, 27, 0.13);
}

.message-row.user .bubble.location,
.message-row.char .bubble.location,
.message-row.user .bubble.transfer,
.message-row.char .bubble.transfer,
.message-row.user .bubble.commerce,
.message-row.char .bubble.commerce,
.message-row.user .bubble.musicListenInvite,
.message-row.char .bubble.musicListenInvite,
.message-row.user .bubble.linkPreview,
.message-row.char .bubble.linkPreview,
.message-row.user .bubble.theaterLink,
.message-row.char .bubble.theaterLink,
.message-row.user .bubble.gobang,
.message-row.char .bubble.gobang,
.message-row.char .bubble.offlineInvitation,
.message-row.system .bubble.offlineInvitation {
  color: #111111;
}

.message-row.user .bubble.location,
.message-row.char .bubble.location {
  background: #ffffff;
}

.message-row.user .bubble.transfer,
.message-row.char .bubble.transfer,
.message-row.user .bubble.commerce,
.message-row.char .bubble.commerce,
.message-row.user .bubble.musicListenInvite,
.message-row.char .bubble.musicListenInvite,
.message-row.user .bubble.linkPreview,
.message-row.char .bubble.linkPreview,
.message-row.user .bubble.theaterLink,
.message-row.char .bubble.theaterLink,
.message-row.user .bubble.gobang,
.message-row.char .bubble.gobang {
  background: #ffffff;
}

.gobang-message-card {
  display: grid;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  padding: 7px;
  border: 1px solid rgba(95, 58, 31, 0.14);
  border-radius: inherit;
  background:
    radial-gradient(circle at 85% 8%, rgba(255, 255, 255, 0.72), transparent 24%),
    linear-gradient(145deg, #fffdf9, #f7ead8);
  color: #2d241e;
  cursor: pointer;
}

.gobang-message-head,
.gobang-message-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.gobang-message-head > span,
.gobang-message-footer > span {
  display: grid;
  min-width: 0;
}

.gobang-message-head small {
  color: #a36e45;
  font-size: 7px;
  font-weight: 950;
  letter-spacing: 0.11em;
}

.gobang-message-head strong {
  font-size: 11px;
  font-weight: 950;
  letter-spacing: -0.03em;
}

.gobang-message-head em {
  padding: 3px 5px;
  border-radius: 999px;
  background: rgba(160, 101, 57, 0.11);
  color: #8c5b36;
  font-size: 7px;
  font-style: normal;
  font-weight: 950;
}

.gobang-message-card--user-won .gobang-message-head em { background: #e5f6eb; color: #14843f; }
.gobang-message-card--char-won .gobang-message-head em,
.gobang-message-card--resigned .gobang-message-head em { background: #f0ebed; color: #79636b; }
.gobang-message-card--api-failed .gobang-message-head em { background: #ffe8eb; color: #b73347; }

.gobang-message-board {
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  width: 100%;
  padding: 5px;
  border: 1px solid rgba(95, 58, 31, 0.22);
  border-radius: 7px;
  background: linear-gradient(145deg, #e9c18d, #d49c58);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.42);
}

.gobang-message-point {
  position: relative;
  aspect-ratio: 1;
}

.gobang-message-point::before,
.gobang-message-point::after {
  position: absolute;
  z-index: 0;
  background: rgba(83, 50, 27, 0.56);
  content: '';
}

.gobang-message-point::before { inset: calc(50% - 0.5px) 0 auto; height: 1px; }
.gobang-message-point::after { inset: 0 auto 0 calc(50% - 0.5px); width: 1px; }

.gobang-message-point > span {
  position: absolute;
  z-index: 1;
  inset: 8%;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(43, 27, 17, 0.3);
}

.gobang-message-stone--black { background: radial-gradient(circle at 34% 27%, #5c5b61, #202025 58%, #08080a); }
.gobang-message-stone--white { border: 1px solid rgba(90, 69, 50, 0.16); background: radial-gradient(circle at 34% 27%, #fff, #eee9e2 64%, #d0c8be); }
.gobang-message-point > span.latest::after {
  position: absolute;
  inset: 38%;
  border-radius: 50%;
  background: #ed586b;
  content: '';
}

.gobang-message-footer strong,
.gobang-message-footer small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gobang-message-footer strong { color: #332a24; font-size: 9px; font-weight: 930; }
.gobang-message-footer small { color: #8b7c70; font-size: 7px; font-weight: 720; }
.gobang-message-footer svg { flex: 0 0 auto; color: #9e7557; }

.call-message-card {
  --call-accent: #ff8fb0;
  --call-accent-soft: #fff3f6;
  --call-accent-ink: #b85072;
  position: relative;
  display: grid;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  padding: 8px;
  border-radius: inherit;
  border: 1px solid rgba(226, 228, 232, 0.92);
  background: #ffffff;
  color: #191a1f;
  box-shadow: 0 8px 18px rgba(20, 23, 30, 0.07);
}

.call-message-card--video {
  --call-accent: #8ea2ff;
  --call-accent-soft: #f3f5ff;
  --call-accent-ink: #596aca;
}

.call-message-head {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.call-message-media {
  position: relative;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  overflow: hidden;
  border-radius: 10px;
  background: #f4f5f7;
  box-shadow: inset 0 0 0 1px rgba(222, 225, 230, 0.84);
}

.call-message-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.call-message-identity {
  display: grid;
  align-content: center;
  gap: 1px;
  min-width: 0;
}

.call-message-identity small {
  min-width: 0;
  overflow: hidden;
  color: #8b8f98;
  font-size: 8px;
  font-weight: 760;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-message-identity strong {
  min-width: 0;
  overflow: hidden;
  color: #1d1f25;
  font-size: 11px;
  font-weight: 860;
  letter-spacing: 0;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-message-meta {
  display: grid;
  gap: 3px;
  min-width: 0;
  padding: 6px 7px;
  border-radius: 10px;
  background: #f8f9fb;
}

.call-message-meta em {
  color: var(--call-accent-ink);
  font-size: 8px;
  font-style: normal;
  font-weight: 820;
  line-height: 1.2;
}

.call-message-meta span {
  min-width: 0;
  overflow: hidden;
  color: #676c75;
  font-size: 9px;
  font-weight: 620;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-message-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
  min-width: 0;
  padding-top: 1px;
}

.call-message-action {
  display: grid;
  min-width: 0;
  min-height: 24px;
  place-items: center;
  border: 0;
  border-radius: 8px;
  font-size: 9px;
  font-weight: 820;
  line-height: 1;
}

.call-message-action--reject {
  background: #f1f2f4;
  color: #666b74;
  box-shadow: none;
}

.call-message-action--accept {
  background: #1d1f25;
  color: #ffffff;
  box-shadow: 0 8px 16px rgba(20, 23, 30, 0.14);
}

.listen-invite-card {
  position: relative;
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) auto;
  gap: 7px;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(226, 59, 88, 0.12);
  border-radius: inherit;
  background: linear-gradient(135deg, #ffffff 0%, #fff8fa 58%, #f7fbf9 100%);
  color: #111111;
  padding: 8px;
  box-shadow: 0 8px 18px rgba(226, 59, 88, 0.06);
}

.listen-invite-card::before {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 21px 21px, rgba(226, 59, 88, 0.13), transparent 36px),
    linear-gradient(135deg, rgba(255, 255, 255, 0.58), transparent 58%);
  content: '';
  pointer-events: none;
}

.listen-invite-disc,
.listen-invite-copy,
.listen-invite-chip,
.listen-invite-actions {
  position: relative;
  z-index: 1;
}

.listen-invite-disc {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, #ffffff 0 9px, transparent 10px),
    repeating-radial-gradient(circle, rgba(226, 59, 88, 0.10) 0 1px, rgba(255, 255, 255, 0.78) 2px 5px),
    linear-gradient(135deg, #fff3f6, #eef9f3);
  color: #e23b58;
  box-shadow: inset 0 0 0 1px rgba(226, 59, 88, 0.15), 0 6px 14px rgba(226, 59, 88, 0.10);
}

.listen-invite-disc img {
  width: 72%;
  height: 72%;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 2px 8px rgba(17, 20, 24, 0.10);
}

.listen-invite-disc svg {
  width: 16px;
  height: 16px;
  color: #c58a98;
  stroke-width: 1.8;
}

.listen-invite-copy {
  display: grid;
  align-content: center;
  gap: 2px;
  min-width: 0;
}

.listen-invite-copy small,
.listen-invite-copy span {
  min-width: 0;
  overflow: hidden;
  color: #737983;
  font-size: 8px;
  font-weight: 760;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listen-invite-copy strong {
  min-width: 0;
  overflow: hidden;
  color: #101010;
  font-size: 11px;
  font-weight: 930;
  line-height: 1.18;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listen-invite-chip {
  align-self: start;
  padding: 3px 5px;
  border-radius: 999px;
  background: #fff0f2;
  color: #d72f4e;
  font-size: 7px;
  font-weight: 920;
  line-height: 1;
  white-space: nowrap;
}

.listen-invite-card--accepted .listen-invite-chip {
  background: #effaf3;
  color: #05883f;
}

.listen-invite-card--rejected .listen-invite-chip {
  background: #f2f3f5;
  color: #6a737d;
}

.listen-invite-actions {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.listen-invite-actions button {
  min-height: 25px;
  border: 0;
  border-radius: 8px;
  background: #f0f1f3;
  color: #24272d;
  font-size: 9px;
  font-weight: 930;
}

.listen-invite-actions button:last-child {
  background: #e23b58;
  color: #ffffff;
  box-shadow: 0 8px 16px rgba(226, 59, 88, 0.18);
}

.offline-invitation-message {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 10px;
}

.offline-invitation-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.offline-invitation-copy span {
  color: #69717b;
  font-size: 10px;
  font-weight: 860;
}

.offline-invitation-copy strong {
  color: #202329;
  font-size: 12px;
  font-weight: 930;
  line-height: 1.28;
}

.offline-invitation-copy small {
  color: #69717b;
  font-size: 10px;
  font-weight: 720;
  line-height: 1.36;
}

.offline-invitation-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.offline-invitation-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 28px;
  border: 0;
  border-radius: 9px;
  background: #f0f2f5;
  color: #333943;
  font-size: 11px;
  font-weight: 860;
}

.offline-invitation-actions button:last-child {
  background: #dfe3e8;
  color: #202329;
}

.line-location-card {
  display: grid;
  grid-template-rows: 70px auto 23px;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: inherit;
  background: #ffffff;
  color: #111111;
}

.line-location-map {
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

.line-location-map::after {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(180deg, transparent 54%, rgba(255, 255, 255, 0.1));
  content: '';
  pointer-events: none;
}

.line-map-road {
  position: absolute;
  display: block;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 0 0 1px rgba(222, 225, 229, 0.86);
}

.line-map-road-1 {
  left: -15px;
  top: 15px;
  width: 119px;
  height: 7px;
  transform: rotate(-27deg);
}

.line-map-road-2 {
  right: -12px;
  top: 20px;
  width: 103px;
  height: 7px;
  transform: rotate(12deg);
}

.line-map-road-3 {
  left: 40px;
  top: 39px;
  width: 106px;
  height: 7px;
  transform: rotate(-38deg);
}

.line-map-road-4 {
  left: 97px;
  top: 29px;
  width: 90px;
  height: 7px;
  transform: rotate(82deg);
}

.line-map-block {
  position: absolute;
  display: block;
  border: 1px solid rgba(222, 225, 229, 0.9);
  border-radius: 3px;
  background: rgba(246, 247, 248, 0.88);
}

.line-map-block-1 {
  left: 10px;
  top: 4px;
  width: 42px;
  height: 23px;
  transform: rotate(14deg);
}

.line-map-block-2 {
  right: 13px;
  top: 3px;
  width: 51px;
  height: 25px;
  transform: rotate(-6deg);
}

.line-map-block-3 {
  right: 5px;
  bottom: 6px;
  width: 51px;
  height: 24px;
  transform: rotate(-18deg);
}

.line-map-label {
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

.line-map-label-top {
  right: 21px;
  top: 8px;
}

.line-map-label-mid {
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

.line-map-pin {
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

.line-map-pin::after {
  position: absolute;
  left: 5px;
  top: 5px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ffffff;
  content: '';
}

.line-map-pin-main {
  left: 50%;
  top: 35px;
  transform: translate(-50%, -50%) rotate(-45deg);
}

.line-map-pin-secondary {
  right: 15px;
  bottom: 10px;
  width: 14px;
  height: 14px;
  background: #5f7180;
}

.line-map-pin-secondary::after {
  left: 4px;
  top: 4px;
  width: 6px;
  height: 6px;
}

.line-map-google {
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

.line-map-google span:nth-child(1),
.line-map-google span:nth-child(4) {
  color: #4285f4;
}

.line-map-google span:nth-child(2),
.line-map-google span:nth-child(6) {
  color: #db4437;
}

.line-map-google span:nth-child(3) {
  color: #f4b400;
}

.line-map-google span:nth-child(5) {
  color: #0f9d58;
}

.line-location-body {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 5px 7px 6px;
  background: #ffffff;
}

.line-location-kicker {
  color: #04a64b;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1.05;
  text-transform: uppercase;
}

.line-location-body strong {
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

.line-location-detail-address {
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

.line-location-footer {
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

.line-location-footer > span:nth-child(2) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.line-location-footer-mark {
  position: relative;
  display: block;
  width: 11px;
  height: 11px;
  border-radius: 50% 50% 50% 0;
  background: #04c755;
  transform: rotate(-45deg);
}

.line-location-footer-mark::after {
  position: absolute;
  left: 3px;
  top: 3px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #ffffff;
  content: '';
}

.line-location-chevron {
  width: 5px;
  height: 5px;
  border-top: 2px solid #c6c6c6;
  border-right: 2px solid #c6c6c6;
  transform: rotate(45deg);
}

.line-website-card {
  display: grid;
  grid-template-columns: 39px minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
  padding: 8px;
  border: 1px solid rgba(12, 20, 28, 0.08);
  border-radius: inherit;
  background: #ffffff;
  color: #111111;
  cursor: pointer;
}

.line-website-thumb {
  display: grid;
  place-items: center;
  width: 39px;
  height: 39px;
  border-radius: 8px;
  background: linear-gradient(135deg, #effaf3, #edf3ff);
  color: #04a64b;
}

.line-website-thumb svg {
  width: 18px;
  height: 18px;
}

.line-website-body {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.line-website-kicker {
  color: #04a64b;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1.05;
  text-transform: uppercase;
}

.line-website-body strong,
.line-website-body small,
.line-website-body em {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.line-website-body strong {
  color: #101010;
  font-size: 11px;
  font-weight: 930;
  line-height: 1.25;
  white-space: nowrap;
}

.line-website-body small {
  display: -webkit-box;
  color: #5f6670;
  font-size: 9px;
  font-weight: 650;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.line-website-body em {
  color: #8d949c;
  font-size: 9px;
  font-style: normal;
  font-weight: 760;
  line-height: 1.2;
  white-space: nowrap;
}

.chat-link-preview-message {
  display: grid;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(12, 20, 28, 0.08);
  border-radius: inherit;
  background: #ffffff;
  color: #111111;
}

.chat-link-preview-caption {
  margin: 0;
  padding: 9px 10px 3px;
  color: #22252a;
  font-size: 11px;
  font-weight: 650;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.chat-link-preview-card {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 9px;
  min-width: 0;
  padding: 8px;
  color: inherit;
  text-decoration: none;
}

.chat-link-preview-visual {
  display: block;
  width: 72px;
  height: 72px;
  overflow: hidden;
  border-radius: 12px;
  background: linear-gradient(145deg, #eef8f2, #f0f2fa);
}

.chat-link-preview-visual img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-link-preview-placeholder {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  color: #4c7a62;
}

.platform-xiaohongshu .chat-link-preview-placeholder { color: #d74c66; background: linear-gradient(145deg, #fff0f4, #fff9fa); }
.platform-douyin .chat-link-preview-placeholder { color: #131419; background: linear-gradient(145deg, #ebfbff, #fff0f5); }
.platform-taobao .chat-link-preview-placeholder { color: #f06422; background: linear-gradient(145deg, #fff1e7, #fff8f3); }

.chat-link-preview-copy {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  align-content: start;
  gap: 3px;
  min-width: 0;
}

.chat-link-preview-copy small {
  overflow: hidden;
  color: #4b765f;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-xiaohongshu .chat-link-preview-copy small { color: #d64a65; }
.platform-douyin .chat-link-preview-copy small { color: #31343b; }
.platform-taobao .chat-link-preview-copy small { color: #e45c1b; }

.chat-link-preview-copy strong {
  display: -webkit-box;
  overflow: hidden;
  color: #111318;
  font-size: 11px;
  font-weight: 930;
  line-height: 1.28;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.chat-link-preview-copy > span {
  display: -webkit-box;
  overflow: hidden;
  color: #656c74;
  font-size: 8px;
  font-weight: 620;
  line-height: 1.35;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.chat-link-preview-copy em {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
  color: #969ca3;
  font-size: 8px;
  font-style: normal;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-link-preview-copy em svg { flex: none; }

.transfer-request-card {
  display: grid;
  min-width: 0;
  overflow: hidden;
  border-radius: inherit;
  background: #ffffff;
  color: #111111;
  border: 1px solid rgba(12, 20, 28, 0.08);
}

.transfer-request-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
  min-width: 0;
  padding: 7px 8px 6px;
}

.transfer-request-brand {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: #22272d;
  font-size: 9px;
  font-weight: 920;
  line-height: 1;
}

.transfer-request-mark {
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border-radius: 5px;
  background: #04c755;
  color: #ffffff;
  font-size: 9px;
  font-weight: 950;
}

.transfer-request-chip {
  flex: 0 0 auto;
  padding: 3px 5px;
  border-radius: 999px;
  background: #effaf3;
  color: #05883f;
  font-size: 8px;
  font-weight: 900;
  line-height: 1;
}

.transfer-request-card--rejected .transfer-request-chip {
  background: #f2f3f5;
  color: #6a737d;
}

.transfer-request-main {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 9px 8px 10px;
  background:
    linear-gradient(135deg, rgba(4, 199, 85, 0.16), rgba(4, 199, 85, 0.04) 72%),
    #f8fffa;
}

.transfer-request-main small {
  color: #168447;
  font-size: 8px;
  font-weight: 920;
  line-height: 1;
}

.transfer-request-main strong {
  min-width: 0;
  color: #101713;
  font-size: 24px;
  font-weight: 950;
  letter-spacing: 0;
  line-height: 1;
  overflow-wrap: anywhere;
}

.transfer-request-main span {
  min-width: 0;
  color: #44504a;
  font-size: 9px;
  font-weight: 760;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.transfer-request-note {
  display: block;
  min-width: 0;
  min-height: 24px;
  padding: 6px 8px;
  background: #ffffff;
  color: #737983;
  font-size: 9px;
  font-weight: 680;
  line-height: 1.35;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.transfer-request-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
  min-width: 0;
  padding: 7px 8px 8px;
}

.transfer-request-action {
  display: grid;
  place-items: center;
  min-width: 0;
  min-height: 26px;
  border: 0;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 930;
  line-height: 1;
}

.transfer-request-action--reject {
  background: #f0f1f3;
  color: #24272d;
}

.transfer-request-action--accept {
  background: #04c755;
  color: #ffffff;
  box-shadow: 0 8px 16px rgba(4, 199, 85, 0.2);
}

.commerce-order-card {
  display: grid;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(89, 66, 74, 0.09);
  border-radius: inherit;
  background: #fffdfc;
  color: #4f4548;
}

.commerce-order-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 9px 7px;
}

.commerce-order-brand {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: #766368;
  font-size: 8px;
  font-weight: 930;
  letter-spacing: 0.08em;
}

.commerce-order-brand i {
  display: grid;
  place-items: center;
  width: 19px;
  height: 19px;
  border-radius: 7px;
  background: #efe1e4;
  font-size: 11px;
  font-style: normal;
}

.commerce-order-card--takeout .commerce-order-brand i { background: #efe1d6; }
.commerce-order-card--shopping .commerce-order-brand i { background: #e3e8e4; }

.commerce-order-chip {
  flex: 0 0 auto;
  padding: 3px 6px;
  border-radius: 999px;
  background: #eef5f0;
  color: #66806e;
  font-size: 7px;
  font-weight: 900;
}

.commerce-order-main {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  padding: 10px 9px;
  background: linear-gradient(145deg, #f0dfe3, #f4ebe4);
}

.commerce-order-card--takeout .commerce-order-main { background: linear-gradient(145deg, #ead7c8, #f4e7da); }
.commerce-order-card--shopping .commerce-order-main { background: linear-gradient(145deg, #e3ded6, #dfe8e3); }

.commerce-order-visual {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.5);
  font-size: 26px;
}

.commerce-order-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.commerce-order-copy small {
  color: #8c737a;
  font-size: 7px;
  font-weight: 900;
}

.commerce-order-copy strong {
  overflow: hidden;
  color: #53464a;
  font-family: Georgia, serif;
  font-size: 13px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.commerce-order-copy em {
  display: -webkit-box;
  color: #88797d;
  font-size: 7px;
  font-style: normal;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.commerce-order-payment {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 9px;
}

.commerce-order-payment > span:first-child {
  display: grid;
  gap: 2px;
}

.commerce-order-payment small {
  color: #9a8d90;
  font-size: 7px;
}

.commerce-order-payment strong {
  color: #57494d;
  font-family: Georgia, serif;
  font-size: 15px;
}

.commerce-order-payment > span:last-child {
  display: inline-flex;
  align-items: center;
  color: #728279;
  font-size: 7px;
  font-weight: 850;
}

.commerce-order-note {
  margin: 0 9px 9px;
  padding: 7px 8px;
  border-radius: 11px;
  background: #f6f0ee;
  color: #8b777d;
  font-family: Georgia, serif;
  font-size: 8px;
  line-height: 1.45;
}

.voice-message {
  display: grid;
  grid-template-columns: minmax(28px, 1fr) 28px 22px;
  align-items: center;
  justify-content: stretch;
  gap: 4px;
  width: min(var(--voice-width), 48vw);
  min-width: 98px;
  max-width: 144px;
  min-height: 32px;
  padding: 0 4px 0 8px;
  border-radius: 999px;
  color: inherit;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.04));
  cursor: pointer;
}

.voice-message.playing .voice-wave span {
  animation: voice-wave 0.72s ease-in-out infinite;
  animation-delay: calc(var(--voice-bar-index, 0) * 0.05s);
}

.voice-wave {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.voice-wave span {
  flex: 0 0 2px;
  width: 2px;
  height: 7px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.5;
}

.voice-wave span:nth-child(6n+2) {
  height: 12px;
}

.voice-wave span:nth-child(6n+3) {
  height: 15px;
}

.voice-wave span:nth-child(6n+4) {
  height: 10px;
}

.voice-wave span:nth-child(6n+5) {
  height: 13px;
}

.voice-wave span:nth-child(6n) {
  height: 9px;
}

.voice-duration {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  min-width: 28px;
  font-size: 11px;
  font-weight: 760;
  line-height: 1;
  opacity: 0.68;
}

.voice-play-button {
  display: grid;
  place-items: center;
  width: 22px;
  min-width: 22px;
  height: 22px;
  min-height: 22px;
  padding: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.34);
  color: currentColor;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.22);
}

.voice-play-button:disabled {
  opacity: 0.45;
}

.voice-loading-icon {
  animation: chat-image-spin 0.8s linear infinite;
}

.voice-transcript {
  width: fit-content;
  max-width: min(100%, 260px);
  margin: -1px 0 0;
  padding: 7px 9px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.78);
  color: #59606a;
  box-shadow: 0 1px 0 rgba(17, 17, 17, 0.04);
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.message-row.user .voice-transcript {
  background: rgba(255, 255, 255, 0.68);
  color: #3d4b42;
}

@keyframes voice-wave {
  0%,
  100% {
    transform: scaleY(0.78);
  }

  50% {
    transform: scaleY(1.16);
  }
}

.quote-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 5px;
  width: fit-content;
  max-width: 100%;
  min-height: 26px;
  padding: 5px 8px;
  border-radius: 8px;
  background: #f7f8f9;
  color: #a9afb6;
  box-shadow: none;
}

.quote-card p {
  min-width: 0;
  margin: 0;
  overflow: visible;
  overflow-wrap: break-word;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
  text-overflow: clip;
  white-space: pre-wrap;
}

.quote-card--online p {
  max-height: 2.6em;
  max-height: 2lh;
  overflow: hidden;
}

.quote-card--online.quote-card--overflowing p {
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 52%, transparent 100%);
  mask-image: linear-gradient(to bottom, #000 0%, #000 52%, transparent 100%);
}

.quote-card strong {
  color: #9ba2aa;
  font-weight: 760;
}

.quote-card span {
  color: #aeb4bb;
}

.quote-thumbnail {
  display: block;
  width: 28px;
  height: 28px;
  border-radius: 5px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.7);
}

.translation-divider {
  display: block;
  width: 100%;
  margin: 7px 0 6px;
  border-top: 1px dashed currentColor;
  opacity: 0.3;
}

.translation-copy {
  display: block;
}

.message-html-content {
  display: block;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.message-html-content :deep(p),
.message-html-content :deep(ul),
.message-html-content :deep(ol),
.message-html-content :deep(blockquote),
.message-html-content :deep(pre),
.message-html-content :deep(details),
.message-html-content :deep(h1),
.message-html-content :deep(h2),
.message-html-content :deep(h3),
.message-html-content :deep(h4),
.message-html-content :deep(h5),
.message-html-content :deep(h6),
.message-html-content :deep(hr) {
  margin: 0 0 0.55em;
}

.message-html-content :deep(:last-child) {
  margin-bottom: 0;
}

.message-html-content :deep(summary) {
  cursor: pointer;
  font-weight: 850;
}

.message-html-content :deep(ul),
.message-html-content :deep(ol) {
  padding-left: 1.35em;
}

.message-html-content :deep(pre),
.message-html-content :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.message-html-content :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre-wrap;
}

.message-html-content :deep(a) {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.message-row.user .bubble.sticker {
  background: transparent;
}

.sticker-image {
  display: block;
  width: auto;
  height: auto;
  max-width: min(104px, 30vw);
  max-height: min(120px, 28vh);
  border-radius: 10px;
  object-fit: scale-down;
  background: transparent;
}

.chat-image-card {
  display: grid;
  width: min(154px, 44vw);
  max-width: 100%;
  margin: 0;
  overflow: hidden;
  border: 1px solid #edf0f2;
  border-radius: 16px;
  background: #ffffff;
  color: #222222;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
}

.chat-image-card.interactive {
  cursor: zoom-in;
}

.chat-image-card img {
  display: block;
  width: 100%;
  aspect-ratio: var(--chat-image-ratio, 1 / 1);
  object-fit: contain;
  background: #f4f5f6;
}

.chat-image-card figcaption {
  margin: 0;
  padding: 10px 11px;
  font-size: 12px;
  font-weight: 760;
  line-height: 1.45;
  white-space: pre-wrap;
}

.chat-image-card--description {
  aspect-ratio: 1 / 1;
  place-items: center;
  padding: 12px;
  background: #ffffff;
  transform-style: preserve-3d;
}

.chat-image-card--description figcaption {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  padding: 0;
  font-size: 11px;
  font-weight: 820;
  line-height: 1.45;
  text-align: center;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.image-viewer {
  display: grid;
  gap: 12px;
}

.image-flip-card {
  position: relative;
  width: 100%;
  aspect-ratio: var(--chat-viewer-ratio, 1 / 1);
  padding: 0;
  border-radius: 18px;
  background: transparent;
  perspective: 1000px;
}

.image-face {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid #edf0f2;
  border-radius: 18px;
  background: #ffffff;
  backface-visibility: hidden;
  transition: transform 0.28s ease;
}

.image-picture-face {
  transform: rotateY(0deg);
}

.image-text-face {
  padding: 20px;
  transform: rotateY(180deg);
  color: #222222;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.65;
  text-align: center;
  white-space: pre-wrap;
}

.image-viewer.flipped .image-picture-face {
  transform: rotateY(180deg);
}

.image-viewer.flipped .image-text-face {
  transform: rotateY(360deg);
}

.image-picture-face img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #f4f5f6;
}

.image-picture-face > span {
  padding: 20px;
  color: #222222;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.65;
  text-align: center;
  white-space: pre-wrap;
}

.image-history {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.image-thumb {
  flex: 0 0 54px;
  width: 54px;
  height: 54px;
  padding: 2px;
  border: 2px solid transparent;
  border-radius: 10px;
  background: #f1f3f5;
}

.image-thumb.active {
  border-color: #171717;
  background: #ffffff;
}

.image-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 7px;
  object-fit: cover;
}

.image-description-field {
  display: grid;
  gap: 6px;
}

.image-description-field > span {
  color: #686b70;
  font-size: 12px;
  font-weight: 900;
}

.image-description-field textarea {
  min-height: 86px;
  padding: 10px;
  border: 1px solid #edf0f2;
  border-radius: 8px;
  background: #ffffff;
  color: #171717;
  font: inherit;
  line-height: 1.55;
  resize: vertical;
}

.image-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.image-secondary,
.image-primary {
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  min-height: 38px;
  padding-inline: 4px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 900;
  white-space: nowrap;
}

.image-secondary {
  background: #ffffff;
  color: #2b3036;
}

.image-primary {
  background: #171717;
  color: #ffffff;
}

.image-secondary:disabled,
.image-primary:disabled {
  opacity: 0.45;
  cursor: default;
}

.loading-icon {
  animation: chat-image-spin 0.8s linear infinite;
}

@keyframes chat-image-spin {
  to {
    transform: rotate(360deg);
  }
}

.message-meta {
  flex: 0 0 auto;
  display: grid;
  align-content: end;
  justify-items: start;
  gap: 2px;
  min-width: 32px;
  color: rgba(20, 20, 20, 0.45);
  font-size: 10px;
  line-height: 1.15;
}

.message-row.user .message-meta {
  justify-items: end;
}

time,
.read-state {
  color: inherit;
  font-size: inherit;
  line-height: inherit;
  white-space: nowrap;
}
.bubble.shopShare {
  width: min(218px, 64vw);
  min-width: min(194px, 56vw);
  max-width: min(218px, 64vw);
  padding: 0 !important;
  overflow: hidden;
  border-radius: 15px !important;
  background: transparent !important;
  box-shadow: 0 10px 25px rgba(53, 43, 46, 0.1) !important;
}

.shop-share-card {
  display: grid;
  width: 100%;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(111, 83, 92, 0.12);
  border-radius: 15px;
  background: linear-gradient(155deg, #fffaf8, #f4efed 62%, #edf2ee);
  color: #554a4e;
}

.shop-share-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
  min-width: 0;
  padding: 8px 9px 6px;
  color: #8f7780;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.shop-share-head > span {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  gap: 4px;
}

.shop-share-head i {
  font-size: 11px;
  font-style: normal;
}

.shop-share-head em {
  flex: 0 0 auto;
  padding: 3px 5px;
  border-radius: 999px;
  background: rgba(114, 88, 97, 0.08);
  font-size: 6px;
  font-style: normal;
}

.shop-share-main {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 2px 9px 9px;
}

.shop-share-main > img,
.shop-share-main > i {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 18px;
  background: linear-gradient(145deg, #eadde1, #e1e8e2);
  object-fit: cover;
  font-size: 26px;
  font-style: normal;
}

.shop-share-main > span {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.shop-share-main small {
  color: #a08d92;
  font-size: 7px;
  font-weight: 800;
}

.shop-share-main strong {
  display: -webkit-box;
  overflow: hidden;
  color: #4e4347;
  font-size: 13px;
  line-height: 1.25;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.shop-share-main em {
  display: -webkit-box;
  overflow: hidden;
  color: #8f8286;
  font-size: 7px;
  font-style: normal;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.shop-share-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 8px 9px;
  border-top: 1px solid rgba(111, 83, 92, 0.09);
  background: rgba(255, 255, 255, 0.48);
}

.shop-share-footer > span:first-child {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.shop-share-footer small {
  overflow: hidden;
  color: #9b8c90;
  font-size: 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shop-share-footer strong {
  color: #594b50;
  font-family: Georgia, serif;
  font-size: 10px;
}

.shop-share-footer > span:last-child {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 3px;
  color: #826d75;
  font-size: 7px;
  font-weight: 900;
}

.shop-share-note {
  margin: 0 8px 8px;
  padding: 6px 8px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.58);
  color: #836f76;
  font-family: Georgia, serif;
  font-size: 8px;
  line-height: 1.4;
}

.message-row.user .bubble.shopShare,
.message-row.char .bubble.shopShare {
  color: inherit !important;
}

.bubble.mcpResult {
  width: min(306px, 78vw);
  min-width: min(248px, 68vw);
  max-width: min(306px, 78vw);
  padding: 0 !important;
  overflow: hidden;
  border-radius: 17px !important;
  background: transparent !important;
  box-shadow: 0 12px 30px rgba(29, 47, 43, 0.12) !important;
}

.bubble.mcpOperation {
  width: min(306px, 78vw);
  max-width: min(306px, 78vw);
  padding: 3px 4px !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: #5f6872 !important;
  box-shadow: none !important;
}

.mcp-operation-text {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: inherit;
  font-size: 11px;
  font-style: italic;
  line-height: 1.55;
  text-align: center;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-decoration-color: rgba(95, 104, 114, 0.45);
  text-underline-offset: 3px;
  white-space: normal;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.mcp-result-card {
  display: grid;
  width: 100%;
  overflow: hidden;
  border: 1px solid rgba(51, 91, 79, 0.14);
  border-radius: 17px;
  background: linear-gradient(150deg, #f8fffc, #f5f8f6 58%, #edf4f1);
  color: #31463f;
}

.mcp-result-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 10px 11px 9px;
  border-bottom: 1px solid rgba(51, 91, 79, 0.1);
  background: rgba(255, 255, 255, 0.58);
}

.mcp-result-mark {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 10px;
  background: #d8eee5;
  color: #356c5a;
}

.mcp-result-head > span:nth-child(2) {
  display: grid;
  min-width: 0;
}

.mcp-result-head small {
  color: #759187;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.mcp-result-head strong {
  overflow: hidden;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mcp-result-head > em {
  max-width: 88px;
  overflow: hidden;
  padding: 4px 7px;
  border-radius: 999px;
  background: rgba(53, 108, 90, 0.08);
  color: #53776b;
  font-size: 7px;
  font-style: normal;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mcp-result-list {
  display: grid;
  max-height: 430px;
  overflow: auto;
  overscroll-behavior: contain;
}

.mcp-result-item {
  display: grid;
  min-width: 0;
  padding: 11px;
  border-bottom: 1px solid rgba(51, 91, 79, 0.09);
}

.mcp-result-item.has-image {
  grid-template-columns: 68px minmax(0, 1fr);
  gap: 10px;
}

.mcp-result-item > img {
  width: 68px;
  height: 76px;
  border-radius: 12px;
  background: #e7eeeb;
  object-fit: cover;
}

.mcp-result-copy {
  display: grid;
  align-content: start;
  gap: 4px;
  min-width: 0;
}

.mcp-result-copy > small {
  overflow: hidden;
  color: #769087;
  font-size: 7px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mcp-result-copy > strong {
  display: -webkit-box;
  overflow: hidden;
  color: #2e423b;
  font-size: 12px;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.mcp-result-description,
.mcp-result-address {
  display: -webkit-box;
  overflow: hidden;
  color: #708078;
  font-size: 8px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.mcp-result-address {
  color: #597168;
}

.mcp-result-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mcp-result-meta em {
  padding: 3px 5px;
  border-radius: 6px;
  background: rgba(53, 108, 90, 0.08);
  color: #5a766c;
  font-size: 7px;
  font-style: normal;
}

.mcp-result-meta em.price {
  background: rgba(221, 103, 74, 0.1);
  color: #b55740;
  font-size: 9px;
  font-weight: 900;
}

.mcp-result-copy > a {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  justify-self: end;
  margin-top: 2px;
  color: #356c5a;
  font-size: 8px;
  font-weight: 900;
  text-decoration: none;
}

.mcp-result-card > footer {
  padding: 7px 11px;
  background: rgba(255, 255, 255, 0.46);
  color: #82958e;
  font-size: 7px;
  text-align: right;
}

.message-row.user .bubble.mcpResult,
.message-row.char .bubble.mcpResult {
  color: inherit !important;
}
</style>