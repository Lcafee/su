# Release and deployment boundary

The normal operating workflow ends after approved release generation:

1. Edit the canonical source.
2. Commit and push it to GitHub.
3. Obtain explicit user approval for an exact pushed commit SHA.
4. Run `npm run release:generate -- --approve <full-commit-sha>`.
5. Stop after `release/current/` is generated.

Codex may perform those steps when authorized, but release approval authorizes
generation only. Codex must never run `deploy.py` or otherwise deploy production
in the same task. Production deployment requires a separate task that explicitly
instructs Codex to deploy.

`OPERATIONS.md` is the canonical authority for ParsPack access, live-state
observations, persistent runtime ownership, deployment checks, and recovery.
Read it before any release, host, admin/API, or production-state work. Keep it,
`README.md`, `HANDOFF.md`, `PRODUCT.md`, and affected server documentation
consistent whenever architecture or operations change.

`deploy.py` and the gitignored `.deploy.ini` remain available for manual use. No
build command, release command, Git hook, or GitHub workflow may invoke them or
automatically deploy production.
