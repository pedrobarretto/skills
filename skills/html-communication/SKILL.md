---
name: html-communication
description: Create polished, self-contained HTML documents and optionally publish them as stable Postplan URLs. Use when the user wants a plan, specification, proposal, report, findings summary, comparison, architecture note, decision record, or static UI variants presented as a readable HTML page, especially when they want a shareable link. Do not use for HTML that ships as part of a product or website.
---

# HTML Communication

Turn the user's material into a dense, readable document rather than a landing
page. Preserve the substance of the request; presentation must not hide missing
research or invented facts.

Require Node.js with `npx` only when publishing. Postplan accepts anonymous
uploads; authentication is optional but recommended for listing and managing
drafts later.

## Build the content

1. Determine the artifact type and audience from the request.
2. Gather the evidence needed to make it accurate. For implementation plans,
   inspect the repository instructions, relevant code paths, existing patterns,
   tests, risks, and verification commands before writing the page.
3. Organize the document for scanning. Prefer a specific title, short context,
   clear sections, concrete decisions or steps, risks, and next actions.
4. Distinguish verified facts, decisions, assumptions, and open questions.
5. Cite useful source locations and links near the claims they support.

For implementation plans, make every step executable by someone who has not done
the research. Name exact files or components, intended behavior, dependencies,
and focused verification. Do not implement the plan unless the user separately
asks for implementation.

## Create the document

Create one complete HTML file, no larger than 512 KiB.

- Use semantic HTML, a responsive viewport, and CSS in a `<style>` block.
- Keep it mobile-readable and print-friendly without fixed-width layouts.
- Choose the theme from the user's local time when the document is created. Use
  a restrained light theme before 18:00, with a white or off-white background,
  near-black primary text, light gray secondary surfaces, and one purposeful
  accent color. At 18:00 or later, use a restrained dark theme with a true black
  background, white primary text, dark gray secondary surfaces, and one
  purposeful accent color. If the user's timezone is unknown, use the system's
  local time. Keep the selected theme static; do not add JavaScript to switch it.
- Prefer strong typography, spacing, tables, callouts, and compact diagrams over
  decorative chrome. Avoid hero sections and marketing copy.
- Use inline SVG only when a diagram materially improves understanding.
- Use HTTPS or data-URL images only when necessary. Add useful alt text.
- Render requested UI alternatives as real static variants labeled A, B, C, and
  lay them out for direct comparison.
- Do not include JavaScript, scripts, inline event handlers, `javascript:` URLs,
  forms, frames, embeds, objects, applets, meta refresh, or linked stylesheets.
- Never include secrets, credentials, customer data, private URLs, internal
  hostnames, or local filesystem paths. A Postplan URL is public to anyone who
  has it.

Write the file in the session scratch directory, not the user's repository,
unless the user asks for a local project artifact. Keep the same absolute file
path while iterating so Postplan can update the existing draft.

## Publish when requested

Publishing is an external write. Upload only when the user asks for a shareable,
hosted, published, or Postplan page. Creating a local HTML file alone does not
authorize publishing it.

Run:

```bash
npx --yes postplan upload <absolute-file-path> --description "<short label>"
```

Postplan validates the document and prints a public draft URL, a raw HTML URL,
and a draft ID. Report the local path and public URL. Prefer the normal draft URL
for people and the raw URL when handing the artifact to another agent.

Uploading the same absolute path again updates the existing draft. Use `--new`
only when the user explicitly wants a separate draft. If the path mapping is no
longer available but the draft ID is known, update it with:

```bash
npx --yes postplan upload <absolute-file-path> --draft <draft-id>
```

If validation fails, fix the HTML and retry. If authentication is required, ask
the user to run `npx --yes postplan auth login`, then retry. Do not claim the page
is hosted until the upload succeeds.
