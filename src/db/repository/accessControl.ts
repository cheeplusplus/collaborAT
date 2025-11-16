import db from "../db";
import { AnyScope } from "../../scoping/scopes";

const getBasicAclQuery = () =>
  db
    .selectFrom("accessControls")
    .selectAll()
    .select(({ selectFrom }) => [
      selectFrom("proxyTokens")
        .whereRef("accessControls.id", "=", "proxyTokens.aclId")
        .select(({ eb, fn }) => [
          eb(fn.count("proxyTokens.id"), ">", 0).as("hasLoggedIn"),
        ])
        .as("hasSession"),
    ]);

export async function getAccessControlsByActorDid(did: string) {
  const rows = await getBasicAclQuery().where("actorDid", "=", did).execute();
  return rows.map((row) => ({
    ...row,
    hasSession: row.hasSession === true || row.hasSession === 1,
  }));
}

export async function getAccessControlsByTargetDid(did: string) {
  const rows = await getBasicAclQuery().where("targetDid", "=", did).execute();
  return rows.map((row) => ({
    ...row,
    hasSession: row.hasSession === true || row.hasSession === 1,
  }));
}

export async function getAccessControlById(id: number) {
  const row = await getBasicAclQuery().where("id", "=", id).executeTakeFirst();
  if (!row) {
    return undefined;
  }
  return {
    ...row,
    hasSession: row.hasSession === true || row.hasSession === 1,
  };
}

export async function getAccessControlByLogin(username: string) {
  return await db
    .selectFrom("accessControls")
    .selectAll()
    .where("username", "=", username)
    .executeTakeFirst();
}

export async function createAccessControl(
  targetDid: string,
  actorDid: string,
  scopes: string[],
  username: string,
) {
  return await db
    .insertInto("accessControls")
    .values({
      targetDid,
      actorDid,
      scopes: JSON.stringify(scopes),
      username,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function unsealAccessControl(id: number, passwordHash: string) {
  await db
    .updateTable("accessControls")
    .where("id", "=", id)
    .set({
      passwordHash,
      updatedAt: new Date().toISOString(),
    })
    .execute();
}

export async function updateAccessControl(id: number, scopes: AnyScope[]) {
  return await db
    .updateTable("accessControls")
    .where("id", "=", id)
    .set({
      scopes: JSON.stringify(scopes),
      updatedAt: new Date().toISOString(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function revokeAccessControlById(id: number) {
  await db
    .updateTable("accessControls")
    .where("id", "=", id)
    .set({ revokedAt: new Date().toISOString() })
    .execute();
}

export async function resetAccessControlPassword(id: number) {
  return await db
    .updateTable("accessControls")
    .where("id", "=", id)
    .set({
      passwordHash: null,
      updatedAt: new Date().toISOString(),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}
