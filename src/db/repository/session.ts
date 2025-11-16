import session, { Store } from "express-session";
import db from "../db";

const EXPIRY_MS = 1000 * 60 * 60 * 24 * 30;

export class ExpressSessionStore extends Store {
  get(
    sid: string,
    callback: (err: any, session?: session.SessionData | null) => void,
  ): void {
    db.selectFrom("expressSession")
      .where("sid", "=", sid)
      .selectAll()
      .executeTakeFirst()
      .then((row) => {
        callback(null, row?.session ?? null);
      })
      .catch((err) => callback(err, null));
  }

  set(
    sid: string,
    session: session.SessionData,
    callback?: (err?: any) => void,
  ): void {
    db.insertInto("expressSession")
      .values({
        sid,
        session: JSON.stringify(session),
        expires: new Date(Date.now() + EXPIRY_MS).toISOString(),
      })
      .onConflict((oc) =>
        oc.column("sid").doUpdateSet({
          session: JSON.stringify(session),
          expires: new Date(Date.now() + EXPIRY_MS).toISOString(),
        }),
      )
      .execute()
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  destroy(sid: string, callback?: (err?: any) => void): void {
    db.deleteFrom("expressSession")
      .where("sid", "=", sid)
      .execute()
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }
}
