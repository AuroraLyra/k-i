<template>
  <section class="screen no-tabs services-placeholder-page">
    <header class="top-bar services-topbar">
      <button class="services-title-button" type="button" aria-label="返回主页" @click="goHome">
        <h1 class="top-title">Services</h1>
      </button>
      <div class="services-head-spacer"></div>
    </header>

    <main class="services-content" aria-label="Services">
      <section class="services-hero">
        <div class="services-hero-copy">
          <span>My utility shelf</span>
          <h2>服务与管理中心</h2>
          <p>后台守护、版本更新与私人数据各自独立</p>
        </div>
        <span class="services-hero-mark" aria-hidden="true">
          <Sparkles :size="22" stroke-width="1.8" />
        </span>
      </section>

      <div class="services-section-title">
        <span>Daily services</span>
        <small>6 spaces</small>
      </div>

      <section class="services-grid" aria-label="Services 功能列表">
        <button class="service-card featured tone-mint" type="button" @click="openService('service-keepalive')">
          <span class="service-icon"><BatteryCharging :size="25" stroke-width="1.8" /></span>
          <span class="service-copy">
            <small>Always near</small>
            <strong>Keep Alive</strong>
            <em>保活、角色通知与后台唤醒</em>
          </span>
          <span class="service-status">CARE</span>
          <ChevronRight class="service-arrow" :size="18" />
        </button>

        <button class="service-card tone-pink" type="button" @click="openService('service-update')">
          <span class="service-icon"><RefreshCw :size="22" stroke-width="1.8" /></span>
          <span class="service-copy">
            <small>Stay fresh</small>
            <strong>Update</strong>
            <em>网页更新与 App 安装包</em>
          </span>
          <ChevronRight class="service-arrow" :size="17" />
        </button>

        <button class="service-card tone-lilac" type="button" @click="openService('service-backup')">
          <span class="service-icon"><CloudUpload :size="22" stroke-width="1.8" /></span>
          <span class="service-copy">
            <small>Private archive</small>
            <strong>Backup</strong>
            <em>本地备份与自动备份</em>
          </span>
          <ChevronRight class="service-arrow" :size="17" />
        </button>

        <button class="service-card tone-blue" type="button" @click="openService('service-access')">
          <span class="service-icon"><KeyRound :size="22" stroke-width="1.8" /></span>
          <span class="service-copy">
            <small>Account guard</small>
            <strong>QQ 设备</strong>
            <em>网站登录设备管理</em>
          </span>
          <ChevronRight class="service-arrow" :size="17" />
        </button>

        <button class="service-card tone-cream" type="button" @click="openService('service-data')">
          <span class="service-icon"><Database :size="22" stroke-width="1.8" /></span>
          <span class="service-copy">
            <small>Local room</small>
            <strong>Data</strong>
            <em>存储保护与精准清理</em>
          </span>
          <ChevronRight class="service-arrow" :size="17" />
        </button>

        <button class="service-card tone-mcp" type="button" @click="openService('service-mcp-overview')">
          <span class="service-icon"><Network :size="22" stroke-width="1.8" /></span>
          <span class="service-copy">
            <small>Connected life</small>
            <strong>MCP</strong>
            <em>手机能力、联网搜索与外部连接</em>
          </span>
          <span class="service-dot" aria-hidden="true"></span>
          <ChevronRight class="service-arrow" :size="17" />
        </button>
      </section>

      <p class="services-footnote">Your story stays private, tidy and close.</p>
    </main>
  </section>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { BatteryCharging, ChevronRight, CloudUpload, Database, KeyRound, Network, RefreshCw, Sparkles } from 'lucide-vue-next';

type ServiceRouteName = 'service-keepalive' | 'service-update' | 'service-backup' | 'service-access' | 'service-data' | 'service-mcp-overview';

const router = useRouter();

function goHome() {
  void router.push({ name: 'home' });
}

function openService(name: ServiceRouteName) {
  void router.push({ name });
}
</script>

<style scoped>
.services-placeholder-page {
  background:
    radial-gradient(circle at top left, rgba(255, 217, 228, 0.72), transparent 30%),
    linear-gradient(180deg, #fff9fa, #f5f7fb 58%, #eef5ef);
}

.services-content {
  display: grid;
  align-content: start;
  gap: 14px;
  min-height: calc(var(--app-height) - 72px);
  padding: 14px 16px 28px;
}

.services-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 54px;
  align-items: center;
  gap: 14px;
  padding: 20px;
  border-radius: 28px;
  background:
    radial-gradient(circle at 96% 0%, rgba(194, 238, 213, 0.65), transparent 42%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.94), rgba(255, 245, 249, 0.9));
  box-shadow: 0 20px 44px rgba(45, 36, 41, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.82);
}

