import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("users")
    .addColumn("did", "text", (col) => col.primaryKey())
    .addColumn("handle", "text", (col) => col.notNull())
    .addColumn("didDoc", "jsonb", (col) => col.notNull())
    .addColumn("lastUsedAt", "timestamp")
    .addColumn("lastIp", "text", (col) => col.notNull())
    .addColumn("lastUserAgent", "text")
    .addColumn("createdAt", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addColumn("updatedAt", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();
  await db.schema
    .createIndex("users_handle")
    .on("users")
    .column("handle")
    .execute();

  await db.schema
    .createTable("accessControls")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("targetDid", "text", (col) =>
      col.notNull().references("users.did").onDelete("cascade"),
    )
    .addColumn("actorDid", "text", (col) =>
      col.notNull().references("users.did").onDelete("cascade"),
    )
    .addColumn("scopes", "jsonb", (col) => col.notNull())
    .addColumn("username", "text", (col) => col.unique().notNull())
    .addColumn("passwordHash", "text")
    .addColumn("createdAt", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addColumn("updatedAt", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addColumn("revokedAt", "timestamp")
    .execute();

  await db.schema
    .createTable("proxyTokens")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("aclId", "integer", (col) =>
      col.notNull().references("accessControls.id").onDelete("cascade"),
    )
    .addColumn("accessToken", "text", (col) => col.unique().notNull())
    .addColumn("refreshToken", "text", (col) => col.unique().notNull())
    .addColumn("firstUsedAt", "timestamp")
    .addColumn("lastUsedAt", "timestamp")
    .addColumn("lastIp", "text")
    .addColumn("lastUserAgent", "text")
    .addColumn("createdAt", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addColumn("revokedAt", "timestamp")
    .execute();

  await db.schema
    .createTable("proxyAuditLogs")
    .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
    .addColumn("aclId", "integer", (col) =>
      col.notNull().references("accessControls.id").onDelete("cascade"),
    )
    .addColumn("proxyTokenId", "integer", (col) =>
      col.notNull().references("proxyTokens.id").onDelete("cascade"),
    )
    .addColumn("ip", "text", (col) => col.notNull())
    .addColumn("userAgent", "text")
    .addColumn("xrpcCall", "text", (col) => col.notNull())
    .addColumn("matchedScope", "text", (col) => col.notNull())
    .addColumn("method", "text", (col) => col.notNull())
    .addColumn("qp", "text")
    .addColumn("records", "jsonb")
    .addColumn("createdAt", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();

  await db.schema
    .createTable("expressSession")
    .addColumn("sid", "text", (col) => col.primaryKey())
    .addColumn("session", "jsonb", (col) => col.notNull())
    .addColumn("expires", "timestamp", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("atprotoStateStore")
    .addColumn("key", "text", (col) => col.primaryKey())
    .addColumn("stateEnc", "jsonb", (col) => col.notNull())
    .addColumn("createdAt", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();
  await db.schema
    .createTable("atprotoSession")
    .addColumn("key", "text", (col) => col.primaryKey())
    .addColumn("sessionEnc", "jsonb", (col) => col.notNull())
    .addColumn("createdAt", "timestamp", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("users").execute();
  await db.schema.dropTable("accessControls").execute();
  await db.schema.dropTable("proxyTokens").execute();
  await db.schema.dropTable("proxyAuditLogs").execute();
  await db.schema.dropTable("expressSession").execute();
  await db.schema.dropTable("atprotoStateStore").execute();
  await db.schema.dropTable("atprotoSession").execute();
}
