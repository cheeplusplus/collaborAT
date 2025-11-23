import { requireAdmin } from "../middleware/auth";
import { getAllAccessControls } from "../db/repository/accessControl";
import { UserLookupCache } from "../util/userCache";
import express from "express";
import { getAllUsers } from "../db/repository/user";
import { getRecentAuditLogs } from "../db/repository/auditLogs";

const app = express.Router();
app.use(requireAdmin());

app.get("/acls", async (req, res) => {
  const acls = await getAllAccessControls();
  const uCache = new UserLookupCache();
  const metaAcls = await Promise.all(
    acls.map(async (acl) => ({
      id: acl.id,
      actorHandle: await uCache.getHandle(acl.actorDid),
      targetHandle: await uCache.getHandle(acl.targetDid),
      hasPassword: !!acl.passwordHash,
      hasSession: acl.hasSession,
      scopes: acl.scopes,
    })),
  );

  return res.render("admin/acls", { acls: metaAcls });
});

app.get("/audit-logs", async (req, res) => {
  const auditLogs = await getRecentAuditLogs();
  return res.render("admin/audit-logs", { auditLogs });
});

app.get("/users", async (req, res) => {
  const users = await getAllUsers();
  return res.render("admin/users", { users });
});

export default app;
