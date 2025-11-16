import crypto from "crypto";
import { KeyObject } from "crypto";
import { getConfig } from "../config";
import * as jose from "jose";
import * as ui8 from "uint8arrays";

let jwtSecretKey: KeyObject | undefined;
function getJwtSecretKey() {
  if (jwtSecretKey) {
    return jwtSecretKey;
  }
  const config = getConfig();
  const key = crypto.createSecretKey(Buffer.from(config.jwtSecretKey));
  jwtSecretKey = key;
  return key;
}

export async function createAccessRefreshTokenPair(did: string) {
  const config = getConfig();
  const jwtKey = getJwtSecretKey();

  return await createTokens({
    did,
    jwtKey,
    serviceDid: `did:web:${config.domain}`,
  });
}

export async function validateToken(
  token: string,
  scope: "access" | "refresh",
): Promise<boolean | "expired"> {
  const jwtKey = getJwtSecretKey();
  const expectedScope =
    scope === "access" ? AuthScope.Access : AuthScope.Refresh;
  const expectedTyp = scope === "access" ? "at+jwt" : "refresh+jwt";
  const expectedAud = `did:web:${getConfig().domain}`;

  try {
    const { payload, protectedHeader } = await jose.jwtVerify(token, jwtKey);
    if (payload.scope !== expectedScope) {
      return false;
    }
    if (protectedHeader.typ && expectedTyp !== protectedHeader.typ) {
      return false;
    }

    const { sub, aud, scope, lxm, cnf, jti } = payload;
    if (!sub?.startsWith("did:")) {
      return false;
    }
    if (aud !== expectedAud) {
      return false;
    }

    return true;
  } catch (err) {
    if (err instanceof jose.errors.JWTExpired) {
      return "expired";
    } else {
      return false;
    }
  }
}

// These methods come from the PDS implementation
// https://github.com/bluesky-social/atproto/blob/main/packages/pds/src/account-manager/helpers/auth.ts

enum AuthScope {
  Access = "com.atproto.access",
  Refresh = "com.atproto.refresh",
}

export type AuthToken = {
  scope: AuthScope;
  sub: string;
  exp: number;
};

export type RefreshToken = AuthToken & {
  scope: AuthScope.Refresh;
  jti: string;
};

const createTokens = async (opts: {
  did: string;
  jwtKey: KeyObject;
  serviceDid: string;
  scope?: AuthScope;
  jti?: string;
  expiresIn?: string | number;
}) => {
  const { did, jwtKey, serviceDid, scope, jti, expiresIn } = opts;
  const [accessJwt, refreshJwt] = await Promise.all([
    createAccessToken({ did, jwtKey, serviceDid, scope, expiresIn }),
    createRefreshToken({ did, jwtKey, serviceDid, jti, expiresIn }),
  ]);
  return { accessJwt, refreshJwt };
};

const createAccessToken = (opts: {
  did: string;
  jwtKey: KeyObject;
  serviceDid: string;
  scope?: AuthScope;
  expiresIn?: string | number;
}): Promise<string> => {
  const {
    did,
    jwtKey,
    serviceDid,
    scope = AuthScope.Access,
    expiresIn = "120mins",
  } = opts;
  const signer = new jose.SignJWT({ scope })
    .setProtectedHeader({
      typ: "at+jwt", // https://www.rfc-editor.org/rfc/rfc9068.html
      alg: "HS256", // only symmetric keys supported
    })
    .setAudience(serviceDid)
    .setSubject(did)
    .setIssuedAt()
    .setExpirationTime(expiresIn);
  return signer.sign(jwtKey);
};

const createRefreshToken = (opts: {
  did: string;
  jwtKey: KeyObject;
  serviceDid: string;
  jti?: string;
  expiresIn?: string | number;
}): Promise<string> => {
  const {
    did,
    jwtKey,
    serviceDid,
    jti = getRefreshTokenId(),
    expiresIn = "90days",
  } = opts;
  const signer = new jose.SignJWT({ scope: AuthScope.Refresh })
    .setProtectedHeader({
      typ: "refresh+jwt",
      alg: "HS256", // only symmetric keys supported
    })
    .setAudience(serviceDid)
    .setSubject(did)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(expiresIn);
  return signer.sign(jwtKey);
};

export const getRefreshTokenId = () => {
  return ui8.toString(crypto.randomBytes(32), "base64");
};
