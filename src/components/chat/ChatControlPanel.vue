<template>
  <section class="control-panel">
      <section v-if="activeTab === 'memory'" class="panel-section graph-memory-panel">
        <CharacterMemoryGraphPanel :conversation-id="conversationId" />
      </section>
      <section v-else-if="activeTab === 'beauty'" class="panel-section beauty-panel">
        <section class="settings-block local-theme-style-block">
          <header class="section-header">
            <div>
              <span>Local presets</span>
              <strong>角色局部样式</strong>
            </div>
          </header>
          <div class="local-theme-style-grid">
            <label class="field local-theme-style-field">
              <span>线上预设</span>
              <select :value="characterDraft.themeStyleBindings?.onlinePresetId ?? ''" @change="updateCharacterThemeStyleBinding('online', $event)">
                <option v-for="option in onlineThemeStyleOptions" :key="option.id" :value="option.id">{{ option.name }}</option>
              </select>
            </label>
            <label class="field local-theme-style-field">
              <span>线下预设</span>
              <select :value="characterDraft.themeStyleBindings?.offlinePresetId ?? ''" @change="updateCharacterThemeStyleBinding('offline', $event)">
                <option v-for="option in offlineThemeStyleOptions" :key="option.id" :value="option.id">{{ option.name }}</option>
              </select>
            </label>
          </div>
        </section>
        <section class="settings-block">
          <header class="section-header">
            <div>
              <span>Canvas</span>
              <strong>聊天背景</strong>
            </div>
          </header>
          <div class="background-manager">
            <section class="background-tool-panel" aria-label="背景导入与颜色">
              <label class="field background-url-card">
                <div class="background-field-title">
                  <span>背景图 URL</span>
                  <button class="setting-action-button primary-setting-action" type="button" aria-label="添加背景图 URL" @click="addBackgroundImageFromUrl">
                    <Plus :size="16" stroke-width="2.5" aria-hidden="true" />
                  </button>
                </div>
                <input v-model="backgroundImageUrlDraft" placeholder="https://..." @keydown.enter.prevent="addBackgroundImageFromUrl" />
              </label>
              <div class="background-quick-actions">
                <label class="upload-card background-upload-card">
                  <strong>导入本地图片</strong>
                  <input type="file" accept="image/*" multiple @change="readAppearanceFiles" />
                </label>
                <label class="field background-color-card appearance-color-field">
                  <span>背景色</span>
                  <div class="background-color-select">
                    <input v-model="draft.appearance.backgroundColor" type="color" @change="saveDraft" />
                    <span>{{ draft.appearance.backgroundColor }}</span>
                  </div>
                </label>
              </div>
            </section>
            <section class="background-library" aria-label="背景图列表">
              <article
                v-for="(image, index) in backgroundImageOptions"
                :key="`${image}-${index}`"
                class="background-thumb-card"
                :class="{ active: draft.appearance.backgroundImage === image }"
              >
                <button class="background-thumb" type="button" :style="{ backgroundImage: `url(${image})` }" @click="applyBackgroundImage(image)">
                  <span>{{ draft.appearance.backgroundImage === image ? '使用中' : `背景 ${index + 1}` }}</span>
                </button>
                <div class="background-thumb-actions">
                  <button type="button" :disabled="draft.appearance.backgroundImage === image" @click="applyBackgroundImage(image)">应用</button>
                  <button type="button" @click="removeBackgroundImage(image)">删除</button>
                </div>
              </article>
              <div v-if="!backgroundImageOptions.length" class="empty-note compact-empty-note">还没有背景图，添加 URL 或导入本地图片即可保存多个方案。</div>
            </section>
          </div>
        </section>
        <section class="settings-block">
          <header class="section-header">
            <div>
              <span>Bubble system</span>
              <strong>气泡配色</strong>
            </div>
          </header>
          <section class="bubble-preview" :style="bubblePreviewStyle" aria-label="气泡预览">
            <div class="preview-row character-preview-row">
              <img v-if="draft.appearance.showCharacterAvatar" class="avatar mini" :src="characterDraft.avatar" :alt="characterDraftNickname" />
              <div class="preview-bubble" :style="characterBubblePreviewStyle">角色的聊天会像这样显示。</div>
            </div>
            <div class="preview-row user-preview-row">
              <div class="preview-bubble" :style="userBubblePreviewStyle">用户气泡颜色在这里预览。</div>
              <img v-if="draft.appearance.showUserAvatar" class="avatar mini" :src="userAvatarPreview" :alt="userAvatarAlt" />
            </div>
            <div class="preview-row narration-preview-row">
              <div class="preview-bubble narration-preview-bubble" :style="narrationBubblePreviewStyle">旁白会像这样显示。</div>
            </div>
          </section>
          <div class="color-grid bubble-color-grid">
            <label class="field color-card">
              <span>我方气泡</span>
              <input v-model="draft.appearance.userBubbleColor" type="color" @change="saveDraft" />
              <div class="rgb-input-row" aria-label="我方气泡 RGB">
                <input :value="rgbParts(draft.appearance.userBubbleColor).red" aria-label="我方气泡 R" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('userBubbleColor', 'red', $event)" />
                <input :value="rgbParts(draft.appearance.userBubbleColor).green" aria-label="我方气泡 G" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('userBubbleColor', 'green', $event)" />
                <input :value="rgbParts(draft.appearance.userBubbleColor).blue" aria-label="我方气泡 B" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('userBubbleColor', 'blue', $event)" />
              </div>
            </label>
            <label class="field color-card">
              <span>我方文字</span>
              <input v-model="draft.appearance.userTextColor" type="color" @change="saveDraft" />
              <div class="rgb-input-row" aria-label="我方文字 RGB">
                <input :value="rgbParts(draft.appearance.userTextColor).red" aria-label="我方文字 R" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('userTextColor', 'red', $event)" />
                <input :value="rgbParts(draft.appearance.userTextColor).green" aria-label="我方文字 G" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('userTextColor', 'green', $event)" />
                <input :value="rgbParts(draft.appearance.userTextColor).blue" aria-label="我方文字 B" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('userTextColor', 'blue', $event)" />
              </div>
            </label>
            <label class="field color-card">
              <span>对方气泡</span>
              <input v-model="draft.appearance.characterBubbleColor" type="color" @change="saveDraft" />
              <div class="rgb-input-row" aria-label="对方气泡 RGB">
                <input :value="rgbParts(draft.appearance.characterBubbleColor).red" aria-label="对方气泡 R" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('characterBubbleColor', 'red', $event)" />
                <input :value="rgbParts(draft.appearance.characterBubbleColor).green" aria-label="对方气泡 G" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('characterBubbleColor', 'green', $event)" />
                <input :value="rgbParts(draft.appearance.characterBubbleColor).blue" aria-label="对方气泡 B" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('characterBubbleColor', 'blue', $event)" />
              </div>
            </label>
            <label class="field color-card">
              <span>对方文字</span>
              <input v-model="draft.appearance.characterTextColor" type="color" @change="saveDraft" />
              <div class="rgb-input-row" aria-label="对方文字 RGB">
                <input :value="rgbParts(draft.appearance.characterTextColor).red" aria-label="对方文字 R" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('characterTextColor', 'red', $event)" />
                <input :value="rgbParts(draft.appearance.characterTextColor).green" aria-label="对方文字 G" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('characterTextColor', 'green', $event)" />
                <input :value="rgbParts(draft.appearance.characterTextColor).blue" aria-label="对方文字 B" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('characterTextColor', 'blue', $event)" />
              </div>
            </label>
            <label class="field color-card">
              <span>旁白背景</span>
              <input v-model="draft.appearance.narrationBubbleColor" type="color" @change="saveDraft" />
              <div class="rgb-input-row" aria-label="旁白背景 RGB">
                <input :value="rgbParts(draft.appearance.narrationBubbleColor).red" aria-label="旁白背景 R" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('narrationBubbleColor', 'red', $event)" />
                <input :value="rgbParts(draft.appearance.narrationBubbleColor).green" aria-label="旁白背景 G" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('narrationBubbleColor', 'green', $event)" />
                <input :value="rgbParts(draft.appearance.narrationBubbleColor).blue" aria-label="旁白背景 B" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('narrationBubbleColor', 'blue', $event)" />
              </div>
            </label>
            <label class="field color-card">
              <span>旁白文字</span>
              <input v-model="draft.appearance.narrationTextColor" type="color" @change="saveDraft" />
              <div class="rgb-input-row" aria-label="旁白文字 RGB">
                <input :value="rgbParts(draft.appearance.narrationTextColor).red" aria-label="旁白文字 R" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('narrationTextColor', 'red', $event)" />
                <input :value="rgbParts(draft.appearance.narrationTextColor).green" aria-label="旁白文字 G" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('narrationTextColor', 'green', $event)" />
                <input :value="rgbParts(draft.appearance.narrationTextColor).blue" aria-label="旁白文字 B" inputmode="numeric" max="255" min="0" type="number" @change="updateRgbColor('narrationTextColor', 'blue', $event)" />
              </div>
            </label>
          </div>
        </section>
        <section class="settings-block display-options-grid">
          <label class="switch-card wide">
            <input v-model="draft.appearance.showReadStatus" type="checkbox" @change="saveDraft" />
            <span class="switch-track"></span>
            <div>
              <strong>显示已读未读</strong>
            </div>
          </label>
          <label class="switch-card wide">
            <input v-model="draft.appearance.showMessageTime" type="checkbox" @change="saveDraft" />
            <span class="switch-track"></span>
            <div>
              <strong>显示气泡外时间</strong>
            </div>
          </label>
          <label class="switch-card wide">
            <input v-model="draft.appearance.showUserAvatar" type="checkbox" @change="saveDraft" />
            <span class="switch-track"></span>
            <div>
              <strong>显示用户头像</strong>
            </div>
          </label>
          <label class="switch-card wide">
            <input v-model="draft.appearance.showCharacterAvatar" type="checkbox" @change="saveDraft" />
            <span class="switch-track"></span>
            <div>
              <strong>显示角色头像</strong>
            </div>
          </label>
          <label class="switch-card wide">
            <input v-model="draft.appearance.showOnlyFirstAvatarInReply" type="checkbox" @change="saveDraft" />
            <span class="switch-track"></span>
            <div>
              <strong>角色与用户的消息仅首条头像</strong>
            </div>
          </label>
        </section>
      </section>

      <section v-else-if="activeTab === 'profile'" class="panel-section profile-panel">
        <section class="profile-section wide-field" aria-label="角色基础资料">
          <div class="avatar-card">
            <img class="avatar-preview" :src="characterDraft.avatar" :alt="characterDraftNickname" />
            <label class="avatar-upload">
              <input type="file" accept="image/*" @change="readAvatarFile" />
              <span>导入头像</span>
            </label>
          </div>
          <div class="profile-fields">
            <label class="field avatar-url-field">
              <span>头像 URL</span>
              <input v-model="characterDraft.avatar" @change="saveCharacterDraft" />
            </label>

            <section class="identity-row" aria-label="角色名称资料">
              <label class="field compact-field">
                <span>名字</span>
                <input v-model="characterDraft.name" @change="saveCharacterDraft" />
              </label>

              <label class="field compact-field">
                <span>网名</span>
                <input v-model="characterDraft.nickname" @change="saveCharacterDraft" />
              </label>

              <label class="field compact-field note-field">
                <span>备注</span>
                <input v-model="characterDraft.userNote" @change="saveCharacterDraft" />
              </label>
            </section>
          </div>
        </section>

        <label class="field wide-field">
          <span>个性签名</span>
          <input v-model="characterDraft.signature" @change="saveCharacterDraft" />
        </label>

        <label class="field wide-field">
          <span>角色资料</span>
          <textarea v-model="characterDraft.description" rows="7" @change="saveCharacterDraft"></textarea>
        </label>

        <label class="field wide-field add-page-select-field">
          <span>绑定局部世界书</span>
          <select :value="localWorldBookSelectValue" :disabled="!localWorldBooks.length" @change="toggleLocalWorldBookFromSelect">
            <option :value="localWorldBookSelectValue" disabled>{{ characterLocalWorldBookSummary }}</option>
            <option v-for="book in localWorldBooks" :key="book.id" :value="book.id">
              {{ characterDraft.localWorldBookIds.includes(book.id) ? '✓ ' : '' }}{{ book.title }}
            </option>
          </select>
        </label>
      </section>

      <section v-else-if="activeTab === 'image'" class="panel-section image-profile-panel">
        <section class="settings-block image-profile-block" aria-label="角色生图外观档案">
          <header class="section-header">
            <div>
              <span>Image identity</span>
              <strong>生图外观档案</strong>
            </div>
          </header>

          <label class="field wide-field">
            <span>整体形象英文档案</span>
            <textarea v-model="characterDraft.imageProfile.appearancePrompt" rows="5" placeholder="Hair, outfit style, body type, vibe, recurring visual details..." @change="saveCharacterDraft"></textarea>
          </label>

          <label class="field wide-field">
            <span>脸部固定英文档案</span>
            <textarea v-model="characterDraft.imageProfile.facePrompt" rows="4" placeholder="Face shape, eyes, nose, mouth, skin tone, hairstyle framing..." @change="saveCharacterDraft"></textarea>
          </label>

          <section class="image-reference-card">
            <div class="image-reference-preview">
              <img v-if="characterDraft.imageProfile.referenceImage" :src="characterDraft.imageProfile.referenceImage" alt="角色参考图预览" />
              <span v-else>Reference</span>
            </div>
            <div class="image-reference-fields">
              <label class="field">
                <span>参考图 URL</span>
                <input v-model="characterDraft.imageProfile.referenceImage" type="text" placeholder="https://..." @change="saveCharacterDraft" />
              </label>
              <label class="upload-card image-reference-upload">
                <strong>导入本地参考图</strong>
                <input type="file" accept="image/*" @change="readReferenceImage" />
              </label>
            </div>
          </section>

          <div class="image-profile-grid">
            <label class="field compact-field image-profile-row">
              <span>固定种子</span>
              <input v-model="characterDraft.imageProfile.seed" type="text" placeholder="可留空" @change="saveCharacterDraft" />
              <small>同角色固定 seed 能提升构图和脸部稳定性。</small>
            </label>
            <label class="switch-card image-profile-row image-reference-toggle">
              <input v-model="characterDraft.imageProfile.voomPortraitModeEnabled" type="checkbox" @change="saveCharacterDraft" />
              <span class="switch-track"></span>
              <div>
                <strong>VOOM 人像模式</strong>
                <span>开启后该角色的 VOOM 配图会优先生成本人。</span>
              </div>
            </label>
            <label class="switch-card image-profile-row image-reference-toggle">
              <input v-model="characterDraft.imageProfile.referenceImageEnabled" type="checkbox" @change="saveCharacterDraft" />
              <span class="switch-track"></span>
              <div>
                <strong>启用参考图</strong>
                <span>开启时会实际传入参考图。</span>
              </div>
            </label>
          </div>
        </section>
        <section class="settings-block character-photo-block" aria-label="角色照片">
          <header class="section-header record-header">
            <div>
              <span>Character photos</span>
              <strong>角色照片</strong>
            </div>
            <em>{{ characterPhotoItems.length }} 张</em>
          </header>
          <section class="character-photo-import-panel">
            <div class="character-photo-url-row">
              <input v-model="characterPhotoUrlDraft" type="text" aria-label="角色照片 URL" placeholder="粘贴角色照片 URL" @keydown.enter.prevent="addCharacterPhotoFromUrl" />
              <button class="character-photo-icon-button" type="button" aria-label="添加角色照片 URL" @click="addCharacterPhotoFromUrl">
                <Plus :size="16" stroke-width="2.5" aria-hidden="true" />
              </button>
            </div>
            <label class="character-photo-import-button">
              <span>导入本地图片</span>
              <input type="file" accept="image/*" multiple @change="readCharacterPhotoFiles" />
            </label>
          </section>
          <section v-if="characterPhotoItems.length" class="character-photo-library" aria-label="角色照片列表">
            <article v-for="(photo, photoIndex) in characterPhotoItems" :key="photo.key" class="character-photo-card">
              <div :ref="(element) => observeCharacterPhotoThumb(element, photo.key, photoIndex)" class="character-photo-thumb" :aria-label="photo.title" role="img">
                <img v-if="isCharacterPhotoVisible(photo.key, photoIndex)" :src="photo.imageUrl" :alt="photo.title" loading="lazy" decoding="async" fetchpriority="low" draggable="false" />
                <span>{{ photo.sourceLabel }}</span>
              </div>
              <div class="character-photo-meta">
                <strong>{{ photo.title }}</strong>
                <span>{{ photo.sourceLabel }} · {{ formatPhotoTime(photo.createdAt) }}</span>
              </div>
              <div class="character-photo-actions">
                <button type="button" @click="downloadCharacterPhoto(photo)">
                  <span>下载</span>
                </button>
                <button type="button" @click="removeCharacterPhoto(photo)">删除</button>
              </div>
            </article>
          </section>
          <div v-else class="character-photo-empty">成功应用的 VOOM、聊天和通话生图会自动进入照片池。</div>
        </section>
      </section>

      <section v-else class="panel-section other-panel">
        <section class="settings-block character-mcp-block">
          <header class="section-header">
            <div>
              <span>MCP tools</span>
              <strong>角色外部工具</strong>
            </div>
            <em class="character-mcp-count">{{ appliedCharacterMcpServerCount }} 个连接</em>
          </header>
          <label class="switch-card wide">
            <input :checked="characterMcpBinding.overrideGlobal" type="checkbox" @change="updateCharacterMcpOverride" />
            <span class="switch-track"></span>
            <div>
              <strong>角色局部优先</strong>
              <span>开启后不再继承全局应用，只使用下方单独勾选的 MCP。</span>
            </div>
          </label>
          <p class="character-mcp-note">
            {{ characterMcpBinding.overrideGlobal ? '当前为角色独立配置；未勾选时该角色不会使用任何 MCP。' : '当前跟随 Services > MCP Studio 中已开启的全局应用。' }}
          </p>
          <div v-if="configuredMcpServers.length" class="character-mcp-list">
            <label v-for="server in configuredMcpServers" :key="server.id" class="character-mcp-row" :class="{ unavailable: !server.enabled }">
              <span>
                <strong>{{ server.name }}</strong>
                <small>{{ server.enabled ? characterMcpServerStatus(server) : '连接已在全局 MCP 页面停用' }}</small>
              </span>
              <input
                :checked="isMcpServerAppliedToCharacter(server)"
                :disabled="!characterMcpBinding.overrideGlobal || !server.enabled"
                type="checkbox"
                @change="toggleCharacterMcpServer(server, $event)"
              />
            </label>
          </div>
          <p v-else class="character-mcp-note empty-character-mcp-note">请先到 Services &gt; MCP Studio 导入或添加远程连接。</p>
          <p v-if="!mcpMasterEnabled" class="character-mcp-warning">全局 MCP 总开关当前关闭，角色绑定会保留但不会调用。</p>
        </section>
        <section class="settings-block">
          <header class="section-header">
            <div>
              <span>Narration</span>
              <strong>旁白模式</strong>
            </div>
          </header>
          <label class="switch-card wide">
            <input v-model="draft.narrationModeEnabled" type="checkbox" @change="saveDraft" />
            <span class="switch-track"></span>
            <div>
              <strong>开启旁白模式</strong>
              <span>线上聊天回复会加入角色动描等旁白。</span>
            </div>
          </label>
        </section>
        <section class="settings-block">
          <header class="section-header">
            <div>
              <span>MiniMax TTS</span>
              <strong>角色音色</strong>
            </div>
          </header>
          <label class="field wide-field">
            <span>{{ characterDraftNickname }} 的 Voice ID</span>
            <input v-model="characterDraft.minimaxVoiceId" placeholder="留空使用全局音色" @change="saveCharacterDraft" />
          </label>
          <p class="time-awareness-note">
            仅使用 MiniMax TTS 时生效；留空会跟随全局音色{{ globalMinimaxVoiceId ? `（${globalMinimaxVoiceId}）` : '' }}。
          </p>
        </section>
        <section class="settings-block call-settings-block">
          <header class="section-header">
            <div>
              <span>Calls</span>
              <strong>通话体验</strong>
            </div>
          </header>
          <section class="call-simple-card call-ambient-panel">
            <label class="switch-card wide call-ambient-switch">
              <input v-model="draft.call.ambientEnabled" type="checkbox" :disabled="!draft.call.ambientSound" @change="saveDraft" />
              <span class="switch-track"></span>
              <div>
                <strong>通话氛围音</strong>
                <span>{{ callAmbientLabel }}</span>
              </div>
            </label>
            <div class="call-button-row">
              <label class="call-text-button">
                <span>导入氛围音</span>
                <input type="file" :accept="callAudioAccept" @change="importCallAmbientSound" />
              </label>
              <button class="call-text-button call-clear-button" type="button" :disabled="!draft.call.ambientSound" @click="resetCallAmbientSound">清除氛围音</button>
            </div>
            <label class="field compact-field call-volume-field">
              <span>氛围音音量</span>
              <input v-model.number="draft.call.ambientVolume" min="0.02" max="0.6" step="0.02" type="range" @change="saveDraft" />
            </label>
            <audio v-if="draft.call.ambientSound" class="audio-preview call-audio-preview" controls preload="metadata" :src="draft.call.ambientSound.url"></audio>
          </section>
        </section>
        <section class="settings-block">
          <header class="section-header">
            <div>
              <span>Stickers</span>
              <strong>贴纸读取</strong>
            </div>
          </header>
          <label class="switch-card wide">
            <input v-model="draft.stickerVisionEnabled" type="checkbox" @change="saveDraft" />
            <span class="switch-track"></span>
            <div>
              <strong>开启 Stickers 识图</strong>
              <span>关闭后角色只能读取 Sticker 的文字描述。</span>
            </div>
          </label>
          <label class="switch-card wide">
            <input v-model="draft.stickerSuggestionsEnabled" type="checkbox" @change="saveDraft" />
            <span class="switch-track"></span>
            <div>
              <strong>开启 Stickers 智能推荐</strong>
              <span>输入文字时基于描述、最近发送和当前会话习惯推荐贴纸。</span>
            </div>
          </label>
          <label class="field wide-field add-page-select-field">
            <span>角色绑定 Stickers分组</span>
            <select :value="stickerGroupSelectValue" :disabled="!stickerGroupPickerRows.length" @change="toggleStickerGroupFromSelect">
              <option :value="stickerGroupSelectValue" disabled>{{ characterStickerBindingSummary }}</option>
              <option v-for="group in stickerGroupPickerRows" :key="group.id" :value="group.id">
                {{ draft.characterStickerGroupIds.includes(group.id) ? '✓ ' : '' }}{{ group.name }}
              </option>
            </select>
          </label>
        </section>
        <section class="settings-block">
          <header class="section-header">
            <div>
              <span>VOOM</span>
              <strong>动态生成</strong>
            </div>
          </header>
          <label class="switch-card wide">
            <input :checked="draft.autoGenerateVoom" type="checkbox" @change="updateAutoGenerateVoom" />
            <span class="switch-track"></span>
            <div>
              <strong>允许主动发布VOOM</strong>
            </div>
          </label>
          <label class="field frequency-field">
            <span>发布动态频率</span>
            <select :value="draft.voomFrequency" @change="updateVoomFrequency">
              <option v-for="option in voomFrequencyOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <label class="field frequency-field">
            <span>VOOM 配图方案</span>
            <select :value="draft.voomImageMode" @change="updateVoomImageMode">
              <option v-for="option in voomImageModeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
          <section class="time-awareness-note voom-image-mode-note">{{ voomImageModeDescription }}</section>
          <label v-if="draft.voomImageMode === 'manual'" class="switch-card wide">
            <input :checked="draft.voomImageEnabled" type="checkbox" @change="updateVoomImageEnabled" />
            <span class="switch-track"></span>
            <div>
              <strong>开启 VOOM 配图</strong>
              <span>关闭后，角色发布动态时只生成文字和评论区。</span>
            </div>
          </label>
          <label v-if="draft.voomImageMode === 'manual'" class="field frequency-field">
            <span>配图出现频率</span>
            <select :value="draft.voomImageFrequency" :disabled="!draft.voomImageEnabled" @change="updateVoomImageFrequency">
              <option v-for="option in voomFrequencyOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
        </section>
        <section class="settings-block">
          <header class="section-header">
            <div>
              <span>Theater</span>
              <strong>小剧场生成</strong>
            </div>
          </header>
          <label class="switch-card wide">
            <input :checked="draft.autoGenerateTheater" type="checkbox" @change="updateAutoGenerateTheater" />
            <span class="switch-track"></span>
            <div>
              <strong>允许角色主动生成小剧场</strong>
              <span>生成独立番外 HTML 页面，不写入聊天楼层，也不会作为后续 AI 记忆读取。</span>
            </div>
          </label>
          <label class="field frequency-field">
            <span>小剧场生成频率</span>
            <select :value="draft.theaterFrequency" :disabled="!draft.autoGenerateTheater" @change="updateTheaterFrequency">
              <option v-for="option in voomFrequencyOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
        </section>
        <section class="settings-block">
          <header class="section-header">
            <div>
              <span>Initiative</span>
              <strong>主动消息</strong>
            </div>
          </header>
          <label class="switch-card wide">
            <input :checked="draft.proactiveReply.enabled" type="checkbox" @change="updateProactiveReplyEnabled" />
            <span class="switch-track"></span>
            <div>
              <strong>允许角色主动发送消息</strong>
              <span>开启后，该角色会按频率在聊天中主动调用 API 联系你。</span>
            </div>
          </label>
          <label class="switch-card wide">
            <input :checked="draft.offlineInvitationEnabled" type="checkbox" @change="updateOfflineInvitationEnabled" />
            <span class="switch-track"></span>
            <div>
              <strong>允许角色主动发起线下邀约</strong>
              <span>开启后，角色可在想见面时主动发送线下邀约卡。</span>
            </div>
          </label>
          <label class="field frequency-field">
            <span>该角色主动消息频率</span>
            <select :value="draft.proactiveReply.frequency" :disabled="!draft.proactiveReply.enabled" @change="updateProactiveReplyFrequency">
              <option v-for="option in voomFrequencyOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </label>
        </section>
        <section class="settings-block">
          <header class="section-header">
            <div>
              <span>Local time</span>
              <strong>时间感知</strong>
            </div>
          </header>
          <label class="switch-card wide">
            <input v-model="draft.timeAwareness.enabled" type="checkbox" @change="saveDraft" />
            <span class="switch-track"></span>
            <div>
              <strong>开启时间感知</strong>
              <span>覆盖聊天回复、VOOM 生成与评论区回复。</span>
            </div>
          </label>
          <section v-if="draft.timeAwareness.enabled" class="time-awareness-note">
            每次生成内容时都会重新读取本机实时信息，适合判断作息、日期和日常节奏。
          </section>
        </section>
      </section>

      <AvatarCropperModal v-model="showAvatarEditor" :src="avatarEditorSource" @confirm="applyEditedAvatar" />
  </section>
