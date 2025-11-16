import * as fs from "fs";
import { promises as fsp } from "fs";
import * as path from "path";
import {
  FileMigrationProvider,
  Kysely,
  Migrator,
  ParseJSONResultsPlugin,
  SqliteDialect,
} from "kysely";
import SQLite from "better-sqlite3";
import { Database } from "./model";

if (!fs.existsSync("./data/")) {
  fs.mkdirSync("./data/", { recursive: true });
}

const db = new Kysely<Database>({
  dialect: new SqliteDialect({
    database: new SQLite("./data/sharesky.sqlite"),
  }),
  plugins: [new ParseJSONResultsPlugin()],
});

export default db;

export async function migrateToLatest() {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs: fsp,
      path,
      // This needs to be an absolute path.
      migrationFolder: path.join(__dirname, "migrations"),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("failed to migrate");
    console.error(error);
    process.exit(1);
  }
}
