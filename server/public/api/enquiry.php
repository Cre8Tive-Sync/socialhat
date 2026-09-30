<?php
/**
 * Where the enquiry form posts, on SiteGround.
 *
 * Enquiry.jsx sends the JSON built by buildPayload(); this turns it into an
 * email to the inbox that path routes to. The recipient is decided HERE, from
 * the path id, never from the `route` field the browser sends — a recipient the
 * visitor can choose would make this an open mail relay.
 *
 * The form already does the spam work a person never notices (honeypot, time
 * floor). This adds the one a script would: a per-IP limit.
 */

declare(strict_types=1);
require __DIR__ . '/_lib.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_out(['error' => 'Use POST.'], 405);

$in = read_json_body(32_000);

$text = static fn (string $key, int $max) => is_string($in[$key] ?? null) ? mb_substr(trim($in[$key]), 0, $max) : '';

$path = $text('path', 20);
$name = $text('name', 200);
$email = $text('email', 254);

if (!in_array($path, knowledge()['paths'], true)) json_out(['error' => 'Unknown enquiry type.'], 400);
if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) json_out(['error' => 'A name and a valid email are needed.'], 400);
if (rate_limited('enquiry', 6, 3600)) json_out(['error' => 'Too many enquiries from here — please call or email instead.'], 429);

$label = $text('pathLabel', 60) ?: $path;
$business = $text('business', 200);
$phone = $text('phone', 50);
$message = $text('message', 5000);

$detail = [];
foreach (array_slice(is_array($in['detail'] ?? null) ? $in['detail'] : [], 0, 20, true) as $question => $answer) {
    if (is_string($answer)) $detail[] = mb_substr((string) $question, 0, 100) . ': ' . mb_substr($answer, 0, 500);
}

// The same layout the mailto: fallback in Enquiry.jsx writes, so an enquiry
// reads the same however it arrived.
$lines = [
    "Enquiry type: $label",
    '',
    ...$detail,
    ...($detail ? [''] : []),
    "Name: $name",
    ...($business !== '' ? ["Business: $business"] : []),
    "Email: $email",
    ...($phone !== '' ? ["Phone: $phone"] : []),
    ...($message !== '' ? ['', $message] : []),
];

$sent = send_mail(inbox_for($path), "Website enquiry — $label", implode("\n", $lines), $email);

// Optional copy to a CRM or automation. Best effort: the email is the record.
if ($hook = env('ENQUIRY_WEBHOOK')) {
    $webhooked = post_json($hook, compact('path', 'label', 'name', 'business', 'email', 'phone', 'message') + ['detail' => $in['detail'] ?? [], 'at' => date(DATE_ATOM)]);
    $sent = $sent || $webhooked;
}

if (!$sent) {
    error_log('[enquiry] not delivered: ' . json_encode(compact('path', 'name', 'email', 'phone')));
    json_out(['error' => 'Not delivered.'], 502);
}
json_out(['ok' => true]);
