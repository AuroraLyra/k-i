<template>
  <section ref="screenRef" :class="['screen', 'no-tabs', 'music-page', 'mode-' + pageMode]">
    <header v-if="pageMode !== 'player'" class="top-bar music-top-bar">
      <button class="subpage-title-button" type="button" aria-label="返回主页" @click="goHome">
        <h1 class="top-title">Music</h1>
      </button>
      <div class="icon-row music-actions">
        <button class="icon-button" type="button" aria-label="播放页" @click="setMode('player')">
          <Disc3 :size="21" />
        </button>
        <button class="icon-button" type="button" aria-label="我的喜欢" @click="setMode('likes')">
          <Heart :size="21" :fill="pageMode === 'likes' ? 'currentColor' : 'none'" />
        </button>
        <button class="icon-button" type="button" aria-label="搜索" @click="openSearch">
          <Search :size="24" />
        </button>
      </div>
    </header>

    <main class="music-content" :class="{ 'player-content': pageMode === 'player' }">
      <section v-if="pageMode === 'player'" class="player-panel">
        <div class="player-stage" @pointercancel="handlePlayerPointerCancel" @pointerdown="handlePlayerPointerDown" @pointermove="handlePlayerPointerMove" @pointerup="handlePlayerPointerUp">
          <div class="listen-pages" :style="playerSlideStyle">
            <section class="listen-page listen-cover-page" aria-label="一起听唱片页">
              <div class="listen-topline">
                <button type="button" aria-label="我的喜欢" @click="setMode('likes')"><Heart :size="20" /></button>
                <span>LINK FM</span>
                <button type="button" aria-label="搜索歌曲" @click="openSearch"><Search :size="21" /></button>
              </div>

              <div class="listen-room-head">
                <strong>{{ listenStatusTitle }}</strong>
                <div class="listen-avatars" :class="{ connected: listeningTogether }">
                  <span><img :src="currentUserAvatar" alt="" aria-hidden="true" /></span>
                  <span><img :src="listenPartnerAvatar" alt="" aria-hidden="true" /></span>
                </div>
                <p>{{ listenRoomCaption }}</p>
              </div>

              <div class="listen-doodle-layer" aria-hidden="true"><span>♡</span><span>♪</span><span>z</span><span>喵</span><span>。</span></div>

              <div class="record listen-record" :class="{ spinning: isPlaying }">
                <div class="grooves"></div>
                <div class="album-art">
                  <img :src="coverImageSrc(activeTrack)" alt="" aria-hidden="true" @error="handleCoverError" />
                </div>
              </div>

              <div class="listen-live-pill">
                <Heart :size="15" fill="currentColor" />
                <span>{{ activeLyricLine }}</span>
              </div>

              <div class="listen-track-actions">
                <div class="listen-song-meta">
                  <strong>{{ nowPlayingTitle }}</strong>
                  <span>{{ nowPlayingArtists }}</span>
                </div>
                <button class="listen-social-button" type="button" :disabled="!activeTrack" :class="{ active: activeTrack && isFavorite(activeTrack.id) }" :aria-label="favoriteActionLabel" @click="activeTrack && toggleFavorite(activeTrack)">
                  <Heart :size="31" :fill="activeTrack && isFavorite(activeTrack.id) ? 'currentColor' : 'none'" />
                  <span>99+</span>
                </button>
                <button class="listen-social-button" type="button" :disabled="!activeTrack" aria-label="评论区" @click="setMode('comments')">
                  <MessageSquareText :size="30" />
                  <span>99+</span>
                </button>
              </div>

              <section class="progress-panel listen-progress-panel" aria-label="播放控制">
                <div class="progress-row">
                  <span>{{ currentTimeLabel }}</span>
                  <input :value="progressValue" type="range" min="0" max="100" step="0.1" aria-label="播放进度" @input="seekAudio" />
                  <span>{{ durationLabel }}</span>
                </div>
                <div class="transport-row">
                  <button class="mode-toggle" type="button" :class="playbackMode" :aria-label="playModeLabel" @click="cyclePlaybackMode">
                    <Shuffle v-if="playbackMode === 'shuffle'" :size="25" />
                    <Repeat1 v-else-if="playbackMode === 'repeat-one'" :size="25" />
                    <Repeat v-else-if="playbackMode === 'repeat-all'" :size="25" />
                    <ListOrdered v-else :size="25" />
                  </button>
                  <button type="button" aria-label="上一首" @click="playNeighbor(-1)"><SkipBack :size="31" /></button>
                  <button class="main-play" type="button" :disabled="!activeTrack || loadingAudioTrackId === activeTrack?.id" :aria-label="isPlaying ? '暂停' : '播放'" @click="activeTrack && togglePlay(activeTrack)"><LoaderCircle v-if="activeTrack && loadingAudioTrackId === activeTrack.id" class="spin" :size="36" /><Pause v-else-if="isPlaying" :size="37" fill="currentColor" /><Play v-else :size="40" fill="currentColor" /></button>
                  <button type="button" aria-label="下一首" @click="playNeighbor(1)"><SkipForward :size="31" /></button>
                  <button type="button" aria-label="播放列表" @click="showQueuePanel = true"><ListMusic :size="25" /></button>
                </div>
              </section>
            </section>

            <section class="listen-page listen-lyrics-page" aria-label="一起听歌词页">
              <div class="listen-lyrics-backdrop" aria-hidden="true">
                <img :src="coverImageSrc(activeTrack)" alt="" @error="handleCoverError" />
              </div>
              <div class="lyrics-card-head">
                <strong>{{ nowPlayingTitle }}</strong>
                <small>{{ nowPlayingArtists }}</small>
              </div>
              <div ref="lyricScrollRef" class="full-lyrics" aria-label="完整歌词">
                <template v-if="parsedActiveLyrics.length">
                  <p v-for="(line, index) in parsedActiveLyrics" :key="`${line.time}-${index}`" :class="{ active: index === activeLyricIndex, passed: index < activeLyricIndex }">{{ line.text }}</p>
                </template>
                <p v-else class="active">{{ activeLyricLine }}</p>
              </div>
            </section>
          </div>
          <div class="listen-page-dots" aria-hidden="true"><span :class="{ active: playerPageIndex === 0 }"></span><span :class="{ active: playerPageIndex === 1 }"></span></div>
          <div v-if="showQueuePanel" class="queue-backdrop" @click.self="showQueuePanel = false" @pointerdown.stop>
            <section class="queue-panel" aria-label="播放列表">
              <div class="queue-head">
                <div><strong>播放列表</strong><span>{{ playModeLabel }} · {{ playbackQueue.length }} 首</span></div>
                <button type="button" aria-label="关闭播放列表" @click="showQueuePanel = false"><X :size="20" /></button>
              </div>
              <div class="queue-list">
                <button v-for="track in playbackQueue" :key="track.id" class="queue-track" type="button" :class="{ active: activeTrack?.id === track.id }" @click="selectQueueTrack(track)">
                  <span><strong>{{ track.name }}</strong><small>{{ trackArtists(track) }}</small></span>
                  <Pause v-if="activeTrack?.id === track.id && isPlaying" :size="18" fill="currentColor" />
                  <Play v-else-if="activeTrack?.id === track.id" :size="18" fill="currentColor" />
                </button>
                <p v-if="!playbackQueue.length">搜索或收藏歌曲后会出现在这里。</p>
              </div>
            </section>
          </div>
        </div>
      </section>

      <section v-else-if="pageMode === 'search'" class="content-sheet search-sheet">
        <div class="search-console">
          <div class="source-segment" aria-label="音乐源">
            <button type="button" :class="{ active: selectedSource === 'netease' }" @click="selectedSource = 'netease'">网易云</button>
            <button type="button" :class="{ active: selectedSource === 'kuwo' }" @click="selectedSource = 'kuwo'">酷我</button>
            <button type="button" :class="{ active: selectedSource === 'joox' }" @click="selectedSource = 'joox'">JOOX</button>
          </div>

          <form class="search-form" @submit.prevent="runSearch">
            <label class="search-field">
              <Search :size="18" />
              <input ref="searchInputRef" v-model="query" type="search" enterkeyhint="search" placeholder="输入歌名、歌手或专辑" />
            </label>
            <button type="submit" aria-label="执行搜索">
              <Search :size="18" />
            </button>
          </form>
        </div>

        <p v-if="searchError" class="message error">{{ searchError }}</p>
        <div v-if="searching" class="message"><LoaderCircle class="spin" :size="18" />正在搜索</div>
        <div v-else-if="searchResults.length" class="track-list">
          <div class="result-head">
            <strong>{{ query.trim() || '搜索结果' }}</strong>
            <small>{{ searchResults.length }} 首候选</small>
          </div>
          <article v-for="track in searchResults" :key="track.id" class="track-row" :class="{ active: activeTrack?.id === track.id }">
            <button class="track-main" type="button" @click="selectTrack(track, 'player')">
              <span class="track-cover"><img :src="coverImageSrc(track)" alt="" aria-hidden="true" @error="handleCoverError" /></span>
              <span><strong>{{ track.name }}</strong><small>{{ trackArtists(track) }} · {{ track.album || '未知专辑' }}</small></span>
            </button>
            <button class="favorite-toggle" type="button" :class="{ active: isFavorite(track.id) }" :aria-label="isFavorite(track.id) ? '从我的喜欢删除' : '加入我的喜欢'" @click="toggleFavorite(track)">
              <Heart :size="18" :fill="isFavorite(track.id) ? 'currentColor' : 'none'" />
            </button>
          </article>
          <button v-if="!searchEndReached" class="load-more-button" type="button" :disabled="loadingMoreSearch" @click="loadMoreSearch">
            <LoaderCircle v-if="loadingMoreSearch" class="spin" :size="16" />
            <span>{{ loadingMoreSearch ? '继续搜索中' : '更多' }}</span>
          </button>
          <p v-else class="load-more-note">暂时没有更多结果</p>
        </div>
        <div v-else class="message">点击右上角搜索，或输入关键词找歌。</div>
      </section>

      <section v-else-if="pageMode === 'comments'" class="content-sheet comments-sheet">
        <div class="comments-track-strip">
          <span class="comments-track-cover"><img :src="coverImageSrc(activeTrack)" alt="" aria-hidden="true" @error="handleCoverError" /></span>
          <div class="comments-track-title">
            <strong>{{ commentTrackTitle }}</strong>
            <span>- {{ nowPlayingArtists }}</span>
          </div>
        </div>

        <div class="comments-divider" aria-hidden="true"></div>

        <div class="comments-section-head">
          <strong>评论({{ activeThread?.comments.length || 0 }})</strong>
          <div class="comment-sort-tabs" aria-label="评论排序">
            <button type="button" :class="{ active: commentSortMode === 'recommend' }" @click="commentSortMode = 'recommend'">推荐</button>
            <button type="button" :class="{ active: commentSortMode === 'hot' }" @click="commentSortMode = 'hot'">最热</button>
            <button type="button" :class="{ active: commentSortMode === 'newest' }" @click="commentSortMode = 'newest'">最新</button>
          </div>
        </div>

        <p v-if="commentError" class="message error">{{ commentError }}</p>
        <div v-if="showFullCommentLoading" class="netease-loading"><LoaderCircle class="spin" :size="20" /> {{ generatingCommentMode === 'expand' ? '评论区拓展中' : '评论区生成中' }}</div>
        <div v-else-if="commentGroups.length" class="comment-list netease-comment-list">
          <article v-for="group in commentGroups" :key="group.comment.id" class="comment-card netease-comment-card">
            <span class="comment-avatar"><img :src="commentAvatar(group.comment)" alt="" aria-hidden="true" /></span>
            <div class="comment-body">
              <div class="comment-meta-row">
                <div class="comment-meta"><strong>{{ group.comment.authorName }}</strong><small>{{ commentSubtitle(group.comment) }}</small></div>
                <button class="comment-like-button" type="button" aria-label="点赞"><span>{{ commentLikeText(group.comment) }}</span><ThumbsUp :size="20" /></button>
              </div>
              <p>{{ group.comment.content }}</p>
              <small v-if="group.comment.contentTranslation" class="translation">{{ group.comment.contentTranslation }}</small>
              <button v-if="group.replies.length" class="reply-expand" type="button" @click="toggleCommentReplies(group.comment.id)">
                {{ expandedReplyIds.has(group.comment.id) ? '收起回复' : `展开${group.replies.length}条回复` }}
              </button>
              <div v-if="expandedReplyIds.has(group.comment.id)" class="inline-replies">
                <button v-for="reply in group.replies" :key="reply.id" type="button" @click="replyTargetId = reply.id">
                  <strong>{{ reply.authorName }}</strong><span>：{{ reply.content }}</span>
                </button>
              </div>
              <button class="comment-reply-action" type="button" @click="replyTargetId = group.comment.id">回复</button>
            </div>
          </article>
          <div v-if="showInlineCommentLoading" class="netease-inline-loading"><LoaderCircle class="spin" :size="16" /> 评论区拓展中</div>
        </div>
        <div v-else class="empty-room netease-empty-room">
          <MessageCircle :size="34" />
          <strong>{{ activeTrack ? '这首歌还没有听友入场' : '先选择一首歌' }}</strong>
          <span>{{ activeTrack ? '生成评论区，或者先写下第一句。' : '从搜索页点一首歌，再回来开评论现场。' }}</span>
        </div>

        <div class="comments-bottom-panel">
          <div class="comment-topic-row" aria-label="评论快捷操作">
            <button type="button"><Hash :size="16" />话题</button>
            <button type="button" :disabled="!activeTrack || generatingCommentTrackId === activeTrack.id" @click="generateThread('replace')"><Hash :size="16" />生成评论区</button>
            <button type="button" :disabled="!activeThread || !activeTrack || generatingCommentTrackId === activeTrack.id" @click="generateThread('expand')"><Hash :size="16" />拓展评论区</button>
          </div>
          <form v-if="activeTrack" class="comment-composer" @submit.prevent="submitUserComment">
            <div v-if="replyTargetId" class="reply-target">回复 {{ parentCommentName(replyTargetId) }}<button type="button" aria-label="取消回复" @click="replyTargetId = ''"><X :size="14" /></button></div>
            <div class="composer-row"><input v-model="commentDraft" type="text" maxlength="180" placeholder="听说爱评论的人粉丝多" /><button type="submit" :disabled="!commentDraft.trim()" :aria-label="commentDraft.trim() ? '发送评论' : '表情'"><Send v-if="commentDraft.trim()" :size="17" /><Smile v-else :size="21" /></button></div>
          </form>
        </div>
      </section>

      <section v-else class="content-sheet likes-sheet">
        <div class="playlist-hero">
          <div class="like-cover">
            <span v-for="track in favoritePreviewTracks" :key="track.id"><img :src="coverImageSrc(track)" alt="" aria-hidden="true" @error="handleCoverError" /></span>
            <Heart v-if="!favoritePreviewTracks.length" :size="46" fill="currentColor" />
          </div>
          <div><span>PRIVATE MIX</span><h2>我的喜欢</h2><p>{{ favoriteTracks.length }}首</p></div>
        </div>
        <div v-if="favoriteTracks.length" class="track-list">
          <article v-for="track in favoriteTracks" :key="track.id" class="track-row" :class="{ active: activeTrack?.id === track.id }">
            <button class="track-main" type="button" @click="selectTrack(track, 'player')">
              <span class="track-cover"><img :src="coverImageSrc(track)" alt="" aria-hidden="true" @error="handleCoverError" /></span>
              <span><strong>{{ track.name }}</strong><small>{{ trackArtists(track) }} · {{ track.album || '未知专辑' }}</small></span>
            </button>
            <button type="button" class="favorite-toggle active" aria-label="从我的喜欢删除" @click="toggleFavorite(track)"><Heart :size="18" fill="currentColor" /></button>
          </article>
        </div>
        <div v-else class="message">加入喜欢的歌曲会保存在这里。</div>
      </section>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Disc3, Hash, Heart, ListMusic, ListOrdered, LoaderCircle, MessageCircle, MessageSquareText, Pause, Play, Repeat, Repeat1, Search, Send, Shuffle, SkipBack, SkipForward, Smile, ThumbsUp, X } from 'lucide-vue-next';
