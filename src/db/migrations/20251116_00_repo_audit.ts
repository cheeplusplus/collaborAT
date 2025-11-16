import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("repoAuditLogs")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("targetDid", "text", (col) =>
      col.notNull().references("users.did").onDelete("cascade"),
    )
    .addColumn("actorDid", "text", (col) =>
      col.notNull().references("users.did").onDelete("cascade"),
    )
    .addColumn("auditLogId", "integer", (col) =>
      col.references("proxyAuditLogs.id").onDelete("set null"),
    )
    .addColumn("action", "text", (col) => col.notNull())
    .addColumn("record", "jsonb", (col) => col.notNull())
    .addColumn("createdAt", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();
  await db.schema
    .createIndex("repoAuditLogs_auditLogId")
    .on("repoAuditLogs")
    .column("auditLogId")
    .execute();
  await db.schema
    .createIndex("repoAuditLogs_targetDid_actorDid")
    .on("repoAuditLogs")
    .columns(["targetDid", "actorDid"])
    .execute();

  await db.schema.alterTable("proxyAuditLogs").dropColumn("records").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("proxyRepoAuditLogs").execute();
  await db.schema
    .alterTable("proxyAuditLogs")
    .addColumn("records", "jsonb")
    .execute();
}
