# .agents — the agent and contributor knowledge base

Operating knowledge for anyone (any AI agent, or a person) picking up work in this repository:
start with **[AGENTS.md](AGENTS.md)**.

- [`runbooks/`](runbooks/) — how to do things here: workflow and PRs, gates and CI, releasing,
  verification, the sites.
- [`knowledge/`](knowledge/) — what's true and what's open: verified engine facts, defect classes this
  codebase has had, and the current open-work list.

Plain markdown, no tool-specific syntax. `tools/gen-llms.py` also writes a large generated corpus
(`llms*.txt`) into this directory; it is git-ignored and regenerated with `pnpm gen:llms`.
