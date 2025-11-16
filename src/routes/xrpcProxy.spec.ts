import express from "express";
import supertest from "supertest";
import xrpcRoute from "./xrpc";
import { describe, expect, it } from "@jest/globals";

const app = express();
app.use("/xrpc", xrpcRoute);

const agent = supertest(app);

// For now we're mostly just testing that we can't make requests we shouldn't be able to

describe("XRPC Proxy", () => {
  it("should fail on forbidden prefixes", async () => {
    const res = await agent.post("/xrpc/com.atproto.server.deleteAccount");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "InvalidRequest",
      message: "Forbidden XRPC call",
    });
  });
  it("should fail on scope-forbidden routes", async () => {
    const res = await agent.post("/xrpc/com.atproto.sync.requestCrawl");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "InvalidRequest",
      message: "Forbidden XRPC call",
    });
  });
  it("should fail when missing an auth header", async () => {
    const res = await agent.get("/xrpc/app.bsky.graph.getList");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "InvalidToken",
      message: "Invalid authorization header",
    });
  });
  it("should fail with a bad auth JWT", async () => {
    const req = agent.get("/xrpc/app.bsky.graph.getList");
    req.set("Authorization", "Bearer badtoken");
    const res = await req;

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "InvalidToken",
      message: "Invalid token",
    });
  });
});
