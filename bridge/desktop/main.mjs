import { app, BrowserWindow, ipcMain, shell } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { gunzipSync } from 'node:zlib';

let mainWindow;
let dashboardWindow;
let bridgeProcess;
let tunnelProcess;
let runtimeState = { phase: 'stopped', message: '电脑助手尚未启动', publicUrl: '', dashboardUrl: '' };

function userPath(name) {
  return path.join(app.getPath('userData'), name);
}

function defaultConfig() {
  return {
    platform: 'qq',
    qqOneBotUrl: 'http://127.0.0.1:3000',
    xhsAdapterUrl: 'http://127.0.0.1:8790',
    douyinAdapterUrl: 'http://127.0.0.1:8791',
    tunnelMode: 'quick',
    publicUrl: '',
    allowedQqUsers: '',
    allowedQqGroups: '',
    allowedWriteTools: '',
    readsPerMinute: 120,
    writesPerMinute: 30,
    port: 8787
  };
}

function readConfig() {
  try {
    return { ...defaultConfig(), ...JSON.parse(fs.readFileSync(userPath('desktop-config.json'), 'utf8')) };
  } catch {
    return defaultConfig();
  }
}

function saveConfig(config) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(userPath('desktop-config.json'), JSON.stringify(config, null, 2), { mode: 0o600 });
}

function getToken() {
  const tokenPath = userPath('bridge-token');
  try {
    const existing = fs.readFileSync(tokenPath, 'utf8').trim();
    if (existing.length >= 32) return existing;
  } catch {
  }
  const token = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(tokenPath, token, { mode: 0o600 });
  return token;
}

function sendState(patch) {
  runtimeState = { ...runtimeState, ...patch };
  mainWindow?.webContents.send('bridge-state', runtimeState);
}

function bridgeScriptPath() {
  return path.join(app.getAppPath(), 'bridge', 'babylink-bridge.mjs');
}

function terminateProcess(child) {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
  setTimeout(() => {
    if (!child.killed) child.kill('SIGKILL');
  }, 2_000).unref();
}

async function waitForBridge(port) {
  const endpoint = `http://127.0.0.1:${port}/health`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return endpoint;
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('电脑助手本机服务启动超时，请检查端口是否被占用。');
}

function extractTarEntry(buffer, expectedName) {
  for (let offset = 0; offset + 512 <= buffer.length;) {
    const header = buffer.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const sizeText = header.subarray(124, 136).toString('ascii').replace(/\0.*$/, '').trim();
    const size = Number.parseInt(sizeText || '0', 8);
    const contentStart = offset + 512;
    if (path.basename(name) === expectedName) return buffer.subarray(contentStart, contentStart + size);
    offset = contentStart + Math.ceil(size / 512) * 512;
  }
  throw new Error('下载包中没有找到 cloudflared。');
}

function cloudflaredAsset() {
  const architecture = process.arch === 'arm64' ? 'arm64' : 'amd64';
  if (process.platform === 'darwin') return { name: `cloudflared-darwin-${architecture}.tgz`, archive: true };
  if (process.platform === 'win32') return { name: `cloudflared-windows-${architecture}.exe`, archive: false };
  if (process.platform === 'linux') return { name: `cloudflared-linux-${architecture}`, archive: false };
  throw new Error('当前电脑系统不支持自动隧道。');
}

async function ensureCloudflared() {
  const executableName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const executablePath = userPath(path.join('bin', executableName));
  if (fs.existsSync(executablePath)) return executablePath;
  sendState({ phase: 'downloading', message: '首次使用，正在下载官方加密隧道组件…' });
  const asset = cloudflaredAsset();
  const response = await fetch(`https://github.com/cloudflare/cloudflared/releases/latest/download/${asset.name}`, { redirect: 'follow' });
  if (!response.ok) throw new Error(`cloudflared 下载失败：HTTP ${response.status}`);
  const downloaded = Buffer.from(await response.arrayBuffer());
  const binary = asset.archive ? extractTarEntry(gunzipSync(downloaded), 'cloudflared') : downloaded;
  fs.mkdirSync(path.dirname(executablePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(executablePath, binary, { mode: 0o700 });
  if (process.platform !== 'win32') fs.chmodSync(executablePath, 0o700);
  return executablePath;
}

async function updateBridgePublicUrl(port, publicUrl) {
  const response = await fetch(`http://127.0.0.1:${port}/desktop/public-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicUrl })
  });
  if (!response.ok) throw new Error(`电脑助手没有接受隧道地址：HTTP ${response.status}`);
}

async function startQuickTunnel(port) {
  const executable = await ensureCloudflared();
  return await new Promise((resolve, reject) => {
    let settled = false;
    let output = '';
    tunnelProcess = spawn(executable, ['tunnel', '--url', `http://127.0.0.1:${port}`, '--no-autoupdate'], { windowsHide: true });
    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (!match || settled) return;
      settled = true;
      resolve(match[0]);
    };
    tunnelProcess.stdout.on('data', onData);
    tunnelProcess.stderr.on('data', onData);
    tunnelProcess.once('error', (error) => {
      if (!settled) reject(error);
    });
    tunnelProcess.once('exit', (code) => {
      if (!settled) reject(new Error(`自动隧道提前退出：${code ?? 'unknown'}`));
      else sendState({ phase: 'error', message: '自动隧道已断开，请重新启动电脑助手。' });
    });
    setTimeout(() => {
      if (!settled) reject(new Error('自动隧道建立超时，请检查网络后重试。'));
    }, 45_000).unref();
  });
}

