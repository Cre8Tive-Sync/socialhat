<?php
/**
 * The Instagram feed on SiteGround — the PHP port of api/instagram.js.
 *
 * Same reasons for going through the server: the token is a bearer credential
 * for the account and must not be in the page, and Instagram rate-limits per
 * token, so one cached call should serve every visitor. The cache is a file
 * here rather than module memory, which makes it better than the original — it
 * survives between requests instead of only while an instance stays warm.
 */

declare(strict_types=1);
require __DIR__ . '/_lib.php';

const LIMIT = 6;        // two rows of three
const TTL_S = 15 * 60;  // an agency posts a few times a week; this protects the token, not freshness

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') json_out(['error' => 'Use GET.'], 405);

$seed = env('INSTAGRAM_TOKEN');
$handle = env('INSTAGRAM_HANDLE') ?? 'socialhat.media';

// No token: the grid renders its follow card, which is a working link.
if (!$seed) feed(['handle' => $handle, 'posts' => [], 'reason' => 'unconfigured']);

$cacheFile = cache_dir('instagram') . '/feed.json';
$cached = is_file($cacheFile) ? json_decode((string) file_get_contents($cacheFile), true) : null;

if (is_array($cached) && time() - ($cached['at'] ?? 0) < TTL_S) feed($cached['payload'], 'HIT');

// Only on a cache miss — at most every 15 minutes — so the renewal check below
// costs nothing on the requests that matter.
$token = current_token($seed);

$url = 'https://graph.instagram.com/v21.0/me/media?' . http_build_query([
    'fields' => 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp',
    'limit' => LIMIT,
    'access_token' => $token,
]);
$ch = curl_init($url);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_TIMEOUT => 6]);
$body = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);
$data = is_string($body) ? json_decode($body, true) : null;

if ($status !== 200 || !is_array($data) || isset($data['error'])) {
    // Overwhelmingly an expired token: long-lived tokens last 60 days, so this
    // goes wrong about two months after setup and then stays wrong quietly.
    error_log('[instagram] ' . (is_array($data) && isset($data['error']) ? json_encode($data['error']) : "HTTP $status"));
    // Anything cached, however old, beats nothing — a stale feed still proves
    // the account is alive, which is the whole point of the section.
    if (!empty($cached['payload']['posts'])) feed($cached['payload'], 'STALE');
    feed(['handle' => $handle, 'posts' => [], 'reason' => 'upstream'], 'MISS');
}

$posts = [];
foreach ($data['data'] ?? [] as $post) {
    $video = ($post['media_type'] ?? '') === 'VIDEO';
    // A video's media_url is the video file; the thumbnail belongs in a grid.
    $src = $video ? ($post['thumbnail_url'] ?? null) : ($post['media_url'] ?? null);
    if (!$src) continue;
    $posts[] = [
        'id' => $post['id'] ?? null,
        'src' => $src,
        'video' => $video,
        'href' => $post['permalink'] ?? null,
        'caption' => mb_substr(explode("\n", $post['caption'] ?? '')[0], 0, 140),
        'at' => $post['timestamp'] ?? null,
    ];
}

$payload = ['handle' => $handle, 'reason' => null, 'posts' => $posts];
@file_put_contents($cacheFile, json_encode(['at' => time(), 'payload' => $payload]), LOCK_EX);
feed($payload, 'MISS');

/**
 * The token to use, renewed before it can expire.
 *
 * Long-lived Instagram tokens die 60 days after they were issued unless they
 * are refreshed, and a refresh is allowed once a token is a day old. Left alone,
 * the feed goes quiet two months after setup and nobody notices. So the token
 * pasted into secrets.php is only the seed: the working copy lives in the cache
 * and is swapped for a fresh one weekly, retrying daily if Instagram says no.
 *
 * A different token pasted into secrets.php — after a password change, say —
 * replaces the stored one, which is what whoever pasted it expects.
 */
function current_token(string $seed): string
{
    return with_json_file(cache_dir('instagram') . '/token.json', static function (array $s) use ($seed) {
        $now = time();
        $seedId = hash('sha256', $seed);
        if (($s['seed'] ?? null) !== $seedId || empty($s['token'])) {
            // Its age is unknown, so it is due at once. A token under a day old
            // is refused, and simply tried again tomorrow.
            $s = ['seed' => $seedId, 'token' => $seed, 'refreshedAt' => 0, 'triedAt' => 0];
        }
        if ($now - $s['refreshedAt'] > 7 * 86400 && $now - $s['triedAt'] > 86400) {
            $s['triedAt'] = $now;
            if ($fresh = refresh_token($s['token'])) {
                $s['token'] = $fresh;
                $s['refreshedAt'] = $now;
            }
        }
        return [$s, $s['token']];
    });
}

function refresh_token(string $token): ?string
{
    $ch = curl_init('https://graph.instagram.com/refresh_access_token?' . http_build_query([
        'grant_type' => 'ig_refresh_token',
        'access_token' => $token,
    ]));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_TIMEOUT => 6]);
    $body = curl_exec($ch);
    curl_close($ch);
    $data = is_string($body) ? json_decode($body, true) : null;
    if (is_array($data) && !empty($data['access_token']) && is_string($data['access_token'])) return $data['access_token'];
    // Never the token itself — logs are not a place for credentials.
    error_log('[instagram] token refresh refused: ' . json_encode($data['error'] ?? 'no response'));
    return null;
}

function feed(array $payload, ?string $cacheState = null): never
{
    json_out($payload, 200, [
        // SiteGround's CDN and dynamic cache hold it for the same window, and
        // keep serving the old copy for a day while revalidating.
        'Cache-Control' => 'public, max-age=300, s-maxage=900, stale-while-revalidate=86400',
        ...($cacheState ? ['X-Feed-Cache' => $cacheState] : []),
    ]);
}
