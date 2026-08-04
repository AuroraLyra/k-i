import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { MusicTrack } from '@/types/domain';
import { requestSilentKeepAliveResume } from '@/services/keepAlive';

export type PlaybackMode = 'sequence' | 'repeat-all' | 'shuffle' | 'repeat-one';

export interface MusicListenTogetherPartner {
  conversationId: string;
  characterId: string;
  userId: string;
  inviter: 'user' | 'char';
  joinedAt: number;
}

const recoveryWarmupMs = 10000;
const stallRecoveryDelayMs = 14000;
const progressRecoveryDelayMs = 18000;
const recoveryCooldownMs = 20000;
const haveFutureDataReadyState = 3;

export const useMusicPlayerStore = defineStore('musicPlayer', () => {
  const currentTrack = ref<MusicTrack | null>(null);
  const loadingAudioTrackId = ref('');
  const isPlaying = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const playbackError = ref('');
  const playbackMode = ref<PlaybackMode>('sequence');
  const playbackQueue = ref<MusicTrack[]>([]);
  const listeningPartner = ref<MusicListenTogetherPartner | null>(null);
  const currentLyricLine = ref('');
  const playbackEndedTick = ref(0);
  const playbackRecoveryTick = ref(0);
  const playbackRecoveryReason = ref('');
  const lastGoodTime = ref(0);
  let audio: HTMLAudioElement | null = null;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  let progressWatchTimer: ReturnType<typeof setInterval> | null = null;
  let pendingResumeAt: number | null = null;
  let lastProgressSecond = 0;
  let lastProgressAt = 0;
  let lastRecoveryRequestedAt = 0;
  let recoverySuppressedUntil = 0;

  const activeTrackId = computed(() => currentTrack.value?.id || '');
  const progressValue = computed(() => duration.value ? (currentTime.value / duration.value) * 100 : 0);

  function syncAudioProgress() {
    if (!audio) return;
    currentTime.value = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    duration.value = Number.isFinite(audio.duration) ? audio.duration : 0;
  }

  function clearStallTimer() {
    if (!stallTimer) return;
    clearTimeout(stallTimer);
    stallTimer = null;
  }

  function stopProgressWatch() {
    if (!progressWatchTimer) return;
    clearInterval(progressWatchTimer);
    progressWatchTimer = null;
  }

  function rememberAudioProgress() {
    if (!audio || audio.paused || audio.ended) return;
    const nextSecond = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    if (nextSecond > 0) lastGoodTime.value = nextSecond;
    if (nextSecond > lastProgressSecond + 0.25) {
      lastProgressSecond = nextSecond;
      lastProgressAt = Date.now();
    }
  }

  function applyPendingResume() {
    if (!audio || pendingResumeAt === null) return;
    try {
      const safeResumeAt = duration.value ? Math.min(pendingResumeAt, Math.max(0, duration.value - 2)) : pendingResumeAt;
      audio.currentTime = safeResumeAt;
      pendingResumeAt = null;
      syncAudioProgress();
    } catch {
      // Some remote streams only allow seeking after metadata is ready.
    }
  }

  function shouldRecoverPlayback() {
    if (!audio || !currentTrack.value || audio.paused || audio.ended) return false;
    if (Date.now() < recoverySuppressedUntil) return false;
    const currentSecond = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const totalSeconds = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (totalSeconds && currentSecond >= totalSeconds - 2) return false;
    return true;
  }

  function requestPlaybackRecovery(reason: string) {
    if (!shouldRecoverPlayback()) return;
    const now = Date.now();
    if (now - lastRecoveryRequestedAt < recoveryCooldownMs) return;
    lastRecoveryRequestedAt = now;
    playbackRecoveryReason.value = reason;
    playbackRecoveryTick.value += 1;
  }

  function scheduleStallRecovery(reason: string) {
    clearStallTimer();
    const scheduledSecond = audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    stallTimer = setTimeout(() => {
      if (!audio || !shouldRecoverPlayback()) return;
      const nextSecond = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
      if (nextSecond > scheduledSecond + 0.5) return;
      if (audio.readyState >= haveFutureDataReadyState) return;
      requestPlaybackRecovery(reason);
    }, stallRecoveryDelayMs);
  }

  function startProgressWatch() {
    if (progressWatchTimer || !audio) return;
    lastProgressSecond = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    lastProgressAt = Date.now();
    progressWatchTimer = setInterval(() => {
      const player = audio;
      if (!player || !shouldRecoverPlayback()) return;
      const nextSecond = Number.isFinite(player.currentTime) ? player.currentTime : 0;
      if (nextSecond > lastProgressSecond + 0.25) {
        lastProgressSecond = nextSecond;
        lastProgressAt = Date.now();
        return;
      }
      if (Date.now() - lastProgressAt > progressRecoveryDelayMs) requestPlaybackRecovery('播放流长时间没有推进');
    }, 2500);
  }

  function handleAudioTimeUpdate() {
    syncAudioProgress();
    rememberAudioProgress();
  }

  function handleAudioLoadedMetadata() {
    syncAudioProgress();
    applyPendingResume();
  }

  function bindAudioEvents(nextAudio: HTMLAudioElement) {
    nextAudio.addEventListener('timeupdate', handleAudioTimeUpdate);
    nextAudio.addEventListener('loadedmetadata', handleAudioLoadedMetadata);
    nextAudio.addEventListener('ended', handleAudioEnded);
    nextAudio.addEventListener('pause', handleAudioPaused);
    nextAudio.addEventListener('play', handleAudioPlayed);
    nextAudio.addEventListener('error', handleAudioError);
    nextAudio.addEventListener('stalled', handleAudioStalled);
    nextAudio.addEventListener('waiting', handleAudioWaiting);
    nextAudio.addEventListener('emptied', handleAudioEmptied);
    nextAudio.addEventListener('suspend', handleAudioSuspended);
    nextAudio.addEventListener('canplay', handleAudioCanPlay);
  }

  function unbindAudioEvents(currentAudio: HTMLAudioElement) {
    currentAudio.removeEventListener('timeupdate', handleAudioTimeUpdate);
    currentAudio.removeEventListener('loadedmetadata', handleAudioLoadedMetadata);
    currentAudio.removeEventListener('ended', handleAudioEnded);
    currentAudio.removeEventListener('pause', handleAudioPaused);
    currentAudio.removeEventListener('play', handleAudioPlayed);
    currentAudio.removeEventListener('error', handleAudioError);
    currentAudio.removeEventListener('stalled', handleAudioStalled);
    currentAudio.removeEventListener('waiting', handleAudioWaiting);
    currentAudio.removeEventListener('emptied', handleAudioEmptied);
    currentAudio.removeEventListener('suspend', handleAudioSuspended);
    currentAudio.removeEventListener('canplay', handleAudioCanPlay);
  }

  function handleAudioEnded() {
    isPlaying.value = false;
    clearStallTimer();
    stopProgressWatch();
    syncAudioProgress();
    playbackEndedTick.value += 1;
    requestSilentKeepAliveResume();
  }

  function handleAudioPaused() {
    isPlaying.value = false;
    clearStallTimer();
    stopProgressWatch();
    syncAudioProgress();
    requestSilentKeepAliveResume();
  }

  function handleAudioPlayed() {
    isPlaying.value = true;
    clearStallTimer();
    startProgressWatch();
    syncAudioProgress();
    rememberAudioProgress();
  }

  function handleAudioCanPlay() {
    clearStallTimer();
    syncAudioProgress();
  }

  function handleAudioError() {
    requestPlaybackRecovery('音频流错误');
  }

  function handleAudioStalled() {
    scheduleStallRecovery('音频流中断');
  }

  function handleAudioWaiting() {
    scheduleStallRecovery('音频缓冲超时');
  }

  function handleAudioEmptied() {
    clearStallTimer();
    syncAudioProgress();
  }

  function handleAudioSuspended() {
    syncAudioProgress();
  }

  function setAudioElement(element: HTMLAudioElement | null) {
    if (audio === element) return;
    if (audio) unbindAudioEvents(audio);
    clearStallTimer();
    stopProgressWatch();
    audio = element;
    if (!audio) return;
    bindAudioEvents(audio);
    syncAudioProgress();
  }

  function ensureAudio() {
    if (audio) return audio;
    if (typeof Audio === 'undefined') return null;
    const fallbackAudio = new Audio();
    fallbackAudio.preload = 'metadata';
    setAudioElement(fallbackAudio);
    return audio;
  }

  function setCurrentTrack(track: MusicTrack | null) {
    currentTrack.value = track;
  }

  function updateCurrentTrack(track: MusicTrack) {
    if (currentTrack.value?.id === track.id) currentTrack.value = track;
  }

  function setLoadingAudioTrackId(trackId: string) {
    loadingAudioTrackId.value = trackId;
  }

  function setPlaybackMode(mode: PlaybackMode) {
    playbackMode.value = mode;
  }

  function setPlaybackQueue(tracks: MusicTrack[]) {
    const dedupedTracks = new Map<string, MusicTrack>();
    tracks.forEach((track) => {
      if (track?.id) dedupedTracks.set(track.id, track);
    });
    playbackQueue.value = [...dedupedTracks.values()];
  }

  async function playTrack(track: MusicTrack, options: { restart?: boolean; resumeAt?: number } = {}) {
    const player = ensureAudio();
    if (!player) throw new Error('当前环境无法播放音频。');
    if (!track.audioUrl) throw new Error('歌曲暂无可播放地址。');
    const previousTrackId = currentTrack.value?.id || '';
    currentTrack.value = track;
    playbackError.value = '';
    clearStallTimer();
    recoverySuppressedUntil = Date.now() + recoveryWarmupMs;
    if (previousTrackId !== track.id) {
      lastGoodTime.value = 0;
      lastProgressSecond = 0;
    }
    const sourceChanged = player.src !== track.audioUrl;
    if (sourceChanged) player.src = track.audioUrl;
    if (options.restart || sourceChanged || player.ended) player.currentTime = 0;
    if (typeof options.resumeAt === 'number' && Number.isFinite(options.resumeAt) && options.resumeAt > 0) {
      pendingResumeAt = options.resumeAt;
      applyPendingResume();
    } else {
      pendingResumeAt = null;
    }
    await player.play();
  }

  async function toggleTrack(track: MusicTrack) {
    const player = ensureAudio();
    if (!player) throw new Error('当前环境无法播放音频。');
    if (currentTrack.value?.id === track.id && isPlaying.value) {
      player.pause();
      return;
    }
    await playTrack(track);
  }

  function pause() {
    audio?.pause();
  }

  function seekToPercent(percent: number) {
    const player = ensureAudio();
    if (!player || !duration.value) return;
    const normalizedPercent = Math.min(100, Math.max(0, percent));
    player.currentTime = (normalizedPercent / 100) * duration.value;
    syncAudioProgress();
  }

  function setCurrentLyricLine(line: string) {
    currentLyricLine.value = line.trim();
  }

  function startListenTogether(partner: Omit<MusicListenTogetherPartner, 'joinedAt'> & { joinedAt?: number }) {
    listeningPartner.value = {
      ...partner,
      joinedAt: partner.joinedAt ?? Date.now()
    };
  }

  function stopListenTogether(characterId?: string) {
    if (characterId && listeningPartner.value?.characterId !== characterId) return;
    listeningPartner.value = null;
  }

  function isListeningWithConversation(conversationId: string) {
    return listeningPartner.value?.conversationId === conversationId;
  }

  return {
    currentTrack,
    activeTrackId,
    loadingAudioTrackId,
    isPlaying,
    currentTime,
    duration,
    progressValue,
    playbackError,
    playbackMode,
    playbackQueue,
    playbackRecoveryTick,
    playbackRecoveryReason,
    lastGoodTime,
    listeningPartner,
    currentLyricLine,
    playbackEndedTick,
    setAudioElement,
    setCurrentTrack,
    updateCurrentTrack,
    setLoadingAudioTrackId,
    setPlaybackMode,
    setPlaybackQueue,
    playTrack,
    toggleTrack,
    pause,
    seekToPercent,
    syncAudioProgress,
    setCurrentLyricLine,
    startListenTogether,
    stopListenTogether,
    isListeningWithConversation
  };
});
