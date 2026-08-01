import type { useAppStore } from '@/stores/appStore';
import { getDb } from '@/data/db';
import { defaultSettings } from '@/data/seed';
import type { AppKeepAliveSettings, AppSettings, AppThemeSettings, CharacterProfile, ChatMessage, Conversation, ThemeFontEntry, UserProfile } from '@/types/domain';
import { hydrateStoredMediaRefs } from '@/utils/mediaStorage';
import { normalizeAppSettings } from '@/utils/settings';

type AppStore = ReturnType<typeof useAppStore>;

interface StartupCacheSnapshot {
  version: 2;
  savedAt: number;
  activeUserId: string;
  settings?: StartupCacheSettings;
  users: UserProfile[];
  characters: CharacterProfile[];
  conversations: Conversation[];
  messages: ChatMessage[];
}

interface StartupCacheSettings {
  activeUserId: string;
  disclaimerAccepted: boolean;
  keepAlive: AppKeepAliveSettings;
  themeSettings: AppThemeSettings;
}

const startupCacheStorageKey = 'link:startup-cache:v2';
const legacyStartupCacheStorageKey = 'link:startup-cache:v1';
const startupCacheVersion = 2;
const startupConversationLimits = [120, 60, 24] as const;
const startupCharacterLimit = 160;
const startupTextLimit = 2_000;
const startupMediaDataUrlLimit = 48 * 1024;
const startupSerializedLimit = 2 * 1024 * 1024;

function trimStartupText(value: string, limit = startupTextLimit) {
  return value.length > limit ? value.slice(0, limit) : value;
}

function sanitizeStartupMediaUrl(value: string | undefined) {
  const normalizedValue = String(value ?? '').trim();
  if (/^blob:/i.test(normalizedValue)) return '';
  if (/^data:/i.test(normalizedValue) && normalizedValue.length > startupMediaDataUrlLimit) return '';
  return normalizedValue;
}

function createStartupFontEntry(entry: ThemeFontEntry): ThemeFontEntry {
  const sanitizeFontUrl = (value: string | undefined) => {
    const url = String(value ?? '').trim();
    return /^blob:/i.test(url) || (/^data:/i.test(url) && url.length > startupMediaDataUrlLimit) ? '' : url;
  };
  return {
    ...entry,
    url: sanitizeFontUrl(entry.url),
    cachedUrl: sanitizeFontUrl(entry.cachedUrl),
    cachedAssets: entry.cachedAssets?.map(sanitizeFontUrl).filter(Boolean) ?? []
  };
}

function createStartupSettings(settings: AppSettings, activeUserId: string): StartupCacheSettings {
  return {
    activeUserId,
    disclaimerAccepted: settings.disclaimerAccepted,
    keepAlive: { ...settings.keepAlive },
    themeSettings: {
      fonts: {
        activeFontId: settings.themeSettings.fonts.activeFontId,
        entries: settings.themeSettings.fonts.entries.map(createStartupFontEntry)
      },
      global: {
        ...settings.themeSettings.global,
        style: {
          ...settings.themeSettings.global.style,
          presets: settings.themeSettings.global.style.presets.map((preset) => ({ ...preset }))
        }
      },
      online: {
        ...settings.themeSettings.online,
        presets: settings.themeSettings.online.presets.map((preset) => ({ ...preset }))
      },
      offline: {
        ...settings.themeSettings.offline,
        presets: settings.themeSettings.offline.presets.map((preset) => ({ ...preset }))
      }
    }
  };
}

function createStartupUser(user: UserProfile): UserProfile {
  return {
    ...user,
    avatar: sanitizeStartupMediaUrl(user.avatar),
    description: trimStartupText(user.description),
    profile: {
      ...user.profile,
      backgroundImage: sanitizeStartupMediaUrl(user.profile.backgroundImage),
      highlights: [],
      moments: []
    }
  };
}

