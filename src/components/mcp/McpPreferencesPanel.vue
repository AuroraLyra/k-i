<template>
  <section class="mcp-view mcp-preferences-view">
    <article class="mcp-hero-card mcp-preferences-hero">
      <div class="mcp-preferences-art" aria-hidden="true"><Settings2 :size="28" /><i></i><i></i></div>
      <div class="mcp-hero-copy"><p>Preferences</p><h1>控制节奏与边界</h1><span>全局总开关、单次调用上限和角色继承关系集中在这里。</span></div>
    </article>

    <section class="mcp-detail-card">
      <header class="mcp-section-title compact"><div><span>STUDIO</span><h2>总控</h2></div></header>
      <label class="mcp-setting-row featured">
        <span><strong>MCP Studio</strong><small>关闭后所有连接和角色绑定都会保留，但不会执行任何工具。</small></span>
        <span class="mcp-switch"><input :checked="settings.enabled" type="checkbox" @change="emit('set-master', checked($event))"><i></i></span>
      </label>
      <label class="mcp-setting-row policy">
        <span><strong>单次回复调用上限</strong><small>让角色完成任务，同时避免连续调用过多服务。</small></span>
        <select :value="settings.maxToolCallsPerReply" @change="emit('set-max-calls', Number(($event.target as HTMLSelectElement).value))">
          <option v-for="count in 6" :key="count" :value="count">{{ count }} 个工具</option>
        </select>
      </label>
    </section>

    <section class="mcp-detail-card mcp-role-flow-card">
      <header class="mcp-section-title compact"><div><span>ROLE SCOPE</span><h2>角色如何继承连接</h2></div></header>
      <div class="mcp-role-flow">
        <span><strong>01</strong><small>连接已启用</small></span><i></i>
        <span><strong>02</strong><small>允许全局应用</small></span><i></i>
        <span><strong>03</strong><small>角色自动继承</small></span>
      </div>
      <p>某个角色需要独立选择时，可在该角色的 Chat Settings › More 打开“角色局部优先”。</p>
    </section>

    <section class="mcp-detail-card">
      <header class="mcp-section-title compact"><div><span>SAFETY</span><h2>安全边界</h2></div></header>
      <div class="mcp-safety-list">
        <article><span><ShieldCheck :size="18" /></span><div><strong>系统授权优先</strong><p>日历、通讯录、位置等敏感能力始终由手机系统确认。</p></div></article>
        <article><span><KeyRound :size="18" /></span><div><strong>鉴权保存在本机</strong><p>连接 Key 随应用设置保存在当前设备的 IndexedDB。</p></div></article>
        <article><span><Laptop2 :size="18" /></span><div><strong>电脑账号留在电脑</strong><p>QQ 和小红书账号不上传到 BabyLink 云端。</p></div></article>
      </div>
    </section>

    <article class="mcp-preference-footnote"><Sparkles :size="17" /><span><strong>推荐配置</strong><small>总开关开启，单次最多 2 个工具；需要操作外部内容时再为连接授予“允许操作”。</small></span></article>
  </section>
</template>

<script setup lang="ts">
import { KeyRound, Laptop2, Settings2, ShieldCheck, Sparkles } from 'lucide-vue-next';
import type { McpSettings } from '@/types/domain';

defineProps<{ settings: McpSettings }>();
const emit = defineEmits<{ 'set-master': [enabled: boolean]; 'set-max-calls': [count: number] }>();
function checked(event: Event) { return (event.target as HTMLInputElement).checked; }
</script>
