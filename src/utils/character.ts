import type { CharacterImageProfile, CharacterImageReferenceMode, CharacterInitialProfile, CharacterMcpBinding, CharacterProfile, CharacterProfileHistoryEntry, CharacterProfileHistoryField, CharacterThemeStyleBindings, CharacterWardrobeProfile, FriendRelationship, FriendRelationshipStatus, VisualProfile } from '@/types/domain';
import { normalizeVisualProfile, removeVisualProfileAvatar, toCharacterVisualProfile } from '@/utils/profile';
import { normalizeChatModelOverrides } from '@/utils/settings';
import { normalizeVoomFrequency } from '@/utils/voom';
import { normalizeCoupleSpaceState } from '@/utils/coupleSpace';

const maxMindStateLines = 5;
const profileHistoryFields = new Set<CharacterProfileHistoryField>(['nickname', 'signature', 'mood']);
const friendRelationshipStatuses = new Set<FriendRelationshipStatus>(['friend', 'blocked-by-user', 'blocked-by-character', 'pending-user-request', 'pending-character-request', 'deleted-by-user', 'deleted-by-character']);

function normalizeFriendRelationship(value: unknown): FriendRelationship {
  const record = value && typeof value === 'object' ? value as Partial<FriendRelationship> : {};
  const status = friendRelationshipStatuses.has(record.status as FriendRelationshipStatus)
    ? record.status as FriendRelationshipStatus
    : 'friend';
  return {
    status,
    updatedAt: Number.isFinite(record.updatedAt) ? Number(record.updatedAt) : 0,
    reason: String(record.reason ?? '').trim() || undefined,
    requestMessage: String(record.requestMessage ?? '').trim() || undefined,
    requestedAt: Number.isFinite(record.requestedAt) ? Number(record.requestedAt) : undefined
  };
}

export function getFriendRelationship(character: Pick<CharacterProfile, 'relationship'>): FriendRelationship {
  return normalizeFriendRelationship(character.relationship);
}

export function isCharacterFriend(character: Pick<CharacterProfile, 'relationship'>) {
  return getFriendRelationship(character).status === 'friend';
}

export function normalizeCharacterMindStateLines(lines: unknown) {
  if (Array.isArray(lines)) {
    return lines
      .flatMap((line) => String(line ?? '').split(/\r?\n/))
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, maxMindStateLines);
  }

  if (typeof lines === 'string') {
    return lines
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, maxMindStateLines);
  }

  return [];
}

export function getCharacterDisplayName(character: Pick<CharacterProfile, 'userNote' | 'nickname' | 'name'>) {
  return String(character.userNote ?? '').trim() || String(character.nickname ?? '').trim() || String(character.name ?? '').trim() || 'new.friend';
}

export function getCharacterAiName(character: Pick<CharacterProfile, 'name' | 'nickname'>) {
  return String(character.name ?? '').trim() || String(character.nickname ?? '').trim() || '角色';
}

export function getCharacterVoomAuthorName(character: Pick<CharacterProfile, 'nickname' | 'name'>) {
  return String(character.nickname ?? '').trim() || String(character.name ?? '').trim() || 'new.friend';
}

export function getCharacterVoomDisplayName(character: Pick<CharacterProfile, 'userNote' | 'nickname' | 'name'>) {
  return getCharacterDisplayName(character);
}

function normalizeCharacterInitialProfile(initialProfile: Partial<CharacterInitialProfile> | null | undefined, fallback: CharacterInitialProfile) {
  if (!initialProfile || typeof initialProfile !== 'object') return undefined;
  const nickname = String(initialProfile.nickname ?? '').trim() || fallback.nickname;
  const signature = String(initialProfile.signature ?? '').trim() || fallback.signature;
  return { nickname, signature };
}