</template>

<script setup lang="ts">
import { Plus } from 'lucide-vue-next';
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import CharacterMemoryGraphPanel from '@/components/chat/CharacterMemoryGraphPanel.vue';
import AvatarCropperModal from '@/components/image/AvatarCropperModal.vue';
import { callAudioAccept, createCallAudioAsset } from '@/services/callExperience';
import { useAppStore } from '@/stores/appStore';
import type { CharacterImageProfile, CharacterPhotoRecord, CharacterProfile, ChatAppearanceSettings, ConversationSettings, McpServerConfig, ThemeStylePreset, VoomImageMode } from '@/types/domain';
import { collectCharacterPhotoItems, createCharacterPhotoRecord, normalizeCharacterPhotoRecords, normalizeHiddenSourcePhotoKeys, type CharacterPhotoItem } from '@/utils/characterPhotos';
import { downloadImageUrl } from '@/utils/download';
import { readImageFileFromInput } from '@/utils/imageFile';
import { normalizeConversationSettings } from '@/utils/memory';
import { defaultProfileAvatar } from '@/utils/profile';
import { defaultOfflineThemePresetId, defaultOnlineThemePresetId } from '@/utils/themeStyles';
import { normalizeVoomFrequency, voomFrequencyOptions, voomImageModeOptions } from '@/utils/voom';

type ColorField = 'userBubbleColor' | 'userTextColor' | 'characterBubbleColor' | 'characterTextColor' | 'narrationBubbleColor' | 'narrationTextColor';
type RgbChannel = 'red' | 'green' | 'blue';
type RgbParts = Record<RgbChannel, number>;
type ThemeStyleBindingScope = 'online' | 'offline';
type CharacterDraft = CharacterProfile & { imageProfile: CharacterImageProfile };

const props = defineProps<{
  conversationId: string;
  character: CharacterProfile;
  activeTab: PanelTab;
}>();

const store = useAppStore();
export type PanelTab = 'memory' | 'beauty' | 'profile' | 'image' | 'other';

