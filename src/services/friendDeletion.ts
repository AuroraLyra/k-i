import { useAppStore } from '@/stores/appStore';
import { useCommerceStore } from '@/stores/commerceStore';

export async function purgeFriendData(characterId: string) {
  const normalizedCharacterId = characterId.trim();
  if (!normalizedCharacterId) return false;

  const appStore = useAppStore();
  await appStore.hydrate();
  if (!appStore.characterById(normalizedCharacterId)) return false;

  const conversationIds = appStore.conversations
    .filter((conversation) => conversation.kind !== 'group' && conversation.charId === normalizedCharacterId)
    .map((conversation) => conversation.id);
  const commerceStore = useCommerceStore();
  const { useFanficStore } = await import('@/stores/fanficStore');
  const fanficStore = useFanficStore();
  await Promise.all([
    commerceStore.ensureReady(appStore.users, appStore.characters),
    fanficStore.hydrate()
  ]);
  await Promise.all([
    commerceStore.deleteCharacterCommerceData(normalizedCharacterId, conversationIds),
    fanficStore.deleteCharacterFanficData(normalizedCharacterId)
  ]);
  return await appStore.deleteCharacterProfile(normalizedCharacterId);
}