async function stopBridge() {
  terminateProcess(tunnelProcess);
  terminateProcess(bridgeProcess);
  tunnelProcess = undefined;
  bridgeProcess = undefined;
  sendState({ phase: 'stopped', message: '电脑助手已停止', publicUrl: '', dashboardUrl: '' });
}

async function startBridge(inputConfig) {
  await stopBridge();
  const config = { ...defaultConfig(), ...inputConfig };
  const port = Math.min(65_535, Math.max(1_024, Number(config.port || 8787)));
  if (!['qq', 'xiaohongshu', 'douyin', 'both', 'all'].includes(config.platform)) throw new Error('请选择要连接的平台。');
  if (config.tunnelMode === 'custom' && !/^https:\/\//i.test(config.publicUrl)) throw new Error('固定地址必须以 https:// 开头。');
  saveConfig(config);
  sendState({ phase: 'starting', message: '正在启动本机 Bridge…', publicUrl: '', dashboardUrl: '' });
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    BABYLINK_BRIDGE_PLATFORM: config.platform,
    BABYLINK_BRIDGE_PORT: String(port),
    BABYLINK_BRIDGE_HOST: '127.0.0.1',
    BABYLINK_BRIDGE_TOKEN: getToken(),
    BABYLINK_BRIDGE_PUBLIC_URL: config.tunnelMode === 'custom' ? String(config.publicUrl).replace(/\/$/, '') : '',
    BABYLINK_BRIDGE_OPEN_DASHBOARD: '0',
    BABYLINK_BRIDGE_AUDIT_PATH: userPath('bridge-audit.jsonl'),
    BABYLINK_BRIDGE_ALLOWED_QQ_USERS: String(config.allowedQqUsers || ''),
    BABYLINK_BRIDGE_ALLOWED_QQ_GROUPS: String(config.allowedQqGroups || ''),
    BABYLINK_BRIDGE_ALLOWED_WRITE_TOOLS: String(config.allowedWriteTools || ''),
    BABYLINK_BRIDGE_READS_PER_MINUTE: String(config.readsPerMinute || 120),
    BABYLINK_BRIDGE_WRITES_PER_MINUTE: String(config.writesPerMinute || 30),
    QQ_ONEBOT_URL: String(config.qqOneBotUrl || 'http://127.0.0.1:3000'),
    XHS_ADAPTER_URL: String(config.xhsAdapterUrl || 'http://127.0.0.1:8790'),
    DOUYIN_ADAPTER_URL: String(config.douyinAdapterUrl || 'http://127.0.0.1:8791')
  };
  bridgeProcess = spawn(process.execPath, [bridgeScriptPath()], { env, windowsHide: true });
  bridgeProcess.stdout.on('data', (chunk) => console.log(`[bridge] ${chunk.toString().trim()}`));
  bridgeProcess.stderr.on('data', (chunk) => console.error(`[bridge] ${chunk.toString().trim()}`));
  bridgeProcess.once('exit', (code) => {
    if (runtimeState.phase !== 'stopped') sendState({ phase: 'error', message: `Bridge 已退出：${code ?? 'unknown'}` });
  });
  await waitForBridge(port);
  const publicUrl = config.tunnelMode === 'quick' ? await startQuickTunnel(port) : String(config.publicUrl).replace(/\/$/, '');
  if (config.tunnelMode === 'quick') await updateBridgePublicUrl(port, publicUrl);
  const dashboardUrl = `http://127.0.0.1:${port}/`;
  sendState({ phase: 'running', message: '电脑助手运行中，可以扫码配对', publicUrl, dashboardUrl });
  return runtimeState;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 760,
    minWidth: 760,
    minHeight: 620,
    title: 'BabyLink 电脑助手',
    backgroundColor: '#f3f5f4',
    webPreferences: {
      preload: path.join(app.getAppPath(), 'bridge', 'desktop', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  void mainWindow.loadFile(path.join(app.getAppPath(), 'bridge', 'desktop', 'index.html'));
}

ipcMain.handle('bridge:get-config', () => ({ config: readConfig(), state: runtimeState }));
ipcMain.handle('bridge:start', (_event, config) => startBridge(config));
ipcMain.handle('bridge:stop', () => stopBridge());
ipcMain.handle('bridge:open-dashboard', async () => {
  if (!runtimeState.dashboardUrl) throw new Error('请先启动电脑助手。');
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.focus();
    await dashboardWindow.loadURL(runtimeState.dashboardUrl);
    return;
  }
  dashboardWindow = new BrowserWindow({ width: 780, height: 850, title: 'BabyLink 配对与体检' });
  await dashboardWindow.loadURL(runtimeState.dashboardUrl);
});
ipcMain.handle('bridge:diagnostics', async () => {
  if (!runtimeState.dashboardUrl) throw new Error('请先启动电脑助手。');
  return await fetch(`${runtimeState.dashboardUrl}diagnostics`).then((response) => response.json());
});
ipcMain.handle('bridge:audit', async () => {
  if (!runtimeState.dashboardUrl) return { entries: [] };
  return await fetch(`${runtimeState.dashboardUrl}audit?limit=50`).then((response) => response.json());
});
ipcMain.handle('bridge:open-external', (_event, url) => shell.openExternal(String(url)));

app.whenReady().then(createMainWindow);
app.on('window-all-closed', () => {
  void stopBridge();
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