const activeTab = computed(() => props.activeTab);
const showAvatarEditor = ref(false);
const avatarEditorSource = ref('');
const backgroundImageUrlDraft = ref('');
const characterPhotoUrlDraft = ref('');
const draft = reactive<ConversationSettings>(normalizeConversationSettings(null, props.conversationId, 'online'));
const characterDraft = reactive<CharacterDraft>(cloneCharacterForDraft(props.character));
const currentConversationSettings = computed(() => store.settingsForConversation(props.conversationId));
const characterDraftNickname = computed(() => characterDraft.nickname || 'new.friend');
const globalMinimaxVoiceId = computed(() => store.settings?.ttsMinimax.voiceId?.trim() || '未设置');
const boundUser = computed(() => store.userById(props.character.boundUserId) ?? store.user ?? null);
const boundUserVisualProfile = computed(() => props.character.boundUserProfile);
const userAvatarPreview = computed(() => boundUserVisualProfile.value?.avatar || boundUser.value?.avatar || defaultProfileAvatar);
const userAvatarAlt = computed(() => boundUserVisualProfile.value?.nickname || boundUser.value?.nickname || boundUser.value?.name || '我');
const backgroundImageOptions = computed(() => draft.appearance.backgroundImages);
const characterConversations = computed(() => store.conversations.filter((conversation) => conversation.charId === props.character.id));
const characterPhotoItems = computed(() => collectCharacterPhotoItems({
  character: characterDraft,
  conversations: characterConversations.value,
  messages: store.messages,
  voomPosts: store.voomPosts
}));
const eagerCharacterPhotoCount = 8;
const visibleCharacterPhotoKeys = ref<Set<string>>(new Set());
const observedCharacterPhotoElements = new Map<string, Element>();
const characterPhotoKeyByElement = new WeakMap<Element, string>();
let characterPhotoObserver: IntersectionObserver | undefined;
const photoTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});
const localWorldBookSelectValue = '__local_world_book_summary__';
const stickerGroupSelectValue = '__sticker_group_summary__';
const localWorldBooks = computed(() => store.worldBooks.filter((book) => book.scope === 'local'));
const selectedCharacterLocalWorldBooks = computed(() => localWorldBooks.value.filter((book) => characterDraft.localWorldBookIds.includes(book.id)));
const characterLocalWorldBookSummary = computed(() => {
  if (!localWorldBooks.value.length) return '暂无局部世界书';
  if (!selectedCharacterLocalWorldBooks.value.length) return '请选择局部世界书';
  if (selectedCharacterLocalWorldBooks.value.length === 1) return selectedCharacterLocalWorldBooks.value[0]?.title ?? '已绑定 1 本局部世界书';
  return `已绑定 ${selectedCharacterLocalWorldBooks.value.length} 本局部世界书`;
});
const onlineThemeStyleOptions = computed(() => createThemeStyleOptions('online', store.settings?.themeSettings.online.presets ?? []));
const offlineThemeStyleOptions = computed(() => createThemeStyleOptions('offline', store.settings?.themeSettings.offline.presets ?? []));
const configuredMcpServers = computed(() => store.settings?.mcpSettings.servers ?? []);
const mcpMasterEnabled = computed(() => Boolean(store.settings?.mcpSettings.enabled));
const characterMcpBinding = computed(() => ({
  overrideGlobal: Boolean(characterDraft.mcpBinding?.overrideGlobal),
  serverIds: characterDraft.mcpBinding?.serverIds ?? []
}));
const inheritedMcpServerIds = computed(() => configuredMcpServers.value
  .filter((server) => server.enabled && server.globalEnabled)
  .map((server) => server.id));
const appliedCharacterMcpServerCount = computed(() => configuredMcpServers.value
  .filter((server) => isMcpServerAppliedToCharacter(server)).length);
const bubblePreviewStyle = computed(() => ({
  backgroundColor: draft.appearance.backgroundColor,
  backgroundImage: draft.appearance.backgroundImage ? `url(${draft.appearance.backgroundImage})` : 'none'
}));
const userBubblePreviewStyle = computed(() => ({
  background: draft.appearance.userBubbleColor,
  color: draft.appearance.userTextColor
}));
const characterBubblePreviewStyle = computed(() => ({
  background: draft.appearance.characterBubbleColor,
  color: draft.appearance.characterTextColor
}));
const narrationBubblePreviewStyle = computed(() => ({
  background: draft.appearance.narrationBubbleColor,
  color: draft.appearance.narrationTextColor
}));
const callAmbientLabel = computed(() => draft.call.ambientSound?.name || '未设置氛围音');
const stickerGroupPickerRows = computed(() => store.sortedStickerGroups.map((group) => ({
  id: group.id,
  name: group.name
})));
const characterStickerBindingSummary = computed(() => {
  const groupIds = new Set(draft.characterStickerGroupIds);
  if (!stickerGroupPickerRows.value.length) return '暂无 Stickers 分组';
  if (!groupIds.size) return '请选择 Stickers 分组';
  const names = stickerGroupPickerRows.value
    .filter((group) => groupIds.has(group.id))
    .map((group) => group.name);
  if (!names.length) return '请选择 Stickers 分组';
  if (names.length === 1) return names[0] ?? '已绑定 1 个 Stickers 分组';
  return `已绑定 ${names.length} 个 Stickers 分组`;
});
const voomImageModeDescription = computed(() => voomImageModeOptions.find((option) => option.value === draft.voomImageMode)?.description ?? '');

function formatPhotoTime(timestamp: number) {
  return Number.isFinite(timestamp) ? photoTimeFormatter.format(timestamp) : '时间未知';
}

function revealCharacterPhoto(key: string) {
  if (visibleCharacterPhotoKeys.value.has(key)) return;
  const nextKeys = new Set(visibleCharacterPhotoKeys.value);
  nextKeys.add(key);
  visibleCharacterPhotoKeys.value = nextKeys;
}

function isCharacterPhotoVisible(key: string, index: number) {
  return index < eagerCharacterPhotoCount || visibleCharacterPhotoKeys.value.has(key);
}

function ensureCharacterPhotoObserver() {
  if (!('IntersectionObserver' in window)) return null;
  if (characterPhotoObserver) return characterPhotoObserver;
  characterPhotoObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting && entry.intersectionRatio <= 0) continue;
      const key = characterPhotoKeyByElement.get(entry.target);
      if (!key) continue;
      revealCharacterPhoto(key);
      characterPhotoObserver?.unobserve(entry.target);
      observedCharacterPhotoElements.delete(key);
    }
  }, { rootMargin: '420px 0px' });
  return characterPhotoObserver;
}

function observeCharacterPhotoThumb(element: unknown, key: string, index: number) {
  const target = element instanceof Element ? element : null;
  if (index < eagerCharacterPhotoCount) revealCharacterPhoto(key);
  const previousElement = observedCharacterPhotoElements.get(key);
  if (previousElement && previousElement !== target) characterPhotoObserver?.unobserve(previousElement);
  if (!target) {
    observedCharacterPhotoElements.delete(key);
    return;
  }
  observedCharacterPhotoElements.set(key, target);
  characterPhotoKeyByElement.set(target, key);
  if (visibleCharacterPhotoKeys.value.has(key)) return;
  const observer = ensureCharacterPhotoObserver();
  if (!observer) {
    revealCharacterPhoto(key);
    return;
  }
  observer.observe(target);
}

function disconnectCharacterPhotoObserver() {
  characterPhotoObserver?.disconnect();
  characterPhotoObserver = undefined;
  observedCharacterPhotoElements.clear();
}

watch(
  () => [props.conversationId, currentConversationSettings.value] as const,
  () => {
    Object.assign(draft, normalizeConversationSettings(currentConversationSettings.value, props.conversationId, 'online'));
  },
  { immediate: true }
);

onBeforeUnmount(disconnectCharacterPhotoObserver);

watch(
  characterPhotoItems,
  (items) => {
    const availableKeys = new Set(items.map((photo) => photo.key));
    const nextVisibleKeys = new Set([...visibleCharacterPhotoKeys.value].filter((key) => availableKeys.has(key)));
    for (const photo of items.slice(0, eagerCharacterPhotoCount)) nextVisibleKeys.add(photo.key);
    visibleCharacterPhotoKeys.value = nextVisibleKeys;
    for (const [key, element] of observedCharacterPhotoElements) {
      if (availableKeys.has(key)) continue;
      characterPhotoObserver?.unobserve(element);
      observedCharacterPhotoElements.delete(key);
    }
  },
  { immediate: true }
);

watch(
  () => props.character,
  (nextCharacter) => Object.assign(characterDraft, cloneCharacterForDraft(nextCharacter)),
  { immediate: true, deep: true }
);

function cloneCharacterForDraft(character: CharacterProfile): CharacterDraft {
  return {
    ...character,
    localWorldBookIds: [...character.localWorldBookIds],
    minimaxVoiceId: String(character.minimaxVoiceId ?? '').trim(),
    imageProfile: createCharacterImageProfileDraft(character.imageProfile),
    themeStyleBindings: {
      onlinePresetId: String(character.themeStyleBindings?.onlinePresetId ?? '').trim(),
      offlinePresetId: String(character.themeStyleBindings?.offlinePresetId ?? '').trim()
    },
    mcpBinding: {
      overrideGlobal: Boolean(character.mcpBinding?.overrideGlobal),
      serverIds: [...(character.mcpBinding?.serverIds ?? [])]
    }
  };
}

function createCharacterImageProfileDraft(profile: Partial<CharacterImageProfile> | null | undefined): CharacterImageProfile {
  return {
    appearancePrompt: String(profile?.appearancePrompt ?? '').trim(),
    facePrompt: String(profile?.facePrompt ?? '').trim(),
    referenceImage: String(profile?.referenceImage ?? '').trim(),
    referenceImageEnabled: profile?.referenceImageEnabled !== false,
    voomPortraitModeEnabled: profile?.voomPortraitModeEnabled !== false,
    seed: String(profile?.seed ?? '').trim(),
    photos: normalizeCharacterPhotoRecords(profile?.photos),
    hiddenSourcePhotoKeys: normalizeHiddenSourcePhotoKeys(profile?.hiddenSourcePhotoKeys)
  };
}

function normalizeCharacterImageProfileDraft(profile: CharacterImageProfile): CharacterImageProfile | undefined {
  const normalized = createCharacterImageProfileDraft(profile);
  return normalized.appearancePrompt || normalized.facePrompt || normalized.referenceImage || normalized.seed || normalized.voomPortraitModeEnabled === false || normalized.photos.length || normalized.hiddenSourcePhotoKeys.length ? normalized : undefined;
}

function createThemeStyleOptions(scope: ThemeStyleBindingScope, presets: ThemeStylePreset[]) {
  const defaultPresetId = scope === 'online' ? defaultOnlineThemePresetId : defaultOfflineThemePresetId;
  const defaultPresetName = scope === 'online' ? '默认线上样式' : '默认线下样式';
  const globalPresetName = scope === 'online' ? '跟随全局线上样式' : '跟随全局线下样式';
  return [
    { id: '', name: globalPresetName },
    { id: defaultPresetId, name: defaultPresetName },
    ...presets.map((preset) => ({ id: preset.id, name: preset.name }))
  ];
}

function saveDraft() {
  void store.saveConversationSettings({ ...draft, conversationId: props.conversationId });
}

function clampRgbValue(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(255, Math.max(0, Math.round(value)));
}

function componentToHex(value: number) {
  return clampRgbValue(value).toString(16).padStart(2, '0');
}

function rgbToHex({ red, green, blue }: RgbParts) {
  return `#${componentToHex(red)}${componentToHex(green)}${componentToHex(blue)}`;
}

function rgbParts(color: string): RgbParts {
  const normalized = color.trim();
  const hexMatch = normalized.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (hexMatch) {
    return {
      red: Number.parseInt(hexMatch[1], 16),
      green: Number.parseInt(hexMatch[2], 16),
      blue: Number.parseInt(hexMatch[3], 16)
    };
  }

  const rgbMatch = normalized.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgbMatch) {
    return {
      red: clampRgbValue(Number(rgbMatch[1])),
      green: clampRgbValue(Number(rgbMatch[2])),
      blue: clampRgbValue(Number(rgbMatch[3]))
    };
  }

  return { red: 255, green: 255, blue: 255 };
}

function updateRgbColor(field: ColorField, channel: RgbChannel, event: Event) {
  const input = event.target as HTMLInputElement;
  const nextParts = {
    ...rgbParts(draft.appearance[field]),
    [channel]: clampRgbValue(Number(input.value))
  };
  draft.appearance[field] = rgbToHex(nextParts) as ChatAppearanceSettings[ColorField];
  saveDraft();
}

function updateAutoGenerateVoom(event: Event) {
  draft.autoGenerateVoom = (event.target as HTMLInputElement).checked;
  saveDraft();
}

function updateVoomFrequency(event: Event) {
  draft.voomFrequency = normalizeVoomFrequency((event.target as HTMLSelectElement).value, draft.voomFrequency);
  saveDraft();
}

function updateVoomImageMode(event: Event) {
  const mode = (event.target as HTMLSelectElement).value as VoomImageMode;
  if (!voomImageModeOptions.some((option) => option.value === mode)) return;
  draft.voomImageMode = mode;
  saveDraft();
}

function updateVoomImageEnabled(event: Event) {
  draft.voomImageEnabled = (event.target as HTMLInputElement).checked;
  saveDraft();
}

function updateVoomImageFrequency(event: Event) {
  draft.voomImageFrequency = normalizeVoomFrequency((event.target as HTMLSelectElement).value, draft.voomImageFrequency);
  saveDraft();
}

function updateAutoGenerateTheater(event: Event) {
  draft.autoGenerateTheater = (event.target as HTMLInputElement).checked;
  saveDraft();
}

function updateTheaterFrequency(event: Event) {
  draft.theaterFrequency = normalizeVoomFrequency((event.target as HTMLSelectElement).value, draft.theaterFrequency);
  saveDraft();
}

function updateProactiveReplyEnabled(event: Event) {
  draft.proactiveReply.enabled = (event.target as HTMLInputElement).checked;
  saveDraft();
}

function updateProactiveReplyFrequency(event: Event) {
  draft.proactiveReply.frequency = normalizeVoomFrequency((event.target as HTMLSelectElement).value, draft.proactiveReply.frequency);
  saveDraft();
}

function updateOfflineInvitationEnabled(event: Event) {
  draft.offlineInvitationEnabled = (event.target as HTMLInputElement).checked;
  saveDraft();
}

function normalizeSelectedStickerGroupIds(groupIds: string[]) {
  const selectedIds = new Set(groupIds.map((groupId) => groupId.trim()).filter(Boolean));
  return store.sortedStickerGroups.map((group) => group.id).filter((groupId) => selectedIds.has(groupId));
}

