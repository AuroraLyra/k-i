import { Clipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';

export async function writeClipboardText(value: string) {
  if (!value) throw new Error('没有可复制的内容。');

  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Clipboard')) {
    await Clipboard.write({ string: value, label: 'BabyLink' });
    return;
  }

  let clipboardError: unknown;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (error) {
      clipboardError = error;
    }
  }

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.readOnly = true;
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.padding = '0';
  textarea.style.opacity = '0';
  textarea.style.fontSize = '16px';
  document.body.append(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand('copy');
  textarea.remove();
  activeElement?.focus({ preventScroll: true });
  window.scrollTo(scrollX, scrollY);

  if (!copied) {
    throw clipboardError instanceof Error
      ? clipboardError
      : new Error('无法复制更新源，请检查系统剪贴板权限。');
  }
}