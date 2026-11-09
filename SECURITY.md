# Security Policy

## Reporting a vulnerability

Use GitHub private vulnerability reporting for suspected vulnerabilities in this repository (the **Security** tab, **Report a vulnerability**). Don't open a public issue. Include the affected revision, reproduction steps and impact, without credentials, payment data or another person's personal data. Report Crossmint, Stytch or Vercel platform issues to their owners.

## Product responsibilities

Crossmint owns financial enforcement and authoritative checkout and payment state. The application must authenticate callers, pass the correct user's identity, use the supported payment and protected-input paths, and faithfully display provider outcomes.

No model tool, chat message, MCP argument or messaging reply approves a payment. Protected values and provider capability URLs stay out of agent context, transcripts and logs. The ordinary handoff link points to Menta's authenticated UI.

Payments need the payer's approval through Crossmint's UI inside Menta's signed-in surfaces: the web chat's checkout dock, the secure checkout page, or the in-host checkout card.