async function toggleStickerGroupFromSelect(event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return;
  const groupId = event.target.value;
  if (!groupId || groupId === stickerGroupSelectValue) return;
  event.target.value = stickerGroupSelectValue;
  const groupIds = new Set(draft.characterStickerGroupIds);
  if (groupIds.has(groupId)) groupIds.delete(groupId);
  else groupIds.add(groupId);
  const nextSettings = normalizeConversationSettings({
    ...draft,
    conversationId: props.conversationId,
    characterStickerGroupIds: normalizeSelectedStickerGroupIds([...groupIds])
  }, props.conversationId, 'online');
  Object.assign(draft, nextSettings);
  await store.saveConversationSettings(nextSettings);
  Object.assign(draft, normalizeConversationSettings(store.settingsForConversation(props.conversationId), props.conversationId, 'online'));
}

function saveCharacterDraft() {
  void store.saveCharacter({
    ...characterDraft,
    localWorldBookIds: [...characterDraft.localWorldBookIds],
    imageProfile: normalizeCharacterImageProfileDraft(characterDraft.imageProfile),
    themeStyleBindings: {
      onlinePresetId: String(characterDraft.themeStyleBindings?.onlinePresetId ?? '').trim(),
      offlinePresetId: String(characterDraft.themeStyleBindings?.offlinePresetId ?? '').trim()
    },
    mcpBinding: {
      overrideGlobal: Boolean(characterDraft.mcpBinding?.overrideGlobal),
      serverIds: [...new Set(characterDraft.mcpBinding?.serverIds ?? [])]
    }
  });
}

function isMcpServerAppliedToCharacter(server: McpServerConfig) {
  if (!server.enabled) return false;
  return characterMcpBinding.value.overrideGlobal
    ? characterMcpBinding.value.serverIds.includes(server.id)
    : server.globalEnabled;
}

function characterMcpServerStatus(server: McpServerConfig) {
  if (characterMcpBinding.value.overrideGlobal) {
    return characterMcpBinding.value.serverIds.includes(server.id) ? '该角色单独启用' : '该角色未启用';
  }
  return server.globalEnabled ? '继承全局应用' : '全局未应用';
}

function updateCharacterMcpOverride(event: Event) {
  const overrideGlobal = (event.target as HTMLInputElement).checked;
  const currentIds = characterMcpBinding.value.serverIds.filter((serverId) => configuredMcpServers.value.some((server) => server.id === serverId));
  characterDraft.mcpBinding = {
    overrideGlobal,
    serverIds: currentIds.length ? currentIds : [...inheritedMcpServerIds.value]
  };
  saveCharacterDraft();
}

function toggleCharacterMcpServer(server: McpServerConfig, event: Event) {
  if (!characterMcpBinding.value.overrideGlobal || !server.enabled) return;
  const serverIds = new Set(characterMcpBinding.value.serverIds);
  if ((event.target as HTMLInputElement).checked) serverIds.add(server.id);
  else serverIds.delete(server.id);
  characterDraft.mcpBinding = {
    overrideGlobal: true,
    serverIds: configuredMcpServers.value.map((entry) => entry.id).filter((serverId) => serverIds.has(serverId))
  };
  saveCharacterDraft();
}

function updateCharacterThemeStyleBinding(scope: ThemeStyleBindingScope, event: Event) {
  const presetId = (event.target as HTMLSelectElement).value.trim();
  characterDraft.themeStyleBindings = {
    onlinePresetId: String(characterDraft.themeStyleBindings?.onlinePresetId ?? '').trim(),
    offlinePresetId: String(characterDraft.themeStyleBindings?.offlinePresetId ?? '').trim(),
    [`${scope}PresetId`]: presetId
  };
  saveCharacterDraft();
}

function toggleLocalWorldBookFromSelect(event: Event) {
  if (!(event.target instanceof HTMLSelectElement)) return;
  const bookId = event.target.value;
  if (!bookId || bookId === localWorldBookSelectValue) return;
  event.target.value = localWorldBookSelectValue;
  const ids = new Set(characterDraft.localWorldBookIds);
  if (ids.has(bookId)) ids.delete(bookId);
  else ids.add(bookId);
  characterDraft.localWorldBookIds = localWorldBooks.value.map((book) => book.id).filter((id) => ids.has(id));
  saveCharacterDraft();
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function syncBackgroundImages(images: string[], activeImage = draft.appearance.backgroundImage) {
  const normalizedImages = [...new Set(images.map((image) => image.trim()).filter(Boolean))];
  draft.appearance.backgroundImages = normalizedImages;
  draft.appearance.backgroundImage = normalizedImages.includes(activeImage) ? activeImage : normalizedImages[0] ?? '';
  saveDraft();
}

function addBackgroundImages(images: string[]) {
  const nextImages = [...draft.appearance.backgroundImages, ...images];
  const activeImage = images[images.length - 1]?.trim() || draft.appearance.backgroundImage;
  syncBackgroundImages(nextImages, activeImage);
}

function addBackgroundImageFromUrl() {
  const image = backgroundImageUrlDraft.value.trim();
  if (!image) return;
  addBackgroundImages([image]);
  backgroundImageUrlDraft.value = '';
}

async function readAppearanceFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (!files.length) return;
  const images = (await Promise.all(files.map((file) => readFileAsDataUrl(file)))).filter(Boolean);
  if (images.length) addBackgroundImages(images);
  input.value = '';
}

function applyBackgroundImage(image: string) {
  if (!image.trim()) return;
  syncBackgroundImages(draft.appearance.backgroundImages, image.trim());
}

function removeBackgroundImage(image: string) {
  const nextImages = draft.appearance.backgroundImages.filter((item) => item !== image);
  syncBackgroundImages(nextImages, draft.appearance.backgroundImage === image ? nextImages[0] ?? '' : draft.appearance.backgroundImage);
}

function saveCharacterPhotos(photos: CharacterPhotoRecord[]) {
  characterDraft.imageProfile.photos = normalizeCharacterPhotoRecords(photos);
  saveCharacterDraft();
}

function addCharacterPhotos(photos: CharacterPhotoRecord[]) {
  const existingUrls = new Set(characterDraft.imageProfile.photos.map((photo) => photo.imageUrl.trim()).filter(Boolean));
  const nextPhotos = [...characterDraft.imageProfile.photos];
  for (const photo of photos) {
    const imageUrl = photo.imageUrl.trim();
    if (!imageUrl || existingUrls.has(imageUrl)) continue;
    existingUrls.add(imageUrl);
    nextPhotos.unshift(photo);
  }
  saveCharacterPhotos(nextPhotos);
}

function addCharacterPhotoFromUrl() {
  const imageUrl = characterPhotoUrlDraft.value.trim();
  if (!imageUrl) return;
  addCharacterPhotos([createCharacterPhotoRecord({ imageUrl, source: 'manual-url', title: '角色照片' })]);
  characterPhotoUrlDraft.value = '';
}

async function readCharacterPhotoFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []).filter((file) => file.type.startsWith('image/'));
  if (!files.length) {
    input.value = '';
    return;
  }
  const images = (await Promise.all(files.map(async (file) => ({ file, imageUrl: await readFileAsDataUrl(file) })))).filter((entry) => entry.imageUrl);
  addCharacterPhotos(images.map(({ file, imageUrl }) => createCharacterPhotoRecord({
    imageUrl,
    source: 'manual-local',
    title: file.name || '本地角色照片'
  })));
  input.value = '';
}

async function downloadCharacterPhoto(photo: CharacterPhotoItem) {
  try {
    await downloadImageUrl(photo.imageUrl, `${characterDraftNickname.value}-${photo.sourceLabel}-${photo.createdAt || Date.now()}`);
  } catch (error) {
    store.showConfigAlert(error instanceof Error ? error.message : '图片下载失败。', '无法下载');
  }
}

function removeCharacterPhoto(photo: CharacterPhotoItem) {
  if (photo.photoId) {
    saveCharacterPhotos(characterDraft.imageProfile.photos.filter((entry) => entry.id !== photo.photoId));
    return;
  }
  characterDraft.imageProfile.hiddenSourcePhotoKeys = normalizeHiddenSourcePhotoKeys([...characterDraft.imageProfile.hiddenSourcePhotoKeys, photo.key]);
  saveCharacterDraft();
}

async function importCallAmbientSound(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    draft.call.ambientSound = await createCallAudioAsset(file, '通话氛围音');
    draft.call.ambientEnabled = true;
    saveDraft();
  } catch (error) {
    store.showConfigAlert(error instanceof Error ? error.message : '氛围音读取失败。', '无法导入氛围音');
  }
}

function resetCallAmbientSound() {
  draft.call.ambientSound = undefined;
  draft.call.ambientEnabled = false;
  saveDraft();
}

async function readAvatarFile(event: Event) {
  const image = await readImageFileFromInput(event);
  if (!image) return;
  avatarEditorSource.value = image;
  showAvatarEditor.value = true;
}

async function readReferenceImage(event: Event) {
  const image = await readImageFileFromInput(event);
  if (!image) return;
  characterDraft.imageProfile.referenceImage = image;
  characterDraft.imageProfile.referenceImageEnabled = true;
  saveCharacterDraft();
}

function applyEditedAvatar(value: string) {
  characterDraft.avatar = value;
  saveCharacterDraft();
}
</script>

<style scoped>
.control-panel {
  position: relative;
  display: grid;
  gap: 14px;
}

.panel-section {
  display: grid;
  gap: 14px;
}

.local-theme-style-block {
  display: grid;
  gap: 12px;
}

.image-profile-block {
  display: grid;
  gap: 12px;
}

.image-profile-grid {
  display: grid;
  gap: 10px;
}

.image-profile-row {
  width: 100%;
}

.image-reference-toggle {
  min-height: 62px;
}

.image-reference-card {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.68);
}

.image-reference-preview,
.image-reference-preview img,
.image-reference-preview span {
  width: 92px;
  height: 92px;
  border-radius: 16px;
}

.image-reference-preview {
  overflow: hidden;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.06);
}

.image-reference-preview img {
  display: block;
  object-fit: cover;
}

.image-reference-preview span {
  display: grid;
  place-items: center;
  color: #8b9095;
  font-size: 11px;
  font-weight: 950;
}

.image-reference-fields {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.image-reference-upload {
  min-height: 42px;
  padding: 10px 12px;
}

.character-photo-block {
  display: grid;
  gap: 12px;
}

.character-photo-import-panel {
  display: grid;
  gap: 8px;
}

.character-photo-url-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42px;
  gap: 8px;
  align-items: center;
}

.character-photo-url-row input {
  min-width: 0;
  min-height: 42px;
  padding: 0 12px;
  border: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
  color: #171717;
  font-size: 12px;
  font-weight: 780;
  box-shadow: inset 0 0 0 1px rgba(42, 75, 60, 0.08);
}

.character-photo-icon-button,
.character-photo-import-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 42px;
  border: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
  color: #171717;
  font-size: 12px;
  font-weight: 900;
  box-shadow: 0 8px 18px rgba(30, 55, 45, 0.04), inset 0 0 0 1px rgba(42, 75, 60, 0.08);
  cursor: pointer;
}

.character-photo-import-button {
  gap: 6px;
}

.character-photo-import-button input[type='file'] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  opacity: 0;
  cursor: pointer;
}

.character-photo-empty {
  min-width: 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.62);
  color: #7a8380;
  font-size: 11px;
  font-weight: 780;
  line-height: 1.45;
}

.character-photo-library {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.character-photo-card {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 8px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.74);
  box-shadow: inset 0 0 0 1px rgba(42, 75, 60, 0.07);
  content-visibility: auto;
  contain-intrinsic-size: 236px 320px;
}

.character-photo-thumb {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border: 0;
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(238, 243, 239, 0.95), rgba(218, 228, 223, 0.78));
}

.character-photo-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.character-photo-thumb::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 54%, rgba(0, 0, 0, 0.48));
}

.character-photo-thumb span {
  position: absolute;
  right: 7px;
  bottom: 7px;
  z-index: 1;
  max-width: calc(100% - 14px);
  overflow: hidden;
  padding: 4px 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  color: #1f6b3a;
  font-size: 10px;
  font-weight: 950;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.character-photo-meta {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.character-photo-meta strong,
.character-photo-meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.character-photo-meta strong {
  color: #171717;
  font-size: 12px;
  font-weight: 900;
}

.character-photo-meta span {
  color: #7a8380;
  font-size: 10px;
  font-weight: 800;
}

.character-photo-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.character-photo-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  min-height: 34px;
  padding: 0 8px;
  border: 0;
  border-radius: 12px;
  background: rgba(238, 248, 241, 0.94);
  color: #1f6b3a;
  font-size: 11px;
  font-weight: 900;
  line-height: 1.1;
  cursor: pointer;
}

.character-photo-actions button:last-child {
  background: rgba(255, 238, 241, 0.96);
  color: #d73850;
}

.local-theme-style-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.local-theme-style-field select {
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid rgba(17, 17, 17, 0.08);
  border-radius: 14px;
  outline: none;
  background: rgba(255, 255, 255, 0.86);
  color: #202326;
  font: inherit;
  font-weight: 850;
}

.memory-hero,
.profile-preview,
.upload-card,
.empty-note {
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

.memory-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
}

.memory-hero div {
  display: grid;
  gap: 4px;
}

.memory-hero span,
.memory-card p,
.empty-note,
.upload-card span,
.profile-preview span,
.switch-card span:not(.switch-track) {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.5;
}

.memory-hero strong {
  font-size: 22px;
}

.memory-hero p {
  margin: 0;
  color: #716d72;
  font-size: 12px;
  line-height: 1.5;
}

.memory-section-note,
.compact-field small,
.switch-card div span:not(.switch-track) {
  color: #777276;
  font-size: 11px;
  font-weight: 750;
  line-height: 1.45;
}

.section-header .memory-section-note,
.record-header .memory-section-note {
  display: block;
  margin-top: 3px;
  max-width: 100%;
  text-transform: none;
}

.manual-summary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 12px;
  border-radius: 999px;
  background: linear-gradient(135deg, #181717, #4a443f);
  color: #fffaf4;
  font-size: 13px;
  font-weight: 900;
  box-shadow: 0 12px 28px rgba(34, 27, 23, 0.22);
}

.manual-summary-button:disabled {
  opacity: 0.55;
}

.manual-summary-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 20px;
  background:
    radial-gradient(circle at top right, rgba(255, 235, 203, 0.9), transparent 38%),
    rgba(255, 255, 255, 0.72);
  box-shadow: 0 18px 46px rgba(73, 57, 43, 0.12);
}

