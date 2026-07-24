import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { deleteEntity, loadCommerceSnapshot, pruneUnusedStoredMediaCache, putEntity } from '@/data/db';
import { createCharacterProducts, createCharacterStorefronts, createDefaultShopMoments, createDefaultWalletAccounts, createDefaultWalletTransactions, defaultShopProducts, defaultShopStorefronts } from '@/data/commerceSeed';
import { chooseCharacterCommerceProduct, generateCharacterCommerceCatalog, generateCommerceProductImage } from '@/services/commerce';
import type { AppSettings, CharacterProfile, ChatTransferStatus, UserProfile } from '@/types/domain';
import type { ChatCommerceAttachment, CommerceSnapshot, ShopCartItem, ShopMoment, ShopOrder, ShopProduct, ShopStorefront, ShopWishlistItem, WalletAccount, WalletTransaction } from '@/types/commerce';
import { createId } from '@/utils/id';
import { externalizeLargeMediaRefs, hydrateStoredMediaRefs } from '@/utils/mediaStorage';

function centsFromAmount(amount: string) {
  const value = Number(String(amount).replace(/[￥¥,\s]/g, ''));
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : 0;
}

function parseItemPrice(price: string | undefined, totalCents: number, quantityTotal: number) {
  const cents = centsFromAmount(price ?? '');
  return cents > 0 ? cents : Math.max(0, Math.round(totalCents / Math.max(1, quantityTotal)));
}

type RelationshipScope = {
  characterId?: string;
  conversationId?: string;
};

type CartAddOptions = RelationshipScope & {
  addedByCharacterId?: string;
  note?: string;
};

function belongsToRelationship(item: Pick<ShopCartItem | ShopWishlistItem, 'characterId' | 'relationshipCharacterId' | 'conversationId'>, scope: RelationshipScope) {
  const characterId = scope.characterId?.trim() ?? '';
  const conversationId = scope.conversationId?.trim() ?? '';
  if (!characterId && !conversationId) return !item.relationshipCharacterId && !item.conversationId && !item.characterId;
  if (conversationId && item.conversationId) return item.conversationId === conversationId;
  return (item.relationshipCharacterId || item.characterId) === characterId;
}

