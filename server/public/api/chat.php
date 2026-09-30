<?php
/**
 * HatBot's endpoint on SiteGround — the PHP port of api/chat.js.
 *
 * Same contract, so Assistant.jsx cannot tell which one it is talking to: POST
 * `{ messages }`, get back a Server-Sent Event stream of `text`, `action`,
 * `rewind`, `meta`, `error` and `done` events. Same provider chain (Groq, then
 * NVIDIA, then OpenRouter), same cooldowns, same built-in answers when every
 * model is down — those answers, and the system prompt and tools, are read from
 * _knowledge.php, which the build exports from api/knowledge.js and
 * api/fallback.js. The JS files stay the source; change them, not this.
 *
 * The one addition is a per-IP rate limit, which api/chat.js left to the host's
 * edge config. SiteGround has none, so it is here — and a visitor over the limit
 * still gets a real answer, from the built-in table, rather than an error.
 */

declare(strict_types=1);
require __DIR__ . '/_lib.php';

const MAX_TURNS = 4;         // assistant turns per request, so a tool loop cannot run away
const MAX_MESSAGES = 40;     // conversation length a client may send back
const MAX_CHARS = 4000;      // per message
const FIRST_BYTE_S = 12;     // a model that has not started by now is treated as down
const BUDGET_S = 30;         // the whole search for a working model
const COOLDOWN_S = 60;       // a rate-limited or overloaded model is left alone this long
const DAILY_COOLDOWN_S = 3600;
const RATE_MAX = 40;         // requests per IP per window — about ten conversations
const RATE_WINDOW_S = 600;

const PROVIDERS = [
    [
        'name' => 'groq',
        'endpoint' => 'https://api.groq.com/openai/v1/chat/completions',
        'keyEnv' => 'GROQ_API_KEY',
        'models' => ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'],
        'perModelLimits' => true,
    ],
    [
        'name' => 'nvidia',
        'endpoint' => 'https://integrate.api.nvidia.com/v1/chat/completions',
        'keyEnv' => 'NVIDIA_API_KEY',
        'models' => ['openai/gpt-oss-20b', 'nvidia/nemotron-3-super-120b-a12b'],
    ],
    [
        'name' => 'openrouter',
        'endpoint' => 'https://openrouter.ai/api/v1/chat/completions',
        'keyEnv' => 'OPENROUTER_API_KEY',
        'models' => [
            'inclusionai/ling-3.0-flash-sante:free',
            'nvidia/nemotron-3-super-120b-a12b:free',
            'nvidia/nemotron-3-ultra-550b-a55b:free',
        ],
        'headers' => ['X-Title: SocialHat HatBot'],
    ],
];

final class UpstreamError extends RuntimeException
{
    public function __construct(public readonly string $provider, public readonly int $status, public readonly string $detail)
    {
        parent::__construct("$provider $status: " . substr($detail, 0, 500));
    }
}

/* ==========================================================================
   Request
   ========================================================================== */

// No CORS and no OPTIONS branch, as in api/chat.js: same-origin only is what
// keeps somebody else's site from spending this allowance.
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_out(['error' => 'Use POST.'], 405);

$messages = sanitise(read_json_body(400_000)['messages'] ?? null);
if (!$messages) json_out(['error' => 'No messages.'], 400);

sse_open();

try {
    if (rate_limited('chat', RATE_MAX, RATE_WINDOW_S)) {
        answer_without_model($messages, []);
    } else {
        converse($messages);
    }
    send(['type' => 'done']);
} catch (Throwable $e) {
    error_log('[chat] ' . $e);
    send([
        'type' => 'error',
        'text' => "Something went wrong at my end. Email info@socialhat.com.au or call 08 9285 0811 and you'll get a person.",
    ]);
}

