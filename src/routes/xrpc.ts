import cors from "cors";
import express from "express";
import {
  Agent,
  ComAtprotoServerCreateSession,
  ComAtprotoServerDescribeServer,
  ComAtprotoServerGetSession,
} from "@atproto/api";
import {
  createProxyToken,
  revokeAccessTokenById,
  validateProxyRefreshToken,
} from "../db/repository/tokens";
import {
  getAccessControlById,
  getAccessControlByLogin,
} from "../db/repository/accessControl";
import { getConfig } from "../config";
import { createAccessRefreshTokenPair } from "../util/atprotoTokens";
import { verifyPassword } from "../util/security";
import { DidDocument } from "@atproto/identity";
import xrpcProxy from "./xrpcProxy";
import {
  atprotoError,
  modifyDidDoc,
  getAndValidateTokenFromHeaders,
  getAndValidateAclFromHeaders,
} from "./xrpcCommon";

/*
  Implementation notes:
  This area is sensitive because we're passing through requests on behalf of a user.
  This is also where all responses need to be what Bluesky expects, so the input/output should match the XRPC specs.
*/

const app = express.Router();

// Replicate the PDS's CORS configuration
// https://github.com/bluesky-social/atproto/blob/b7bc95d6abe1136d3ad23b2ff23f6a9991bb373a/packages/pds/src/index.ts#L161
app.use(cors());

app.post(
  "/com.atproto.server.createSession",
  express.json(),
  async (req, res) => {
    const body = req.body as ComAtprotoServerCreateSession.InputSchema;
    if (!body.identifier || !body.password) {
      return atprotoError(
        res,
        "InvalidRequest",
        "Missing identifier or password",
        400,
      );
    }

    // Find the user by login details and get the target
    const acl = await getAccessControlByLogin(body.identifier);
    if (!acl) {
      return atprotoError(res, "SHARESKY_ERR", "No ACL found", 401);
    }

    if (!acl.passwordHash) {
      return atprotoError(
        res,
        "InvalidRequest",
        "Incorrect password [NI]",
        400,
      );
    }
    if (!verifyPassword(body.password, acl.passwordHash)) {
      // TODO: Figure out what the client actually expects
      return atprotoError(
        res,
        "InvalidRequest",
        "Incorrect password [HF]",
        400,
      );
    }

    // Ensure we have a valid oauth token with the upstream PDS
    const session = await req.atprotoClient.restore(acl.targetDid);
    const agent = new Agent(session);
    const { data: repo } = await agent.com.atproto.repo.describeRepo({
      repo: acl.targetDid,
    });

    // Generate, save, and return client session token
    const { accessJwt, refreshJwt } = await createAccessRefreshTokenPair(
      acl.targetDid,
    );
    await createProxyToken(acl.id, accessJwt, refreshJwt);
    res.json({
      accessJwt,
      refreshJwt,
      handle: repo.handle,
      did: repo.did,
      didDoc: modifyDidDoc(repo.didDoc as DidDocument),
      active: true,
      // TODO: handle other login things here
    } satisfies ComAtprotoServerCreateSession.OutputSchema);
  },
);

app.post("/com.atproto.server.refreshSession", async (req, res) => {
  // Get the refresh token out of the request
  const bearerToken = await getAndValidateTokenFromHeaders(req, res, "refresh");
  if (!bearerToken) {
    return;
  }

  // Find the user by login details and get the target
  const originalToken = await validateProxyRefreshToken(bearerToken);
  if (!originalToken) {
    return atprotoError(res, "SHARESKY_ERR", "Invalid refresh token", 401);
  }
  if (originalToken.revokedAt) {
    return atprotoError(res, "ExpiredToken", "Token was revoked", 400);
  }

  const acl = await getAccessControlById(originalToken.aclId);
  if (!acl) {
    return atprotoError(res, "SHARESKY_ERR", "No ACL found", 401);
  }

  // Ensure we have a valid oauth token with the upstream PDS
  const session = await req.atprotoClient.restore(acl.targetDid);
  const agent = new Agent(session);
  const { data: repo } = await agent.com.atproto.repo.describeRepo({
    repo: acl.targetDid,
  });

  // Generate, save, and return client session token
  const { accessJwt, refreshJwt } = await createAccessRefreshTokenPair(
    acl.targetDid,
  );
  await createProxyToken(acl.id, accessJwt, refreshJwt);
  await revokeAccessTokenById(originalToken.id);
  res.json({
    accessJwt,
    refreshJwt,
    handle: repo.handle,
    did: repo.did,
    didDoc: modifyDidDoc(repo.didDoc as DidDocument),
    active: true,
    // TODO: handle other login things here
  } satisfies ComAtprotoServerCreateSession.OutputSchema);
});

app.get("/com.atproto.server.getSession", async (req, res) => {
  const aclData = await getAndValidateAclFromHeaders(req, res);
  if (!aclData) {
    return;
  }
  const { acl } = aclData;

  // TODO: Find a better way to get the current handle
  const session = await req.atprotoClient.restore(acl.targetDid);
  const agent = new Agent(session);
  const { data: repo } = await agent.com.atproto.repo.describeRepo({
    repo: acl.targetDid,
  });

  // Return the minimum amount of info unless we have to
  // It's possible that things may want the didDoc but it's not listed as required so
  res.json({
    handle: repo.handle,
    did: repo.did,
  } satisfies ComAtprotoServerGetSession.OutputSchema);
});

app.get("/com.atproto.server.describeServer", (req, res) => {
  // TODO: Figure out how much of this is actually required (or if the client even really cares)
  // Most of this is probably to handle registration and not for login
  const config = getConfig();
  res.json({
    did: `did:web:${config.domain}`,
    // flags to prevent registration attempts since we don't support it
    availableUserDomains: [],
    inviteCodeRequired: true,
  } satisfies ComAtprotoServerDescribeServer.OutputSchema);
});

app.all("/{*path}", express.raw({ type: "*/*", limit: '1Mb' }), xrpcProxy);

export default app;
