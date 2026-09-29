<?php
/**
 * What the three SiteGround endpoints share: secrets, a writable cache, a
 * per-IP rate limit, and outbound mail.
 *
 * The leading underscore is load-bearing — .htaccess refuses any `_` file under
 * api/, so this is included by chat.php and friends but never served.
 */

declare(strict_types=1);

/* ==========================================================================
   Secrets

   Read from `private/secrets.php`, which sits one level ABOVE public_html:

     ~/www/<site>/private/secrets.php     <- here, outside the web root
     ~/www/<site>/public_html/api/chat.php

   so the web server has no path that reaches it, and a deploy that replaces
   public_html cannot overwrite or delete it. server/secrets.example.php is the
   template. A real environment variable (SetEnv, or the shell in a test) wins
   over the file, the same way the shell wins over .env in `npm run dev`.
   ========================================================================== */

function private_dir(): string
{
    return getenv('SOCIALHAT_PRIVATE') ?: dirname(__DIR__, 2) . '/private';
}

function env(string $name): ?string
{
    static $file = null;
    $file ??= (static function (): array {
        $path = private_dir() . '/secrets.php';
        // Anything the file prints is swallowed. A BOM from a Windows editor, or
        // a newline after a closing PHP tag, would otherwise be echoed into the
        // response — and in the chat stream, glued to the front of the first
        // frame, it silently eats the first words of every reply.
        ob_start();
        try {
            $loaded = is_file($path) ? require $path : [];
        } finally {
            ob_end_clean();
        }
        return is_array($loaded) ? $loaded : [];
    })();

    $raw = getenv($name);
    if ($raw === false || trim($raw) === '') $raw = $file[$name] ?? null;
    // Trimmed, because a key pasted with a trailing space or newline fails
    // upstream as "missing authentication", which says nothing about the cause.
    return is_string($raw) && trim($raw) !== '' ? trim($raw) : null;
}

/** HatBot's prompt, tools and built-in answers, exported from api/*.js at build time. */
function knowledge(): array
{
    static $k = null;
    return $k ??= require __DIR__ . '/_knowledge.php';
}

/* ==========================================================================
   Cache

   Where PHP keeps what a warm Node instance would have held in memory: the
   Instagram feed, which models are cooling off, the rate-limit counters. Under
   private/ so none of it is web-reachable; the system temp dir if private/ was
   never created, which works, just less tidily.
   ========================================================================== */

function cache_dir(string $sub): string
{
    foreach ([private_dir() . '/cache', sys_get_temp_dir() . '/socialhat-cache'] as $base) {
        $dir = "$base/$sub";
        if (is_dir($dir) || @mkdir($dir, 0700, true)) return $dir;
    }
    throw new RuntimeException('No writable cache directory');
}

/**
 * Read-modify-write a JSON file under an exclusive lock, so two requests
 * landing together do not each write back a version missing the other's change.
 */
function with_json_file(string $file, callable $change): mixed
{
    $fh = fopen($file, 'c+');
    if (!$fh) throw new RuntimeException("Cannot open $file");
    try {
        flock($fh, LOCK_EX);
        $data = json_decode(stream_get_contents($fh) ?: '[]', true);
        [$next, $result] = $change(is_array($data) ? $data : []);
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($next));
        return $result;
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}

/* ==========================================================================
   Rate limit

   The README's standing warning — a public, unauthenticated endpoint that
   spends money per call needs a per-IP limit — used to point at the host's edge
   config. SiteGround has no such setting, so it lives here: a sliding window per
   IP per bucket, one small file each. It is not a defence against a botnet; it
   stops one script from emptying the day's free allowance in a minute.
   ========================================================================== */

function rate_limited(string $bucket, int $max, int $windowSeconds): bool
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $dir = cache_dir('rate');
    $now = time();

    // Now and then, sweep counters nobody has touched in a day.
    if (random_int(1, 200) === 1) {
        foreach (glob("$dir/*.json") ?: [] as $old) {
            if (@filemtime($old) < $now - 86400) @unlink($old);
        }
    }

    return with_json_file("$dir/$bucket-" . hash('sha256', $ip) . '.json', static function (array $hits) use ($now, $max, $windowSeconds) {
        $hits = array_values(array_filter($hits, static fn ($t) => is_int($t) && $t > $now - $windowSeconds));
        if (count($hits) >= $max) return [$hits, true];
        $hits[] = $now;
        return [$hits, false];
    });
}

/* ==========================================================================
   Responses
   ========================================================================== */

function json_out(array $payload, int $status = 200, array $headers = []): never
{
    http_response_code($status);
    header('Content-Type: application/json');
    foreach ($headers as $name => $value) header("$name: $value");
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/** The request body as an array, or a 400. Capped, because the body is the visitor's to size. */
function read_json_body(int $maxBytes): array
{
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || strlen($raw) > $maxBytes) json_out(['error' => 'Too large.'], 413);
    try {
        $body = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        json_out(['error' => 'Expected JSON.'], 400);
    }
    return is_array($body) ? $body : [];
}

function post_json(string $url, array $payload, int $timeout = 8): bool
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => $timeout,
    ]);
    curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return $status >= 200 && $status < 300;
}