export const useCommerceStore = defineStore('commerce', () => {
  const ready = ref(false);
  let hydratePromise: Promise<void> | null = null;
  const walletAccounts = ref<WalletAccount[]>([]);
  const walletTransactions = ref<WalletTransaction[]>([]);
  const storefronts = ref<ShopStorefront[]>([]);
  const products = ref<ShopProduct[]>([]);
  const cartItems = ref<ShopCartItem[]>([]);
  const wishlistItems = ref<ShopWishlistItem[]>([]);
  const orders = ref<ShopOrder[]>([]);
  const moments = ref<ShopMoment[]>([]);

  const featuredProducts = computed(() => products.value.filter((product) => product.stock > 0));
  const characterStorefronts = computed(() => storefronts.value.filter((storefront) => storefront.ownerType === 'character'));
  const recentOrders = computed(() => [...orders.value].sort((left, right) => right.createdAt - left.createdAt));
  const recentMoments = computed(() => [...moments.value].sort((left, right) => right.createdAt - left.createdAt));

  function applySnapshot(snapshot: CommerceSnapshot) {
    walletAccounts.value = snapshot.walletAccounts;
    walletTransactions.value = snapshot.walletTransactions;
    storefronts.value = snapshot.shopStorefronts;
    products.value = snapshot.shopProducts;
    cartItems.value = snapshot.shopCartItems;
    wishlistItems.value = snapshot.shopWishlistItems;
    orders.value = snapshot.shopOrders;
    moments.value = snapshot.shopMoments;
  }

  async function ensureSeedData(users: UserProfile[], characters: CharacterProfile[]) {
    const seedAccounts = createDefaultWalletAccounts(users, characters);
    const missingAccounts = seedAccounts.filter((account) => !walletAccounts.value.some((entry) => entry.id === account.id));
    if (missingAccounts.length) {
      walletAccounts.value.push(...missingAccounts);
      const openingEntries = createDefaultWalletTransactions(missingAccounts);
      walletTransactions.value.push(...openingEntries);
      await Promise.all([
        ...missingAccounts.map((account) => putEntity('walletAccounts', account)),
        ...openingEntries.map((entry) => putEntity('walletTransactions', entry))
      ]);
    }

    const allStorefronts = [...defaultShopStorefronts, ...createCharacterStorefronts(characters)];
    const missingStorefronts = allStorefronts.filter((storefront) => !storefronts.value.some((entry) => entry.id === storefront.id));
    if (missingStorefronts.length) {
      storefronts.value.push(...missingStorefronts);
      await Promise.all(missingStorefronts.map((storefront) => putEntity('shopStorefronts', storefront)));
    }

    const allProducts = [...defaultShopProducts, ...createCharacterProducts(characters)];
    const missingProducts = allProducts.filter((product) => !products.value.some((entry) => entry.id === product.id));
    const refreshedCharacterProducts = allProducts.flatMap((product) => {
      if (!product.id.startsWith('product_character_')) return [];
      const existing = products.value.find((entry) => entry.id === product.id);
      if (!existing || existing.storeId === product.storeId && existing.category === product.category && existing.kind === product.kind && existing.palette[0] === product.palette[0] && existing.palette[1] === product.palette[1]) return [];
      return [{ ...existing, storeId: product.storeId, category: product.category, kind: product.kind, palette: product.palette, updatedAt: Date.now() }];
    });
    if (missingProducts.length || refreshedCharacterProducts.length) {
      products.value.push(...missingProducts);
      for (const product of refreshedCharacterProducts) {
        const index = products.value.findIndex((entry) => entry.id === product.id);
        if (index >= 0) products.value[index] = product;
      }
      await Promise.all([...missingProducts, ...refreshedCharacterProducts].map((product) => putEntity('shopProducts', product)));
    }

    if (characters.length) {
      const seedMoments = createDefaultShopMoments(characters);
      const missingMoments = seedMoments.filter((moment) => !moments.value.some((entry) => entry.id === moment.id));
      const refreshedMoments = seedMoments.flatMap((moment) => {
        const existing = moments.value.find((entry) => entry.id === moment.id);
        if (!existing || existing.kind && existing.likedByUserIds && existing.savedByUserIds && typeof existing.commentCount === 'number') return [];
        return [{
          ...existing,
          kind: existing.kind ?? moment.kind,
          likedByUserIds: existing.likedByUserIds ?? [],
          savedByUserIds: existing.savedByUserIds ?? [],
          commentCount: existing.commentCount ?? moment.commentCount
        }];
      });
      moments.value.push(...missingMoments);
      for (const moment of refreshedMoments) {
        const index = moments.value.findIndex((entry) => entry.id === moment.id);
        if (index >= 0) moments.value[index] = moment;
      }
      await Promise.all([...missingMoments, ...refreshedMoments].map((moment) => putEntity('shopMoments', moment)));
    }
  }

  async function ensureReady(users: UserProfile[] = [], characters: CharacterProfile[] = []) {
    if (ready.value) {
      await ensureSeedData(users, characters);
      await refreshOrderStatuses();
      return;
    }
    if (hydratePromise) return hydratePromise;
    hydratePromise = (async () => {
      applySnapshot(await hydrateStoredMediaRefs(await loadCommerceSnapshot()));
      await ensureSeedData(users, characters);
      await refreshOrderStatuses();
      ready.value = true;
    })().finally(() => {
      hydratePromise = null;
    });
    return hydratePromise;
  }

  function walletForUser(userId: string) {
    return walletAccounts.value.find((account) => account.ownerType === 'user' && account.ownerId === userId) ?? null;
  }

  function walletForCharacter(characterId: string) {
    return walletAccounts.value.find((account) => account.ownerType === 'character' && account.ownerId === characterId) ?? null;
  }

  function transactionsForWallet(walletId: string) {
    return walletTransactions.value.filter((entry) => entry.walletId === walletId).sort((left, right) => right.createdAt - left.createdAt);
  }

  function cartForUser(userId: string, scope: RelationshipScope = {}) {
    return cartItems.value.filter((item) => item.userId === userId && belongsToRelationship(item, scope));
  }

  function wishlistForUser(userId: string, scope: RelationshipScope = {}) {
    return wishlistItems.value.filter((item) => item.userId === userId && belongsToRelationship(item, scope));
  }

  async function addToCart(userId: string, productId: string, options: CartAddOptions = {}) {
    const characterId = options.characterId?.trim() ?? '';
    const conversationId = options.conversationId?.trim() ?? '';
    const addedByCharacterId = options.addedByCharacterId?.trim() ?? '';
    const note = options.note?.trim() ?? '';
    const existing = cartItems.value.find((item) => item.userId === userId && item.productId === productId && belongsToRelationship(item, { characterId, conversationId }));
    const now = Date.now();
    const item: ShopCartItem = existing
      ? { ...existing, quantity: existing.quantity + 1, selected: true, ...(note ? { note } : {}), updatedAt: now }
      : {
          id: createId('cart'),
          userId,
          productId,
          quantity: 1,
          selected: true,
          addedBy: addedByCharacterId ? 'character' : 'user',
          ...(addedByCharacterId ? { characterId: addedByCharacterId } : {}),
          ...(characterId ? { relationshipCharacterId: characterId } : {}),
          ...(conversationId ? { conversationId } : {}),
          ...(note ? { note } : {}),
          createdAt: now,
          updatedAt: now
        };
    if (existing) cartItems.value[cartItems.value.indexOf(existing)] = item;
    else cartItems.value.push(item);
    await putEntity('shopCartItems', item);
    return item;
  }

  async function addCharacterPickToCart(userId: string, character: CharacterProfile, user: UserProfile | null, settings: AppSettings, conversationId = '') {
    const scope = { characterId: character.id, conversationId };
    const existingProductIds = new Set(cartForUser(userId, scope).map((item) => item.productId));
    const availableProducts = featuredProducts.value.filter((product) => !existingProductIds.has(product.id));
    if (!availableProducts.length) return null;
    const decision = await chooseCharacterCommerceProduct({ character, user, products: availableProducts, settings });
    const product = availableProducts.find((entry) => entry.id === decision.productId);
    if (!product) throw new Error('角色选择的商品已经不可购买，请再试一次。');
    await addToCart(userId, product.id, { ...scope, addedByCharacterId: character.id, note: decision.reason });
    return { product, reason: decision.reason };
  }

  async function updateCartQuantity(itemId: string, quantity: number) {
    const item = cartItems.value.find((entry) => entry.id === itemId);
    if (!item) return;
    if (quantity <= 0) {
      cartItems.value = cartItems.value.filter((entry) => entry.id !== itemId);
      await deleteEntity('shopCartItems', itemId);
      return;
    }
    const nextItem = { ...item, quantity: Math.min(99, Math.max(1, Math.floor(quantity))), updatedAt: Date.now() };
    cartItems.value[cartItems.value.indexOf(item)] = nextItem;
    await putEntity('shopCartItems', nextItem);
  }

  async function toggleWishlist(userId: string, productId: string, scope: RelationshipScope = {}, addedByCharacterId = '') {
    const characterId = scope.characterId?.trim() ?? '';
    const conversationId = scope.conversationId?.trim() ?? '';
    const existing = wishlistItems.value.find((item) => item.userId === userId && item.productId === productId && belongsToRelationship(item, { characterId, conversationId }));
    if (existing) {
      wishlistItems.value = wishlistItems.value.filter((item) => item.id !== existing.id);
      await deleteEntity('shopWishlistItems', existing.id);
      return false;
    }
    const item: ShopWishlistItem = {
      id: createId('wish'),
      userId,
      productId,
      addedBy: addedByCharacterId ? 'character' : 'user',
      ...(addedByCharacterId ? { characterId: addedByCharacterId } : {}),
      ...(characterId ? { relationshipCharacterId: characterId } : {}),
      ...(conversationId ? { conversationId } : {}),
      createdAt: Date.now()
    };
    wishlistItems.value.push(item);
    await putEntity('shopWishlistItems', item);
    return true;
  }

  async function toggleMomentLike(momentId: string, userId: string) {
    const moment = moments.value.find((entry) => entry.id === momentId);
    if (!moment || !userId) return false;
    const likedByUserIds = new Set(moment.likedByUserIds ?? []);
    if (likedByUserIds.has(userId)) likedByUserIds.delete(userId);
    else likedByUserIds.add(userId);
    const nextMoment = { ...moment, likedByUserIds: [...likedByUserIds] };
    moments.value[moments.value.indexOf(moment)] = nextMoment;
    await putEntity('shopMoments', nextMoment);
    return likedByUserIds.has(userId);
  }

  async function generateCharacterCatalog(character: CharacterProfile, user: UserProfile | null, settings: AppSettings) {
    const existingWallet = walletForCharacter(character.id);
    const recentTransactions = existingWallet ? transactionsForWallet(existingWallet.id).slice(0, 12) : [];
    const catalog = await generateCharacterCommerceCatalog({ character, user, settings, currentWallet: existingWallet, recentTransactions });
    const now = Date.now();
    const storeId = `shop_character_${character.id}`;
    const existingStorefront = storefronts.value.find((entry) => entry.id === storeId);
    const storefront: ShopStorefront = {
      id: storeId,
      ...catalog.storefront,
      rating: existingStorefront?.rating ?? 4.9,
      monthlySales: existingStorefront?.monthlySales ?? 218,
      ownerType: 'character',
      ownerCharacterId: character.id,
      generatedAt: now,
      createdAt: existingStorefront?.createdAt ?? now,
      updatedAt: now
    };
    const nextProducts: ShopProduct[] = catalog.products.map((product, index) => ({
      id: `product_ai_${character.id}_${now}_${index}`,
      storeId,
      ...product,
      generatedAt: now,
      createdAt: now + index,
      updatedAt: now + index
    }));
    const selectedProduct = nextProducts[catalog.moment.productIndex] ?? nextProducts[0];
    const moment: ShopMoment = {
      id: createId('shop-moment-ai'),
      characterId: character.id,
      characterName: character.nickname || character.name,
      kind: catalog.moment.kind,
      content: catalog.moment.content,
      productIds: selectedProduct ? [selectedProduct.id] : [],
      storeName: storefront.name,
      rating: catalog.moment.rating,
      likedByUserIds: [],
      savedByUserIds: [],
      commentCount: 0,
      mark: selectedProduct?.mark ?? storefront.mark,
      palette: selectedProduct?.palette ?? storefront.palette,
      generatedAt: now,
      createdAt: now
    };
    const previousAiProducts = products.value.filter((product) => product.storeId === storeId && product.id.startsWith(`product_ai_${character.id}_`));
    const previousAiProductIds = new Set(previousAiProducts.map((product) => product.id));
    const removedCartItems = cartItems.value.filter((item) => previousAiProductIds.has(item.productId));
    const removedWishlistItems = wishlistItems.value.filter((item) => previousAiProductIds.has(item.productId));
    const generatedTransactions: WalletTransaction[] = catalog.economy.transactions.map((transaction, index, entries) => ({
      id: createId('wallet-life'),
      walletId: existingWallet?.id ?? `wallet_character_${character.id}`,
      type: transaction.type,
      amountCents: transaction.amountCents,
      title: transaction.title,
      subtitle: transaction.subtitle,
      createdAt: now - transaction.daysAgo * 86_400_000 - (entries.length - index) * 60_000
    }));
    const balanceDeltaCents = generatedTransactions.reduce((sum, transaction) => sum + transaction.amountCents, 0);
    const generatedGiftSpendingCents = generatedTransactions.reduce((sum, transaction) => transaction.type === 'gift' ? sum + Math.abs(transaction.amountCents) : sum, 0);
    const giftAllowanceCents = existingWallet?.generatedAt ? existingWallet.giftAllowanceCents : catalog.economy.giftAllowanceCents;
    const wallet: WalletAccount = {
      id: existingWallet?.id ?? `wallet_character_${character.id}`,
      ownerType: 'character',
      ownerId: character.id,
      balanceCents: Math.max(0, (existingWallet?.balanceCents ?? catalog.economy.balanceCents) + balanceDeltaCents),
      monthlyIncomeCents: catalog.economy.monthlyIncomeCents,
      savingsGoalCents: catalog.economy.savingsGoalCents,
      giftAllowanceCents: Math.max(0, giftAllowanceCents - generatedGiftSpendingCents),
      spendingTraits: catalog.economy.spendingTraits,
      generatedAt: now,
      updatedAt: now
    };

    const storefrontIndex = storefronts.value.findIndex((entry) => entry.id === storeId);
    if (storefrontIndex >= 0) storefronts.value[storefrontIndex] = storefront;
    else storefronts.value.push(storefront);
    products.value = [...products.value.filter((product) => !previousAiProductIds.has(product.id)), ...nextProducts];
    cartItems.value = cartItems.value.filter((item) => !previousAiProductIds.has(item.productId));
    wishlistItems.value = wishlistItems.value.filter((item) => !previousAiProductIds.has(item.productId));
    moments.value.push(moment);
    const walletIndex = walletAccounts.value.findIndex((entry) => entry.id === wallet.id);
    if (walletIndex >= 0) walletAccounts.value[walletIndex] = wallet;
    else walletAccounts.value.push(wallet);
    walletTransactions.value.push(...generatedTransactions);

    await Promise.all([
      putEntity('shopStorefronts', storefront),
      putEntity('walletAccounts', wallet),
      ...generatedTransactions.map((transaction) => putEntity('walletTransactions', transaction)),
      ...nextProducts.map((product) => putEntity('shopProducts', product)),
      putEntity('shopMoments', moment),
      ...previousAiProducts.map((product) => deleteEntity('shopProducts', product.id)),
      ...removedCartItems.map((item) => deleteEntity('shopCartItems', item.id)),
      ...removedWishlistItems.map((item) => deleteEntity('shopWishlistItems', item.id))
    ]);
    return { storefront, products: nextProducts, moment, wallet, transactions: generatedTransactions };
  }

  async function generateProductImage(productId: string, settings: AppSettings) {
    const product = products.value.find((entry) => entry.id === productId);
    if (!product) throw new Error('没有找到需要生图的商品。');
    const result = await generateCommerceProductImage({
      settings,
      title: product.title,
      subtitle: product.subtitle,
      imageGenerationPrompt: product.imageGenerationPrompt
    });
    const persistedProduct = await externalizeLargeMediaRefs({
      ...product,
      imageUrl: result.imageUrl,
      imageProvider: result.provider,
      updatedAt: Date.now()
    }, 1);
    const displayProduct = await hydrateStoredMediaRefs(persistedProduct, true);
    const productIndex = products.value.findIndex((entry) => entry.id === productId);
    if (productIndex >= 0) products.value[productIndex] = displayProduct;
    await putEntity('shopProducts', persistedProduct);
    return { product: displayProduct, ...result };
  }

  async function toggleMomentSave(momentId: string, userId: string) {
    const moment = moments.value.find((entry) => entry.id === momentId);
    if (!moment || !userId) return false;
    const savedByUserIds = new Set(moment.savedByUserIds ?? []);
    if (savedByUserIds.has(userId)) savedByUserIds.delete(userId);
    else savedByUserIds.add(userId);
    const nextMoment = { ...moment, savedByUserIds: [...savedByUserIds] };
    moments.value[moments.value.indexOf(moment)] = nextMoment;
    await putEntity('shopMoments', nextMoment);
    return savedByUserIds.has(userId);
  }

  async function refreshOrderStatuses() {
    const now = Date.now();
    const updates = orders.value.flatMap((order) => {
      if (order.status === 'cancelled' || order.status === 'delivered') return [];
      const elapsedMinutes = (now - order.createdAt) / 60_000;
      const nextStatus = order.kind === 'takeout'
        ? elapsedMinutes >= 50
          ? 'delivered'
          : elapsedMinutes >= 15
            ? 'delivering'
            : 'preparing'
        : elapsedMinutes >= 3 * 24 * 60
          ? 'delivered'
          : order.status;
      if (nextStatus === order.status) return [];
      const nextOrder: ShopOrder = { ...order, status: nextStatus, updatedAt: now };
      orders.value[orders.value.indexOf(order)] = nextOrder;
      return [putEntity('shopOrders', nextOrder)];
    });
    await Promise.all(updates);
  }

  async function checkoutCart(userId: string, userName: string, scope: RelationshipScope = {}, characterName = '') {
    const selectedItems = cartForUser(userId, scope).filter((item) => item.selected);
    if (!selectedItems.length) throw new Error('共享购物车里还没有选中的商品。');
    const selectedProducts = selectedItems.flatMap((item) => {
      const product = products.value.find((entry) => entry.id === item.productId);
      return product ? [{ item, product }] : [];
    });
    const totalCents = selectedProducts.reduce((sum, entry) => sum + entry.product.priceCents * entry.item.quantity, 0);
    const wallet = walletForUser(userId);
    if (!wallet || wallet.balanceCents < totalCents) throw new Error('Wallet 余额不足。');
    const now = Date.now();
    const isRelationshipGift = Boolean(scope.characterId && selectedProducts.every(({ product }) => product.kind === 'gift'));
    const order: ShopOrder = {
      id: createId('order'),
      userId,
      purchaserType: 'user',
      purchaserId: userId,
      purchaserName: userName,
      ...(scope.characterId ? { relationshipCharacterId: scope.characterId, recipientType: 'character' as const, recipientId: scope.characterId, recipientName: characterName || '对方' } : {}),
      storeName: '共享购物车',
      kind: isRelationshipGift ? 'gift' : 'shopping',
      status: 'paid',
      items: selectedProducts.map(({ item, product }) => ({ productId: product.id, title: product.title, quantity: item.quantity, unitPriceCents: product.priceCents, mark: product.mark })),
      totalCents,
      note: isRelationshipGift ? `送给 ${characterName || '对方'} 的礼物` : '共同挑选的生活小物',
      ...(isRelationshipGift ? { cardMessage: `给 ${characterName || '你'}：看到它的时候，第一个想到的就是你。` } : {}),
      ...(scope.conversationId ? { conversationId: scope.conversationId } : {}),
      createdAt: now,
      updatedAt: now
    };
    const nextWallet = { ...wallet, balanceCents: wallet.balanceCents - totalCents, updatedAt: now };
    const transaction: WalletTransaction = {
      id: createId('wallet-tx'),
      walletId: wallet.id,
      type: isRelationshipGift ? 'gift' : 'purchase',
      amountCents: -totalCents,
      title: isRelationshipGift ? `送给 ${characterName || '对方'} 的礼物` : '共享购物车结算',
      subtitle: `${selectedProducts.length} 件商品`,
      relatedOrderId: order.id,
      ...(scope.conversationId ? { relatedConversationId: scope.conversationId } : {}),
      ...(scope.characterId ? { counterpartyType: 'character' as const, counterpartyId: scope.characterId, counterpartyName: characterName || '对方' } : {}),
      createdAt: now
    };
    walletAccounts.value[walletAccounts.value.indexOf(wallet)] = nextWallet;
    walletTransactions.value.push(transaction);
    orders.value.push(order);
    cartItems.value = cartItems.value.filter((item) => !selectedItems.some((selected) => selected.id === item.id));
    await Promise.all([
      putEntity('walletAccounts', nextWallet),
      putEntity('walletTransactions', transaction),
      putEntity('shopOrders', order),
      ...selectedItems.map((item) => deleteEntity('shopCartItems', item.id))
    ]);
    return order;
  }

  async function recordUserChatPurchase(input: {
    attachment: ChatCommerceAttachment;
    userId: string;
    userName: string;
    characterId: string;
    characterName: string;
    conversationId: string;
    sourceMessageId: string;
  }) {
    const existingOrder = orders.value.find((order) => order.id === input.attachment.orderId);
    if (existingOrder) return existingOrder;
    if (!['takeout', 'gift'].includes(input.attachment.kind)) throw new Error('用户只能给角色点外卖或送礼物。');
    if (!input.attachment.items.length) throw new Error('请至少填写一项餐品或礼物。');
    const totalCents = centsFromAmount(input.attachment.totalAmount);
    if (totalCents <= 0) throw new Error('请输入有效的订单金额。');
    const wallet = walletForUser(input.userId);
    if (!wallet || wallet.balanceCents < totalCents) throw new Error('当前 Wallet 余额不足，请减少订单金额后再试。');
    const quantityTotal = input.attachment.items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0);
    const now = Date.now();
    const order: ShopOrder = {
      id: input.attachment.orderId,
      userId: input.userId,
      purchaserType: 'user',
      purchaserId: input.userId,
      purchaserName: input.userName,
      relationshipCharacterId: input.characterId,
      recipientType: 'character',
      recipientId: input.characterId,
      recipientName: input.characterName,
      storeName: input.attachment.storeName,
      kind: input.attachment.kind,
      status: input.attachment.status,
      items: input.attachment.items.map((item) => ({
        title: item.name,
        quantity: Math.max(1, item.quantity),
        unitPriceCents: parseItemPrice(item.price, totalCents, quantityTotal),
        mark: input.attachment.kind === 'takeout' ? '🥡' : '🎁'
      })),
      totalCents,
      eta: input.attachment.eta,
      note: input.attachment.note,
      cardMessage: input.attachment.cardMessage,
      conversationId: input.conversationId,
      sourceMessageId: input.sourceMessageId,
      createdAt: now,
      updatedAt: now
    };
    const nextWallet = { ...wallet, balanceCents: wallet.balanceCents - totalCents, updatedAt: now };
    const transaction: WalletTransaction = {
      id: `wallet_order_${order.id}_user`,
      walletId: wallet.id,
      type: input.attachment.kind === 'gift' ? 'gift' : 'purchase',
      amountCents: -totalCents,
      title: input.attachment.kind === 'takeout' ? `给 ${input.characterName} 点了外卖` : `送给 ${input.characterName} 的礼物`,
      subtitle: input.attachment.items.map((item) => item.name).join('、'),
      relatedOrderId: order.id,
      relatedConversationId: input.conversationId,
      relatedMessageId: input.sourceMessageId,
      counterpartyType: 'character',
      counterpartyId: input.characterId,
      counterpartyName: input.characterName,
      createdAt: now
    };
    walletAccounts.value[walletAccounts.value.indexOf(wallet)] = nextWallet;
    walletTransactions.value.push(transaction);
    orders.value.push(order);
    const writeResults = await Promise.allSettled([
      putEntity('walletAccounts', nextWallet),
      putEntity('walletTransactions', transaction),
      putEntity('shopOrders', order)
    ]);
    const failedWrite = writeResults.find((result) => result.status === 'rejected');
    if (failedWrite?.status === 'rejected') throw failedWrite.reason;
    return order;
  }

  async function recordChatPurchase(input: {
    attachment: ChatCommerceAttachment;
    userId: string;
    characterId: string;
    characterName: string;
    conversationId: string;
    sourceMessageId: string;
  }) {
    if (orders.value.some((order) => order.id === input.attachment.orderId)) return;
    const totalCents = centsFromAmount(input.attachment.totalAmount);
    const quantityTotal = input.attachment.items.reduce((sum, item) => sum + Math.max(1, item.quantity), 0);
    const now = Date.now();
    const order: ShopOrder = {
      id: input.attachment.orderId,
      userId: input.userId,
      purchaserType: 'character',
      purchaserId: input.characterId,
      purchaserName: input.characterName,
      relationshipCharacterId: input.characterId,
      recipientType: 'user',
      recipientId: input.userId,
      storeName: input.attachment.storeName,
      kind: input.attachment.kind,
      status: input.attachment.status,
      items: input.attachment.items.map((item) => ({
        title: item.name,
        quantity: Math.max(1, item.quantity),
        unitPriceCents: parseItemPrice(item.price, totalCents, quantityTotal),
        mark: input.attachment.kind === 'takeout' ? '🥡' : input.attachment.kind === 'gift' ? '🎁' : '🛍️'
      })),
      totalCents,
      eta: input.attachment.eta,
      note: input.attachment.note,
      cardMessage: input.attachment.cardMessage,
      conversationId: input.conversationId,
      sourceMessageId: input.sourceMessageId,
      createdAt: now,
      updatedAt: now
    };
    orders.value.push(order);
    const wallet = walletForCharacter(input.characterId);
    const writes: Array<Promise<unknown>> = [putEntity('shopOrders', order)];
    if (wallet && totalCents > 0) {
      const nextWallet = {
        ...wallet,
        balanceCents: Math.max(0, wallet.balanceCents - totalCents),
        giftAllowanceCents: input.attachment.kind === 'gift' ? Math.max(0, wallet.giftAllowanceCents - totalCents) : wallet.giftAllowanceCents,
        updatedAt: now
      };
      const transaction: WalletTransaction = {
        id: createId('wallet-tx'),
        walletId: wallet.id,
        type: input.attachment.kind === 'gift' ? 'gift' : 'purchase',
        amountCents: -totalCents,
        title: input.attachment.kind === 'takeout' ? `给你点了 ${input.attachment.storeName}` : input.attachment.kind === 'gift' ? '送给你的礼物' : `在 ${input.attachment.storeName} 下单`,
        subtitle: input.attachment.items.map((item) => item.name).join('、'),
        relatedOrderId: order.id,
        relatedConversationId: input.conversationId,
        relatedMessageId: input.sourceMessageId,
        counterpartyType: 'user',
        counterpartyId: input.userId,
        createdAt: now
      };
      walletAccounts.value[walletAccounts.value.indexOf(wallet)] = nextWallet;
      walletTransactions.value.push(transaction);
      writes.push(putEntity('walletAccounts', nextWallet), putEntity('walletTransactions', transaction));
    }
    const moment: ShopMoment = {
      id: createId('shop-moment'),
      characterId: input.characterId,
      characterName: input.characterName,
      kind: 'purchase',
      orderId: order.id,
      conversationId: input.conversationId,
      sourceMessageId: input.sourceMessageId,
      content: input.attachment.kind === 'gift'
        ? input.attachment.cardMessage || `挑了很久，最后觉得这个最适合你。`
        : input.attachment.kind === 'takeout'
          ? `刚下单的，店家说会好好打包。`
          : `买到的时候第一反应是想给你看。`,
      productIds: [],
      storeName: input.attachment.storeName,
      rating: 5,
      likedByUserIds: [],
      savedByUserIds: [],
      commentCount: 0,
      mark: input.attachment.kind === 'takeout' ? '🥡' : input.attachment.kind === 'gift' ? '🎁' : '🛍️',
      palette: input.attachment.kind === 'takeout' ? ['#ead7c7', '#f5e8dc'] : input.attachment.kind === 'gift' ? ['#ecd8df', '#f5e9e2'] : ['#e3dfd7', '#dce5df'],
      createdAt: now
    };
    moments.value.push(moment);
    writes.push(putEntity('shopMoments', moment));
    await Promise.all(writes);
  }

  async function linkOrderToChat(orderId: string, conversationId: string, sourceMessageId: string) {
    const order = orders.value.find((entry) => entry.id === orderId);
    if (!order || !conversationId || !sourceMessageId) return null;
    const nextOrder = { ...order, conversationId, sourceMessageId, updatedAt: Date.now() };
    orders.value[orders.value.indexOf(order)] = nextOrder;
    await putEntity('shopOrders', nextOrder);
    return nextOrder;
  }

  async function syncChatTransfer(input: {
    messageId: string;
    conversationId: string;
    userId: string;
    userName: string;
    characterId: string;
    characterName: string;
    sender: 'user' | 'character';
    amount: string;
    status: ChatTransferStatus;
    note?: string;
  }) {
    const amountCents = centsFromAmount(input.amount);
    const userWallet = walletForUser(input.userId);
    const characterWallet = walletForCharacter(input.characterId);
    if (!userWallet || !characterWallet) return;
    const accepted = input.status === 'accepted' && amountCents > 0;
    const targets = [
      {
        wallet: userWallet,
        transactionId: `wallet_transfer_${input.messageId}_user`,
        amountCents: accepted ? (input.sender === 'user' ? -amountCents : amountCents) : 0,
        counterpartyType: 'character' as const,
        counterpartyId: input.characterId,
        counterpartyName: input.characterName
      },
      {
        wallet: characterWallet,
        transactionId: `wallet_transfer_${input.messageId}_character`,
        amountCents: accepted ? (input.sender === 'character' ? -amountCents : amountCents) : 0,
        counterpartyType: 'user' as const,
        counterpartyId: input.userId,
        counterpartyName: input.userName
      }
    ];
    const adjustments = targets.map((target) => {
      const existing = walletTransactions.value.find((entry) => entry.id === target.transactionId);
      const previousAmountCents = existing?.amountCents ?? 0;
      return { ...target, existing, nextBalanceCents: target.wallet.balanceCents + target.amountCents - previousAmountCents };
    });
    if (adjustments.some((entry) => entry.nextBalanceCents < 0)) throw new Error('钱包余额不足，无法完成这笔转账。');
    const now = Date.now();
    const writes: Array<Promise<unknown>> = [];
    for (const adjustment of adjustments) {
      if (adjustment.nextBalanceCents !== adjustment.wallet.balanceCents) {
        const nextWallet = { ...adjustment.wallet, balanceCents: adjustment.nextBalanceCents, updatedAt: now };
        walletAccounts.value[walletAccounts.value.indexOf(adjustment.wallet)] = nextWallet;
        writes.push(putEntity('walletAccounts', nextWallet));
      }
      if (!adjustment.amountCents) {
        if (adjustment.existing) {
          walletTransactions.value = walletTransactions.value.filter((entry) => entry.id !== adjustment.transactionId);
          writes.push(deleteEntity('walletTransactions', adjustment.transactionId));
        }
        continue;
      }
      const transaction: WalletTransaction = {
        id: adjustment.transactionId,
        walletId: adjustment.wallet.id,
        type: 'transfer',
        amountCents: adjustment.amountCents,
        title: adjustment.amountCents > 0 ? `收到 ${adjustment.counterpartyName} 的转账` : `转账给 ${adjustment.counterpartyName}`,
        subtitle: input.note?.trim() || `来自与 ${input.characterName} 的聊天`,
        relatedConversationId: input.conversationId,
        relatedMessageId: input.messageId,
        counterpartyType: adjustment.counterpartyType,
        counterpartyId: adjustment.counterpartyId,
        counterpartyName: adjustment.counterpartyName,
        createdAt: adjustment.existing?.createdAt ?? now
      };
      if (adjustment.existing) walletTransactions.value[walletTransactions.value.indexOf(adjustment.existing)] = transaction;
      else walletTransactions.value.push(transaction);
      writes.push(putEntity('walletTransactions', transaction));
    }
    await Promise.all(writes);
  }

  async function rollbackChatFinancialActions(messageIds: string[]) {
    const sourceMessageIds = new Set(messageIds.map((id) => id.trim()).filter(Boolean));
    if (!sourceMessageIds.size) return 0;
    const relatedOrders = orders.value.filter((order) => Boolean(order.sourceMessageId && sourceMessageIds.has(order.sourceMessageId)));
    const relatedOrderIds = new Set(relatedOrders.map((order) => order.id));
    const relatedTransactions = walletTransactions.value.filter((transaction) => Boolean(transaction.relatedMessageId && sourceMessageIds.has(transaction.relatedMessageId))
      || Boolean(transaction.relatedOrderId && relatedOrderIds.has(transaction.relatedOrderId)));
    const relatedMoments = moments.value.filter((moment) => Boolean(moment.sourceMessageId && sourceMessageIds.has(moment.sourceMessageId))
      || Boolean(moment.orderId && relatedOrderIds.has(moment.orderId)));
    const nextWallets = new Map<string, WalletAccount>();

    for (const transaction of relatedTransactions) {
      const wallet = nextWallets.get(transaction.walletId) ?? walletAccounts.value.find((entry) => entry.id === transaction.walletId);
      if (!wallet) continue;
      const nextBalanceCents = wallet.balanceCents - transaction.amountCents;
      if (nextBalanceCents < 0) throw new Error('这笔旧回复产生的收入已经被后续消费，暂时无法重新回复。');
      nextWallets.set(wallet.id, {
        ...wallet,
        balanceCents: nextBalanceCents,
        giftAllowanceCents: wallet.ownerType === 'character' && transaction.type === 'gift' && transaction.amountCents < 0
          ? wallet.giftAllowanceCents + Math.abs(transaction.amountCents)
          : wallet.giftAllowanceCents,
        updatedAt: Date.now()
      });
    }

    for (const wallet of nextWallets.values()) {
      const walletIndex = walletAccounts.value.findIndex((entry) => entry.id === wallet.id);
      if (walletIndex >= 0) walletAccounts.value[walletIndex] = wallet;
    }
    walletTransactions.value = walletTransactions.value.filter((transaction) => !relatedTransactions.some((entry) => entry.id === transaction.id));
    orders.value = orders.value.filter((order) => !relatedOrderIds.has(order.id));
    moments.value = moments.value.filter((moment) => !relatedMoments.some((entry) => entry.id === moment.id));

    await Promise.all([
      ...[...nextWallets.values()].map((wallet) => putEntity('walletAccounts', wallet)),
      ...relatedTransactions.map((transaction) => deleteEntity('walletTransactions', transaction.id)),
      ...relatedOrders.map((order) => deleteEntity('shopOrders', order.id)),
      ...relatedMoments.map((moment) => deleteEntity('shopMoments', moment.id))
    ]);
    return relatedTransactions.length + relatedOrders.length + relatedMoments.length;
  }

  async function deleteCharacterCommerceData(characterId: string, conversationIds: string[] = []) {
    const normalizedCharacterId = characterId.trim();
    if (!normalizedCharacterId) return 0;
    await ensureReady();

    const conversationIdSet = new Set(conversationIds.map((id) => id.trim()).filter(Boolean));
    const relatedWallets = walletAccounts.value.filter((entry) => entry.ownerType === 'character' && entry.ownerId === normalizedCharacterId);
    const relatedWalletIds = new Set(relatedWallets.map((entry) => entry.id));
    const relatedStorefronts = storefronts.value.filter((entry) => entry.ownerType === 'character' && entry.ownerCharacterId === normalizedCharacterId);
    const relatedStorefrontIds = new Set(relatedStorefronts.map((entry) => entry.id));
    const relatedProducts = products.value.filter((entry) => relatedStorefrontIds.has(entry.storeId));
    const relatedProductIds = new Set(relatedProducts.map((entry) => entry.id));
    const relatedOrders = orders.value.filter((entry) => entry.purchaserId === normalizedCharacterId
      || entry.relationshipCharacterId === normalizedCharacterId
      || entry.recipientType === 'character' && entry.recipientId === normalizedCharacterId
      || Boolean(entry.conversationId && conversationIdSet.has(entry.conversationId))
      || Boolean(entry.storeId && relatedStorefrontIds.has(entry.storeId))
      || entry.items.some((item) => Boolean(item.productId && relatedProductIds.has(item.productId))));
    const relatedOrderIds = new Set(relatedOrders.map((entry) => entry.id));
    const relatedTransactions = walletTransactions.value.filter((entry) => relatedWalletIds.has(entry.walletId)
      || entry.counterpartyType === 'character' && entry.counterpartyId === normalizedCharacterId
      || Boolean(entry.relatedConversationId && conversationIdSet.has(entry.relatedConversationId))
      || Boolean(entry.relatedOrderId && relatedOrderIds.has(entry.relatedOrderId)));
    const relatedCartItems = cartItems.value.filter((entry) => entry.characterId === normalizedCharacterId
      || entry.relationshipCharacterId === normalizedCharacterId
      || Boolean(entry.conversationId && conversationIdSet.has(entry.conversationId))
      || relatedProductIds.has(entry.productId));
    const relatedWishlistItems = wishlistItems.value.filter((entry) => entry.characterId === normalizedCharacterId
      || entry.relationshipCharacterId === normalizedCharacterId
      || Boolean(entry.conversationId && conversationIdSet.has(entry.conversationId))
      || relatedProductIds.has(entry.productId));
    const relatedMoments = moments.value.filter((entry) => entry.characterId === normalizedCharacterId
      || Boolean(entry.conversationId && conversationIdSet.has(entry.conversationId))
      || Boolean(entry.orderId && relatedOrderIds.has(entry.orderId))
      || entry.productIds.some((id) => relatedProductIds.has(id)));

    const relatedWalletIdSet = new Set(relatedWallets.map((entry) => entry.id));
    const relatedTransactionIdSet = new Set(relatedTransactions.map((entry) => entry.id));
    const relatedStorefrontIdSet = new Set(relatedStorefronts.map((entry) => entry.id));
    const relatedProductIdSet = new Set(relatedProducts.map((entry) => entry.id));
    const relatedCartItemIdSet = new Set(relatedCartItems.map((entry) => entry.id));
    const relatedWishlistItemIdSet = new Set(relatedWishlistItems.map((entry) => entry.id));
    const relatedOrderIdSet = new Set(relatedOrders.map((entry) => entry.id));
    const relatedMomentIdSet = new Set(relatedMoments.map((entry) => entry.id));
    walletAccounts.value = walletAccounts.value.filter((entry) => !relatedWalletIdSet.has(entry.id));
    walletTransactions.value = walletTransactions.value.filter((entry) => !relatedTransactionIdSet.has(entry.id));
    storefronts.value = storefronts.value.filter((entry) => !relatedStorefrontIdSet.has(entry.id));
    products.value = products.value.filter((entry) => !relatedProductIdSet.has(entry.id));
    cartItems.value = cartItems.value.filter((entry) => !relatedCartItemIdSet.has(entry.id));
    wishlistItems.value = wishlistItems.value.filter((entry) => !relatedWishlistItemIdSet.has(entry.id));
    orders.value = orders.value.filter((entry) => !relatedOrderIdSet.has(entry.id));
    moments.value = moments.value.filter((entry) => !relatedMomentIdSet.has(entry.id));

    await Promise.all([
      ...relatedWallets.map((entry) => deleteEntity('walletAccounts', entry.id)),
      ...relatedTransactions.map((entry) => deleteEntity('walletTransactions', entry.id)),
      ...relatedStorefronts.map((entry) => deleteEntity('shopStorefronts', entry.id)),
      ...relatedProducts.map((entry) => deleteEntity('shopProducts', entry.id)),
      ...relatedCartItems.map((entry) => deleteEntity('shopCartItems', entry.id)),
      ...relatedWishlistItems.map((entry) => deleteEntity('shopWishlistItems', entry.id)),
      ...relatedOrders.map((entry) => deleteEntity('shopOrders', entry.id)),
      ...relatedMoments.map((entry) => deleteEntity('shopMoments', entry.id))
    ]);
    await pruneUnusedStoredMediaCache();
    return relatedWallets.length + relatedTransactions.length + relatedStorefronts.length + relatedProducts.length + relatedCartItems.length + relatedWishlistItems.length + relatedOrders.length + relatedMoments.length;
  }

  return {
    ready,
    walletAccounts,
    walletTransactions,
    storefronts,
    products,
    cartItems,
    wishlistItems,
    orders,
    moments,
    featuredProducts,
    characterStorefronts,
    recentOrders,
    recentMoments,
    ensureReady,
    walletForUser,
    walletForCharacter,
    transactionsForWallet,
    cartForUser,
    wishlistForUser,
    addToCart,
    addCharacterPickToCart,
    updateCartQuantity,
    toggleWishlist,
    toggleMomentLike,
    toggleMomentSave,
    generateCharacterCatalog,
    generateProductImage,
    checkoutCart,
    recordUserChatPurchase,
    recordChatPurchase,
    linkOrderToChat,
    syncChatTransfer,
    rollbackChatFinancialActions,
    deleteCharacterCommerceData
  };
});