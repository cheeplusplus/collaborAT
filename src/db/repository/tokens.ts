import db from "../db";

export async function createProxyToken(
  aclId: number,
  accessToken: string,
  refreshToken: string,
) {
  return await db
    .insertInto("proxyTokens")
    .values({
      aclId,
      accessToken,
      refreshToken,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function validateProxyToken(
  accessToken: string,
  updates: { ip: string; userAgent?: string },
) {
  const row = await db
    .selectFrom("proxyTokens")
    .where("accessToken", "=", accessToken)
    .selectAll()
    .executeTakeFirst();
  if (!row) {
    return undefined;
  }

  await db
    .updateTable("proxyTokens")
    .where("accessToken", "=", accessToken)
    .set({
      ...(row.firstUsedAt === null
        ? { firstUsedAt: new Date().toISOString() }
        : {}),
      lastUsedAt: new Date().toISOString(),
      lastIp: updates.ip,
      lastUserAgent: updates.userAgent ?? null,
    })
    .execute();

  return row;
}

export async function validateProxyRefreshToken(refreshToken: string) {
  return await db
    .selectFrom("proxyTokens")
    .where("refreshToken", "=", refreshToken)
    .selectAll()
    .executeTakeFirst();
}

export async function revokeAccessTokenById(id: number) {
  await db
    .updateTable("proxyTokens")
    .where("id", "=", id)
    .set({
      revokedAt: new Date().toISOString(),
    })
    .execute();
}
export async function revokeAccessTokensByAclId(id: number) {
  await db
    .updateTable("proxyTokens")
    .where("aclId", "=", id)
    .set({
      revokedAt: new Date().toISOString(),
    })
    .execute();
}
