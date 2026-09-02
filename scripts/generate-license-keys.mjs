#!/usr/bin/env node
/**
 * 振込確認後にライセンスキーを発行するスクリプト。
 *
 * 使い方:
 *   set ADMIN_SECRET=あなたの管理用パスワード
 *   set LICENSE_API_BASE=https://life-plan.kazuki-takemori-sub.workers.dev
 *   node scripts/generate-license-keys.mjs --count 1 --note "山田様"
 */

const args = process.argv.slice(2);
let count = 1;
let note = '';

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--count') {
    count = Number(args[i + 1] ?? 1);
    i += 1;
  } else if (args[i] === '--note') {
    note = String(args[i + 1] ?? '');
    i += 1;
  }
}

const adminSecret = process.env.ADMIN_SECRET;
const apiBase = process.env.LICENSE_API_BASE ?? 'http://127.0.0.1:8787';

if (!adminSecret) {
  console.error('ADMIN_SECRET 環境変数を設定してください。');
  process.exit(1);
}

const response = await fetch(`${apiBase}/api/admin/keys/generate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminSecret}`,
  },
  body: JSON.stringify({ count, note: note || null }),
});

const body = await response.json();
if (!response.ok || !body.ok) {
  console.error('キー発行に失敗しました:', body);
  process.exit(1);
}

console.log('発行したライセンスキー:');
for (const entry of body.keys) {
  console.log(`- ${entry.key}${entry.note ? ` (${entry.note})` : ''}`);
}