import { deleteEntity, getDb, putEntity } from '@/data/db';
import { generateMusicCommentThread, hasSelectedTextGenerationConfig } from '@/services/ai';
import { fetchMusicCoverUrl, fetchMusicLyricText, mergeMusicTrack, refreshPlayableMusicTrack, searchMusicTracks } from '@/services/music';
import { useAppStore } from '@/stores/appStore';
import { useMusicPlayerStore } from '@/stores/musicPlayerStore';
import type { MusicComment, MusicCommentThread, MusicSource, MusicTrack, UserProfile, VisualProfile } from '@/types/domain';
import { createId } from '@/utils/id';
import { getUserAiName, normalizeVisualProfile } from '@/utils/profile';

type MusicPageMode = 'player' | 'search' | 'comments' | 'likes';
type PlaybackMode = 'sequence' | 'repeat-all' | 'shuffle' | 'repeat-one';
type CommentSortMode = 'recommend' | 'hot' | 'newest';
type CommentGroup = { comment: MusicComment; replies: MusicComment[] };

const playbackModeLabels: Record<PlaybackMode, string> = {
  sequence: '顺序播放',
  'repeat-all': '列表循环',
  shuffle: '随机播放',
  'repeat-one': '单曲循环'
};
const playbackModeOrder: PlaybackMode[] = ['sequence', 'repeat-all', 'shuffle', 'repeat-one'];
const commentRegions = ['河北', '湖南', '广西', '广东', '江苏', '浙江', '四川', '福建', '北京', '湖北', '云南', '重庆'];

const store = useAppStore();
const router = useRouter();
const musicPlayer = useMusicPlayerStore();
const searchCandidatePageSize = 60;
const pageMode = ref<MusicPageMode>('player');
const query = ref('');
const selectedSource = ref<MusicSource>('netease');
const fallbackCoverUrl = '/link-icon.png';
const searchResults = ref<MusicTrack[]>([]);
const favoriteTracks = ref<MusicTrack[]>([]);
const commentThreads = ref<MusicCommentThread[]>([]);
const searching = ref(false);
const loadingMoreSearch = ref(false);
const searchError = ref('');
const commentError = ref('');
const searchPage = ref(0);
const searchEndReached = ref(false);
const lastSearchKeyword = ref('');
const lastSearchSource = ref<MusicSource>('netease');
const loadingLyricTrackId = ref('');
const generatingCommentTrackId = ref('');
const generatingCommentMode = ref<'replace' | 'expand' | ''>('');
const commentDraft = ref('');
const replyTargetId = ref('');
const playerPageIndex = ref(0);
const commentSortMode = ref<CommentSortMode>('recommend');
const expandedReplyIds = ref(new Set<string>());
const showQueuePanel = ref(false);
const screenRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const lyricScrollRef = ref<HTMLElement | null>(null);
const lyricTextByTrackId = ref<Record<string, string>>({});
let playerPointerStart: { x: number; y: number; pointerId: number } | null = null;
let playerPointerTarget: HTMLElement | null = null;
let playerSwipeTracking = false;
let playRequestSerial = 0;

function goHome() {
  void router.push({ name: 'home' });
}

const activeTrackId = computed({
  get: () => musicPlayer.activeTrackId,
  set: (trackId: string) => {
    if (!trackId) {
      musicPlayer.setCurrentTrack(null);
      return;
    }
    const track = findTrack(trackId);
    if (track) musicPlayer.setCurrentTrack(track);
  }
});
const loadingAudioTrackId = computed(() => musicPlayer.loadingAudioTrackId);
const isPlaying = computed(() => musicPlayer.isPlaying);
const currentTime = computed(() => musicPlayer.currentTime);
const duration = computed(() => musicPlayer.duration);
const progressValue = computed(() => musicPlayer.progressValue);
const activeTrack = computed(() => findTrack(activeTrackId.value) ?? musicPlayer.currentTrack);
const activeThread = computed(() => {
  const track = activeTrack.value;
  return track ? commentThreads.value.find((thread) => thread.trackKey === getTrackKey(track)) : undefined;
});
const commentGroups = computed(() => buildCommentGroups(activeThread.value?.comments ?? []));
const isGeneratingActiveComments = computed(() => Boolean(activeTrack.value && generatingCommentTrackId.value === activeTrack.value.id));
const showFullCommentLoading = computed(() => isGeneratingActiveComments.value && (generatingCommentMode.value !== 'expand' || !commentGroups.value.length));
const showInlineCommentLoading = computed(() => isGeneratingActiveComments.value && generatingCommentMode.value === 'expand' && commentGroups.value.length > 0);
const favoritePreviewTracks = computed(() => favoriteTracks.value.slice(0, 4));
const playbackQueue = computed(() => {
  const sourceTracks = favoriteTracks.value.length ? favoriteTracks.value : searchResults.value;
  const track = activeTrack.value;
  if (!track || sourceTracks.some((entry) => entry.id === track.id)) return sourceTracks;
  return [track, ...sourceTracks];
});
const currentTimeLabel = computed(() => formatDuration(currentTime.value));
const durationLabel = computed(() => duration.value ? formatDuration(duration.value) : '03:40');
const nowPlayingTitle = computed(() => activeTrack.value?.name || '先搜索一首歌');
const nowPlayingArtists = computed(() => activeTrack.value ? trackArtists(activeTrack.value) : 'LINK FM');
const commentTrackTitle = computed(() => activeTrack.value?.name || '评论区');
const playbackMode = computed<PlaybackMode>({
  get: () => musicPlayer.playbackMode,
  set: (mode) => musicPlayer.setPlaybackMode(mode)
});
const playModeLabel = computed(() => playbackModeLabels[playbackMode.value]);
const favoriteActionLabel = computed(() => activeTrack.value && isFavorite(activeTrack.value.id) ? '已喜欢' : '喜欢');
const playerSlideStyle = computed(() => ({ transform: `translate3d(-${playerPageIndex.value * 100}%, 0, 0)` }));
const listenPartner = computed(() => musicPlayer.listeningPartner ? store.characterById(musicPlayer.listeningPartner.characterId) : null);
const listenConversation = computed(() => musicPlayer.listeningPartner ? store.conversationById(musicPlayer.listeningPartner.conversationId) : null);
const listenBoundUser = computed(() => {
  const conversationUserId = listenConversation.value?.userId || '';
  const characterBoundUserId = listenPartner.value?.boundUserId || '';
  const partnerUserId = musicPlayer.listeningPartner?.userId || '';
  return store.userById(conversationUserId) ?? store.userById(characterBoundUserId) ?? store.userById(partnerUserId) ?? null;
});
const listenConversationUserProfile = computed(() => listenBoundUser.value ? normalizeVisualProfile(listenPartner.value?.boundUserProfile, listenBoundUser.value) : null);
const currentUserAvatar = computed(() => listenConversationUserProfile.value?.avatar || homepageAvatar(listenBoundUser.value) || homepageAvatar(store.user) || fallbackCoverUrl);
const listeningTogether = computed(() => Boolean(listenPartner.value));
const listenPartnerAvatar = computed(() => listenPartner.value?.avatar || fallbackCoverUrl);
const listenStatusTitle = computed(() => listenPartner.value ? `正在和 ${listenPartner.value.nickname || listenPartner.value.name} 一起听` : '一起听待机中');
const listenRoomCaption = computed(() => listenPartner.value ? '相距520km，一起听了1314小时52分钟' : '从聊天里邀请角色后，右侧头像会亮起');
const parsedActiveLyrics = computed(() => {
  const track = activeTrack.value;
  return track ? parseLyricLines(lyricTextByTrackId.value[track.id] || '') : [];
});
const activeLyricIndex = computed(() => {
  const lines = parsedActiveLyrics.value;
  if (!lines.length) return -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (currentTime.value >= lines[index].time) return index;
  }
  return 0;
});
const activeLyricLine = computed(() => {
  const track = activeTrack.value;
  if (!track) return '搜索一首歌，开启滚动歌词与独立评论场';
  if (loadingLyricTrackId.value === track.id) return '歌词同步中';
  const lines = parsedActiveLyrics.value;
  if (!lines.length) return `${track.name} - ${trackArtists(track)}`;
  return lines[activeLyricIndex.value]?.text || lines[0]?.text || `${track.name} - ${trackArtists(track)}`;
});

