# plan-page setup

One-time, ~10 minutes. After this, publishing a plan is a single `curl`.

## What you need

- A domain whose nameservers point at Cloudflare. The free plan is enough.
- A Cloudflare account. Free tier covers this comfortably: KV allows 1,000 writes
  and 100,000 reads per day.

Use a **dedicated domain** if you can. Setup adds a wildcard DNS record, so every
subdomain you have not explicitly declared starts resolving to this Worker. More
specific records still win over the wildcard, so an existing `www` or `api` keeps
working — but on a domain that serves production traffic, that is a change worth
making deliberately rather than by accident.

## Why the URL is `<slug>.example.com` and not `<slug>.plans.example.com`

Cloudflare's free Universal SSL certificate covers the apex and **one** level of
wildcard: `example.com` and `*.example.com`. A second level —
`<slug>.plans.example.com` — is not covered and needs Advanced Certificate
Manager, which is a paid add-on. Publishing at the first level keeps this free.

## 1. Configure

```bash
cd skills/plan-page/worker
cp wrangler.toml.example wrangler.toml
```

Replace every `example.com` in `wrangler.toml` with your domain.

## 2. Log in and create the KV namespace

```bash
npx wrangler login
npx wrangler kv namespace create PLANS
```

Copy the printed `id` into the `[[kv_namespaces]]` block in `wrangler.toml`.

## 3. Set the publish token

Generate one and keep it — you will need the same value in your shell:

```bash
openssl rand -hex 32
npx wrangler secret put PUBLISH_TOKEN   # paste the value at the prompt
```

## 4. Add the wildcard DNS record

Worker routes only fire on hostnames that actually resolve through Cloudflare, so
the wildcard needs a proxied record. In the Cloudflare dashboard, under
**DNS → Records**, add:

| Type | Name | Content | Proxy  |
| ---- | ---- | ------- | ------ |
| AAAA | `*`  | `100::` | Proxied (orange cloud) |

`100::` is the IPv6 discard prefix. Nothing is ever sent there — the record exists
only so Cloudflare accepts the hostname and hands the request to the Worker. Add
the same record for `@` (the apex) if the apex is not already pointed somewhere.

## 5. Deploy

```bash
npx wrangler deploy
```

## 6. Export the config your agent reads

Add to `~/.zshrc` (or `~/.bashrc`):

```bash
export PLAN_PAGE_DOMAIN="example.com"
export PLAN_PAGE_TOKEN="the-token-from-step-3"
```

Then `source ~/.zshrc`.

## 7. Verify

```bash
curl -sS https://$PLAN_PAGE_DOMAIN/
# plan-page is up. POST /publish with a bearer token.

printf '<!doctype html><title>Smoke test</title><h1>It works</h1>' \
  | curl -sS -X POST "https://$PLAN_PAGE_DOMAIN/publish" \
      -H "Authorization: Bearer $PLAN_PAGE_TOKEN" \
      -H 'Content-Type: text/html' \
      --data-binary @-
# { "slug": "k7f2q9", "url": "https://k7f2q9.example.com", ... }
```

Open the returned URL. Then clean up:

```bash
curl -sS -X DELETE "https://$PLAN_PAGE_DOMAIN/publish/k7f2q9" \
  -H "Authorization: Bearer $PLAN_PAGE_TOKEN"
```

## Redeploying

Only needed when `src/index.js` changes: `npx wrangler deploy`. Publishing a plan
never redeploys anything.

## Troubleshooting

**The slug URL returns a Cloudflare 1016 or DNS error.** The wildcard record from
step 4 is missing, or it is set to DNS-only instead of Proxied.

**The slug URL returns an SSL warning.** Universal SSL can take a few minutes to
issue after the zone is added. If it persists, check that you are on the first
wildcard level — see the note above.

**`unauthorized` on publish.** `PLAN_PAGE_TOKEN` in your shell does not match the
`PUBLISH_TOKEN` secret in the Worker. Re-run step 3.

**Publish succeeds but the URL 404s.** The `*.example.com/*` route is missing from
`wrangler.toml`, or `PLAN_DOMAIN` does not match the zone. Both are in step 1.
