import type { CoupleActivityCategory, CoupleAppUsageRecord, CoupleDeviceScreenStatus, CoupleFootprintRecord, CoupleGalleryRecord, CoupleLifeRecord, CoupleMomentRecord, CoupleNetworkRecord, CoupleNoteRecord, CoupleNotificationRecord, CouplePhoneChatRecord, CoupleRouteStop, CoupleSpaceSnapshot, CoupleSpaceState, CoupleWishNote } from '@/types/domain';

const routeKinds = new Set<CoupleRouteStop['kind']>(['start', 'pass', 'stay', 'arrival']);
const activityCategories = new Set<CoupleActivityCategory>(['sleep', 'home', 'travel', 'work', 'meal', 'social', 'errand', 'leisure']);
const networkKinds = new Set<CoupleNetworkRecord['kind']>(['wifi', 'cellular', 'offline']);
const screenStatuses = new Set<CoupleDeviceScreenStatus>(['using', 'locked', 'idle']);
const footprintKinds = new Set<CoupleFootprintRecord['kind']>(['search', 'browser', 'map', 'shopping']);
const lifeRecordKinds = new Set<CoupleLifeRecord['kind']>(['alarm', 'calendar', 'order', 'music', 'draft']);
const phoneChatSenders = new Set(['character', 'contact']);
const fallbackGalleryPalettes: Array<[string, string]> = [
  ['#fbd3e1', '#d8cff8'],
  ['#ccece2', '#d7e4f8'],
  ['#ffe0c9', '#f6cbd8'],
  ['#d7dcfb', '#c9edf0']
];

function text(value: unknown, fallback = '') {
  return String(value ?? '').trim() || fallback;
}

function limitedText(value: unknown, fallback = '', maximum = 240) {
  return text(value, fallback).slice(0, maximum);
}

function numberInRange(value: unknown, minimum: number, maximum: number, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(maximum, Math.max(minimum, Math.round(numeric))) : fallback;
}

function normalizeRoute(input: unknown): CoupleRouteStop[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 12).map((item, index) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const rawKind = text(record.kind) as CoupleRouteStop['kind'];
    const rawCategory = text(record.category) as CoupleActivityCategory;
    return {
      name: limitedText(record.name, `途经点 ${index + 1}`, 40),
      time: limitedText(record.time, '--:--', 12),
      endTime: limitedText(record.endTime, '', 12),
      kind: routeKinds.has(rawKind) ? rawKind : index === 0 ? 'start' : 'pass',
      category: activityCategories.has(rawCategory) ? rawCategory : 'leisure',
      detail: limitedText(record.detail, '轻轻经过这里', 260),
      companion: limitedText(record.companion, '独自一人', 50),
      trace: limitedText(record.trace, '没有留下特别痕迹', 120),
      privateThought: limitedText(record.privateThought, '', 180)
    };
  });
}

function normalizeNetworks(input: unknown): CoupleNetworkRecord[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 8).map((item) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const rawKind = text(record.kind) as CoupleNetworkRecord['kind'];
    return {
      name: limitedText(record.name, '未知网络', 60),
      time: limitedText(record.time, '--:--', 12),
      kind: networkKinds.has(rawKind) ? rawKind : 'wifi'
    };
  });
}

function normalizeMoments(input: unknown): CoupleMomentRecord[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 10).map((item) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      time: limitedText(record.time, '--:--', 12),
      category: limitedText(record.category, '生活切片', 20),
      title: limitedText(record.title, '一个普通瞬间', 60),
      detail: limitedText(record.detail, '今天也在好好生活。', 300),
      emoji: limitedText(record.emoji, '✨', 4),
      unspoken: limitedText(record.unspoken, '', 220)
    };
  });
}

function normalizeAppUsage(input: unknown): CoupleAppUsageRecord[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 10).map((item) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      app: limitedText(record.app, '未命名应用', 30),
      minutes: numberInRange(record.minutes, 0, 1440, 0),
      lastUsedAt: limitedText(record.lastUsedAt, '--:--', 12),
      detail: limitedText(record.detail, '短暂打开了一会儿', 160)
    };
  });
}

function normalizeNotifications(input: unknown): CoupleNotificationRecord[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 12).map((item) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      app: limitedText(record.app, '系统', 30),
      time: limitedText(record.time, '--:--', 12),
      title: limitedText(record.title, '一条新通知', 70),
      preview: limitedText(record.preview, '通知内容已收起', 180),
      unread: Boolean(record.unread)
    };
  });
}

