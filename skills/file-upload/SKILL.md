---
name: file-upload
description: Upload local files to a Cloudflare R2 bucket and return stable public URLs served by a small Worker. Use when the user asks to upload, host, publish, attach, or share a local file; needs a public URL for a screenshot, image, video, document, or artifact; or needs media for a GitHub pull request, issue, or comment.
---

# File upload

Upload files with the bundled script and return each public URL to the user.

## Upload

Run from this skill directory:

```bash
./scripts/upload.sh <path-to-file> [more-files...]
```

The script prints one permanent public URL per file. Use the returned URL directly.

If configuration is missing, run:

```bash
./scripts/upload.sh --configure
```

This persists the public base URL and the R2 bucket name in `~/.config/file-upload/config`, so configuration survives shell sessions. Uploads go through Wrangler's durable login (`npx wrangler@4 login`), so no credential is stored on disk by this skill.

If no bucket and Worker exist yet, read [cloudflare/SETUP.md](cloudflare/SETUP.md) and provision them before configuring the uploader. The old Vercel Blob host in `vercel/` is legacy and no longer used.

Files up to 300 MiB can be uploaded (Wrangler's limit). The host blocks known bulk crawlers and marks every file `noindex`.

## Use the URL in GitHub

- Embed images (`png`, `jpg`, `jpeg`, `gif`, `webp`) as `![description](URL)`.
- Link videos (`mp4`, `mov`, `webm`) as `[screen recording](URL)` because GitHub does not reliably inline-play externally hosted video.
- Link other files with a descriptive label, such as `[debug log](URL)`.
- When a short video benefits from an inline preview, generate and upload a GIF as well, then embed the GIF and link the full-quality video below it.

## Safety

- Treat every uploaded file as public. Never upload credentials, private keys, access tokens, customer data, or other sensitive material.
- Use the generated immutable URL. Do not assume a filename maps to a predictable object path.
- On authentication or configuration errors, report the problem instead of retrying with guessed credentials.
- Never run Wrangler from `$HOME`: it leaves a `~/.wrangler/` cache that hides the real login. The script always runs it from `~/.config/file-upload/runtime`.