function converse(array $messages): void
{
    $candidates = candidate_chain();
    $history = $messages;
    $deadline = microtime(true) + BUDGET_S;
    $toolsRun = [];

    for ($turn = 0; $turn < MAX_TURNS; $turn++) {
        try {
            $reply = complete($candidates, $history, $deadline);
        } catch (RuntimeException $e) {
            error_log('[chat] every provider failed: ' . $e->getMessage());
            answer_without_model($messages, $toolsRun);
            return;
        }

        $history[] = ['role' => 'assistant', 'content' => $reply['text'] !== '' ? $reply['text'] : null]
            + ($reply['calls'] ? ['tool_calls' => $reply['calls']] : []);

        // A refusal arrives as a normal 200 with no usable text.
        if (in_array($reply['finish'], ['content_filter', 'refusal'], true)) {
            send([
                'type' => 'text',
                'text' => "I can't help with that one. If it's about SocialHat's work, ask me again another way — otherwise info@socialhat.com.au will get you to a person.",
            ]);
            return;
        }

        if (!$reply['calls']) return;

        foreach ($reply['calls'] as $call) {
            $toolsRun[] = $call['function']['name'];
            $history[] = [
                'role' => 'tool',
                'tool_call_id' => $call['id'],
                'content' => run_tool($call['function']['name'], $call['function']['arguments']),
            ];
        }
    }
}

/* ==========================================================================
   Providers
   ========================================================================== */

function candidate_chain(): array
{
    $list = [];
    foreach (PROVIDERS as $provider) {
        $key = env($provider['keyEnv']);
        if (!$key) continue;
        $override = env(strtoupper($provider['name']) . '_MODELS');
        $models = $override ? array_values(array_filter(array_map('trim', explode(',', $override)))) : $provider['models'];
        foreach ($models as $model) $list[] = ['provider' => $provider, 'key' => $key, 'model' => $model];
    }
    $cooling = cooling();
    $now = time();
    $warm = array_values(array_filter($list, static fn ($c) => ($cooling[cid($c)] ?? 0) <= $now));
    // Everything cooling: try anyway. A stale cooldown is cheaper to ignore
    // than a visitor sent to the fallback for no reason.
    return $warm ?: $list;
}

function cid(array $c): string
{
    return $c['provider']['name'] . ':' . $c['model'];
}

/**
 * Which models are benched, and until when. api/chat.js keeps this in module
 * memory for as long as the instance is warm; PHP has no warm instance, so it
 * lives in a file.
 */
function cooling(?array $updates = null): array
{
    return with_json_file(cache_dir('chat') . '/cooling.json', static function (array $state) use ($updates) {
        $now = time();
        $state = array_filter($state, static fn ($until) => is_int($until) && $until > $now);
        foreach ($updates ?? [] as $id => $until) $state[$id] = $until;
        return [$state, $state];
    });
}

function classify(RuntimeException $e): string
{
    if (!$e instanceof UpstreamError) return 'model';
    if (in_array($e->status, [401, 402, 403], true)) return 'provider';
    if (preg_match('/per-day|per day|daily|\bTPD\b|\bRPD\b/i', $e->detail)) return 'daily';
    if ($e->status === 429 || $e->status === 503 || preg_match('/overload|rate.?limit|capacity/i', $e->detail)) return 'cool';
    return 'model';
}

function request_body(array $c, array $history): array
{
    $k = knowledge();
    $body = [
        'model' => $c['model'],
        'max_tokens' => 1024,
        'stream' => true,
        'messages' => [['role' => 'system', 'content' => $k['systemPrompt']], ...$history],
        'tools' => $k['tools'],
    ];
    if ($c['provider']['name'] === 'openrouter') {
        $body['reasoning'] = ['effort' => 'low'];
    } else {
        // Groq and NVIDIA reject a `strict` flag some of their models lack.
        $body['tools'] = array_map(static function ($tool) {
            unset($tool['function']['strict']);
            return $tool;
        }, $k['tools']);
    }
    return $body;
}

