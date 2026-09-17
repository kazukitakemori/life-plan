const SES_SEND_PATH = '/v2/email/outbound-emails';
const AWS_SERVICE = 'ses';

const encoder = new TextEncoder();

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Bytes(value) {
  const input = typeof value === 'string' ? encoder.encode(value) : value;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', input));
}

async function sha256Hex(value) {
  return bytesToHex(await sha256Bytes(value));
}

async function hmac(key, value) {
  const keyBytes = typeof key === 'string' ? encoder.encode(key) : key;
  const valueBytes = typeof value === 'string' ? encoder.encode(value) : value;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, valueBytes));
}

function formatAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

async function createAuthorization({
  method,
  host,
  path,
  body,
  region,
  accessKeyId,
  secretAccessKey,
  sessionToken,
  now,
}) {
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(body);
  const headerEntries = [
    ['content-type', 'application/json'],
    ['host', host],
    ['x-amz-date', amzDate],
  ];
  if (sessionToken) {
    headerEntries.push(['x-amz-security-token', sessionToken]);
  }
  headerEntries.sort(([a], [b]) => a.localeCompare(b));

  const canonicalHeaders = `${headerEntries
    .map(([name, value]) => `${name}:${value.trim()}`)
    .join('\n')}\n`;
  const signedHeaders = headerEntries.map(([name]) => name).join(';');
  const canonicalRequest = [
    method,
    path,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${region}/${AWS_SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const dateKey = await hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = await hmac(dateKey, region);
  const serviceKey = await hmac(regionKey, AWS_SERVICE);
  const signingKey = await hmac(serviceKey, 'aws4_request');
  const signature = bytesToHex(await hmac(signingKey, stringToSign));

  return {
    authorization:
      `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    amzDate,
  };
}

function requireSesConfig(env) {
  const region = String(env.AWS_SES_REGION ?? env.AWS_REGION ?? '').trim();
  const accessKeyId = String(env.AWS_ACCESS_KEY_ID ?? '').trim();
  const secretAccessKey = String(env.AWS_SECRET_ACCESS_KEY ?? '').trim();
  const fromEmail = String(env.SES_FROM_EMAIL ?? '').trim();
  const sessionToken = String(env.AWS_SESSION_TOKEN ?? '').trim();
  if (!region || !accessKeyId || !secretAccessKey || !fromEmail) {
    throw new Error('SES_NOT_CONFIGURED');
  }
  return { region, accessKeyId, secretAccessKey, fromEmail, sessionToken };
}

export async function sendLoginCodeEmail(env, toEmail, code) {
  const config = requireSesConfig(env);
  const host = `email.${config.region}.amazonaws.com`;
  const subject = 'ライフプランソフト ログイン認証コード';
  const text = [
    'ライフプランソフトのログイン認証コードです。',
    '',
    `認証コード: ${code}`,
    '',
    'このコードは10分間有効です。',
    'このメールに心当たりがない場合は、何もせず破棄してください。',
  ].join('\n');
  const html = [
    '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;line-height:1.7;color:#1f2937">',
    '<p>ライフプランソフトのログイン認証コードです。</p>',
    `<p style="font-size:28px;font-weight:700;letter-spacing:0.18em;margin:24px 0">${code}</p>`,
    '<p>このコードは10分間有効です。</p>',
    '<p style="color:#6b7280;font-size:13px">このメールに心当たりがない場合は、何もせず破棄してください。</p>',
    '</div>',
  ].join('');
  const body = JSON.stringify({
    FromEmailAddress: config.fromEmail,
    Destination: { ToAddresses: [toEmail] },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Text: { Data: text, Charset: 'UTF-8' },
          Html: { Data: html, Charset: 'UTF-8' },
        },
      },
    },
  });

  const now = new Date();
  const signed = await createAuthorization({
    method: 'POST',
    host,
    path: SES_SEND_PATH,
    body,
    region: config.region,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    sessionToken: config.sessionToken,
    now,
  });
  const headers = {
    Authorization: signed.authorization,
    'Content-Type': 'application/json',
    'X-Amz-Date': signed.amzDate,
  };
  if (config.sessionToken) {
    headers['X-Amz-Security-Token'] = config.sessionToken;
  }

  const response = await fetch(`https://${host}${SES_SEND_PATH}`, {
    method: 'POST',
    headers,
    body,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('SES SendEmail failed', response.status, detail.slice(0, 500));
    throw new Error('SES_SEND_FAILED');
  }
  return response.json().catch(() => ({}));
}
