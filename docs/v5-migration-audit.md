# Dast ERP v5 — Integration Audit

## Current state

- `v5-preview.html` is the original uploaded standalone interface, preserved as an isolated preview route.
- The original file's two inline JavaScript bundles pass `node --check`.
- The v5 interface is a React application with local demo state: `localStorage["dast-erp-v4"]` and `sessionStorage["dast-in"]`.
- Its default dataset is seeded demo content; it does not initialize the ERP's Supabase client or authenticate office users.
- The v5 staff picker immediately sets a demo identity and marks the local session as entered; selecting a card is not authentication.
- Therefore this route is a visual reference only and must not replace the production entry point yet.

## Employee directory review (read-only)

- With the user's approval, only `full_name`, `role_title`, and `department` were queried from `public.employee_directory`.
- The directory currently returns 9 records. The names and roles are recorded in the internal `docs/v5-employee-roster-review.md` review note.
- Several department values are empty, so the UI must show a neutral fallback rather than inventing a department.
- No email, phone, bio, or other employee fields were queried. No employee records were changed.
- The fake names bundled in v5 must not be retained as real staff or used to overwrite office data.

## Existing ERP integration points

The current ERP's `app.js` already owns the real Supabase client and session:
- Auth: `sb.auth.signInWithPassword`, `sb.auth.getSession`, `sb.auth.signOut`.
- Existing login uses the office username convention `username@daftar.local` with password.
- Current user/profile: `currentUser`, `currentProfile`, `loadProfileAndShowApp()`.
- Existing business modules include leads, clients, projects, contracts, team members/profiles, ERP tasks, fixed costs, tenders, interactions, personal tasks, attendance, notifications, and Material Lab / file naming scripts.
- The app already has Persian Solar Hijri date conversion/formatting utilities. These should be reused rather than introducing a second date implementation.

## Safe migration sequence

1. **Staff list** — replace the mock list with the real directory, preserving missing-field fallbacks.
2. **Authentication and identity** — reuse the existing Supabase session and profile/role checks; do not accept the v5 demo's “enter the office” state as authentication and never allow a signed-in user to choose another employee's identity.
3. **Dashboard first** — review its layout and data requirements with the user; connect only approved read-only data first and label any remaining demo values.
4. **Feature-by-feature port** — review attendance, employees, projects, tasks, Material Lab, file naming, notifications, and remaining modules one by one; retain legacy modules until each replacement passes regression checks.
5. **Write operations** — enable only after role checks, RLS behavior, and confirmation/error handling are verified for that module.
6. **Regression and preview review** — test desktop/mobile layouts, Persian dates, theme contrast, auth/logout, and core modules on a preview deployment.
7. **Production cutover** — only after explicit approval; keep the canonical URL unchanged and preserve a rollback path.

## Safety boundaries

- No production deployment or merge was performed by this audit.
- No Supabase tables, rows, policies, keys, or settings were changed.
- No real attendance, push notification, or office-user side effects were triggered.
- Do not treat localStorage demo state as office records or as a source of truth.
- A true auth integration must be implemented in the app itself; a separate preview page or a password prompt is not a substitute for enforcing identity in the v5 route.