.services-hero-copy {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.services-hero-copy span {
  color: #a17c8a;
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.services-hero-copy h2,
.services-hero-copy p {
  margin: 0;
}

.services-hero-copy h2 {
  color: #1f1b1d;
  font-size: 20px;
  font-weight: 950;
  line-height: 1.24;
}

.services-hero-copy p {
  color: #797276;
  font-size: 11px;
  font-weight: 650;
  line-height: 1.55;
}

.services-hero-mark {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.78);
  color: #4b7d61;
  box-shadow: 0 12px 24px rgba(54, 57, 55, 0.08);
  transform: rotate(5deg);
}

.services-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px 0;
  color: #84797e;
}

.services-section-title span {
  font-size: 11px;
  font-weight: 950;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.services-section-title small {
  font-size: 10px;
  font-weight: 800;
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.service-card {
  position: relative;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: start;
  gap: 11px;
  min-width: 0;
  min-height: 150px;
  padding: 15px;
  overflow: hidden;
  border-radius: 25px;
  text-align: left;
  box-shadow: 0 15px 34px rgba(40, 35, 38, 0.065), inset 0 0 0 1px rgba(255, 255, 255, 0.72);
}

.service-card.featured {
  grid-column: 1 / -1;
  grid-template-columns: 54px minmax(0, 1fr) auto;
  align-items: center;
  min-height: 116px;
  padding: 17px;
}

.tone-mint { background: linear-gradient(145deg, rgba(239, 252, 245, 0.97), rgba(218, 245, 231, 0.92)); }
.tone-pink { background: linear-gradient(145deg, rgba(255, 248, 251, 0.97), rgba(250, 228, 237, 0.9)); }
.tone-lilac { background: linear-gradient(145deg, rgba(251, 248, 255, 0.97), rgba(235, 228, 249, 0.9)); }
.tone-blue { background: linear-gradient(145deg, rgba(248, 251, 255, 0.97), rgba(226, 237, 250, 0.92)); }
.tone-cream { background: linear-gradient(145deg, rgba(255, 253, 247, 0.97), rgba(247, 239, 218, 0.92)); }
.tone-mcp {
  background:
    radial-gradient(circle at 100% 0, rgba(206, 241, 223, 0.82), transparent 44%),
    linear-gradient(145deg, rgba(255, 249, 252, 0.98), rgba(241, 231, 248, 0.9));
}

.service-dot {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #65bd86;
  box-shadow: 0 0 0 5px rgba(101, 189, 134, 0.12);
}

.service-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.78);
  color: #343036;
  box-shadow: 0 8px 18px rgba(48, 42, 46, 0.07);
}

.featured .service-icon {
  width: 54px;
  height: 54px;
  border-radius: 20px;
}

.service-copy {
  display: grid;
  align-content: start;
  gap: 4px;
  min-width: 0;
}

.service-copy small {
  color: #947d87;
  font-size: 9px;
  font-weight: 950;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.service-copy strong {
  overflow: hidden;
  color: #201d1f;
  font-size: 16px;
  font-weight: 950;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.featured .service-copy strong {
  font-size: 19px;
}

.service-copy em {
  display: -webkit-box;
  overflow: hidden;
  color: #756f72;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.service-status {
  align-self: start;
  padding: 6px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.75);
  color: #43815c;
  font-size: 9px;
  font-weight: 950;
  letter-spacing: 0.08em;
}

.service-arrow {
  position: absolute;
  right: 13px;
  bottom: 13px;
  color: rgba(45, 41, 43, 0.4);
}

.featured .service-arrow {
  right: 16px;
  bottom: 15px;
}

.service-card:active {
  transform: scale(0.985);
}

.services-footnote {
  margin: 3px 0 0;
  color: #a0969a;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-align: center;
}

.services-title-button {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  padding: 0;
  color: inherit;
}

.services-title-button .top-title {
  margin: 0;
  text-align: left;
}

.services-head-spacer {
  width: 24px;
  height: 24px;
}

@media (max-width: 350px) {
  .services-content {
    padding-inline: 10px;
  }

  .service-card {
    padding: 12px;
  }
}
</style>
