import express from "express";
import { DidDocument } from "@atproto/identity";
import { getConfig } from "../config";
import { validateProxyToken } from "../db/repository/tokens";
import { getAccessControlById } from "../db/repository/accessControl";
import { validateToken } from "../util/atprotoTokens";

export const atprotoError = (
  res: express.Response,
  error: string,
  message: string,
  code: number = 500,
) => res.status(code).json({ error, message });

export const modifyDidDoc = (didDoc: DidDocument) => {
  const config = getConfig();
  return {
    ...didDoc,
    // Replace the PDS with our own
    service: [
      {
        id: "#atproto_pds",
        type: "AtprotoPersonalDataServer",
        serviceEndpoint: config.baseUrl,
      },
    ],
  };
};

export async function getAndValidateTokenFromHeaders(
  req: express.Request,
  res: express.Response,
  scope: "access" | "refresh",
) {
  // Get the token out of the request
  const bearerToken = req.headers.authorization?.split(" ")?.[1];
  if (!bearerToken) {
    atprotoError(res, "InvalidToken", "Invalid authorization header", 400);
    return undefined;
  }

  const validated = await validateToken(bearerToken, scope);
  if (!validated) {
    atprotoError(res, "InvalidToken", "Invalid token", 400);
    return undefined;
  } else if (validated === "expired") {
    atprotoError(res, "ExpiredToken", "Token expired", 400);
    return undefined;
  }

  return bearerToken;
}

export async function getAndValidateAclFromHeaders(
  req: express.Request,
  res: express.Response,
) {
  // Get the access token out of the request
  const bearerToken = await getAndValidateTokenFromHeaders(req, res, "access");
  if (!bearerToken) {
    return;
  }

  const token = await validateProxyToken(bearerToken, {
    ip: req.ip!,
    userAgent: req.headers["user-agent"] as string,
  });
  if (!token) {
    atprotoError(res, "InvalidToken", "Token not found", 400);
    return undefined;
  } else if (token.revokedAt) {
    atprotoError(res, "ExpiredToken", "Token was revoked", 400);
    return undefined;
  }

  const acl = await getAccessControlById(token.aclId);
  if (!acl || acl.revokedAt) {
    atprotoError(res, "SHARESKY_ERR", "No ACL found", 401);
    return undefined;
  }

  return { acl, token };
}
