<template>
  <section class="screen no-tabs shop-page">
    <header class="shop-header">
      <button class="shop-back" type="button" :aria-label="isRelationshipShop ? '返回聊天' : '返回 Wallet'" @click="goBack"><ChevronLeft :size="21" /></button>
      <div><small>{{ isRelationshipShop ? 'OUR PRIVATE LIFE' : 'LINK SELECT' }}</small><h1>{{ isRelationshipShop ? relationshipCharacterName : 'Shop' }}</h1></div>
      <button class="shop-cart-button" type="button" aria-label="打开共享购物车" @click="showCart = true">
        <ShoppingBag :size="19" />
        <span v-if="cartEntries.length">{{ cartEntries.length }}</span>
      </button>
    </header>

    <main class="shop-content">
      <section class="shop-hero">
        <span class="shop-hero-copy"><small>{{ isRelationshipShop ? 'FOR OUR DAYS' : 'FOR YOUR DAYS' }}</small><strong>{{ isRelationshipShop ? `和 ${relationshipCharacterName} 一起挑` : '为自己挑点喜欢的' }}</strong><em>{{ isRelationshipShop ? '共同购物 · 专属礼物 · TA 的店铺' : '全局商城 · 我的购物车 · 我的订单' }}</em></span>
        <span class="shop-hero-art" aria-hidden="true"><span>🛍️</span><i></i></span>
      </section>

      <section v-if="isRelationshipShop && relationshipCharacter" class="relationship-commerce-card">
        <img :src="relationshipCharacter.avatar" :alt="relationshipCharacterName" />
        <span><small>RELATIONSHIP ACCOUNT</small><strong>只属于你和 {{ relationshipCharacterName }}</strong><em>本页的清单、订单和流水不会混入其他角色</em></span>
        <span><small>TA 的余额</small><strong>{{ formatMoney(relationshipWallet?.balanceCents ?? 0) }}</strong></span>
      </section>

      <label class="shop-search"><Search :size="16" /><input v-model="searchText" placeholder="Search objects, gifts, moments" /><SlidersHorizontal :size="15" /></label>

      <nav class="shop-categories" :aria-label="isRelationshipShop ? '角色专属商城分类' : '全局商城分类'">
        <button v-for="category in categories" :key="category.value" type="button" :class="{ active: activeCategory === category.value }" @click="selectCategory(category.value)">
          <span>{{ category.mark }}</span><small>{{ category.label }}</small>
        </button>
      </nav>

      <section v-if="shoppingCharacters.length" class="ai-restock-card" :class="{ 'ai-restock-card--relationship': isRelationshipShop }">
        <span class="ai-restock-icon"><Sparkles :size="20" /></span>
        <span class="ai-restock-copy"><small>AI CURATED DROP</small><strong>让角色亲自上新</strong><em>生成店铺、商品、经济画像与生活流水</em></span>
        <label v-if="!isRelationshipShop">
          <select v-model="selectedAiCharacterId" aria-label="选择上新角色">
            <option v-for="character in shoppingCharacters" :key="character.id" :value="character.id">{{ character.nickname || character.name }}</option>
          </select>
        </label>
        <button type="button" :disabled="generatingCatalog || !selectedAiCharacterId" @click="generateCatalog">
          <LoaderCircle v-if="generatingCatalog" class="spin" :size="14" />
          <Sparkles v-else :size="14" />
          {{ generatingCatalog ? '生成中…' : 'AI 上新' }}
        </button>
      </section>

      <section v-if="highlightedOrder" class="highlight-order">
        <span class="highlight-order-mark">{{ highlightedOrder.items[0]?.mark || '🎁' }}</span>
        <span><small>ORDER FROM {{ highlightedOrder.purchaserName.toUpperCase() }}</small><strong>{{ highlightedOrder.storeName }}</strong><em>{{ highlightedOrder.items.map((item) => item.title).join('、') }}</em></span>
        <span><strong>{{ formatMoney(highlightedOrder.totalCents) }}</strong><small>{{ orderStatusLabel(highlightedOrder.status) }}</small></span>
      </section>

      <template v-if="activeCategory === 'economy'">
        <section class="shop-section relationship-economy">
          <div class="shop-section-title"><div><small>THEIR OWN LIFE</small><h2>{{ relationshipCharacterName }} 的经济</h2></div><span>角色独立账户</span></div>
          <div class="relationship-economy-card">
            <span><small>Available</small><strong>{{ formatMoney(relationshipWallet?.balanceCents ?? 0) }}</strong></span>
            <span><small>Monthly income</small><strong>{{ formatMoney(relationshipWallet?.monthlyIncomeCents ?? 0) }}</strong></span>
            <span><small>Gift budget</small><strong>{{ formatMoney(relationshipWallet?.giftAllowanceCents ?? 0) }}</strong></span>
            <p>{{ relationshipWallet?.spendingTraits.join(' · ') || `${relationshipCharacterName} 还没有形成消费画像。` }}</p>
          </div>
          <div class="shop-section-title relationship-ledger-title"><div><small>RECENT ACTIVITY</small><h2>TA 的收支记录</h2></div><span>{{ relationshipTransactions.length }} records</span></div>
          <div v-if="relationshipTransactions.length" class="relationship-ledger">
            <article v-for="transaction in relationshipTransactions.slice(0, 8)" :key="transaction.id"><span><strong>{{ transaction.title }}</strong><small>{{ transaction.subtitle }} · {{ formatTransactionDate(transaction.createdAt) }}</small></span><em :class="{ income: transaction.amountCents >= 0 }">{{ transaction.amountCents >= 0 ? '+' : '-' }}{{ formatMoney(Math.abs(transaction.amountCents)) }}</em></article>
          </div>
          <div v-else class="shop-empty"><ReceiptText :size="26" /><strong>还没有关系账单</strong><small>转账、礼物和共同消费会记录在这里。</small></div>
        </section>
      </template>

      <template v-else-if="activeCategory === 'stores'">
        <section class="shop-section">
          <div class="shop-section-title"><div><small>CHARACTER OWNED</small><h2>{{ relationshipCharacterName }} 的店铺</h2></div><span>{{ relationshipStorefronts.length }} stores</span></div>
          <div class="storefront-list storefront-list--vertical">
            <button v-for="storefront in relationshipStorefronts" :key="storefront.id" class="storefront-card" type="button" :style="storefrontStyle(storefront)" @click="openStorefront(storefront.id)">
              <span class="storefront-mark">{{ storefront.mark }}</span>
              <span class="storefront-copy"><small>{{ storefront.tagline }}</small><strong>{{ storefront.name }}</strong><em>{{ storefront.description }}</em><span>★ {{ storefront.rating.toFixed(1) }} · {{ storefront.monthlySales }} sold</span></span>
            </button>
          </div>
        </section>
      </template>

      <template v-else-if="activeCategory === 'moments'">
        <section class="shop-section">
          <div class="shop-section-title"><div><small>SHOPPING MOMENTS</small><h2>商城朋友圈</h2></div><span>real little finds</span></div>
          <div class="shop-moment-list">
            <article v-for="moment in relationshipMoments" :key="moment.id" class="shop-moment-card" :class="{ highlighted: route.query.moment === moment.id }">
              <span class="moment-avatar">{{ moment.characterName.slice(0, 1) }}</span>
              <span class="moment-main">
                <span class="moment-meta"><strong>{{ moment.characterName }}</strong><small>{{ formatRelativeTime(moment.createdAt) }}</small></span>
                <p>{{ moment.content }}</p>
                <span class="moment-product" :style="momentStyle(moment)"><img v-if="momentProduct(moment)?.imageUrl" :src="momentProduct(moment)?.imageUrl" :alt="momentProduct(moment)?.title || moment.storeName" /><i v-else>{{ moment.mark }}</i><span><strong>{{ moment.storeName }}</strong><small>{{ momentKindLabel(moment) }}</small></span></span>
                <span class="moment-actions">
                  <button type="button" :class="{ active: momentLiked(moment) }" @click="toggleMomentLike(moment.id)"><Heart :size="13" :fill="momentLiked(moment) ? 'currentColor' : 'none'" /> Like <em v-if="moment.likedByUserIds?.length">{{ moment.likedByUserIds.length }}</em></button>
                  <span><MessageCircle :size="13" /> Comment <em v-if="moment.commentCount">{{ moment.commentCount }}</em></span>
                  <button type="button" :class="{ active: momentSaved(moment) }" @click="toggleMomentSave(moment.id)"><Bookmark :size="13" :fill="momentSaved(moment) ? 'currentColor' : 'none'" /> Save</button>
                  <button type="button" @click="shareMoment(moment.id)"><Share2 :size="13" /> Send</button>
                </span>
              </span>
            </article>
          </div>
        </section>
      </template>

      <template v-else-if="activeCategory === 'wishlist'">
        <section class="shop-section">
          <div class="shop-section-title"><div><small>OUR LITTLE LIST</small><h2>共同愿望单</h2></div><span>{{ wishlistProducts.length }} saved</span></div>
          <div v-if="wishlistProducts.length" class="product-grid">
            <ProductCard v-for="product in wishlistProducts" :key="product.id" :product="product" :store-name="storeName(product.storeId)" :wished="true" :shareable="isRelationshipShop" :highlighted="route.query.product === product.id" :image-generating="generatingImageProductIds.includes(product.id)" @add="addProduct" @wish="toggleProductWish" @image="generateProductImage" @share="shareProduct" />
          </div>
          <div v-else class="shop-empty"><Heart :size="26" /><strong>还没有共同心愿</strong><small>看到喜欢的东西时点一下爱心。</small></div>
        </section>
      </template>

      <template v-else-if="activeCategory === 'orders'">
        <section class="shop-section">
          <div class="shop-section-title"><div><small>PURCHASE HISTORY</small><h2>全部订单</h2></div><span>{{ userOrders.length }} orders</span></div>
          <div v-if="userOrders.length" class="shop-orders">
            <article v-for="order in userOrders" :key="order.id" class="shop-order-card" :class="{ highlighted: route.query.order === order.id }">
              <span class="shop-order-head"><strong>{{ order.storeName }}</strong><small>{{ orderStatusLabel(order.status) }}</small></span>
              <span class="shop-order-body"><i>{{ order.items[0]?.mark || '🛍️' }}</i><span><strong>{{ order.items.map((item) => `${item.title} ×${item.quantity}`).join('、') }}</strong><small>{{ order.purchaserType === 'character' ? `${order.purchaserName} 已付款` : '你已付款' }}{{ order.eta ? ` · ${order.eta}` : '' }}</small></span><em>{{ formatMoney(order.totalCents) }}</em></span>
              <p v-if="order.cardMessage">“{{ order.cardMessage }}”</p>
              <button v-if="order.conversationId" class="order-chat-link" type="button" @click="openOrderChat(order.conversationId, order.sourceMessageId)">返回聊天{{ order.sourceMessageId ? '楼层' : '' }} <ChevronRight :size="13" /></button>
            </article>
          </div>
          <div v-else class="shop-empty"><ReceiptText :size="26" /><strong>还没有订单</strong><small>共同挑选的东西会留在这里。</small></div>
        </section>
      </template>

      <template v-else>
        <section v-if="isRelationshipShop && activeCategory === 'gift'" class="shop-section">
          <div class="shop-section-title"><div><small>GIFTS BETWEEN US</small><h2>礼物与卡片</h2></div><span>{{ relationshipGiftOrders.length }} memories</span></div>
          <div v-if="relationshipGiftOrders.length" class="relationship-gifts">
            <article v-for="order in relationshipGiftOrders" :key="order.id">
              <span class="relationship-gift-mark">{{ order.items[0]?.mark || '🎁' }}</span>
              <span><small>{{ order.purchaserType === 'character' ? `${relationshipCharacterName} 送给你` : `你送给 ${relationshipCharacterName}` }}</small><strong>{{ order.items.map((item) => item.title).join('、') }}</strong><em>{{ order.cardMessage ? `“${order.cardMessage}”` : order.note || '一份没有写完的心意' }}</em></span>
              <button v-if="order.conversationId" type="button" @click="openOrderChat(order.conversationId, order.sourceMessageId)"><ChevronRight :size="14" /></button>
            </article>
          </div>
          <div v-else class="shop-empty shop-empty--compact"><Heart :size="24" /><strong>还没有送给彼此的礼物</strong><small>从下面挑一件，结算后会成为当前关系的专属订单。</small></div>
        </section>

        <section v-if="isRelationshipShop && activeCategory === 'all' && shoppingCharacters.length" class="shop-section">
          <div class="shop-section-title"><div><small>PICKED TOGETHER</small><h2>让 TA 一起挑</h2></div><span>加入共享购物车</span></div>
          <div class="shopping-companions">
            <button v-for="character in shoppingCharacters" :key="character.id" type="button" :disabled="pickingCharacterIds.includes(character.id)" @click="addCharacterPick(character.id)">
              <img :src="character.avatar" :alt="character.nickname || character.name" />
              <span><strong>{{ character.nickname || character.name }}</strong><small>{{ pickingCharacterIds.includes(character.id) ? '正在认真挑选…' : '为你们挑一件并说明理由' }}</small></span>
              <LoaderCircle v-if="pickingCharacterIds.includes(character.id)" class="spin" :size="16" />
              <ShoppingBasket v-else :size="16" />
            </button>
          </div>
        </section>

        <section v-if="isRelationshipShop && activeCategory === 'all'" class="shop-section">
          <div class="shop-section-title"><div><small>OWNED BY THEM</small><h2>角色店铺</h2></div><button type="button" @click="activeCategory = 'stores'">See all</button></div>
          <div class="storefront-list">
            <button v-for="storefront in relationshipStorefronts" :key="storefront.id" class="storefront-card" type="button" :style="storefrontStyle(storefront)" @click="openStorefront(storefront.id)">
              <span class="storefront-mark">{{ storefront.mark }}</span>
              <span class="storefront-copy"><small>{{ storefront.tagline }}</small><strong>{{ storefront.name }}</strong><em>{{ storefront.description }}</em><span>★ {{ storefront.rating.toFixed(1) }} · {{ storefront.monthlySales }} sold</span></span>
            </button>
          </div>
        </section>

        <section v-if="activeCategory === 'storefront' && selectedStorefront" class="selected-store-banner" :style="storefrontStyle(selectedStorefront)">
          <span>{{ selectedStorefront.mark }}</span>
          <div><small>{{ selectedStorefront.tagline }}</small><h2>{{ selectedStorefront.name }}</h2><p>{{ selectedStorefront.description }}</p><em>★ {{ selectedStorefront.rating.toFixed(1) }} · {{ selectedStorefront.monthlySales }} sold</em><button type="button" @click="shareStorefront(selectedStorefront.id)"><Share2 :size="12" /> 发给 {{ selectedAiCharacter?.nickname || selectedAiCharacter?.name || 'TA' }}</button></div>
        </section>

        <section class="shop-section">
          <div class="shop-section-title"><div><small>{{ activeCategory === 'all' ? 'CURATED FOR TODAY' : 'SELECTED COLLECTION' }}</small><h2>{{ activeCategoryTitle }}</h2></div><span>{{ filteredProducts.length }} items</span></div>
          <div v-if="filteredProducts.length" class="product-grid">
            <ProductCard v-for="product in filteredProducts" :key="product.id" :product="product" :store-name="storeName(product.storeId)" :wished="wishlistProductIds.has(product.id)" :shareable="isRelationshipShop" :highlighted="route.query.product === product.id" :image-generating="generatingImageProductIds.includes(product.id)" @add="addProduct" @wish="toggleProductWish" @image="generateProductImage" @share="shareProduct" />
          </div>
          <div v-else class="shop-empty"><Search :size="26" /><strong>没有找到合适的东西</strong><small>换一个关键词或分类看看。</small></div>
        </section>
      </template>
    </main>

    <Transition name="toast"><p v-if="toastText" class="shop-toast">{{ toastText }}</p></Transition>

    <Transition name="sheet">
      <div v-if="showCart" class="cart-layer" @click.self="showCart = false">
        <section class="cart-sheet">
          <span class="cart-sheet-handle"></span>
          <header><div><small>OUR SHARED CART</small><h2>共同购物车</h2></div><button type="button" @click="showCart = false"><X :size="19" /></button></header>
          <div v-if="cartEntries.length" class="cart-items">
            <article v-for="entry in cartEntries" :key="entry.item.id">
              <span class="cart-item-mark" :style="productStyle(entry.product)">{{ entry.product.mark }}</span>
              <span><strong>{{ entry.product.title }}</strong><small>{{ storeName(entry.product.storeId) }} · {{ cartAddedByLabel(entry.item) }}</small><em v-if="entry.item.note">“{{ entry.item.note }}”</em></span>
              <span class="cart-quantity"><button type="button" @click="commerceStore.updateCartQuantity(entry.item.id, entry.item.quantity - 1)">−</button><em>{{ entry.item.quantity }}</em><button type="button" @click="commerceStore.updateCartQuantity(entry.item.id, entry.item.quantity + 1)">+</button></span>
            </article>
          </div>
          <div v-else class="cart-empty"><ShoppingBasket :size="29" /><strong>{{ isRelationshipShop ? `和 ${relationshipCharacterName} 的购物车还是空的` : '购物车还是空的' }}</strong><small>{{ isRelationshipShop ? '只有你们两人的商品会出现在这里。' : '全局购物不会混入任何角色关系。' }}</small></div>
          <footer><span><small>Total</small><strong>{{ formatMoney(cartTotalCents) }}</strong></span><button type="button" :disabled="!cartEntries.length || checkingOut" @click="checkout">{{ checkingOut ? '结算中…' : '确认结算' }}</button></footer>
        </section>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Bookmark, ChevronLeft, ChevronRight, Heart, ImagePlus, LoaderCircle, MessageCircle, ReceiptText, Search, Share2, ShoppingBag, ShoppingBasket, SlidersHorizontal, Sparkles, X } from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';
