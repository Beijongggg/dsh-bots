# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Reading the domain

- Read **`docs/PROJECT_UNDERSTANDING.md`** when first entering the project. It is
  the established overview of functionality, product direction and methodology.
  For a specific ticket, follow its spec pointers and read the relevant overview
  sections. The reading route is [README §4](../../README.md#4-任务阅读路径).
- Look up the terms needed for the task in **`GLOSSARY.md`**, the living glossary
  maintained through `/domain-modeling`. Add definitions when terminology is
  resolved; leave absent terms unfilled until then.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.
  Create an ADR only when a decision needs to be recorded.

## File structure

Single-context repo:

```
/
├── GLOSSARY.md                 ← created lazily by /domain-modeling
├── docs/
│   ├── PROJECT_UNDERSTANDING.md ← established domain overview (read first)
│   └── adr/                    ← created lazily when decisions get recorded
└── lib/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`（及
`PROJECT_UNDERSTANDING.md`、`README.md` 既有命名——如「门态」「留痕」「落档」）.
Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR（或 `PLAN-expanded-engineering.md`
门态裁决、`docs/CLOSURE-*` 冻结范围）, surface it explicitly rather than
silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
