<template>
  <section class="offline-memory-page">
    <header class="offline-memory-topbar">
      <button class="offline-memory-icon" type="button" aria-label="返回线下章节" @click="$emit('back')"><ArrowLeft :size="20" /></button>
      <div class="offline-memory-title"><span>CHARACTER DIARY</span><strong>{{ characterName }}</strong></div>
      <div class="offline-memory-icon status-icon" aria-label="角色记忆"><BookOpen :size="18" /></div>
    </header>
    <main class="offline-memory-scroll"><CharacterMemoryGraphPanel :conversation-id="conversationId" surface="page" /></main>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ArrowLeft, BookOpen } from 'lucide-vue-next';
import CharacterMemoryGraphPanel from '@/components/chat/CharacterMemoryGraphPanel.vue';
import type { CharacterProfile } from '@/types/domain';
import { getCharacterAiName } from '@/utils/character';

const props = defineProps<{ conversationId: string; character: CharacterProfile }>();
defineEmits<{ back: [] }>();
const characterName = computed(() => getCharacterAiName(props.character));
</script>

<style scoped>
.offline-memory-page{position:fixed;inset:0;z-index:36;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden;background:#f8f3f0;color:#2b292d}.offline-memory-topbar{display:grid;grid-template-columns:40px minmax(0,1fr) 40px;align-items:center;gap:8px;min-height:calc(58px + env(safe-area-inset-top));padding:env(safe-area-inset-top) 14px 0;border-bottom:1px solid rgba(83,62,68,.07);background:rgba(255,252,249,.92);backdrop-filter:blur(18px)}.offline-memory-icon{display:grid;width:36px;height:36px;place-items:center;border:0;border-radius:50%;background:#fff;color:#92727d;box-shadow:0 5px 15px rgba(94,72,78,.08)}.status-icon{justify-self:end;background:#e4f0eb;color:#769589}.offline-memory-title{display:grid;gap:1px;min-width:0;text-align:center}.offline-memory-title span{color:#b08e98;font-size:8px;font-weight:800;letter-spacing:.16em}.offline-memory-title strong{overflow:hidden;font-family:Georgia,"Noto Serif SC",serif;font-size:15px;font-weight:500;text-overflow:ellipsis;white-space:nowrap}.offline-memory-scroll{overflow-x:hidden;overflow-y:auto;padding:12px 12px calc(24px + env(safe-area-inset-bottom));overscroll-behavior:contain;-webkit-overflow-scrolling:touch}@media(min-width:760px){.offline-memory-scroll{padding-inline:24px}}
.offline-memory-page,
.offline-memory-topbar,
.offline-memory-scroll {
  background: #ffffff;
}

.offline-memory-page {
  height: var(--app-height);
}

.offline-memory-topbar {

.offline-memory-topbar {
  min-height: calc(58px + var(--safe-top));
  padding: var(--safe-top) calc(14px + var(--safe-right)) 0 calc(14px + var(--safe-left));
}

.offline-memory-scroll {
  padding: 12px calc(12px + var(--safe-right)) calc(24px + var(--safe-bottom)) calc(12px + var(--safe-left));
}
  min-height: calc(58px + var(--safe-top));
  padding: var(--safe-top) calc(14px + var(--safe-right)) 0 calc(14px + var(--safe-left));
}

.offline-memory-scroll {
  padding: 12px calc(12px + var(--safe-right)) calc(24px + var(--safe-bottom)) calc(12px + var(--safe-left));
}
</style>
