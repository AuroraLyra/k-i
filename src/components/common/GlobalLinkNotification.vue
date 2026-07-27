<template>
  <Transition name="link-notification">
    <section
      v-if="activeNotice"
      class="link-notification-card"
      role="button"
      tabindex="0"
      aria-live="polite"
      @click="openNotice"
      @keydown.enter.prevent="openNotice"
      @keydown.space.prevent="openNotice"
    >
      <span class="link-notification-avatar" aria-hidden="true">
        <img v-if="activeNotice.icon" :src="activeNotice.icon" alt="" />
        <span v-else>{{ noticeInitial }}</span>
      </span>
      <span class="link-notification-copy">
        <strong>{{ activeNotice.title || 'BabyLink' }}</strong>
        <small>{{ activeNotice.body }}</small>
        <span v-if="activeNotice.kind === 'call'" class="link-notification-call-actions">
          <button type="button" class="reject" @click.stop="respondToCall('rejected')">拒绝</button>
          <button type="button" class="accept" @click.stop="respondToCall('accepted')">接听</button>
        </span>
      </span>
      <button class="link-notification-close" type="button" aria-label="关闭通知" @click.stop="closeNotice">
        <X :size="15" />
      </button>
    </section>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { X } from 'lucide-vue-next';
import {
  dispatchLinkNotificationClick,
  subscribeLinkNotificationShows,
  type LinkNotificationAction,
  type LinkNotificationEventPayload
} from '@/services/keepAlive';

const activeNotice = ref<LinkNotificationEventPayload | null>(null);
const queuedNotices: LinkNotificationEventPayload[] = [];
let closeTimer: number | undefined;
let unsubscribe: (() => void) | undefined;

const noticeInitial = computed(() => (activeNotice.value?.title || 'L').trim().charAt(0).toLocaleUpperCase());

function clearCloseTimer() {
  if (closeTimer === undefined) return;
  window.clearTimeout(closeTimer);
  closeTimer = undefined;
}

function scheduleClose() {
  clearCloseTimer();
  if (activeNotice.value?.kind === 'call') return;
  closeTimer = window.setTimeout(closeNotice, 5_500);
}

function showNextNotice() {
  activeNotice.value = queuedNotices.shift() ?? null;
  if (activeNotice.value) scheduleClose();
}

function receiveNotice(payload: LinkNotificationEventPayload) {
  if (activeNotice.value?.tag === payload.tag) {
    activeNotice.value = payload;
    scheduleClose();
    return;
  }
  const queuedIndex = queuedNotices.findIndex((notice) => notice.tag === payload.tag);
  if (queuedIndex >= 0) queuedNotices.splice(queuedIndex, 1);
  queuedNotices.push(payload);
  if (!activeNotice.value) showNextNotice();
}

function closeNotice() {
  clearCloseTimer();
  activeNotice.value = null;
  window.setTimeout(showNextNotice, 120);
}

function dispatchCurrentNotice(action: LinkNotificationAction) {
  const notice = activeNotice.value;
  if (!notice) return;
  dispatchLinkNotificationClick({ ...notice, action });
  closeNotice();
}

function openNotice() {
  dispatchCurrentNotice('open');
}

function respondToCall(action: 'accepted' | 'rejected') {
  dispatchCurrentNotice(action);
}

onMounted(() => {
  unsubscribe = subscribeLinkNotificationShows(receiveNotice);
});

onBeforeUnmount(() => {
  clearCloseTimer();
  unsubscribe?.();
});
</script>

<style scoped>
.link-notification-card {
  position: fixed;
  z-index: 260;
  top: calc(10px + var(--safe-top));
  left: calc(10px + var(--safe-left));
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 30px;
  align-items: start;
  gap: 11px;
  width: min(calc(100vw - 20px - var(--safe-left) - var(--safe-right)), 430px);
  min-height: 68px;
  padding: 11px 10px 11px 11px;
  border: 1px solid rgba(54, 47, 51, 0.06);
  border-radius: 19px;
  background: rgba(255, 255, 255, 0.96);
  color: #302d2f;
  box-shadow: 0 14px 42px rgba(39, 32, 36, 0.18);
  -webkit-backdrop-filter: blur(18px) saturate(1.15);
  backdrop-filter: blur(18px) saturate(1.15);
}

.link-notification-avatar {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  overflow: hidden;
  border-radius: 14px;
  background: linear-gradient(145deg, #eee8eb, #ddd4d9);
  color: #766a70;
  font-size: 18px;
  font-weight: 850;
}

.link-notification-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.link-notification-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding-top: 2px;
}

.link-notification-copy strong,
.link-notification-copy small {
  overflow: hidden;
  text-overflow: ellipsis;
}

.link-notification-copy strong {
  color: #282527;
  font-size: 13px;
  font-weight: 820;
  line-height: 1.25;
  white-space: nowrap;
}

.link-notification-copy small {
  display: -webkit-box;
  color: #81797d;
  font-size: 11px;
  line-height: 1.42;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.link-notification-close {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #f1edef;
  color: #8a8085;
}

.link-notification-call-actions {
  display: flex;
  gap: 7px;
  margin-top: 4px;
}

.link-notification-call-actions button {
  min-width: 54px;
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  color: #ffffff;
  font-size: 10px;
  font-weight: 800;
}

.link-notification-call-actions .reject { background: #dc5c5c; }
.link-notification-call-actions .accept { background: #38a865; }

.link-notification-enter-active,
.link-notification-leave-active {
  transition: opacity 180ms ease, transform 220ms cubic-bezier(.2, .85, .3, 1);
}

.link-notification-enter-from,
.link-notification-leave-to {
  opacity: 0;
  transform: translate3d(0, -18px, 0) scale(0.98);
}
</style>