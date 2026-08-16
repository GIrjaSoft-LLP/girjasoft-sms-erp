# GirjaSoft SMS ERP

Multi-workspace school management ERP for **GirjaSoft LLP**.

## Stack

Next.js, React, Node.js, MongoDB, TypeScript.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `JWT_SECRET` to a long random string (32+ characters).
3. Set `SUPER_ADMIN_PASSWORD` in `.env.local` only (never commit it). Do not put it in `.env.example`.
4. Start MongoDB locally.
5. Install and seed:

```bash
npm install
npm run seed:superadmin
npm run dev
```

The seed script prints:

```text
GirjaSoft Super Admin created successfully.

Username:
admin@girjasoft.com
```

It never prints the password.

Open [http://localhost:3000](http://localhost:3000) and sign in as `admin@girjasoft.com`. You will land on `/platform/dashboard`. Create a workspace and its administrator from there.

## Security tests

```bash
npm run test:security
```