function normalizePhoneChats(input: unknown): CouplePhoneChatRecord[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 8).map((item) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const messages = Array.isArray(record.messages)
      ? record.messages.slice(0, 8).map((message) => {
        const messageRecord = message && typeof message === 'object' ? message as Record<string, unknown> : {};
        const rawSender = limitedText(messageRecord.sender, 'contact', 12);
        return {
          sender: phoneChatSenders.has(rawSender) ? rawSender as 'character' | 'contact' : 'contact',
          time: limitedText(messageRecord.time, '--:--', 12),
          text: limitedText(messageRecord.text, '一条没有预览的消息', 220)
        };
      })
      : [];
    return {
      contact: limitedText(record.contact, '未命名联系人', 40),
      relation: limitedText(record.relation, '联系人', 30),
      avatarEmoji: limitedText(record.avatarEmoji, '💬', 4),
      updatedAt: limitedText(record.updatedAt, '--:--', 12),
      unread: numberInRange(record.unread, 0, 99, 0),
      summary: limitedText(record.summary, '聊了一些生活里的小事。', 220),
      messages
    };
  });
}

function normalizeFootprints(input: unknown): CoupleFootprintRecord[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 12).map((item) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const rawKind = limitedText(record.kind) as CoupleFootprintRecord['kind'];
    return {
      kind: footprintKinds.has(rawKind) ? rawKind : 'search',
      time: limitedText(record.time, '--:--', 12),
      title: limitedText(record.title, '一条浏览记录', 90),
      detail: limitedText(record.detail, '随手点开看了一会儿。', 240),
      reason: limitedText(record.reason, '一时好奇', 160)
    };
  });
}

function normalizePalette(input: unknown, index: number): [string, string] {
  const fallback = fallbackGalleryPalettes[index % fallbackGalleryPalettes.length] ?? fallbackGalleryPalettes[0]!;
  if (!Array.isArray(input)) return fallback;
  const colors = input.slice(0, 2).map((color) => limitedText(color).toLowerCase());
  if (colors.length !== 2 || colors.some((color) => !/^#[0-9a-f]{6}$/.test(color))) return fallback;
  return [colors[0]!, colors[1]!];
}

function normalizeGallery(input: unknown): CoupleGalleryRecord[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 9).map((item, index) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      time: limitedText(record.time, '--:--', 12),
      title: limitedText(record.title, '没有发出的照片', 70),
      detail: limitedText(record.detail, '角色把这个瞬间留在了相册里。', 220),
      emoji: limitedText(record.emoji, '📷', 4),
      palette: normalizePalette(record.palette, index)
    };
  });
}

function normalizeNotes(input: unknown): CoupleNoteRecord[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 8).map((item) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      folder: limitedText(record.folder, '备忘录', 30),
      title: limitedText(record.title, '未命名备忘', 70),
      content: limitedText(record.content, '暂时没有写下更多内容。', 320),
      updatedAt: limitedText(record.updatedAt, '--:--', 12),
      pinned: Boolean(record.pinned)
    };
  });
}

function normalizeLifeRecords(input: unknown): CoupleLifeRecord[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 12).map((item) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const rawKind = limitedText(record.kind) as CoupleLifeRecord['kind'];
    return {
      kind: lifeRecordKinds.has(rawKind) ? rawKind : 'calendar',
      time: limitedText(record.time, '--:--', 12),
      title: limitedText(record.title, '一条生活记录', 80),
      detail: limitedText(record.detail, '角色手机里留下的一点生活安排。', 240),
      status: limitedText(record.status, '待处理', 30)
    };
  });
}

function normalizeKeywords(input: unknown) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((item) => limitedText(item, '', 16)).filter(Boolean))].slice(0, 6);
}

