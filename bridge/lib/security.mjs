import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function csvSet(value) {
  return new Set(String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean));
}

const allowedQqUsers = csvSet(process.env.BABYLINK_BRIDGE_ALLOWED_QQ_USERS);
const allowedQqGroups = csvSet(process.env.BABYLINK_BRIDGE_ALLOWED_QQ_GROUPS);
const allowedWriteTools = csvSet(process.env.BABYLINK_BRIDGE_ALLOWED_WRITE_TOOLS);
const readLimit = Math.max(1, Number(process.env.BABYLINK_BRIDGE_READS_PER_MINUTE || 120));
const writeLimit = Math.max(1, Number(process.env.BABYLINK_BRIDGE_WRITES_PER_MINUTE || 30));
const auditPath = String(process.env.BABYLINK_BRIDGE_AUDIT_PATH || path.join(os.homedir(), '.babylink', 'bridge-audit.jsonl')).trim();
const buckets = { read: [], write: [] };

function targetValue(args, key) {
  return String(args?.[key] ?? '').trim();
}

function assertTargetAllowed(name, args) {
  const userId = targetValue(args, 'user_id');
  const groupId = targetValue(args, 'group_id');
  if (userId && allowedQqUsers.size && !allowedQqUsers.has(userId)) throw new Error('qq_user_not_in_allowlist');
  if (groupId && allowedQqGroups.size && !allowedQqGroups.has(groupId)) throw new Error('qq_group_not_in_allowlist');
  if (allowedWriteTools.size && !allowedWriteTools.has(name)) throw new Error('write_tool_not_in_allowlist');
}

function consumeRate(write) {
  const key = write ? 'write' : 'read';
  const now = Date.now();
  const bucket = buckets[key];
  while (bucket.length && bucket[0] <= now - 60_000) bucket.shift();
  const limit = write ? writeLimit : readLimit;
  if (bucket.length >= limit) throw new Error(`${key}_rate_limit_exceeded`);
  bucket.push(now);
}

function summarizeValue(key, value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 8).map((entry) => summarizeValue(key, entry));
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 20).map(([nestedKey, nestedValue]) => [nestedKey, summarizeValue(nestedKey, nestedValue)]));
  const text = String(value);
  if (/token|cookie|authorization|password|secret/i.test(key)) return '[redacted]';
  if (/message|content|body|title|text/i.test(key)) {
    return { preview: text.slice(0, 120), length: text.length, sha256: crypto.createHash('sha256').update(text).digest('hex').slice(0, 16) };
  }
  return text.length > 240 ? `${text.slice(0, 240)}…` : value;
}

function appendAudit(entry) {
  try {
    fs.mkdirSync(path.dirname(auditPath), { recursive: true, mode: 0o700 });
    fs.appendFileSync(auditPath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
  } catch (error) {
    console.error(`Audit log failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function guardToolCall(tool, args) {
  const write = !tool.readOnlyHint;
  consumeRate(write);
  if (write) assertTargetAllowed(tool.name, args);
  return { write, startedAt: Date.now() };
}

export function auditToolCall(tool, args, guard, outcome) {
  appendAudit({
    timestamp: new Date().toISOString(),
    tool: tool.name,
    write: guard.write,
    durationMs: Date.now() - guard.startedAt,
    ok: outcome.ok,
    error: outcome.error ? String(outcome.error).slice(0, 500) : undefined,
    arguments: summarizeValue('arguments', args)
  });
}

export function readAuditEntries(limit = 100) {
  try {
    const lines = fs.readFileSync(auditPath, 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-Math.min(500, Math.max(1, limit))).reverse().map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

export function securitySummary() {
  return {
    qqUserAllowlist: allowedQqUsers.size,
    qqGroupAllowlist: allowedQqGroups.size,
    writeToolAllowlist: allowedWriteTools.size,
    readLimitPerMinute: readLimit,
    writeLimitPerMinute: writeLimit,
    auditPath
  };
}
