import { JoseKey } from "@atproto/jwk-jose";
import {
  AtprotoSessionStore,
  AtprotoStateStore,
} from "../db/repository/atproto";
import { getConfig } from "../config";
import { NodeOAuthClient } from "@atproto/oauth-client-node";

export async function getOAuthClient() {
  const { baseUrl, oauth: oauthConfig } = getConfig();
  const callbackUrl = `${baseUrl}/atproto-oauth-callback`;
  const scopes = ["atproto", "transition:generic"];

  return new NodeOAuthClient({
    // This object will be used to build the payload of the /client-metadata.json
    // endpoint metadata, exposing the client metadata to the OAuth server.
    clientMetadata: {
      // Must be a URL that will be exposing this metadata
      client_id: oauthConfig.isLocalhostDev
        ? `http://localhost?redirect_uri=${callbackUrl}&scope=${scopes.join("%20")}`
        : `${baseUrl}/client-metadata.json`,
      client_name: oauthConfig.clientName,
      client_uri: baseUrl,
      // logo_uri: `${oauthConfig.baseUrl}/logo.png`,
      // tos_uri: `${oauthConfig.baseUrl}/tos`,
      // policy_uri: `${oauthConfig.baseUrl}/policy`,
      redirect_uris: [callbackUrl],
      grant_types: ["authorization_code", "refresh_token"],
      scope: scopes.join(" "),
      response_types: ["code"],
      application_type: "web",
      token_endpoint_auth_method: "private_key_jwt",
      token_endpoint_auth_signing_alg: "RS256",
      dpop_bound_access_tokens: true,
      jwks_uri: `${baseUrl}/jwks.json`,
    },

    // Used to authenticate the client to the token endpoint. Will be used to
    // build the jwks object to be exposed on the "jwks_uri" endpoint.
    keyset: await Promise.all(
      Object.entries(oauthConfig.keyset).map(([k, v]) => {
        return JoseKey.fromImportable(v, k);
      }),
    ),

    // Interface to store authorization state data (during authorization flows)
    stateStore: AtprotoStateStore,

    // Interface to store authenticated session data
    sessionStore: AtprotoSessionStore,
  });
}
