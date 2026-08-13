# skills

Agent skills I use day to day, written by me and kept in one place.

Install any of them with one command:

```bash
npx skills@latest add pedrobarretto/skills
```

The CLI will let you pick which skills to install. Works with Claude Code, Cursor, Codex, GitHub Copilot, Cline, and others.

To install a single skill directly:

```bash
npx skills@latest add pedrobarretto/skills --skill babysit-pr
```

## Skills

| Skill | What it does |
| --- | --- |
| [babysit-pr](skills/babysit-pr/SKILL.md) | Monitors a GitHub PR through review feedback and CI, validates bot findings, fixes real issues, explains and resolves false positives, tracks the base branch, and stops when the latest commit is ready. Merges or closes only when explicitly authorized. |
| [file-pr](skills/file-pr/SKILL.md) | Opens a concise, human-readable pull request for the current branch after checking for an existing PR, reviewing the diff, and matching the repository's title conventions. |
| [plan-page](skills/plan-page/SKILL.md) | Turns a task into a researched implementation plan, renders it as a self-contained HTML page, and publishes it at `https://<random-slug>.your-domain.com` so you can share the link. Updates in place, so a link you already shared stays current. Runs on your own Cloudflare Worker + KV — [one-time setup](skills/plan-page/worker/SETUP.md), then publishing is a single request with no deploy. |

## Adding a skill

Each skill is a folder under `skills/` with a `SKILL.md` inside:

```
skills/
└── <skill-name>/
    └── SKILL.md
```

The frontmatter needs `name` and `description`. The description is what the agent reads to decide whether to load the skill, so it should spell out when to use it, not just what it is.

A skill can ship supporting files alongside `SKILL.md` — templates, scripts, setup docs. Reference them by relative path from `SKILL.md` so the agent only reads them when it actually needs them.

## License

MIT
