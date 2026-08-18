---
name: file-upload
description: Upload local files to a configured Vercel Blob store and return stable public URLs on a custom domain. Use when the user asks to upload, host, publish, attach, or share a local file; needs a public URL for a screenshot, image, video, document, or artifact; or needs media for a GitHub pull request, issue, or comment.
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

This persists the public base URL and Vercel project link under `~/.config/file-upload/`, so configuration survives shell sessions. It intentionally relies on the Vercel CLI's durable login instead of a temporary shell variable.

If no upload host exists yet, read [vercel/SETUP.md](vercel/SETUP.md) and provision one before configuring the uploader.

## Use the URL in GitHub

- Embed images (`png`, `jpg`, `jpeg`, `gif`, `webp`) as `![description](URL)`.
- Link videos (`mp4`, `mov`, `webm`) as `[screen recording](URL)` because GitHub does not reliably inline-play externally hosted video.
- Link other files with a descriptive label, such as `[debug log](URL)`.
- When a short video benefits from an inline preview, generate and upload a GIF as well, then embed the GIF and link the full-quality video below it.

## Safety

- Treat every uploaded file as public. Never upload credentials, private keys, access tokens, customer data, or other sensitive material.
- Use the generated immutable URL. Do not assume a filename maps to a predictable object path.
- On authentication or configuration errors, report the problem instead of retrying with guessed credentials.