function createStartupCharacter(character: CharacterProfile): CharacterProfile {
  return {
    id: character.id,
    nickname: character.nickname,
    name: character.name,
    avatar: sanitizeStartupMediaUrl(character.avatar),
    description: trimStartupText(character.description),
    signature: trimStartupText(character.signature),
    userNote: character.userNote,
    boundUserId: character.boundUserId,
    subtitle: trimStartupText(character.subtitle, 500),
    lastSeen: character.lastSeen,
    localWorldBookIds: [],
    voomFrequency: character.voomFrequency,
    ...(character.initialProfile ? { initialProfile: character.initialProfile } : {}),
    ...(character.modelOverrides ? { modelOverrides: character.modelOverrides } : {}),
    ...(character.themeStyleBindings ? { themeStyleBindings: character.themeStyleBindings } : {}),
    ...(character.relationship ? { relationship: character.relationship } : {})
  };
}

function createStartupConversation(conversation: Conversation): Conversation {
  return {
    ...conversation,
    summary: trimStartupText(conversation.summary),
    groupAvatar: sanitizeStartupMediaUrl(conversation.groupAvatar),
    groupMembers: conversation.groupMembers?.map((member) => ({
      ...member,
      avatar: sanitizeStartupMediaUrl(member.avatar),
      description: trimStartupText(member.description ?? '', 500)
    }))
  };
}

function createStartupMessage(message: ChatMessage): ChatMessage {
  return {
    id: message.id,
    conversationId: message.conversationId,
    sender: message.sender,
    mode: message.mode,
    content: trimStartupText(message.content),
    createdAt: message.createdAt,
    ...(message.authorType ? { authorType: message.authorType } : {}),
    ...(message.authorId ? { authorId: message.authorId } : {}),
    ...(message.authorName ? { authorName: message.authorName } : {}),
    ...(message.sticker ? {
      sticker: {
        ...message.sticker,
        imageUrl: sanitizeStartupMediaUrl(message.sticker.imageUrl),
        cachedImageUrl: sanitizeStartupMediaUrl(message.sticker.cachedImageUrl)
      }
    } : {}),
    ...(message.image ? {
      image: {
        kind: message.image.kind,
        description: message.image.description,
        ...(message.image.provider ? { provider: message.image.provider } : {}),
        ...(message.image.model ? { model: message.image.model } : {}),
        ...(message.image.size ? { size: message.image.size } : {})
      }
    } : {}),
    ...(message.theaterLink ? {
      theaterLink: {
        ...message.theaterLink,
        content: trimStartupText(message.theaterLink.content, 500)
      }
    } : {}),
    ...(message.linkPreview ? {
      linkPreview: {
        ...message.linkPreview,
        imageUrl: sanitizeStartupMediaUrl(message.linkPreview.imageUrl)
      }
    } : {}),
    ...(message.mcpResult ? { mcpResult: message.mcpResult } : {}),
    ...(message.mcpOperations ? { mcpOperations: message.mcpOperations } : {}),
    ...(message.status ? { status: message.status } : {}),
    ...(message.readAt !== undefined ? { readAt: message.readAt } : {})
  };
}

function createStartupCacheSnapshot(store: AppStore, conversationLimit: number): StartupCacheSnapshot {
  const activeUserId = store.settings?.activeUserId?.trim() || store.user?.id || store.users[0]?.id || '';
  const users = [...store.users]
    .sort((left, right) => Number(right.id === activeUserId) - Number(left.id === activeUserId))
    .map(createStartupUser);
  const conversations = [...store.conversations]
    .sort((left, right) => Number(right.userId === activeUserId) - Number(left.userId === activeUserId) || right.updatedAt - left.updatedAt)
    .slice(0, conversationLimit)
    .map(createStartupConversation);
  const conversationIds = new Set(conversations.map((conversation) => conversation.id));
  const referencedCharacterIds = new Set(conversations.map((conversation) => conversation.charId));
  const characters = [...store.characters]
    .sort((left, right) => Number(referencedCharacterIds.has(right.id)) - Number(referencedCharacterIds.has(left.id)))
    .slice(0, startupCharacterLimit)
    .map(createStartupCharacter);
  const latestMessages = new Map<string, ChatMessage>();
  store.messages.forEach((message) => {
    if (!conversationIds.has(message.conversationId)) return;
    const currentMessage = latestMessages.get(message.conversationId);
    if (!currentMessage || message.createdAt >= currentMessage.createdAt) latestMessages.set(message.conversationId, message);
  });

  return {
    version: startupCacheVersion,
    savedAt: Date.now(),
    activeUserId,
    ...(store.settings ? { settings: createStartupSettings(store.settings, activeUserId) } : {}),
    users,
    characters,
    conversations,
    messages: [...latestMessages.values()].map(createStartupMessage)
  };
}

