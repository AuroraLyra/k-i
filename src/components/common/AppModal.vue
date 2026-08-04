<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal-backdrop" :class="`modal-backdrop-${variant}`" @click.self="$emit('update:modelValue', false)">
      <section class="modal-panel" :class="[`modal-panel-${variant}`, { 'modal-panel-fixed': fixedHeight }]" role="dialog" aria-modal="true">
        <header v-if="showHeader" class="modal-header">
          <h2 :data-eyebrow="eyebrow || undefined">{{ title }}</h2>
          <button class="icon-button" type="button" aria-label="关闭" @click="$emit('update:modelValue', false)">
            <X :size="18" />
          </button>
        </header>
        <div class="modal-body" :class="{ 'modal-body-headerless': !showHeader }">
          <slot />
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';

withDefaults(defineProps<{
  modelValue: boolean;
  title: string;
  showHeader?: boolean;
  variant?: 'default' | 'profile' | 'ins' | 'profile-ins' | 'profile-theme' | 'image-journal';
  fixedHeight?: boolean;
  eyebrow?: string;
}>(), {
  showHeader: true,
  variant: 'default',
  fixedHeight: false
});

defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: var(--app-height);
  overflow: hidden;
  padding: max(8px, var(--safe-top)) calc(8px + var(--safe-right)) calc(8px + var(--safe-bottom)) calc(8px + var(--safe-left));
  background: rgba(0, 0, 0, 0.26);
}

.modal-backdrop-default {
  z-index: 80;
}

.modal-backdrop-profile-ins {
  z-index: 60;
  align-items: center;
  padding: max(18px, var(--safe-top)) calc(16px + var(--safe-right)) max(18px, calc(16px + var(--safe-bottom))) calc(16px + var(--safe-left));
  background:
    radial-gradient(circle at top, rgba(255, 198, 214, 0.24), transparent 34%),
    rgba(34, 25, 30, 0.34);
  backdrop-filter: blur(14px);
}

.modal-backdrop-profile-theme {
  z-index: 80;
  background:
    radial-gradient(circle at 50% 100%, rgba(220, 193, 180, 0.22), transparent 36%),
    rgba(47, 39, 36, 0.34);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}

.modal-backdrop-image-journal {
  z-index: 82;
  align-items: center;
  padding: max(14px, var(--safe-top)) calc(10px + var(--safe-right)) max(14px, calc(10px + var(--safe-bottom))) calc(10px + var(--safe-left));
  background: rgba(255, 255, 255, 0.68);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.modal-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(100%, 452px);
  max-height: min(680px, calc(var(--app-height) - var(--safe-top) - var(--safe-bottom) - 16px));
  overflow: hidden;
  border-radius: 14px 14px 0 0;
  background: #ffffff;
  box-shadow: 0 -18px 60px rgba(0, 0, 0, 0.15);
  font-family: var(--app-current-font-family);
  font-size: 12px;
  line-height: 1.45;
}

.modal-panel :deep(button),
.modal-panel :deep(input),
.modal-panel :deep(textarea),
.modal-panel :deep(select) {
  font-family: var(--app-current-font-family);
}

.modal-panel-fixed {
  height: min(540px, calc(var(--app-height) - var(--safe-top) - var(--safe-bottom) - 16px));
}

.modal-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--hairline);
}

.modal-header h2 {
  margin: 0;
  font-size: 14px;
}

.modal-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 12px;
}

.modal-body-headerless {
  padding: 14px 12px calc(14px + var(--safe-bottom));
}

.modal-panel-profile {
  max-height: min(760px, calc(var(--app-height) - var(--safe-top) - var(--safe-bottom) - 16px));
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 18px 18px 0 0;
  background: linear-gradient(180deg, rgba(238, 238, 238, 0.97), rgba(222, 222, 222, 0.96));
  box-shadow: 0 -22px 80px rgba(0, 0, 0, 0.26);
}

.modal-panel-profile .modal-header {
  min-height: 50px;
  padding: 9px 14px;
  border-bottom-color: rgba(255, 255, 255, 0.68);
  background: rgba(255, 255, 255, 0.28);
  color: #252323;
  backdrop-filter: blur(18px);
}

.modal-panel-profile .modal-header h2 {
  font-size: 16px;
  font-weight: 900;
}

.modal-panel-profile .modal-body {
  padding: 13px;
}

.modal-panel-profile .modal-body.modal-body-headerless {
  max-height: none;
}

.modal-panel-ins {
  max-height: min(740px, calc(var(--app-height) - var(--safe-top) - var(--safe-bottom) - 16px));
  border: 1px solid rgba(255, 255, 255, 0.84);
  border-radius: 22px 22px 0 0;
  background:
    radial-gradient(circle at top right, rgba(255, 214, 228, 0.7), transparent 30%),
    linear-gradient(180deg, rgba(255, 252, 253, 0.98), rgba(247, 249, 252, 0.98));
  box-shadow: 0 -28px 82px rgba(39, 35, 43, 0.2);
}

