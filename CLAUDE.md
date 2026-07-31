## Agent skills

The orchestrator skills from mattpocock-skills (`/grill-with-docs`, `/grill-me`, `/to-spec`, `/to-tickets`, `/implement`, `/triage`, `/wayfinder`, `/improve-codebase-architecture`, `/handoff`, `/ask-matt`) can only be launched by the user — the model cannot invoke them. Whenever one clearly fits the moment, proactively recommend it (name the command and why, in one line) instead of silently proceeding without it. Examples: a non-trivial change is about to start without alignment → suggest `/grill-with-docs`; a conversation has turned into a plan → suggest `/to-spec` + `/to-tickets`; a ticket is ready to build → suggest `/implement`; untriaged issues are piling up → suggest `/triage`.

### Issue tracker

Issues live in this repo's GitHub Issues, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Coding standards

Repo conventions live in `CODING_STANDARDS.md` at the root — the `/code-review` Standards axis reads it.

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at the repo root (created lazily as terms/decisions get resolved). See `docs/agents/domain.md`.
