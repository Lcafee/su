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

`deploy.py` and the gitignored `.deploy.ini` remain available for manual use. No
build command, release command, Git hook, or GitHub workflow may invoke them or
automatically deploy production.