/** One assistant turn, trying each candidate until one answers. */
function complete(array $candidates, array $history, float $deadline): array
{
    $lastError = new RuntimeException('No providers configured');
    $ruledOut = [];

    foreach ($candidates as $c) {
        if (isset($ruledOut[$c['provider']['name']])) continue;
        if (microtime(true) > $deadline) break;

        // Characters already on the visitor's screen from this attempt. If it
        // fails, they are taken back before the next model writes its own.
        $streamed = 0;
        try {
            $reply = stream_one($c, $history, $deadline, $streamed);
            if (trim($reply['text']) === '' && !$reply['calls'] && !in_array($reply['finish'], ['content_filter', 'refusal'], true)) {
                throw new UpstreamError($c['provider']['name'], 0, 'Empty reply');
            }
            send(['type' => 'meta', 'model' => cid($c)]);
            return $reply;
        } catch (RuntimeException $e) {
            $lastError = $e;
            error_log('[chat] ' . cid($c) . ' failed: ' . $e->getMessage());
            if ($streamed) send(['type' => 'rewind', 'chars' => $streamed]);

            $verdict = classify($e);
            $now = time();
            if ($verdict === 'daily' && !empty($c['provider']['perModelLimits'])) {
                cooling([cid($c) => $now + DAILY_COOLDOWN_S]);
            } elseif ($verdict === 'daily' || $verdict === 'provider') {
                // A spent allowance or a bad key applies to every model on it.
                $until = $now + ($verdict === 'daily' ? DAILY_COOLDOWN_S : COOLDOWN_S);
                $ruledOut[$c['provider']['name']] = true;
                $bench = [];
                foreach ($candidates as $other) {
                    if ($other['provider']['name'] === $c['provider']['name']) $bench[cid($other)] = $until;
                }
                cooling($bench);
            } elseif ($verdict === 'cool') {
                cooling([cid($c) => $now + COOLDOWN_S]);
            }
        }
    }

    throw $lastError;
}

/**
 * One streamed request to one model. Text is forwarded to the visitor as it
 * arrives; tool calls are assembled whole from their fragments.
 */
function stream_one(array $c, array $history, float $deadline, int &$streamed): array
{
    $name = $c['provider']['name'];
    $s = (object) ['buffer' => '', 'text' => '', 'calls' => [], 'finish' => null, 'started' => false, 'done' => false, 'error' => null, 'errorBody' => ''];
    $firstByteBy = microtime(true) + min(FIRST_BYTE_S, max(1, $deadline - microtime(true)));

    $ch = curl_init($c['provider']['endpoint']);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(request_body($c, $history), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $c['key'], 'Content-Type: application/json', ...($c['provider']['headers'] ?? [])],
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 110,
        CURLOPT_NOPROGRESS => false,
        // A model that never starts is abandoned for the next one; once it is
        // streaming it has as long as it needs.
        CURLOPT_XFERINFOFUNCTION => static fn () => !$s->started && microtime(true) > $firstByteBy ? 1 : 0,
        CURLOPT_WRITEFUNCTION => static function ($ch, string $chunk) use ($s, $name, &$streamed): int {
            if (curl_getinfo($ch, CURLINFO_RESPONSE_CODE) >= 400) {
                $s->errorBody .= substr($chunk, 0, 2000);
                return strlen($chunk);
            }
            $s->started = true;
            try {
                relay($s, $chunk, $name, $streamed);
            } catch (UpstreamError $e) {
                $s->error = $e;
                return 0; // aborts the transfer
            }
            return strlen($chunk);
        },
    ]);

    curl_exec($ch);
    $errno = curl_errno($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($s->error) throw $s->error;
    if ($status >= 400) throw new UpstreamError($name, $status, $s->errorBody);
    if ($errno && !$s->done) {
        if (!$s->started) throw new UpstreamError($name, 0, $errno === CURLE_ABORTED_BY_CALLBACK ? 'No response within ' . FIRST_BYTE_S . 's' : curl_strerror($errno));
        throw new UpstreamError($name, 0, 'Stream broke: ' . curl_strerror($errno));
    }
    // A stream that closes with no finish reason was cut off, not finished.
    if (!$s->done && !$s->finish) throw new UpstreamError($name, 0, 'Stream ended early');

    ksort($s->calls);
    return ['text' => $s->text, 'calls' => array_values($s->calls), 'finish' => $s->finish];
}

