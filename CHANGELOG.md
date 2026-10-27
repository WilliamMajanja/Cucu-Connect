# Changelog

## [3.0.0] - 2026-10-27

### Added
- Daraja (M-Pesa) payment integration (STK Push, callback, status).
- Zero-dependency NoSQL document store (coexistence with JSON).
- Security hardening: XSS escaping, CSRF tokens, per-user rate limits, schema validation.
- Admin UI: product CRUD, order status, user roles, audit log, backup/restore.
- Observability: structured logging, extended health, error ring buffer.
- PWA: offline fallback, cache versioning, background sync.
- Accessibility: focus restoration on route change.
- Data: soft deletes, pagination, full-text search.

### Changed
- All list endpoints now support additive pagination (`?page=&limit=`).
- Default admin email: williammajanja@gmail.com.

## [2.1.0] - 2026-10-27

### Added
- Caregiver companion view and navigation.
- Sidebar navigation with mobile drawer.
- Dashboard stat cards on home.
- Refined design system and responsive layout.
- Fail-closed validation across write endpoints.

### Changed
- Security, privacy, terms, contributing, code of conduct, accessibility docs expanded.
- README and API documentation updated.
- Service worker cache bumped to v2.

### Fixed
- Duplicate `bills` key in default data.
- SMS TwiML escaping.
- Cart quantity validation.

## [2.0.0] - 2026-10-26

### Added
- Full authentication (register/login/logout) with scrypt password hashing.
- Medication reminders and adherence tracking.
- Vitals tracking.
- Subscriptions (recurring orders) with auto-processing.
- Notifications center.
- Admin dashboard.
- Product reviews.
- Delivery scheduling.
- Data export.
- PWA (manifest + service worker).
- Accessibility settings persisted to profile.
- Comprehensive REST API and documentation.
- Zero runtime dependencies.
- Smoke test suite.

## [1.0.0]

- Initial messenger bot prototype.