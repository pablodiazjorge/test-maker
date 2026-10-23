# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

The project is finished (October 2026) and no longer maintained; the deployed app stays online.

### Added
- MIT License.
- `scripts/hash-password.mjs` (`npm run --silent hash:password`), which prints the value for `APP_USER_<n>_PASSWORD_HASH`.
- Node-side tests in `tests/` for the API function and the scripts, run with `vitest run` after `ng test`.

### Changed
- Question banks are encrypted with AES-256-GCM in a versioned payload, `{ "v": 2, "iv", "tag", "data" }`, and the API rejects a bank whose authentication tag does not match. The banks were re-encrypted in October 2026 with the same keys.
- The auth session and the decrypted bank are cached in `sessionStorage`, per tab, instead of `localStorage`; the entries left in `localStorage` by earlier versions are removed on startup.

### Removed
- The API no longer reads question banks in the old AES-256-CBC format.

### Security
- Passwords are checked against scrypt hashes (`APP_USER_<n>_PASSWORD_HASH`) with a constant-time compare; the plaintext `APP_USER_<n>_PASSWORD` variables are ignored.
- API failures answer a generic 500; the details stay in the server log.
- Angular updated to 21.2.25 (CLI and build tooling 21.2.28), which fixes the high-severity advisories in `@angular/common`, `@angular/compiler`, `@angular/core` and `@angular/router` (XSS and sanitization bypasses, including i18n bindings; credentialed requests cached by `HttpTransferCache`; denial of service in date and number formatting).

## [0.1.0] - 2026-02-20

### Added
- Initial stable release: Secure session-aware exam platform with Angular 21, Signals, and encrypted data workflows.

[Unreleased]: https://github.com/pablodiazjorge/test-maker/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/pablodiazjorge/test-maker/releases/tag/v0.1.0