.range-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.manual-summary-card p {
  margin: 0;
  color: #7a7473;
  font-size: 12px;
  line-height: 1.5;
}

.manual-summary-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.summary-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  background: #22201e;
  color: #ffffff;
  font-weight: 900;
}

.summary-submit:disabled {
  background: #c9c2bb;
  color: #fffaf4;
}

.memory-strategy-stack {
  display: grid;
  gap: 12px;
}

.strategy-group {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.52);
  box-shadow: inset 0 0 0 1px rgba(36, 32, 29, 0.03);
}

.strategy-copy {
  display: grid;
  gap: 4px;
}

.strategy-copy span {
  color: #a7774f;
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0;
  text-transform: uppercase;
}

.strategy-copy strong {
  color: #24201e;
  font-size: 15px;
  font-weight: 950;
}

.strategy-copy small {
  color: #777276;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.55;
}

.memory-toggle-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.strategy-control-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.strategy-wide-control {
  grid-column: 1 / -1;
}

.memory-run-action {
  min-height: 54px;
  border-radius: 18px;
  white-space: normal;
}

.memory-timeline-block {
  gap: 12px;
}

.timeline-dashboard strong {
  font-size: 16px;
}

.memory-timeline-list {
  display: grid;
  gap: 14px;
  padding: 2px 0;
}

.list-more-action {
  min-height: 42px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
  color: #326743;
  font-size: 12px;
  font-weight: 950;
  box-shadow: inset 0 0 0 1px rgba(31, 107, 58, 0.08);
}

.memory-timeline-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-width: 0;
}

.timeline-copy {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 8px;
  border: 1px solid rgba(20, 24, 22, 0.05);
  border-radius: 11px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(249, 252, 250, 0.86)),
    rgba(255, 255, 255, 0.82);
}

.timeline-grand .timeline-copy {
  border-color: rgba(6, 199, 85, 0.12);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(241, 252, 246, 0.88)),
    rgba(255, 255, 255, 0.88);
}

.timeline-merged .timeline-copy {
  border-color: rgba(48, 112, 73, 0.16);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(236, 249, 243, 0.9)),
    rgba(255, 255, 255, 0.9);
  box-shadow: inset 3px 0 0 rgba(6, 199, 85, 0.34);
}

.timeline-card-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.timeline-card-heading > span {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
}

.timeline-card-heading em {
  min-width: 0;
  color: #6d8a73;
  font-size: 8px;
  font-weight: 950;
  line-height: 1.2;
  font-style: normal;
  overflow-wrap: anywhere;
}

.timeline-card-heading strong {
  color: #171717;
  font-size: 11px;
  font-weight: 950;
  line-height: 1.25;
  white-space: nowrap;
}

.timeline-card-heading svg {
  flex: 0 0 auto;
  color: #6d8a73;
  transition: transform 160ms ease;
}

.timeline-card-heading[aria-expanded='true'] svg {
  transform: rotate(180deg);
}

.timeline-summary-display {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.timeline-summary-heading {
  margin: 1px 0 0;
  color: #171717;
  font-size: 10px;
  font-weight: 950;
  line-height: 1.3;
}

.timeline-summary-field {
  display: grid;
  gap: 3px;
  padding: 6px;
  border-radius: 9px;
  background: rgba(237, 242, 239, 0.82);
}

.timeline-summary-event {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 8px;
  border: 1px solid rgba(6, 199, 85, 0.14);
  border-radius: 11px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(247, 252, 249, 0.78)),
    rgba(255, 255, 255, 0.82);
  box-shadow: inset 3px 0 0 rgba(6, 199, 85, 0.34);
}

.timeline-summary-event header {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.timeline-summary-event header span {
  color: #4f785d;
  font-size: 8px;
  font-weight: 950;
  line-height: 1;
}

.timeline-summary-event header strong {
  color: #171717;
  font-size: 12px;
  font-weight: 950;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.timeline-summary-event dl {
  display: grid;
  gap: 5px;
  margin: 0;
}

.timeline-summary-event dt {
  margin: 0;
  color: #326743;
  font-size: 9px;
  font-weight: 950;
  line-height: 1.2;
}

.timeline-summary-event dd {
  margin: -2px 0 0;
  color: #303636;
  font-size: 10px;
  font-weight: 720;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.timeline-event-core {
  padding-bottom: 2px;
}

.timeline-foldout {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.timeline-foldout > button {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  max-width: 100%;
  min-height: 30px;
  padding: 0 8px 0 10px;
  border: 1px solid rgba(6, 199, 85, 0.12);
  border-radius: 9px;
  background: linear-gradient(90deg, rgba(6, 199, 85, 0.08), rgba(255, 255, 255, 0.72));
  color: #326743;
  font-size: 9px;
  font-weight: 950;
  line-height: 1;
  text-align: left;
  cursor: pointer;
}

.memory-panel .timeline-foldout > button {
  min-height: 30px;
  padding-block: 0;
  line-height: 1;
}

.timeline-foldout > button span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.timeline-foldout > button em {
  margin-left: auto;
  color: #6d8a73;
  font-style: normal;
  white-space: nowrap;
}

.timeline-foldout > button svg {
  flex: 0 0 auto;
  transition: transform 0.18s ease;
}

.timeline-foldout.is-open > button svg {
  transform: rotate(180deg);
}

.timeline-event-details dl {
  padding: 7px;
  border-radius: 9px;
  background: rgba(237, 244, 240, 0.7);
}

.timeline-block-foldout {
  padding: 2px 0;
}

.timeline-list-foldout {
  list-style: none;
}

.timeline-summary-list.nested-list {
  margin-top: 2px;
}

.timeline-summary-field span {
  color: #4f785d;
  font-size: 8px;
  font-weight: 950;
  line-height: 1;
  text-transform: uppercase;
}

.timeline-summary-field p,
.timeline-summary-paragraph,
.timeline-summary-list {
  margin: 0;
  color: #5f666b;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.42;
  overflow-wrap: anywhere;
}

.timeline-summary-list {
  display: grid;
  gap: 3px;
  padding-left: 13px;
}

.timeline-profile-table-shell {
  overflow-x: auto;
  border: 1px solid rgba(20, 24, 22, 0.06);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.82);
}

.timeline-profile-table-shell table {
  width: 100%;
  min-width: 390px;
  border-collapse: collapse;
  font-size: 10px;
  line-height: 1.3;
}

.timeline-profile-table-shell th,
.timeline-profile-table-shell td {
  padding: 5px 6px;
  border-bottom: 1px solid rgba(20, 24, 22, 0.06);
  text-align: left;
  vertical-align: top;
}

.timeline-profile-table-shell th {
  color: #326743;
  font-weight: 950;
  white-space: nowrap;
}

.timeline-profile-table-shell td {
  color: #303636;
  font-weight: 700;
}

.timeline-graph-card {
  overflow: hidden;
  border-radius: 10px;
  background:
    radial-gradient(circle at 50% 35%, rgba(6, 199, 85, 0.11), transparent 44%),
    #f7faf8;
}

.timeline-graph-card svg {
  display: block;
  width: 100%;
  height: 150px;
}

.timeline-graph-card marker path {
  fill: #6d8a73;
}

.graph-edges line {
  stroke: rgba(66, 99, 77, 0.42);
  stroke-width: 1.4;
}

.graph-edges text {
  fill: #5f7366;
  font-size: 8px;
  font-weight: 850;
  text-anchor: middle;
  paint-order: stroke;
  stroke: rgba(247, 250, 248, 0.92);
  stroke-width: 4px;
}

.graph-node rect {
  fill: rgba(255, 255, 255, 0.94);
  stroke: rgba(6, 199, 85, 0.18);
  stroke-width: 1;
}

.graph-node text {
  fill: #171717;
  font-size: 9px;
  font-weight: 950;
  text-anchor: middle;
}

.timeline-summary-code {
  display: grid;
  gap: 4px;
  max-height: 150px;
  margin: 0;
  padding: 6px;
  overflow: auto;
  border-radius: 9px;
  background: #202421;
  color: #f7fff9;
  font-size: 9px;
  line-height: 1.38;
  white-space: pre;
}

.timeline-summary-code span {
  color: #b9d8c2;
  font-size: 8px;
  font-weight: 950;
  text-transform: uppercase;
}

.timeline-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.timeline-meta em {
  padding: 2px 5px;
  border-radius: 999px;
  background: rgba(6, 199, 85, 0.08);
  color: #277044;
  font-style: normal;
  font-size: 8px;
  font-weight: 900;
  line-height: 1;
}

.memory-timeline-row.is-archived .timeline-copy {
  background: rgba(244, 246, 245, 0.72);
  opacity: 0.82;
}

.compact-field {
  justify-content: center;
  min-height: 74px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
}

.compact-field input {
  min-height: 32px;
  border-radius: 12px;
}

.switch-card {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
}

.memory-strategy-block .switch-card,
.memory-strategy-block .compact-field,
.memory-strategy-block .memory-run-action {
  min-height: 62px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.7);
}

.memory-strategy-block .switch-card {
  align-items: start;
}

.switch-card.wide {
  grid-template-columns: auto minmax(0, 1fr);
}

.switch-card.compact-switch {
  min-height: 34px;
  padding: 8px 10px;
  border-radius: 12px;
}

.compact-switch .switch-track {
  width: 38px;
  height: 22px;
}

.compact-switch .switch-track::after {
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
}

.compact-switch input:checked + .switch-track::after {
  transform: translateX(16px);
}

.switch-card input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.switch-track {
  position: relative;
  width: 42px;
  height: 24px;
  border-radius: 999px;
  background: #d8d2cf;
  transition: background 0.18s ease;
}

.switch-track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 3px 8px rgba(42, 35, 31, 0.2);
  transition: transform 0.18s ease;
}

.switch-card input:checked + .switch-track {
  background: #24211f;
}

.switch-card input:checked + .switch-track::after {
  transform: translateX(18px);
}

.switch-card div {
  display: grid;
  gap: 3px;
}

.switch-card strong {
  font-size: 13px;
}

.sticker-bind-trigger {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 38px;
  padding: 8px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  color: #24201e;
  text-align: left;
}

.sticker-bind-trigger span {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.sticker-bind-trigger strong,
.sticker-bind-trigger small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sticker-bind-trigger strong {
  font-size: 13px;
  font-weight: 900;
}

.sticker-bind-trigger small {
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
}

.sticker-bind-trigger svg {
  flex: 0 0 auto;
  color: #4f4844;
}

.sticker-group-popover {
  display: grid;
  gap: 4px;
  padding: 6px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 0 0 1px rgba(36, 32, 29, 0.06);
}

.sticker-group-option {
  grid-template-columns: auto minmax(0, 1fr);
  color: #28231f;
  font-weight: 800;
}

.sticker-group-option:active {
  background: rgba(36, 32, 29, 0.06);
}

.sticker-group-name {
  min-width: 0;
  overflow: hidden;
  color: #28231f;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time-awareness-note {
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.6;
}

.model-picker-field {
  display: grid;
  gap: 9px;
}

.model-picker-field > span {
  color: #686b70;
  font-size: 12px;
  font-weight: 800;
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
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 5px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.58);
}

.model-select-shell img {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  object-fit: cover;
  background: var(--soft);
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

.model-default,
.model-choice {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 34px;
  padding: 0 11px;
  border: 1px solid rgba(36, 32, 29, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.68);
  color: #34302d;
  font-size: 12px;
  font-weight: 800;
}

.model-default.active,
.model-choice.active {
  border-color: rgba(28, 26, 24, 0.82);
  background: #1e1c1a;
  color: #ffffff;
}

.provider-model-list {
  display: grid;
  gap: 10px;
}

.provider-model-card {
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.68);
}

.provider-model-card header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-model-card img {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  object-fit: cover;
  background: var(--soft);
}

.provider-model-card strong {
  font-size: 13px;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.appearance-tools-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.appearance-tool-card {
  min-width: 0;
  min-height: 82px;
  justify-content: start;
  padding: 10px;
}

.appearance-tool-card input {
  min-width: 0;
}

.appearance-upload-card {
  position: relative;
  cursor: pointer;
}

.appearance-upload-card input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.appearance-color-field input[type='color'] {
  width: 100%;
  min-height: 32px;
  padding: 3px;
}

.profile-avatar-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  align-items: stretch;
}

.profile-avatar-grid .field,
.profile-avatar-grid .upload-card {
  min-width: 0;
}

.profile-avatar-grid .upload-card {
  padding: 10px;
}

.profile-avatar-grid input {
  min-width: 0;
}

.memory-records {
  display: grid;
  gap: 10px;
}

.memory-records > header,
.memory-card-head,
.memory-actions,
.profile-preview {
  display: flex;
  align-items: center;
}

.memory-records > header,
.memory-card-head {
  justify-content: space-between;
  gap: 10px;
}

.memory-records > header span,
.memory-card-head span {
  color: var(--muted);
  font-size: 12px;
}

.merge-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.merge-picker {
  display: grid;
  gap: 8px;
  padding: 10px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.68);
}

.merge-row {
  grid-template-columns: auto minmax(0, 1fr);
  background: rgba(244, 242, 242, 0.82);
  color: #302c29;
  font-size: 12px;
  font-weight: 800;
}

.merge-row span:not(.switch-track) {
  color: #302c29;
}

.button-row {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 10px;
}

.memory-card {
  display: grid;
  gap: 9px;
  padding: 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.8);
}

.memory-card p {
  margin: 0;
}

.memory-card textarea {
  min-height: 96px;
  padding: 10px;
  border: 0;
  border-radius: 12px;
  outline: 0;
  background: #f4f2f2;
  resize: vertical;
}

.memory-hidden-editor {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
  gap: 8px;
  align-items: end;
}

.memory-hidden-editor label {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.memory-hidden-editor span {
  color: #746f70;
  font-size: 11px;
  font-weight: 850;
}

.memory-hidden-editor input {
  width: 100%;
  min-height: 34px;
  border-radius: 10px;
}

.memory-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  flex-wrap: wrap;
  gap: 8px;
}

.danger-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 8px;
  background: rgba(239, 68, 90, 0.12);
  color: var(--danger);
  font-weight: 800;
}

.upload-card {
  display: grid;
  gap: 5px;
  padding: 12px;
}

.upload-card input {
  min-height: 34px;
}

.profile-preview {
  gap: 10px;
  padding: 12px;
}

.profile-preview div {
  display: grid;
  gap: 3px;
}

.empty-note {
  padding: 12px;
}

.control-panel {
  gap: 16px;
  color: #171717;
}

