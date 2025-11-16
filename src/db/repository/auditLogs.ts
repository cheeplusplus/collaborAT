import _ from "lodash";
import db from "../db";
import { RecordDetails } from "../../util/atprotoTools";
import { ProxyAuditLog, RepoAuditLog } from "../model";

export async function getAuditLogs(
  aclId: number,
  limit: number = 100,
  attachRecords?: boolean,
) {
  const rows = await db
    .selectFrom("proxyAuditLogs")
    .where("aclId", "=", aclId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .selectAll()
    .execute();

  let output: (ProxyAuditLog & { records?: RepoAuditLog[] })[] = rows;

  // hacky relationship nesting
  if (attachRecords) {
    const recordRows = await db
      .selectFrom("repoAuditLogs")
      .where(
        "auditLogId",
        "in",
        rows.map((row) => row.id),
      )
      .selectAll()
      .execute();
    const groupedRecords = _.groupBy(recordRows, "auditLogId");

    output = output.map((m) => ({
      ...m,
      records: groupedRecords[m.id] ?? [],
    }));
  }

  return output;
}

export async function createAuditLogEvent(
  aclId: number,
  proxyTokenId: number,
  event: {
    xrpcCall: string;
    matchedScope: string;
    method: string;
    qp: string;
  },
  records: RecordDetails[] | undefined,
  actor: { did: string; ip: string; userAgent?: string },
  target: { did: string },
) {
  await db.transaction().execute(async (trx) => {
    const log = await trx
      .insertInto("proxyAuditLogs")
      .values({
        aclId,
        proxyTokenId,
        ip: actor.ip,
        userAgent: actor.userAgent,
        xrpcCall: event.xrpcCall,
        matchedScope: event.matchedScope,
        method: event.method,
        qp: event.qp,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    if (records && records?.length > 0) {
      await trx
        .insertInto("repoAuditLogs")
        .values(
          records.map((ev) => ({
            targetDid: target.did,
            actorDid: actor.did,
            auditLogId: log.id,
            action: ev.operation,
            record: JSON.stringify(
              _.pickBy(
                ev,
                (v, k) => !["operationSource", "operation"].includes(k),
              ),
            ),
          })),
        )
        .execute();
    }
  });
}
