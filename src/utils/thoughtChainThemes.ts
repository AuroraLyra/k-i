import type { ThoughtChainTheme } from '@/types/domain';
import { createId } from './id';

const thoughtChainThemeExportMagic = 'LINK_THOUGHT_CHAIN_THEME_V1';

export const defaultThoughtChainPrompt = `请记录角色在回复前已经完成的情绪判断、关系取舍、表达策略和行动决定，不是系统提示、隐藏推理或模型自述。用自然中文写，不要重复最终聊天气泡，不要提及 AI、Token 。`;

export const defaultThoughtChainCode = `<style>
.thought-chain-card {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
}

.thought-chain-face {
  position: absolute;
  inset: 0;
  display: grid;
  min-height: 0;
  overflow: hidden;
  border-radius: 20px;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.thought-chain-face--mind {
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 13px;
  padding: 25px 22px 18px;
  background:
    radial-gradient(circle at 96% 4%, rgba(209, 232, 211, 0.72), transparent 28%),
    linear-gradient(145deg, #fffdf8, #e9f0e7);
  color: #303630;
}

.thought-chain-face--tools {
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 14px;
  padding: 25px 22px 18px;
  background:
    radial-gradient(circle at 95% 5%, rgba(111, 173, 132, 0.23), transparent 28%),
    linear-gradient(145deg, #20372d, #10231b);
  color: #e8f2ea;
  transform: rotateY(180deg);
}

.thought-chain-kicker,
.thought-chain-tools-kicker {
  margin: 0;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.16em;
}

.thought-chain-kicker { color: #718a77; }
.thought-chain-tools-kicker { color: #96b7a0; }

.thought-chain-title,
.thought-chain-tools-title {
  margin: 0;
  font-family: Georgia, "Songti SC", serif;
  font-size: 27px;
  font-weight: 500;
  letter-spacing: -0.06em;
  line-height: 1;
}

.thought-chain-content {
  display: grid;
  align-content: start;
  gap: 10px;
  min-height: 0;
  overflow: auto;
  color: #4e5c51;
  font-size: 13px;
  line-height: 1.8;
}

.thought-chain-content p { margin: 0; }

.thought-chain-meta,
.thought-chain-tools-meta {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding-top: 11px;
  border-top: 1px solid rgba(84, 106, 89, 0.16);
  color: #8b978d;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.thought-chain-tools-meta { border-color: rgba(202, 231, 208, 0.2); color: #8eab96; }

.thought-chain-tools-list {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 0;
  overflow: auto;
}

.thought-chain-tool {
  display: grid;
  gap: 4px;
  padding: 11px 12px;
  border: 1px solid rgba(208, 235, 214, 0.17);
  border-radius: 3px 14px 3px 14px;
  background: rgba(217, 239, 219, 0.08);
}

.thought-chain-tool small { color: #91b49a; font-size: 8px; font-weight: 800; letter-spacing: 0.08em; }
.thought-chain-tool strong { font-size: 13px; }
.thought-chain-tool em { color: #b9cdbd; font-size: 10px; font-style: normal; line-height: 1.5; }
.thought-chain-tool--empty { color: #b9cdbd; font-size: 12px; line-height: 1.7; }
</style>

<section class="thought-chain-card">
  <article class="thought-chain-face thought-chain-face--mind" data-thought-card-face="mind">
    <p class="thought-chain-kicker">{{themeName}} · {{generatedAt}}</p>
    <h1 class="thought-chain-title">{{title}}</h1>
    <div class="thought-chain-content">{{lines}}</div>
    <footer class="thought-chain-meta"><span>{{model}}</span><span>{{tokens}}</span></footer>
  </article>
  <article class="thought-chain-face thought-chain-face--tools" data-thought-card-face="tools">
    <p class="thought-chain-tools-kicker">RUNTIME RECEIPT · {{status}}</p>
    <h2 class="thought-chain-tools-title">工具回执</h2>
    <div class="thought-chain-tools-list">{{tools}}</div>
    <footer class="thought-chain-tools-meta"><span>{{toolCount}} CALLS</span><span>{{tokens}}</span></footer>
  </article>
</section>`;