function parseStartupCacheSnapshot(value: string): StartupCacheSnapshot | null {
  try {
    const snapshot = JSON.parse(value) as Partial<StartupCacheSnapshot> | null;
    if (snapshot?.version !== startupCacheVersion
      || !Array.isArray(snapshot.users)
      || !Array.isArray(snapshot.characters)
      || !Array.isArray(snapshot.conversations)
      || !Array.isArray(snapshot.messages)) return null;
    return snapshot as StartupCacheSnapshot;
  } catch {
    return null;
  }
}

export function clearStartupCache() {
  try {
    window.localStorage.removeItem(startupCacheStorageKey);
    window.localStorage.removeItem(legacyStartupCacheStorageKey);
  } catch {
    return;
  }
}

export function restoreStartupCache(store: AppStore) {
  if (store.ready || window.location.pathname.startsWith('/access')) return false;
  let snapshot: StartupCacheSnapshot | null = null;
  try {
    snapshot = parseStartupCacheSnapshot(window.localStorage.getItem(startupCacheStorageKey) ?? '');
  } catch {
    return false;
  }
  if (!snapshot?.users.length) return false;

  const users = [...snapshot.users].sort((left, right) => Number(right.id === snapshot.activeUserId) - Number(left.id === snapshot.activeUserId));
  store.$patch((state) => {
    if (snapshot.settings) {
      state.settings = normalizeAppSettings({
        ...defaultSettings,
        ...snapshot.settings,
        activeUserId: snapshot.activeUserId,
        themeSettings: snapshot.settings.themeSettings
      });
    }
    state.users = users;
    state.characters = snapshot.characters;
    state.conversations = snapshot.conversations;
    state.messages = snapshot.messages;
  });
  document.documentElement.dataset.linkStartup = 'cache';
  return true;
}

export async function restoreStartupSettingsFromDb(store: AppStore) {
  if (store.ready || window.location.pathname.startsWith('/access')) return false;
  try {
    const database = await getDb();
    const settings = await database.get('settings', 'main');
    if (!settings) return false;
    const hydratedSettings = await hydrateStoredMediaRefs(normalizeAppSettings(settings));
    store.$patch((state) => {
      state.settings = hydratedSettings;
    });
    return true;
  } catch {
    return false;
  }
}

export function persistStartupCache(store: AppStore) {
  if (!store.ready || !store.users.length) return false;

  for (const conversationLimit of startupConversationLimits) {
    try {
      const serializedSnapshot = JSON.stringify(createStartupCacheSnapshot(store, conversationLimit));
      if (serializedSnapshot.length > startupSerializedLimit && conversationLimit !== startupConversationLimits.at(-1)) continue;
      window.localStorage.setItem(startupCacheStorageKey, serializedSnapshot);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

export function markStartupCacheHydrated() {
  delete document.documentElement.dataset.linkStartup;
}

export function installStartupCachePersistence(store: AppStore) {
  let saveTimer: number | undefined;
  const flush = () => {
    if (saveTimer !== undefined) window.clearTimeout(saveTimer);
    saveTimer = undefined;
    persistStartupCache(store);
  };
  const schedule = () => {
    if (!store.ready) return;
    if (saveTimer !== undefined) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(flush, 1_000);
  };
  const unsubscribe = store.$subscribe(schedule, { detached: true });
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') flush();
  };

  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  schedule();

  return () => {
    unsubscribe();
    if (saveTimer !== undefined) window.clearTimeout(saveTimer);
    window.removeEventListener('pagehide', flush);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}