import { useCommerceStore } from '@/stores/commerceStore';
import type { ChatShopShareAttachment, CommerceOrderStatus, ShopCartItem, ShopMoment, ShopProduct, ShopStorefront } from '@/types/commerce';

const ProductCard = defineComponent({
  props: { product: { type: Object as () => ShopProduct, required: true }, storeName: { type: String, required: true }, wished: { type: Boolean, default: false }, shareable: { type: Boolean, default: false }, highlighted: { type: Boolean, default: false }, imageGenerating: { type: Boolean, default: false } },
  emits: ['add', 'wish', 'image', 'share'],
  setup(props, { emit }) {
    return () => h('article', { class: ['product-card', { highlighted: props.highlighted }] }, [
      h('div', { class: 'product-visual', style: { background: `linear-gradient(145deg, ${props.product.palette[0]}, ${props.product.palette[1]})` } }, [
        props.product.imageUrl
          ? h('img', { class: 'product-photo', src: props.product.imageUrl, alt: props.product.title, loading: 'lazy', decoding: 'async' })
          : h('span', props.product.mark),
        h('button', { type: 'button', class: 'product-image-action', disabled: props.imageGenerating, 'aria-label': `${props.product.imageUrl ? '重新生成' : '生成'} ${props.product.title} 商品图`, onClick: () => emit('image', props.product.id) }, [h(props.imageGenerating ? LoaderCircle : ImagePlus, { class: { spin: props.imageGenerating }, size: 14 })]),
        h('button', { type: 'button', class: { active: props.wished }, 'aria-label': props.wished ? '移出愿望单' : '加入愿望单', onClick: () => emit('wish', props.product.id) }, [h(Heart, { size: 15, fill: props.wished ? 'currentColor' : 'none' })])
      ]),
      h('div', { class: 'product-copy' }, [h('small', props.storeName), h('strong', props.product.title), h('em', props.product.subtitle), h('span', props.product.tags.slice(0, 2).map((tag) => h('i', { key: tag }, tag)))]),
      h('div', { class: 'product-price' }, [h('strong', `¥${(props.product.priceCents / 100).toFixed(2)}`), h('span', { class: 'product-card-actions' }, [props.shareable ? h('button', { type: 'button', class: 'share-action', 'aria-label': `发送 ${props.product.title} 到线上聊天`, onClick: () => emit('share', props.product.id) }, [h(Share2, { size: 12 })]) : null, h('button', { type: 'button', 'aria-label': `加入 ${props.product.title} 到购物车`, onClick: () => emit('add', props.product.id) }, '+')])])
    ]);
  }
});

