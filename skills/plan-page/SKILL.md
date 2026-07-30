---
name: plan-page
description: Turn a task into a reviewable implementation plan, render it as a self-contained HTML page, and publish it to a random subdomain of your own domain so it can be shared as a link. Use when the user asks to plan a task or feature and wants the plan as a shareable page or URL rather than terminal output, or asks to publish, host, or share a plan, or to update a plan page that was published earlier. Runs on a Cloudflare Worker plus KV that the user deploys once; publishing after that is a single authenticated request with no build or deploy step.
---

# Plan Page

Use this skill to produce an implementation plan for a task, render it as one
self-contained HTML file, and publish it at `https://<slug>.<their-domain>` so the
user can share the link.

The plan is the point. The page is how it travels. Do the research before writing
any HTML — a beautifully rendered plan built on guesses is worse than no plan,
because it looks authoritative.

## Requirements

Two environment variables, set by the user during setup:

- `PLAN_PAGE_DOMAIN` — the zone the plans are served from, e.g. `example.com`
- `PLAN_PAGE_TOKEN` — bearer token for the publish endpoint

If either is missing, do not attempt to publish. Tell the user the one-time setup
has not been done and walk them through `worker/SETUP.md`, which deploys the
Worker and KV namespace to their own Cloudflare account. Setup is ~10 minutes and
happens once; after that, publishing never deploys anything.

## Build The Plan

1. Read the task from the user's request. If the target scope is ambiguous enough
   that two readings would produce materially different plans, ask before writing.
2. Read the repository's own instructions first: `AGENTS.md`, `CLAUDE.md`,
   `README.md`, package scripts, and any architecture or contributing docs.
3. Investigate the actual code paths the task touches. Find the files that will
   change, the existing patterns to follow, the tests that cover the area, and the
   places that will break. Cite real locations as `path/to/file.ts:42`.
4. Decide the sequence. Each step should be one reviewable commit that leaves the
   repository in a working state.
5. Name what is explicitly out of scope, and the risks with what to do about each.

A plan is ready to render when someone who has not read the codebase could follow
it, and someone who has could tell you where it is wrong.

## Render The Page

Read `template.html` and use it as the shell. Keep the `<style>` and `<script>`
blocks verbatim — they carry the theming, print layout, and per-browser checkbox
progress. Replace the content:

- `<title>`, `og:title`, and `<h1>`: the plan title, specific rather than generic
- `<meta name="description">`, `og:description`, and `.lede`: one sentence on what
  the plan achieves. This is the text that shows in Slack and WhatsApp previews.
- `.chips`: repo or project, branch, date. Drop any chip that does not apply.
- The `Context`, `Out of scope`, `Steps`, `Risks`, and `Verification` sections.
  Add sections when the task calls for them; remove ones with nothing real to say
  rather than padding them.
- Each step is one `<li class="step">` with the checkbox input kept intact.

Constraints on the HTML:

- Self-contained. No external stylesheets, scripts, fonts, or images. Everything
  inline, any asset as a `data:` URI.
- Write the file to the session scratchpad directory, not into the user's repo,
  unless they ask for it on disk.

**Never put credentials, tokens, private keys, customer data, or internal
hostnames in the page.** The URL is unlisted, not secret — anyone with the link can
read it, and it is served over the public internet. If the plan genuinely needs to
reference a secret, name the variable, not the value.

## Publish

Create a new plan page:

```bash
curl -sS -X POST "https://$PLAN_PAGE_DOMAIN/publish" \
  -H "Authorization: Bearer $PLAN_PAGE_TOKEN" \
  -H 'Content-Type: text/html; charset=utf-8' \
  --data-binary @plan.html
```

The response carries the slug and the live URL:

```json
{ "slug": "k7f2q9", "url": "https://k7f2q9.example.com", "title": "..." }
```

Report the URL to the user plainly. Keep the slug and the local HTML path — both
are needed to update the page later.

## Update An Existing Page

When the plan changes — steps completed, scope revised, a risk resolved — update it
in place so the link the user already shared stays valid. Never publish a second
page for the same task unless the user asks for one.

```bash
curl -sS -X PUT "https://$PLAN_PAGE_DOMAIN/publish/$SLUG" \
  -H "Authorization: Bearer $PLAN_PAGE_TOKEN" \
  -H 'Content-Type: text/html; charset=utf-8' \
  --data-binary @plan.html
```

Edit the local HTML file and re-`PUT` it. Do not regenerate the page from scratch
when only part of it changed — that loses wording the user may have already read
and reacted to.

If the slug is not in the current conversation, list what is published and match on
title:

```bash
curl -sS "https://$PLAN_PAGE_DOMAIN/publish" \
  -H "Authorization: Bearer $PLAN_PAGE_TOKEN"
```

Ask the user to confirm the match before overwriting. `PUT` replaces the page with
no history.

Delete one only when asked:

```bash
curl -sS -X DELETE "https://$PLAN_PAGE_DOMAIN/publish/$SLUG" \
  -H "Authorization: Bearer $PLAN_PAGE_TOKEN"
```

## Do Not

- Do not implement the plan as part of this skill. It produces the plan and the
  page. Implementation is a separate request.
- Do not publish a plan built on assumptions you could have checked in the code.
- Do not redeploy the Worker to publish a plan. Publishing is one HTTP request;
  `wrangler deploy` is only for changes to `worker/src/index.js`.

## Failure Modes

`unauthorized` — `PLAN_PAGE_TOKEN` does not match the Worker's `PUBLISH_TOKEN`
secret. The user has to reconcile them; see step 3 of `worker/SETUP.md`.

`body too large` — the page exceeds 1 MiB, which for a plan almost always means an
embedded image or base64 blob. Cut it.

Publish succeeds but the URL fails to resolve or warns on SSL — this is DNS or TLS
configuration in their zone, not the plan. Point them at the troubleshooting
section of `worker/SETUP.md` rather than guessing.
