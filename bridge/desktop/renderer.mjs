const bridge = window.babyLinkBridge;
const form = document.querySelector('#bridge-form');
const startButton = document.querySelector('#start-button');
const stopButton = document.querySelector('#stop-button');
const dashboardButton = document.querySelector('#dashboard-button');
const diagnosticButton = document.querySelector('#diagnostic-button');
const auditButton = document.querySelector('#audit-button');
const message = document.querySelector('#message');
const publicUrlField = document.querySelector('#public-url-field');
let state = { phase: 'stopped', message: '电脑助手尚未启动' };
const requiredBridgeMethods = ['getConfig', 'start', 'stop', 'openDashboard', 'diagnostics', 'audit', 'onState'];
const bridgeApiAvailable = bridge && requiredBridgeMethods.every((method) => typeof bridge[method] === 'function');

function value(selector) {
  return document.querySelector(selector)?.value?.trim() || '';
}

function numberValue(selector, fallback) {
  const parsed = Number(value(selector));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function checkedValue(name) {
  return form.elements[name].value;
}

function setValue(selector, nextValue) {
  const element = document.querySelector(selector);
  if (element) element.value = String(nextValue ?? '');
}

function setRadio(name, nextValue) {
  const radio = form.querySelector(`input[name="${name}"][value="${nextValue}"]`);
  if (radio) radio.checked = true;
}

function updateTunnelFields() {
  publicUrlField.classList.toggle('hidden', checkedValue('tunnelMode') !== 'custom');
}

function readForm() {
  return {
    platform: checkedValue('platform'),
    qqOneBotUrl: value('#qq-url'),
    xhsAdapterUrl: value('#xhs-url'),
    douyinAdapterUrl: value('#douyin-url'),
    tunnelMode: checkedValue('tunnelMode'),
    publicUrl: value('#public-url'),
    allowedQqUsers: value('#allowed-users'),
    allowedQqGroups: value('#allowed-groups'),
    allowedWriteTools: value('#allowed-tools'),
    readsPerMinute: numberValue('#read-limit', 120),
    writesPerMinute: numberValue('#write-limit', 30),
    port: 8787
  };
}

function applyConfig(config) {
  setRadio('platform', config.platform);
  setRadio('tunnelMode', config.tunnelMode);
  setValue('#qq-url', config.qqOneBotUrl);
  setValue('#xhs-url', config.xhsAdapterUrl);
  setValue('#douyin-url', config.douyinAdapterUrl);
  setValue('#public-url', config.publicUrl);
  setValue('#allowed-users', config.allowedQqUsers);
  setValue('#allowed-groups', config.allowedQqGroups);
  setValue('#allowed-tools', config.allowedWriteTools);
  setValue('#read-limit', config.readsPerMinute);
  setValue('#write-limit', config.writesPerMinute);
  updateTunnelFields();
}

function renderState(nextState) {
  state = nextState;
  const running = state.phase === 'running';
  const busy = ['starting', 'downloading'].includes(state.phase);
  const failed = state.phase === 'error';
  const pill = document.querySelector('#state-pill');
  pill.className = `state-pill ${running ? 'running' : failed ? 'error' : 'stopped'}`;
  pill.querySelector('strong').textContent = running ? '运行中' : busy ? '正在启动' : failed ? '需要处理' : '尚未启动';
  const orb = document.querySelector('.status-orb');
  orb.classList.toggle('running', running);
  document.querySelector('#status-title').textContent = running ? '可以扫码配对' : busy ? '正在准备连接' : failed ? '启动失败' : '等待启动';
  document.querySelector('#status-copy').textContent = running ? state.publicUrl : state.message;
  message.textContent = state.message;
  message.classList.toggle('error', failed);
  startButton.disabled = busy || running;
  stopButton.disabled = !busy && !running && !failed;
  dashboardButton.disabled = !running;
  diagnosticButton.disabled = !running;
  if (running) void refreshDiagnostics();
}

function renderDiagnostics(payload) {
  const container = document.querySelector('#diagnostics');
  container.replaceChildren();
  for (const check of payload.checks || []) {
    const item = document.createElement('div');
    item.className = `check ${check.ok ? 'ok' : ''}`;
    const marker = document.createElement('i');
    marker.textContent = check.ok ? '✓' : '!';
    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = check.label;
    const detail = document.createElement('small');
    detail.textContent = check.detail;
    copy.append(title, detail);
    item.append(marker, copy);
    container.append(item);
  }
}

async function refreshDiagnostics() {
  try {
    renderDiagnostics(await bridge.diagnostics());
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : String(error);
    message.classList.add('error');
  }
}

async function refreshAudit() {
  const container = document.querySelector('#audit-list');
  try {
    const payload = await bridge.audit();
    container.replaceChildren();
    if (!payload.entries?.length) {
      const empty = document.createElement('p');
      empty.textContent = '还没有工具调用记录。';
      container.append(empty);
      return;
    }
    for (const entry of payload.entries) {
      const item = document.createElement('div');
      item.className = 'audit-entry';
      const title = document.createElement('strong');
      title.textContent = `${entry.ok ? '✓' : '!'} ${entry.tool}`;
      const detail = document.createElement('span');
      detail.textContent = `${new Date(entry.timestamp).toLocaleString()} · ${entry.durationMs}ms${entry.error ? ` · ${entry.error}` : ''}`;
      item.append(title, detail);
      container.append(item);
    }
  } catch (error) {
    container.textContent = error instanceof Error ? error.message : String(error);
  }
}

form.addEventListener('change', (event) => {
  if (event.target?.name === 'tunnelMode') updateTunnelFields();
});

if (!bridgeApiAvailable) {
  renderState({ ...state, phase: 'error', message: '桌面桥接组件加载失败，请更新或重新安装 BabyLink 电脑助手。' });
  startButton.disabled = true;
  stopButton.disabled = true;
} else {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.classList.remove('error');
    try {
      renderState(await bridge.start(readForm()));
    } catch (error) {
      renderState({ ...state, phase: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  });
  stopButton.addEventListener('click', async () => renderState(await bridge.stop()));
  dashboardButton.addEventListener('click', () => bridge.openDashboard());
  diagnosticButton.addEventListener('click', refreshDiagnostics);
  auditButton.addEventListener('click', refreshAudit);
  bridge.onState(renderState);

  const initial = await bridge.getConfig();
  applyConfig(initial.config);
  renderState(initial.state);
}
