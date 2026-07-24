<template>
  <div v-if="activeTheater" class="theater-notice-backdrop" role="dialog" aria-modal="true" @click.self="closeNotice">
    <section class="theater-notice-sheet">
      <button class="theater-notice-close" type="button" aria-label="关闭小剧场提醒" @click="closeNotice">
        <X :size="18" />
      </button>
      <span>Theater notice</span>
      <h2>{{ activeTheater.authorName }} 生成了小剧场</h2>
      <article class="theater-notice-preview">
        <Clapperboard :size="24" />
        <strong>{{ activeTheater.title }}</strong>
        <small>{{ noticeSummary }}</small>
      </article>
      <button type="button" @click="openTheater">查看小剧场</button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Clapperboard, X } from 'lucide-vue-next';
import { playRingtone } from '@/services/ringtone';
import { useAppStore } from '@/stores/appStore';
import type { SmallTheater } from '@/types/domain';
import { globalSmallTheaterNoticeSeenStorageKey, readGlobalNoticeIds, writeGlobalNoticeIds } from '@/utils/globalNotices';

const seenStorageKey = globalSmallTheaterNoticeSeenStorageKey;

const router = useRouter();
const store = useAppStore();
const activeTheater = ref<SmallTheater | null>(null);
const seenTheaterIds = ref<Set<string>>(new Set());
const initialized = ref(false);
const theaterIds = computed(() => store.sortedSmallTheaters.map((theater) => theater.id).join('|'));
const noticeSummary = computed(() => {
  const theater = activeTheater.value;
  if (!theater) return '';
  const summary = theater.summary.trim();
  const topicTitle = theater.topicTitle.trim();
  if (!summary || (topicTitle && summary.includes(topicTitle))) return '独立番外小剧场已生成，点击查看完整页面。';
  return summary;
});

function loadSeenTheaterIds() {
  seenTheaterIds.value = readGlobalNoticeIds(seenStorageKey);
}

function persistSeenTheaterIds() {
  writeGlobalNoticeIds(seenStorageKey, seenTheaterIds.value);
}

function markCurrentTheatersSeen() {
  seenTheaterIds.value = new Set([...seenTheaterIds.value, ...store.sortedSmallTheaters.map((theater) => theater.id)]);
  persistSeenTheaterIds();
}

function showNextNotice() {
  if (activeTheater.value) return;
  const nextTheater = store.sortedSmallTheaters.find((theater) => !seenTheaterIds.value.has(theater.id));
  if (!nextTheater) return;
  activeTheater.value = nextTheater;
  void playRingtone(store.settings, 'theater', nextTheater.charId);
}

function closeNotice() {
  if (activeTheater.value) {
    seenTheaterIds.value = new Set([...seenTheaterIds.value, activeTheater.value.id]);
    persistSeenTheaterIds();
  }
  activeTheater.value = null;
  showNextNotice();
}

function openTheater() {
  const theaterId = activeTheater.value?.id;
  closeNotice();
  if (theaterId) void router.push({ name: 'small-theater-detail', params: { theaterId } });
}

watch(
  () => [store.ready, theaterIds.value] as const,
  ([ready]) => {
    if (!ready) return;
    if (!initialized.value) {
      loadSeenTheaterIds();
      markCurrentTheatersSeen();
      initialized.value = true;
      return;
    }
    loadSeenTheaterIds();
    if (activeTheater.value && seenTheaterIds.value.has(activeTheater.value.id)) {
      activeTheater.value = null;
    }
    showNextNotice();
  },
  { immediate: true }
);
</script>

<style scoped>
.theater-notice-backdrop {
  position: fixed;
  inset: 0;
  z-index: 231;
  display: grid;
  place-items: end center;
  padding: 18px calc(14px + var(--safe-right)) calc(18px + var(--safe-bottom)) calc(14px + var(--safe-left));
  background:
    radial-gradient(circle at 50% 100%, rgba(220, 193, 180, 0.2), transparent 38%),
    rgba(47, 39, 36, 0.3);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}

.theater-notice-sheet {
  position: relative;
  display: grid;
  gap: 12px;
  width: min(100%, 440px);
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 28px 28px 28px 10px;
  background:
    radial-gradient(circle at 94% 0%, rgba(231, 209, 198, 0.62), transparent 30%),
    linear-gradient(180deg, rgba(251, 248, 244, 0.98), rgba(245, 240, 234, 0.98));
  box-shadow: 0 26px 78px rgba(52, 41, 37, 0.22);
}

.theater-notice-close {
  position: absolute;
  top: 10px;
  right: 10px;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.56);
  color: #7f6c63;
}

.theater-notice-sheet > span {
  color: #aa8c7f;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.theater-notice-sheet h2 {
  margin: 0;
  padding-right: 28px;
}

.theater-notice-sheet h2 {
  color: #403633;
  font-family: Georgia, "Songti SC", serif;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.35;
}

.theater-notice-preview {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 5px 11px;
  padding: 13px;
  border: 1px solid rgba(128, 100, 88, 0.08);
  border-radius: 20px 20px 20px 8px;
  background: rgba(255, 255, 255, 0.58);
  color: #8d7165;
}

.theater-notice-preview svg {
  grid-row: span 2;
  align-self: center;
}

.theater-notice-preview strong,
.theater-notice-preview small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theater-notice-preview strong {
  color: #493e39;
  font-family: Georgia, "Songti SC", serif;
  font-size: 14px;
  font-weight: 600;
}

.theater-notice-preview small {
  color: #94847d;
  font-size: 11px;
}

.theater-notice-sheet > button:last-child {
  min-height: 42px;
  border-radius: 999px;
  background: #51443e;
  color: #ffffff;
  font-weight: 900;
  box-shadow: 0 10px 22px rgba(76, 57, 49, 0.12);
}
</style>