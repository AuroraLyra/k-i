<template>
  <section class="screen no-tabs wallet-page">
    <header class="wallet-header">
      <div>
        <small>MY PRIVATE LIFE</small>
        <h1>Wallet</h1>
      </div>
      <button type="button" aria-label="进入商城" @click="openShop">
        <ShoppingBag :size="20" />
      </button>
    </header>

    <main class="wallet-content">
      <section class="wallet-card">
        <div class="wallet-card-top">
          <span>LINK WALLET</span>
          <button type="button" :aria-label="showBalance ? '隐藏余额' : '显示余额'" @click="showBalance = !showBalance">
            <EyeOff v-if="showBalance" :size="17" />
            <Eye v-else :size="17" />
          </button>
        </div>
        <div class="wallet-balance">
          <small>Available balance</small>
          <strong>{{ showBalance ? formatMoney(userWallet?.balanceCents ?? 0) : '••••••' }}</strong>
        </div>
        <div class="wallet-card-bottom">
          <span>{{ appStore.user?.nickname || appStore.user?.name || 'LINK USER' }}</span>
          <em>•• {{ String(appStore.user?.id || '0000').slice(-4) }}</em>
        </div>
      </section>

      <section class="wallet-shortcuts" aria-label="Wallet 快捷入口">
        <button type="button" @click="openShop">
          <span class="shortcut-icon tone-rose"><Store :size="20" /></span>
          <strong>Shop</strong>
          <small>逛商城</small>
        </button>
        <button type="button" @click="openShopSection('wishlist')">
          <span class="shortcut-icon tone-cream"><Heart :size="20" /></span>
          <strong>Wishlist</strong>
          <small>{{ userWishlist.length }} 件心愿</small>
        </button>
        <button type="button" @click="openShopSection('orders')">
          <span class="shortcut-icon tone-sage"><ReceiptText :size="20" /></span>
          <strong>Orders</strong>
          <small>{{ userOrders.length }} 笔订单</small>
        </button>
        <button type="button" @click="openShopSection('gift')">
          <span class="shortcut-icon tone-lilac"><Gift :size="20" /></span>
          <strong>Gifts</strong>
          <small>礼物与卡片</small>
        </button>
      </section>

      <button class="couple-shopping-card" type="button" @click="openShopSection('cart')">
        <span class="couple-shopping-mark" aria-hidden="true">
          <ShoppingBasket :size="25" />
        </span>
        <span class="couple-shopping-copy">
          <small>MY SHOPPING BAG</small>
          <strong>我的全局购物</strong>
          <em>不混入角色关系购物车与愿望单</em>
        </span>
        <span class="couple-shopping-count">{{ userCart.length }}</span>
        <ChevronRight :size="18" />
      </button>

      <section class="wallet-section wallet-activity">
        <div class="section-title">
          <div>
            <small>RECENT ACTIVITY</small>
            <h2>收支记录</h2>
          </div>
        </div>
        <article v-for="transaction in userTransactions.slice(0, 5)" :key="transaction.id" class="transaction-row">
          <span :class="['transaction-icon', transaction.amountCents >= 0 ? 'income' : 'expense']">
            <ArrowDownLeft v-if="transaction.amountCents >= 0" :size="17" />
            <ArrowUpRight v-else :size="17" />
          </span>
          <span>
            <strong>{{ transaction.title }}</strong>
            <small>{{ transaction.subtitle }} · {{ formatDate(transaction.createdAt) }}</small>
          </span>
          <em :class="{ income: transaction.amountCents >= 0 }">{{ transaction.amountCents >= 0 ? '+' : '-' }}{{ formatMoney(Math.abs(transaction.amountCents)) }}</em>
        </article>
      </section>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Eye, EyeOff, Gift, Heart, ReceiptText, ShoppingBag, ShoppingBasket, Store } from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';
import { useCommerceStore } from '@/stores/commerceStore';

const router = useRouter();
const appStore = useAppStore();
const commerceStore = useCommerceStore();
const showBalance = ref(true);

const activeUserId = computed(() => appStore.user?.id ?? '');
const userWallet = computed(() => commerceStore.walletForUser(activeUserId.value));
const userTransactions = computed(() => userWallet.value ? commerceStore.transactionsForWallet(userWallet.value.id) : []);
const userCart = computed(() => commerceStore.cartForUser(activeUserId.value));
const userWishlist = computed(() => commerceStore.wishlistForUser(activeUserId.value));
const userOrders = computed(() => commerceStore.recentOrders.filter((order) => order.userId === activeUserId.value && order.purchaserType === 'user' && !order.conversationId && !order.relationshipCharacterId));

