# Vercel setup

Use one small Vercel project as a custom-domain proxy in front of a public Vercel Blob store. Uploads go directly to Blob, so they do not pass through a Vercel Function's request-size limit.

## Prerequisites

- A Vercel account and the Vercel CLI.
- A domain or subdomain whose DNS you can edit.
- Node.js 20 or newer.

## 1. Create and link a project

From this `vercel/` directory, create a separate Vercel project:

```bash
npx vercel@59.1.4 link
```

## 2. Create a public Blob store

Create and connect a public store to the linked project:

```bash
npx vercel@59.1.4 blob create-store file-upload --access public --yes
```

Upload a harmless test file with `vercel blob put` and copy the host from its `*.public.blob.vercel-storage.com` URL.

## 3. Configure the proxy

Copy `vercel.json.example` to the ignored `vercel.json`, then replace `REPLACE_WITH_PUBLIC_BLOB_HOST` with the Blob host from the previous step.

Deploy the project:

```bash
npx vercel@59.1.4 --prod --yes
```

## 4. Connect a custom domain

Add the intended domain to this Vercel project. Create only the DNS record Vercel requests, typically a CNAME for a subdomain. You do not need to move the apex domain or its nameservers.

Wait for Vercel to mark the domain configuration valid and issue TLS.

## 5. Configure the uploader

From the skill directory, run:

```bash
./scripts/upload.sh --configure
```

Enter the custom HTTPS origin and link the same Vercel project. The script pulls `BLOB_READ_WRITE_TOKEN` into a mode-600 file under `~/.config/file-upload/`; the base URL and project link are stored there too. No shell-only variable is required, and no credential is written to the skill repository.

Finally, upload a non-sensitive test file and fetch the returned custom-domain URL.
