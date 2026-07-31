<template>
  <AppModal :model-value="showPairing" :title="bridgeGuideTitle" :show-header="false" fixed-height variant="ins" @update:model-value="showPairing = $event">
    <form class="mcp-modal-shell" @submit.prevent="runBridgePairing">
      <section class="mcp-modal-hero" :class="`kind-${bridgeKind}`">
        <span class="mcp-modal-icon"><Heart v-if="bridgeKind === 'xiaohongshu'" :size="22" /><MessageCircle v-else :size="22" /></span>
        <div><small>COMPUTER ASSISTANT</small><h2>{{ bridgeGuideTitle }}</h2><p>账号只登录在你的电脑，BabyLink 云端不接触账号和平台流量。</p></div>
      </section>

      <section class="mcp-modal-scroll">
        <div class="mcp-step-list">
          <article v-for="(step, index) in bridgeGuideSteps" :key="step.title">
            <b>{{ index + 1 }}</b>
            <span><strong>{{ step.title }}</strong><small>{{ step.detail }}</small></span>
          </article>
        </div>

        <article class="mcp-modal-callout">
          <Sparkles :size="18" />
          <span><strong>手机端只需要最后一步</strong><small>在电脑助手点击“复制配对信息”，回到这里粘贴即可。</small></span>
        </article>

        <label class="mcp-modal-field">
          <span>电脑助手配对信息</span>
          <textarea v-model="bridgePairingText" rows="6" spellcheck="false" :placeholder="bridgePairingPlaceholder"></textarea>
          <small>不要粘贴 QQ 密码、小红书 Cookie 或扫码截图。</small>
        </label>

        <details class="mcp-modal-help">
          <summary>电脑助手没有显示配对信息？<ChevronDown :size="15" /></summary>
          <p v-if="bridgeKind === 'qq'">确认 NapCat 已登录、OneBot HTTP 已开启，且 BabyLink Bridge 显示“QQ 在线”。</p>
          <p v-else>确认小红书适配器已登录，且 BabyLink Bridge 显示“适配器在线”。</p>
          <p>电脑关机或关闭助手后会暂时离线，重新开启即可恢复，无需重复配对。</p>
        </details>
      </section>

      <p v-if="bridgeError" class="mcp-modal-error"><AlertTriangle :size="15" />{{ bridgeError }}</p>
      <footer class="mcp-modal-footer">
        <button type="button" @click="showPairing = false">取消</button>
        <button class="primary" type="submit" :disabled="pairing">{{ pairing ? '正在配对…' : '配对并自动检测' }}</button>
      </footer>
    </form>
  </AppModal>

  <AppModal :model-value="showComposer" :title="editingServerId ? '编辑 MCP' : '添加 MCP'" :show-header="false" fixed-height variant="ins" @update:model-value="showComposer = $event">
    <form class="mcp-modal-shell" @submit.prevent="saveComposer">
      <section class="mcp-modal-hero" :class="`kind-${composer.kind}`">
        <span class="mcp-modal-icon"><Heart v-if="composer.kind === 'xiaohongshu' || composer.kind === 'xiaohongshu-search'" :size="22" /><MessageCircle v-else-if="composer.kind === 'qq'" :size="22" /><TerminalSquare v-else-if="composer.kind === 'termux'" :size="22" /><ShoppingBag v-else-if="composer.kind === 'taobao-search'" :size="22" /><Clapperboard v-else-if="composer.kind === 'douyin-search'" :size="22" /><Network v-else :size="22" /></span>
        <div><small>{{ composer.kind === 'termux' ? 'ANDROID LOCAL HUB' : composer.kind.endsWith('-search') ? 'AI PLATFORM SEARCH' : composer.kind === 'custom' ? 'REMOTE MCP' : 'COMPUTER SERVICE' }}</small><h2>{{ serverKindLabel(composer) }}</h2><p>{{ composerKindHelper }}</p></div>
      </section>

      <nav class="mcp-composer-tabs" aria-label="MCP 编辑分栏">
        <button type="button" :class="{ active: composerTab === 'quick' }" @click="composerTab = 'quick'">快速设置</button>
        <button type="button" :class="{ active: composerTab === 'advanced' }" @click="composerTab = 'advanced'">高级设置</button>
      </nav>

      <section v-if="composerTab === 'quick'" class="mcp-modal-scroll mcp-form-grid">
        <label class="mcp-modal-field"><span>显示名称</span><input v-model="composer.name" maxlength="60" required></label>
        <label class="mcp-modal-field">
          <span>MCP 地址</span>
          <input v-model="composer.url" inputmode="url" :placeholder="composer.kind === 'termux' ? 'http://127.0.0.1:8765/mcp' : composer.kind === 'custom' || composer.kind.endsWith('-search') ? 'https://mcp.example.com/mcp' : 'https://你的电脑助手域名/mcp'" required>
          <small>公开服务须用 HTTPS；电脑本机可用 http://127.0.0.1。手机中的 127.0.0.1 指手机自身。</small>
        </label>
        <label class="mcp-modal-field"><span>API Key <em>没有鉴权可留空</em></span><input v-model="composer.apiKey" autocomplete="off" placeholder="粘贴服务商提供的 Key" type="password"></label>

        <fieldset class="mcp-permission-picker">
          <legend>角色可以做什么</legend>
          <label :class="{ active: composer.toolPolicy === 'read-only' }">
            <input v-model="composer.toolPolicy" type="radio" value="read-only">
            <span><strong>只浏览</strong><small>查询、搜索、读取内容</small></span>
          </label>
          <label :class="{ active: composer.toolPolicy === 'all' }">
            <input v-model="composer.toolPolicy" type="radio" value="all">
            <span><strong>浏览并操作</strong><small>允许发送消息或发布内容</small></span>
          </label>
        </fieldset>

        <label class="mcp-modal-toggle">
          <span><strong>添加后全局应用</strong><small>未单独覆盖的角色都可以使用</small></span>
          <input v-model="composer.globalEnabled" type="checkbox"><i></i>
        </label>
      </section>

      <section v-else class="mcp-modal-scroll mcp-form-grid">
        <label class="mcp-modal-field"><span>连接说明</span><textarea v-model="composer.description" maxlength="400" rows="3"></textarea></label>
        <div class="mcp-two-fields">
          <label class="mcp-modal-field"><span>Key 请求头</span><input v-model="composer.apiKeyHeader" placeholder="Authorization"></label>
          <label class="mcp-modal-field"><span>Key 前缀</span><input v-model="composer.apiKeyPrefix" placeholder="Bearer "></label>
        </div>
        <label class="mcp-modal-field">
          <span>其他请求头 JSON</span>
          <textarea v-model="headersText" autocomplete="off" placeholder='{"X-Client":"BabyLink"}' rows="5" spellcheck="false"></textarea>
          <small>不要重复填写 Content-Type、MCP 会话头或 Origin。</small>
        </label>
        <label class="mcp-modal-field"><span>连接超时</span><select v-model.number="composer.timeoutMs"><option :value="15000">15 秒</option><option :value="30000">30 秒</option><option :value="45000">45 秒</option><option :value="60000">60 秒</option><option :value="120000">120 秒</option></select></label>
      </section>

      <p v-if="composerError" class="mcp-modal-error"><AlertTriangle :size="15" />{{ composerError }}</p>
      <footer class="mcp-modal-footer">
        <button type="button" @click="showComposer = false">取消</button>
        <button class="primary" type="submit" :disabled="savingComposer">{{ savingComposer ? '正在保存…' : '保存并自动检测' }}</button>
      </footer>
    </form>
  </AppModal>

  <AppModal :model-value="showImporter" title="导入远程 MCP" :show-header="false" fixed-height variant="ins" @update:model-value="showImporter = $event">
    <form class="mcp-modal-shell" @submit.prevent="runImport">
      <section class="mcp-modal-hero import">
        <span class="mcp-modal-icon"><Upload :size="22" /></span>
        <div><small>ONE-CLICK IMPORT</small><h2>把服务商配置放进来</h2><p>支持远程 HTTPS、本机 HTTP、mcpServers JSON 与 BabyLink 配置。</p></div>
      </section>

      <section class="mcp-modal-scroll mcp-form-grid">
        <label class="mcp-file-import">
          <Upload :size="18" />
          <span><strong>选择 JSON / TXT 文件</strong><small>也可以直接粘贴到下方</small></span>
          <input accept=".json,.txt,application/json,text/plain" type="file" @change="readImportFile">
        </label>
        <label class="mcp-modal-field"><span>配置 JSON 或 MCP 地址</span><textarea v-model="importText" rows="9" spellcheck="false" placeholder="https://mcp.example.com/mcp\nhttp://127.0.0.1:5000/mcp\n\n或粘贴服务商提供的 mcpServers JSON"></textarea></label>
        <label class="mcp-modal-field"><span>API Key <em>可选</em></span><input v-model="importApiKey" autocomplete="off" placeholder="服务商注册后获得的 Key" type="password"></label>
        <p class="mcp-import-tip"><ShieldCheck :size="15" />本机 HTTP 仅供同设备连接；本地 stdio 和跨设备连接仍需电脑助手或远程 HTTPS MCP。</p>
      </section>

      <p v-if="importError" class="mcp-modal-error"><AlertTriangle :size="15" />{{ importError }}</p>
      <footer class="mcp-modal-footer">
        <button type="button" @click="showImporter = false">取消</button>
        <button class="primary" type="submit" :disabled="importing">{{ importing ? '正在导入…' : '导入并自动检测' }}</button>
      </footer>
    </form>
  </AppModal>

  <AppModal :model-value="Boolean(deleteTarget)" title="删除 MCP" :show-header="false" variant="ins" @update:model-value="closeDeleteModal">
    <section v-if="deleteTarget" class="mcp-delete-confirm">
      <span><Trash2 :size="23" /></span>
      <small>REMOVE CONNECTION</small>
      <h2>删除 {{ deleteTarget.name }}？</h2>
      <p>连接配置、鉴权信息、已发现工具和所有角色局部绑定都会一并删除。</p>
      <div><button type="button" :disabled="deleting" @click="deleteTarget = null">继续保留</button><button class="danger" type="button" :disabled="deleting" @click="deleteServer">{{ deleting ? '正在删除…' : '确认删除' }}</button></div>
    </section>
  </AppModal>
