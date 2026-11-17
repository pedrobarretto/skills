# Cloudflare setup

Files live in an R2 bucket and are served by a small Worker (`src/index.ts`) on `*.workers.dev`. R2 has no egress fees, and the Worker answers repeated hits from the edge cache, so serving public files costs nothing within the free tiers: R2 gives 10 GB of storage, 1 million writes and 10 million reads a month, and Workers give 100,000 requests a day.

Uploads use `wrangler r2 object put` with Wrangler's own login. No API token or S3 key is stored on disk.

## Prerequisites

- A Cloudflare account with R2 enabled (Dashboard → R2 → enable; it asks for a payment method even on the free tier).
- Node.js 20 or newer.
- A Wrangler login: `npx wrangler@4 login`. Run Wrangler from this directory, never from `$HOME`: a `~/.wrangler/` directory hides the login.

## 1. Create the bucket

From this `cloudflare/` directory:

```bash
npm install
npx wrangler r2 bucket create file-upload
```

To use another name, change `bucket_name` in `wrangler.jsonc` too.

## 2. Deploy the Worker

```bash
npm run typecheck
npm run deploy
```

Wrangler prints the Worker's URL, `https://file-upload.<account-subdomain>.workers.dev`. That origin is the public base URL.

What the Worker does:

- `GET` and `HEAD` by path; anything else gets `405`.
- `cache-control: public, max-age=31536000, immutable`, because every key is unique and never overwritten.
- The edge cache (Cache API) answers repeated hits, so they don't become R2 Class B reads. Missing paths are cached for a minute.
- The stored content type, or one guessed from the extension when the object has none.
- `x-robots-tag: noindex, nofollow, noarchive` on every response.
- A cheap `403` for known bulk crawlers by User-Agent (`BLOCKED_AGENTS`, including `github-pr-tongyi`). GitHub's image proxy, `github-camo`, is allowed.
- `Range` requests for video seeking, served straight from R2.

## 3. Configure the uploader

From the skill directory:

```bash
./scripts/upload.sh --configure
```

Enter the Worker's origin and the bucket name. Both are stored in `~/.config/file-upload/config` (mode 600). Then upload a harmless test file and fetch the returned URL.

## Optional: a custom domain

`*.workers.dev` is enough for PR images. A custom domain such as `files.example.com` needs its zone on Cloudflare:

1. Add the zone to Cloudflare and switch the domain's nameservers to Cloudflare at the registrar. For an apex domain that lives elsewhere, this moves its whole DNS, so copy every existing record first.
2. Add the route to `wrangler.jsonc`, then deploy again:

   ```jsonc
   "routes": [{ "pattern": "files.example.com", "custom_domain": true }]
   ```

   Wrangler creates the DNS record and the certificate.
3. Run `./scripts/upload.sh --configure` again with the new origin.

On a custom domain, a WAF custom rule can also block crawlers before the Worker runs, so they don't count as Worker requests.
