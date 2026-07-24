import type { WorldBookEntry } from '@/types/domain';
import { getTabooWorldBookContent, isTabooWorldBook, TABOO_WORLD_BOOK_TITLE } from '@/utils/worldBook';

let worldBookProvider: () => readonly WorldBookEntry[] = () => [];

export function registerTabooWorldBookProvider(provider: () => readonly WorldBookEntry[]) {
  worldBookProvider = provider;
}

export function getTabooWorldBookPrompt() {
  const tabooBook = worldBookProvider().find((entry) => isTabooWorldBook(entry));
  const content = getTabooWorldBookContent(tabooBook);
  if (!content) return '';
  return [
    `【${TABOO_WORLD_BOOK_TITLE}｜全站最高优先级】`,
    '以下内容是本次生成必须优先读取并遵守的全站规则；如与普通世界书或后续背景资料冲突，以这里为准：',
    content,
    `【${TABOO_WORLD_BOOK_TITLE}结束】`
  ].join('\n');
}

export function prependTabooWorldBookPrompt(prompt: string) {
  const tabooPrompt = getTabooWorldBookPrompt();
  return tabooPrompt ? `${tabooPrompt}\n\n${prompt}` : prompt;
}