/* ==========================================================================
   Mail

   Where the enquiry form and HatBot's captured leads end up.

   socialhat.com.au's mail is Microsoft 365, and its SPF record ends `-all`: any
   server other than Outlook's sending as @socialhat.com.au hard-fails. PHP's
   mail() on SiteGround is exactly such a server, so M365 files those messages
   as spoofing — the enquiry "sends" and lands in junk, or nowhere. So:

   - SMTP_HOST set  -> authenticated SMTP (M365, or a relay like SMTP2GO/Brevo
                       whose SPF/DKIM the domain includes). This is the one to use.
   - otherwise      -> mail(), which works for testing to a non-M365 address and
                       should not be trusted for the real inbox.
   ========================================================================== */

/** Which inbox a path's enquiries go to. Per-path overrides, then the general one. */
function inbox_for(string $path): string
{
    return env('ENQUIRY_TO_' . strtoupper($path)) ?? env('ENQUIRY_TO') ?? 'info@socialhat.com.au';
}

function send_mail(string $to, string $subject, string $body, ?string $replyTo = null): bool
{
    $from = env('MAIL_FROM') ?? env('SMTP_USER') ?? 'website@socialhat.com.au';
    if (!filter_var($to, FILTER_VALIDATE_EMAIL) || !filter_var($from, FILTER_VALIDATE_EMAIL)) return false;
    if ($replyTo !== null && !filter_var($replyTo, FILTER_VALIDATE_EMAIL)) $replyTo = null;

    // One line, then encoded: a subject is visitor-influenced text going into a
    // header, and a newline in it would be a header of their choosing.
    $subject = mb_encode_mimeheader(preg_replace('/[\r\n]+/', ' ', $subject), 'UTF-8', 'B', "\r\n");
    $host = explode('@', $from)[1];

    $headers = [
        'Date: ' . date(DATE_RFC2822),
        'From: ' . mb_encode_mimeheader('SocialHat website', 'UTF-8', 'B') . " <$from>",
        ...($replyTo ? ["Reply-To: <$replyTo>"] : []),
        'Message-ID: <' . bin2hex(random_bytes(12)) . "@$host>",
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        // Base64 keeps every body line short and means none can start with the
        // "." that would end an SMTP DATA block early.
        'Content-Transfer-Encoding: base64',
    ];
    $encoded = rtrim(chunk_split(base64_encode($body), 76, "\r\n"));

    if (!env('SMTP_HOST')) {
        return mail($to, $subject, $encoded, implode("\r\n", $headers), '-f' . $from);
    }

    try {
        smtp_send($from, $to, implode("\r\n", ["To: <$to>", "Subject: $subject", ...$headers]) . "\r\n\r\n" . $encoded);
        return true;
    } catch (Throwable $e) {
        error_log('[mail] SMTP failed: ' . $e->getMessage());
        return false;
    }
}

/**
 * A minimal SMTP submission client: STARTTLS on 587 or implicit TLS on 465,
 * AUTH LOGIN, one recipient. Enough for a contact form without vendoring a
 * mail library onto a host with no Composer step.
 */
function smtp_send(string $from, string $to, string $message): void
{
    $host = env('SMTP_HOST');
    $port = (int) (env('SMTP_PORT') ?? '587');
    $implicitTls = $port === 465;

    $context = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $host]]);
    $socket = @stream_socket_client(($implicitTls ? 'ssl://' : 'tcp://') . "$host:$port", $errno, $error, 10, STREAM_CLIENT_CONNECT, $context);
    if (!$socket) throw new RuntimeException("connect $host:$port: $error");
    stream_set_timeout($socket, 15);

    $step = static function (?string $command, array $want) use ($socket): string {
        if ($command !== null) fwrite($socket, $command . "\r\n");
        $reply = '';
        // Multi-line replies are "250-..." until the last, which is "250 ...".
        while (($line = fgets($socket, 1024)) !== false) {
            $reply .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        if (!in_array((int) substr($reply, 0, 3), $want, true)) {
            $shown = $command !== null && str_starts_with($command, 'AUTH') ? 'AUTH' : ($command ?? 'greeting');
            throw new RuntimeException("$shown -> " . trim($reply));
        }
        return $reply;
    };

    try {
        $helo = 'EHLO ' . ($_SERVER['SERVER_NAME'] ?? 'localhost');
        $step(null, [220]);
        $step($helo, [250]);
        if (!$implicitTls) {
            $step('STARTTLS', [220]);
            $crypto = STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | (defined('STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT') ? STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT : 0);
            if (!stream_socket_enable_crypto($socket, true, $crypto)) throw new RuntimeException('STARTTLS handshake failed');
            $step($helo, [250]);
        }
        if ($user = env('SMTP_USER')) {
            $step('AUTH LOGIN', [334]);
            $step(base64_encode($user), [334]);
            $step(base64_encode(env('SMTP_PASS') ?? ''), [235]);
        }
        $step("MAIL FROM:<$from>", [250]);
        $step("RCPT TO:<$to>", [250, 251]);
        $step('DATA', [354]);
        $step($message . "\r\n.", [250]);
        // Not checked: the message is accepted at this point, and a server
        // that hangs up rudely must not turn a delivered enquiry into an error.
        fwrite($socket, "QUIT\r\n");
    } finally {
        fclose($socket);
    }
}
