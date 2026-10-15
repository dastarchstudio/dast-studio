# Dast Studio ERP — Redesign Integration Status

## Scope of this branch

This is a non-production integration branch. It does not change Supabase, Vercel settings, the production domain, or the `main` branch.

### Implemented in this branch
- Added Montserrat alongside Vazirmatn in the existing ERP font load.
- Added `redesign-v5.css` as a visual layer for the existing ERP: cream/purple/ochre palette, dark sidebar with ochre active state, card/input/table styling, and branded login motion.
- Linked the new stylesheet from the existing `index.html` without replacing its login form, Supabase integration, module roots, or legacy scripts.
- Applied Montserrat to Latin text, LTR fields, code, and keyboard labels while keeping Persian UI text in Vazirmatn.
- Added a branded, staggered entrance animation to the existing real login screen, with subtle orbital decoration and reduced-motion support.
- Preserved the legacy ERP login/authentication path and existing app modules.

## Important architecture findings

- The uploaded `dast-studio-erp-v5(1).html` is a standalone React/Framer Motion prototype. Its application state is generated locally and persisted under `localStorage` key `dast-erp-v4`; its sign-in state uses `sessionStorage` key `dast-in`.
- The prototype does not contain a Supabase client or connect to the production ERP database. Its sample employee names and project records must not replace production data.
- The existing ERP source in `index.html` + `app.js` uses Supabase Auth and the existing project database. Its current sign-in maps a username to the internal `@daftar.local` email convention.
- The active database project is the existing Dast Studio Supabase project. No database rows, schema, policies, or settings were modified in this branch.

## Required integration work before production

The current branch applies the new design language to the old functional ERP shell; it does **not** copy the prototype's React/mock-data runtime into production. That is intentional because the prototype's employee/project records and local-only state are not connected to the real database.


1. Build a module-by-module inventory from the legacy source and map each feature to the redesigned screen. Preserve all existing workflows, permissions, and database operations.
2. Port the new visual shell and animations into the existing data/auth architecture rather than shipping the prototype's mock state.
3. Implement the employee-name picker using a safe, minimal employee directory source. Do not expose credentials or use an unrestricted `SECURITY DEFINER` view for public name lookup. Confirm the existing directory-view security finding before relying on that view.
4. Keep password verification in Supabase Auth; never store or compare plaintext passwords in the browser.
5. Preserve Solar Hijri date handling, attendance/QR workflows, push notifications, themes, File Namer (including existing DN/MM codes), material lab, reporting, and all current modules.
6. Test with a non-production environment and synthetic records. Verify role boundaries, RLS, login/logout/session recovery, mobile layouts, reduced-motion behavior, and regression coverage before opening a production deployment.
7. Review the resulting pull request before merging. Do not change the production domain or deploy this branch directly.

## Verification status

- Static source check: stylesheet link resolves to a committed file on this branch; HTML link is inside `<head>`; CSS braces are balanced; responsive and reduced-motion rules are present; existing login fields and `app.js`, `material-lab.js`, `file-namgozar.js`, and `qr-security.js` script tags remain.
- Existing `app.js` and database schema were not changed.
- Browser-based visual regression, end-to-end auth tests, and full feature-by-feature integration are **not yet complete**.
