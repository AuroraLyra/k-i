import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { App as CapacitorApp } from '@capacitor/app';
import App from './App.vue';
import { router } from './router';
import { syncAppViewportHeight } from './app/viewport';
import { subscribeLinkNotificationClicks, type LinkNotificationEventPayload } from './services/keepAlive';
import { installIosNativeNotificationActions } from './services/nativeNotifications';
import { installRingtoneAudioUnlock } from './services/ringtone';
import { ensureAccessOnStartup } from './services/access';
import { installStartupCachePersistence, markStartupCacheHydrated, persistStartupCache, restoreStartupCache, restoreStartupSettingsFromDb } from './services/startupCache';
import { useAppStore } from './stores/appStore';
import { requestPersistentStorage, setupPwaInstallPrompt } from './utils/storageProtection';
import { installNativeSystemBars } from './services/systemBars';
import './styles/main.css';

let activeStore: ReturnType<typeof useAppStore> | null = null;
const pendingNotificationClicks: LinkNotificationEventPayload[] = [];

function navigateNotificationUrl(url: string) {
	try {
		const target = new URL(url, window.location.origin);
		if (target.origin !== window.location.origin) return;
		void router.push(`${target.pathname}${target.search}${target.hash}`);
	} catch {
		return;
	}
}

function clearLaunchCallAction() {
	const target = new URL(window.location.href);
	for (const key of ['linkCallAction', 'linkConversationId', 'linkCallId', 'linkCallMode']) target.searchParams.delete(key);
	window.history.replaceState(window.history.state, '', `${target.pathname}${target.search}${target.hash}`);
}

async function handleNotificationClick(payload: LinkNotificationEventPayload) {
	if (payload.kind !== 'call' || payload.action === 'open') {
		navigateNotificationUrl(payload.url);
		return;
	}
	if (!payload.conversationId || !payload.callId) return;
	if (!activeStore) {
		pendingNotificationClicks.push(payload);
		return;
	}
	await activeStore.hydrate();
	const handled = await activeStore.respondToIncomingCall(payload.conversationId, payload.callId, payload.action);
	clearLaunchCallAction();
	if (handled && payload.action === 'accepted') navigateNotificationUrl(payload.url);
}

function readLaunchCallAction(): LinkNotificationEventPayload | null {
	const target = new URL(window.location.href);
	const action = target.searchParams.get('linkCallAction');
	const conversationId = target.searchParams.get('linkConversationId')?.trim() || '';
	const callId = target.searchParams.get('linkCallId')?.trim() || '';
	if (!['accepted', 'rejected'].includes(action || '') || !conversationId || !callId) return null;
	return {
		kind: 'call',
		action: action as 'accepted' | 'rejected',
		title: '',
		body: '',
		tag: `link-call-${callId}`,
		url: `${target.origin}/chats/${encodeURIComponent(conversationId)}`,
		conversationId,
		callId,
		callMode: target.searchParams.get('linkCallMode') === 'video' ? 'video' : 'voice'
	};
}

subscribeLinkNotificationClicks((payload) => void handleNotificationClick(payload));
void installIosNativeNotificationActions((payload) => void handleNotificationClick(payload));

const launchCallAction = readLaunchCallAction();
if (launchCallAction) void handleNotificationClick(launchCallAction);

void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
	navigateNotificationUrl(url);
});

installNativeSystemBars();
syncAppViewportHeight();
installRingtoneAudioUnlock();
setupPwaInstallPrompt();

if ('serviceWorker' in navigator) {
	let reloadingForServiceWorker = false;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (reloadingForServiceWorker) return;
		reloadingForServiceWorker = true;
		window.location.reload();
	});
}

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
	navigator.serviceWorker.getRegistrations()
		.then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
		.catch(() => undefined);
}

async function bootstrap() {
	if (!await ensureAccessOnStartup()) return;
	const app = createApp(App);
	const pinia = createPinia();

	app.use(pinia).use(router);

	const store = useAppStore(pinia);
	activeStore = store;
	restoreStartupCache(store);
	await restoreStartupSettingsFromDb(store);
	try {
		app.mount('#app');
	} catch (error) {
		console.error('Link mount failed.', error);
		return;
	}
	if (pendingNotificationClicks.length) {
		const queuedClicks = pendingNotificationClicks.splice(0);
		queuedClicks.forEach((payload) => void handleNotificationClick(payload));
	}

	void store.hydrate()
		.then(() => {
			markStartupCacheHydrated();
			persistStartupCache(store);
			installStartupCachePersistence(store);
			return requestPersistentStorage();
		})
		.catch((error) => console.error('Link background hydration failed.', error));
}

void bootstrap();