interface ThoughtChainThemeExportPayload {
  magic: typeof thoughtChainThemeExportMagic;
  version: 1;
  exportedAt: number;
  themes: Array<Omit<ThoughtChainTheme, 'id' | 'createdAt' | 'updatedAt'>>;
}

function normalizeText(value: unknown, maxLength = 24000) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, maxLength);
}

function normalizeBoolean(value: unknown, fallback = true) {
  if (value === false || value === 'false') return false;
  if (value === true || value === 'true') return true;
  return fallback;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceAllTokens(template: string, tokens: Record<string, string>) {
  return Object.entries(tokens).reduce((result, [token, value]) => result.replace(new RegExp(escapeRegExp(token), 'g'), value), template);
}

function sanitizeTemplate(template: string) {
  return template
    .replace(/<\/?(?:script|iframe|object|embed|link|meta|base)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');
}

export function createThoughtChainTheme(timestamp = Date.now()): ThoughtChainTheme {
  return {
    id: createId('thought-chain-theme'),
    name: '私语便签',
    prompt: defaultThoughtChainPrompt,
    regex: '',
    template: splitThoughtChainThemeCode(defaultThoughtChainCode).html,
    css: splitThoughtChainThemeCode(defaultThoughtChainCode).css,
    enabled: true,
    source: 'custom',
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function normalizeThoughtChainTheme(theme: Partial<ThoughtChainTheme> | null | undefined): ThoughtChainTheme | null {
  if (!theme || typeof theme !== 'object') return null;
  const name = normalizeText(theme.name, 80) || '未命名思维链';
  const prompt = normalizeText(theme.prompt, 12000) || defaultThoughtChainPrompt;
  const createdAt = Number.isFinite(theme.createdAt) ? Number(theme.createdAt) : Date.now();
  return {
    id: normalizeText(theme.id, 120) || createId('thought-chain-theme'),
    name,
    prompt,
    regex: normalizeText(theme.regex, 1000),
    template: sanitizeTemplate(normalizeText(theme.template, 24000)),
    css: normalizeText(theme.css, 24000).replace(/@import\s+[^;]+;/gi, ''),
    enabled: normalizeBoolean(theme.enabled, true),
    source: theme.source === 'imported' ? 'imported' : 'custom',
    createdAt,
    updatedAt: Number.isFinite(theme.updatedAt) ? Number(theme.updatedAt) : createdAt
  };
}

export function normalizeThoughtChainThemes(themes: unknown): ThoughtChainTheme[] {
  if (!Array.isArray(themes)) return [];
  const seen = new Set<string>();
  return themes
    .map((theme) => normalizeThoughtChainTheme(theme as Partial<ThoughtChainTheme>))
    .filter((theme): theme is ThoughtChainTheme => Boolean(theme))
    .filter((theme) => {
      if (seen.has(theme.id)) return false;
      seen.add(theme.id);
      return true;
    })
    .sort((first, second) => first.createdAt - second.createdAt);
}

export function selectRandomEnabledThoughtChainTheme(themes: ThoughtChainTheme[]) {
  const enabledThemes = themes.filter((theme) => theme.enabled);
  return enabledThemes[Math.floor(Math.random() * enabledThemes.length)] ?? null;
}

export function splitThoughtChainThemeCode(code: unknown) {
  const normalizedCode = normalizeText(code);
  const cssBlocks: string[] = [];
  const html = normalizedCode.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, css: string) => {
    const normalizedCss = normalizeText(css);
    if (normalizedCss) cssBlocks.push(normalizedCss);
    return '';
  }).trim();
  return {
    html: sanitizeTemplate(html),
    css: cssBlocks.join('\n\n').trim()
  };
}

export function composeThoughtChainThemeCode(template: unknown, css: unknown) {
  const normalizedTemplate = normalizeText(template);
  const normalizedCss = normalizeText(css);
  return [
    normalizedCss ? `<style>\n${normalizedCss}\n</style>` : '',
    normalizedTemplate
  ].filter(Boolean).join('\n\n');
}

export function extractThoughtChainContent(rawContent: unknown, regex: string) {
  const content = normalizeText(rawContent, 60000);
  const pattern = normalizeText(regex, 1000);
  if (!content || !pattern) return content;
  try {
    const match = content.match(new RegExp(pattern, 's'));
    return normalizeText(match?.[1] ?? match?.[0] ?? content, 60000) || content;
  } catch {
    return content;
  }
}

export function renderThoughtChainThemeHtml(content: unknown, theme: Pick<ThoughtChainTheme, 'name' | 'template'>, metadata: {
  model?: string;
  tokens?: string;
  status?: string;
  generatedAt?: string;
  toolCalls?: Array<{ serverName: string; toolName: string; status: string; result?: string }>;
} = {}) {
  const text = normalizeText(content, 60000);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 80);
  const escapedContent = escapeHtml(text).replace(/\n/g, '<br />');
  const escapedLines = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
  const toolCalls = metadata.toolCalls ?? [];
  const escapedTools = toolCalls.length
    ? toolCalls.map((call, index) => `<article class="thought-chain-tool"><small>${String(index + 1).padStart(2, '0')} · ${escapeHtml(call.serverName || 'LINK')}</small><strong>${escapeHtml(call.toolName || 'unknown')}</strong><em>${escapeHtml(call.status || 'unknown')}${call.result ? ` · ${escapeHtml(call.result).slice(0, 160)}` : ''}</em></article>`).join('')
    : '<p class="thought-chain-tool--empty">本轮没有外部工具调用。</p>';
  const template = sanitizeTemplate(splitThoughtChainThemeCode(theme.template).html);
  if (!template) return escapedLines || `<p>${escapedContent}</p>`;
  return replaceAllTokens(template, {
    '{{themeName}}': escapeHtml(theme.name),
    '{{title}}': escapeHtml(lines[0] || theme.name),
    '{{content}}': escapedContent,
    '{{lines}}': escapedLines,
    '{{model}}': escapeHtml(metadata.model || 'MODEL UNKNOWN'),
    '{{tokens}}': escapeHtml(metadata.tokens || 'TOKEN —'),
    '{{status}}': escapeHtml(metadata.status || 'SAVED'),
    '{{generatedAt}}': escapeHtml(metadata.generatedAt || 'ARCHIVE'),
    '{{toolCount}}': String(toolCalls.length),
    '{{tools}}': escapedTools,
    '{{rawContent}}': escapedContent,
    '$content': escapedContent,
    '$lines': escapedLines
  });
}

export function scopeThoughtChainCss(css: string, scopeId: string) {
  const normalizedCss = normalizeText(css);
  const normalizedScopeId = scopeId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!normalizedCss || !normalizedScopeId) return '';
  const scopeSelector = `[data-thought-chain-scope="${normalizedScopeId}"]`;
  return normalizedCss.replace(/(^|})\s*([^@{}][^{]+)\s*{/g, (match, boundary: string, selectorText: string) => {
    const selectors = selectorText
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean)
      .map((selector) => {
        if (selector.startsWith(scopeSelector) || selector.startsWith('@')) return selector;
        if (selector === ':host' || selector === '&') return scopeSelector;
        if (selector.startsWith('&')) return `${scopeSelector}${selector.slice(1)}`;
        return `${scopeSelector} ${selector}`;
      });
    return selectors.length ? `${boundary}\n${selectors.join(', ')} {` : match;
  });
}

export function encodeThoughtChainThemesToDataUrl(themes: ThoughtChainTheme[]) {
  const payload: ThoughtChainThemeExportPayload = {
    magic: thoughtChainThemeExportMagic,
    version: 1,
    exportedAt: Date.now(),
    themes: themes.map((theme) => ({
      name: theme.name,
      prompt: theme.prompt,
      regex: theme.regex,
      template: theme.template,
      css: theme.css,
      enabled: theme.enabled,
      source: 'imported'
    }))
  };
  return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(payload, null, 2))}`;
}

export function decodeThoughtChainThemesFromText(text: string) {
  const payload = JSON.parse(text) as Partial<ThoughtChainThemeExportPayload>;
  if (payload.magic !== thoughtChainThemeExportMagic || payload.version !== 1 || !Array.isArray(payload.themes)) {
    throw new Error('这不是 LINK 思维链主题文件。');
  }
  const now = Date.now();
  return payload.themes
    .map((theme) => normalizeThoughtChainTheme({
      ...theme,
      id: createId('thought-chain-theme'),
      source: 'imported',
      createdAt: now,
      updatedAt: now
    }))
    .filter((theme): theme is ThoughtChainTheme => Boolean(theme));
}