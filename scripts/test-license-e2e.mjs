import { readFileSync } from 'node:fs';

const secrets = Object.fromEntries(
  readFileSync('.license-secrets.local.txt', 'utf8')
    .trim()
    .split('\n')
    .map((line) => line.split('=')),
);

const base = 'https://life-plan.kazuki-takemori-sub.workers.dev';

const generateRes = await fetch(`${base}/api/admin/keys/generate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${secrets.ADMIN_SECRET}`,
  },
  body: JSON.stringify({ count: 1, note: 'e2e-test' }),
});
const generated = await generateRes.json();
console.log('generate', generateRes.status, generated);

const key = generated.keys?.[0]?.key;
if (!key) process.exit(1);

const activateRes = await fetch(`${base}/api/license/activate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  body: JSON.stringify({
    key,
    deviceId: 'e2e-device-1',
    deviceLabel: 'Test Browser',
  }),
});
const activated = await activateRes.json();
console.log('activate', activateRes.status, activated);

const statusRes = await fetch(
  `${base}/api/license/status?${new URLSearchParams({ key, deviceId: 'e2e-device-1' })}`,
);
const status = await statusRes.json();
console.log('status', statusRes.status, status);