onMounted(async () => {
  await store.hydrate();
  await loadMusicData();
  void hydrateFavoriteCovers();
});

watch(activeTrack, (track) => {
  if (track) void loadTrackLyric(track);
});

watch(() => store.musicFavoriteTracks, (tracks) => {
  favoriteTracks.value = [...tracks].sort((left, right) => (right.addedAt ?? 0) - (left.addedAt ?? 0));
}, { deep: true });

watch(activeLyricLine, (line) => {
  musicPlayer.setCurrentLyricLine(line);
}, { immediate: true });

watch([activeLyricIndex, playerPageIndex], () => {
  if (playerPageIndex.value !== 1) return;
  void nextTick(() => {
    const lyricScroller = lyricScrollRef.value;
    const activeLine = lyricScrollRef.value?.querySelector<HTMLElement>('p.active');
    if (!lyricScroller || !activeLine) return;
    const targetTop = activeLine.offsetTop - (lyricScroller.clientHeight - activeLine.offsetHeight) / 2;
    lyricScroller.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  });
});

watch(playbackQueue, (tracks) => musicPlayer.setPlaybackQueue(tracks), { immediate: true });

function setMode(mode: MusicPageMode) {
  pageMode.value = mode;
  scrollMusicToTop();
}

function openSearch() {
  pageMode.value = 'search';
  searchError.value = '';
  scrollMusicToTop();
  void nextTick(() => searchInputRef.value?.focus());
}

function scrollMusicToTop() {
  void nextTick(() => screenRef.value?.scrollTo({ top: 0, behavior: 'auto' }));
}

function getTrackKey(track: MusicTrack) {
  return `${track.source}:${track.platformId || track.id}`;
}

async function loadMusicData() {
  const db = await getDb();
  const [favorites, threads] = await Promise.all([
    db.getAll('musicFavoriteTracks'),
    db.getAll('musicCommentThreads')
  ]);
  favoriteTracks.value = favorites.sort((left, right) => (right.addedAt ?? 0) - (left.addedAt ?? 0));
  commentThreads.value = threads.sort((left, right) => right.updatedAt - left.updatedAt);
  store.syncMusicFavoriteTracks(favoriteTracks.value);
  if (!activeTrack.value) activeTrackId.value = favoriteTracks.value[0]?.id || '';
}

function trackArtists(track: MusicTrack) {
  return track.artists.join(' / ') || '未知歌手';
}

function coverImageSrc(track?: MusicTrack | null) {
  return track?.coverUrl || fallbackCoverUrl;
}

function handleCoverError(event: Event) {
  const image = event.currentTarget as HTMLImageElement | null;
  if (image && !image.src.endsWith(fallbackCoverUrl)) image.src = fallbackCoverUrl;
}

function findTrack(trackId: string) {
  return favoriteTracks.value.find((track) => track.id === trackId) ?? searchResults.value.find((track) => track.id === trackId) ?? null;
}

function isFavorite(trackId: string) {
  return favoriteTracks.value.some((track) => track.id === trackId);
}

function updateTrackEverywhere(nextTrack: MusicTrack) {
  const searchIndex = searchResults.value.findIndex((track) => track.id === nextTrack.id);
  if (searchIndex >= 0) searchResults.value[searchIndex] = nextTrack;
  const favoriteIndex = favoriteTracks.value.findIndex((track) => track.id === nextTrack.id);
  if (favoriteIndex >= 0) favoriteTracks.value[favoriteIndex] = nextTrack;
  const trackKey = getTrackKey(nextTrack);
  const threadIndex = commentThreads.value.findIndex((thread) => thread.trackKey === trackKey);
  if (threadIndex >= 0) commentThreads.value[threadIndex] = { ...commentThreads.value[threadIndex], track: nextTrack };
  musicPlayer.updateCurrentTrack(nextTrack);
}

async function withCover(track: MusicTrack) {
  if (track.coverUrl || !track.picId) return track;
  const coverUrl = await fetchMusicCoverUrl(track);
  if (!coverUrl) return track;
  return mergeMusicTrack(track, { coverUrl });
}

async function hydrateFavoriteCovers() {
  for (const track of favoriteTracks.value.filter((entry) => !entry.coverUrl && entry.picId).slice(0, 8)) {
    try {
      const nextTrack = await withCover(track);
      updateTrackEverywhere(nextTrack);
      await putEntity('musicFavoriteTracks', nextTrack);
    } catch {
      // 封面失败不影响播放和评论。
    }
  }
}

async function hydrateSearchCovers(tracks: MusicTrack[]) {
  await Promise.all(tracks.filter((track) => track.picId).slice(0, 8).map(async (track) => {
    try {
      updateTrackEverywhere(await withCover(track));
    } catch {
      // 封面失败不影响搜索结果。
    }
  }));
}

function withFavoriteState(tracks: MusicTrack[]) {
  return tracks.map((track) => favoriteTracks.value.find((favorite) => favorite.id === track.id) ?? track);
}

function appendSearchResults(tracks: MusicTrack[]) {
  const existingIds = new Set(searchResults.value.map((track) => track.id));
  const nextTracks = withFavoriteState(tracks).filter((track) => !existingIds.has(track.id));
  if (!nextTracks.length) return 0;
  searchResults.value = [...searchResults.value, ...nextTracks];
  return nextTracks.length;
}

async function fetchSearchPage(keyword: string, source: MusicSource, page: number) {
  return searchMusicTracks(keyword, source, page, searchCandidatePageSize);
}

async function runSearch() {
  const keyword = query.value.trim();
  if (!keyword || searching.value) return;
  searching.value = true;
  loadingMoreSearch.value = false;
  searchError.value = '';
  searchPage.value = 0;
  searchEndReached.value = false;
  lastSearchKeyword.value = keyword;
  lastSearchSource.value = selectedSource.value;
  try {
    const tracks = await fetchSearchPage(keyword, selectedSource.value, 1);
    searchResults.value = withFavoriteState(tracks);
    searchPage.value = 1;
    searchEndReached.value = !tracks.length;
    if (!activeTrackId.value && searchResults.value[0]) activeTrackId.value = searchResults.value[0].id;
    void hydrateSearchCovers(searchResults.value);
  } catch (error) {
    searchError.value = error instanceof Error ? error.message : '音乐搜索失败。';
  } finally {
    searching.value = false;
  }
}

async function loadMoreSearch() {
  const keyword = lastSearchKeyword.value || query.value.trim();
  if (!keyword || searching.value || loadingMoreSearch.value || searchEndReached.value) return;
  loadingMoreSearch.value = true;
  searchError.value = '';
  try {
    const nextPage = searchPage.value + 1;
    const tracks = await fetchSearchPage(keyword, lastSearchSource.value, nextPage);
    const addedCount = appendSearchResults(tracks);
    if (addedCount) {
      searchPage.value = nextPage;
      void hydrateSearchCovers(searchResults.value.slice(-addedCount));
    } else {
      searchEndReached.value = true;
    }
  } catch (error) {
    searchError.value = error instanceof Error ? error.message : '继续搜索失败。';
  } finally {
    loadingMoreSearch.value = false;
  }
}

async function selectTrack(track: MusicTrack, nextMode: MusicPageMode = 'player') {
  activeTrackId.value = track.id;
  pageMode.value = nextMode;
  scrollMusicToTop();
  replyTargetId.value = '';
  commentDraft.value = '';
  void loadTrackLyric(track);
  if (nextMode === 'player') {
    await playTrackNow(track);
    return;
  }
  if (!track.coverUrl) {
    try {
      updateTrackEverywhere(await withCover(track));
    } catch {
      // 封面失败不影响选择歌曲。
    }
  }
}

async function loadTrackLyric(track: MusicTrack) {
  if (lyricTextByTrackId.value[track.id] || loadingLyricTrackId.value === track.id) return;
  loadingLyricTrackId.value = track.id;
  try {
    const lyricText = await fetchMusicLyricText(track);
    lyricTextByTrackId.value = { ...lyricTextByTrackId.value, [track.id]: lyricText };
  } catch {
    lyricTextByTrackId.value = { ...lyricTextByTrackId.value, [track.id]: '' };
  } finally {
    if (loadingLyricTrackId.value === track.id) loadingLyricTrackId.value = '';
  }
}

