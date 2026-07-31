import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const configPath = resolve(process.env.BABYLINK_MCP_CONFIG || `${process.env.HOME}/.config/babylink-mcp/config.json`);
const config = JSON.parse(await readFile(configPath, 'utf8'));
const providedUrl = String(process.argv[2] || '').trim();
const localUrl = `http://127.0.0.1:${Math.max(1, Math.min(65535, Number(config.port) || 8765))}/mcp`;
const url = providedUrl || localUrl;
const target = new URL(url);
if (!(target.protocol === 'https:' || (target.protocol === 'http:' && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(target.hostname)))) {
  throw new Error('配对地址必须是公开 HTTPS 或本机回环 HTTP。');
}
const token = String(config.token || '').replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, name) => process.env[name] || '');
if (token.length < 32) throw new Error('配置中的 Token 无效。');
process.stdout.write(`${JSON.stringify({
  mcpServers: {
    'BabyLink Termux': {
      name: 'BabyLink Termux 本机网关',
      kind: 'termux',
      url: target.href,
      apiKey: token,
      apiKeyHeader: 'Authorization',
      apiKeyPrefix: 'Bearer '
    }
  }
}, null, 2)}\n`);