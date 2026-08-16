import { NextResponse } from "next/server";
import { ALL_PERMISSIONS } from "../src/config/permissions";
import { mergePermissions, hasPermission, assertAssignablePermissions } from "../src/lib/rbac";
import { stripClientWorkspaceId, omitSecrets } from "../src/lib/sanitize";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function run() {
  const merged = mergePermissions([
    ["students.view", "fees.view"],
    ["fees.collect", "students.view"],
  ]);
  assert(merged.includes("fees.collect"), "mergePermissions failed");
  assert(hasPermission(merged, "students.view"), "hasPermission failed");
  assert(!hasPermission(["fees.view"], "users.delete"), "negative permission failed");

  try {
    assertAssignablePermissions(["fees.view"], ["users.delete"]);
    throw new Error("assignable permissions should have thrown");
  } catch (error) {
    assert(error instanceof Error && error.message.includes("authority"), "wrong error");
  }

  const cleaned = stripClientWorkspaceId({
    workspaceId: "workspace-b",
    name: "Asha",
  });
  assert(!("workspaceId" in cleaned), "client workspaceId must be stripped");
  assert(cleaned.name === "Asha", "other fields must remain");

  const hidden = omitSecrets({
    email: "teacher@school.com",
    passwordHash: "should-not-leak",
    password: "plaintext",
  });
  assert(!("passwordHash" in hidden), "passwordHash leaked");
  assert(!("password" in hidden), "password leaked");

  assert(ALL_PERMISSIONS.includes("students.view"), "permission catalog missing students.view");
  assert(ALL_PERMISSIONS.includes("roles.delete"), "permission catalog missing roles.delete");
  console.log("GirjaSoft SMS ERP security unit tests passed.");
}

run();
