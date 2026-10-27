# Security Policy

## Reporting a vulnerability

Please report security issues privately to the maintainers. Do not open public
issues for vulnerabilities. Include reproduction steps, affected versions, and
impact. We aim to acknowledge reports within 72 hours.

## Supported versions

The latest release on the default branch is supported. Older releases may not
receive security fixes.

## Security practices

- Passwords hashed with scrypt and a unique per-user salt; comparison uses
  constant-time equality.
- Bearer token sessions with a 30-day expiry; logout revokes the session.
- Per-IP rate limiting (120 requests / 60s).
- Security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`.
- Request body size limits and strict JSON parsing.
- Input validation on all write endpoints; invalid requests fail closed with
  4xx responses.
- Role-based access control for admin, provider, caregiver, and delivery routes.
- No third-party runtime dependencies, reducing supply-chain risk.
- Data store is a local JSON file; protect it with filesystem permissions and
  encrypt at rest when hosting.

## Operator responsibilities

- Change the default admin credentials before production use.
- Run behind HTTPS (reverse proxy) and set secure headers upstream.
- Restrict access to `data/data.json` and back it up.
- Keep Node.js updated to a supported LTS release.
