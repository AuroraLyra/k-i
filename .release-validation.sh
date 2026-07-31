#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/babylink/deploy

validation_qq=999999999999
validation_device=release-validation-device
origin=https://babylink.top
cookie_name=link_session
created=0
stage=initialization

cleanup() {
  if [[ "$created" == 1 ]]; then
    docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U link -d link \
      -c "DELETE FROM users WHERE qq = '$validation_qq';" >/dev/null
  fi
  rm -f /tmp/babylink-mac-headers /tmp/babylink-win-headers
}
trap cleanup EXIT
trap 'echo "release validation failed during: $stage" >&2' ERR

stage=collision-check
existing=$(docker compose exec -T postgres psql -U link -d link -Atc \
  "SELECT COUNT(*) FROM users WHERE qq = '$validation_qq';")
if [[ "$existing" != 0 ]]; then
  echo "validation account collision" >&2
  exit 1
fi

stage=group-selection
group_id=$(docker compose exec -T postgres psql -U link -d link -Atc \
  "SELECT group_id FROM allowed_groups WHERE enabled = TRUE ORDER BY group_id LIMIT 1;")
if [[ -z "$group_id" ]]; then
  echo "no enabled validation group" >&2
  exit 1
fi

stage=session-creation
session_token=$(docker compose exec -T app node -e \
  'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64url"))')
token_hash=$(docker compose exec -T -e VALIDATION_SESSION_TOKEN="$session_token" app node -e \
  'const { createHash } = require("node:crypto"); process.stdout.write(createHash("sha256").update(`${process.env.CHALLENGE_SECRET}:${process.env.VALIDATION_SESSION_TOKEN}`).digest("hex"))')

docker compose exec -T postgres psql -v ON_ERROR_STOP=1 \
  -v qq="$validation_qq" \
  -v group_id="$group_id" \
  -v device_id="$validation_device" \
  -v token_hash="$token_hash" \
  -U link -d link <<'SQL' >/dev/null
BEGIN;
INSERT INTO users (qq, status, last_verified_at)
VALUES (:'qq', 'active', NOW());
INSERT INTO memberships (qq, group_id, active, role, nickname, last_seen_at)
VALUES (:'qq', :'group_id', TRUE, 'member', 'release-validation', NOW());
INSERT INTO devices (id, qq, label, last_seen_at)
VALUES (:'device_id', :'qq', 'release-validation', NOW());
INSERT INTO sessions (id, token_hash, qq, device_id, expires_at)
VALUES (gen_random_uuid(), :'token_hash', :'qq', :'device_id', NOW() + INTERVAL '15 minutes');
COMMIT;
SQL
created=1

validate_release() {
  local expected_platform="$1"
  local expected_size="$2"
  local expected_sha="$3"

  EXPECTED_PLATFORM="$expected_platform" EXPECTED_SIZE="$expected_size" EXPECTED_SHA="$expected_sha" \
    docker compose exec -T \
      -e EXPECTED_PLATFORM \
      -e EXPECTED_SIZE \
      -e EXPECTED_SHA \
      app node -e '
        let body = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => body += chunk);
        process.stdin.on("end", () => {
          const value = JSON.parse(body);
          const valid = value.platform === process.env.EXPECTED_PLATFORM
            && value.versionCode === 1
            && value.versionName === "0.1.0"
            && value.fileSize === Number(process.env.EXPECTED_SIZE)
            && value.sha256 === process.env.EXPECTED_SHA
            && value.updateAvailable === true
            && typeof value.downloadUrl === "string"
            && value.downloadUrl.includes("ticket=");
          if (!valid) process.exit(2);
          process.stdout.write(value.downloadUrl);
        });
      '
}

stage=latest-release-query
mac_json=$(curl -fsS -H "Cookie: $cookie_name=$session_token" \
  "$origin/api/releases/latest?platform=desktop-macos&versionCode=0")
win_json=$(curl -fsS -H "Cookie: $cookie_name=$session_token" \
  "$origin/api/releases/latest?platform=desktop-windows&versionCode=0")

mac_url=$(printf '%s' "$mac_json" | validate_release \
  desktop-macos \
  149238199 \
  3f79833e71ce09c12707b4ee555a4661dc5d68e5ab7661c4db267d8e44808ad4)
win_url=$(printf '%s' "$win_json" | validate_release \
  desktop-windows \
  126158961 \
  adc4f6d8fcb9a68d41562923cb827be3cfc8216bf3a91e00883b8c71387f85a0)

check_download_headers() {
  local url="$1"
  local headers="$2"
  local expected_type="$3"
  local expected_size="$4"
  local expected_sha="$5"
  local http_code
  local curl_code

  trap - ERR
  set +e
  http_code=$(curl -sS --max-filesize 1 -D "$headers" -o /dev/null -w '%{http_code}' \
    "$origin$url" 2>/dev/null)
  curl_code=$?
  set -e
  trap 'echo "release validation failed during: $stage" >&2' ERR

  [[ "$http_code" == 200 ]]
  [[ "$curl_code" == 63 || "$curl_code" == 0 ]]
  tr -d '\r' < "$headers" | grep -Fqi "Content-Type: $expected_type"
  tr -d '\r' < "$headers" | grep -Fqi "Content-Length: $expected_size"
  tr -d '\r' < "$headers" | grep -Fqi "X-Content-SHA256: $expected_sha"
}

stage=macos-download-ticket
check_download_headers \
  "$mac_url" \
  /tmp/babylink-mac-headers \
  application/x-apple-diskimage \
  149238199 \
  3f79833e71ce09c12707b4ee555a4661dc5d68e5ab7661c4db267d8e44808ad4
stage=windows-download-ticket
check_download_headers \
  "$win_url" \
  /tmp/babylink-win-headers \
  application/vnd.microsoft.portable-executable \
  126158961 \
  adc4f6d8fcb9a68d41562923cb827be3cfc8216bf3a91e00883b8c71387f85a0

echo "desktop-macos latest + ticket download headers: OK"
echo "desktop-windows latest + ticket download headers: OK"