export type CommercePurchaseKind = 'shopping' | 'takeout' | 'gift';

export type CommerceOrderStatus = 'paid' | 'preparing' | 'delivering' | 'delivered' | 'cancelled';

export type ShopCategory = 'recommend' | 'takeout' | 'gift' | 'lifestyle' | 'fashion' | 'digital';

export type CommerceImageProvider = 'openai' | 'novelai' | 'pollinations';

export interface ChatCommerceItem {
  name: string;
  quantity: number;
  price?: string;
}

export interface ChatCommerceAttachment {
  orderId: string;
  kind: CommercePurchaseKind;
  storeName: string;
  items: ChatCommerceItem[];
  totalAmount: string;
  currency: 'CNY';
  status: CommerceOrderStatus;
  eta?: string;
  note?: string;
  cardMessage?: string;
  purchaserCharacterId?: string;
  purchaserName?: string;
}

export type ChatShopShareKind = 'product' | 'character-pick' | 'wishlist' | 'storefront' | 'moment' | 'order';

export interface ChatShopShareAttachment {
  id: string;
  kind: ChatShopShareKind;
  title: string;
  subtitle: string;
  storeName: string;
  mark: string;
  imageUrl?: string;
  priceCents?: number;
  productId?: string;
  storeId?: string;
  momentId?: string;
  orderId?: string;
  note?: string;
  actorCharacterId?: string;
  actorName?: string;
}

export interface WalletAccount {
  id: string;
  ownerType: 'user' | 'character';
  ownerId: string;
  balanceCents: number;
  monthlyIncomeCents: number;
  savingsGoalCents: number;
  giftAllowanceCents: number;
  spendingTraits: string[];
  generatedAt?: number;
  updatedAt: number;
}

export type WalletTransactionType = 'opening' | 'income' | 'purchase' | 'gift' | 'refund' | 'saving' | 'transfer';

export interface WalletTransaction {
  id: string;
  walletId: string;
  type: WalletTransactionType;
  amountCents: number;
  title: string;
  subtitle: string;
  relatedOrderId?: string;
  relatedConversationId?: string;
  relatedMessageId?: string;
  counterpartyType?: 'user' | 'character';
  counterpartyId?: string;
  counterpartyName?: string;
  createdAt: number;
}

export interface CharacterEconomySnapshot {
  balanceCents: number;
  reservedTransferCents: number;
  availableCents: number;
  monthlyIncomeCents: number;
  savingsGoalCents: number;
  giftAllowanceCents: number;
  spendingTraits: string[];
}

export interface ShopStorefront {
  id: string;
  name: string;
  category: ShopCategory;
  tagline: string;
  description: string;
  mark: string;
  palette: [string, string];
  rating: number;
  monthlySales: number;
  ownerType: 'system' | 'character';
  ownerCharacterId?: string;
  generatedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ShopProduct {
  id: string;
  storeId: string;
  category: ShopCategory;
  kind: CommercePurchaseKind | 'digital';
  title: string;
  subtitle: string;
  priceCents: number;
  originalPriceCents?: number;
  mark: string;
  palette: [string, string];
  tags: string[];
  stock: number;
  imageUrl?: string;
  imageGenerationPrompt?: string;
  imageProvider?: CommerceImageProvider;
  generatedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ShopCartItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  selected: boolean;
  addedBy: 'user' | 'character';
  characterId?: string;
  relationshipCharacterId?: string;
  conversationId?: string;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ShopWishlistItem {
  id: string;
  userId: string;
  productId: string;
  addedBy: 'user' | 'character';
  characterId?: string;
  relationshipCharacterId?: string;
  conversationId?: string;
  note?: string;
  createdAt: number;
}

export interface ShopOrderItem {
  productId?: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
  mark: string;
}

export interface ShopOrder {
  id: string;
  userId: string;
  purchaserType: 'user' | 'character';
  purchaserId: string;
  purchaserName: string;
  relationshipCharacterId?: string;
  recipientType?: 'user' | 'character';
  recipientId?: string;
  recipientName?: string;
  storeId?: string;
  storeName: string;
  kind: CommercePurchaseKind;
  status: CommerceOrderStatus;
  items: ShopOrderItem[];
  totalCents: number;
  eta?: string;
  note?: string;
  cardMessage?: string;
  conversationId?: string;
  sourceMessageId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ShopMoment {
  id: string;
  characterId: string;
  characterName: string;
  kind?: 'purchase' | 'review' | 'favorite';
  orderId?: string;
  conversationId?: string;
  sourceMessageId?: string;
  content: string;
  productIds: string[];
  storeName: string;
  rating?: number;
  likedByUserIds?: string[];
  savedByUserIds?: string[];
  commentCount?: number;
  mark: string;
  palette: [string, string];
  generatedAt?: number;
  createdAt: number;
}

export interface CommerceSnapshot {
  walletAccounts: WalletAccount[];
  walletTransactions: WalletTransaction[];
  shopStorefronts: ShopStorefront[];
  shopProducts: ShopProduct[];
  shopCartItems: ShopCartItem[];
  shopWishlistItems: ShopWishlistItem[];
  shopOrders: ShopOrder[];
  shopMoments: ShopMoment[];
}