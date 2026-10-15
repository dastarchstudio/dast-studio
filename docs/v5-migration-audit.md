# Dast ERP v5 — Integration Audit

## Current state

- `v5-preview.html` is the original uploaded standalone interface, preserved as an isolated preview route.
- The original file's two inline JavaScript bundles pass `node --check`.
- The v5 interface is a React application with local demo state: `localStorage["dast-erp-v4"]` and `sessionStorage["dast-in"]`.
- Its default dataset is seeded demo content; it does not initialize the ERP's Supabase client or authenticate office users.
- Therefore this route is a visual reference only and must not replace the production entry point yet.

## Existing ERP integration points

The current ERP's `app.js` already owns the real Supabase client and session:
- Auth: `sb.auth.signInWithPassword`, `sb.auth.getSession`, `sb.auth.signOut`.
- Current user/profile: `currentUser`, `currentProfile`, `loadProfileAndShowApp()`.
- Existing business modules include leads, clients, projects, contracts, team members/profiles, ERP tasks, fixed costs, tenders, interactions, personal tasks, attendance, notifications, and Material Lab / file naming scripts.
- The app already has Persian Solar Hijri date conversion/formatting utilities. These should be reused rather than introducing a second date implementation.

## Safe migration sequence

1. **Authentication and authorization contract** — reuse the existing Supabase session and profile/role checks; do not accept the v5 demo's “enter the office” state as authentication.
2. **Read-only data adapters** — map one v5 screen at a time to existing tables and current RLS behavior; start with profile/team and dashboard reads. Do not write demo seed data into Supabase.
3. **Feature-by-feature port** — connect each module to existing ERP functions and tables; retain legacy modules until each replacement passes regression checks.
4. **Write operations** — enable only after role checks, RLS behavior, and confirmation/error handling are verified for that module.
5. **Regression and preview review** — test desktop/mobile layouts, Persian dates, theme contrast, auth/logout, and core modules on a preview deployment.
6. **Production cutover** — only after explicit approval; keep the canonical URL unchanged and preserve a rollback path.

## Safety boundaries

- No production deployment or merge was performed by this audit.
- No Supabase tables, rows, policies, keys, or settings were changed.
- No real attendance, push notification, or office-user side effects were triggered.
- Do not treat localStorage demo state as office records or as a source of truth.