.panel-section {
  gap: 12px;
}

.settings-block {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(19, 24, 22, 0.06);
  border-radius: 20px;
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.96), rgba(247, 250, 248, 0.9)),
    radial-gradient(circle at top right, rgba(6, 199, 85, 0.09), transparent 34%);
  box-shadow: 0 14px 34px rgba(16, 24, 20, 0.07);
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.section-header div {
  display: grid;
  gap: 2px;
}

.section-header span {
  color: #8a8f94;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.section-header strong {
  color: #161616;
  font-size: 16px;
  font-weight: 900;
  letter-spacing: 0;
}

.compact-header strong {
  font-size: 14px;
}

.memory-hero,
.profile-preview {
  padding: 18px;
  border: 1px solid rgba(19, 24, 22, 0.05);
  border-radius: 24px;
  background:
    radial-gradient(circle at 92% 4%, rgba(6, 199, 85, 0.16), transparent 34%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(247, 249, 248, 0.92));
  box-shadow: 0 18px 42px rgba(18, 25, 22, 0.08);
}

.memory-hero {
  align-items: flex-start;
  min-height: 118px;
}

.memory-hero span,
.profile-preview span {
  color: #8a8f94;
  font-size: 12px;
  font-weight: 700;
}

.memory-hero strong {
  color: #0f1111;
  font-size: 28px;
  line-height: 1;
  letter-spacing: 0;
}

.memory-hero p {
  max-width: 210px;
  color: #74797d;
  font-size: 12px;
}

.manual-summary-button,
.summary-submit {
  min-height: 40px;
  border-radius: 14px;
  background: #171717;
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(17, 17, 17, 0.18);
}

.manual-summary-button {
  flex: 0 0 auto;
  padding: 0 16px;
}

.manual-summary-button:active,
.summary-submit:active {
  transform: translateY(1px);
}

.manual-summary-card {
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(251, 248, 245, 0.92)),
    radial-gradient(circle at top right, rgba(240, 168, 123, 0.16), transparent 34%);
}

.manual-summary-card p {
  color: #797d82;
}

.memory-toggle-grid,
.display-options-grid {
  gap: 9px;
}

.switch-card,
.compact-field,
.sticker-bind-trigger,
.field input,
.field textarea,
.field select,
.upload-card,
.time-awareness-note,
.empty-note,
.memory-card,
.merge-picker {
  border: 1px solid rgba(20, 24, 22, 0.05);
  border-radius: 16px;
  background: #f6f7f7;
  box-shadow: none;
}

.switch-card {
  min-height: 58px;
  padding: 12px;
}

.switch-card strong,
.sticker-bind-trigger strong {
  color: #171717;
  font-size: 14px;
  font-weight: 900;
}

.switch-card span:not(.switch-track),
.sticker-bind-trigger small,
.time-awareness-note,
.empty-note {
  color: #85898e;
  font-size: 12px;
}

.switch-track {
  width: 46px;
  height: 28px;
  background: #dedad7;
}

.switch-track::after {
  top: 4px;
  left: 4px;
  width: 20px;
  height: 20px;
}

.switch-card input:checked + .switch-track {
  background: #171717;
}

.switch-card input:checked + .switch-track::after {
  transform: translateX(18px);
}

.compact-switch .switch-track {
  width: 38px;
  height: 22px;
}

.compact-switch .switch-track::after {
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
}

.compact-switch input:checked + .switch-track::after {
  transform: translateX(16px);
}

.compact-field {
  min-height: 76px;
  justify-content: center;
}

.field > span {
  color: #767b81;
  font-size: 12px;
  font-weight: 800;
}

.field input,
.field textarea,
.field select {
  min-height: 42px;
  padding: 10px 12px;
  color: #171717;
  font-weight: 700;
}

.field textarea {
  min-height: 112px;
  line-height: 1.55;
}

.model-select-shell {
  min-height: 48px;
  border: 1px solid rgba(20, 24, 22, 0.05);
  background: #f6f7f7;
}

.model-select-field select {
  background: transparent;
}

.record-header em {
  align-self: center;
  color: #898e93;
  font-style: normal;
  font-size: 12px;
  font-weight: 800;
}

.merge-actions,
.manual-summary-actions,
.memory-actions {
  gap: 8px;
}

.secondary-action,
.danger-action {
  min-height: 40px;
  border-radius: 14px;
  font-weight: 900;
}

.secondary-action {
  background: #eef0f1;
  color: #171717;
}

.secondary-action:disabled,
.summary-submit:disabled {
  background: #ece9e7;
  color: #aba7a4;
  box-shadow: none;
}

.danger-action {
  background: rgba(239, 68, 90, 0.11);
}

.memory-card {
  gap: 10px;
  padding: 12px;
}

.memory-card textarea {
  min-height: 104px;
  border: 1px solid rgba(20, 24, 22, 0.05);
  background: #ffffff;
}

.appearance-tools-grid,
.color-grid,
.profile-avatar-grid {
  gap: 9px;
}

.appearance-tool-card,
.color-card,
.profile-avatar-grid .field,
.profile-avatar-grid .upload-card {
  min-height: 88px;
}

.appearance-tool-card,
.color-card {
  padding: 12px;
}

.color-card input[type='color'],
.appearance-color-field input[type='color'] {
  min-height: 38px;
  padding: 4px;
  border-radius: 12px;
  background: #ffffff;
}

.upload-card {
  position: relative;
  align-content: center;
  gap: 4px;
  padding: 12px;
  cursor: pointer;
}

.upload-card strong {
  color: #171717;
  font-size: 14px;
  font-weight: 900;
}

.upload-card input[type='file'] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  opacity: 0;
  cursor: pointer;
}

.profile-preview {
  gap: 14px;
}

.profile-preview .avatar {
  width: 60px;
  height: 60px;
  border: 3px solid #ffffff;
  box-shadow: 0 10px 24px rgba(18, 25, 22, 0.12);
}

.profile-preview strong {
  color: #171717;
  font-size: 17px;
  font-weight: 900;
}

.sticker-bind-trigger {
  min-height: 56px;
  padding: 12px;
}

.sticker-group-popover {
  gap: 7px;
  padding: 8px;
  border: 1px solid rgba(20, 24, 22, 0.05);
  background: #ffffff;
}

.time-awareness-note {
  padding: 12px;
  line-height: 1.55;
}

.control-panel button,
.setting-action-button,
.secondary-action,
.danger-action,
.summary-submit,
.manual-summary-button,
.sticker-bind-trigger,
.background-thumb-actions button {
  transition: transform 0.16s ease, box-shadow 0.16s ease, background 0.16s ease, opacity 0.16s ease;
}

.control-panel button:active,
.setting-action-button:active,
.secondary-action:active,
.danger-action:active,
.summary-submit:active,
.manual-summary-button:active,
.sticker-bind-trigger:active,
.background-thumb-actions button:active {
  transform: translateY(1px);
}

.manual-summary-button,
.summary-submit,
.setting-action-button,
.secondary-action,
.danger-action,
.background-thumb-actions button {
  min-height: 42px;
  border-radius: 13px;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0;
}

.manual-summary-button,
.summary-submit,
.primary-setting-action {
  background: linear-gradient(145deg, #181818, #31302d);
  color: #ffffff;
  box-shadow: 0 12px 22px rgba(22, 22, 22, 0.16);
}

.secondary-action,
.background-thumb-actions button:first-child {
  background: #edf1ef;
  color: #171717;
  box-shadow: inset 0 0 0 1px rgba(23, 23, 23, 0.04);
}

.danger-action,
.background-thumb-actions button:last-child {
  background: rgba(239, 68, 90, 0.1);
  color: #d73850;
  box-shadow: inset 0 0 0 1px rgba(239, 68, 90, 0.08);
}

.secondary-action:disabled,
.summary-submit:disabled,
.background-thumb-actions button:disabled {
  transform: none;
  background: #ebe8e5;
  color: #aaa5a0;
  box-shadow: none;
  cursor: default;
}

.memory-records {
  gap: 12px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 249, 0.9)),
    radial-gradient(circle at 12% 0%, rgba(6, 199, 85, 0.09), transparent 32%);
}

.memory-card {
  position: relative;
  gap: 12px;
  padding: 15px 14px 14px 18px;
  border: 1px solid rgba(50, 43, 35, 0.08);
  border-radius: 18px;
  background:
    linear-gradient(90deg, rgba(224, 217, 205, 0.58) 0 8px, transparent 8px),
    linear-gradient(180deg, #fffdf9 0%, #fbfaf6 100%);
  box-shadow: 0 16px 28px rgba(36, 30, 24, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.memory-card::after {
  content: '';
  position: absolute;
  inset: 14px 12px 14px auto;
  width: 18px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, rgba(77, 67, 55, 0.05));
  pointer-events: none;
}

.memory-card-head {
  align-items: flex-start;
}

.memory-card-head div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.memory-card-head span {
  color: #9b8f82;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.memory-card-head strong {
  color: #221f1c;
  font-size: 15px;
  font-weight: 900;
}

.memory-card-head em {
  flex: 0 0 auto;
  padding: 4px 8px;
  border-radius: 999px;
  background: #eef8f1;
  color: #1f6b3a;
  font-style: normal;
  font-size: 10px;
  font-weight: 900;
}

.memory-card textarea {
  min-height: 178px;
  padding: 14px 14px 14px 16px;
  border: 1px solid rgba(84, 74, 62, 0.08);
  border-radius: 14px;
  background:
    repeating-linear-gradient(180deg, transparent 0 27px, rgba(70, 60, 48, 0.045) 28px),
    rgba(255, 255, 255, 0.72);
  color: #2a2723;
  font-size: 13px;
  line-height: 1.85;
}

.memory-empty-note {
  min-height: 96px;
  display: grid;
  place-items: center;
  text-align: center;
  background:
    linear-gradient(90deg, rgba(224, 217, 205, 0.44) 0 8px, transparent 8px),
    #fffdf9;
  color: #8b847d;
}

.background-manager {
  display: grid;
  gap: 10px;
}

.background-url-card,
.background-upload-card,
.background-color-card {
  min-height: 84px;
  padding: 12px;
  border: 1px solid rgba(20, 24, 22, 0.05);
  border-radius: 16px;
  background: #f6f8f7;
}

.inline-input-action {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
}

.inline-input-action input {
  min-width: 0;
}

.setting-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  padding: 0 12px;
}

.background-color-card input[type='color'] {
  width: 100%;
  min-height: 42px;
  padding: 5px;
  border-radius: 13px;
  background: #ffffff;
}

.background-library {
  display: grid;
  gap: 10px;
}

.background-thumb-card {
  display: grid;
  gap: 8px;
  padding: 9px;
  border: 1px solid rgba(20, 24, 22, 0.06);
  border-radius: 18px;
  background: #ffffff;
}

.background-thumb-card.active {
  border-color: rgba(6, 199, 85, 0.36);
  box-shadow: 0 12px 24px rgba(6, 199, 85, 0.09);
}

.background-thumb {
  position: relative;
  display: grid;
  align-items: end;
  width: 100%;
  min-height: 118px;
  padding: 10px;
  border-radius: 14px;
  overflow: hidden;
  background-color: #eef1ef;
  background-position: center;
  background-size: cover;
  color: #ffffff;
  text-align: left;
}

.background-thumb::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 28%, rgba(0, 0, 0, 0.35));
}

.background-thumb span {
  position: relative;
  width: fit-content;
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.72);
  font-size: 11px;
  font-weight: 900;
}

.background-thumb-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.background-thumb-actions button {
  min-height: 36px;
}

.compact-empty-note {
  min-height: 72px;
  display: grid;
  place-items: center;
  text-align: center;
}

.bubble-preview {
  display: grid;
  gap: 10px;
  min-height: 154px;
  padding: 14px;
  border: 1px solid rgba(20, 24, 22, 0.06);
  border-radius: 18px;
  background-position: center;
  background-size: cover;
  box-shadow: inset 0 0 0 999px rgba(255, 255, 255, 0.26);
}

.preview-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.user-preview-row {
  justify-content: flex-end;
}

.narration-preview-row {
  justify-content: center;
}

.preview-bubble {
  max-width: 76%;
  padding: 9px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.45;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
}

.character-preview-row .preview-bubble {
  border-bottom-left-radius: 6px;
}

.user-preview-row .preview-bubble {
  border-bottom-right-radius: 6px;
}

.narration-preview-bubble {
  font-style: italic;
}

.rgb-input-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.rgb-input-row input {
  min-width: 0;
  min-height: 32px;
  padding: 0 4px;
  border-radius: 10px;
  text-align: center;
}

.beauty-panel .bubble-color-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 8px;
}

.beauty-panel .bubble-color-grid .color-card {
  gap: 7px;
  min-height: 0;
  padding: 10px;
  overflow: hidden;
  border-radius: 16px;
}

