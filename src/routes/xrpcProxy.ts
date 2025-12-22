import _ from "lodash";
import express from "express";
import { atprotoError, getAndValidateAclFromHeaders } from "./xrpcCommon";
import { getUser } from "../db/repository/user";
import {
  extractRecordDetailsFromRequest,
  extractRecordDetailsFromResponse,
  RecordDetails,
  RecordRequestDetails,
  RecordResponseDetails,
} from "../util/atprotoTools";
import { createAuditLogEvent } from "../db/repository/auditLogs";
import { inScope, isFastForbidden } from "../scoping/checker";
import { AnyScope } from "../scoping/scopes";

// Don't allow calling these with any method
const FORBIDDEN_XRPC_PREFIXES = [
  "com.atproto.admin.",
  "com.atproto.server.",
  "com.atproto.sync.",
  "tools.ozone.",
];

// Ignore writing audit logs for these calls
const IGNORE_WRITE_AUDIT = ["app.bsky.notification.updateSeen"];

// Headers that we can't pass to/from the PDS or things break
const IGNORE_OUTBOUND_HEADERS: Lowercase<string>[] = [
  "host",
  "content-encoding",
  "content-length",
];
const IGNORE_INBOUND_HEADERS: Lowercase<string>[] = [
  "content-encoding",
  "content-length",
  "x-content-encoding-over-network",
];

