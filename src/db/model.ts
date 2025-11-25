import { ColumnType, Generated, JSONColumnType, Selectable } from "kysely";
import { DidDocument } from "@atproto/identity";
import { SessionData as ExpressSessionData } from "express-session";
import { RecordDetails } from "../util/atprotoTools";

type CreatedAtDate = ColumnType<Date, never, never>;
type UpdatedAtDate = ColumnType<Date, never, string>;
type FirstUsedAtDate = ColumnType<
  Date | null,
  string | undefined,
  string | undefined
>;
type LastUsedAtDate = ColumnType<
  Date | null,
  string | undefined,
  string | undefined
>;
type RevokedAtDate = ColumnType<Date | null, never, string | undefined>;

export interface Database {
  users: UserTable;
  accessControls: AccessControlTable;
  proxyTokens: ProxyTokenTable;
  proxyAuditLogs: ProxyAuditLogTable;
  repoAuditLogs: RepoAuditLogTable;
  expressSession: ExpressSessionTable;
  atprotoStateStore: AtprotoStateStoreTable;
  atprotoSession: AtprotoSessionTable;
}

interface UserPreferences {}

export interface UserTable {
  did: string;
  handle: string;
  didDoc: JSONColumnType<DidDocument>;

  grantedScopes: string;
  preferences: JSONColumnType<UserPreferences>;

  // security tracking data
  lastUsedAt: LastUsedAtDate;
  lastIp: string;
  lastUserAgent: string | null;

  createdAt: CreatedAtDate;
  updatedAt: UpdatedAtDate;
}

export interface AccessControlTable {
  id: Generated<number>;

  targetDid: string; // target is the account being performed upon
  actorDid: string; // actor is the account performing the action
  scopes: JSONColumnType<string[]>; // TODO: can we do this as a native array?

  username: string;
  passwordHash: ColumnType<string | null, never, string | null>;

  createdAt: CreatedAtDate;
  updatedAt: UpdatedAtDate;
  revokedAt: RevokedAtDate;
}

export interface ProxyTokenTable {
  id: Generated<number>;
  aclId: number;

  // TODO: Either these should be encrypted, or we shouldn't store them and only validate JWTs
  accessToken: string;
  refreshToken: string;

  // security tracking data
  firstUsedAt: FirstUsedAtDate;
  lastUsedAt: LastUsedAtDate;
  lastIp: string | null;
  lastUserAgent: string | null;

  createdAt: CreatedAtDate;
  revokedAt: RevokedAtDate;
}

export interface ProxyAuditLogTable {
  id: Generated<number>;
  aclId: number;
  proxyTokenId: number;

  ip: string;
  userAgent: string | undefined;

  xrpcCall: string;
  matchedScope: string;
  method: string;
  qp: string | null;

  createdAt: CreatedAtDate;
}

export interface RepoAuditLogTable {
  id: Generated<number>;

  // we want to keep track of more than just proxy actions
  targetDid: string;
  actorDid: string;
  auditLogId: number | null;

  action: string;
  record: JSONColumnType<RecordDetails>;

  createdAt: CreatedAtDate;
}

export interface ExpressSessionTable {
  sid: string;
  session: JSONColumnType<ExpressSessionData>;
  expires: ColumnType<Date, string, string>;
}

export interface AtprotoStateStoreTable {
  key: string;
  stateEnc: string;
  createdAt: CreatedAtDate;
}

export interface AtprotoSessionTable {
  key: string;
  sessionEnc: string;
  createdAt: CreatedAtDate;
}

export type User = Selectable<UserTable>;
export type AccessControl = Selectable<AccessControlTable>;
export type ProxyToken = Selectable<ProxyTokenTable>;
export type ProxyAuditLog = Selectable<ProxyAuditLogTable>;
export type RepoAuditLog = Selectable<RepoAuditLogTable>;
export type ExpressSession = Selectable<ExpressSessionTable>;
export type AtprotoStateStore = Selectable<AtprotoStateStoreTable>;
export type AtprotoSession = Selectable<AtprotoSessionTable>;
