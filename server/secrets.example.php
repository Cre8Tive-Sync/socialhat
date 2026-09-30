<?php
/**
 * Template for the secrets the SiteGround endpoints read.
 *
 * Copy this to the site's `private/` folder, NEXT TO public_html, not inside it:
 *
 *   ~/www/<your-site>/private/secrets.php
 *   ~/www/<your-site>/public_html/            <- what the deploy replaces
 *
 * Nothing outside public_html can be requested over the web, and the deploy
 * never touches it. Leave a value as '' to switch that feature off.
 */

return [
    // HatBot's providers, tried in this order. Any subset works; with none, it
    // answers from its built-in table.
    'GROQ_API_KEY' => '',        // https://console.groq.com/keys (gsk_...)
    'NVIDIA_API_KEY' => '',      // https://build.nvidia.com/settings/api-keys (nvapi-...)
    'OPENROUTER_API_KEY' => '',  // https://openrouter.ai/keys

    // The feed. A long-lived Instagram token — it expires after 60 days.
    'INSTAGRAM_TOKEN' => '',
    'INSTAGRAM_HANDLE' => 'socialhat.media',

    // Where enquiries and HatBot leads are emailed. On STAGING, set this to your
    // own address so test enquiries don't land in the client's inbox. Per-path
    // overrides also work: ENQUIRY_TO_MARKETING, _WEBSITE, _HOST, _ADVERTISE.
    'ENQUIRY_TO' => 'info@socialhat.com.au',

    // How that mail is sent. socialhat.com.au's mail is Microsoft 365 with a
    // hard-fail SPF record, so mail sent by SiteGround's own mail() as
    // @socialhat.com.au is treated as spoofing. Use SMTP: either an M365
    // mailbox with SMTP AUTH enabled (smtp.office365.com, 587), or a relay such
    // as SMTP2GO or Brevo once its SPF/DKIM records are added to the domain.
    // With SMTP_HOST empty the endpoints fall back to mail().
    'SMTP_HOST' => '',
    'SMTP_PORT' => '587',        // 587 = STARTTLS, 465 = implicit TLS
    'SMTP_USER' => '',
    'SMTP_PASS' => '',
    'MAIL_FROM' => '',           // defaults to SMTP_USER; must be allowed to send as

    // Optional. Also POST each enquiry / each HatBot lead as JSON to a CRM or
    // automation (Zapier, Make, Power Automate). A lead webhook replaces the
    // email for HatBot leads; the enquiry webhook is in addition to the email.
    'ENQUIRY_WEBHOOK' => '',
    'LEAD_WEBHOOK' => '',
];
