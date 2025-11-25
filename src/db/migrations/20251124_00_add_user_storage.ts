import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("users")
    .addColumn("grantedScopes", "text")
    .execute();
  await db.schema
    .alterTable("users")
    .addColumn("preferences", "jsonb")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("users")
    .dropColumn("grantedScopes")
    .dropColumn("preferences")
    .execute();
}