function normalizeCharacterProfileHistory(history: unknown): CharacterProfileHistoryEntry[] {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry as Partial<CharacterProfileHistoryEntry> & { value?: unknown };
      const field = profileHistoryFields.has(record.field as CharacterProfileHistoryField) ? record.field as CharacterProfileHistoryField : null;
      const previousValue = String(record.previousValue ?? '').trim();
      const nextValue = String(record.nextValue ?? record.value ?? '').trim();
      const sourceConversationId = String(record.sourceConversationId ?? '').trim();
      const sourceReplyBatchId = String(record.sourceReplyBatchId ?? '').trim();
      if (!field || previousValue === nextValue) return null;
      return {
        id: String(record.id ?? '').trim() || `profile_history_${Math.random().toString(16).slice(2)}`,
        field,
        previousValue,
        nextValue,
        createdAt: Number.isFinite(record.createdAt) ? Number(record.createdAt) : Date.now(),
        ...(sourceConversationId ? { sourceConversationId } : {}),
        ...(sourceReplyBatchId ? { sourceReplyBatchId } : {})
      };
    })
    .filter((entry): entry is CharacterProfileHistoryEntry => Boolean(entry))
    .sort((a, b) => a.createdAt - b.createdAt);
}

function normalizeCharacterThemeStyleBindings(bindings: Partial<CharacterThemeStyleBindings> | null | undefined): CharacterThemeStyleBindings {
  return {
    onlinePresetId: String(bindings?.onlinePresetId ?? '').trim(),
    offlinePresetId: String(bindings?.offlinePresetId ?? '').trim()
  };
}

function normalizeCharacterMcpBinding(binding: Partial<CharacterMcpBinding> | null | undefined): CharacterMcpBinding {
  return {
    overrideGlobal: Boolean(binding?.overrideGlobal),
    serverIds: Array.isArray(binding?.serverIds)
      ? [...new Set(binding.serverIds.map((id) => String(id).trim()).filter(Boolean))]
      : []
  };
}

function normalizeCharacterImageReferenceMode(value: unknown): CharacterImageReferenceMode {
  return value === 'composition' ? 'composition' : 'identity';
}

function normalizeCharacterWardrobe(wardrobe: Partial<CharacterWardrobeProfile> | null | undefined): CharacterWardrobeProfile {
  const source = wardrobe as Record<string, unknown> | null | undefined;
  const preservedLegacyDetails = Object.entries(source ?? {})
    .filter(([key, value]) => !['guidance', 'inventory', 'avoid'].includes(key) && String(value ?? '').trim())
    .map(([key, value]) => `${key}: ${String(value).trim()}`)
    .join('\n');
  return {
    guidance: String(wardrobe?.guidance ?? '').trim(),
    inventory: String(wardrobe?.inventory ?? preservedLegacyDetails).trim(),
    avoid: String(wardrobe?.avoid ?? '').trim()
  };
}

function normalizeCharacterImageProfile(profile: Partial<CharacterImageProfile> | null | undefined): CharacterImageProfile | undefined {
  const normalized = {
    appearancePrompt: String(profile?.appearancePrompt ?? '').trim(),
    facePrompt: String(profile?.facePrompt ?? '').trim(),
    referenceImage: String(profile?.referenceImage ?? '').trim(),
    referenceImageEnabled: profile?.referenceImageEnabled !== false,
    referenceImageMode: normalizeCharacterImageReferenceMode(profile?.referenceImageMode),
    voomPortraitModeEnabled: profile?.voomPortraitModeEnabled !== false,
    seed: String(profile?.seed ?? '').trim(),
    seedLockEnabled: Boolean(profile?.seedLockEnabled),
    wardrobe: normalizeCharacterWardrobe(profile?.wardrobe)
  };
  return normalized.appearancePrompt
    || normalized.facePrompt
    || normalized.referenceImage
    || normalized.seed
    || normalized.seedLockEnabled
    || normalized.referenceImageMode !== 'identity'
    || normalized.voomPortraitModeEnabled === false
    || Object.values(normalized.wardrobe).some(Boolean)
    ? normalized
    : undefined;
}

export function getCharacterInitialProfile(character: Pick<CharacterProfile, 'initialProfile' | 'nickname' | 'name'>): CharacterInitialProfile {
  const nickname = String(character.initialProfile?.nickname ?? '').trim()
    || String(character.name ?? '').trim()
    || String(character.nickname ?? '').trim()
    || 'new.friend';
  const signature = String(character.initialProfile?.signature ?? '').trim();
  return { nickname, signature };
}

