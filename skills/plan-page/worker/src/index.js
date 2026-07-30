/**
 * plan-page worker
 *
 * Serves published plan pages from wildcard subdomains of one zone, and exposes
 * a small authenticated control plane on the apex for creating and updating them.
 *
 *   GET    https://<slug>.example.com/          serve the plan HTML
 *   POST   https://example.com/publish          create a plan  -> { slug, url }
 *   PUT    https://example.com/publish/<slug>   replace a plan in place
 *   GET    https://example.com/publish          list plans (newest first)
 *   DELETE https://example.com/publish/<slug>   delete a plan
 *
 * Bindings (see wrangler.toml.example):
 *   PLANS         KV namespace
 *   PLAN_DOMAIN   var, the zone apex e.g. "example.com"
 *   PUBLISH_TOKEN secret, bearer token for the control plane
 */

// No i/l/o/0/1 — slugs get read aloud and typed by hand.
const SLUG_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const SLUG_LENGTH = 6
const MAX_BODY_BYTES = 1024 * 1024
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/
const RESERVED_SLUGS = new Set(['www', 'api', 'mail', 'ftp', 'admin', 'publish', 'ns1', 'ns2'])

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const host = url.hostname.toLowerCase()
    const domain = (env.PLAN_DOMAIN || '').toLowerCase()

    if (!domain) return json({ error: 'PLAN_DOMAIN is not configured' }, 500)
    if (!env.PLANS) return json({ error: 'PLANS KV namespace is not bound' }, 500)

    if (host === domain || host === `www.${domain}`) {
      return handleControlPlane(request, url, env)
    }
    if (!host.endsWith(`.${domain}`)) return notFound()

    const slug = host.slice(0, -(domain.length + 1))
    if (slug.includes('.')) return notFound() // one level only — TLS covers *.domain, not *.*.domain
    return servePlan(slug, request, url, env)
  },
}

/* ---------------------------------------------------------------- serving */

async function servePlan(slug, request, url, env) {
  if (url.pathname === '/favicon.ico') return new Response(null, { status: 204 })
  if (!SLUG_PATTERN.test(slug)) return notFound()

  const { value, metadata } = await env.PLANS.getWithMetadata(slug, { type: 'text' })
  if (value === null) return notFound()

  // Any other path serves the same plan rather than 404ing — links get mangled.
  const etag = `W/"${metadata?.updatedAt ?? '0'}"`
  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { etag } })
  }

  return new Response(value, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Plans are updated in place, so never serve a stale one from cache.
      'cache-control': 'public, max-age=0, must-revalidate',
      etag,
      // Unlisted, not secret — but keep them out of search results.
      'x-robots-tag': 'noindex, nofollow, noarchive',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    },
  })
}

/* ---------------------------------------------------------- control plane */

async function handleControlPlane(request, url, env) {
  const segments = url.pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return new Response('plan-page is up. POST /publish with a bearer token.\n', {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    })
  }
  if (segments[0] !== 'publish') return notFound()
  if (segments.length > 2) return notFound()

  if (!(await isAuthorized(request, env))) {
    return json({ error: 'unauthorized' }, 401, {
      'www-authenticate': 'Bearer realm="plan-page"',
    })
  }

  const slug = segments[1]?.toLowerCase()
  if (slug !== undefined && (!SLUG_PATTERN.test(slug) || RESERVED_SLUGS.has(slug))) {
    return json({ error: 'invalid slug' }, 400)
  }

  switch (`${request.method} ${slug ? 'one' : 'all'}`) {
    case 'POST all':
      return createPlan(request, env)
    case 'PUT one':
      return upsertPlan(slug, request, env)
    case 'DELETE one':
      return deletePlan(slug, env)
    case 'GET all':
      return listPlans(url, env)
    case 'GET one':
      return describePlan(slug, env)
    default:
      return json({ error: 'method not allowed' }, 405)
  }
}

async function createPlan(request, env) {
  const body = await readBody(request)
  if (body.error) return json({ error: body.error }, body.status)

  let slug = null
  for (let attempt = 0; attempt < 5 && slug === null; attempt++) {
    const candidate = randomSlug()
    if ((await env.PLANS.get(candidate, { type: 'text' })) === null) slug = candidate
  }
  if (slug === null) return json({ error: 'could not allocate a free slug' }, 503)

  const now = new Date().toISOString()
  await env.PLANS.put(slug, body.html, {
    metadata: { title: body.title, createdAt: now, updatedAt: now },
  })
  return json({ slug, url: planUrl(slug, env), title: body.title, createdAt: now }, 201)
}

async function upsertPlan(slug, request, env) {
  const body = await readBody(request)
  if (body.error) return json({ error: body.error }, body.status)

  const existing = await env.PLANS.getWithMetadata(slug, { type: 'text' })
  const now = new Date().toISOString()
  await env.PLANS.put(slug, body.html, {
    metadata: {
      title: body.title,
      createdAt: existing.metadata?.createdAt ?? now,
      updatedAt: now,
    },
  })
  return json({
    slug,
    url: planUrl(slug, env),
    title: body.title,
    created: existing.value === null,
    updatedAt: now,
  })
}

async function deletePlan(slug, env) {
  await env.PLANS.delete(slug)
  return json({ slug, deleted: true })
}

async function describePlan(slug, env) {
  const { value, metadata } = await env.PLANS.getWithMetadata(slug, { type: 'text' })
  if (value === null) return json({ error: 'not found' }, 404)
  return json({ slug, url: planUrl(slug, env), bytes: value.length, ...metadata })
}

async function listPlans(url, env) {
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 1000)
  const { keys } = await env.PLANS.list({ limit })
  const plans = keys
    .map((key) => ({ slug: key.name, url: planUrl(key.name, env), ...key.metadata }))
    .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
  return json({ count: plans.length, plans })
}

/* ---------------------------------------------------------------- helpers */

async function readBody(request) {
  const declared = Number(request.headers.get('content-length'))
  if (declared > MAX_BODY_BYTES) return { error: 'body too large', status: 413 }

  const html = await request.text()
  if (!html.trim()) return { error: 'body is empty', status: 400 }
  if (new TextEncoder().encode(html).byteLength > MAX_BODY_BYTES) {
    return { error: 'body too large', status: 413 }
  }
  return { html, title: extractTitle(request, html) }
}

function extractTitle(request, html) {
  const header = request.headers.get('x-plan-title')
  if (header?.trim()) return header.trim().slice(0, 200)
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? decodeEntities(match[1].trim()).slice(0, 200) : 'Untitled plan'
}

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function randomSlug() {
  const bytes = crypto.getRandomValues(new Uint8Array(SLUG_LENGTH))
  let slug = ''
  for (const byte of bytes) slug += SLUG_ALPHABET[byte % SLUG_ALPHABET.length]
  return slug
}

/**
 * Compares digests rather than the raw tokens so a mismatched length does not
 * make timingSafeEqual throw, and does not leak the expected length either.
 */
async function isAuthorized(request, env) {
  const expected = env.PUBLISH_TOKEN
  const provided = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!expected || !provided) return false

  const encoder = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ])
  return crypto.subtle.timingSafeEqual(a, b)
}

function planUrl(slug, env) {
  return `https://${slug}.${env.PLAN_DOMAIN}`
}

function json(payload, status = 200, headers = {}) {
  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  })
}

function notFound() {
  return new Response('Not found\n', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
    },
  })
}