.modal-panel-ins .modal-header {
  min-height: 50px;
  padding: 10px 14px;
  border-bottom-color: rgba(255, 255, 255, 0.76);
  background: rgba(255, 255, 255, 0.55);
  color: #231f25;
  backdrop-filter: blur(22px);
}

.modal-panel-ins .modal-header h2 {
  font-size: 16px;
  font-weight: 900;
}

.modal-panel-ins .modal-body {
  padding: 13px;
}

.modal-panel-ins .modal-body.modal-body-headerless {
  max-height: none;
}

.modal-panel-profile-ins {
  width: min(100%, 364px);
  max-height: min(720px, calc(var(--app-height) - var(--safe-top) - var(--safe-bottom) - 36px));
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 28px;
  background: #ffffff;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.18);
}

.modal-panel-profile-ins::before {
  content: none;
}

.modal-panel-profile-ins .modal-body {
  padding: 16px;
}

.modal-panel-profile-ins .modal-body.modal-body-headerless {
  max-height: none;
  padding: 18px 14px calc(18px + var(--safe-bottom));
}

.modal-panel-profile-theme {
  max-height: min(780px, calc(var(--app-height) - var(--safe-top) - var(--safe-bottom) - 16px));
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 30px 30px 0 0;
  background:
    radial-gradient(circle at 92% 0%, rgba(231, 209, 198, 0.58), transparent 29%),
    linear-gradient(180deg, #fbf8f4 0%, #f5f0ea 100%);
  box-shadow: 0 -30px 90px rgba(52, 41, 37, 0.24);
  color: #443a36;
}

.modal-panel-profile-theme.modal-panel-fixed {
  height: min(650px, calc(var(--app-height) - var(--safe-top) - var(--safe-bottom) - 16px));
}

.modal-panel-profile-theme .modal-header {
  min-height: 64px;
  padding: 11px 16px 10px 18px;
  border-bottom-color: rgba(119, 91, 79, 0.08);
  background: rgba(255, 255, 255, 0.34);
  backdrop-filter: blur(20px);
}

.modal-panel-profile-theme .modal-header h2 {
  color: #403633;
  font-family: Georgia, "Songti SC", serif;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.modal-panel-profile-theme .modal-header h2[data-eyebrow]::before {
  content: attr(data-eyebrow);
  display: block;
  margin-bottom: 2px;
  color: #ad9184;
  font-family: var(--app-current-font-family);
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.18em;
}

.modal-panel-profile-theme .modal-header .icon-button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.58);
  color: #7f6c63;
}

.modal-panel-profile-theme .modal-body {
  padding: 16px;
}

.modal-panel-profile-theme .modal-body.modal-body-headerless {
  max-height: none;
  padding: 16px 14px calc(16px + var(--safe-bottom));
}

.modal-panel-image-journal {
  width: min(100%, 560px);
  max-height: calc(var(--app-height) - var(--safe-top) - var(--safe-bottom) - 28px);
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.modal-panel-image-journal .modal-header {
  min-height: 48px;
  padding: 8px 14px 7px 18px;
  border-bottom-color: rgba(96, 77, 61, 0.08);
  background: rgba(255, 255, 255, 0.28);
}

.modal-panel-image-journal .modal-header h2 {
  color: #4d443d;
  font-family: Georgia, "Songti SC", serif;
  font-size: 17px;
  font-weight: 500;
}

.modal-panel-image-journal .modal-header .icon-button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.56);
  color: #776b62;
}

.modal-panel-image-journal .modal-body {
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: 0;
}

.modal-panel-image-journal .modal-body.modal-body-headerless {
  padding: 0;
}

.modal-panel .modal-body :deep(.form-grid),
.modal-panel .modal-body :deep(.control-panel),
.modal-panel .modal-body :deep(.panel-section),
.modal-panel .modal-body :deep(.add-friend-sheet),
.modal-panel .modal-body :deep(.model-picker),
.modal-panel .modal-body :deep(.composer-shell),
.modal-panel .modal-body :deep(.provider-composer),
.modal-panel .modal-body :deep(.editor-sheet),
.modal-panel .modal-body :deep(.confirm-card),
.modal-panel .modal-body :deep(.profile-form) {
  gap: 10px !important;
}

