import _ from "lodash";
import express from "express";
import { assertUser, requireUser } from "../middleware/auth";
import {
  createAccessControl,
  getAccessControlById,
  getAccessControlsByActorDid,
  getAccessControlsByTargetDid,
  revokeAccessControlById,
  unsealAccessControl,
  updateAccessControl,
} from "../db/repository/accessControl";
import { getUser } from "../db/repository/user";
import {
  generateRandomPassword,
  generateRandomUsername,
  hashPassword,
} from "../util/security";
import { AccessControl, User } from "../db/model";
import { revokeAccessTokenByAclId } from "../db/repository/tokens";
import {
  EndpointCategoryDescriptions,
  isValidScope,
  RecordCollectionCategoryDescriptions,
} from "../scoping/scopes";
import { getAuditLogs } from "../db/repository/auditLogs";

const app = express.Router();

const safeAcl = (
  acl: AccessControl & {
    hasSession?: boolean;
  },
) => ({
  ...acl,
  passwordHash: undefined,
  hasPassword: !!acl.passwordHash,
  hasSession: acl.hasSession,
});

async function requireAcl(req: express.Request, res: express.Response) {
  assertUser(req.user);
  const aclId = req.params.aclId;
  if (!aclId) {
    res.status(400).json({ error: "Missing ACL ID" });
    return undefined;
  }
  const acl = await getAccessControlById(parseInt(aclId));
  if (!acl) {
    res.status(404).json({ error: "ACL not found" });
    return undefined;
  }
  if (acl.actorDid !== req.user.userDid && acl.targetDid !== req.user.userDid) {
    res.status(403).json({ error: "ACL is not yours" });
    return undefined;
  }
  return acl;
}

app.get("/", requireUser(), async (req, res) => {
  // List ACLs
  assertUser(req.user);
  const grantedByMe = await getAccessControlsByTargetDid(req.user.userDid);
  const grantedToMe = await getAccessControlsByActorDid(req.user.userDid);

  let uCache: Record<string, User> = {};
  const transformGrant = async (acl: AccessControl) => {
    const actorUser = uCache[acl.actorDid] ?? (await getUser(acl.actorDid));
    uCache[acl.actorDid] = actorUser;
    const actorHandle = actorUser?.handle ?? "(@unknown)";
    const targetUser = uCache[acl.targetDid] ?? (await getUser(acl.targetDid));
    uCache[acl.targetDid] = targetUser;
    const targetHandle = targetUser?.handle ?? "(@unknown)";

    return {
      actorHandle,
      targetHandle,
      ...safeAcl(acl),
    };
  };

  return res.render("acl/index", {
    grantedByMe: await Promise.all(grantedByMe.map(transformGrant)),
    grantedToMe: await Promise.all(grantedToMe.map(transformGrant)),
  });
});

interface CreateAclRequest {
  /** The DID of the account we want to act as us */
  actorDid: string;
}

app.post("/", requireUser(), express.urlencoded(), async (req, res) => {
  // Create ACL
  assertUser(req.user);
  const body = req.body as CreateAclRequest;

  const resolvedDid = await req.atprotoClient.identityResolver.resolve(
    body.actorDid,
  );
  if (!resolvedDid) {
    return res.status(400).json({ error: "Failed to resolve actor" });
  }
  const actorDid = resolvedDid.did;

  // Validate that the actor DID is registered
  const actorUser = await getUser(actorDid);
  if (!actorUser) {
    return res.status(400).json({ error: "Actor DID not registered" });
  }

  const username = generateRandomUsername(
    actorUser.handle,
    req.user.userRecord.handle,
  );
  const acl = await createAccessControl(
    req.user.userDid,
    actorDid,
    [], // require editing to set scopes
    username,
  );

  res.redirect(`/acl/${acl.id}`);
});