function parseLyricLines(lyricText: string) {
  return lyricText.split('\n').flatMap((line) => {
    const matches = [...line.matchAll(/\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\]/g)];
    const text = line.replace(/\[[^\]]+\]/g, '').trim();
    if (!matches.length || !text) return [];
    return matches.map((match) => ({
      time: Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] ?? '0'}`),
      text
    }));
  }).sort((left, right) => left.time - right.time);
}

async function ensurePlayableTrack(track: MusicTrack) {
  const existing = findTrack(track.id) ?? track;
  musicPlayer.setLoadingAudioTrackId(track.id);
  try {
    const nextTrack = await refreshPlayableMusicTrack(existing);
    updateTrackEverywhere(nextTrack);
    if (isFavorite(nextTrack.id)) await store.saveMusicFavoriteTrack(nextTrack);
    return nextTrack;
  } finally {
    if (loadingAudioTrackId.value === track.id) musicPlayer.setLoadingAudioTrackId('');
  }
}

async function playTrackNow(track: MusicTrack, restart = false) {
  const requestId = ++playRequestSerial;
  try {
    const playableTrack = await ensurePlayableTrack(track);
    if (requestId !== playRequestSerial) return;
    activeTrackId.value = playableTrack.id;
    pageMode.value = 'player';
    await nextTick();
    if (requestId !== playRequestSerial) return;
    await musicPlayer.playTrack(playableTrack, { restart });
  } catch (error) {
    const message = error instanceof Error ? error.message : '歌曲播放失败。';
    if (!/interrupted by a call to pause/i.test(message)) searchError.value = message;
  }
}

async function togglePlay(track: MusicTrack) {
  if (loadingAudioTrackId.value === track.id) return;
  if (activeTrack.value?.id === track.id && isPlaying.value) {
    musicPlayer.pause();
    return;
  }
  await playTrackNow(track);
}

async function toggleFavorite(track: MusicTrack) {
  if (isFavorite(track.id)) {
    favoriteTracks.value = favoriteTracks.value.filter((entry) => entry.id !== track.id);
    await deleteEntity('musicFavoriteTracks', track.id);
    store.syncMusicFavoriteTracks(favoriteTracks.value);
    return;
  }
  const now = Date.now();
  const nextTrack = mergeMusicTrack(await withCover(track), { addedAt: now, updatedAt: now });
  favoriteTracks.value = [nextTrack, ...favoriteTracks.value];
  updateTrackEverywhere(nextTrack);
  await store.saveMusicFavoriteTrack(nextTrack);
}

function cyclePlaybackMode() {
  const currentIndex = playbackModeOrder.indexOf(playbackMode.value);
  playbackMode.value = playbackModeOrder[(currentIndex + 1) % playbackModeOrder.length];
}

function randomQueueTrack(list: MusicTrack[]) {
  if (list.length <= 1) return list[0] ?? null;
  const candidates = list.filter((track) => track.id !== activeTrackId.value);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? list[0] ?? null;
}

function selectQueueTrack(track: MusicTrack) {
  showQueuePanel.value = false;
  void playTrackNow(track);
}

function handlePlayerPointerDown(event: PointerEvent) {
  if (event.button !== 0 || event.isPrimary === false) return;
  const eventTarget = event.target;
  if (eventTarget instanceof Element && eventTarget.closest('button, a, input, textarea, select, [role="button"]')) return;
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  playerPointerStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
  playerPointerTarget = target;
  playerSwipeTracking = false;
  target.setPointerCapture(event.pointerId);
}

function handlePlayerPointerMove(event: PointerEvent) {
  if (!playerPointerStart || event.pointerId !== playerPointerStart.pointerId) return;
  const deltaX = event.clientX - playerPointerStart.x;
  const deltaY = event.clientY - playerPointerStart.y;
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);
  if (!playerSwipeTracking) {
    if (verticalDistance > 14 && verticalDistance > horizontalDistance) {
      handlePlayerPointerCancel();
      return;
    }
    if (horizontalDistance > 18 && horizontalDistance > verticalDistance * 1.2) playerSwipeTracking = true;
  }
  if (!playerSwipeTracking) return;
  event.preventDefault();
}

function handlePlayerPointerUp(event: PointerEvent) {
  if (!playerPointerStart || event.pointerId !== playerPointerStart.pointerId) return;
  const deltaX = event.clientX - playerPointerStart.x;
  if (playerSwipeTracking && Math.abs(deltaX) > 48) {
    const nextPage = playerPageIndex.value + (deltaX < 0 ? 1 : -1);
    playerPageIndex.value = Math.max(0, Math.min(1, nextPage));
  }
  handlePlayerPointerCancel();
}

function handlePlayerPointerCancel() {
  if (playerPointerStart && playerPointerTarget?.hasPointerCapture(playerPointerStart.pointerId)) {
    playerPointerTarget.releasePointerCapture(playerPointerStart.pointerId);
  }
  playerPointerStart = null;
  playerPointerTarget = null;
  playerSwipeTracking = false;
}

function upsertThread(thread: MusicCommentThread) {
  const index = commentThreads.value.findIndex((entry) => entry.trackKey === thread.trackKey);
  if (index >= 0) commentThreads.value[index] = thread;
  else commentThreads.value.unshift(thread);
}

async function saveThread(thread: MusicCommentThread) {
  upsertThread(thread);
  await putEntity('musicCommentThreads', thread);
}

async function generateThread(mode: 'replace' | 'expand') {
  const track = activeTrack.value;
  const currentUser = store.user;
  if (!track || !currentUser || generatingCommentTrackId.value) return;
  const modelOverride = store.settings?.modelOverrides.content?.trim() ?? '';
  if (!hasSelectedTextGenerationConfig(store.settings ?? undefined, modelOverride)) {
    store.showConfigAlert('请先在设置的模型切换中配置全局内容创作模型，再生成音乐评论区。', '需要配置模型');
    return;
  }
  const trackKey = getTrackKey(track);
  generatingCommentTrackId.value = track.id;
  generatingCommentMode.value = mode;
  commentError.value = '';
  try {
    const currentThread = commentThreads.value.find((thread) => thread.trackKey === trackKey);
    const existingComments = mode === 'expand' ? currentThread?.comments ?? [] : [];
    const generatedComments = await generateMusicCommentThread({
      track,
      user: currentUser,
      characters: store.characters,
      existingComments,
      mode,
      settings: store.settings ?? undefined,
      modelOverride
    });
    const now = Date.now();
    await saveThread({
      trackKey,
      track,
      comments: mode === 'expand' ? [...existingComments, ...generatedComments] : generatedComments,
      expanded: mode === 'expand' || Boolean(currentThread?.expanded),
      generatedAt: mode === 'replace' ? now : currentThread?.generatedAt ?? now,
      updatedAt: now
    });
  } catch (error) {
    commentError.value = error instanceof Error ? error.message : '评论区生成失败。';
  } finally {
    generatingCommentTrackId.value = '';
    generatingCommentMode.value = '';
  }
}

async function submitUserComment() {
  const track = activeTrack.value;
  const content = commentDraft.value.trim();
  const currentUser = store.user;
  if (!track || !content || !currentUser) return;
  const now = Date.now();
  const trackKey = getTrackKey(track);
  const comment: MusicComment = {
    id: createId('music_comment'),
    authorName: getUserAiName(currentUser),
    authorId: currentUser.id,
    authorType: 'user',
    avatar: currentUser.avatar,
    content,
    parentId: replyTargetId.value || undefined,
    createdAt: now
  };
  const thread = commentThreads.value.find((entry) => entry.trackKey === trackKey) ?? {
    trackKey,
    track,
    comments: [],
    expanded: true,
    generatedAt: now,
    updatedAt: now
  };
  await saveThread({ ...thread, comments: [...thread.comments, comment], expanded: true, updatedAt: now });
  commentDraft.value = '';
  replyTargetId.value = '';
}

function parentComment(commentId: string) {
  return activeThread.value?.comments.find((comment) => comment.id === commentId);
}

function parentCommentName(commentId: string) {
  return parentComment(commentId)?.authorName || '评论';
}

function buildCommentGroups(comments: MusicComment[]): CommentGroup[] {
  const knownIds = new Set(comments.map((comment) => comment.id));
  const repliesByParent = new Map<string, MusicComment[]>();
  const rootComments: MusicComment[] = [];

  comments.forEach((comment) => {
    if (comment.parentId && knownIds.has(comment.parentId)) {
      const replies = repliesByParent.get(comment.parentId) ?? [];
      replies.push(comment);
      repliesByParent.set(comment.parentId, replies);
      return;
    }
    rootComments.push(comment);
  });

  return sortRootComments(rootComments, repliesByParent).map((comment) => ({
    comment,
    replies: [...(repliesByParent.get(comment.id) ?? [])].sort((leftComment, rightComment) => leftComment.createdAt - rightComment.createdAt)
  }));
}

function sortRootComments(comments: MusicComment[], repliesByParent: Map<string, MusicComment[]>) {
  return [...comments].sort((leftComment, rightComment) => {
    if (commentSortMode.value === 'newest') return rightComment.createdAt - leftComment.createdAt;
    if (commentSortMode.value === 'hot') return commentLikeCount(rightComment) - commentLikeCount(leftComment) || rightComment.createdAt - leftComment.createdAt;
    const rightScore = commentLikeCount(rightComment) + (repliesByParent.get(rightComment.id)?.length ?? 0) * 360 + (rightComment.authorType === 'character' ? 120 : 0);
    const leftScore = commentLikeCount(leftComment) + (repliesByParent.get(leftComment.id)?.length ?? 0) * 360 + (leftComment.authorType === 'character' ? 120 : 0);
    return rightScore - leftScore || rightComment.createdAt - leftComment.createdAt;
  });
}

function toggleCommentReplies(commentId: string) {
  const nextIds = new Set(expandedReplyIds.value);
  if (nextIds.has(commentId)) nextIds.delete(commentId);
  else nextIds.add(commentId);
  expandedReplyIds.value = nextIds;
}

function commentAvatar(comment: MusicComment) {
  if (comment.authorType === 'character') return commentCharacterAvatar(comment) || fallbackCoverUrl;
  if (comment.authorType === 'user' && comment.avatar) return comment.avatar;
  return qqAvatarUrl(comment.authorId || comment.authorName || comment.id);
}

function commentCharacterAvatar(comment: MusicComment) {
  const character = comment.authorId ? store.characterById(comment.authorId) : store.characters.find((entry) => entry.name === comment.authorName || entry.nickname === comment.authorName);
  return character?.avatar || '';
}

function homepageAvatar(profileOwner?: (UserProfile & { profile?: Partial<VisualProfile> }) | null) {
  if (!profileOwner) return '';
  const profileAvatar = typeof profileOwner.profile?.avatar === 'string' ? profileOwner.profile.avatar.trim() : '';
  return profileAvatar || normalizeVisualProfile(profileOwner.profile, profileOwner).avatar || profileOwner.avatar || '';
}

function commentSubtitle(comment: MusicComment) {
  return `${formatCommentDate(comment.createdAt)} ${commentRegion(comment)}`;
}

function commentRegion(comment: MusicComment) {
  return commentRegions[hashText(`${comment.id}:${comment.authorName}`) % commentRegions.length];
}

function commentLikeText(comment: MusicComment) {
  const count = commentLikeCount(comment);
  if (count >= 10000) return `${(count / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  return count ? String(count) : '';
}

function commentLikeCount(comment: MusicComment) {
  if (comment.authorType === 'user') return 0;
  return hashText(`${comment.id}:${comment.content}`) % 5200;
}

function formatCommentDate(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '刚刚';
  const elapsed = Date.now() - timestamp;
  const dayMs = 24 * 60 * 60 * 1000;
  if (elapsed < 60 * 1000) return '刚刚';
  if (elapsed < dayMs) return `${Math.max(1, Math.floor(elapsed / (60 * 60 * 1000)))}小时前`;
  if (elapsed < 7 * dayMs) return `${Math.floor(elapsed / dayMs)}天前`;
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function padNumber(value: number) {
  return String(value).padStart(2, '0');
}

function qqAvatarUrl(seed: string) {
  const account = 100000 + (hashText(seed) % 899999999);
  return `https://q1.qlogo.cn/g?b=qq&nk=${account}&s=100`;
}

function hashText(value: string) {
  let hash = 0;
  Array.from(value).forEach((character) => {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  });
  return hash;
}

function seekAudio(event: Event) {
  const input = event.currentTarget as HTMLInputElement | null;
  musicPlayer.seekToPercent(Number(input?.value ?? progressValue.value));
}

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
  const rest = (safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

function playNeighbor(direction: -1 | 1) {
  const list = playbackQueue.value;
  if (!list.length) return;
  if (playbackMode.value === 'repeat-one' && activeTrack.value) {
    void playTrackNow(activeTrack.value, true);
    return;
  }
  if (playbackMode.value === 'shuffle') {
    const nextTrack = randomQueueTrack(list);
    if (nextTrack) void playTrackNow(nextTrack, true);
    return;
  }
  const currentIndex = Math.max(0, list.findIndex((track) => track.id === activeTrackId.value));
  const nextIndex = currentIndex + direction;
  if (playbackMode.value === 'sequence' && (nextIndex < 0 || nextIndex >= list.length)) return;
  const nextTrack = list[(nextIndex + list.length) % list.length];
  if (nextTrack) void playTrackNow(nextTrack, true);
}

</script>

<style scoped>
.music-page {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(237, 239, 242, 0.72) 42%, rgba(208, 212, 217, 0.62)),
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.025) 0 1px, transparent 1px 18px),
    #f3f4f6;
}

.music-top-bar {
  background: #ffffff;
  border-bottom: 1px solid transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.subpage-title-button {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  padding: 0;
  color: inherit;
}

.subpage-title-button .top-title {
  margin: 0;
  text-align: left;
}

.music-actions {
  gap: 2px;
}

.music-content {
  min-height: 0;
  padding: 0 16px 22px;
}

.music-content.player-content {
  height: 100%;
  padding: 0;
  overflow: hidden;
}

.track-list::-webkit-scrollbar {
  display: none;
}

.player-panel {
  display: grid;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.player-stage {
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 46%, rgba(255, 255, 255, 0.08), transparent 28%),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 4px),
    #080808;
  box-shadow: none;
  color: #ffffff;
  touch-action: pan-y;
}

.player-stage::before {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    radial-gradient(circle at 12% 18%, rgba(255, 255, 255, 0.13), transparent 5px),
    radial-gradient(circle at 88% 28%, rgba(255, 255, 255, 0.12), transparent 4px),
    radial-gradient(circle at 78% 76%, rgba(255, 255, 255, 0.1), transparent 5px);
  pointer-events: none;
  content: '';
}

.player-stage::after {
  position: absolute;
  right: 0;
  bottom: 86px;
  left: 0;
  height: 1px;
  background: transparent;
  pointer-events: none;
  content: '';
}

.listen-pages {
  position: relative;
  z-index: 2;
  display: flex;
  height: 100%;
  min-height: 0;
  transition: transform 360ms cubic-bezier(0.2, 0.72, 0.12, 1);
  will-change: transform;
}

.listen-page {
  position: relative;
  display: grid;
  flex: 0 0 100%;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: max(12px, var(--safe-top)) calc(20px + var(--safe-right)) max(18px, calc(10px + var(--safe-bottom))) calc(20px + var(--safe-left));
}

.listen-cover-page {
  grid-template-rows: auto auto minmax(0, 1fr) auto auto auto;
  align-content: stretch;
  justify-items: center;
  gap: 0;
}

.listen-lyrics-page {
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0;
  isolation: isolate;
  background: #151515;
}

.listen-lyrics-page::before {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(180deg, rgba(9, 9, 10, 0.52), rgba(12, 12, 13, 0.7) 40%, rgba(7, 7, 8, 0.86)),
    radial-gradient(circle at 50% 38%, transparent, rgba(0, 0, 0, 0.42) 74%);
  pointer-events: none;
  content: '';
}

.listen-lyrics-backdrop {
  position: absolute;
  inset: -60px;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.listen-lyrics-backdrop img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(52px) brightness(0.56) saturate(0.72);
  transform: scale(1.24);
}

.listen-topline {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  width: 100%;
  min-height: 38px;
}

.listen-topline span {
  justify-self: center;
  color: rgba(255, 255, 255, 0.92);
  font-size: 15px;
  font-weight: 950;
}

.listen-topline button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
}

.listen-room-head {
  display: grid;
  justify-items: center;
  gap: 8px;
  width: 100%;
  margin-top: 18px;
  text-align: center;
}

.listen-room-head strong {
  max-width: 100%;
  overflow: hidden;
  color: #ffffff;
  font-size: 17px;
  font-weight: 950;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listen-room-head p {
  margin: 0;
  color: rgba(255, 255, 255, 0.86);
  font-size: clamp(11px, 1.8dvh, 13px);
  font-weight: 900;
}

.listen-avatars {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 70px;
  padding: 4px 18px 6px;
}

.listen-avatars span {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 70px;
  height: 70px;
  overflow: hidden;
  border: 3px solid rgba(255, 255, 255, 0.95);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.28);
}

.listen-avatars span + span {
  margin-left: 0;
  opacity: 0.96;
  filter: none;
}

.listen-avatars.connected span + span {
  opacity: 1;
  filter: none;
}

.listen-avatars img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.listen-doodle-layer {
  position: absolute;
  inset: 72px 18px 120px;
  z-index: 0;
  pointer-events: none;
}

.listen-doodle-layer span {
  position: absolute;
  color: rgba(255, 255, 255, 0.72);
  font-size: 25px;
  font-weight: 950;
}

.listen-doodle-layer span:nth-child(1) { left: 3%; top: 8%; }
.listen-doodle-layer span:nth-child(2) { right: 12%; top: 3%; transform: rotate(-16deg); }
.listen-doodle-layer span:nth-child(3) { right: 4%; top: 49%; transform: rotate(14deg); }
.listen-doodle-layer span:nth-child(4) { left: 0; bottom: 22%; transform: rotate(-10deg); }
.listen-doodle-layer span:nth-child(5) { right: 22%; bottom: 6%; }

.record.listen-record {
  align-self: center;
  width: auto;
  max-width: min(82vw, 330px);
  height: min(100%, 330px);
  margin: 0;
  background:
    radial-gradient(circle at 50% 50%, transparent 0 42%, rgba(255, 255, 255, 0.12) 42.5% 44%, transparent 44.5% 48%, rgba(255, 255, 255, 0.1) 49% 50.5%, transparent 51%),
    radial-gradient(circle at 36% 28%, rgba(255, 255, 255, 0.22), transparent 19%),
    radial-gradient(circle at 50% 50%, #202124 0 36%, #070708 37% 57%, #1d1e20 58% 64%, #050505 65% 100%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.1),
    inset 0 20px 46px rgba(255, 255, 255, 0.1),
    inset 0 -28px 48px rgba(0, 0, 0, 0.84),
    0 28px 60px rgba(0, 0, 0, 0.72);
}

.record.listen-record::before {
  position: absolute;
  inset: 7%;
  border-radius: 50%;
  background:
    conic-gradient(from 245deg, transparent 0 64deg, rgba(255, 255, 255, 0.18) 78deg, transparent 100deg 360deg),
    radial-gradient(circle, transparent 0 47%, rgba(255, 255, 255, 0.12) 48%, transparent 49% 100%);
  mix-blend-mode: screen;
  opacity: 0.7;
  pointer-events: none;
  content: '';
}

.record.listen-record .grooves {
  inset: 4%;
  background:
    repeating-radial-gradient(circle, rgba(255, 255, 255, 0.12) 0 1px, transparent 1px 7px),
    conic-gradient(from 90deg, rgba(255, 255, 255, 0.1), transparent 24%, rgba(255, 255, 255, 0.12) 38%, transparent 56%, rgba(0, 0, 0, 0.62) 74%, rgba(255, 255, 255, 0.08));
  opacity: 0.58;
}

.record.listen-record .album-art {
  width: 61%;
  border: 0;
  background: #050505;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.14),
    0 0 0 7px rgba(0, 0, 0, 0.28),
    inset 0 -34px 45px rgba(255, 255, 255, 0.28),
    0 18px 32px rgba(0, 0, 0, 0.46);
}

.record.listen-record .album-art::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 47%, rgba(255, 255, 255, 0.42));
  pointer-events: none;
  content: '';
}

