import { spawnSync } from 'node:child_process';
import { chmod, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const configDirectory = `${process.env.HOME}/.config/babylink-mcp`;
const configPath = process.env.BABYLINK_MCP_CONFIG || `${configDirectory}/config.json`;
const terminal = createInterface({ input, output });

function clean(value) {
  return String(value || '').trim();
}

function splitToolNames(value) {
  return [...new Set(clean(value).split(/[，,\n]/).map((item) => item.trim()).filter(Boolean))];
}

async function configureManualWriteTools(label, existingServer, readTools) {
  const previousWrites = (existingServer?.allowedTools || []).filter((tool) => !readTools.includes(tool));
  output.write(`\n${label} 默认只读。只有你自己已登录、确认支持写入的上游，才可开启“用户手动互动”。角色自动任务不会使用这组工具。\n`);
  if (!await confirm('为用户本人开启手动点赞、评论、私信等写入工具', previousWrites.length > 0)) {
    return { allowedTools: readTools, readOnly: true };
  }
  const writeTools = splitToolNames(await ask('仅填上游实际存在的写工具名（逗号分隔；留空保持只读）', previousWrites.join(', ')));
  if (!writeTools.length) {
    output.write('未填写写工具名，保持只读。\n');
    return { allowedTools: readTools, readOnly: true };
  }
  return { allowedTools: [...new Set([...readTools, ...writeTools])], readOnly: false };
}

async function ask(label, current = '') {
  const suffix = current ? ` [已配置，直接回车保留]` : '';
  const answer = clean(await terminal.question(`${label}${suffix}：`));
  return answer || current;
}

async function confirm(label, initial = false) {
  const answer = clean(await terminal.question(`${label} ${initial ? '[Y/n]' : '[y/N]'}：`)).toLowerCase();
  if (!answer) return initial;
  return answer === 'y' || answer === 'yes' || answer === '是';
}

function upsertById(items, value) {
  const index = items.findIndex((item) => item?.id === value.id);
  if (index >= 0) items[index] = { ...items[index], ...value };
  else items.push(value);
}

function taobaoAdzoneId(pid) {
  return clean(pid).split('_').filter(Boolean).at(-1) || '';
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} 执行失败（退出码 ${result.status ?? 'unknown'}）。`);
}

async function fileExists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function installDouyinProject(projectDirectory) {
  output.write('\n开始安装抖音社区 MCP。该项目依赖 Python 本地 V8；部分 Android ARM64 机型可能无法构建。\n');
  try {
    run('pkg', ['install', '-y', 'git', 'python', 'clang', 'cmake', 'make', 'rust', 'ffmpeg']);
    run('python', ['-m', 'pip', 'install', '--upgrade', 'uv']);
    if (await fileExists(`${projectDirectory}/main.py`)) {
      run('git', ['pull', '--ff-only'], { cwd: projectDirectory });
    } else {
      await mkdir(dirname(projectDirectory), { recursive: true });
      run('git', ['clone', '--depth', '1', 'https://github.com/pazwusimple-netizen/douyin-mcp.git', projectDirectory]);
    }
    run('uv', ['sync'], { cwd: projectDirectory });
    output.write('抖音社区 MCP 安装完成。\n');
    return true;
  } catch (error) {
    output.write(`抖音社区 MCP 安装未完成：${error instanceof Error ? error.message : String(error)}\n`);
    output.write('已保留配置但不会启用上游；可在兼容设备或自有服务器部署后重新运行向导。\n');
    return false;
  }
}

async function saveConfig(config) {
  await mkdir(configDirectory, { recursive: true });
  const temporaryPath = `${configPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, configPath);
  await chmod(configPath, 0o600);
}

async function configureTaobao(config) {
  const current = config.connectors?.taobao || {};
  const appKey = await ask('淘宝开放平台 App Key', current.appKey);
  const appSecret = await ask('淘宝开放平台 App Secret', current.appSecret);
  const session = await ask('淘宝授权 Session（仅保存在 Termux）', current.session);
  const pid = await ask('淘宝联盟 PID，例如 mm_123_456_789', current.pid);
  const adzoneId = await ask('广告位 adzone_id', current.adzoneId || taobaoAdzoneId(pid));
  config.connectors.taobao = {
    ...current,
    appKey,
    appSecret,
    session,
    pid,
    adzoneId,
    apiUrl: current.apiUrl || 'https://eco.taobao.com/router/rest',
    materialSearchMethod: current.materialSearchMethod || 'taobao.tbk.dg.material.optional.upgrade'
  };
}