/** Parses OpenAI-style SSE chunks, which may arrive split anywhere. */
function relay(object $s, string $chunk, string $provider, int &$streamed): void
{
    $s->buffer .= $chunk;
    $lines = explode("\n", $s->buffer);
    $s->buffer = array_pop($lines);

    foreach ($lines as $raw) {
        if ($s->done) return;
        $line = trim($raw);
        // Blank lines end frames; lines starting ':' are keep-alives.
        if (!str_starts_with($line, 'data:')) continue;
        $data = trim(substr($line, 5));
        if ($data === '[DONE]') {
            $s->done = true;
            return;
        }

        $event = json_decode($data, true);
        if (!is_array($event)) continue;
        // An upstream failure after streaming started comes as a chunk.
        if (isset($event['error'])) {
            $err = $event['error'];
            throw new UpstreamError($provider, (int) ($err['code'] ?? 0), (string) ($err['message'] ?? json_encode($err)));
        }

        $choice = $event['choices'][0] ?? null;
        if (!is_array($choice)) continue;
        $delta = $choice['delta'] ?? [];

        if (isset($delta['content']) && is_string($delta['content']) && $delta['content'] !== '') {
            $s->text .= $delta['content'];
            // Counted the way the browser will slice it: UTF-16 code units.
            $streamed += intdiv(strlen(mb_convert_encoding($delta['content'], 'UTF-16LE', 'UTF-8')), 2);
            send(['type' => 'text', 'text' => $delta['content']]);
        }

        foreach ($delta['tool_calls'] ?? [] as $part) {
            $i = (int) ($part['index'] ?? 0);
            $s->calls[$i] ??= ['id' => '', 'type' => 'function', 'function' => ['name' => '', 'arguments' => '']];
            if (!empty($part['id'])) $s->calls[$i]['id'] = $part['id'];
            if (isset($part['function']['name'])) $s->calls[$i]['function']['name'] .= $part['function']['name'];
            if (isset($part['function']['arguments'])) $s->calls[$i]['function']['arguments'] .= $part['function']['arguments'];
        }

        if (!empty($choice['finish_reason'])) $s->finish = $choice['finish_reason'];
    }
}

/* ==========================================================================
   Tools
   ========================================================================== */

function run_tool(string $name, string $rawArgs): string
{
    $input = json_decode($rawArgs !== '' ? $rawArgs : '{}', true);
    if (!is_array($input)) return 'The arguments were not valid JSON. Try the call again.';

    if ($name === 'open_enquiry_form') {
        // The browser does the work; the event rides the same stream as the text.
        send(['type' => 'action', 'name' => 'open_enquiry_form', 'path' => $input['path'] ?? null]);
        return 'The form is open on their screen with that path selected.';
    }

    if ($name === 'capture_lead') {
        $lead = [...array_map(static fn ($v) => is_string($v) ? mb_substr($v, 0, 2000) : '', $input), 'source' => 'assistant', 'at' => date(DATE_ATOM)];
        if (deliver_lead($lead)) {
            send(['type' => 'action', 'name' => 'lead_captured']);
            return 'Sent. It will be in the inbox for the next business morning.';
        }
        error_log('[lead] ' . json_encode($lead));
        return "That didn't send. Apologise briefly and give them info@socialhat.com.au and 08 9285 0811 so they are not left with nothing.";
    }

    return "No tool named $name.";
}

/**
 * A webhook if one is set (a CRM, Zapier, Power Automate), otherwise straight
 * to the inbox for that lead's path — on SiteGround there is always a way to
 * mail, so unlike api/chat.js there is no "logged but not delivered" case.
 */
function deliver_lead(array $lead): bool
{
    if ($hook = env('LEAD_WEBHOOK')) return post_json($hook, $lead);

    $path = in_array($lead['path'] ?? '', knowledge()['paths'], true) ? $lead['path'] : 'marketing';
    $lines = [
        'HatBot took these details on the website.',
        '',
        'Name: ' . ($lead['name'] ?? ''),
        'Email: ' . ($lead['email'] ?? ''),
        'Phone: ' . ($lead['phone'] ?? ''),
        'Business: ' . ($lead['business'] ?? ''),
        "Path: $path",
        '',
        $lead['summary'] ?? '',
    ];
    return send_mail(inbox_for($path), 'HatBot lead — ' . ($lead['name'] ?? 'website visitor'), implode("\n", $lines), $lead['email'] ?? null);
}

/* ==========================================================================
   No model
   ========================================================================== */

