# Contributing to Cucu Connect

Thank you for helping build a more inclusive world.

## Getting started

1. Fork and clone the repository.
2. No `npm install` needed (zero runtime dependencies).
3. `npm start` to run locally.
4. `npm test` before submitting.

## Guidelines

- Keep the project **zero-dependency** at runtime. Use Node.js built-ins only.
- Maintain accessibility: keyboard navigation, ARIA labels, sufficient contrast,
  large touch targets (>= 44px), and screen-reader support.
- Keep endpoints real and fail closed: validate input and return proper status
  codes; never simulate success.
- Write clear, small commits. One logical change per PR.
- Add tests for new endpoints in `tests/run.js`.
- Update `docs/API.md` for API changes.

## Code style

- Use `'use strict';`.
- Prefer `const`/`let`; avoid global state.
- Keep functions small and focused.
- No comments unless necessary.

## Pull requests

- Describe the change and test coverage.
- Ensure `npm test` passes.
- Update documentation for user-facing changes.

## Reporting issues

Use the GitHub issue templates. Include reproduction steps and environment.
