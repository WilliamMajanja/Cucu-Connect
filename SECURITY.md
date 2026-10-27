# Security Policy

## Reporting a vulnerability

Please report security issues privately to the maintainers. Do not open public
issues for vulnerabilities.

## Supported versions

The latest release on the default branch is supported.

## Security practices

- Passwords hashed with scrypt + unique salt.
- Bearer token sessions with expiry.
- Rate limiting per IP.
- Security headers (nosniff, frame deny, referrer policy).
- Input validation and JSON parsing limits.
- No third-party runtime dependencies.