.modal-panel .modal-body :deep(p),
.modal-panel .modal-body :deep(label),
.modal-panel .modal-body :deep(input),
.modal-panel .modal-body :deep(textarea),
.modal-panel .modal-body :deep(select),
.modal-panel .modal-body :deep(button),
.modal-panel .modal-body :deep(.field-hint),
.modal-panel .modal-body :deep(.module-description),
.modal-panel .modal-body :deep(.composer-hero p),
.modal-panel .modal-body :deep(.provider-copy p),
.modal-panel .modal-body :deep(.panel-copy),
.modal-panel .modal-body :deep(.placeholder-panel p),
.modal-panel .modal-body :deep(.import-preview p),
.modal-panel .modal-body :deep(.picker-empty p) {
  font-size: 12px !important;
  line-height: 1.5 !important;
}

.modal-panel .modal-body :deep(small),
.modal-panel .modal-body :deep(.field > span),
.modal-panel .modal-body :deep(.module-kicker),
.modal-panel .modal-body :deep(.section-kicker),
.modal-panel .modal-body :deep(.composer-hero span),
.modal-panel .modal-body :deep(.sync-copy span),
.modal-panel .modal-body :deep(.model-provider),
.modal-panel .modal-body :deep(.handle),
.modal-panel .modal-body :deep(.stat-card span),
.modal-panel .modal-body :deep(.stats-row span),
.modal-panel .modal-body :deep(.bound-card span) {
  font-size: 10px !important;
  line-height: 1.35 !important;
}

.modal-panel .modal-body :deep(h1) {
  font-size: 18px !important;
  line-height: 1.12 !important;
}

.modal-panel .modal-body :deep(h2),
.modal-panel .modal-body :deep(.module-copy strong),
.modal-panel .modal-body :deep(.composer-hero strong),
.modal-panel .modal-body :deep(.picker-copy strong) {
  font-size: 17px !important;
  line-height: 1.18 !important;
}

.modal-panel .modal-body :deep(h3),
.modal-panel .modal-body :deep(.section-head h3),
.modal-panel .modal-body :deep(.editor-heading h3),
.modal-panel .modal-body :deep(.confirm-card h3),
.modal-panel .modal-body :deep(.upload-card strong),
.modal-panel .modal-body :deep(.placeholder-panel strong),
.modal-panel .modal-body :deep(.import-preview strong) {
  font-size: 15px !important;
  line-height: 1.2 !important;
}

.modal-panel .modal-body :deep(.sheet-copy strong) {
  font-size: 17px !important;
  line-height: 1.05 !important;
}

.modal-panel .modal-body :deep(.stat-card strong),
.modal-panel .modal-body :deep(.stats-row strong),
.modal-panel .modal-body :deep(.bound-card strong),
.modal-panel .modal-body :deep(.provider-copy strong),
.modal-panel .modal-body :deep(.model-option strong) {
  font-size: 13px !important;
  line-height: 1.25 !important;
}

.modal-panel .modal-body :deep(.field input),
.modal-panel .modal-body :deep(.field select),
.modal-panel .modal-body :deep(.field textarea),
.modal-panel .modal-body :deep(.editor-field input),
.modal-panel .modal-body :deep(.confirm-field textarea) {
  min-height: 32px !important;
  padding: 6px 9px !important;
  border-radius: 9px !important;
  font-size: var(--compact-control-font-size) !important;
}

.modal-panel .modal-body :deep(.field textarea),
.modal-panel .modal-body :deep(.confirm-field textarea) {
  min-height: 66px !important;
}

:global(html.is-ios) .modal-panel .modal-body :deep(input:not([type='button']):not([type='checkbox']):not([type='color']):not([type='file']):not([type='hidden']):not([type='image']):not([type='radio']):not([type='range']):not([type='reset']):not([type='submit'])),
:global(html.is-ios) .modal-panel .modal-body :deep(textarea),
:global(html.is-ios) .modal-panel .modal-body :deep(select) {
  font-size: var(--ios-control-font-size) !important;
}

.modal-panel .modal-body :deep(button),
.modal-panel .modal-body :deep(.primary-action),
.modal-panel .modal-body :deep(.secondary-action),
.modal-panel .modal-body :deep(.danger-action),
.modal-panel .modal-body :deep(.footer-button),
.modal-panel .modal-body :deep(.summary-submit),
.modal-panel .modal-body :deep(.manual-summary-button),
.modal-panel .modal-body :deep(.ghost-button),
.modal-panel .modal-body :deep(.save-button),
.modal-panel .modal-body :deep(.generate-button),
.modal-panel .modal-body :deep(.new-book-button),
.modal-panel .modal-body :deep(.secondary-ghost),
.modal-panel .modal-body :deep(.action-pill) {
  min-height: 32px !important;
  padding-inline: 10px !important;
  border-radius: 10px !important;
  font-size: 12px !important;
}

.modal-panel .modal-body :deep(.panel-tab),
.modal-panel .modal-body :deep(.sheet-tabs button),
.modal-panel .modal-body :deep(.composer-tab),
.modal-panel .modal-body :deep(.module-tab),
.modal-panel .modal-body :deep(.scope-pill),
.modal-panel .modal-body :deep(.filter-pill) {
  min-height: 28px !important;
  padding-inline: 8px !important;
  font-size: 10px !important;
}

