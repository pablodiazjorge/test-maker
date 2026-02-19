# Incident Report: `/api/get-data` returns `500` with `x-vercel-error: FUNCTION_INVOCATION_FAILED`

Date: 2026-02-19  
Project: `test-maker`  
Environment: Vercel Production (`https://test-maker-five.vercel.app`)

## 1) Executive Summary
- The frontend request to `POST /api/get-data` fails with HTTP `500`.
- Response headers include `x-vercel-error: FUNCTION_INVOCATION_FAILED`.
- According to Vercel docs, this indicates the function runtime crashed (uncaught exception / runtime failure), not a normal business error response.

## 2) Observed Evidence
- Request: `POST https://test-maker-five.vercel.app/api/get-data`
- Payload: `{ "password": "Anuski95" }`
- Response headers:
  - `status: 500`
  - `x-vercel-error: FUNCTION_INVOCATION_FAILED`
  - `x-vercel-cache: MISS`
  - `server: Vercel`

## 3) What this error means (official references)
- `FUNCTION_INVOCATION_FAILED` = function crashed or failed to run correctly.
- Debugging must be done from Function Runtime Logs.
- Common causes:
  - Runtime mismatch / unsupported APIs
  - Unhandled exceptions before returning a response
  - Misconfigured environment variables
  - Crashes caused by module initialization

## 4) Fixes applied in code
- Reworked `api/get-data.ts` to be defensive with both invocation styles:
  - Node `req/res`
  - Web `Request/Response`
- Added `runtime = 'nodejs'`.
- Removed top-level Node crypto dependency load; now uses dynamic imports inside execution path.
- Added full error wrapping and explicit JSON responses.
- Added `api/health.ts` to validate runtime and env presence safely (without exposing secrets).
- Added `vercel.json` API config with:
  - `maxDuration: 30`

## 5) Current hypothesis
- The function is still crashing before normal response due runtime execution path mismatch or environment/runtime configuration.
- The new `health` endpoint should quickly confirm whether functions execute at all in production.

## 6) Immediate verification plan
1. Deploy latest commit containing:
   - `api/get-data.ts`
   - `api/health.ts`
   - `vercel.json`
2. Call:
   - `GET /api/health`
3. Expected result for health:
   - `200` JSON with `ok: true` and env booleans.
4. If `/api/health` fails with same Vercel error:
   - issue is runtime/platform/config level (not decryption logic).
5. If `/api/health` works but `/api/get-data` fails:
   - inspect `get-data` runtime logs for exact error message.

## 7) Commands to reproduce and collect evidence
```bash
curl -i https://test-maker-five.vercel.app/api/health

curl -i -X POST https://test-maker-five.vercel.app/api/get-data \
  -H "Content-Type: application/json" \
  -d "{\"password\":\"Anuski95\"}"
```

Collect and share:
- Response status + headers
- Response body
- Vercel Runtime Logs for `get-data`
- Vercel Runtime Logs for `health`

## 8) Environment variables checklist (Production)
- `APP_PASSWORD`
- `JSON_DECRYPT_KEY`
- `GITHUB_ENCRYPTED_JSON_URL`
- `GITHUB_TOKEN` (only if encrypted file is in private repo)

All vars require redeploy after creation/change.

## 9) References
- Vercel error reference (`FUNCTION_INVOCATION_FAILED`):  
  https://vercel.com/docs/errors/FUNCTION_INVOCATION_FAILED
- Vercel Node.js runtime and function model:  
  https://vercel.com/docs/functions/runtimes/node-js
- Vercel logs (runtime diagnostics):  
  https://vercel.com/docs/observability/runtime-logs
- Vercel project config (`vercel.json`) and functions config:  
  https://vercel.com/docs/project-configuration

## 10) Additional build blocker found and fixed
- New build error observed:
  - `Error: Function Runtimes must have a valid version, for example now-php@1.0.0`
- Root cause:
  - Invalid `runtime` value in `vercel.json` (`nodejs22.x`) under `functions`.
  - For Node.js functions, Vercel already defaults to Node runtime; setting this runtime string in this context caused config validation failure.
- Fix applied:
  - Removed `runtime` from `vercel.json`.
  - Kept only `maxDuration` for API functions.
  - Added `engines.node = 22.x` in `package.json` to make Node version intent explicit.
