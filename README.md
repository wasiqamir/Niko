# Niko

Meeting accounts for hosts and participants. Both are free and start with email verification.

## Run locally

```bash
npm install
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000.

`npm run dev` also starts a local SMTP server. Confirmation emails show up at http://127.0.0.1:1080. To use a real provider, replace the `SMTP_*` values in `.env`.
