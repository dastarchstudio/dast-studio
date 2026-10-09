# Dast Studio ERP

Persian RTL ERP for Dast Architecture Studio.

## Deployment

Connect this private repository to Vercel. Framework preset: Other. The project uses static HTML/CSS/JavaScript and Vercel serverless functions under `/api`.

Configure required server-side environment variables in Vercel from the project configuration and source references. Never commit real `.env` files, private keys, OAuth client secrets, Supabase service-role keys, VAPID private keys, or cron secrets.

The production URL must remain `https://daststudio.vercel.app`.

## Notes

This repository contains the source files transferred from `MarvX/crm-daftar`; it does not contain the live database, Supabase Auth users, OAuth tokens, or external files.