# V5 employee roster correction — read-only source

This file records the exact read-only roster fields approved for the v5 migration review. It is an internal implementation reference, not a public page and not an authentication source.

| Full name | Role title | Department |
|---|---|---|
| احسان مروی | بیکار | — |
| پویان کنی | کارآموز | — |
| دریا نورعلیئی | کارمند | — |
| شادی شیبانی | کارآموز | — |
| علی ابراهیمی | کارآموز | — |
| محمد رضا کریمی | کارآموز | — |
| مهسا صادقی | کارمند | — |
| مهندس الهه کاوه | مدیر | — |
| مهندس محمد مافی | مدیر | — |

## Guardrails
- The list was read from `public.employee_directory` using only `full_name`, `role_title`, and `department`.
- No rows were inserted, updated, or deleted.
- No email, phone, bio, or other personal fields were queried.
- Do not treat any employee selection in the standalone v5 HTML as authentication. The v5 app uses mock browser storage and must be integrated with the existing Supabase sign-in flow before real use.
- The production ERP and Supabase schema/settings remain unchanged.

## Next integration steps
1. Bind the staff picker to the real directory, with loading/error states and safe handling for missing departments.
2. Use the existing ERP auth flow (`username@daftar.local` + password) and the authenticated profile to establish identity. Never permit choosing another employee's identity.
3. Replace mock data one module at a time, starting with Dashboard; label any remaining mock data clearly.
