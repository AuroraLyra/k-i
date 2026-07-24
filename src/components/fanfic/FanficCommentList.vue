<template>
  <section class="comment-list">
    <article v-for="comment in comments" :key="comment.id" class="comment-item" :class="[`type-${comment.authorType}`, { reply: Boolean(comment.parentId) }]">
      <span class="comment-avatar" :style="commentAvatar(comment) ? undefined : avatarStyle(comment.avatarSeed)">
        <img v-if="commentAvatar(comment)" :src="commentAvatar(comment)" alt="" />
        <template v-else>{{ comment.authorName.slice(0, 1) }}</template>
      </span>
      <span class="comment-body">
        <span class="comment-meta">
          <strong>{{ comment.authorName }}</strong>
          <em :class="`identity-${comment.authorType}`">{{ identityLabel(comment) }}</em>
          <small>{{ formatTime(comment.createdAt) }}</small>
        </span>
        <small v-if="comment.parentId && parentName(comment.parentId)" class="reply-target">回复 {{ parentName(comment.parentId) }}</small>
        <p>{{ comment.content }}</p>
        <span class="comment-actions">
          <button type="button" @click="$emit('like', comment.id)"><Heart :size="13" />{{ comment.likes || '' }}</button>
          <button type="button" @click="$emit('reply', comment.id)"><MessageCircle :size="13" />回复</button>
        </span>
      </span>
    </article>
    <p v-if="!comments.length" class="comment-empty">还没有评论，留下第一句话吧。</p>
  </section>
</template>

<script setup lang="ts">
import { Heart, MessageCircle } from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';
import type { FanficBook, FanficComment } from '@/types/domain';

const props = defineProps<{ comments: FanficComment[]; book: FanficBook }>();
defineEmits<{ like: [commentId: string]; reply: [commentId: string] }>();
const appStore = useAppStore();

const avatarPalettes = [
  ['#ead4d8', '#694f55'], ['#d9e5db', '#4d6753'], ['#e7dfcb', '#6f6349'], ['#dbe1eb', '#505e73'], ['#eadff0', '#67536f']
];

function hashSeed(seed: string) {
  return [...seed].reduce((total, character) => total + character.charCodeAt(0), 0);
}

function avatarStyle(seed: string) {
  const palette = avatarPalettes[hashSeed(seed) % avatarPalettes.length];
  return { background: palette[0], color: palette[1] };
}

function commentAvatar(comment: FanficComment) {
  if (comment.authorType === 'character' && comment.authorId) return appStore.characters.find((character) => character.id === comment.authorId)?.avatar || '';
  if (comment.authorType === 'user') return appStore.users.find((user) => user.id === (comment.authorId || props.book.userId))?.avatar || '';
  return '';
}

function identityLabel(comment: FanficComment) {
  if (comment.authorType === 'author') return '作者';
  if (comment.authorType === 'character') return comment.authorId === props.book.characterId ? '角色' : '绑定角色';
  if (comment.authorType === 'user') return '你';
  return '读者';
}

function parentName(parentId: string) {
  return props.comments.find((comment) => comment.id === parentId)?.authorName || '';
}

function formatTime(createdAt: number) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(createdAt);
}
</script>

<style scoped>
.comment-list { display: grid; gap: 14px; }
.comment-item { display: grid; grid-template-columns: 34px minmax(0, 1fr); align-items: start; gap: 10px; }
.comment-item.reply { margin-left: 24px; }
.comment-avatar { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; font-family: Georgia, serif; font-size: 13px; font-weight: 800; }
.comment-avatar img { width: 100%; height: 100%; border-radius: inherit; object-fit: cover; }
.comment-body { display: grid; gap: 5px; min-width: 0; }
.comment-meta { display: flex; align-items: center; gap: 6px; min-width: 0; }
.comment-meta strong { overflow: hidden; color: #373033; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.comment-meta em { padding: 2px 5px; border-radius: 999px; background: #f4eff0; color: #9a8589; font-size: 7px; font-style: normal; font-weight: 800; }
.comment-meta em.identity-author { background: #efe4d3; color: #856b43; }
.comment-meta em.identity-character { background: #e6efe8; color: #55705c; }
.comment-meta em.identity-user { background: #e5ebf4; color: #536780; }
.comment-meta small { margin-left: auto; color: #aaa0a2; font-size: 8px; }
.reply-target { color: #9b8589; font-size: 9px; }
.comment-body p { margin: 0; color: #51484b; font-size: 11px; line-height: 1.65; }
.comment-actions { display: flex; gap: 14px; }
.comment-actions button { display: inline-flex; align-items: center; gap: 4px; min-height: 24px; padding: 0; color: #9a8f91; font-size: 9px; }
.comment-item.type-user .comment-body p { color: #2e4d3b; }
.comment-item.type-author .comment-body p { color: #684f31; }
.comment-item.type-character .comment-body p { color: #405a48; }
.comment-empty { margin: 0; padding: 18px; color: #9a9192; font-size: 11px; text-align: center; }
</style>