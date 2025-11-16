import db from "../db";
import {
  NodeSavedSession,
  NodeSavedState,
  NodeSavedStateStore,
} from "@atproto/oauth-client-node";
import { dbEncryptJson, dbDecryptJson } from "../encryption";

export const AtprotoStateStore = {
  async set(key: string, state: NodeSavedState): Promise<void> {
    await db
      .insertInto("atprotoStateStore")
      .values({
        key,
        stateEnc: dbEncryptJson(state),
      })
      .onConflict((oc) =>
        oc.column("key").doUpdateSet({ stateEnc: dbEncryptJson(state) }),
      )
      .execute();
  },
  async get(key: string): Promise<NodeSavedState | undefined> {
    const row = await db
      .selectFrom("atprotoStateStore")
      .where("key", "=", key)
      .selectAll()
      .executeTakeFirst();
    if (!row) {
      return undefined;
    }
    return dbDecryptJson<NodeSavedState>(row.stateEnc);
  },
  async del(key: string): Promise<void> {
    await db.deleteFrom("atprotoStateStore").where("key", "=", key).execute();
  },
} satisfies NodeSavedStateStore;

export const AtprotoSessionStore = {
  async set(key: string, session: NodeSavedSession): Promise<void> {
    await db
      .insertInto("atprotoSession")
      .values({
        key,
        sessionEnc: dbEncryptJson(session),
      })
      .onConflict((oc) =>
        oc.column("key").doUpdateSet({ sessionEnc: dbEncryptJson(session) }),
      )
      .execute();
  },
  async get(key: string): Promise<NodeSavedSession | undefined> {
    const row = await db
      .selectFrom("atprotoSession")
      .where("key", "=", key)
      .selectAll()
      .executeTakeFirst();
    if (!row) {
      return undefined;
    }
    return dbDecryptJson<NodeSavedSession>(row.sessionEnc);
  },
  async del(key: string): Promise<void> {
    await db.deleteFrom("atprotoSession").where("key", "=", key).execute();
  },
};
