import type { WorldBookEntry } from '@/types/domain';
import { getTabooWorldBookContent, isTabooWorldBook, TABOO_WORLD_BOOK_TITLE } from '@/utils/worldBook';

let worldBookProvider: () => readonly WorldBookEntry[] = () => [];

export type TabooWorldBookPromptTarget = 'text' | 'image';

export function registerTabooWorldBookProvider(provider: () => readonly WorldBookEntry[]) {
  worldBookProvider = provider;
}

export function getTabooWorldBookPrompt(target: TabooWorldBookPromptTarget = 'text') {
  const tabooBook = worldBookProvider().find((entry) => isTabooWorldBook(entry));
  if (target === 'image' && tabooBook?.includeInImageGeneration === false) return '';
  const content = getTabooWorldBookContent(tabooBook);
  if (!content) return '';
  return [
    `【${TABOO_WORLD_BOOK_TITLE}｜全站最高优先级】`,
    '以下内容是本次生成必须优先读取并遵守的全站规则；如与普通世界书或后续背景资料冲突，以这里为准：',
    content,
    `【${TABOO_WORLD_BOOK_TITLE}结束】`
  ].join('\n');
}

export function prependTabooWorldBookPrompt(prompt: string, target: TabooWorldBookPromptTarget = 'text') {
  const tabooPrompt = getTabooWorldBookPrompt(target);
  return tabooPrompt ? `${tabooPrompt}\n\n${prompt}` : prompt;
}