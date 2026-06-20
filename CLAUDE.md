# Start here

**👉 Read [`ENGINE.md`](./ENGINE.md) before doing anything in this repo.** It is the
living source of truth: architecture, principles, the reusable engine API, the full
changelog, the roadmap, and the gotchas.

This project is being built deliberately as a **small reusable 3D engine**, not a
throwaway demo. Keep work modular (`src/engine/` = reusable, `src/robot|jail/` =
content, `src/main.js`+`ui.js` = glue), keep it efficient, and **update `ENGINE.md`
as part of every meaningful change** (see its §11 Update protocol).

## Quick facts
- No build step: native ES modules + import map + CDN. Run with `npx serve .`.
- This repo has an **auto-commit hook** (`Auto: <file>` per write). Squash before
  pushing: `git reset --soft <last-real-commit>` then one clean commit.
- Verify changes in the browser (preview screenshots), not just by reasoning.
