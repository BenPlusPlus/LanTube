# Host applies catalogue migrations on start

A household Host is one process. Pending Remix SQL migrations run before the HTTP server listens, so a git-pull-and-restart brings schema along. `remix db` stays for status, rollback, and reset in development. A separate migrate step before start would fit a multi-process deploy; this house is not that. If a migration fails, the process does not listen.