function formatMoney(cents: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(cents / 100);
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(timestamp);
}

function openShop() {
  void router.push({ name: 'wallet-shop' });
}

function openShopSection(section: string) {
  void router.push({ name: 'wallet-shop', query: { section } });
}

onMounted(async () => {
  await appStore.hydrate();
  await commerceStore.ensureReady(appStore.users, appStore.characters);
});
</script>

<style scoped>
.wallet-page {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 0;
  background:
    radial-gradient(circle at 92% 0%, rgba(225, 211, 221, 0.62), transparent 28%),
    linear-gradient(180deg, #fbf8f5 0%, #f7f5f2 48%, #f0f4f1 100%);
}

.wallet-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: calc(68px + var(--safe-top));
  padding: calc(13px + var(--safe-top)) calc(18px + var(--safe-right)) 7px calc(18px + var(--safe-left));
}

.wallet-header div { display: grid; gap: 2px; }
.wallet-header small, .section-title small { color: #a28e93; font-size: 8px; font-weight: 900; letter-spacing: .16em; }
.wallet-header h1 { margin: 0; color: #2e292a; font-family: Georgia, serif; font-size: 27px; font-weight: 500; letter-spacing: -.03em; }
.wallet-header button { display: grid; place-items: center; width: 39px; height: 39px; border-radius: 15px; background: rgba(255,255,255,.76); color: #51494b; box-shadow: 0 10px 26px rgba(65,52,56,.08); }

.wallet-content {
  flex: 1;
  min-height: 0;
  height: auto;
  padding: 8px 15px calc(34px + var(--safe-bottom));
  overflow-y: auto;
  overscroll-behavior: contain;
}

.wallet-card { position: relative; display: grid; min-height: 188px; padding: 18px; overflow: hidden; border-radius: 29px; background: linear-gradient(145deg, #2f3030, #464241 62%, #68615d); color: #fff; box-shadow: 0 24px 50px rgba(44,39,38,.22); }
.wallet-card::before { position: absolute; width: 180px; height: 180px; right: -46px; top: -70px; border: 1px solid rgba(255,255,255,.11); border-radius: 50%; content: ''; box-shadow: 0 0 0 28px rgba(255,255,255,.025), 0 0 0 58px rgba(255,255,255,.018); }
.wallet-card-top, .wallet-card-bottom { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; }
.wallet-card-top span { font-size: 10px; font-weight: 900; letter-spacing: .17em; }
.wallet-card-top button { color: rgba(255,255,255,.72); }
.wallet-balance { position: relative; z-index: 1; align-self: center; display: grid; gap: 7px; }
.wallet-balance small { color: rgba(255,255,255,.6); font-size: 9px; font-weight: 700; }
.wallet-balance strong { font-family: Georgia, serif; font-size: 32px; font-weight: 500; letter-spacing: -.03em; }
.wallet-card-bottom { align-self: end; color: rgba(255,255,255,.72); font-size: 10px; font-weight: 800; letter-spacing: .08em; }
.wallet-card-bottom em { font-style: normal; }

.wallet-shortcuts { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px; margin: 15px 0; }
.wallet-shortcuts button { display: grid; justify-items: center; gap: 4px; min-width: 0; padding: 5px 0; color: #4a4345; }
.shortcut-icon { display: grid; place-items: center; width: 46px; height: 46px; margin-bottom: 2px; border-radius: 17px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.66); }
.tone-rose { background: #efe0e3; color: #8a646c; }.tone-cream { background: #eee6d8; color: #806e54; }.tone-sage { background: #dfe9e3; color: #5f7968; }.tone-lilac { background: #e7e0ed; color: #776681; }
.wallet-shortcuts strong { max-width: 100%; overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.wallet-shortcuts small { max-width: 100%; overflow: hidden; color: #9a9092; font-size: 7px; text-overflow: ellipsis; white-space: nowrap; }

.couple-shopping-card { display: grid; grid-template-columns: 48px minmax(0,1fr) auto 18px; align-items: center; gap: 11px; width: 100%; padding: 14px; border-radius: 23px; background: rgba(255,255,255,.72); color: #4b4547; text-align: left; box-shadow: 0 15px 34px rgba(69,57,61,.07), inset 0 0 0 1px rgba(255,255,255,.78); }
.couple-shopping-mark { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 18px; background: linear-gradient(145deg,#ead7dc,#e5e6dc); color: #765e66; }
.couple-shopping-copy { display: grid; gap: 3px; min-width: 0; }
.couple-shopping-copy small { color: #a68b94; font-size: 7px; font-weight: 900; letter-spacing: .13em; }
.couple-shopping-copy strong { font-size: 13px; font-weight: 900; }
.couple-shopping-copy em { overflow: hidden; color: #8f8588; font-size: 8px; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }
.couple-shopping-count { display: grid; place-items: center; min-width: 24px; height: 24px; padding: 0 7px; border-radius: 999px; background: #52494c; color: #fff; font-size: 9px; font-weight: 900; }

.wallet-section { margin-top: 21px; }
.section-title { display: flex; align-items: end; justify-content: space-between; margin-bottom: 10px; padding: 0 3px; }
.section-title div { display: grid; gap: 3px; }
.section-title h2 { margin: 0; color: #393335; font-size: 15px; font-weight: 900; }
.section-title > span, .section-title > button { color: #9b9092; font-size: 8px; font-weight: 800; }

.role-economy-list { display: grid; grid-auto-columns: minmax(245px, 78vw); grid-auto-flow: column; gap: 10px; margin: 0 -15px; padding: 0 15px 6px; overflow-x: auto; scroll-snap-type: x mandatory; }
.role-economy-card { scroll-snap-align: start; display: grid; gap: 11px; padding: 14px; border-radius: 24px; background: rgba(255,255,255,.76); box-shadow: 0 14px 34px rgba(59,52,52,.065), inset 0 0 0 1px rgba(255,255,255,.8); }
.role-economy-head { display: grid; grid-template-columns: 40px minmax(0,1fr) auto; align-items: center; gap: 9px; }
.role-economy-head img { width: 40px; height: 40px; border-radius: 15px; object-fit: cover; background: #eee7e4; }
.role-economy-head span { display: grid; gap: 3px; min-width: 0; }
.role-economy-head strong { overflow: hidden; color: #40393b; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.role-economy-head small { overflow: hidden; color: #978d8f; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
.role-economy-head em { color: #5f6f65; font-size: 11px; font-style: normal; font-weight: 900; }
.economy-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.economy-metrics span { display: grid; gap: 3px; padding: 9px 10px; border-radius: 15px; background: #f5f1ee; }
.economy-metrics small { color: #9b9092; font-size: 7px; }.economy-metrics strong { color: #514a4c; font-size: 11px; }
.saving-progress { height: 5px; overflow: hidden; border-radius: 999px; background: #ede8e5; }.saving-progress span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg,#a9bcae,#d7b7c1); }
.role-economy-card p { margin: -3px 0 0; color: #93898b; font-size: 8px; line-height: 1.4; }

.order-row { display: grid; grid-template-columns: 45px minmax(0,1fr) auto; align-items: center; gap: 10px; width: 100%; margin-bottom: 8px; padding: 10px; border-radius: 19px; background: rgba(255,255,255,.68); color: #494244; text-align: left; }
.order-mark { display: grid; place-items: center; width: 45px; height: 45px; border-radius: 16px; background: #f0e4df; font-size: 21px; }
.order-copy, .order-price { display: grid; gap: 4px; min-width: 0; }.order-copy strong { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.order-copy small { display: -webkit-box; color: #958b8d; font-size: 8px; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }.order-price { justify-items: end; }.order-price strong { font-size: 9px; }.order-price small { color: #769080; font-size: 7px; }

.wallet-activity { padding-bottom: 8px; }
.transaction-row { display: grid; grid-template-columns: 38px minmax(0,1fr) auto; align-items: center; gap: 10px; padding: 10px 4px; border-bottom: 1px solid rgba(83,69,74,.07); }
.transaction-icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 14px; background: #eee5e3; color: #8c666d; }.transaction-icon.income { background: #e1ebe5; color: #5f806b; }
.transaction-row > span:nth-child(2) { display: grid; gap: 3px; min-width: 0; }.transaction-row strong { overflow: hidden; color: #4c4547; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.transaction-row small { color: #9b9294; font-size: 8px; }.transaction-row em { color: #765b61; font-size: 10px; font-style: normal; font-weight: 900; }.transaction-row em.income { color: #60816c; }
</style>