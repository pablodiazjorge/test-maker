# TestMaker

TestMaker is a personal exam platform with encrypted question banks (AES-256) and credential access; see [Limitations](#limitations). It is built with Angular 21 (standalone + Signals) for question-bank workflows, not just basic quiz demos.

Current framework baseline: Angular `21.1.x` (core `21.1.5`, CLI `21.1.4`).

## Why I Built This

I needed a study tool where I could keep exam questions encrypted so they are not
trivially shared. Existing quiz apps either required accounts, stored data on
external servers, or offered no encryption at all.

In TestMaker, question banks are encrypted with AES-256-CBC before they are
committed, and a serverless API decrypts them on demand after checking the
credentials. The app itself is a static Angular SPA, with no backend database and
no user accounts beyond the configured credentials. One early version of a bank
was committed unencrypted; see [Limitations](#limitations).

## Development Approach

This project was built as part of my AI Engineering workflow. I used Claude Code
for scaffolding, debugging, and test generation, and MCP for integrations. The
architecture, auth logic, encryption design, and test scenarios were defined and
supervised by me personally. AI accelerated repetitive tasks and documentation,
but every design decision was intentional and human-reviewed.

## What Makes This Project Different
- Multi-user access through a serverless API (`/api/get-data`) that checks scrypt password hashes.
- Per-user encrypted question banks fetched remotely and decrypted on demand.
- Route guards (`authGuard`, `activeQuizGuard`) across login, setup, run, and results flows; they drive navigation, and the API is the security boundary.
- Configurable exam sessions with topic scoping, dynamic question limits, and optional shuffling for questions and answers.
- Rich review experience with status-aware filtering (`All`, `Incorrect`, `Unanswered`) and per-topic statistics.
- Production-oriented PDF reporting with question-by-question answer analysis and summary metrics.
- UX state where it matters: the auth session and the user-specific master data per tab (`sessionStorage`), theme and language across visits (`localStorage`).
- Keyboard-first runtime controls for faster exam flow during active sessions.
- Runtime internationalization (i18n) with English/Spanish switching, English default, and persisted language preference.

## Core Functional Scope
1. Login and Data Provisioning
- Users authenticate via `POST /api/get-data`.
- The API checks the password against the user's scrypt hash from the environment (constant-time compare; unknown users are checked against a dummy hash and get the same 401) and resolves a user-specific encrypted dataset URL.
- Payload is decrypted server-side (AES-256-CBC) and returned as normalized quiz master data.
- Failures answer a generic `500 { "error": "Internal server error" }`; the cause goes to the server log only.

2. Session Configuration
- Users choose topics, question count, and shuffle behavior.
- Question count is constrained by the currently selected topic pool.
- Validation prevents invalid launches (for example, no topics selected).

3. Quiz Execution
- Question-by-question navigation with deterministic state updates.
- Selection persistence during session runtime.
- Progress tracking and controlled completion flow to results.
- Advanced interaction shortcuts:
  - Press `1`, `2`, `3`, `4` to quickly select options A, B, C, D.
  - Double-click an option to select it and jump to the next question.
  - Press `Enter` to continue when the current question already has a selected answer.
  - Use `ArrowLeft` and `ArrowRight` to move backward/forward between questions.

4. Results and Export
- Real-time scoring and breakdown: answered, correct, incorrect, unanswered, percentage.
- Topic-level analytics computed from actual session responses.
- PDF export includes generation timestamp, filter context, question status, and answer markers.
- Export labels and report metadata are localized according to the active UI language.

## Security and Data Handling Model
- Encrypted content workflow:
  - `scripts/encrypt-master-data.mjs` encrypts JSON payloads with AES-256-CBC.
  - `/api/get-data.ts` fetches encrypted payloads (supports GitHub URL normalization), decodes IV/ciphertext, decrypts, and returns structured data.
- Password check:
  - `/api/get-data.ts` compares the password with `APP_USER_<n>_PASSWORD_HASH` using scrypt and `timingSafeEqual`. No password is stored in plaintext; the old `APP_USER_<n>_PASSWORD` variables are ignored.
- Local browser cache strategy:
  - The auth session and the decrypted master data are cached in `sessionStorage`: per tab, dropped when the tab is closed, with a 3-day TTL for long-lived tabs. A new tab asks for the credentials again.
  - Master data cache is user-scoped to avoid cross-user data leakage in shared browsers.
  - On startup the app removes the cache entries that earlier versions kept in `localStorage`.

## Frontend Architecture
- Framework: Angular 21 standalone components.
- State model: Angular Signals (quiz state, result projections, UI state).
- UI: Tailwind CSS (local build integration), responsive dark/light theming, and EN/ES language toggle controls.
- Internationalization:
  - Runtime translation layer powered by `@ngx-translate/core`.
  - Translation dictionaries in `public/i18n/en.json` and `public/i18n/es.json`.
  - Language is initialized globally and persisted client-side (default: English).
- Routing:
  - `/` Login
  - `/config` Quiz setup (auth protected)
  - `/quiz` Active quiz runner (auth + active quiz protected)
  - `/results` Results and export (auth + active quiz protected)

## Quiz Navigation Shortcuts
- `1`, `2`, `3`, `4`: select option A, B, C, D respectively.
- `Double-click` on an answer option: select and continue to the next question.
- `Enter`: continue to the next question if one option is already selected.
- `ArrowLeft`: previous question.
- `ArrowRight`: next question.

## Deployment Configuration (Required)
This project depends on server-side environment configuration. Without these variables, the app cannot provide protected data.

Required variable groups (up to 3 users):
- `APP_USER_1_USERNAME`, `APP_USER_1_PASSWORD_HASH`, `APP_USER_1_DECRYPT_KEY`, `APP_USER_1_JSON_URL`
- `APP_USER_2_USERNAME`, `APP_USER_2_PASSWORD_HASH`, `APP_USER_2_DECRYPT_KEY`, `APP_USER_2_JSON_URL`
- `APP_USER_3_USERNAME`, `APP_USER_3_PASSWORD_HASH`, `APP_USER_3_DECRYPT_KEY`, `APP_USER_3_JSON_URL`

Optional:
- `GITHUB_TOKEN` (recommended for private repositories or stricter API limits)

### Password hashes
`APP_USER_<n>_PASSWORD_HASH` holds the scrypt hash of that user's password, in the format
`scrypt$<salt-base64>$<hash-base64>` (Node's scrypt defaults N = 16384, r = 8, p = 1; random
16-byte salt; 32-byte key). Generate one value per user with:

```
node scripts/hash-password.mjs
```

The script asks for the password twice without echo and prints only the value, so it can be piped
(in PowerShell, `node scripts/hash-password.mjs | Set-Clipboard` copies it without showing it).
It also reads the first line of standard input when that is piped, or takes the password as an
argument, which leaves it in the shell history. Through npm, use `npm run --silent hash:password`
so npm's banner stays out of the output. The login form trims the password before sending it, and
so does the script.

Paste the value as is into the Vercel environment variables, in every environment that has the
other `APP_USER_<n>_*` variables. In a local `.env` file, quote it: some loaders expand `$`.

- A user whose hash is missing or malformed is disabled, and the server log names the variable
  (never its value). If no user is complete, the API answers 500.
- The old `APP_USER_<n>_PASSWORD` variables are ignored (the log warns while they exist); remove them.
- Set the hashes in Vercel before deploying a version that reads them, or nobody can log in.

### Rate limit
Login attempts are rate limited per IP by a Vercel Firewall rule on `/api/get-data`, configured in
the Vercel dashboard, not in this repository (at the time of writing: fixed window of 60 seconds,
5 requests per IP, answer 429).

## Useful Scripts
- `npm run build` - Production build output.
- `npm run watch` - Development build in watch mode.
- `npm run test` - Run the Angular unit tests once (Vitest via the Angular unit-test builder), then the Node-side tests.
- `npm run test:api` - Run only the Node-side tests in `tests/` (API function and scripts) with plain Vitest.
- `npm run test:watch` - Run unit tests in watch mode.
- `npm run test:coverage` - Run tests with coverage report and enforced thresholds.
- `npm run encrypt:data` - Encrypt a master question bank for protected delivery.
- `npm run --silent hash:password` - Print the value for `APP_USER_<n>_PASSWORD_HASH`.

## Testing and Coverage
- Unit testing stack: Angular `@angular/build:unit-test` with Vitest for `src/`; plain Vitest (`vitest.config.ts`, Node environment) for `tests/`, which lives outside `api/` because Vercel deploys every `api/**/*.ts` file as a function.
- Current suite: 94 Angular unit tests in 18 files (`ng test`) and 28 Node-side tests in 2 files (`npx vitest run`).
- Coverage scope: application TypeScript files under `src/app/**/*.ts` (excluding specs and non-runtime type-only files).
- Enforced quality gate:
  - Statements: `>= 80%`
  - Branches: `>= 70%`
  - Functions: `>= 80%`
  - Lines: `>= 80%`
- Current suite focus:
  - Core logic (`QuizService`, auth store, browser cache, guards)
  - UX state services (theme and runtime i18n)
  - Feature behavior (login, setup, runner keyboard shortcuts, results/export)
  - Shared reusable UI controls
  - API password check, error responses and the hash script (`tests/`)

## Project Layout
- `api/get-data.ts` - Password check (scrypt) and encrypted dataset delivery.
- `scripts/hash-password.mjs` - Generates the `APP_USER_<n>_PASSWORD_HASH` values.
- `scripts/encrypt-master-data.mjs` - Encrypts a question bank with AES-256-CBC.
- `tests/` - Node-side tests for the API function and the scripts.
- `src/app/core/services/quiz.service.ts` - Question-bank normalization, quiz lifecycle, scoring, topic analytics.
- `src/app/core/services/i18n.service.ts` - Application language initialization, persistence, and translation helpers.
- `src/app/core/state/auth.store.ts` - Session state and persistence.
- `src/app/core/state/browser-cache.ts` - Expiring per-tab cache primitives (`sessionStorage`).
- `src/app/features/login` - Access gate and protected-data bootstrap.
- `src/app/features/quiz-config` - Session setup UX.
- `src/app/features/quiz-runner` - Runtime exam interaction.
- `src/app/features/quiz-results` - Review, filtering, and PDF reporting.
- `src/app/shared/components/language-toggle-button` - Reusable EN/ES language switch control.

## Limitations

- **A development sample is in the git history.** Before encryption existed (18 and 19 February
  2026), the app loaded a plaintext sample file, `public/assets/master-data.json`, with example
  topics to test the quiz interface. It was removed in `ae12ecd`, the commit that introduced
  encryption, and it is still in the history. It is the only plaintext data file ever committed:
  every bank since then has been committed encrypted only.
- **The encrypted banks are public files.** `public/assets/*.encrypted.json` is served as static
  assets and kept in the git history, so its confidentiality rests on the keys
  (`APP_USER_<n>_DECRYPT_KEY`), which are never committed.
- **AES-256-CBC without authentication.** The banks are encrypted but not authenticated, so a
  modified file is not detected as tampered. Moving to AES-256-GCM with a versioned payload is
  planned.
- **The route guards are UX, not security.** `authGuard` and `activeQuizGuard` decide which screen
  to show from state kept in the browser, which the user controls. The security boundary is the
  API: without valid credentials it returns no data.
- **What the browser keeps.** After login, the decrypted bank and the auth session (user id and
  login time) stay in that tab's `sessionStorage` until the tab is closed, for at most 3 days.
  Anyone using that tab, or any script running in the page, can read them. Theme and language
  stay in `localStorage`.
- **The guest account is public.** The login page has a button that fills the guest demo
  credentials, so the guest bank must only hold content that can be public. It needs its own
  `APP_USER_<n>_PASSWORD_HASH` like any other user.
- **The rate limit lives outside the repository.** It is a Vercel Firewall rule; without it there
  is no limit. Vercel counts per region, and a per-IP limit does not stop guessing spread over
  many IPs, so the private passwords must be long and random. A limited request gets 429, which
  the login form shows as a generic error.
- **No account management.** There is no lockout, password reset or second factor: the
  credentials are environment variables managed by the owner.

## License

This project's code is licensed under the [MIT License](LICENSE).