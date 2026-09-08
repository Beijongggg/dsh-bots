# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`docs/PROJECT_UNDERSTANDING.md`** — this repo's established domain overview
  （功能面、产品方向、跨轮方法论）. Read it first; it predates this scaffold
  and remains the primary reference.
- **`CONTEXT.md`** at the repo root — the living glossary the
  `/domain-modeling` skill maintains. Created lazily when terms or
  decisions actually get resolved; live since 2026-09-07 (first terms:
  会话回合 / session driver / turn baseline / 监督 adapter). Until a
  needed term exists there, proceed silently — don't suggest creating
  entries upfront.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.
  The directory doesn't exist yet; same lazy-creation rule applies.

## File structure

Single-context repo:

```
/
├── CONTEXT.md                  ← created lazily by /domain-modeling
├── docs/
│   ├── PROJECT_UNDERSTANDING.md ← established domain overview (read first)
│   └── adr/                    ← created lazily when decisions get recorded
└── lib/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`（及
`PROJECT_UNDERSTANDING.md`、`README.md` 既有命名——如「门态」「留痕」「落档」）.
Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR（或 `PLAN-expanded-engineering.md`
门态裁决、`docs/CLOSURE-*` 冻结范围）, surface it explicitly rather than
silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
