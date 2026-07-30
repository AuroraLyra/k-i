import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const [platform, inputPath, rawVersionCode, versionName, rawMinimumVersionCode = '1', ...noteParts] = process.argv.slice(2);
const versionCode = Number(rawVersionCode);
const minimumVersionCode = Number(rawMinimumVersionCode);
const baseUrl = String(process.env.BABYLINK_BASE_URL ?? 'https://babylink.top').replace(/\/+$/, '');
const adminToken = String(process.env.ADMIN_TOKEN ?? '');
const releaseNotes = noteParts.join(' ') || `${basename(inputPath ?? '')} release`;

if (!['android', 'ios', 'desktop-macos', 'desktop-windows'].includes(platform) || !inputPath || !Number.isInteger(versionCode) || versionCode < 1 || !versionName || !Number.isInteger(minimumVersionCode) || minimumVersionCode < 1) {
  console.error('Usage: ADMIN_TOKEN=... node scripts/publish-release.mjs <android|ios|desktop-macos|desktop-windows> <file> <versionCode> <versionName> [minimumVersionCode] [notes]');
  process.exit(1);
}
if (!adminToken) {
  console.error('ADMIN_TOKEN is required.');
  process.exit(1);
}

const filePath = resolve(inputPath);
const bytes = await readFile(filePath);
const contentTypes = {
  android: 'application/vnd.android.package-archive',
  ios: 'application/octet-stream',
  'desktop-macos': 'application/x-apple-diskimage',
  'desktop-windows': 'application/vnd.microsoft.portable-executable'
};
const response = await fetch(`${baseUrl}/api/admin/releases/upload`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': contentTypes[platform],
    'X-Link-Platform': platform,
    'X-Link-Version-Code': String(versionCode),
    'X-Link-Version-Name': versionName,
    'X-Link-Minimum-Version-Code': String(minimumVersionCode),
    'X-Link-Release-Notes-Base64': Buffer.from(releaseNotes, 'utf8').toString('base64')
  },
  body: bytes
});

const body = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(body.message || body.error || `Upload failed (${response.status}).`);
  process.exit(1);
}
console.log(JSON.stringify(body, null, 2));