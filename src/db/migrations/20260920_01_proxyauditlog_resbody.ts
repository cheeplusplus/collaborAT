import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("proxyAuditLogs")
    .addColumn("responseBody", "jsonb")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("proxyAuditLogs")
    .dropColumn("responseBody")
    .execute();
}
