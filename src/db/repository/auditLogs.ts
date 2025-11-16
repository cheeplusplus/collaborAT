import db from "../db";
import { RecordDetails } from "../../util/atprotoTools";

export async function getAuditLogs(aclId: number, limit: number = 100) {
  return await db
    .selectFrom("proxyAuditLogs")
    .where("aclId", "=", aclId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .selectAll()
    .execute();
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
) {
  await db
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
      records: records ? JSON.stringify(records) : null,
    })
    .execute();
}