type ShopSection = 'all' | 'economy' | 'takeout' | 'gift' | 'lifestyle' | 'fashion' | 'digital' | 'stores' | 'storefront' | 'moments' | 'wishlist' | 'orders';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();
const commerceStore = useCommerceStore();
const searchText = ref('');
const activeCategory = ref<ShopSection>('all');
const showCart = ref(false);
const checkingOut = ref(false);
const generatingCatalog = ref(false);
const generatingImageProductIds = ref<string[]>([]);
const pickingCharacterIds = ref<string[]>([]);
const selectedAiCharacterId = ref('');
const toastText = ref('');
const selectedStoreId = ref('');
let toastTimer: number | undefined;

const globalCategories: Array<{ value: ShopSection; label: string; mark: string }> = [
  { value: 'all', label: '精选', mark: '⌁' },
  { value: 'takeout', label: '外卖', mark: '🥡' },
  { value: 'gift', label: '礼物', mark: '🎁' },
  { value: 'lifestyle', label: '生活', mark: '☕' },
  { value: 'fashion', label: '穿搭', mark: '🧺' },
  { value: 'wishlist', label: '心愿', mark: '♡' },
  { value: 'orders', label: '订单', mark: '▤' }
];

const relationshipCategories: Array<{ value: ShopSection; label: string; mark: string }> = [
  { value: 'economy', label: 'TA 的钱包', mark: '¥' },
  { value: 'all', label: '共同购物', mark: '⌁' },
  { value: 'gift', label: '礼物卡片', mark: '🎁' },
  { value: 'wishlist', label: '共同愿望', mark: '♡' },
  { value: 'stores', label: 'TA 的店', mark: '🏷️' },
  { value: 'moments', label: '生活记录', mark: '📷' },
  { value: 'orders', label: '关系订单', mark: '▤' }
];

const activeUserId = computed(() => appStore.user?.id ?? '');
const relationshipCharacterId = computed(() => String(route.query.character ?? '').trim());
const relationshipConversationId = computed(() => String(route.query.conversation ?? '').trim());
const isRelationshipShop = computed(() => Boolean(relationshipCharacterId.value && relationshipConversationId.value));
const relationshipCharacter = computed(() => relationshipCharacterId.value ? appStore.characterById(relationshipCharacterId.value) ?? null : null);
const relationshipCharacterName = computed(() => relationshipCharacter.value?.nickname || relationshipCharacter.value?.name || 'TA');
const relationshipWallet = computed(() => relationshipCharacterId.value ? commerceStore.walletForCharacter(relationshipCharacterId.value) : undefined);
const relationshipTransactions = computed(() => relationshipWallet.value ? commerceStore.transactionsForWallet(relationshipWallet.value.id).filter((transaction) => !transaction.relatedConversationId || transaction.relatedConversationId === relationshipConversationId.value) : []);
const commerceScope = computed(() => isRelationshipShop.value ? { characterId: relationshipCharacterId.value, conversationId: relationshipConversationId.value } : {});
const categories = computed(() => isRelationshipShop.value ? relationshipCategories : globalCategories);
const shoppingCharacters = computed(() => relationshipCharacter.value ? [relationshipCharacter.value] : []);
const selectedAiCharacter = computed(() => shoppingCharacters.value.find((character) => character.id === selectedAiCharacterId.value) ?? null);
const selectedStorefront = computed(() => commerceStore.storefronts.find((storefront) => storefront.id === selectedStoreId.value) ?? null);
const relationshipStorefronts = computed(() => commerceStore.characterStorefronts.filter((storefront) => storefront.ownerCharacterId === relationshipCharacterId.value));
const relationshipMoments = computed(() => commerceStore.recentMoments.filter((moment) => moment.characterId === relationshipCharacterId.value && (!moment.conversationId || moment.conversationId === relationshipConversationId.value)));
const wishlistProductIds = computed(() => new Set(commerceStore.wishlistForUser(activeUserId.value, commerceScope.value).map((item) => item.productId)));
const wishlistProducts = computed(() => commerceStore.products.filter((product) => wishlistProductIds.value.has(product.id)));
const userOrders = computed(() => commerceStore.recentOrders.filter((order) => order.userId === activeUserId.value && (isRelationshipShop.value
  ? order.conversationId === relationshipConversationId.value || order.relationshipCharacterId === relationshipCharacterId.value || order.purchaserType === 'character' && order.purchaserId === relationshipCharacterId.value
  : order.purchaserType === 'user' && !order.conversationId && !order.relationshipCharacterId)));
