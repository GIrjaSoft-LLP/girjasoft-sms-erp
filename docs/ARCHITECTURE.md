# GirjaSoft SMS ERP Architecture

## Stack

Next.js (App Router) + React + TypeScript + Node.js API routes + MongoDB (Mongoose).

## Tenancy

Every workspace is an independent school tenant. Workspace collections always include `workspaceId`. APIs never trust a client-supplied `workspaceId`. The server reads the authenticated session (or Super Admin workspace-view cookie) and scopes every query to that tenant.

## Identity

- `platformAdmins` holds the GirjaSoft Super Admin (`accountType = PLATFORM`, `role = SUPER_ADMIN`, `workspaceId = null`).
- `users` holds workspace users only. The Super Admin is never stored or listed there.
- Passwords are bcrypt hashes. The Super Admin password is supplied via `SUPER_ADMIN_PASSWORD` at seed time and is never returned by APIs.

## Request pipeline

Authenticate → account type → workspace → role permissions → `record.workspaceId` match → operation.

`/platform/*` and `/api/platform/*` require Super Admin. Workspace users receive 403/redirect.

## RBAC

Default roles are created per workspace. Custom roles may only contain permissions the actor already has. Effective permissions are the union of assigned roles.

## Super Admin workspace inspection

`gs_view_workspace` cookie enables temporary access without converting the platform account into a workspace user. Open/exit events are written to `platformAuditLogs`.
