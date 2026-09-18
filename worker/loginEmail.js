import { sendSesEmail } from './sesMailer.js';

export async function sendLoginCodeEmail(env, toEmail, code) {
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
  return sendSesEmail(env, { toEmail, subject, text, html });
}