const relationshipGiftOrders = computed(() => userOrders.value.filter((order) => order.kind === 'gift'));
const highlightedOrder = computed(() => userOrders.value.find((order) => order.id === String(route.query.order ?? '')) ?? null);
const cartEntries = computed(() => commerceStore.cartForUser(activeUserId.value, commerceScope.value).flatMap((item) => {
  const product = commerceStore.products.find((entry) => entry.id === item.productId);
  return product ? [{ item, product }] : [];
}));
const cartTotalCents = computed(() => cartEntries.value.reduce((sum, entry) => sum + entry.product.priceCents * entry.item.quantity, 0));
const activeCategoryTitle = computed(() => activeCategory.value === 'storefront'
  ? selectedStorefront.value?.name ?? '店铺商品'
  : ({ all: isRelationshipShop.value ? '你们的今日精选' : '今日精选', economy: `${relationshipCharacterName.value} 的经济`, takeout: '外卖灵感', gift: isRelationshipShop.value ? `送给 ${relationshipCharacterName.value}` : '礼物精选', lifestyle: '日常生活', fashion: '低饱和穿搭', digital: '数字收藏', stores: '角色店铺', moments: '商城朋友圈', wishlist: isRelationshipShop.value ? '共同愿望单' : '我的心愿单', orders: isRelationshipShop.value ? '关系订单' : '我的订单' })[activeCategory.value]);
const filteredProducts = computed(() => {
  const query = searchText.value.trim().toLocaleLowerCase();
  return commerceStore.featuredProducts.filter((product) => {
    const storefront = commerceStore.storefronts.find((entry) => entry.id === product.storeId);
    if (!isRelationshipShop.value && storefront?.ownerType === 'character') return false;
    if (isRelationshipShop.value && storefront?.ownerType === 'character' && storefront.ownerCharacterId !== relationshipCharacterId.value) return false;
    const categoryMatches = activeCategory.value === 'all'
      || activeCategory.value === 'storefront' && product.storeId === selectedStoreId.value
      || product.category === activeCategory.value
      || activeCategory.value === 'gift' && product.kind === 'gift';
    const queryMatches = !query || [product.title, product.subtitle, ...product.tags, storeName(product.storeId)].join(' ').toLocaleLowerCase().includes(query);
    return categoryMatches && queryMatches;
  });
});