.beauty-panel .bubble-color-grid .color-card > span {
  overflow: hidden;
  color: #626d68;
  font-size: 11px;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.beauty-panel .bubble-color-grid .color-card input[type='color'] {
  min-height: 30px;
  height: 30px;
  padding: 3px;
  border-radius: 10px;
}

.beauty-panel .bubble-color-grid .rgb-input-row {
  gap: 4px;
}

.beauty-panel .bubble-color-grid .rgb-input-row input {
  min-height: 30px;
  padding: 0 1px;
  font-size: 11px;
  font-weight: 800;
  appearance: textfield;
}

.beauty-panel .bubble-color-grid .rgb-input-row input::-webkit-inner-spin-button,
.beauty-panel .bubble-color-grid .rgb-input-row input::-webkit-outer-spin-button {
  margin: 0;
  appearance: none;
}

.display-options-grid {
  grid-template-columns: 1fr;
}

.display-options-grid .switch-card {
  min-height: 58px;
}

.wide-field {
  min-width: 0;
}

.profile-section,
.local-book-bind {
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
  min-width: 0;
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

.avatar-preview {
  width: clamp(70px, 21vw, 88px);
  height: clamp(70px, 21vw, 88px);
  border-radius: clamp(20px, 6vw, 26px);
  background: #eef3f1;
  object-fit: cover;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.05), 0 12px 26px rgba(26, 33, 30, 0.08);
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
  touch-action: manipulation;
}

.avatar-upload input {
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

.profile-section .compact-field {
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.profile-section .compact-field input {
  min-height: 44px;
  padding: 11px 12px;
  border-radius: 16px;
}

.profile-panel > .field textarea {
  min-height: 168px;
}

.local-book-bind {
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

.local-book-header > span,
.local-book-empty {
  color: #69736f;
  font-size: 11px;
  font-weight: 850;
}

.local-book-list {
  display: grid;
  gap: 10px;
  max-height: calc(58px * 4 + 10px * 3);
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.local-book-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-width: 0;
  min-height: 58px;
  padding: 0 14px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.95);
  color: #151719;
  font-size: 13px;
  font-weight: 850;
  box-shadow: 0 8px 18px rgba(30, 55, 45, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease, color 0.18s ease;
  touch-action: manipulation;
}

.local-book-row.selected {
  border-color: rgba(6, 199, 85, 0.34);
  background: #f7fffa;
  color: #146b3f;
  box-shadow: inset 0 0 0 1px rgba(6, 199, 85, 0.12), 0 8px 18px rgba(30, 55, 45, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.local-book-row input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.book-check {
  position: relative;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgba(21, 23, 25, 0.05);
  box-shadow: inset 0 0 0 1px rgba(21, 23, 25, 0.1);
}

.book-check::after {
  content: '';
  position: absolute;
  left: 6px;
  top: 3px;
  width: 5px;
  height: 9px;
  border: solid #ffffff;
  border-width: 0 2px 2px 0;
  opacity: 0;
  transform: rotate(45deg) scale(0.7);
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.local-book-row.selected .book-check {
  background: var(--link-green);
  box-shadow: inset 0 0 0 1px rgba(6, 199, 85, 0.7), 0 6px 14px rgba(6, 199, 85, 0.22);
}

.local-book-row.selected .book-check::after {
  opacity: 1;
  transform: rotate(45deg) scale(1);
}

.local-book-row span:first-of-type {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.local-book-empty {
  margin: 0;
  line-height: 1.5;
}

@media (max-width: 360px) {
  .memory-toggle-grid,
  .range-grid,
  .color-grid,
  .local-book-list,
  .profile-avatar-stack {
    grid-template-columns: 1fr;
  }

  .beauty-panel .bubble-color-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .beauty-panel .bubble-color-grid .color-card {
    gap: 6px;
    padding: 8px;
    border-radius: 14px;
  }

  .beauty-panel .bubble-color-grid .rgb-input-row {
    gap: 3px;
  }

  .beauty-panel .bubble-color-grid .rgb-input-row input {
    min-height: 28px;
    font-size: 10px;
  }

  .appearance-tools-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.control-panel {
  gap: 14px;
  min-width: 0;
  color: #151719;
  font-size: 12px;
}

.control-panel *,
.control-panel *::before,
.control-panel *::after {
  min-width: 0;
}

.panel-section {
  gap: 14px;
  min-width: 0;
}

.settings-block,
.memory-hero,
.profile-preview,
.manual-summary-card,
.memory-records {
  border: 1px solid rgba(17, 17, 17, 0.04);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 14px 36px rgba(21, 30, 26, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.92);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}

.settings-block,
.manual-summary-card,
.memory-records {
  display: grid;
  gap: 14px;
  padding: 14px;
}

.section-header {
  align-items: flex-start;
  gap: 10px;
}

.section-header div {
  gap: 4px;
}

.section-header span,
.memory-card-head span {
  color: #8a8f94;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-transform: uppercase;
}

.section-header strong {
  color: #151719;
  font-size: 17px;
  font-weight: 900;
  line-height: 1.15;
}

.memory-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  min-height: 118px;
  padding: 18px;
  background:
    radial-gradient(circle at 94% 6%, rgba(6, 199, 85, 0.14), transparent 34%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(247, 249, 248, 0.92));
}

.memory-hero div {
  gap: 6px;
}

.memory-hero span,
.profile-preview span,
.upload-card span,
.empty-note,
.switch-card span:not(.switch-track) {
  color: #747b80;
  font-size: 12px;
  line-height: 1.45;
}

.memory-hero span,
.profile-preview span {
  font-weight: 800;
}

.memory-hero strong {
  color: #0f1111;
  font-size: 30px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1;
}

.memory-hero p {
  max-width: 100%;
  margin: 0;
  color: #747b80;
  font-size: 12px;
  line-height: 1.45;
}

.field,
.profile-avatar-stack {
  display: grid;
  gap: 8px;
}

.field > span {
  max-width: 100%;
  overflow: hidden;
  color: #4c5357;
  font-size: 11px;
  font-weight: 850;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field input,
.field textarea,
.field select,
.model-select-shell,
.sticker-bind-trigger,
.switch-card,
.compact-field,
.upload-card,
.time-awareness-note,
.empty-note,
.merge-picker,
.memory-card,
.background-url-card,
.background-upload-card,
.background-color-card,
.background-thumb-card,
.bubble-preview {
  border: 1px solid rgba(42, 75, 60, 0.08);
  border-radius: 16px;
  background: rgba(250, 252, 250, 0.96);
  box-shadow: 0 8px 18px rgba(30, 55, 45, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.field input,
.field textarea,
.field select {
  width: 100%;
  min-height: 44px;
  padding: 11px 12px;
  color: #151719;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.4;
}

.field textarea {
  min-height: 132px;
  max-width: 100%;
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
.field:focus-within select,
.model-select-shell:focus-within {
  box-shadow: inset 0 0 0 1px rgba(6, 199, 85, 0.35), 0 0 0 3px rgba(6, 199, 85, 0.1);
}

.memory-toggle-grid,
.range-grid,
.color-grid,
.manual-summary-actions,
.merge-actions,
.memory-actions,
.background-thumb-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.switch-card,
.compact-field {
  min-height: 66px;
  padding: 12px;
}

.switch-card {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  touch-action: manipulation;
}

.switch-card div {
  gap: 3px;
}

.switch-card strong,
.sticker-bind-trigger strong,
.upload-card strong {
  max-width: 100%;
  overflow: hidden;
  color: #151719;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.switch-track {
  flex: 0 0 auto;
  width: 46px;
  height: 28px;
  background: #171717;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.08);
}

.switch-track::after {
  top: 4px;
  left: 4px;
  width: 20px;
  height: 20px;
  box-shadow: 0 3px 8px rgba(42, 35, 31, 0.18);
}

.switch-card input:not(:checked) + .switch-track {
  background: #dedad7;
}

.switch-card input:checked + .switch-track::after {
  transform: translateX(18px);
}

.compact-switch {
  min-height: 42px;
  padding: 9px 10px;
  border-radius: 14px;
}

.compact-switch .switch-track {
  width: 38px;
  height: 22px;
}

.compact-switch .switch-track::after {
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
}

.compact-switch input:checked + .switch-track::after {
  transform: translateX(16px);
}

.compact-field {
  justify-content: center;
}

.compact-field input {
  min-height: 36px;
  padding: 8px 10px;
  border-radius: 13px;
}

.manual-summary-button,
.summary-submit,
.setting-action-button,
.secondary-action,
.danger-action,
.background-thumb-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 42px;
  padding: 0 12px;
  overflow: hidden;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0;
  line-height: 1.15;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  touch-action: manipulation;
}

.manual-summary-button,
.summary-submit,
.primary-setting-action {
  background: #171717;
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(17, 17, 17, 0.16);
}

.secondary-action,
.background-thumb-actions button:first-child {
  background: #edf1ef;
  color: #171717;
  box-shadow: inset 0 0 0 1px rgba(23, 23, 23, 0.04);
}

.danger-action,
.background-thumb-actions button:last-child {
  background: rgba(239, 68, 90, 0.1);
  color: #d73850;
  box-shadow: inset 0 0 0 1px rgba(239, 68, 90, 0.08);
}

.manual-summary-button:disabled,
.summary-submit:disabled,
.secondary-action:disabled,
.danger-action:disabled,
.background-thumb-actions button:disabled {
  transform: none;
  background: #ebe8e5;
  color: #aaa5a0;
  box-shadow: none;
  cursor: default;
}

.manual-summary-card p,
.time-awareness-note,
.empty-note {
  margin: 0;
  color: #747b80;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.55;
}

.model-select-shell {
  display: grid;
  align-items: center;
  gap: 8px;
  min-height: 50px;
  padding: 6px;
}

.model-select-shell {
  grid-template-columns: auto auto minmax(0, 1fr);
}

.model-select-shell select:not(.with-provider) {
  grid-column: 1 / -1;
}

.model-select-shell img {
  flex: 0 0 auto;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  object-fit: cover;
}

.model-select-vendor {
  max-width: 76px;
  overflow: hidden;
  color: #5f6662;
  font-size: 11px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-select-field select,
.frequency-field select {
  min-width: 0;
  overflow: hidden;
  background: transparent;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-header em,
.memory-card-head em {
  flex: 0 0 auto;
  font-style: normal;
  white-space: nowrap;
}

.record-header em {
  color: #747b80;
  font-size: 12px;
  font-weight: 900;
}

.merge-picker {
  display: grid;
  gap: 8px;
  padding: 10px;
}

.memory-card {
  position: relative;
  display: grid;
  gap: 12px;
  padding: 14px;
  background: #fffdf9;
}

.memory-card-head {
  align-items: flex-start;
}

.memory-card-head div {
  display: grid;
  gap: 3px;
}

.memory-card-head strong {
  color: #221f1c;
  font-size: 15px;
  font-weight: 900;
  line-height: 1.2;
}

.memory-card-head em {
  max-width: 44%;
  padding: 4px 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #eef8f1;
  color: #1f6b3a;
  font-size: 10px;
  font-weight: 900;
  text-overflow: ellipsis;
}

.memory-card textarea {
  min-height: 156px;
  padding: 13px;
  border: 1px solid rgba(84, 74, 62, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.84);
  color: #2a2723;
  font-size: 13px;
  line-height: 1.7;
}

.memory-empty-note,
.compact-empty-note {
  display: grid;
  min-height: 92px;
  place-items: center;
  text-align: center;
}

.background-manager,
.background-library {
  display: grid;
  gap: 10px;
}

.background-url-card,
.background-upload-card,
.background-color-card,
.profile-avatar-stack .field,
.profile-avatar-stack .upload-card {
  min-height: 84px;
  padding: 12px;
}

.inline-input-action {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}

.setting-action-button {
  min-width: 64px;
}

.background-color-card input[type='color'],
.color-card input[type='color'],
.appearance-color-field input[type='color'] {
  width: 100%;
  min-height: 40px;
  padding: 4px;
  border-radius: 13px;
  background: #ffffff;
}

.background-thumb-card {
  display: grid;
  gap: 8px;
  padding: 9px;
}

.background-thumb-card.active {
  border-color: rgba(6, 199, 85, 0.32);
  background: linear-gradient(135deg, rgba(237, 252, 242, 0.98), rgba(255, 246, 249, 0.96));
  box-shadow: 0 10px 24px rgba(31, 120, 74, 0.09), inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.background-thumb {
  min-height: 118px;
  border-radius: 14px;
}

.background-thumb span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bubble-preview {
  display: grid;
  gap: 10px;
  min-height: 154px;
  padding: 14px;
  background-position: center;
  background-size: cover;
}

.preview-row {
  min-width: 0;
}

.preview-bubble {
  max-width: min(76%, 280px);
  overflow-wrap: anywhere;
}

.profile-preview {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  padding: 16px;
}

.profile-preview .avatar {
  width: 62px;
  height: 62px;
  border: 3px solid #ffffff;
  border-radius: 20px;
  object-fit: cover;
  box-shadow: 0 10px 24px rgba(18, 25, 22, 0.12);
}

.profile-preview div {
  display: grid;
  gap: 4px;
}

.profile-preview strong {
  overflow: hidden;
  color: #151719;
  font-size: 17px;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-preview span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-card {
  position: relative;
  display: grid;
  align-content: center;
  gap: 5px;
  cursor: pointer;
}

.upload-card input[type='file'] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  opacity: 0;
  cursor: pointer;
}

.sticker-bind-trigger {
  grid-template-columns: minmax(0, 1fr) auto;
  min-height: 58px;
  padding: 12px;
  overflow: hidden;
  text-align: left;
  white-space: nowrap;
  touch-action: manipulation;
}

.sticker-bind-trigger > span {
  display: grid;
  grid-template-columns: 1fr;
  gap: 3px;
}

.sticker-bind-trigger small,
.sticker-group-name {
  overflow: hidden;
  color: #747b80;
  font-size: 11px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sticker-bind-trigger svg {
  flex: 0 0 auto;
}

.sticker-group-popover {
  display: grid;
  gap: 7px;
  padding: 8px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: inset 0 0 0 1px rgba(20, 24, 22, 0.05);
}

.sticker-group-option,
.merge-row {
  grid-template-columns: auto minmax(0, 1fr);
}

.time-awareness-note {
  padding: 12px;
}

@media (min-width: 520px) {
  .background-library {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 380px) {
  .settings-block,
  .manual-summary-card,
  .memory-records {
    padding: 12px;
    border-radius: 22px;
  }

  .memory-hero {
    padding: 16px;
  }

  .switch-card,
  .compact-field {
    min-height: 62px;
    padding: 10px;
  }

  .switch-card {
    gap: 8px;
  }

  .switch-card strong,
  .sticker-bind-trigger strong,
  .upload-card strong {
    font-size: 13px;
  }

  .manual-summary-button,
  .summary-submit,
  .setting-action-button,
  .secondary-action,
  .danger-action,
  .background-thumb-actions button {
    padding-inline: 10px;
  }
}

@media (max-width: 340px) {
  .memory-hero,
  .inline-input-action,
  .profile-preview {
    grid-template-columns: 1fr;
  }

  .manual-summary-button,
  .setting-action-button {
    width: 100%;
  }

  .memory-toggle-grid,
  .strategy-control-grid,
  .range-grid,
  .color-grid,
  .manual-summary-actions,
  .merge-actions,
  .memory-actions,
  .background-thumb-actions {
    grid-template-columns: 1fr;
  }

  .memory-card-head {
    display: grid;
    grid-template-columns: 1fr;
  }

  .memory-card-head em {
    max-width: 100%;
    width: fit-content;
  }
}

.settings-block,
.memory-hero,
.profile-preview,
.manual-summary-card,
.memory-records,
.switch-card,
.compact-field,
.upload-card,
.time-awareness-note,
.empty-note,
.merge-picker,
.memory-card,
.background-url-card,
.background-upload-card,
.background-color-card,
.background-thumb-card,
.bubble-preview,
.sticker-bind-trigger,
.sticker-group-popover {
  border-color: transparent;
}

.switch-card,
.compact-field,
.upload-card,
.time-awareness-note,
.empty-note,
.merge-picker,
.background-url-card,
.background-upload-card,
.background-color-card,
.background-thumb-card,
.sticker-bind-trigger,
.sticker-group-popover {
  background: rgba(248, 251, 249, 0.9);
  box-shadow: 0 10px 22px rgba(28, 55, 44, 0.035), inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.model-select-shell {
  border-color: transparent;
  background: rgba(255, 255, 255, 0.95);
}

.manual-summary-button,
.summary-submit,
.primary-setting-action {
  border: 1px solid rgba(6, 199, 85, 0.18);
  background: linear-gradient(135deg, rgba(224, 249, 233, 0.98), rgba(255, 242, 247, 0.96));
  color: #16643e;
  box-shadow: 0 14px 28px rgba(31, 120, 74, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.secondary-action,
.background-thumb-actions button:first-child {
  border: 0;
  background: #edf8f1;
  color: #1f6b3a;
  box-shadow: inset 0 0 0 1px rgba(6, 199, 85, 0.08);
}

.danger-action,
.background-thumb-actions button:last-child {
  border: 0;
  background: rgba(239, 68, 90, 0.09);
  color: #d73850;
  box-shadow: inset 0 0 0 1px rgba(239, 68, 90, 0.06);
}

.switch-track {
  background: #dceee4;
  box-shadow: inset 0 0 0 1px rgba(31, 107, 58, 0.08);
}

.switch-card input:not(:checked) + .switch-track {
  background: #dfe8e4;
}

.switch-card input:checked + .switch-track {
  background: linear-gradient(135deg, #62d98d, #06c755);
  box-shadow: 0 8px 16px rgba(6, 199, 85, 0.18), inset 0 0 0 1px rgba(6, 199, 85, 0.18);
}

.switch-track::after {
  background: #ffffff;
  box-shadow: 0 3px 8px rgba(31, 107, 58, 0.18);
}

.manual-summary-button:disabled,
.summary-submit:disabled,
.secondary-action:disabled,
.danger-action:disabled,
.background-thumb-actions button:disabled {
  background: rgba(239, 242, 240, 0.86);
  color: #a0aaa5;
  box-shadow: none;
}

.beauty-panel .background-manager {
  gap: 9px;
}

.beauty-panel .background-tool-panel {
  display: grid;
  grid-template-columns: 1fr;
  gap: 9px;
  align-items: stretch;
  min-width: 0;
}

.beauty-panel .background-quick-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
  min-width: 0;
}

.beauty-panel .background-url-card,
.beauty-panel .background-upload-card,
.beauty-panel .background-color-card {
  min-height: 0;
  padding: 10px;
  border-radius: 16px;
  background: rgba(248, 251, 249, 0.92);
  box-shadow: 0 8px 18px rgba(28, 55, 44, 0.03), inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.beauty-panel .background-url-card {
  align-content: stretch;
  gap: 8px;
}

.beauty-panel .background-field-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.beauty-panel .background-field-title > span {
  min-width: 0;
  overflow: hidden;
  color: #626d68;
  font-size: 11px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.beauty-panel .background-field-title .setting-action-button {
  flex: 0 0 28px;
  width: 28px;
  min-width: 28px;
  min-height: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #16643e;
  box-shadow: none;
}

.beauty-panel .background-field-title .setting-action-button svg {
  flex: 0 0 auto;
}

.beauty-panel .background-url-card > span,
.beauty-panel .background-color-card > span {
  color: #626d68;
  font-size: 11px;
  font-weight: 900;
}

.beauty-panel .inline-input-action {
  gap: 7px;
}

.beauty-panel .background-url-card > input,
.beauty-panel .inline-input-action input {
  min-height: 42px;
  border-radius: 14px;
  font-weight: 800;
}

.beauty-panel .setting-action-button {
  min-width: 56px;
  min-height: 42px;
  padding-inline: 12px;
  border-radius: 14px;
}

.beauty-panel .background-upload-card {
  align-content: center;
  gap: 2px;
  min-height: 54px;
}

.beauty-panel .background-upload-card strong {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.beauty-panel .background-upload-card span {
  color: #78827d;
  font-size: 11px;
  font-weight: 800;
}

.beauty-panel .background-color-card {
  display: grid;
  grid-template-columns: 1fr;
  gap: 5px;
  align-items: stretch;
  min-height: 54px;
}

.beauty-panel .background-color-select {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 0;
  height: 28px;
  padding: 4px 9px 4px 4px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: inset 0 0 0 1px rgba(42, 75, 60, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.beauty-panel .background-color-select input[type='color'] {
  width: 20px;
  min-width: 20px;
  min-height: 20px;
  height: 20px;
  padding: 3px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  box-shadow: none;
}

.beauty-panel .background-color-select span {
  min-width: 0;
  overflow: hidden;
  color: #626d68;
  font-size: 11px;
  font-weight: 850;
  text-transform: uppercase;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.beauty-panel .background-library {
  gap: 8px;
  max-height: min(306px, 42vh);
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

.beauty-panel .compact-empty-note {
  min-height: 58px;
  padding: 10px 12px;
  border-radius: 16px;
  color: #74807a;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.45;
}

.beauty-panel .background-thumb-card {
  gap: 7px;
  padding: 8px;
  border-radius: 16px;
}

.beauty-panel .background-thumb {
  min-height: 86px;
  border-radius: 13px;
}

.beauty-panel .background-thumb-actions {
  gap: 7px;
}

.beauty-panel .background-thumb-actions button {
  min-height: 34px;
  border-radius: 12px;
}

.memory-merge-dashboard {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.memory-merge-dashboard span {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 10px;
  border-radius: 16px;
  background: rgba(248, 251, 249, 0.92);
  box-shadow: inset 0 0 0 1px rgba(31, 107, 58, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.memory-merge-dashboard strong {
  color: #17241d;
  font-size: 17px;
  font-weight: 950;
  line-height: 1;
}

.memory-merge-dashboard small,
.merge-row-copy small {
  min-width: 0;
  overflow: hidden;
  color: #738079;
  font-size: 11px;
  font-weight: 850;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon-action {
  gap: 6px;
}

.icon-action svg {
  flex: 0 0 auto;
}

.memory-records .merge-picker-panel {
  gap: 9px;
  padding: 10px;
  border-radius: 18px;
  background: rgba(248, 251, 249, 0.94);
}

.merge-picker-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.merge-picker-head div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.merge-picker-head strong {
  color: #17241d;
  font-size: 13px;
  font-weight: 950;
}

.merge-picker-head span {
  min-width: 0;
  overflow: hidden;
  color: #718078;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tiny-action {
  min-height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 999px;
  background: rgba(31, 107, 58, 0.08);
  color: #1f6b3a;
  font-size: 12px;
  font-weight: 900;
}

.tiny-action:disabled {
  color: #9aa39f;
  background: rgba(239, 242, 240, 0.78);
}

.memory-records .merge-row {
  min-height: 48px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 0 0 1px rgba(31, 107, 58, 0.06);
}

.memory-records .merge-row.selected {
  background: rgba(232, 250, 239, 0.94);
  box-shadow: inset 0 0 0 1px rgba(6, 199, 85, 0.18), 0 8px 18px rgba(6, 199, 85, 0.08);
}

.merge-row-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.merge-row-copy strong {
  min-width: 0;
  overflow: hidden;
  color: #1d2922;
  font-size: 13px;
  font-weight: 950;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.memory-records .button-row {
  justify-content: flex-start;
  min-height: 52px;
  padding: 9px 10px;
  text-align: left;
}

.memory-confirm-card {
  display: grid;
  gap: 12px;
  padding: 4px;
}

.memory-confirm-card > span {
  color: #1f6b3a;
  font-size: 11px;
  font-weight: 950;
  text-transform: uppercase;
}

.memory-confirm-card h2,
.memory-confirm-card p {
  margin: 0;
}

.memory-confirm-card h2 {
  color: #17211c;
  font-size: 18px;
  font-weight: 950;
}

.memory-confirm-card p,
.memory-confirm-card li {
  color: #59645f;
  font-size: 13px;
  font-weight: 750;
  line-height: 1.55;
}

.memory-confirm-card ul {
  display: grid;
  gap: 7px;
  max-height: min(32vh, 240px);
  overflow-y: auto;
  margin: 0;
  padding: 10px 12px 10px 26px;
  border-radius: 16px;
  background: rgba(248, 251, 249, 0.92);
  overscroll-behavior: contain;
}

.memory-confirm-card li {
  overflow-wrap: anywhere;
}

.memory-confirm-card-danger > span {
  color: #d73850;
}

.memory-confirm-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.memory-confirm-actions.confirm-only {
  grid-template-columns: 1fr;
}

.memory-confirm-actions .danger-confirm {
  border-color: rgba(239, 68, 90, 0.14);
  background: rgba(239, 68, 90, 0.11);
  color: #d73850;
  box-shadow: inset 0 0 0 1px rgba(239, 68, 90, 0.08);
}

.memory-panel .switch-card strong,
.memory-panel .switch-card div span:not(.switch-track),
.memory-panel .compact-field > span,
.memory-panel .compact-field small,
.memory-panel .secondary-action,
.memory-panel .danger-action,
.memory-panel .summary-submit,
.memory-panel .manual-summary-button {
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
}

.memory-panel button,
.memory-panel .secondary-action,
.memory-panel .danger-action,
.memory-panel .summary-submit {
  min-height: 40px;
  height: auto;
  padding-block: 9px;
  line-height: 1.25;
}

@media (max-width: 360px) {
  .merge-picker-head {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 340px) {
  .memory-records > .merge-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .memory-records > .merge-actions .secondary-action {
    min-height: 38px;
    padding-inline: 6px;
    font-size: 11px;
  }
}

@media (max-width: 360px) {
  .local-theme-style-grid {
    grid-template-columns: 1fr;
  }

  .beauty-panel .background-tool-panel {
    grid-template-columns: 1fr;
  }

  .beauty-panel .background-quick-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.add-page-select-field {
  gap: 7px;
}

.add-page-select-field > span {
  color: #4c5357;
  font-size: 11px;
  font-weight: 850;
  line-height: 1.2;
}

.add-page-select-field select {
  width: 100%;
  min-height: 44px;
  padding: 11px 12px;
  border: 0;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.95);
  color: #151719;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.4;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.06);
}

.add-page-select-field:focus-within select {
  box-shadow: inset 0 0 0 1px rgba(6, 199, 85, 0.35), 0 0 0 3px rgba(6, 199, 85, 0.1);
}

.call-settings-block {
  gap: 10px;
}

.call-simple-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  background: rgba(250, 252, 250, 0.96);
  box-shadow: inset 0 0 0 1px rgba(42, 75, 60, 0.06), 0 8px 18px rgba(30, 55, 45, 0.035);
}

.call-simple-heading {
  display: grid;
  gap: 4px;
}

.call-simple-heading strong {
  color: #171717;
  font-size: 14px;
  font-weight: 900;
  line-height: 1.25;
}

.call-simple-heading span {
  color: #747b80;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.45;
}

.call-button-row,
.call-url-row {
  display: grid;
  gap: 8px;
}

.call-button-row {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.call-url-row {
  grid-template-columns: minmax(0, 1fr) minmax(86px, auto);
}

.call-text-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 44px;
  padding: 0 12px;
  overflow: hidden;
  border: 0;
  border-radius: 12px;
  background: #edf8f1;
  color: #1f6b3a;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.2;
  text-align: center;
  white-space: nowrap;
  box-shadow: inset 0 0 0 1px rgba(6, 199, 85, 0.08);
  cursor: pointer;
}

.control-panel .manual-summary-button,
.control-panel .summary-submit,
.control-panel .setting-action-button,
.control-panel .secondary-action,
.control-panel .danger-action,
.control-panel .background-thumb-actions button,
.control-panel .call-text-button {
  border: 1px solid rgba(42, 75, 60, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
  color: #171717;
  box-shadow: 0 8px 18px rgba(30, 55, 45, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.control-panel .manual-summary-button:disabled,
.control-panel .summary-submit:disabled,
.control-panel .setting-action-button:disabled,
.control-panel .secondary-action:disabled,
.control-panel .danger-action:disabled,
.control-panel .background-thumb-actions button:disabled,
.control-panel .call-text-button:disabled {
  background: rgba(248, 249, 248, 0.78);
  color: #a0aaa5;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  cursor: default;
}

.call-text-button input[type='file'] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  opacity: 0;
  cursor: pointer;
}

.call-text-button:disabled,
.call-text-button[aria-disabled='true'] {
  background: rgba(239, 242, 240, 0.86);
  color: #a0aaa5;
  box-shadow: none;
  cursor: default;
}

.call-background-url-input {
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  background: #f6f8f7;
  color: #171717;
  font-size: 13px;
  box-shadow: inset 0 0 0 1px rgba(42, 75, 60, 0.08);
}

.call-file-button {
  width: 100%;
}

.call-audio-preview {
  width: 100%;
  min-height: 36px;
}

@media (max-width: 360px) {
  .character-photo-library {
    grid-template-columns: 1fr;
  }
}

.call-ambient-panel {
  display: grid;
  gap: 12px;
}

.call-ambient-switch {
  margin: 0;
}

.call-volume-field input[type='range'] {
  width: 100%;
  accent-color: #06c755;
}

.character-mcp-block {
  gap: 10px;
}

.character-mcp-count {
  flex: 0 0 auto;
  padding: 5px 8px;
  border-radius: 999px;
  color: #237345;
  background: #eaf8ef;
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
}

.character-mcp-note,
.character-mcp-warning {
  margin: 0;
  padding: 9px 11px;
  border-radius: 12px;
  color: #68736c;
  background: #f2f5f3;
  font-size: 11px;
  line-height: 1.5;
}

.character-mcp-warning {
  color: #8a5d22;
  background: #fff7df;
}

.character-mcp-list {
  display: grid;
  overflow: hidden;
  border: 1px solid rgba(20, 24, 22, 0.06);
  border-radius: 16px;
  background: #f8faf9;
}

.character-mcp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 11px 12px;
  border-bottom: 1px solid rgba(20, 24, 22, 0.06);
}

.character-mcp-row:last-child {
  border-bottom: 0;
}

.character-mcp-row > span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.character-mcp-row strong,
.character-mcp-row small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.character-mcp-row strong {
  color: #171717;
  font-size: 12px;
  font-weight: 900;
}

.character-mcp-row small {
  color: #7e8982;
  font-size: 10px;
}

.character-mcp-row input {
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  accent-color: #179b50;
}

.character-mcp-row.unavailable {
  opacity: 0.56;
}

.empty-character-mcp-note {
  text-align: center;
}

@media (max-width: 420px) {
  .call-simple-card {
    padding: 13px;
  }

  .call-button-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .call-url-row {
    grid-template-columns: minmax(0, 1fr) 86px;
  }

  .call-text-button {
    min-height: 42px;
    padding-inline: 10px;
    font-size: 12px;
  }
}
</style>