export function normalizeCoupleSpaceSnapshot(input: unknown, generatedAt = Date.now()): CoupleSpaceSnapshot {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const location = source.location && typeof source.location === 'object' ? source.location as Record<string, unknown> : {};
  const device = source.device && typeof source.device === 'object' ? source.device as Record<string, unknown> : {};
  const bond = source.bond && typeof source.bond === 'object' ? source.bond as Record<string, unknown> : {};
  const rawScreenStatus = text(device.screenStatus) as CoupleDeviceScreenStatus;
  return {
    id: text(source.id, `couple_snapshot_${generatedAt}_${Math.random().toString(16).slice(2)}`),
    generatedAt: Number.isFinite(source.generatedAt) ? Number(source.generatedAt) : generatedAt,
    location: {
      place: limitedText(location.place, '角色的小世界', 60),
      address: limitedText(location.address, '一个只在故事里亮起的坐标', 140),
      status: limitedText(location.status, '正在好好生活', 260),
      distance: limitedText(location.distance, '心的距离很近', 80),
      transport: limitedText(location.transport, '散步', 40),
      eta: limitedText(location.eta, '等下一次见面', 60),
      stayMinutes: numberInRange(location.stayMinutes, 0, 1440, 0),
      route: normalizeRoute(location.route)
    },
    device: {
      battery: numberInRange(device.battery, 0, 100, 76),
      charging: Boolean(device.charging),
      screenStatus: screenStatuses.has(rawScreenStatus) ? rawScreenStatus : 'idle',
      lastUnlockedAt: limitedText(device.lastUnlockedAt, '--:--', 12),
      lastLockedAt: limitedText(device.lastLockedAt, '--:--', 12),
      usageMinutes: numberInRange(device.usageMinutes, 0, 1440, 0),
      activeApp: limitedText(device.activeApp, '没有正在使用的应用', 60),
      network: limitedText(device.network, '未分享网络', 60),
      networkHistory: normalizeNetworks(device.networkHistory),
      appUsage: normalizeAppUsage(device.appUsage),
      notifications: normalizeNotifications(device.notifications),
      chats: normalizePhoneChats(device.chats),
      footprints: normalizeFootprints(device.footprints),
      gallery: normalizeGallery(device.gallery),
      notes: normalizeNotes(device.notes),
      lifeRecords: normalizeLifeRecords(device.lifeRecords)
    },
    bond: {
      mood: limitedText(bond.mood, '平静', 40),
      moodEmoji: limitedText(bond.moodEmoji, '💗', 4),
      missLevel: numberInRange(bond.missLevel, 0, 100, 50),
      syncScore: numberInRange(bond.syncScore, 0, 100, 70),
      nextPlan: limitedText(bond.nextPlan, '找一个舒服的时间聊聊天', 180),
      whisper: limitedText(bond.whisper, '今天也想和你分享一点小事。', 260),
      daySummary: limitedText(bond.daySummary, '这 24 小时里有忙碌，也有一些没有出现在聊天框里的小事。', 420),
      hiddenThought: limitedText(bond.hiddenThought, '有些想念被留在了没有发送的那一刻。', 260),
      keywords: normalizeKeywords(bond.keywords)
    },
    moments: normalizeMoments(source.moments)
  };
}

function normalizeWishes(input: unknown): CoupleWishNote[] {
  if (!Array.isArray(input)) return [];
  return input.slice(-20).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const content = text(record.content).slice(0, 120);
    if (!content) return [];
    return [{
      id: text(record.id, `couple_wish_${Math.random().toString(16).slice(2)}`),
      content,
      createdAt: Number.isFinite(record.createdAt) ? Number(record.createdAt) : Date.now()
    }];
  });
}

export function normalizeCoupleSpaceState(input: Partial<CoupleSpaceState> | null | undefined): CoupleSpaceState | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const snapshot = input.snapshot ? normalizeCoupleSpaceSnapshot(input.snapshot) : undefined;
  const history = Array.isArray(input.history)
    ? input.history.map((item) => normalizeCoupleSpaceSnapshot(item)).filter((item) => item.id !== snapshot?.id).slice(0, 11)
    : [];
  return {
    consentGrantedAt: Math.max(0, Number(input.consentGrantedAt) || 0),
    relationshipLabel: text(input.relationshipLabel, '恋人'),
    startedAt: text(input.startedAt),
    arrivalReminderEnabled: Boolean(input.arrivalReminderEnabled),
    ...(snapshot ? { snapshot } : {}),
    history,
    wishes: normalizeWishes(input.wishes)
  };
}

export function createCoupleSpaceState(): CoupleSpaceState {
  return {
    consentGrantedAt: Date.now(),
    relationshipLabel: '恋人',
    startedAt: '',
    arrivalReminderEnabled: false,
    history: [],
    wishes: []
  };
}