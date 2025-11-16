import express from "express";
import { Agent } from "@atproto/api";
import { upsertUser } from "../db/repository/user";
import { generateRandomPassword, generateRandomValue } from "../util/security";

const app = express.Router();

app.get("/login", (req, res) => {
  res.render("auth/login");
});

// Create an endpoint to initiate the OAuth flow
app.post("/login", express.urlencoded({ extended: true }), async (req, res) => {
  if (req.session.loggedInDid) {
    return res.redirect("/");
  }

  const handle = req.body.handle;
  if (!handle) {
    return res.status(400).send("Handle is required");
  }

  const state = generateRandomValue(8);
  req.session.oauthState = state;

  const url = await req.atprotoClient.authorize(handle, {
    state,
  });
  res.redirect(url.toString());
});

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

  // Make Authenticated API calls
  const { data: userRepo } = await agent.com.atproto.repo.describeRepo({
    repo: agent.did,
  });

  const appUser = await upsertUser(
    agent.did,
    userRepo.handle,
    userRepo.didDoc,
    { ip: req.ip!, userAgent: req.headers["user-agent"] as string },
  );
  req.session.loggedInDid = appUser.did;

  res.redirect("/");
});

// Expose the metadata and jwks
app.get("/client-metadata.json", (req, res) =>
  res.json(req.atprotoClient.clientMetadata),
);
app.get("/jwks.json", (req, res) => res.json(req.atprotoClient.jwks));

export default app;
