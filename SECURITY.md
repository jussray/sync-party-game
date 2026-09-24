# Security policy

## Do not commit secrets

Never commit AWS credentials, Amazon developer credentials, API keys, signing keys, service-account files, private tokens, production database passwords, private player data, or `.env` files.

Use repository/provider secret stores for runtime credentials and commit only redacted examples such as `.env.example`.

## Reporting a vulnerability

Do not publish exploitable security details in a public issue. Prefer GitHub's private vulnerability-reporting / security-advisory flow when enabled for this repository. If that path is unavailable, contact the repository owner privately through an already-established channel.

## Submission safety

Hackathon demos, screenshots, traces, logs, friction reports, and videos must be reviewed for tokens, private URLs, personal data, credentials, and other secrets before publication.