.listen-live-pill {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: min(86%, 360px);
  min-height: 34px;
  margin-top: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.28);
  padding: 0 14px;
  color: #ffffff;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.2);
}

.listen-live-pill span {
  overflow: hidden;
  font-size: 13px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listen-track-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px 32px;
  align-items: end;
  gap: 7px;
  width: 100%;
  margin-top: 14px;
  padding: 0 18px;
}

.listen-song-meta {
  display: grid;
  justify-items: start;
  gap: 3px;
  width: 100%;
  min-width: 0;
  text-align: left;
}

.listen-song-meta strong,
.listen-song-meta span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listen-song-meta strong {
  color: #ffffff;
  font-size: 14px;
  line-height: 1.08;
  font-weight: 950;
}

.listen-song-meta span {
  color: rgba(255, 255, 255, 0.82);
  font-size: 10px;
  font-weight: 820;
}

.listen-social-button {
  position: relative;
  display: grid;
  place-items: center;
  align-content: end;
  width: 32px;
  height: 31px;
  gap: 0;
  min-width: 0;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  font-weight: 950;
}

.listen-social-button svg {
  position: relative;
  z-index: 1;
  width: 22px;
  height: 22px;
  stroke-width: 2.35;
  filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.48));
}

.listen-social-button span {
  position: absolute;
  top: 2px;
  left: 23px;
  z-index: 3;
  min-width: 20px;
  overflow: hidden;
  color: #ffffff;
  font-size: 9.5px;
  line-height: 1;
  font-weight: 950;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.65);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listen-social-button.active {
  color: rgba(255, 255, 255, 0.92);
}

.listen-social-button.active svg {
  color: #ff4f6e;
  fill: #ff4f6e;
  stroke: #ff4f6e;
}

.progress-panel.listen-progress-panel {
  width: 100%;
  gap: 10px;
  margin-top: 28px;
  background: transparent !important;
  color: #ffffff;
  padding: 0;
}

.progress-panel.listen-progress-panel .progress-row {
  color: rgba(255, 255, 255, 0.88);
}

.progress-panel.listen-progress-panel .progress-row input {
  accent-color: #ffffff;
}

