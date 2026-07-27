# BabyLink 用户自有 R2 备份 Worker

这个 Worker 部署在用户自己的 Cloudflare 账号中。LINK 只在设备端生成密文，备份内容不会经过 BabyLink 服务端。

## 一键部署

在 LINK 的“备份 → Cloud”页面点击“部署 Worker”，使用 Cloudflare 部署向导：

1. 登录用户自己的 Cloudflare 账号。
2. 创建或选择一个 R2 bucket，并将 binding 命名为 `BACKUPS`。
3. 部署完成后复制 `workers.dev` 地址回到 LINK，点击“连接”。

如果部署向导没有自动创建 bucket，可以在 Cloudflare 控制台创建名为 `babylink-backups` 的 R2 bucket 后重新部署。

首次连接会在该 bucket 写入 `.babylink/device-auth.json`，只保存设备连接密钥的 SHA-256，不保存明文密钥。备份对象是浏览器使用恢复密钥加密后的二进制分片。

## 本地部署

```bash
npm install
npx wrangler r2 bucket create babylink-backups
npx wrangler deploy
```

如需更换首个配对设备，先在该用户自己的 R2 bucket 删除 `.babylink/device-auth.json`，再从 LINK 重新连接。