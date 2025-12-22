import db from "./db";

export async function assertExpiry() {
  // Generic expiry
  await db
    .deleteFrom("expressSession")
    .where("expires", "<", new Date().toISOString() as any)
    .execute();
  await db
    .deleteFrom("atprotoStateStore")
    .where("createdAt", "<", new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() as any)
    .execute();
}
