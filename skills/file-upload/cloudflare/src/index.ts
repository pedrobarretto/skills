/**
 * Public, read-only file host for the file-upload skill.
 *
 * Serves objects from the R2 bucket bound as `FILES` at `/<key>`. Keys are
 * unique (`YYYY/MM/DD/<name>-<12 hex>.<ext>`) and never overwritten, so every
 * response is cached for a year at the edge and in browsers. Repeated hits are
 * answered from the Cache API, so they don't become R2 Class B reads.
 */

type Env = {
  readonly FILES: R2Bucket;
};

const IMMUTABLE = 'public, max-age=31536000, immutable';
const MISSING_TTL = 'public, max-age=60';

/**
 * Bulk crawlers that download every image of public PRs. GitHub's own image
 * proxy (`github-camo`) is not on this list, so PR embeds keep working.
 */
const BLOCKED_AGENTS =
  /github-pr-tongyi|tongyi|bytespider|gptbot|ccbot|claudebot|anthropic-ai|perplexitybot|amazonbot|meta-externalagent|petalbot|yisouspider|imagesiftbot|diffbot|omgili|dataforseobot|ahrefsbot|semrushbot|mj12bot|dotbot/i;

/** Fallback content types, used when an object was stored without one. */
const TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pdf: 'application/pdf',
  json: 'application/json',
  html: 'text/html; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  diff: 'text/plain; charset=utf-8',
  log: 'text/plain; charset=utf-8',
} as const satisfies Record<string, string>;

const isTypedExtension = (ext: string): ext is keyof typeof TYPES => Object.hasOwn(TYPES, ext);

const typeFor = (key: string): string => {
  const ext = key.slice(key.lastIndexOf('.') + 1).toLowerCase();
  return isTypedExtension(ext) ? TYPES[ext] : 'application/octet-stream';
};

const baseHeaders = (): Headers =>
  new Headers({
    'x-robots-tag': 'noindex, nofollow, noarchive',
    'x-content-type-options': 'nosniff',
    'access-control-allow-origin': '*',
  });

const plain = (status: number, body: string, extra: Record<string, string> = {}): Response => {
  const headers = baseHeaders();
  headers.set('content-type', 'text/plain; charset=utf-8');
  headers.set('cache-control', 'no-store');
  for (const [name, value] of Object.entries(extra)) headers.set(name, value);
  return new Response(body, { status, headers });
};

/** Headers for a stored object: its own metadata, our cache policy and a sane type. */
const objectHeaders = (key: string, object: R2Object): Headers => {
  const headers = baseHeaders();
  object.writeHttpMetadata(headers);
  const stored = headers.get('content-type');
  if (!stored || stored === 'application/octet-stream') headers.set('content-type', typeFor(key));
  headers.set('cache-control', IMMUTABLE);
  headers.set('etag', object.httpEtag);
  headers.set('last-modified', object.uploaded.toUTCString());
  headers.set('accept-ranges', 'bytes');
  headers.set('content-length', String(object.size));
  return headers;
};

const hasBody = (object: R2Object | R2ObjectBody): object is R2ObjectBody => 'body' in object;

/** Range requests (video seeking) skip the edge cache, which can't store partial responses. */
const serveRange = async (env: Env, key: string, request: Request): Promise<Response> => {
  const object = await env.FILES.get(key, { range: request.headers, onlyIf: request.headers });
  if (!object) return plain(404, 'Not found\n');
  const headers = objectHeaders(key, object);
  if (!hasBody(object)) return new Response(null, { status: 304, headers });
  const range = object.range;
  if (range && 'offset' in range) {
    const offset = range.offset ?? 0;
    const length = range.length ?? object.size - offset;
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('content-length', String(length));
    return new Response(request.method === 'HEAD' ? null : object.body, { status: 206, headers });
  }
  return new Response(request.method === 'HEAD' ? null : object.body, { headers });
};

/** The object key a URL names, or null for a directory-like or malformed path. */
const keyOf = (url: URL): string | null => {
  try {
    const key = decodeURIComponent(url.pathname.slice(1));
    return key === '' || key.endsWith('/') ? null : key;
  } catch {
    return null;
  }
};

const handle = async (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return plain(405, 'Method not allowed\n', { allow: 'GET, HEAD' });
  }
  if (BLOCKED_AGENTS.test(request.headers.get('user-agent') ?? '')) {
    return plain(403, 'Forbidden\n');
  }

  const url = new URL(request.url);
  const key = keyOf(url);
  if (key === null) return plain(404, 'Not found\n');

  if (request.headers.has('range')) return serveRange(env, key, request);

  // One cache entry per key: the query string and the method don't split it.
  const cache = caches.default;
  const cacheKey = new Request(`${url.origin}${url.pathname}`, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const etag = cached.headers.get('etag');
    if (etag !== null && request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: cached.headers });
    }
    return request.method === 'HEAD' ? new Response(null, { headers: cached.headers }) : cached;
  }

  const object = await env.FILES.get(key);
  if (!object) {
    const missing = plain(404, 'Not found\n', { 'cache-control': MISSING_TTL });
    ctx.waitUntil(cache.put(cacheKey, missing.clone()));
    return missing;
  }

  const response = new Response(object.body, { headers: objectHeaders(key, object) });
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return request.method === 'HEAD' ? new Response(null, { headers: response.headers }) : response;
};

export default {
  fetch: handle,
} satisfies ExportedHandler<Env>;