.progress-panel.listen-progress-panel .transport-row {
  grid-template-columns: repeat(5, 42px);
  justify-content: space-between;
  gap: 4px;
  width: min(100%, 300px);
  margin: 0 auto;
}

.progress-panel.listen-progress-panel .transport-row button,
.progress-panel.listen-progress-panel .transport-row .main-play {
  color: #ffffff;
}

.progress-panel.listen-progress-panel .transport-row .mode-toggle:not(.sequence) {
  color: #ffffff;
  filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.28));
}

.progress-panel.listen-progress-panel .transport-row .main-play svg {
  filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.48));
}

.listen-page-dots {
  position: absolute;
  left: 50%;
  bottom: max(5px, var(--safe-bottom));
  z-index: 4;
  display: flex;
  gap: 5px;
  transform: translateX(-50%);
}

.listen-page-dots span {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.34);
}

.listen-page-dots span.active {
  width: 14px;
  background: rgba(255, 255, 255, 0.9);
}

.queue-backdrop {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: grid;
  align-items: end;
  background: rgba(0, 0, 0, 0.28);
}

.queue-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  max-height: min(64dvh, 430px);
  min-height: min(52dvh, 360px);
  overflow: hidden;
  border-radius: 24px 24px 0 0;
  background: rgba(18, 18, 20, 0.96);
  color: #ffffff;
  box-shadow: 0 -24px 60px rgba(0, 0, 0, 0.48);
  backdrop-filter: blur(22px);
}

.queue-head {
  display: grid;
  grid-template-columns: 1fr 36px;
  align-items: center;
  gap: 10px;
  padding: 18px 18px 10px;
}

.queue-head > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.queue-head strong {
  font-size: 18px;
  font-weight: 950;
}

.queue-head span {
  color: rgba(255, 255, 255, 0.58);
  font-size: 12px;
  font-weight: 850;
}

.queue-head button,
.queue-track {
  border: 0;
  background: transparent;
  color: inherit;
}

.queue-head button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}

.queue-list {
  min-height: 0;
  overflow-y: auto;
  padding: 2px 10px calc(16px + var(--safe-bottom));
}

.queue-list::-webkit-scrollbar {
  display: none;
}

.queue-track {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24px;
  align-items: center;
  gap: 10px;
  width: 100%;
  border-radius: 14px;
  padding: 11px 10px;
  text-align: left;
}

.queue-track.active {
  background: rgba(255, 255, 255, 0.1);
}

.queue-track span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.queue-track strong,
.queue-track small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queue-track strong {
  font-size: 14px;
  font-weight: 950;
}

.queue-track small,
.queue-list p {
  color: rgba(255, 255, 255, 0.58);
  font-size: 12px;
  font-weight: 820;
}

.queue-list p {
  margin: 20px 8px;
  text-align: center;
}

.flip-card {
  position: relative;
  z-index: 2;
  min-height: 0;
  color: inherit;
  cursor: pointer;
  outline: none;
}

.flip-card:focus-visible {
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.78);
}

.flip-card-inner {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transition: transform 720ms cubic-bezier(0.2, 0.72, 0.12, 1);
}

.flip-card.flipped .flip-card-inner {
  transform: rotateY(180deg);
}

.flip-face {
  position: absolute;
  inset: 0;
  display: grid;
  min-height: 0;
  overflow: hidden;
  backface-visibility: hidden;
}

.flip-front {
  place-items: center;
  background: #ffffff;
}

.flip-front::before,
.flip-back::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: '';
}

.flip-front::before {
  background: none;
}

.flip-back {
  grid-template-rows: auto minmax(0, 1fr);
  gap: 16px;
  padding: 22px 20px 18px;
  color: #111317;
  background: #ffffff;
  transform: rotateY(180deg);
}

.flip-back::before {
  background: none;
}

.lyrics-card-head {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 5px;
  min-width: 0;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(17, 19, 23, 0.08);
}

.lyrics-card-head span {
  color: rgba(17, 19, 23, 0.5);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.18em;
}

.lyrics-card-head strong,
.lyrics-card-head small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lyrics-card-head strong {
  font-size: 21px;
  line-height: 1.15;
  font-weight: 950;
}

.lyrics-card-head small {
  color: rgba(17, 19, 23, 0.58);
  font-size: 12px;
  font-weight: 800;
}