export function normalizeCharacterProfile(character: CharacterProfile, fallbackUserId = ''): CharacterProfile {
  const { initialProfile: rawInitialProfile, coupleSpace: rawCoupleSpace, ...characterBase } = character;
  const nickname = String(character.nickname ?? '').trim();
  const name = String(character.name ?? '').trim() || nickname || 'new.friend';
  const description = String(character.description ?? '').trim();
  const signature = String(character.signature ?? '').trim();
  const boundUserId = String(character.boundUserId ?? '').trim() || fallbackUserId;
  const localWorldBookIds = Array.isArray(character.localWorldBookIds)
    ? [...new Set(character.localWorldBookIds.filter(Boolean))]
    : [];
  const voomFrequency = normalizeVoomFrequency(character.voomFrequency);
  const mindStateLines = normalizeCharacterMindStateLines(character.mindState?.lines);
  const profileThemeContent = String(character.mindState?.profileThemeContent ?? '').trim();
  const hasProfileThemeSnapshot = Boolean(String(character.mindState?.profileThemeId ?? '').trim() || profileThemeContent);
  const profile = toCharacterVisualProfile(normalizeVisualProfile(removeVisualProfileAvatar(character.profile), {
    id: character.id,
    nickname,
    name,
    avatar: character.avatar,
    signature
  }));
  const boundUserProfile = character.boundUserProfile
    ? normalizeVisualProfile(character.boundUserProfile as Partial<VisualProfile>)
    : undefined;
  const initialProfile = normalizeCharacterInitialProfile(rawInitialProfile, { nickname, signature });
  const profileHistory = normalizeCharacterProfileHistory(character.profileHistory);
  const coupleSpace = normalizeCoupleSpaceState(rawCoupleSpace);

  return {
    ...characterBase,
    nickname,
    name,
    description,
    signature,
    userNote: String(character.userNote ?? '').trim(),
    boundUserId,
    subtitle: String(character.subtitle ?? '').trim() || signature,
    lastSeen: String(character.lastSeen ?? '').trim() || '现在',
    localWorldBookIds,
    voomFrequency,
    modelOverrides: normalizeChatModelOverrides(character.modelOverrides),
    minimaxVoiceId: String(character.minimaxVoiceId ?? '').trim() || undefined,
    themeStyleBindings: normalizeCharacterThemeStyleBindings(character.themeStyleBindings),
    mcpBinding: normalizeCharacterMcpBinding(character.mcpBinding),
    imageProfile: normalizeCharacterImageProfile(character.imageProfile),
    profile,
    ...(boundUserProfile ? { boundUserProfile } : {}),
    ...(initialProfile ? { initialProfile } : {}),
    ...(profileHistory.length ? { profileHistory } : {}),
    ...(coupleSpace ? { coupleSpace } : {}),
    relationship: normalizeFriendRelationship(character.relationship),
    mindState: mindStateLines.length || hasProfileThemeSnapshot
      ? {
          lines: mindStateLines,
          profileThemeId: String(character.mindState?.profileThemeId ?? '').trim() || undefined,
          profileThemeName: String(character.mindState?.profileThemeName ?? '').trim() || undefined,
          profileThemeContent: profileThemeContent || undefined,
          profileThemeHtml: String(character.mindState?.profileThemeHtml ?? '').trim() || undefined,
          profileThemeCss: String(character.mindState?.profileThemeCss ?? '').trim() || undefined,
          updatedAt: Number.isFinite(character.mindState?.updatedAt) ? Number(character.mindState?.updatedAt) : Date.now(),
          readAt: Number.isFinite(character.mindState?.readAt) ? Number(character.mindState?.readAt) : 0,
          sourceConversationId: String(character.mindState?.sourceConversationId ?? '').trim() || undefined,
          sourceReplyBatchId: String(character.mindState?.sourceReplyBatchId ?? '').trim() || undefined
        }
      : undefined
  };
}