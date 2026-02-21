# TestMaker

TestMaker is a secure, session-aware exam platform built with Angular 21 (standalone + Signals) and designed for serious question-bank workflows, not just basic quiz demos.

Current framework baseline: Angular `21.1.x` (core `21.1.5`, CLI `21.1.4`).

## What Makes This Project Different
- Multi-user protected access backed by a serverless API (`/api/get-data`).
- Per-user encrypted question banks fetched remotely and decrypted on demand.
- Strict route protection (`authGuard`, `activeQuizGuard`) across login, setup, run, and results flows.
- Configurable exam sessions with topic scoping, dynamic question limits, and optional shuffling for questions and answers.
- Rich review experience with status-aware filtering (`All`, `Incorrect`, `Unanswered`) and per-topic statistics.
- Production-oriented PDF reporting with question-by-question answer analysis and summary metrics.
- Persistent UX state where it matters: auth session, theme mode, and user-specific master data cache with TTL.
- Keyboard-first runtime controls for faster exam flow during active sessions.
- Runtime internationalization (i18n) with English/Spanish switching, English default, and persisted language preference.

## Core Functional Scope
1. Secure Login and Data Provisioning
- Users authenticate via `POST /api/get-data`.
- API validates credentials from environment variables and resolves a user-specific encrypted dataset URL.
- Payload is decrypted server-side (AES-256-CBC) and returned as normalized quiz master data.

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
- Local browser cache strategy:
  - Auth and master data are cached with expiration (default TTL: 3 days).
  - Master data cache is user-scoped to avoid cross-user data leakage in shared browsers.

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
- `APP_USER_1_USERNAME`, `APP_USER_1_PASSWORD`, `APP_USER_1_DECRYPT_KEY`, `APP_USER_1_JSON_URL`
- `APP_USER_2_USERNAME`, `APP_USER_2_PASSWORD`, `APP_USER_2_DECRYPT_KEY`, `APP_USER_2_JSON_URL`
- `APP_USER_3_USERNAME`, `APP_USER_3_PASSWORD`, `APP_USER_3_DECRYPT_KEY`, `APP_USER_3_JSON_URL`

Optional:
- `GITHUB_TOKEN` (recommended for private repositories or stricter API limits)

## Useful Scripts
- `npm run build` - Production build output.
- `npm run watch` - Development build in watch mode.
- `npm run test` - Run the unit test suite once (Vitest via Angular unit-test builder).
- `npm run test:watch` - Run unit tests in watch mode.
- `npm run test:coverage` - Run tests with coverage report and enforced thresholds.
- `npm run encrypt:data` - Encrypt a master question bank for protected delivery.

## Testing and Coverage
- Unit testing stack: Angular `@angular/build:unit-test` with Vitest.
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

## Project Layout
- `api/get-data.ts` - Secure credential validation and encrypted dataset delivery.
- `src/app/core/services/quiz.service.ts` - Question-bank normalization, quiz lifecycle, scoring, topic analytics.
- `src/app/core/services/i18n.service.ts` - Application language initialization, persistence, and translation helpers.
- `src/app/core/state/auth.store.ts` - Session state and persistence.
- `src/app/core/state/browser-cache.ts` - Expiring cache primitives.
- `src/app/features/login` - Access gate and protected-data bootstrap.
- `src/app/features/quiz-config` - Session setup UX.
- `src/app/features/quiz-runner` - Runtime exam interaction.
- `src/app/features/quiz-results` - Review, filtering, and PDF reporting.
- `src/app/shared/components/language-toggle-button` - Reusable EN/ES language switch control.