.full-lyrics {
  position: relative;
  z-index: 1;
  display: grid;
  align-content: start;
  gap: 13px;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 4px 42px;
  mask-image: linear-gradient(180deg, transparent, #000 10%, #000 86%, transparent);
  scrollbar-width: none;
}

.full-lyrics::-webkit-scrollbar {
  display: none;
}

.full-lyrics p {
  margin: 0;
  color: rgba(17, 19, 23, 0.42);
  font-size: 15px;
  font-weight: 850;
  line-height: 1.45;
  text-align: left;
  transition: color 220ms ease, font-size 220ms ease, transform 220ms ease;
}

.full-lyrics p.passed {
  color: rgba(17, 19, 23, 0.28);
}

.full-lyrics p.active {
  color: #111317;
  font-size: 23px;
  line-height: 1.25;
  transform: translateX(8px);
  text-shadow: none;
}

.listen-lyrics-page .lyrics-card-head {
  z-index: 2;
  justify-items: center;
  gap: 3px;
  padding: 5px 36px 16px;
  border: 0;
  text-align: center;
}

.listen-lyrics-page .lyrics-card-head strong {
  max-width: 100%;
  color: #ffffff;
  font-size: 17px;
  font-weight: 750;
}

.listen-lyrics-page .lyrics-card-head small {
  max-width: 100%;
  color: rgba(255, 255, 255, 0.58);
  font-size: 12px;
  font-weight: 550;
}

.listen-lyrics-page .full-lyrics {
  z-index: 2;
  display: block;
  overscroll-behavior-y: contain;
  padding: clamp(210px, 44dvh, 460px) 10px clamp(240px, 48dvh, 500px);
  mask-image: linear-gradient(180deg, transparent, #000 9%, #000 90%, transparent);
  touch-action: pan-y;
}

.listen-lyrics-page .full-lyrics p {
  margin: 0 0 clamp(18px, 2.8dvh, 28px);
  color: rgba(255, 255, 255, 0.46);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.75;
  text-align: center;
  transform: scale(1);
  transform-origin: center;
  transition: color 260ms ease, font-size 260ms ease, opacity 260ms ease, transform 260ms ease;
}

.listen-lyrics-page .full-lyrics p.passed {
  color: rgba(255, 255, 255, 0.34);
}

.listen-lyrics-page .full-lyrics p.active {
  color: #ffffff;
  font-size: 18px;
  font-weight: 760;
  line-height: 1.65;
  transform: scale(1.04);
  text-shadow: 0 3px 18px rgba(0, 0, 0, 0.45);
}

.signal-caption {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 9px;
  color: rgba(17, 19, 23, 0.58);
}

.signal-caption span,
.room-copy span,
.playlist-hero > div:last-child > span {
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.signal-caption strong {
  border-radius: 999px;
  background: rgba(17, 19, 23, 0.08);
  padding: 5px 9px;
  color: #111317;
  font-size: 11px;
}

.record {
  position: relative;
  display: grid;
  place-items: center;
  width: min(70vw, 292px);
  aspect-ratio: 1;
  margin-top: 58px;
  border-radius: 50%;
  background: #111114;
  box-shadow: 0 0 0 12px rgba(255, 255, 255, 0.08), 0 22px 38px rgba(7, 10, 18, 0.42);
}

.record.spinning {
  animation: rotate-record 12s linear infinite;
}

.grooves {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: repeating-radial-gradient(circle, #1d1d1f 0 2px, #101011 3px 5px);
}

.album-art {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 68%;
  aspect-ratio: 1;
  overflow: hidden;
  border: 7px solid #ffffff;
  border-radius: 50%;
  background: #eef3f8;
  color: #6d737c;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08), 0 10px 24px rgba(0, 0, 0, 0.22);
}

.album-art img,
.track-cover img,
.comment-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.song-summary,
.progress-panel,
.content-sheet {
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 18px 34px rgba(31, 38, 54, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.74);
  backdrop-filter: blur(18px);
}

.song-summary {
  display: grid;
  grid-template-columns: 42px 1fr auto;
  align-items: center;
  gap: 11px;
  padding: 15px;
}

.sound-button,
.song-social-actions button,
.transport-row button,
.track-row > button:not(.track-main),
.comment-toolbar button,
.comment-body button,
.comment-composer button,
.reply-target button,
.search-form button {
  border: 0;
  background: transparent;
  color: inherit;
}

.music-page svg,
.music-page img {
  pointer-events: none;
}

.sound-button {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(180deg, #f7f9fc, #edf1f7);
  color: #697284;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
}

.song-title-block {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.song-title-block strong,
.track-main strong {
  overflow: hidden;
  color: #101525;
  font-size: 16px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-title-block span,
.track-main small,
.sheet-heading small,
.comment-meta small,
.translation {
  overflow: hidden;
  color: #8a909b;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-social-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.song-social-actions button {
  display: grid;
  justify-items: center;
  gap: 2px;
  color: #7b8291;
}

.song-social-actions button.active,
.track-row > button.active {
  color: #111317;
}

.song-social-actions small {
  font-size: 10px;
  font-weight: 800;
}

.progress-panel {
  display: grid;
  position: relative;
  z-index: 3;
  gap: 10px;
  border-radius: 0;
  background: #ffffff;
  padding: 15px 18px 22px;
  box-shadow: none;
  backdrop-filter: none;
}

.progress-row {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  gap: 8px;
  color: rgba(17, 19, 23, 0.58);
  font-size: 12px;
}

.progress-row input {
  width: 100%;
  accent-color: #111317;
}

.now-playing-line {
  display: grid;
  justify-items: center;
  gap: 2px;
  min-width: 0;
  color: #111317;
}

.now-playing-line strong,
.now-playing-line span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.now-playing-line strong {
  font-size: 17px;
  line-height: 1.15;
  font-weight: 950;
}

.now-playing-line span {
  color: rgba(17, 19, 23, 0.52);
  font-size: 12px;
  font-weight: 800;
}

.cover-now-playing {
  position: absolute;
  top: 66px;
  right: 24px;
  left: 24px;
  z-index: 4;
  pointer-events: none;
}

.transport-row {
  display: grid;
  grid-template-columns: repeat(5, 40px);
  align-items: center;
  justify-items: center;
  justify-content: center;
  gap: 8px;
}

.transport-row button {
  position: relative;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: transparent;
  color: #111317;
  box-shadow: none;
  backdrop-filter: none;
  transition: transform 160ms ease, color 160ms ease, filter 160ms ease;
}

.transport-row button:active {
  transform: scale(0.94);
}

.transport-row button.active {
  background: transparent;
  color: #111317;
  box-shadow: none;
  filter: drop-shadow(0 0 12px rgba(17, 19, 23, 0.18));
}

.transport-row .favorite-toggle.active {
  color: #e93b57;
  filter: drop-shadow(0 0 12px rgba(233, 59, 87, 0.22));
}

.transport-row button.active svg {
  fill: currentColor;
  stroke: currentColor;
}

.track-row > .favorite-toggle.active {
  color: #e93b57;
}

.transport-row button svg {
  width: 23px;
  height: 23px;
}

.transport-row .main-play {
  width: 40px;
  height: 40px;
  background: transparent;
  box-shadow: none;
  color: #111317;
}

.transport-row .main-play svg {
  width: 31px;
  height: 31px;
  filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.28));
}

.content-sheet {
  display: grid;
  align-content: start;
  gap: 15px;
  padding: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.search-sheet,
.comments-sheet,
.likes-sheet {
  min-height: 520px;
}

.room-hero,
.playlist-hero,
.library-stats,
.search-form,
.search-console,
.source-segment,
.track-list,
.comment-toolbar,
.comment-list,
.empty-room,
.comment-composer {
  border-radius: 8px;
}

.search-console {
  display: grid;
  gap: 10px;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(238, 240, 243, 0.74)),
    repeating-linear-gradient(90deg, rgba(0, 0, 0, 0.03) 0 1px, transparent 1px 16px);
  padding: 10px;
  box-shadow: 0 18px 34px rgba(24, 28, 34, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.76);
}

.search-form {
  display: grid;
  grid-template-columns: 1fr 44px;
  gap: 8px;
  padding: 7px;
  background: rgba(17, 19, 23, 0.06);
  box-shadow: inset 0 0 0 1px rgba(17, 19, 23, 0.06);
}

.source-segment {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  background: rgba(17, 19, 23, 0.08);
  padding: 4px;
}

.source-segment button {
  min-height: 34px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #656b74;
  font-size: 12px;
  font-weight: 900;
}

.source-segment button.active {
  background: #ffffff;
  color: #111317;
  box-shadow: 0 8px 18px rgba(17, 19, 23, 0.1), inset 0 0 0 1px rgba(17, 19, 23, 0.06);
}

.search-field,
.search-form select,
.search-form button,
.message,
.track-row,
.comment-card,
.comment-composer {
  border-radius: 8px;
  background: #f4f6fa;
}

.search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  padding: 0 14px;
  color: #68707a;
}

.search-field input,
.composer-row input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #101525;
}

.search-form select,
.search-form button {
  min-height: 46px;
  border: 0;
  color: #101525;
}

.search-form button {
  display: grid;
  place-items: center;
  background: #ffffff;
  color: #111317;
  box-shadow: inset 0 0 0 1px rgba(17, 19, 23, 0.08);
}

.track-list,
.comment-list {
  display: grid;
  gap: 10px;
  background: rgba(255, 255, 255, 0.58);
  padding: 9px;
  box-shadow: inset 0 0 0 1px rgba(20, 25, 38, 0.035);
}

.search-sheet .track-list {
  padding-bottom: calc(9px + var(--tab-height) + var(--safe-bottom));
}

.result-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  padding: 3px 3px 2px;
}

.result-head strong {
  color: #101525;
  font-size: 17px;
  font-weight: 900;
}

.result-head small {
  color: #8a909b;
  font-weight: 800;
}

.track-row {
  display: grid;
  grid-template-columns: 1fr 36px 36px;
  align-items: center;
  gap: 8px;
  padding: 9px;
  box-shadow: inset 0 0 0 1px rgba(20, 25, 38, 0.035), 0 8px 18px rgba(31, 38, 54, 0.035);
}

.track-row.active {
  background: #eef2f8;
}

.search-sheet .track-row,
.likes-sheet .track-row {
  grid-template-columns: 1fr 36px;
}

.track-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
}

.track-main span:last-child {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.track-cover {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 8px;
  background: linear-gradient(135deg, #e8edf5, #d9e1ee);
  color: #657083;
}

.track-row > button:not(.track-main) {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  color: #657083;
}

.load-more-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 42px;
  border: 0;
  border-radius: 8px;
  background: #ffffff;
  color: #111317;
  font-size: 13px;
  font-weight: 900;
  box-shadow: inset 0 0 0 1px rgba(17, 19, 23, 0.08), 0 8px 18px rgba(31, 38, 54, 0.04);
}

.load-more-button:disabled {
  cursor: progress;
  opacity: 0.72;
}

.load-more-note {
  margin: 0;
  padding: 11px 8px 3px;
  color: #8a909b;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
}

.sheet-heading {
  display: grid;
  gap: 4px;
}

.sheet-heading span {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #101525;
  font-size: 18px;
  font-weight: 900;
}

.search-heading {
  padding: 2px 2px 0;
}

.room-hero {
  display: grid;
  grid-template-columns: 72px 1fr 38px;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  background: linear-gradient(135deg, #111827, #263348);
  padding: 13px;
  color: #ffffff;
  box-shadow: 0 18px 34px rgba(17, 24, 39, 0.16);
}

.room-cover {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  overflow: hidden;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.13);
  color: rgba(255, 255, 255, 0.88);
}

.room-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.room-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.room-copy strong {
  overflow: hidden;
  font-size: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-copy small,
.room-copy span {
  color: rgba(255, 255, 255, 0.68);
}

.room-meter {
  display: grid;
  align-items: end;
  grid-template-columns: repeat(4, 4px);
  gap: 3px;
  height: 44px;
}

.room-meter i {
  border-radius: 999px;
  background: #dfe3e8;
}

.room-meter i:nth-child(1) { height: 34%; }
.room-meter i:nth-child(2) { height: 78%; }
.room-meter i:nth-child(3) { height: 52%; }
.room-meter i:nth-child(4) { height: 92%; }

.comment-toolbar {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.62);
  padding: 8px;
}

.comment-toolbar button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 38px;
  padding: 0 10px;
  border-radius: 999px;
  background: #f4f6fa;
  color: #657083;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.comment-toolbar button:disabled {
  opacity: 0.5;
}

.transport-row button:disabled {
  opacity: 1;
}

.comment-card {
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 10px;
  padding: 11px;
  box-shadow: inset 0 0 0 1px rgba(20, 25, 38, 0.035), 0 8px 18px rgba(31, 38, 54, 0.035);
}

.empty-room {
  display: grid;
  justify-items: center;
  gap: 8px;
  min-height: 150px;
  align-content: center;
  background: rgba(255, 255, 255, 0.68);
  color: #737b8c;
  padding: 22px;
  text-align: center;
  box-shadow: inset 0 0 0 1px rgba(20, 25, 38, 0.035);
}

.empty-room strong {
  color: #101525;
  font-size: 16px;
}

.empty-room span {
  max-width: 230px;
}

.comment-avatar {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  overflow: hidden;
  border-radius: 50%;
  background: linear-gradient(135deg, #e8edf5, #d9e1ee);
  color: #657083;
}

.comment-body {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 7px;
}

.comment-meta strong {
  color: #101525;
}

.comment-body p {
  margin: 0;
  color: #343946;
  line-height: 1.45;
  word-break: break-word;
}

.reply-quote {
  border-radius: 8px;
  background: #edf1f7;
  padding: 7px 9px;
  color: #737b8c !important;
}

.comment-body button {
  justify-self: start;
  padding: 0;
  color: #8a909b;
}

.comment-composer {
  display: grid;
  gap: 8px;
  padding: 9px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: inset 0 0 0 1px rgba(20, 25, 38, 0.035), 0 12px 24px rgba(31, 38, 54, 0.06);
}

.reply-target,
.composer-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reply-target {
  justify-content: space-between;
  color: #737b8c;
  padding: 0 4px;
}

.composer-row button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #101525;
  color: #ffffff;
}

.playlist-hero {
  position: relative;
  display: grid;
  grid-template-columns: 104px 1fr;
  align-items: center;
  gap: 16px;
  min-height: 154px;
  overflow: hidden;
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.16), transparent 28%),
    linear-gradient(135deg, #2a2d33 0%, #5b626c 44%, #111317 100%);
  padding: 18px;
  color: #ffffff;
  box-shadow: 0 18px 34px rgba(17, 19, 23, 0.18);
}

.playlist-hero::after {
  position: absolute;
  right: 18px;
  bottom: 18px;
  left: 122px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.34));
  content: '';
}

.like-cover {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
  width: 94px;
  height: 94px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.24);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 18px 28px rgba(5, 6, 8, 0.24);
}

.like-cover > span {
  display: grid;
  place-items: center;
  min-width: 0;
  overflow: hidden;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.18);
}

.like-cover > svg {
  grid-column: 1 / -1;
  align-self: center;
  justify-self: center;
}

.like-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-hero > div:last-child {
  position: relative;
  z-index: 1;
}

.playlist-hero h2,
.playlist-hero p {
  margin: 0;
}

.playlist-hero h2 {
  font-size: 22px;
  line-height: 1.1;
}

.library-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 9px;
}

.library-stats span {
  display: grid;
  gap: 3px;
  min-height: 68px;
  align-content: center;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.74);
  padding: 10px;
  text-align: center;
  box-shadow: inset 0 0 0 1px rgba(20, 25, 38, 0.035);
}

.library-stats strong {
  color: #101525;
  font-size: 19px;
  line-height: 1;
}

.library-stats small {
  color: #8a909b;
  font-weight: 800;
}

.message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  padding: 12px;
  color: #737b8c;
  text-align: center;
  box-shadow: inset 0 0 0 1px rgba(20, 25, 38, 0.035);
}

.comments-sheet .message {
  min-height: 108px;
}

.music-page.mode-comments {
  overflow-y: auto;
  background: #ffffff;
  color: #20232b;
  font-family: var(--app-current-font-family);
}

.music-page.mode-comments .music-content {
  min-height: 0;
  padding: 0 0 92px;
  color: #20232b;
}

.music-page.mode-comments .comments-sheet {
  min-height: 0;
  gap: 0;
  background: #ffffff;
}

.music-page.mode-comments .music-top-bar {
  background: #ffffff;
  border-bottom-color: transparent;
  color: #111317;
}

.music-page.mode-comments .icon-button {
  color: #111317;
}

.music-page.mode-comments button {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
}

.netease-comments-header {
  position: sticky;
  top: 0;
  z-index: 8;
  display: grid;
  grid-template-columns: 52px 1fr 86px;
  align-items: center;
  min-height: 76px;
  padding: 12px 18px 0;
  background: #ffffff;
}

.netease-comments-header > button,
.netease-header-actions button {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  color: #2c2f36;
}

.netease-title-tabs {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 26px;
  min-width: 0;
}

.netease-title-tabs button {
  position: relative;
  min-height: 44px;
  color: #8e929b;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 0;
  white-space: nowrap;
}

.netease-title-tabs button.active {
  color: #171a22;
}

.netease-title-tabs button.active::after {
  position: absolute;
  left: 50%;
  bottom: 2px;
  width: 31px;
  height: 5px;
  border-radius: 999px;
  background: #f3224a;
  content: "";
  transform: translateX(-50%);
}

.netease-title-tabs sup {
  margin-left: 2px;
  color: #8e929b;
  font-size: 14px;
  font-weight: 900;
}

.netease-header-actions {
  display: flex;
  justify-content: end;
  gap: 8px;
}