async function configureDouyin(config) {
  const current = config.connectors?.douyin || {};
  const existingServer = [...config.stdioServers, ...config.httpServers].find((item) => item.id === 'douyin');
  const readTools = ['check_login_status', 'search_videos', 'get_video_detail', 'get_video_comments', 'get_sub_comments', 'get_user_info', 'get_user_posts', 'get_homefeed', 'resolve_share_url', 'download_video', 'download_aweme_images', 'ocr_aweme_images', 'transcribe_video', 'batch_transcribe'];
  const cookiePath = await ask('抖音 Cookie 文件路径', current.cookiePath || `${process.env.HOME}/.config/douyinmcp/cookies.txt`);
  if (await confirm('现在粘贴抖音 Cookie 到本机独立文件', false)) {
    const cookie = clean(await terminal.question('粘贴完整 Cookie（只写入当前手机）：'));
    if (cookie) {
      await mkdir(dirname(cookiePath), { recursive: true });
      await writeFile(cookiePath, `${cookie}\n`, { mode: 0o600 });
      await chmod(cookiePath, 0o600);
    }
  }
  const upstreamType = clean(await terminal.question('抖音实验适配器：1=本机 stdio，2=已有 HTTPS MCP，回车跳过：'));
  config.connectors.douyin = { ...current, cookiePath };
  const manualWrite = await configureManualWriteTools('抖音适配器', existingServer, readTools);
  if (upstreamType === '1') {
    const projectDirectory = await ask('douyin-mcp 项目目录', current.projectDirectory || `${process.env.HOME}/.local/share/douyinmcp`);
    config.connectors.douyin.projectDirectory = projectDirectory;
    const installed = await fileExists(`${projectDirectory}/main.py`) || await confirm('未发现项目，立即自动安装', true) && await installDouyinProject(projectDirectory);
    upsertById(config.stdioServers, {
      id: 'douyin',
      name: '抖音 MCP 实验适配器',
      enabled: Boolean(installed),
      command: 'uv',
      args: ['--directory', projectDirectory, 'run', 'main.py'],
      cwd: projectDirectory,
      prefix: 'douyin',
      env: {
        DOUYIN_COOKIE_PATH: cookiePath,
        ASR_PROVIDER: current.asrProvider || 'siliconflow',
        SILICONFLOW_API_KEY: current.siliconflowApiKey || ''
      },
      allowedTools: manualWrite.allowedTools,
      readOnly: manualWrite.readOnly,
      timeoutMs: 120000
    });
  } else if (upstreamType === '2') {
    const url = await ask('抖音 MCP HTTPS 地址');
    const bearer = await ask('抖音 MCP Bearer Token（没有可留空）');
    upsertById(config.httpServers, {
      id: 'douyin',
      name: '抖音 MCP 实验适配器',
      enabled: Boolean(url),
      url,
      prefix: 'douyin',
      headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
      allowedTools: manualWrite.allowedTools,
      readOnly: manualWrite.readOnly,
      timeoutMs: 120000
    });
  }
  if (await confirm('配置视频 ASR（语音转文字）', Boolean(current.siliconflowApiKey))) {
    const asrProvider = await ask('ASR Provider', current.asrProvider || 'siliconflow');
    const siliconflowApiKey = await ask('ASR API Key', current.siliconflowApiKey);
    config.connectors.douyin = { ...config.connectors.douyin, asrProvider, siliconflowApiKey };
    const stdio = config.stdioServers.find((item) => item.id === 'douyin');
    if (stdio) stdio.env = { ...stdio.env, ASR_PROVIDER: asrProvider, SILICONFLOW_API_KEY: siliconflowApiKey };
  }
}

async function configureXiaohongshu(config) {
  const current = config.httpServers.find((item) => item.id === 'xiaohongshu') || {};
  const readTools = ['check_login_status', 'list_feeds', 'search_feeds', 'get_feed_detail', 'user_profile'];
  const url = await ask('xiaohongshu-mcp 地址', current.url || 'http://127.0.0.1:18060/mcp');
  const bearer = await ask('上游 Bearer Token（本机无鉴权可留空）', clean(current.headers?.Authorization).replace(/^Bearer\s+/i, ''));
  const manualWrite = await configureManualWriteTools('小红书适配器', current, readTools);
  upsertById(config.httpServers, {
    id: 'xiaohongshu',
    name: 'xiaohongshu-mcp 社区上游',
    enabled: Boolean(url),
    url,
    prefix: 'xhs',
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : {},
    allowedTools: manualWrite.allowedTools,
    readOnly: manualWrite.readOnly,
    timeoutMs: 120000
  });
}

async function configureCommon(config) {
  config.connectors.amapWebKey = await ask('高德 Web 服务 Key', config.connectors.amapWebKey);
  config.connectors.kuaidi100Customer = await ask('快递100 Customer', config.connectors.kuaidi100Customer);
  config.connectors.kuaidi100Key = await ask('快递100 Key', config.connectors.kuaidi100Key);
  config.connectors.bilibiliCookie = await ask('B 站 Cookie（只用于收藏夹）', config.connectors.bilibiliCookie);
}

try {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.connectors ||= {};
  config.httpServers = Array.isArray(config.httpServers) ? config.httpServers : [];
  config.stdioServers = Array.isArray(config.stdioServers) ? config.stdioServers : [];
  output.write('\nBabyLink Termux MCP 本地配置向导\n');
  output.write('凭据只写入当前手机的 0600 配置文件，不会进入聊天、工具结果或配对 JSON。\n');
  output.write('小红书与抖音适配器均为社区实现，不是平台官方接口；抖音在 Android ARM64 上属于实验能力。\n\n');

  if (await confirm('配置淘宝官方开放平台能力')) await configureTaobao(config);
  if (await confirm('配置抖音实验适配器')) await configureDouyin(config);
  if (await confirm('配置 xiaohongshu-mcp 社区上游')) await configureXiaohongshu(config);
  if (await confirm('配置地图、快递和 B 站私有能力')) await configureCommon(config);

  await saveConfig(config);
  output.write(`\n配置已保存：${configPath}\n`);
  output.write('运行 babylink-mcp restart 使配置生效。\n');
} finally {
  terminal.close();
}