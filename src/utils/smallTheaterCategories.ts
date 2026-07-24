import type { SmallTheaterTopic } from '@/types/domain';
import { defaultSmallTheaterTopicDrafts } from '@/utils/smallTheater';

export type SmallTheaterTopicCategoryId =
  | 'platform'
  | 'romance'
  | 'campus'
  | 'career'
  | 'showbiz'
  | 'ancient'
  | 'fantasy'
  | 'life'
  | 'system'
  | 'republic'
  | 'mystery'
  | 'timeline'
  | 'myth'
  | 'personal';

export interface SmallTheaterTopicCategory {
  id: SmallTheaterTopicCategoryId;
  label: string;
  kicker: string;
  start?: number;
  end?: number;
}

export const smallTheaterTopicCategories: SmallTheaterTopicCategory[] = [
  { id: 'platform', label: '平台娱乐', kicker: 'Social & Play', start: 1, end: 64 },
  { id: 'romance', label: '恋爱企划', kicker: 'Love Projects', start: 65, end: 120 },
  { id: 'campus', label: '校园青春', kicker: 'Campus Days', start: 121, end: 150 },
  { id: 'career', label: '职场纪实', kicker: 'Work Stories', start: 151, end: 175 },
  { id: 'showbiz', label: '娱乐现场', kicker: 'Show Business', start: 176, end: 200 },
  { id: 'ancient', label: '古风江湖', kicker: 'Ancient Tales', start: 201, end: 275 },
  { id: 'fantasy', label: '奇幻未来', kicker: 'Fantasy Future', start: 276, end: 325 },
  { id: 'life', label: '人间日常', kicker: 'Daily Life', start: 326, end: 375 },
  { id: 'system', label: '系统穿书', kicker: 'System Stories', start: 376, end: 400 },
  { id: 'republic', label: '民国志怪', kicker: 'Era & Folklore', start: 401, end: 450 },
  { id: 'mystery', label: '悬疑秘闻', kicker: 'Mystery Files', start: 451, end: 500 },
  { id: 'timeline', label: '时空轮回', kicker: 'Time & Rebirth', start: 501, end: 550 },
  { id: 'myth', label: '神话史诗', kicker: 'Myth & History', start: 551, end: 600 },
  { id: 'personal', label: '自定义', kicker: 'Custom Archive' }
];

const builtInTopicIndexByTitle = new Map(defaultSmallTheaterTopicDrafts.map((topic, index) => [topic.title, index + 1]));

export function smallTheaterTopicBuiltInIndex(topic: Pick<SmallTheaterTopic, 'title' | 'builtIn'>) {
  if (!topic.builtIn) return 0;
  return builtInTopicIndexByTitle.get(topic.title) ?? 0;
}

export function smallTheaterTopicCategoryId(topic: Pick<SmallTheaterTopic, 'title' | 'builtIn'>): SmallTheaterTopicCategoryId {
  const builtInIndex = smallTheaterTopicBuiltInIndex(topic);
  if (!builtInIndex) return 'personal';
  return smallTheaterTopicCategories.find((category) => (
    category.start !== undefined
    && category.end !== undefined
    && builtInIndex >= category.start
    && builtInIndex <= category.end
  ))?.id ?? 'personal';
}

export function smallTheaterTopicArchiveNumber(topic: Pick<SmallTheaterTopic, 'title' | 'builtIn'>) {
  const builtInIndex = smallTheaterTopicBuiltInIndex(topic);
  return builtInIndex ? String(builtInIndex).padStart(3, '0') : 'NEW';
}