.comments-track-strip {
  display: grid;
  grid-template-columns: 44px 1fr;
  align-items: center;
  gap: 10px;
  padding: 6px 24px 8px;
  background: #ffffff;
}

.comments-track-cover {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  overflow: hidden;
  border: 7px solid #111114;
  border-radius: 50%;
  background: #111114;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.comments-track-cover img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.comments-track-title {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 4px;
  color: #20232b;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0;
}

.comments-track-title strong,
.comments-track-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comments-track-title span {
  min-width: 44px;
  color: #5b5f68;
}

.comments-divider {
  height: 7px;
  background: #f4f4f5;
}

.comments-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 24px 7px;
  background: #ffffff;
}

.comments-section-head > strong {
  color: #1d2028;
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.comment-sort-tabs {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  min-width: 0;
}

.comment-sort-tabs button {
  color: #999da5;
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.comment-sort-tabs button.active {
  color: #2c3038;
}

.music-page.mode-comments .netease-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  min-height: 112px;
  padding: 18px 0 16px;
  color: #777c86;
  font-size: 15px;
  font-weight: 800;
}

.music-page.mode-comments .netease-inline-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 14px 0 18px;
  color: #858a94;
  font-size: 12px;
  font-weight: 900;
}

.music-page.mode-comments .comment-list.netease-comment-list {
  display: block;
  min-height: 360px;
  padding: 0 18px 70px;
  background: #ffffff;
  box-shadow: none;
}

.music-page.mode-comments .comment-card.netease-comment-card {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 8px;
  padding: 10px 2px 9px;
  border-bottom: 1px solid #f0f1f3;
  border-radius: 0;
  background: #ffffff;
  box-shadow: none;
}

.music-page.mode-comments .comment-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #f0f1f4;
}

.comment-meta-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.music-page.mode-comments .comment-meta {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.music-page.mode-comments .comment-meta strong {
  overflow: hidden;
  color: #666b75;
  font-size: 12px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.music-page.mode-comments .comment-meta small {
  color: #9da1aa;
  font-size: 10px;
  font-weight: 700;
}

.comment-like-button {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  min-width: 44px;
  color: #969aa2 !important;
  font-size: 11px !important;
  font-weight: 800 !important;
}

.comment-like-button svg {
  width: 16px;
  height: 16px;
}

.music-page.mode-comments .comment-body {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.music-page.mode-comments .comment-body p {
  margin: 0;
  color: #161a24;
  font-size: 13px;
  font-weight: 850;
  line-height: 1.55;
  word-break: break-word;
}

.music-page.mode-comments .translation {
  color: #8f949d;
  font-size: 11px;
  line-height: 1.45;
}

.reply-expand {
  position: relative;
  justify-self: start;
  margin-top: 1px;
  padding-left: 44px !important;
  color: #5e7892 !important;
  font-size: 11px !important;
  font-weight: 900 !important;
}

.reply-expand::before {
  position: absolute;
  left: 0;
  top: 50%;
  width: 36px;
  height: 1px;
  background: #e2e4e8;
  content: "";
}

.inline-replies {
  display: grid;
  gap: 5px;
  border-radius: 8px;
  background: #f6f7f9;
  padding: 7px 9px;
}

.inline-replies button {
  padding: 0;
  text-align: left;
  color: #333844;
  font-size: 11px;
  line-height: 1.45;
}

.inline-replies strong {
  color: #66748a;
  font-weight: 900;
}

.comment-reply-action {
  justify-self: end;
  margin-left: auto;
  color: #9a9fa8 !important;
  font-size: 11px !important;
  font-weight: 800 !important;
}

.music-page.mode-comments .comment-body .comment-reply-action {
  justify-self: end !important;
  margin-left: auto;
}

.music-page.mode-comments .empty-room.netease-empty-room {
  min-height: 118px;
  margin: 0 18px 68px;
  border-radius: 0;
  background: #ffffff;
  color: #747985;
  box-shadow: none;
}

.music-page.mode-comments .empty-room.netease-empty-room strong {
  color: #242832;
  font-size: 14px;
}

.comments-bottom-panel {
  position: fixed;
  right: 0;
  bottom: calc(var(--tab-height) + var(--safe-bottom));
  left: 0;
  z-index: 7;
  display: grid;
  background: #ffffff;
  border-top: 1px solid #eceef1;
  box-shadow: 0 -10px 24px rgba(25, 28, 36, 0.04);
}

.comment-topic-row {
  display: flex;
  gap: 5px;
  overflow-x: auto;
  padding: 5px 10px;
  scrollbar-width: none;
}

.comment-topic-row::-webkit-scrollbar {
  display: none;
}

.comment-topic-row button {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 24px;
  flex: 0 0 auto;
  border: 1px solid #e4e6ea !important;
  border-radius: 999px;
  background: #ffffff !important;
  color: #383c46 !important;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.comment-topic-row svg {
  width: 12px;
  height: 12px;
}

.comment-topic-row button:disabled {
  color: #b1b5be !important;
}

.music-page.mode-comments .comment-composer {
  display: grid;
  gap: 4px;
  border-radius: 0;
  background: #ffffff;
  padding: 4px 12px 6px;
  box-shadow: none;
}

.music-page.mode-comments .reply-target {
  color: #777c86;
  font-size: 11px;
  font-weight: 800;
}

.music-page.mode-comments .composer-row {
  display: grid;
  grid-template-columns: 1fr 28px;
  align-items: center;
  min-height: 32px;
  border-radius: 999px;
  background: #f3f4f6;
  padding: 0 4px 0 12px;
}

.music-page.mode-comments .composer-row input {
  color: #1c202a;
  font-size: 11px;
  font-weight: 800;
}

.music-page.mode-comments .composer-row input::placeholder {
  color: #9fa4ad;
}

.music-page.mode-comments .composer-row button {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  background: transparent;
  color: #252936;
}

.music-page.mode-comments .composer-row button svg {
  width: 17px;
  height: 17px;
}

.message.error {
  color: #2c3036;
  background: #e8ebef;
}

.music-page.mode-search,
.music-page.mode-likes {
  background:
    radial-gradient(circle at 50% 8%, rgba(255, 255, 255, 0.1), transparent 24%),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 4px),
    #080808;
  color: #ffffff;
}

.music-page.mode-search .music-top-bar,
.music-page.mode-likes .music-top-bar {
  background: transparent;
  border-bottom-color: transparent;
  color: #ffffff;
}

.music-page.mode-search .icon-button,
.music-page.mode-likes .icon-button {
  color: rgba(255, 255, 255, 0.9);
}

.music-page.mode-search .music-content,
.music-page.mode-likes .music-content {
  color: #ffffff;
}

.music-page.mode-search .content-sheet,
.music-page.mode-likes .content-sheet {
  gap: 14px;
}

.music-page.mode-search .search-console,
.music-page.mode-likes .playlist-hero,
.music-page.mode-likes .library-stats span,
.music-page.mode-search .track-list,
.music-page.mode-likes .track-list,
.music-page.mode-search .message,
.music-page.mode-likes .message {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08), 0 18px 34px rgba(0, 0, 0, 0.24);
  backdrop-filter: blur(18px);
}

.music-page.mode-search .search-console {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06)),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 4px),
    rgba(18, 18, 20, 0.9);
}

.music-page.mode-search .source-segment {
  background: rgba(255, 255, 255, 0.08);
}

.music-page.mode-search .source-segment button {
  color: rgba(255, 255, 255, 0.62);
}

.music-page.mode-search .source-segment button.active {
  background: #ffffff;
  color: #111317;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
}

.music-page.mode-search .search-form {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.music-page.mode-search .search-field,
.music-page.mode-search .search-form button,
.music-page.mode-search .load-more-button {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.music-page.mode-search .search-field input {
  color: #ffffff;
}

.music-page.mode-search .search-field input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.music-page.mode-search .message,
.music-page.mode-likes .message,
.music-page.mode-search .result-head small,
.music-page.mode-search .load-more-note,
.music-page.mode-likes .library-stats small,
.music-page.mode-search .track-main small,
.music-page.mode-likes .track-main small {
  color: rgba(255, 255, 255, 0.62);
}

.music-page.mode-search .result-head strong,
.music-page.mode-likes .library-stats strong,
.music-page.mode-search .track-main strong,
.music-page.mode-likes .track-main strong {
  color: #ffffff;
}

.music-page.mode-search .track-row,
.music-page.mode-likes .track-row {
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07), 0 12px 26px rgba(0, 0, 0, 0.22);
}

.music-page.mode-search .track-row.active,
.music-page.mode-likes .track-row.active {
  background: rgba(255, 255, 255, 0.14);
}

.music-page.mode-search .track-row > button:not(.track-main),
.music-page.mode-likes .track-row > button:not(.track-main) {
  color: rgba(255, 255, 255, 0.82);
}

.music-page.mode-search .track-row > .favorite-toggle.active,
.music-page.mode-likes .track-row > .favorite-toggle.active {
  color: #ff4f6e;
}

.music-page.mode-likes .playlist-hero {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.18), transparent 30%),
    linear-gradient(135deg, #1c1d20 0%, #34383f 46%, #070708 100%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1), 0 24px 48px rgba(0, 0, 0, 0.32);
}

.music-page.mode-likes .library-stats span {
  background: rgba(255, 255, 255, 0.09);
}

@media (max-height: 700px) {
  .listen-room-head {
    gap: 6px;
    margin-top: 12px;
  }

  .listen-avatars {
    min-height: 64px;
    padding: 2px 16px 4px;
  }

  .listen-avatars span {
    width: 64px;
    height: 64px;
  }

  .listen-live-pill {
    min-height: 30px;
    margin-top: 6px;
  }

  .listen-track-actions {
    margin-top: 10px;
  }

  .progress-panel.listen-progress-panel {
    gap: 8px;
    margin-top: 16px;
  }
}

@media (max-height: 600px) {
  .listen-page {
    padding-top: max(8px, var(--safe-top));
    padding-bottom: max(14px, calc(8px + var(--safe-bottom)));
  }

  .listen-room-head {
    gap: 5px;
    margin-top: 8px;
  }

  .listen-room-head strong {
    font-size: 16px;
  }

  .listen-room-head p {
    font-size: 11px;
  }

  .listen-avatars {
    min-height: 56px;
    padding: 1px 14px 3px;
  }

  .listen-avatars span {
    width: 56px;
    height: 56px;
  }

  .listen-live-pill {
    min-height: 28px;
    margin-top: 4px;
  }

  .listen-track-actions {
    margin-top: 7px;
    padding: 0 10px;
  }

  .listen-song-meta strong {
    font-size: 12px;
  }

  .progress-panel.listen-progress-panel {
    gap: 6px;
    margin-top: 8px;
  }
}

.spin {
  animation: rotate-record 1s linear infinite;
}

@keyframes rotate-record {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 370px) {
  .music-content {
    padding: 0 12px 18px;
  }

  .music-content.player-content {
    padding: 0;
  }

  .song-summary {
    grid-template-columns: 38px 1fr;
  }

  .song-social-actions {
    grid-column: 1 / -1;
    justify-content: flex-end;
  }
}
</style>