function storeName(storeId: string) { return commerceStore.storefronts.find((storefront) => storefront.id === storeId)?.name ?? 'LINK Select'; }
function formatMoney(cents: number) { return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(cents / 100); }
function formatTransactionDate(timestamp: number) { return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(timestamp); }
function orderStatusLabel(status: CommerceOrderStatus) { return { paid: '已付款', preparing: '准备中', delivering: '配送中', delivered: '已送达', cancelled: '已取消' }[status]; }
function productStyle(product: ShopProduct) { return { background: `linear-gradient(145deg, ${product.palette[0]}, ${product.palette[1]})` }; }
function storefrontStyle(storefront: ShopStorefront) { return { background: `linear-gradient(145deg, ${storefront.palette[0]}, ${storefront.palette[1]})` }; }
function momentStyle(moment: ShopMoment) { return { background: `linear-gradient(145deg, ${moment.palette[0]}, ${moment.palette[1]})` }; }
function momentProduct(moment: ShopMoment) { return moment.productIds.flatMap((productId) => commerceStore.products.find((product) => product.id === productId) ?? []).at(0) ?? null; }
function formatRelativeTime(timestamp: number) { const hours = Math.max(1, Math.floor((Date.now() - timestamp) / 3_600_000)); return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`; }
function goBack() {
  const target = isRelationshipShop.value
    ? { name: 'chat-room', params: { id: relationshipConversationId.value } }
    : { name: 'wallet' };
  const backPath = String(window.history.state?.back ?? '');
  const targetPath = router.resolve(target).path;
  if (backPath && new URL(backPath, window.location.origin).pathname === targetPath) {
    router.back();
    return;
  }
  void router.replace(target);
}
function openOrderChat(conversationId: string, sourceMessageId?: string) { void router.push({ name: 'chat-room', params: { id: conversationId }, query: sourceMessageId ? { focus: sourceMessageId } : {} }); }
function momentLiked(moment: ShopMoment) { return Boolean(activeUserId.value && moment.likedByUserIds?.includes(activeUserId.value)); }
function momentSaved(moment: ShopMoment) { return Boolean(activeUserId.value && moment.savedByUserIds?.includes(activeUserId.value)); }
function momentKindLabel(moment: ShopMoment) {
  if (moment.kind === 'favorite') return '收藏夹分享';
  if (moment.kind === 'review') return moment.rating ? `★ ${moment.rating.toFixed(1)} · 使用评价` : '使用评价';
  return moment.rating ? `★ ${moment.rating.toFixed(1)} · 已购买` : '已购买';
}

function selectCategory(category: ShopSection) {
  selectedStoreId.value = '';
  activeCategory.value = category;
}

function openStorefront(storefrontId: string) {
  selectedStoreId.value = storefrontId;
  activeCategory.value = 'storefront';
}

function cartAddedByLabel(item: ShopCartItem) {
  if (item.addedBy !== 'character' || !item.characterId) return '你加入的';
  const character = appStore.characterById(item.characterId);
  return `${character?.nickname || character?.name || '角色'} 加入的`;
}

function showToast(message: string) {
  toastText.value = message;
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toastText.value = ''; }, 1800);
}

async function addProduct(productId: string) {
  if (!activeUserId.value) return;
  await commerceStore.addToCart(activeUserId.value, productId, commerceScope.value);
  showToast('已放进共同购物车');
}

async function addCharacterPick(characterId: string) {
  if (!activeUserId.value || !appStore.settings || pickingCharacterIds.value.includes(characterId)) return;
  const character = appStore.characterById(characterId);
  if (!character) return;
  pickingCharacterIds.value = [...pickingCharacterIds.value, characterId];
  try {
    const selection = await commerceStore.addCharacterPickToCart(activeUserId.value, character, appStore.user, appStore.settings, relationshipConversationId.value);
    if (selection) {
      const product = selection.product;
      void sendShopShare(character.id, 'char', {
        id: `shop_share_pick_${Date.now()}`,
        kind: 'character-pick',
        title: product.title,
        subtitle: product.subtitle,
        storeName: storeName(product.storeId),
        mark: product.mark,
        imageUrl: product.imageUrl,
        priceCents: product.priceCents,
        productId: product.id,
        storeId: product.storeId,
        note: selection.reason,
        actorCharacterId: character.id,
        actorName: character.nickname || character.name
      }).catch((error) => appStore.showConfigAlert(error instanceof Error ? error.message : '选品卡片发送失败。', '商品已加入购物车，但未发送到聊天'));
      showToast(`${character.nickname || character.name} 已挑好并发到线上聊天`);
    } else showToast('购物车里已经有全部商品了');
  } catch (error) {
    appStore.showConfigAlert(error instanceof Error ? error.message : '角色选品失败。', '无法让角色挑选');
  } finally {
    pickingCharacterIds.value = pickingCharacterIds.value.filter((id) => id !== characterId);
  }
}

async function sendShopShare(characterId: string, sender: 'user' | 'char', share: ChatShopShareAttachment) {
  return await appStore.appendShopShareMessage({ characterId, userId: activeUserId.value, sender, share });
}

async function shareProduct(productId: string) {
  const character = selectedAiCharacter.value;
  const product = commerceStore.products.find((entry) => entry.id === productId);
  if (!character || !product) {
    appStore.showConfigAlert('请先在 AI 上新卡片中选择要分享的角色。', '无法发送到聊天');
    return;
  }
  try {
    const wished = wishlistProductIds.value.has(product.id);
    await sendShopShare(character.id, 'user', {
      id: `shop_share_product_${Date.now()}`,
      kind: wished ? 'wishlist' : 'product',
      title: product.title,
      subtitle: product.subtitle,
      storeName: storeName(product.storeId),
      mark: product.mark,
      imageUrl: product.imageUrl,
      priceCents: product.priceCents,
      productId: product.id,
      storeId: product.storeId,
      note: wished ? '我把它放进共同愿望单了。' : '想和你一起看看这个。'
    });
    showToast(`已发到与 ${character.nickname || character.name} 的线上聊天`);
  } catch (error) {
    appStore.showConfigAlert(error instanceof Error ? error.message : '商品发送失败。', '无法发送到聊天');
  }
}

async function shareStorefront(storefrontId: string) {
  const character = selectedAiCharacter.value;
  const storefront = commerceStore.storefronts.find((entry) => entry.id === storefrontId);
  if (!character || !storefront) return;
  try {
    await sendShopShare(character.id, 'user', {
      id: `shop_share_store_${Date.now()}`,
      kind: 'storefront',
      title: storefront.name,
      subtitle: storefront.description,
      storeName: storefront.name,
      mark: storefront.mark,
      storeId: storefront.id,
      note: '想和你一起逛逛这家店。'
    });
    showToast(`店铺已发给 ${character.nickname || character.name}`);
  } catch (error) {
    appStore.showConfigAlert(error instanceof Error ? error.message : '店铺发送失败。', '无法发送到聊天');
  }
}

async function shareMoment(momentId: string) {
  const character = selectedAiCharacter.value;
  const moment = commerceStore.moments.find((entry) => entry.id === momentId);
  if (!character || !moment) return;
  const product = momentProduct(moment);
  try {
    await sendShopShare(character.id, 'user', {
      id: `shop_share_moment_${Date.now()}`,
      kind: 'moment',
      title: `${moment.characterName} 的商城动态`,
      subtitle: moment.content,
      storeName: moment.storeName,
      mark: moment.mark,
      imageUrl: product?.imageUrl,
      productId: product?.id,
      storeId: product?.storeId,
      momentId: moment.id,
      note: '看到这条时想听听你的看法。'
    });
    showToast(`动态已发给 ${character.nickname || character.name}`);
  } catch (error) {
    appStore.showConfigAlert(error instanceof Error ? error.message : '动态发送失败。', '无法发送到聊天');
  }
}

async function generateCatalog() {
  const character = selectedAiCharacter.value;
  const settings = appStore.settings;
  const user = appStore.user;
  if (!character || !settings || generatingCatalog.value) return;
  const previousCategory = activeCategory.value;
  generatingCatalog.value = true;
  try {
    const result = await commerceStore.generateCharacterCatalog(character, user, settings);
    selectedStoreId.value = result.storefront.id;
    activeCategory.value = previousCategory === 'economy' ? 'economy' : 'storefront';
    void sendShopShare(character.id, 'char', {
      id: `shop_share_restock_${Date.now()}`,
      kind: 'storefront',
      title: result.storefront.name,
      subtitle: result.storefront.description,
      storeName: result.storefront.name,
      mark: result.storefront.mark,
      storeId: result.storefront.id,
      note: '店里刚换了一批我自己挑的东西，想先给你看。',
      actorCharacterId: character.id,
      actorName: character.nickname || character.name
    }).catch((error) => appStore.showConfigAlert(error instanceof Error ? error.message : '店铺卡片发送失败。', '上新已完成，但未发送到聊天'));
    showToast(`${character.nickname || character.name} 已上新，并新增 ${result.transactions.length} 条生活收支`);
  } catch (error) {
    appStore.showConfigAlert(error instanceof Error ? error.message : '商城 AI 上新失败。', '无法完成 AI 上新');
  } finally {
    generatingCatalog.value = false;
  }
}

async function generateProductImage(productId: string) {
  if (!appStore.settings || generatingImageProductIds.value.includes(productId)) return;
  generatingImageProductIds.value = [...generatingImageProductIds.value, productId];
  try {
    await commerceStore.generateProductImage(productId, appStore.settings);
    showToast('商品图已经生成并保存');
  } catch (error) {
    appStore.showConfigAlert(error instanceof Error ? error.message : '商品图片生成失败。', '无法生成商品图');
  } finally {
    generatingImageProductIds.value = generatingImageProductIds.value.filter((id) => id !== productId);
  }
}

async function toggleProductWish(productId: string) {
  if (!activeUserId.value) return;
  const added = await commerceStore.toggleWishlist(activeUserId.value, productId, commerceScope.value);
  showToast(added ? '已加入共同愿望单' : '已移出愿望单');
}

async function toggleMomentLike(momentId: string) {
  if (!activeUserId.value) return;
  await commerceStore.toggleMomentLike(momentId, activeUserId.value);
}

async function toggleMomentSave(momentId: string) {
  if (!activeUserId.value) return;
  const saved = await commerceStore.toggleMomentSave(momentId, activeUserId.value);
  showToast(saved ? '已收藏这条晒单' : '已取消收藏');
}

async function checkout() {
  if (!appStore.user || checkingOut.value) return;
  checkingOut.value = true;
  try {
    const order = await commerceStore.checkoutCart(appStore.user.id, appStore.user.nickname || appStore.user.name, commerceScope.value, relationshipCharacterName.value);
    if (selectedAiCharacter.value) {
      try {
        const result = await sendShopShare(selectedAiCharacter.value.id, 'user', {
          id: `shop_share_order_${Date.now()}`,
          kind: 'order',
          title: order.items.map((item) => item.title).join('、'),
          subtitle: `${order.items.length} 件共同挑选的商品`,
          storeName: order.storeName,
          mark: order.items[0]?.mark || '🛍️',
          priceCents: order.totalCents,
          orderId: order.id,
          note: '共同购物车已经结算。'
        });
        await commerceStore.linkOrderToChat(order.id, result.conversation.id, result.message.id);
      } catch (error) {
        appStore.showConfigAlert(error instanceof Error ? error.message : '订单卡片发送失败。', '订单已创建，但未发送到聊天');
      }
    }
    showCart.value = false;
    activeCategory.value = 'orders';
    showToast('订单已经创建');
  } catch (error) {
    showToast(error instanceof Error ? error.message : '结算失败');
  } finally {
    checkingOut.value = false;
  }
}

watch(() => route.query.section, (section) => {
  const value = String(section ?? '');
  if (value === 'cart') showCart.value = true;
  else if (['economy', 'gift', 'wishlist', 'orders', 'moments', 'stores'].includes(value)) activeCategory.value = value as ShopSection;
}, { immediate: true });

onMounted(async () => {
  await appStore.hydrate();
  await commerceStore.ensureReady(appStore.users, appStore.characters);
  selectedAiCharacterId.value = relationshipCharacterId.value || shoppingCharacters.value[0]?.id || '';
  const routeStoreId = String(route.query.store ?? '');
  const routeProductId = String(route.query.product ?? '');
  const routeProduct = commerceStore.products.find((product) => product.id === routeProductId);
  if (routeStoreId || routeProduct?.storeId) openStorefront(routeStoreId || routeProduct?.storeId || '');
  if (route.query.order) activeCategory.value = 'orders';
});
</script>

<style scoped>
.shop-page { background: radial-gradient(circle at 0 0,rgba(236,218,223,.55),transparent 27%),linear-gradient(180deg,#fbf8f4,#f5f3ef 62%,#eef3ef); }
.shop-header { display:grid; grid-template-columns:40px minmax(0,1fr) 40px; align-items:center; min-height:68px; padding:12px 15px 6px; }
.shop-header > div { display:grid; justify-items:center; gap:1px; }.shop-header small,.shop-section-title small,.cart-sheet header small { color:#a18b91;font-size:7px;font-weight:900;letter-spacing:.16em; }.shop-header h1 { margin:0;color:#342e30;font-family:Georgia,serif;font-size:25px;font-weight:500; }.shop-back,.shop-cart-button { position:relative;display:grid;place-items:center;width:38px;height:38px;border-radius:15px;background:rgba(255,255,255,.78);color:#534a4d;box-shadow:0 9px 24px rgba(70,55,60,.07); }.shop-cart-button span { position:absolute;right:-2px;top:-2px;display:grid;place-items:center;min-width:17px;height:17px;padding:0 4px;border-radius:999px;background:#524649;color:#fff;font-size:7px;font-weight:900; }
.shop-content { height:calc(var(--app-height) - 68px);padding:8px 15px 38px;overflow-y:auto;overscroll-behavior:contain; }
.shop-hero { display:grid;grid-template-columns:minmax(0,1fr) 105px;align-items:center;min-height:135px;padding:19px;overflow:hidden;border-radius:29px;background:linear-gradient(145deg,#e9dadd,#e3e6dc);box-shadow:0 20px 44px rgba(63,52,54,.11); }.shop-hero-copy { display:grid;gap:6px; }.shop-hero-copy small { color:#977980;font-size:8px;font-weight:900;letter-spacing:.14em; }.shop-hero-copy strong { color:#4a3e41;font-family:Georgia,serif;font-size:22px;font-weight:500; }.shop-hero-copy em { color:#86787b;font-size:8px;font-style:normal; }.shop-hero-art { position:relative;display:grid;place-items:center;height:96px; }.shop-hero-art span { position:relative;z-index:2;font-size:50px;transform:rotate(6deg);filter:drop-shadow(0 12px 14px rgba(77,55,62,.15)); }.shop-hero-art i { position:absolute;width:92px;height:92px;border:1px solid rgba(255,255,255,.55);border-radius:50%;box-shadow:0 0 0 16px rgba(255,255,255,.13); }
.relationship-commerce-card { display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:11px;margin-top:12px;padding:12px;border:1px solid rgba(116,92,99,.1);border-radius:22px;background:rgba(255,255,255,.74);box-shadow:0 13px 30px rgba(70,56,61,.06); }.relationship-commerce-card img { width:48px;height:48px;border-radius:17px;background:#eee7e4;object-fit:cover; }.relationship-commerce-card > span { display:grid;gap:3px;min-width:0; }.relationship-commerce-card > span:last-child { justify-items:end; }.relationship-commerce-card small { color:#9d858d;font-size:7px;font-weight:900;letter-spacing:.08em; }.relationship-commerce-card strong { overflow:hidden;color:#4d4346;font-size:10px;text-overflow:ellipsis;white-space:nowrap; }.relationship-commerce-card em { overflow:hidden;color:#96898d;font-size:7px;font-style:normal;text-overflow:ellipsis;white-space:nowrap; }.relationship-commerce-card > span:last-child strong { color:#607267;font-family:Georgia,serif;font-size:12px; }
.shop-search { display:grid;grid-template-columns:18px minmax(0,1fr) 18px;align-items:center;gap:7px;height:42px;margin:13px 0 10px;padding:0 12px;border-radius:16px;background:rgba(255,255,255,.78);color:#9b8e91;box-shadow:0 10px 25px rgba(68,56,60,.055); }.shop-search input { min-width:0;border:0;outline:0;background:transparent;color:#4b4446;font-size:10px; }.shop-search input::placeholder { color:#aaa0a2; }
.shop-categories { display:grid;grid-auto-columns:59px;grid-auto-flow:column;gap:7px;margin:0 -15px;padding:2px 15px 8px;overflow-x:auto; }.shop-categories button { display:grid;justify-items:center;gap:5px;padding:8px 3px;border-radius:17px;color:#8d8184; }.shop-categories button span { display:grid;place-items:center;width:37px;height:37px;border-radius:14px;background:rgba(255,255,255,.7);font-size:18px;box-shadow:0 8px 18px rgba(67,57,60,.05); }.shop-categories button small { font-size:8px;font-weight:800; }.shop-categories button.active { background:rgba(255,255,255,.62);color:#53494c; }.shop-categories button.active span { background:#4e4648;color:#fff; }
.highlight-order { display:grid;grid-template-columns:46px minmax(0,1fr) auto;align-items:center;gap:10px;margin:8px 0 4px;padding:11px;border:1px solid rgba(132,103,111,.12);border-radius:20px;background:rgba(255,255,255,.74);box-shadow:0 13px 30px rgba(75,59,64,.07); }.highlight-order-mark { display:grid;place-items:center;width:46px;height:46px;border-radius:16px;background:#f0e1df;font-size:22px; }.highlight-order > span:nth-child(2),.highlight-order > span:last-child { display:grid;gap:3px;min-width:0; }.highlight-order small { color:#9b878d;font-size:7px; }.highlight-order strong { overflow:hidden;color:#4a4144;font-size:10px;text-overflow:ellipsis;white-space:nowrap; }.highlight-order em { overflow:hidden;color:#95898c;font-size:8px;font-style:normal;text-overflow:ellipsis;white-space:nowrap; }.highlight-order > span:last-child { justify-items:end; }
.shop-section { margin-top:17px; }.shop-section-title { display:flex;align-items:end;justify-content:space-between;margin-bottom:10px;padding:0 3px; }.shop-section-title > div { display:grid;gap:3px; }.shop-section-title h2 { margin:0;color:#3e3739;font-size:15px;font-weight:900; }.shop-section-title > span,.shop-section-title > button { color:#9b8f92;font-size:8px;font-weight:800; }
.shopping-companions { display:grid;grid-auto-columns:minmax(205px,68vw);grid-auto-flow:column;gap:9px;margin:0 -15px;padding:0 15px 5px;overflow-x:auto;scroll-snap-type:x mandatory; }
.shopping-companions button { scroll-snap-align:start;display:grid;grid-template-columns:42px minmax(0,1fr) 18px;align-items:center;gap:9px;padding:10px;border-radius:19px;background:rgba(255,255,255,.72);color:#65595d;text-align:left;box-shadow:0 12px 29px rgba(67,54,58,.055); }
.shopping-companions img { width:42px;height:42px;border-radius:15px;background:#eee6e3;object-fit:cover; }.shopping-companions span { display:grid;gap:4px;min-width:0; }.shopping-companions strong { overflow:hidden;color:#51474a;font-size:10px;text-overflow:ellipsis;white-space:nowrap; }.shopping-companions small { color:#998d90;font-size:7px; }
.storefront-list { display:grid;grid-auto-columns:minmax(235px,76vw);grid-auto-flow:column;gap:10px;margin:0 -15px;padding:0 15px 5px;overflow-x:auto;scroll-snap-type:x mandatory; }.storefront-list--vertical { grid-auto-flow:row;grid-auto-columns:unset;margin:0;padding:0;overflow:visible; }.storefront-card { scroll-snap-align:start;display:grid;grid-template-columns:59px minmax(0,1fr);align-items:center;gap:12px;min-height:112px;padding:14px;border-radius:25px;color:#504648;box-shadow:0 14px 32px rgba(72,58,63,.08),inset 0 0 0 1px rgba(255,255,255,.38); }.storefront-mark { display:grid;place-items:center;width:59px;height:59px;border-radius:21px;background:rgba(255,255,255,.48);font-size:29px; }.storefront-copy { display:grid;gap:4px;min-width:0; }.storefront-copy > small { overflow:hidden;color:#927d83;font-size:7px;font-weight:900;letter-spacing:.06em;text-overflow:ellipsis;white-space:nowrap; }.storefront-copy strong { overflow:hidden;font-family:Georgia,serif;font-size:14px;font-weight:600;text-overflow:ellipsis;white-space:nowrap; }.storefront-copy em { display:-webkit-box;color:#897c7f;font-size:8px;font-style:normal;line-height:1.35;-webkit-box-orient:vertical;-webkit-line-clamp:2; }.storefront-copy span { color:#786b6e;font-size:7px;font-weight:800; }
.storefront-card { width:100%;border:0;text-align:left; }
.selected-store-banner { display:grid;grid-template-columns:67px minmax(0,1fr);align-items:center;gap:14px;margin-top:15px;padding:15px;border-radius:25px;color:#51474a;box-shadow:0 15px 34px rgba(70,56,61,.08),inset 0 0 0 1px rgba(255,255,255,.4); }
.selected-store-banner > span { display:grid;place-items:center;width:67px;height:67px;border-radius:23px;background:rgba(255,255,255,.46);font-size:32px; }.selected-store-banner div { display:grid;gap:4px;min-width:0; }.selected-store-banner small { overflow:hidden;color:#8f7b81;font-size:7px;font-weight:900;letter-spacing:.06em;text-overflow:ellipsis;white-space:nowrap; }.selected-store-banner h2,.selected-store-banner p { margin:0; }.selected-store-banner h2 { font-family:Georgia,serif;font-size:17px;font-weight:600; }.selected-store-banner p { color:#897c7f;font-size:8px;line-height:1.4; }.selected-store-banner em { color:#77696d;font-size:7px;font-style:normal;font-weight:800; }
.product-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px; }.product-grid :deep(.product-card) { display:grid;align-content:start;min-width:0;overflow:hidden;border-radius:23px;background:rgba(255,255,255,.74);box-shadow:0 14px 31px rgba(66,55,58,.07); }.product-grid :deep(.product-visual) { position:relative;display:grid;place-items:center;aspect-ratio:1/.84;border-radius:23px 23px 16px 16px; }.product-grid :deep(.product-visual > span) { font-size:40px;filter:drop-shadow(0 10px 10px rgba(71,55,60,.13)); }.product-grid :deep(.product-visual button) { position:absolute;right:8px;top:8px;display:grid;place-items:center;width:29px;height:29px;border-radius:11px;background:rgba(255,255,255,.7);color:#88767b; }.product-grid :deep(.product-visual button.active) { background:#fff;color:#ad6f80; }.product-grid :deep(.product-copy) { display:grid;gap:4px;padding:10px 10px 5px; }.product-grid :deep(.product-copy > small) { overflow:hidden;color:#9c8c91;font-size:7px;font-weight:800;text-overflow:ellipsis;white-space:nowrap; }.product-grid :deep(.product-copy > strong) { overflow:hidden;color:#4b4245;font-size:10px;text-overflow:ellipsis;white-space:nowrap; }.product-grid :deep(.product-copy > em) { display:-webkit-box;min-height:22px;color:#978b8e;font-size:7px;font-style:normal;line-height:1.45;-webkit-box-orient:vertical;-webkit-line-clamp:2; }.product-grid :deep(.product-copy > span) { display:flex;gap:4px;overflow:hidden; }.product-grid :deep(.product-copy i) { flex:0 0 auto;padding:2px 4px;border-radius:999px;background:#f2ece9;color:#917d83;font-size:6px;font-style:normal; }.product-grid :deep(.product-price) { display:flex;align-items:center;justify-content:space-between;padding:4px 10px 11px; }.product-grid :deep(.product-price strong) { color:#584b4f;font-family:Georgia,serif;font-size:12px; }.product-grid :deep(.product-price button) { display:grid;place-items:center;width:25px;height:25px;border-radius:9px;background:#51474a;color:#fff;font-size:16px;line-height:1; }
.shop-moment-list { display:grid;gap:10px; }.shop-moment-card { display:grid;grid-template-columns:39px minmax(0,1fr);gap:10px;padding:13px;border-radius:23px;background:rgba(255,255,255,.74);box-shadow:0 13px 31px rgba(65,53,57,.06); }.moment-avatar { display:grid;place-items:center;width:39px;height:39px;border-radius:15px;background:#e8dce0;color:#765f66;font-family:Georgia,serif;font-size:16px;font-weight:700; }.moment-main { display:grid;gap:9px;min-width:0; }.moment-meta { display:flex;justify-content:space-between; }.moment-meta strong { color:#4a4144;font-size:10px; }.moment-meta small { color:#a3989a;font-size:7px; }.moment-main p { margin:0;color:#62585b;font-size:9px;line-height:1.6; }.moment-product { display:grid;grid-template-columns:52px minmax(0,1fr);align-items:center;gap:10px;min-height:59px;padding:6px;border-radius:17px; }.moment-product i { display:grid;place-items:center;width:47px;height:47px;border-radius:14px;background:rgba(255,255,255,.45);font-size:24px;font-style:normal; }.moment-product > span { display:grid;gap:4px;min-width:0; }.moment-product strong { overflow:hidden;color:#554a4d;font-size:9px;text-overflow:ellipsis;white-space:nowrap; }.moment-product small { color:#8b7d80;font-size:7px; }.moment-actions { display:flex;align-items:center;gap:15px;color:#968b8e; }.moment-actions button,.moment-actions > span { display:inline-flex;align-items:center;gap:3px;color:inherit;font-size:7px;font-weight:800; }.moment-actions button.active { color:#a86d7d; }.moment-actions em { font-style:normal;font-weight:900; }
.shop-orders { display:grid;gap:9px; }.shop-order-card { display:grid;gap:9px;padding:13px;border:1px solid transparent;border-radius:21px;background:rgba(255,255,255,.72);box-shadow:0 12px 29px rgba(66,54,58,.055); }.shop-order-card.highlighted { border-color:rgba(141,103,115,.3);box-shadow:0 15px 35px rgba(91,63,72,.11); }.shop-order-head { display:flex;justify-content:space-between; }.shop-order-head strong { color:#504649;font-size:10px; }.shop-order-head small { color:#718a78;font-size:7px;font-weight:900; }.shop-order-body { display:grid;grid-template-columns:43px minmax(0,1fr) auto;align-items:center;gap:9px; }.shop-order-body > i { display:grid;place-items:center;width:43px;height:43px;border-radius:15px;background:#eee3de;font-size:21px;font-style:normal; }.shop-order-body > span { display:grid;gap:4px;min-width:0; }.shop-order-body strong { display:-webkit-box;color:#5a5053;font-size:9px;line-height:1.35;-webkit-box-orient:vertical;-webkit-line-clamp:2; }.shop-order-body small { color:#9a8e91;font-size:7px; }.shop-order-body em { color:#594d51;font-family:Georgia,serif;font-size:10px;font-style:normal;font-weight:700; }.shop-order-card p { margin:0;padding:7px 9px;border-radius:12px;background:#f4efed;color:#8e7d82;font-family:Georgia,serif;font-size:8px;line-height:1.5; }
.order-chat-link { display:inline-flex;align-items:center;justify-content:flex-end;gap:3px;color:#806b72;font-size:8px;font-weight:900; }
.shop-empty { display:grid;justify-items:center;gap:7px;padding:39px 20px;border:1px dashed rgba(100,78,85,.18);border-radius:25px;background:rgba(255,255,255,.35);color:#988a8e;text-align:center; }.shop-empty strong { color:#665b5e;font-size:11px; }.shop-empty small { font-size:8px; }
.relationship-economy-card { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:14px;border-radius:25px;background:linear-gradient(145deg,#353536,#5b5553);color:#fff;box-shadow:0 18px 38px rgba(51,43,42,.18); }.relationship-economy-card > span { display:grid;gap:5px;min-width:0;padding:10px;border-radius:16px;background:rgba(255,255,255,.07); }.relationship-economy-card small { color:rgba(255,255,255,.56);font-size:7px; }.relationship-economy-card strong { overflow:hidden;font-family:Georgia,serif;font-size:13px;font-weight:500;text-overflow:ellipsis;white-space:nowrap; }.relationship-economy-card p { grid-column:1/-1;margin:0;padding:2px 4px;color:rgba(255,255,255,.68);font-size:8px;line-height:1.55; }.relationship-ledger-title { margin-top:18px; }.relationship-ledger { display:grid;gap:1px;overflow:hidden;border-radius:21px;background:rgba(255,255,255,.7); }.relationship-ledger article { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 13px;border-bottom:1px solid rgba(80,66,70,.06); }.relationship-ledger article:last-child { border-bottom:0; }.relationship-ledger article > span { display:grid;gap:4px;min-width:0; }.relationship-ledger strong { overflow:hidden;color:#51474a;font-size:9px;text-overflow:ellipsis;white-space:nowrap; }.relationship-ledger small { overflow:hidden;color:#9a8d91;font-size:7px;text-overflow:ellipsis;white-space:nowrap; }.relationship-ledger em { flex:0 0 auto;color:#8b626b;font-size:9px;font-style:normal;font-weight:900; }.relationship-ledger em.income { color:#62806c; }
.relationship-gifts { display:grid;gap:9px; }.relationship-gifts article { display:grid;grid-template-columns:48px minmax(0,1fr) 24px;align-items:center;gap:10px;padding:11px;border-radius:20px;background:rgba(255,255,255,.73);box-shadow:0 12px 29px rgba(66,54,58,.055); }.relationship-gift-mark { display:grid;place-items:center;width:48px;height:48px;border-radius:16px;background:linear-gradient(145deg,#eedde1,#eee6d9);font-size:23px; }.relationship-gifts article > span:nth-child(2) { display:grid;gap:4px;min-width:0; }.relationship-gifts small { color:#a1848d;font-size:7px;font-weight:900; }.relationship-gifts strong,.relationship-gifts em { overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }.relationship-gifts strong { color:#51474a;font-size:9px; }.relationship-gifts em { color:#927f85;font-family:Georgia,serif;font-size:8px;font-style:normal; }.relationship-gifts button { display:grid;place-items:center;width:24px;height:24px;border-radius:9px;background:#f1e9e7;color:#7e6a70; }.shop-empty--compact { padding:25px 18px; }
.shop-toast { position:absolute;left:50%;bottom:24px;z-index:80;margin:0;padding:9px 14px;border-radius:999px;background:rgba(52,46,48,.92);color:#fff;font-size:9px;font-weight:800;transform:translateX(-50%);box-shadow:0 12px 28px rgba(34,27,29,.22);white-space:nowrap; }.toast-enter-active,.toast-leave-active { transition:.2s ease; }.toast-enter-from,.toast-leave-to { opacity:0;transform:translate(-50%,8px); }
.cart-layer { position:absolute;inset:0;z-index:70;display:grid;align-items:end;background:rgba(43,35,38,.24);backdrop-filter:blur(7px); }.cart-sheet { display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;max-height:78%;padding:8px 15px calc(16px + var(--safe-bottom));border-radius:30px 30px 0 0;background:#faf7f4;box-shadow:0 -20px 50px rgba(43,34,37,.17); }.cart-sheet-handle { width:38px;height:4px;margin:0 auto 8px;border-radius:999px;background:#d6ccce; }.cart-sheet header { display:flex;align-items:center;justify-content:space-between;padding:4px 2px 12px; }.cart-sheet header div { display:grid;gap:3px; }.cart-sheet h2 { margin:0;color:#423a3d;font-size:17px; }.cart-sheet header button { display:grid;place-items:center;width:34px;height:34px;border-radius:13px;background:#eee8e5;color:#665b5e; }.cart-items { display:grid;align-content:start;gap:8px;overflow-y:auto; }.cart-items article { display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:9px;padding:8px;border-radius:18px;background:#fff; }.cart-item-mark { display:grid;place-items:center;width:48px;height:48px;border-radius:15px;font-size:23px; }.cart-items article > span:nth-child(2) { display:grid;gap:4px;min-width:0; }.cart-items strong { overflow:hidden;color:#554a4e;font-size:9px;text-overflow:ellipsis;white-space:nowrap; }.cart-items small { color:#9b8f92;font-size:7px; }.cart-quantity { display:grid;grid-template-columns:23px 20px 23px;align-items:center; }.cart-quantity button { display:grid;place-items:center;width:23px;height:23px;border-radius:8px;background:#f0ebe8;color:#665a5e; }.cart-quantity em { text-align:center;color:#5b5053;font-size:9px;font-style:normal;font-weight:900; }.cart-empty { display:grid;align-content:center;justify-items:center;gap:7px;min-height:220px;color:#998d90;text-align:center; }.cart-empty strong { color:#62575b;font-size:11px; }.cart-empty small { font-size:8px; }.cart-sheet footer { display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:13px; }.cart-sheet footer > span { display:grid;gap:2px; }.cart-sheet footer small { color:#998d90;font-size:7px; }.cart-sheet footer strong { color:#4d4246;font-family:Georgia,serif;font-size:18px; }.cart-sheet footer > button { min-width:137px;height:43px;border-radius:15px;background:#504649;color:#fff;font-size:10px;font-weight:900;box-shadow:0 12px 24px rgba(74,56,62,.18); }.cart-sheet footer > button:disabled { opacity:.45; }.sheet-enter-active,.sheet-leave-active { transition:.24s ease; }.sheet-enter-from,.sheet-leave-to { opacity:0; }.sheet-enter-from .cart-sheet,.sheet-leave-to .cart-sheet { transform:translateY(26px); }
.ai-restock-card { display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:9px;margin-top:7px;padding:11px;border:1px solid rgba(132,103,111,.11);border-radius:21px;background:rgba(255,255,255,.7);box-shadow:0 13px 29px rgba(70,56,61,.06); }
.ai-restock-icon { display:grid;place-items:center;width:42px;height:42px;border-radius:15px;background:linear-gradient(145deg,#eadbe2,#e1e8df);color:#826c74; }
.ai-restock-copy { display:grid;gap:3px;min-width:0; }
.ai-restock-copy small { color:#a1838c;font-size:7px;font-weight:900;letter-spacing:.12em; }
.ai-restock-copy strong { color:#51464a;font-size:10px; }
.ai-restock-copy em { overflow:hidden;color:#97898d;font-size:7px;font-style:normal;text-overflow:ellipsis;white-space:nowrap; }
.ai-restock-card label { grid-column:2; }
.ai-restock-card select { width:100%;height:29px;padding:0 8px;border:0;border-radius:10px;outline:0;background:#f2edeb;color:#675a5e;font-size:8px;font-weight:800; }
.ai-restock-card > button { grid-column:3;grid-row:1 / span 2;display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:76px;height:35px;padding:0 9px;border-radius:12px;background:#54484c;color:#fff;font-size:8px;font-weight:900; }
.ai-restock-card--relationship > button { grid-row:1; }
.ai-restock-card > button:disabled { opacity:.55; }
.product-grid :deep(.product-visual) { overflow:hidden; }
.product-grid :deep(.product-photo) { width:100%;height:100%;object-fit:cover; }
.product-grid :deep(.product-visual button) { box-shadow:0 5px 12px rgba(69,53,58,.08); }
.product-grid :deep(.product-visual button.product-image-action) { right:auto;left:8px; }
.product-grid :deep(.product-visual button:disabled) { opacity:.65; }
.product-grid :deep(.product-card.highlighted),.shop-moment-card.highlighted { outline:2px solid rgba(151,103,119,.42);box-shadow:0 17px 38px rgba(90,57,69,.15); }
.product-grid :deep(.product-card-actions) { display:flex;align-items:center;gap:5px; }
.product-grid :deep(.product-price button.share-action) { background:#eee7e5;color:#806c73; }
.selected-store-banner button { display:inline-flex;align-items:center;justify-content:center;gap:5px;width:max-content;margin-top:3px;padding:6px 9px;border-radius:10px;background:rgba(255,255,255,.55);color:#725f66;font-size:7px;font-weight:900; }
.moment-product > img { display:block;width:47px;height:47px;border-radius:14px;object-fit:cover; }
.shopping-companions button:disabled { opacity:.62; }
.cart-items article > span:nth-child(2) > em { overflow:hidden;color:#8d7a80;font-size:7px;font-style:normal;line-height:1.35;text-overflow:ellipsis;white-space:nowrap; }
.spin { animation:shop-spin .8s linear infinite; }
@keyframes shop-spin { to { transform:rotate(360deg); } }
</style>