app.get("/:aclId", requireUser(), async (req, res) => {
  // ACL details
  assertUser(req.user);
  const acl = await requireAcl(req, res);
  if (!acl) {
    return;
  }

  const actorUser = await getUser(acl.actorDid);
  if (!actorUser) {
    return res.status(404).json({ error: "Actor DID not registered" });
  }
  const targetUser = await getUser(acl.targetDid);
  if (!targetUser) {
    return res.status(404).json({ error: "Target DID not registered" });
  }

  const endpointCategories = _.chain(EndpointCategoryDescriptions)
    .omit("_FORBID")
    .map((v, k) => ({
      value: k,
      label: v,
      active: acl.scopes.includes(`cat:${k}`),
    }))
    .value();
  const recordCategories = _.chain(RecordCollectionCategoryDescriptions)
    .omit("_FORBID")
    .map((v, k) => ({
      value: k,
      label: v,
      active: acl.scopes.includes(`record:${k}:*`), // augh
    }))
    .value();

  return res.render("acl/view", {
    acl: safeAcl(acl),
    mine: acl.targetDid === req.user.userDid,
    targetUser,
    actorUser,
    endpointCategories,
    recordCategories,
  });
});

interface UpdateAclRequest {
  "endpointCategories[]": string[];
  "recordCategories[]": string[];
}

app.post("/:aclId", requireUser(), express.urlencoded(), async (req, res) => {
  // Update ACL
  assertUser(req.user);
  const acl = await requireAcl(req, res);
  if (!acl) {
    return;
  }

  // This should be called only by the targetDid user
  if (acl.targetDid !== req.user.userDid) {
    return res.status(403).json({ error: "Actor cannot edit ACL" });
  }

  const body = req.body as UpdateAclRequest;
  const endpointScopes = _.chain(body["endpointCategories[]"])
    .castArray()
    .map((m) => `cat:${m}`)
    .value();
  const recordScopes = _.chain(body["recordCategories[]"])
    .castArray()
    .map((m) => `record:${m}:*`) // augh
    .value();
  const allScopes = _.filter([...endpointScopes, ...recordScopes], (f) =>
    isValidScope(f),
  );

  await updateAccessControl(acl.id, allScopes);

  res.redirect(`/acl/${acl.id}`);
});

app.get("/:aclId/audit", requireUser(), async (req, res) => {
  // ACL details
  assertUser(req.user);
  const acl = await requireAcl(req, res);
  if (!acl) {
    return;
  }

  const auditLogs = await getAuditLogs(acl.id);
  return res.render("acl/audit", {
    acl: safeAcl(acl),
    mine: acl.targetDid === req.user.userDid,
    auditLogs,
  });
});

// TODO: We should include a password reset that includes revoking proxy tokens (but not the ACL itself)
// or this should just be that (/resetPassword)
app.post("/:aclId/unseal", requireUser(), async (req, res) => {
  // Unseal an ACL password
  assertUser(req.user);
  const acl = await requireAcl(req, res);
  if (!acl) {
    return;
  }

  // This should be called only by the actorDid user
  if (acl.actorDid !== req.user.userDid) {
    return res.status(403).json({ error: "Target cannot unseal ACL" });
  }

  if (acl.passwordHash) {
    // For now only allow unsealing once
    return res.status(401).json({ error: "already unsealed" });
  }

  // The user should only see this once
  const password = generateRandomPassword();
  const hashedPassword = await hashPassword(password);
  await unsealAccessControl(acl.id, hashedPassword);

  return res.render("acl/unseal", {
    targetDid: acl.targetDid,
    username: acl.username,
    password,
  });
});

app.post("/:aclId/revoke", requireUser(), async (req, res) => {
  // Revoke ACL
  assertUser(req.user);
  const acl = await requireAcl(req, res);
  if (!acl) {
    return;
  }

  // This should be called only by the targetDid user
  if (acl.targetDid !== req.user.userDid) {
    return res.status(403).json({ error: "Actor cannot revoke ACL" });
  }

  if (acl.revokedAt) {
    return res.status(400).json({ error: "ACL is already revoked" });
  }

  await revokeAccessTokenByAclId(acl.id);
  await revokeAccessControlById(acl.id);
  res.redirect("/acl");
});

app.post("/:aclId/invalidate-sessions", requireUser(), async (req, res) => {
  // Invalidate sessions for ACL
  assertUser(req.user);
  const acl = await requireAcl(req, res);
  if (!acl) {
    return;
  }

  // This should be called only by the actorDid user
  if (acl.actorDid !== req.user.userDid) {
    return res
      .status(403)
      .json({ error: "Target cannot invalidate ACL sessions" });
  }

  await revokeAccessTokenByAclId(acl.id);
  res.redirect(`/acl/${acl.id}`);
});

export default app;