const xrpcProxy = async (req: express.Request, res: express.Response) => {
  const xrpcName = (req.params as { path: string }).path[0];
  if (!xrpcName) {
    return atprotoError(res, "InvalidRequest", "Missing XRPC call name", 400);
  }

  // Check the forbidden list to skip any prefixes we're not allowed
  if (
    FORBIDDEN_XRPC_PREFIXES.some((s) =>
      xrpcName.toLowerCase().startsWith(s.toLowerCase()),
    )
  ) {
    return atprotoError(res, "InvalidRequest", "Forbidden XRPC call", 400);
  }
  if (req.method === "POST" && isFastForbidden(xrpcName)) {
    return atprotoError(res, "InvalidRequest", "Forbidden XRPC call", 400);
  }

  const aclData = await getAndValidateAclFromHeaders(req, res);
  if (!aclData) {
    return;
  }
  const { acl, token } = aclData;

  let requestEvent: RecordRequestDetails[] | undefined;
  if (req.headers["content-type"]?.startsWith("application/json")) {
    try {
      const reqJsonBody = JSON.parse(req.body.toString("utf-8"));
      requestEvent = extractRecordDetailsFromRequest(xrpcName, reqJsonBody);
    } catch (e) {
      // Don't die, we still audit log
      console.warn("Failed to extract record details from request", e);
    }
  }

  // Enforce ACL scopes
  const matchedScopes: AnyScope[] = [];
  if (req.method === "POST") {
    // Right now we only validate scopes for POST requests, all GETs are allowed
    let hasCheckedEventScopes = false;
    if (requestEvent && requestEvent.length > 0) {
      // Check scopes on each inner request to validate repo operations
      for (const event of requestEvent ?? []) {
        if (!event.collection) {
          continue;
        }
        const inScopeEventRes = inScope(
          event.operationSource,
          acl.scopes as AnyScope[],
          event.collection,
        );
        if (!inScopeEventRes.matched) {
          console.warn(
            "Interaction: ACL action disallowed",
            xrpcName,
            `acl#${acl.id}`,
            acl.scopes,
            `token#${token.id}`,
            inScopeEventRes,
          );
          return atprotoError(
            res,
            "InvalidRequest",
            "ACL action disallowed",
            400,
          );
        } else if (inScopeEventRes.matchedScopes) {
          matchedScopes.push(...inScopeEventRes.matchedScopes);
        }
        hasCheckedEventScopes = true;
      }
    }

    if (!hasCheckedEventScopes) {
      // Check all scopes if we have no event scopes (causes problems with partial scope matching)
      const inScopeRes = inScope(xrpcName, acl.scopes as AnyScope[]);
      if (!inScopeRes.matched) {
        console.warn(
          "Interaction: ACL action disallowed",
          xrpcName,
          `acl#${acl.id}`,
          acl.scopes,
          `token#${token.id}`,
          inScopeRes,
        );
        return atprotoError(
          res,
          "InvalidRequest",
          "ACL action disallowed",
          400,
        );
      } else if (inScopeRes.matchedScopes) {
        matchedScopes.push(...inScopeRes.matchedScopes);
      }
    }
  }

  const did = acl.targetDid;
  const user = await getUser(did);
  if (!user) {
    return atprotoError(res, "SHARESKY_ERR", "User not found", 401);
  }

  const atprotoPds = user.didDoc.service?.find(
    (f) => f.id === "#atproto_pds",
  )?.serviceEndpoint;
  if (!atprotoPds) {
    return atprotoError(res, "SHARESKY_ERR", "User has no PDS", 401);
  }

  // Restore the session to make sure it's up to date
  const session = await req.atprotoClient.restore(did);

  const origUrl = new URL(req.originalUrl, "http://invalid");
  const outboundHeaders: Record<string, string> = _.chain(req.headers)
    .pickBy(
      (v, k) =>
        !!v && !(IGNORE_OUTBOUND_HEADERS as string[]).includes(k.toLowerCase()),
    )
    .value() as Record<string, string>;

  const rewrittenUrl = `${atprotoPds}/xrpc/${xrpcName}${origUrl.search}`;
  const proxyReq = await session.fetchHandler(rewrittenUrl, {
    method: req.method,
    body:
      req.body instanceof Buffer && req.method === "POST"
        ? new Uint8Array(req.body)
        : undefined,
    headers: { ...outboundHeaders },
  });

  let proxyRes: any | undefined;
  let responseEvent: RecordResponseDetails[] | undefined;
  if (proxyReq.headers.get("content-type")?.startsWith("application/json")) {
    proxyRes = await proxyReq.json();

    try {
      responseEvent = extractRecordDetailsFromResponse(xrpcName, proxyRes);
    } catch (e) {
      // Don't die, we still audit log
      console.warn("Failed to extract record details from response", e);
    }
  }

  // Merge request and response events together. These should be in order with each other (hopefully...)
  let eventDetails: RecordDetails[] = [];
  if (requestEvent && requestEvent.length > 0) {
    for (let i = 0; i < requestEvent.length; i++) {
      const reqEvent = requestEvent?.[i];
      const resEvent = responseEvent?.[i];
      eventDetails.push({
        ...reqEvent,
        ...resEvent,
      });
    }
  }

  console.log(
    "proxy",
    `acl#${acl.id}`,
    `token#${token.id}`,
    req.method,
    xrpcName,
    rewrittenUrl,
    "->",
    proxyReq.status,
    req.method === "GET" && proxyReq.status === 200
      ? "(body elided)"
      : proxyRes,
    eventDetails,
    matchedScopes,
  );

  if (
    req.method === "POST" &&
    !IGNORE_WRITE_AUDIT.map((m) => m.toLowerCase()).includes(
      xrpcName.toLowerCase(),
    )
  ) {
    // Only log "writes", GETs are too noisy
    await createAuditLogEvent(
      acl.id,
      token.id,
      {
        xrpcCall: xrpcName,
        matchedScope: _.chain(matchedScopes).uniq().join(" ").value(),
        method: req.method as string,
        qp: JSON.stringify(req.query),
      },
      eventDetails,
      {
        did: acl.actorDid,
        ip: req.ip!,
        userAgent: req.headers["user-agent"],
      },
      {
        did: acl.targetDid,
      },
    );
  }

  res.status(proxyReq.status);

  for (const [obHeaderName, obHeaderValue] of proxyReq.headers.entries()) {
    if ((IGNORE_INBOUND_HEADERS as string[]).includes(obHeaderName)) {
      continue;
    }

    res.header(obHeaderName, obHeaderValue);
  }

  if (proxyRes) {
    res.json(proxyRes);
  } else {
    const proxyOutBuf = await proxyReq.arrayBuffer();
    const proxyBufBuf = Buffer.from(proxyOutBuf);
    res.send(proxyBufBuf);
  }
};

export default xrpcProxy;
