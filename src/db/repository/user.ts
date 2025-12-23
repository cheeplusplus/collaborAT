import db from "../db";
import { User } from "../model";

export async function getUser(did: string) {
  return await db
    .selectFrom("users")
    .where("did", "=", did)
    .selectAll()
    .executeTakeFirst();
}

export async function getAllUsers() {
  return await db.selectFrom("users").selectAll().execute();
}

async function createUser(
  did: string,
  handle: string,
  didDoc: any,
  scope: string,
  updates: { ip: string; userAgent?: string },
) {
  return await db
    .insertInto("users")
    .values({
      did,
      handle,
      didDoc: JSON.stringify(didDoc),
      grantedScopes: scope,
      preferences: JSON.stringify({}),
      lastIp: updates.ip,
      lastUserAgent: updates.userAgent ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function upsertUser(
  did: string,
  handle: string,
  didDoc: any,
  scopes: string,
  updates: { ip: string; userAgent?: string },
) {
  const appUser = await getUser(did);
  if (appUser) {
    // Update variables
    return await db
      .updateTable("users")
      .where("did", "=", did)
      .set({
        handle,
        didDoc: JSON.stringify(didDoc),
        grantedScopes: scopes,
        lastUsedAt: new Date().toISOString(),
        lastIp: updates.ip,
        lastUserAgent: updates.userAgent ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  return await createUser(did, handle, didDoc, scopes, updates);
}

export function userHasWriteAtScopes(user: User | undefined): boolean {
  return user?.grantedScopes?.includes("transition:generic") ?? false;
}
