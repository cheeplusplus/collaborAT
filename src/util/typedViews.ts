import { type Response } from "express";
import { AccessControl, ProxyAuditLog, User } from "../db/model";

type Options = { value: string; label: string; active: boolean };
type SafeAcl = Omit<AccessControl, "passwordHash"> & {
  passwordHash: null | undefined | never; // never send this to the templater
  hasPassword: boolean;
  hasSession: boolean;
};
type SafeAclWithHandles = SafeAcl & {
  actorHandle: string;
  targetHandle: string;
};

/** View names with their available typed local variables */
interface ViewLocals {
  "acl/audit": {
    acl: SafeAcl;
    auditLogs: (Omit<ProxyAuditLog, "createdAt"> & { createdAt: string })[];
  };
  "acl/index": {
    grantedByMe: SafeAclWithHandles[];
    grantedToMe: SafeAclWithHandles[];
    atReadOnly: boolean;
  };
  "acl/unseal": {
    targetDid: string;
    username: string;
    password: string;
    serverHost: string;
  };
  "acl/view": {
    acl: SafeAcl;
    actorUser: User;
    targetUser: User;
    mine: boolean;
    endpointCategories: Options[];
    recordCategories: Options[];
  };
  "admin/acls": { acls: unknown[] };
  "admin/audit-logs": { auditLogs: unknown[] };
  "admin/users": { users: User[] };
  "auth/login": {};
  "index/index": { loggedInDid?: string; atReadOnly?: boolean };
}

export type TypedRenderFn = <
  T extends keyof ViewLocals,
  K extends ViewLocals[T],
>(
  view: T,
  locals: K,
) => void;

export function typedRender<
  T extends keyof ViewLocals,
  K extends ViewLocals[T],
>(res: Response, view: T, locals: K) {
  res.render(view, locals);
}