</template>

<script setup lang="ts">
import { AlertTriangle, ChevronDown, Clapperboard, Heart, MessageCircle, Network, ShieldCheck, ShoppingBag, Sparkles, TerminalSquare, Trash2, Upload } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import { serverKindLabel, useMcpStudio } from '@/components/mcp/mcpStudio';

const studio = useMcpStudio();
const {
  showPairing,
  bridgeKind,
  bridgePairingText,
  bridgeError,
  bridgeGuideTitle,
  bridgePairingPlaceholder,
  bridgeGuideSteps,
  pairing,
  runBridgePairing,
  showComposer,
  composerTab,
  editingServerId,
  composer,
  headersText,
  composerError,
  composerKindHelper,
  savingComposer,
  saveComposer,
  showImporter,
  importText,
  importApiKey,
  importError,
  importing,
  readImportFile,
  runImport,
  deleteTarget,
  deleting,
  closeDeleteModal,
  deleteServer
} = studio;
</script>

<style scoped>
.mcp-modal-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  color: #2c272a;
}

.mcp-modal-hero {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
  padding: 16px;
  border-radius: 23px;
  background: radial-gradient(circle at 100% 0, rgba(211, 238, 224, 0.82), transparent 42%), linear-gradient(145deg, #fff8fb, #f1edf9);
  box-shadow: 0 14px 30px rgba(55, 43, 50, 0.07), inset 0 0 0 1px rgba(255, 255, 255, 0.82);
}

.mcp-modal-hero.kind-qq { background: radial-gradient(circle at 100% 0, rgba(205, 230, 252, 0.9), transparent 44%), linear-gradient(145deg, #fffafd, #eef3fb); }
.mcp-modal-hero.kind-termux { background: radial-gradient(circle at 100% 0, rgba(202, 239, 219, 0.9), transparent 44%), linear-gradient(145deg, #fffafd, #edf7f2); }
.mcp-modal-hero.kind-xiaohongshu { background: radial-gradient(circle at 100% 0, rgba(252, 208, 220, 0.88), transparent 44%), linear-gradient(145deg, #fff9fb, #f6edf1); }
.mcp-modal-hero.kind-taobao-search { background: radial-gradient(circle at 100% 0, rgba(255, 206, 174, 0.9), transparent 44%), linear-gradient(145deg, #fffaf7, #fff1e8); }
.mcp-modal-hero.kind-douyin-search { background: radial-gradient(circle at 100% 0, rgba(194, 229, 239, 0.9), transparent 44%), linear-gradient(145deg, #fff9fc, #edf6f7); }
.mcp-modal-hero.kind-xiaohongshu-search { background: radial-gradient(circle at 100% 0, rgba(252, 208, 220, 0.88), transparent 44%), linear-gradient(145deg, #fff9fb, #f6edf1); }
.mcp-modal-hero.import { background: radial-gradient(circle at 100% 0, rgba(223, 213, 248, 0.88), transparent 44%), linear-gradient(145deg, #fff9fb, #eff6f2); }

.mcp-modal-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 19px;
  background: rgba(255, 255, 255, 0.8);
  color: #4a6457;
  box-shadow: 0 10px 22px rgba(53, 44, 49, 0.08);
}

.mcp-modal-hero div { display: grid; gap: 3px; min-width: 0; }
.mcp-modal-hero small { color: #987e8a; font-size: 9px; font-weight: 950; letter-spacing: 0.13em; }
.mcp-modal-hero h2, .mcp-modal-hero p { margin: 0; }
.mcp-modal-hero h2 { font-size: 18px; font-weight: 950; line-height: 1.15; }
.mcp-modal-hero p { color: #756e72; font-size: 10px; font-weight: 700; line-height: 1.45; }

.mcp-modal-scroll {
  display: grid;
  gap: 12px;
  flex: 1 1 auto;
  min-height: 0;
  padding: 14px 2px 6px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.mcp-step-list { display: grid; gap: 8px; }
.mcp-step-list article {
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 0 0 1px rgba(75, 64, 70, 0.05);
}
.mcp-step-list b { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 11px; color: #4a775f; background: #eaf6ef; font-size: 11px; }
.mcp-step-list span { display: grid; gap: 2px; min-width: 0; }
.mcp-step-list strong { font-size: 12px; font-weight: 900; }
.mcp-step-list small { color: #7f777b; font-size: 10px; font-weight: 700; line-height: 1.4; }

.mcp-modal-callout, .mcp-import-tip {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin: 0;
  padding: 11px 12px;
  border-radius: 17px;
  color: #4d6d5c;
  background: linear-gradient(145deg, #edf8f1, #fff7fa);
}
.mcp-modal-callout > span { display: grid; gap: 2px; }
.mcp-modal-callout strong { font-size: 11px; font-weight: 900; }
.mcp-modal-callout small, .mcp-import-tip { font-size: 10px; font-weight: 700; line-height: 1.5; }

.mcp-form-grid { align-content: start; }
.mcp-modal-field { display: grid; gap: 7px; min-width: 0; }
.mcp-modal-field > span { color: #5d565a; font-size: 10px; font-weight: 900; }
.mcp-modal-field em { color: #a09097; font-style: normal; font-weight: 750; }
.mcp-modal-field input, .mcp-modal-field textarea, .mcp-modal-field select {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 11px 12px;
  border: 0;
  border-radius: 15px;
  outline: none;
  color: #2b2729;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: inset 0 0 0 1px rgba(72, 58, 66, 0.08), 0 7px 16px rgba(50, 41, 46, 0.035);
  font-size: 12px;
  font-weight: 700;
}
.mcp-modal-field textarea { min-height: 92px; resize: vertical; line-height: 1.55; }
.mcp-modal-field input:focus, .mcp-modal-field textarea:focus, .mcp-modal-field select:focus { box-shadow: inset 0 0 0 1px rgba(91, 146, 112, 0.45), 0 0 0 3px rgba(142, 203, 166, 0.13); }
.mcp-modal-field > small { color: #91888d; font-size: 9px; font-weight: 700; line-height: 1.45; }

.mcp-modal-help { border-radius: 16px; background: rgba(255, 255, 255, 0.58); }
.mcp-modal-help summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 11px 12px; color: #645c60; font-size: 10px; font-weight: 900; cursor: pointer; list-style: none; }
.mcp-modal-help summary::-webkit-details-marker { display: none; }
.mcp-modal-help p { margin: 0; padding: 0 12px 10px; color: #847b80; font-size: 10px; font-weight: 700; line-height: 1.5; }

.mcp-composer-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
  flex: 0 0 auto;
  margin-top: 10px;
  padding: 4px;
  border-radius: 15px;
  background: rgba(238, 235, 239, 0.78);
}
.mcp-composer-tabs button { min-height: 36px; border-radius: 12px; color: #8c8388; font-size: 11px; font-weight: 900; }
.mcp-composer-tabs button.active { color: #3f6250; background: rgba(255, 255, 255, 0.9); box-shadow: 0 7px 16px rgba(55, 46, 51, 0.06); }

.mcp-permission-picker { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; padding: 0; border: 0; }
.mcp-permission-picker legend { margin-bottom: 7px; color: #5d565a; font-size: 10px; font-weight: 900; }
.mcp-permission-picker label { position: relative; display: grid; place-items: center; min-height: 82px; padding: 11px 8px; border-radius: 17px; text-align: center; background: rgba(255, 255, 255, 0.68); box-shadow: inset 0 0 0 1px rgba(72, 58, 66, 0.06); }
.mcp-permission-picker label.active { background: linear-gradient(145deg, #eaf8ef, #fff5f9); box-shadow: inset 0 0 0 1px rgba(84, 144, 107, 0.19); }
.mcp-permission-picker input { position: absolute; opacity: 0; }
.mcp-permission-picker span { display: grid; gap: 3px; }
.mcp-permission-picker strong { font-size: 12px; font-weight: 950; }
.mcp-permission-picker small { color: #877e83; font-size: 9px; font-weight: 700; line-height: 1.4; }

.mcp-modal-toggle { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 46px; align-items: center; gap: 12px; padding: 12px; border-radius: 17px; background: rgba(255, 255, 255, 0.72); }
.mcp-modal-toggle > span { display: grid; gap: 2px; }
.mcp-modal-toggle strong { font-size: 12px; font-weight: 900; }
.mcp-modal-toggle small { color: #887f84; font-size: 9px; font-weight: 700; }
.mcp-modal-toggle input { position: absolute; opacity: 0; }
.mcp-modal-toggle i { position: relative; width: 46px; height: 28px; border-radius: 999px; background: #ddd8dc; }
.mcp-modal-toggle i::after { position: absolute; top: 4px; left: 4px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 3px 8px rgba(50, 41, 46, 0.2); content: ''; transition: transform 0.18s; }
.mcp-modal-toggle input:checked + i { background: linear-gradient(135deg, #75d49a, #52bc7d); }
.mcp-modal-toggle input:checked + i::after { transform: translateX(18px); }

.mcp-two-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.mcp-file-import { position: relative; display: grid; grid-template-columns: 36px minmax(0, 1fr); align-items: center; gap: 10px; min-height: 64px; padding: 11px; border-radius: 18px; color: #587161; background: linear-gradient(145deg, #edf8f1, #fff7fa); overflow: hidden; }
.mcp-file-import > span { display: grid; gap: 2px; }
.mcp-file-import strong { font-size: 11px; font-weight: 900; }
.mcp-file-import small { color: #839087; font-size: 9px; font-weight: 700; }
.mcp-file-import input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

.mcp-modal-error { display: flex; align-items: flex-start; gap: 7px; flex: 0 0 auto; margin: 8px 0 0; padding: 9px 10px; border-radius: 14px; color: #bc4057; background: rgba(239, 68, 90, 0.1); font-size: 10px; font-weight: 800; line-height: 1.45; }
.mcp-modal-error svg { flex: 0 0 auto; }

.mcp-modal-footer { display: grid; grid-template-columns: minmax(88px, 0.75fr) minmax(0, 1.35fr); gap: 8px; flex: 0 0 auto; padding-top: 12px; }
.mcp-modal-footer button, .mcp-delete-confirm button { min-height: 43px; border-radius: 15px; color: #625b5f; background: rgba(235, 232, 235, 0.8); font-size: 11px; font-weight: 900; }
.mcp-modal-footer button.primary { color: #315d46; background: linear-gradient(135deg, #dbf4e5, #ffeef5); box-shadow: inset 0 0 0 1px rgba(77, 140, 103, 0.12), 0 10px 22px rgba(71, 115, 90, 0.1); }
.mcp-modal-footer button:disabled, .mcp-delete-confirm button:disabled { opacity: 0.55; }

.mcp-delete-confirm { display: grid; justify-items: center; gap: 9px; padding: 10px 4px 2px; text-align: center; }
.mcp-delete-confirm > span { display: grid; place-items: center; width: 58px; height: 58px; border-radius: 21px; color: #d8455d; background: #fff0f3; }
.mcp-delete-confirm > small { color: #bd8893; font-size: 9px; font-weight: 950; letter-spacing: 0.13em; }
.mcp-delete-confirm h2, .mcp-delete-confirm p { margin: 0; }
.mcp-delete-confirm h2 { color: #302a2d; font-size: 19px; font-weight: 950; }
.mcp-delete-confirm p { max-width: 300px; color: #82787d; font-size: 11px; font-weight: 700; line-height: 1.55; }
.mcp-delete-confirm > div { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; width: 100%; margin-top: 5px; }
.mcp-delete-confirm button.danger { color: #cb4057; background: #fff0f3; }

@media (max-width: 350px) {
  .mcp-modal-hero { grid-template-columns: 44px minmax(0, 1fr); padding: 13px; }
  .mcp-modal-icon { width: 44px; height: 44px; border-radius: 16px; }
  .mcp-modal-hero h2 { font-size: 16px; }
  .mcp-two-fields { grid-template-columns: 1fr; }
}
</style>