function answer_without_model(array $messages, array $toolsRun): void
{
    if (in_array('capture_lead', $toolsRun, true)) {
        send(['type' => 'text', 'text' => "Thanks — that's with the team, and they'll be in touch next business day."]);
        return;
    }
    if (in_array('open_enquiry_form', $toolsRun, true)) {
        send(['type' => 'text', 'text' => "I've opened the enquiry form for you — fill it in and the team will come back to you."]);
        return;
    }
    $reply = builtin_reply($messages);
    if (isset($reply['action'])) send(['type' => 'action', ...$reply['action']]);
    send(['type' => 'text', 'text' => $reply['text']]);
    send(['type' => 'meta', 'model' => 'builtin']);
}

/** builtinReply() from api/fallback.js, over the same exported table. */
function builtin_reply(array $messages): array
{
    $f = knowledge()['fallback'];
    $re = static fn (string $source) => '~' . str_replace('~', '\~', $source) . '~u';
    $guess = static function (string $text) use ($f, $re): ?string {
        foreach ($f['topics'] as $t) {
            if (!empty($t['path']) && empty($t['guess']) && preg_match($re($t['match']), $text)) return $t['path'];
        }
        return null;
    };

    $users = array_values(array_filter($messages, static fn ($m) => $m['role'] === 'user'));
    $bots = array_values(array_filter($messages, static fn ($m) => $m['role'] === 'assistant'));
    $text = mb_strtolower(end($users)['content'] ?? '');
    $lastBot = $bots ? end($bots)['content'] : '';

    if (preg_match($re($f['yes']), $text) && str_contains($lastBot, $f['offerMarker'])) {
        $earlier = mb_strtolower(implode(' ', array_column($users, 'content')));
        return ['text' => $f['openedReply'], 'action' => ['name' => 'open_enquiry_form', 'path' => $guess($earlier) ?? 'marketing']];
    }

    foreach ($f['topics'] as $t) {
        if (!preg_match($re($t['match']), $text)) continue;
        $reply = ['text' => $t['reply']];
        if (!empty($t['action'])) {
            $path = (!empty($t['guess']) ? $guess($text) : null) ?? $t['path'];
            if (in_array($path, knowledge()['paths'], true)) $reply['action'] = ['name' => 'open_enquiry_form', 'path' => $path];
        }
        return $reply;
    }

    return ['text' => $f['unknownReply']];
}

/* ==========================================================================
   Input — everything from the browser is hostile until it has been through
   here. Roles narrowed, content forced to a string, length and count capped,
   leading non-user turns dropped.
   ========================================================================== */

function sanitise(mixed $raw): array
{
    if (!is_array($raw)) return [];
    $clean = [];
    foreach ($raw as $m) {
        if (!is_array($m) || !in_array($m['role'] ?? null, ['user', 'assistant'], true) || !is_string($m['content'] ?? null)) continue;
        $content = mb_substr($m['content'], 0, MAX_CHARS);
        if (trim($content) === '') continue;
        $clean[] = ['role' => $m['role'], 'content' => $content];
    }
    $clean = array_slice($clean, -MAX_MESSAGES);
    while ($clean && $clean[0]['role'] !== 'user') array_shift($clean);
    return $clean;
}

/* ==========================================================================
   The stream
   ========================================================================== */

/**
 * Everything between PHP and the visitor wants to buffer: PHP's own output
 * buffer, zlib, Apache's gzip, SiteGround's nginx in front. Each is switched
 * off here, and the rest by .htaccess, or the reply arrives all at once — the
 * exact thing streaming is for avoiding.
 */
function sse_open(): void
{
    @ini_set('zlib.output_compression', '0');
    if (function_exists('apache_setenv')) @apache_setenv('no-gzip', '1');
    while (ob_get_level() > 0) ob_end_flush();
    set_time_limit(120);

    header('Content-Type: text/event-stream; charset=utf-8');
    header('Cache-Control: no-cache, no-transform');
    header('X-Accel-Buffering: no'); // nginx: pass each flush straight through

    // A comment frame the client ignores, big enough to push any fixed-size
    // proxy buffer over its threshold so the first real event is not held.
    echo ':' . str_repeat(' ', 2048) . "\n\n";
    flush();
}

function send(array $event): void
{
    echo 'data: ' . json_encode($event, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n\n";
    flush();
}
