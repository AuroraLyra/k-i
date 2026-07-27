import { createRouter, createWebHistory } from 'vue-router';

const HomePage = () => import('@/pages/HomePage.vue');
const ChatSettingsPage = () => import('@/pages/ChatSettingsPage.vue');
const ChatSearchPage = () => import('@/pages/ChatSearchPage.vue');
const ChatRoomPage = () => import('@/pages/ChatRoomPage.vue');
const GobangRoomPage = () => import('@/pages/GobangRoomPage.vue');
const CoupleSpacePage = () => import('@/pages/CoupleSpacePage.vue');
const GroupChatPage = () => import('@/pages/GroupChatPage.vue');
const ProfileThemePage = () => import('@/pages/ProfileThemePage.vue');
const SmallTheaterPage = () => import('@/pages/SmallTheaterPage.vue');
const SmallTheaterDetailPage = () => import('@/pages/SmallTheaterDetailPage.vue');
const OfflineSettingsPage = () => import('@/pages/OfflineSettingsPage.vue');
const OfflineRoomPage = () => import('@/pages/OfflineRoomPage.vue');
const VoomPage = () => import('@/pages/VoomPage.vue');
const MusicPage = () => import('@/pages/MusicPage.vue');
const FanficPage = () => import('@/pages/FanficPage.vue');
const FanficCreatePage = () => import('@/pages/FanficCreatePage.vue');
const FanficBookPage = () => import('@/pages/FanficBookPage.vue');
const FanficReaderPage = () => import('@/pages/FanficReaderPage.vue');
const WalletPage = () => import('@/pages/WalletPage.vue');
const ShopPage = () => import('@/pages/ShopPage.vue');
const ProfilePage = () => import('@/pages/ProfilePage.vue');
const AddFriendPage = () => import('@/pages/AddFriendPage.vue');
const ServicesPage = () => import('@/pages/ServicesPlaceholderPage.vue');
const ServicesUtilityPage = () => import('@/pages/ServicesUtilityPage.vue');
const CloudBackupOAuthCallbackPage = () => import('@/pages/CloudBackupOAuthCallbackPage.vue');
const ImageModuleSettingsPage = () => import('@/pages/settings/ImageModuleSettingsPage.vue');
const SettingsPage = () => import('@/pages/settings/SettingsPage.vue');
const StickersPage = () => import('@/pages/StickersPage.vue');
const StickerManagePage = () => import('@/pages/StickerManagePage.vue');
const WorldBookPage = () => import('@/pages/WorldBookPage.vue');
const WorldBookEditorPage = () => import('@/pages/WorldBookEditorPage.vue');
const FavoritesPage = () => import('@/pages/FavoritesPage.vue');
const RingtoneSettingsPage = () => import('@/pages/RingtoneSettingsPage.vue');
const ThemesPage = () => import('@/pages/ThemesPage.vue');

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/home', name: 'home', component: HomePage },
    { path: '/profile', redirect: '/account' },
    { path: '/account', name: 'account', component: ProfilePage },
    { path: '/friends/add', name: 'add-friend', component: AddFriendPage },
    { path: '/services', name: 'services', component: ServicesPage },
    { path: '/services/keep-alive', name: 'service-keepalive', component: RingtoneSettingsPage },
    { path: '/services/update', name: 'service-update', component: RingtoneSettingsPage },
    { path: '/services/backup', name: 'service-backup', component: ServicesUtilityPage, props: { mode: 'backup' } },
    { path: '/services/backup/oauth/callback', name: 'cloud-backup-oauth-callback', component: CloudBackupOAuthCallbackPage },
    { path: '/services/qq-access', name: 'service-access', component: ServicesUtilityPage, props: { mode: 'access' } },
    { path: '/services/data', name: 'service-data', component: ServicesUtilityPage, props: { mode: 'data' } },
    { path: '/stickers', name: 'stickers', component: StickersPage },
    { path: '/favorites', name: 'favorites', component: FavoritesPage },
    { path: '/ringtones', name: 'ringtones', component: RingtoneSettingsPage },
    { path: '/themes', name: 'themes', component: ThemesPage },
    { path: '/stickers/manage', name: 'stickers-manage', component: StickerManagePage },
    { path: '/world-book', name: 'world-book', component: WorldBookPage },
    { path: '/world-book/new', name: 'world-book-new', component: WorldBookEditorPage },
    { path: '/world-book/:id/edit', name: 'world-book-edit', component: WorldBookEditorPage },
    { path: '/world-book/:id/delete', redirect: (to) => ({ name: 'world-book-edit', params: { id: String(to.params.id) } }) },
    { path: '/settings', name: 'settings', component: SettingsPage },
    { path: '/settings/image/:module', name: 'image-module-settings', component: ImageModuleSettingsPage },
    { path: '/chats', redirect: '/home' },
    { path: '/chats/:id/search', name: 'chat-search', component: ChatSearchPage, props: true },
    { path: '/chats/:id/settings', name: 'chat-settings', component: ChatSettingsPage, props: true },
    { path: '/chats/:id/profile-themes', name: 'profile-themes', component: ProfileThemePage, props: true },
    { path: '/chats/:id/couple-space', name: 'couple-space', component: CoupleSpacePage, props: true },
    { path: '/chats/:id/theaters', name: 'small-theater', component: SmallTheaterPage, props: true },
    { path: '/chats/:id/gobang/:messageId', name: 'gobang-room', component: GobangRoomPage, props: true },
    { path: '/theaters/:theaterId', name: 'small-theater-detail', component: SmallTheaterDetailPage, props: true },
    { path: '/chats/:id', name: 'chat-room', component: ChatRoomPage, props: true },
    { path: '/groups/:id', name: 'group-chat', component: GroupChatPage, props: true },
    { path: '/offline/:id/settings', name: 'offline-chat-settings', component: OfflineSettingsPage, props: true },
    { path: '/offline/:id', name: 'offline-room', component: OfflineRoomPage, props: true },
    { path: '/voom', name: 'voom', component: VoomPage },
    { path: '/music', name: 'music', component: MusicPage },
    { path: '/fanfic', name: 'fanfic', component: FanficPage },
    { path: '/fanfic/create', name: 'fanfic-create', component: FanficCreatePage },
    { path: '/fanfic/books/:bookId', name: 'fanfic-book', component: FanficBookPage, props: true },
    { path: '/fanfic/books/:bookId/chapters/:chapterId', name: 'fanfic-reader', component: FanficReaderPage, props: true }
    ,{ path: '/wallet', name: 'wallet', component: WalletPage }
    ,{ path: '/wallet/shop', name: 'wallet-shop', component: ShopPage }
  ],
  scrollBehavior() {
    return { top: 0 };
  }
});