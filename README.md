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
| [babysit-pr](skills/babysit-pr/SKILL.md) | Carries a GitHub PR through review feedback and CI until it's ready for a human to merge. Triages comments one at a time, decides what's actually worth fixing, makes scoped changes, pushes, waits for CI, re-checks. Never merges. |

## Adding a skill

Each skill is a folder under `skills/` with a `SKILL.md` inside:

```
skills/
└── <skill-name>/
    └── SKILL.md
```

The frontmatter needs `name` and `description`. The description is what the agent reads to decide whether to load the skill, so it should spell out when to use it, not just what it is.

## License

MIT
