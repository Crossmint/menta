import { colors, mascot, wordmark } from "../brand";
import { format } from "../i18n/format";
import { LANGUAGES, type Locale } from "../i18n/locales";
import { loadMessages } from "../i18n/messages";

/** How long a sign-in code lasts, in the Stytch request and the email alike. */
export const CODE_LIFETIME_MINUTES = 5;

/**
 * The sign-in code email in one language, as Stytch custom HTML templates take
 * it: Stytch fills `{{otp_code}}` and `{{user_email}}`. The code stands alone
 * under its label, with no other number nearby, so mail apps (Gmail's "Copy
 * code", iOS Mail's AutoFill) can pick it out; it stays out of the subject,
 * which lock screens and mail logs show. The same email serves login and
 * sign-up (one template each per language, IDs
 * `{OCA_CODE_EMAIL_TEMPLATES}-login-{locale}` and `-signup-{locale}`). `scripts/code-emails.mjs` prints them for Stytch.
 * Tables and inline styles, light only: what email clients render alike.
 */
export async function codeEmail(locale: Locale, origin: string) {
  const { codeEmail: m } = (await loadMessages(locale)).auth;
  const expires = format(m.expires, { minutes: CODE_LIFETIME_MINUTES });
  const font =
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const tile = 32;
  const html = `<!DOCTYPE html>
<html lang="${LANGUAGES[locale].tag}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(m.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${colors.stage};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(m.enter)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${colors.stage};">
<tr><td align="center" style="padding:48px 16px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:460px;">
<tr><td style="padding:0 4px 20px;">
<a href="${origin}" style="text-decoration:none;"><img src="${origin}${mascot.src}" width="${tile}" height="${tile}" alt="" style="display:inline-block;vertical-align:middle;border:0;border-radius:${Math.round(tile * 0.22)}px;"><img src="${origin}${wordmark.src}" width="${Math.round((tile * 0.7 * wordmark.width) / wordmark.height)}" height="${Math.round(tile * 0.7)}" alt="Menta" style="display:inline-block;vertical-align:middle;border:0;margin-left:${Math.round(tile * 0.3)}px;"></a>
</td></tr>
<tr><td style="background:${colors.white};border:1px solid #e9e9e7;border-radius:24px;padding:36px 32px 32px;font-family:${font};color:${colors.ink};">
<p style="margin:0;font-size:24px;line-height:30px;font-weight:600;letter-spacing:-0.02em;">${escapeHtml(m.heading)}</p>
<p style="margin:10px 0 0;font-size:15px;line-height:23px;color:#5f5f5c;">${escapeHtml(m.enter)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
<tr><td align="center" style="background:${colors.stage};border:1px solid #ededeb;border-radius:16px;padding:18px 12px 22px;">
<p style="margin:0;font-family:${font};font-size:13px;line-height:18px;color:#7a7a76;">${escapeHtml(m.label)}</p>
<p style="margin:6px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:36px;line-height:40px;font-weight:600;letter-spacing:0.12em;color:${colors.ink};">{{otp_code}}</p>
</td></tr>
</table>
<p style="margin:12px 0 0;font-size:13px;line-height:20px;color:#7a7a76;text-align:center;">${escapeHtml(expires)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;border-top:1px solid #efefed;">
${[
  [m.share, colors.accent, 20],
  [m.ignore, "#d4d4d1", 6],
]
  .map(
    ([line, dot, top]) =>
      `<tr><td width="14" valign="top" style="padding:${top}px 0 0;"><div style="width:6px;height:6px;border-radius:3px;background:${dot};margin-top:7px;"></div></td><td style="padding:${top}px 0 0;font-size:13px;line-height:20px;color:#7a7a76;">${escapeHtml(String(line))}</td></tr>`,
  )
  .join("\n")}
</table>
</td></tr>
<tr><td style="padding:20px 4px 0;font-family:${font};font-size:12px;line-height:18px;color:#9a9a96;">
<a href="${origin}" style="color:#9a9a96;text-decoration:none;">Menta by Crossmint</a> · {{user_email}}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
  const text = [
    m.heading,
    "",
    m.enter,
    "",
    `${m.label}: {{otp_code}}`,
    expires,
    "",
    m.share,
    m.ignore,
    "",
    `Menta by Crossmint · ${origin}`,
  ].join("\n");
  return { subject: m.subject, html, text };
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
