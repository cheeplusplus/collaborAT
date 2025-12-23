import express from "express";
import { Agent } from "@atproto/api";
import { getUser, upsertUser } from "../db/repository/user";
import { generateRandomPassword, generateRandomValue } from "../util/security";
import { assertUser, requireUser } from "../middleware/auth";

const app = express.Router();

app.get("/login", (req, res) => {
  res.typedRender("auth/login", {});
});

interface LoginBody {
  handle: string;
}

// Create an endpoint to initiate the OAuth flow
app.post("/login", express.urlencoded({ extended: true }), async (req, res) => {
  if (req.session.loggedInDid) {
    return res.redirect("/");
  }

  // Reset the oauth state
  const state = generateRandomValue(8);
  req.session.oauthState = state;

  const body = req.body as LoginBody;
  const handle = body.handle;
  if (!handle) {
    return res.status(400).send("Handle is required");
  }

  // Resolve the scope, we need to look up if the user is registered to repeat their login elevation
  const identity = await req.atprotoClient.identityResolver.resolve(handle);
  if (!identity.did) {
    res.status(400).send("Invalid handle");
  }
  const userRecord = await getUser(identity.did);

  const url = await req.atprotoClient.authorize(handle, {
    state,
    scope: userRecord?.grantedScopes ?? "atproto",
  });
  res.redirect(url.toString());
});

interface LoginReauthBody {
  scopes: "read" | "write";
}

app.post(
  "/login/reauth",
  requireUser(403),
  express.urlencoded({ extended: true }),
  async (req, res) => {
    assertUser(req.user);

    const body = req.body as LoginReauthBody;
    const state = generateRandomValue(8);
    req.session.oauthState = state;

    const requestedScopes =
      body.scopes === "read" ? "atproto" : "atproto transition:generic";

    const url = await req.atprotoClient.authorize(req.user.userDid, {
      state,
      scope: requestedScopes,
    });
    res.redirect(url.toString());
  },
);

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// Create an endpoint to handle the OAuth callback
app.get("/atproto-oauth-callback", async (req, res) => {
  const params = new URLSearchParams(req.url.split("?")[1]);

  const { session, state } = await req.atprotoClient.callback(params);

  // Process successful authentication here
  if (state !== req.session.oauthState) {
    res.status(403).send("OAuth state mismatch. Please try again.");
    return;
  }

  const agent = new Agent(session);
  if (!agent.did) {
    res.status(403).send("No DID found in session.");
    return;
  }

  const tokenInfo = await session.getTokenInfo();
  const scope = tokenInfo.scope;

  // Make Authenticated API calls
  const { data: userRepo } = await agent.com.atproto.repo.describeRepo({
    repo: agent.did,
  });

  const appUser = await upsertUser(
    agent.did,
    userRepo.handle,
    userRepo.didDoc,
    scope,
    { ip: req.ip!, userAgent: req.headers["user-agent"] as string },
  );
  req.session.loggedInDid = appUser.did;
  req.session.loggedInHandle = appUser.handle;

  res.redirect("/");
});

// Expose the metadata and jwks
app.get("/client-metadata.json", (req, res) =>
  res.json(req.atprotoClient.clientMetadata),
);
app.get("/jwks.json", (req, res) => res.json(req.atprotoClient.jwks));

export default app;
