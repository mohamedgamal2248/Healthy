# Security policy

## Reporting a vulnerability
Please report security problems privately through GitHub: **Security → Report a vulnerability** on this repository.
Do not open a public issue for something that could be exploited. We aim to acknowledge reports within 3 days.

## What is in scope
The web app, its API routes and the database schema in `supabase/migrations`.
The app never stores Pi credentials and never asks for a Pi passphrase.

## Hardening that is already in place
Row-level security on every table with no policies (only the server uses the service-role key), revocable sessions,
server-side verification of every Pi token and payment, rate limits, and a strict CSP.
See the "Security" section of the README.

## Recommended repository settings (owner)
Branch protection on `main` (require the CI check to pass), Dependabot alerts and security updates,
secret scanning with push protection, and code scanning (the CodeQL workflow is included).
