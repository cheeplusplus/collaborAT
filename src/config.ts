import * as fs from "fs";
import { Jwk } from "@atproto/oauth-client-node";

export interface Config {
  baseUrl: string;
  domain: string;
  oauth: {
    isLocalhostDev?: boolean;
    clientName: string;
    keyset: Record<string, Jwk>;
  };
  express: {
    sessionSecret: string;
    sessionExpirySec?: number;
  };
  jwtSecretKey: string;
  dbEncryptionKey: string;
  adminDids: string[];
}

let savedConfig: Config | undefined;

export function getConfig(): Config {
  if (savedConfig) {
    return savedConfig;
  }

  const loadedConfig = fs.readFileSync("./sharesky.config.json", "utf8");
  savedConfig = JSON.parse(loadedConfig) as Config;
  return savedConfig;
}

export function getDbEncryptionKey() {
  const { dbEncryptionKey } = getConfig();
  return Buffer.from(dbEncryptionKey, "base64");
}

export function isAdmin(did: string) {
  return getConfig().adminDids.includes(did);
}