.modal-panel .modal-body :deep(.action-menu button) {
  min-height: 40px !important;
  gap: 9px !important;
}

.modal-panel .modal-body :deep(.composer-hero),
.modal-panel .modal-body :deep(.memory-hero),
.modal-panel .modal-body :deep(.manual-summary-card),
.modal-panel .modal-body :deep(.upload-card),
.modal-panel .modal-body :deep(.model-option),
.modal-panel .modal-body :deep(.picker-empty),
.modal-panel .modal-body :deep(.provider-card),
.modal-panel .modal-body :deep(.editor-card),
.modal-panel .modal-body :deep(.confirm-card),
.modal-panel .modal-body :deep(.import-preview),
.modal-panel .modal-body :deep(.placeholder-panel),
.modal-panel .modal-body :deep(.compact-field),
.modal-panel .modal-body :deep(.stats-row article),
.modal-panel .modal-body :deep(.bound-card) {
  gap: 8px !important;
  padding: 10px !important;
  border-radius: 14px !important;
}

.modal-panel .modal-body :deep(.composer-footer) {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 10px !important;
  width: 100% !important;
  min-width: 0 !important;
  margin-inline: 0 !important;
  padding: 2px 0 0 !important;
}

.modal-panel .modal-body :deep(.composer-footer > .footer-button) {
  width: 100% !important;
  min-width: 0 !important;
  justify-self: stretch !important;
}

.modal-panel .modal-body :deep(.sheet-cover) {
  min-height: 160px !important;
}

.modal-panel .modal-body :deep(.profile-panel) {
  gap: 12px !important;
  padding-inline: 16px !important;
  padding-bottom: 18px !important;
}

.modal-panel .modal-body :deep(.character-sheet),
.modal-panel .modal-body :deep(.user-profile-sheet) {
  border-radius: 24px !important;
}

.modal-panel .modal-body :deep(.character-sheet .sheet-avatar),
.modal-panel .modal-body :deep(.user-profile-sheet .sheet-avatar) {
  width: 82px !important;
  height: 82px !important;
  border-radius: 24px !important;
}

.modal-panel .modal-body :deep(.avatar-wrap) {
  width: 82px !important;
  height: 82px !important;
}

.modal-panel .modal-body :deep(.provider-avatar),
.modal-panel .modal-body :deep(.composer-avatar),
.modal-panel .modal-body :deep(.avatar-preview),
.modal-panel .modal-body :deep(.import-preview img),
.modal-panel .modal-body :deep(.bound-card img) {
  width: 44px !important;
  height: 44px !important;
}

.modal-panel .modal-body :deep(svg) {
  width: 17px !important;
  height: 17px !important;
}

.modal-panel-profile-ins .modal-body :deep(.character-sheet .sheet-icon-button),
.modal-panel-profile-ins .modal-body :deep(.user-profile-sheet .edit-button) {
  width: 30px !important;
  height: 30px !important;
  min-height: 30px !important;
  padding: 0 !important;
  padding-inline: 0 !important;
  padding-block: 0 !important;
  border-radius: 999px !important;
}

.modal-panel-profile-theme .modal-body :deep(.composer-hero) {
  gap: 12px !important;
  padding: 16px !important;
  border-radius: 28px 28px 28px 10px !important;
}

.modal-panel-profile-theme .modal-body :deep(.composer-hero span) {
  font-size: 8px !important;
  line-height: 1.35 !important;
}

.modal-panel-profile-theme .modal-body :deep(.composer-hero strong) {
  font-size: 18px !important;
  line-height: 1.2 !important;
}

.modal-panel-profile-theme .modal-body :deep(.composer-hero p) {
  font-size: 10px !important;
  line-height: 1.6 !important;
}

.modal-panel-profile-theme .modal-body :deep(.composer-tab) {
  min-height: 36px !important;
  border-radius: 999px !important;
  font-size: 10px !important;
}

.modal-panel-profile-theme .modal-body :deep(.theme-editor-actions button),
.modal-panel-profile-theme .modal-body :deep(.profile-theme-modal-footer button),
.modal-panel-profile-theme .modal-body :deep(.topic-editor-actions button),
.modal-panel-profile-theme .modal-body :deep(.theater-update-actions button) {
  min-height: 42px !important;
  border-radius: 999px !important;
}

.modal-panel-profile-theme .modal-body :deep(.theater-forward-sheet > button) {
  min-height: 62px !important;
  border-radius: 20px 20px 20px 8px !important;
}

.modal-panel-profile-theme .modal-body :deep(.generate-topic-option) {
  min-height: 58px !important;
  padding: 9px 11px !important;
  border-radius: 19px 19px 19px 7px !important;
}

</style>