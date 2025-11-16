import { describe, expect, it } from "@jest/globals";
import { inScope, isFastForbidden, ScopeCheckResult } from "./checker";
import { AnyScope, RecordCollectionCategories } from "./scopes";

const typedInScope = (
  endpoint: string,
  scopes: AnyScope[],
  recordType?: keyof typeof RecordCollectionCategories | undefined,
) => inScope(endpoint, scopes, recordType);

type TypedInScopeTestItem = [
  string,
  string,
  keyof typeof RecordCollectionCategories | undefined,
  AnyScope[],
  ScopeCheckResult,
];
const typedInScopeTest = (
  testName: string,
  endpoint: string,
  recordType: keyof typeof RecordCollectionCategories | undefined,
  scopes: AnyScope[],
  expected: ScopeCheckResult,
): TypedInScopeTestItem => [
  testName,
  endpoint,
  recordType,
  scopes,
  { ...expected, matchedScopes: expected.matchedScopes ?? undefined },
];
const typedInScopeBlock = (...args: TypedInScopeTestItem[]) => args;

describe("isFastForbidden", () => {
  it("forbids expected routes", () => {
    expect(isFastForbidden("com.atproto.identity.submitPlcOperation")).toBe(
      true,
    );
    expect(isFastForbidden("com.atproto.server.createSession")).toBe(true);
    expect(isFastForbidden("chat.bsky.actor.deleteAccount")).toBe(true);
  });
  it("allows expected routes", () => {
    expect(isFastForbidden("app.bsky.graph.muteActor")).toBe(false);
    expect(isFastForbidden("com.atproto.repo.createRecord")).toBe(false);
  });
});

describe("inScope", () => {
  describe("categories", () => {
    it.each(
      typedInScopeBlock(
        typedInScopeTest(
          "category wildcard",
          "app.bsky.graph.muteActor",
          undefined,
          ["cat:*"],
          { matched: true, matchedScopes: ["cat:*"] },
        ),
        typedInScopeTest(
          "matching category",
          "app.bsky.graph.muteActor",
          undefined,
          ["cat:graph_mute"],
          { matched: true, matchedScopes: ["cat:graph_mute"] },
        ),
        typedInScopeTest(
          "no scopes",
          "app.bsky.graph.muteActor",
          undefined,
          [],
          { matched: false },
        ),
        typedInScopeTest(
          "wrong category",
          "app.bsky.graph.muteActor",
          undefined,
          ["cat:video_upload"],
          { matched: false },
        ),
        typedInScopeTest(
          "unsupported function",
          "link.biosynth.bsky.invalidFunction",
          undefined,
          ["cat:*"],
          { matched: "unsupported" },
        ),
        typedInScopeTest(
          "forbidden function",
          "com.atproto.server.createSession",
          undefined,
          ["cat:*"],
          { matched: "forbidden" },
        ),
      ),
    )("%s", (testName, endpoint, recordType, scopes, expected) => {
      expect(typedInScope(endpoint, scopes, recordType)).toEqual(expected);
    });
  });

  describe("records", () => {
    it.each(
      typedInScopeBlock(
        typedInScopeTest(
          "all wildcards",
          "com.atproto.repo.createRecord",
          "app.bsky.feed.post",
          ["cat:*", "record:*:*"],
          { matched: true, matchedScopes: ["cat:*", "record:*:*"] },
        ),
        typedInScopeTest(
          "specific category, double wildcards",
          "com.atproto.repo.createRecord",
          "app.bsky.feed.post",
          ["cat:repo_records", "record:*:*"],
          { matched: true, matchedScopes: ["cat:repo_records", "record:*:*"] },
        ),
        typedInScopeTest(
          "fully specific",
          "com.atproto.repo.createRecord",
          "app.bsky.feed.post",
          ["cat:repo_records", "record:posts:create"],
          {
            matched: true,
            matchedScopes: ["cat:repo_records", "record:posts:create"],
          },
        ),
        typedInScopeTest(
          "applyWrites",
          "com.atproto.repo.applyWrites#update",
          "app.bsky.feed.post",
          ["cat:repo_records", "record:posts:update"],
          {
            matched: true,
            matchedScopes: ["cat:repo_records", "record:posts:update"],
          },
        ),
        typedInScopeTest(
          "bulky scopes",
          "com.atproto.repo.createRecord",
          "app.bsky.feed.post",
          [
            "cat:repo_records",
            "cat:feed_interactivity",
            "cat:push",
            "record:likes:delete",
            "record:block:*",
            "record:posts:create",
            "record:posts:delete",
          ],
          {
            matched: true,
            matchedScopes: ["cat:repo_records", "record:posts:create"],
          },
        ),
        typedInScopeTest(
          "wrong record type",
          "com.atproto.repo.createRecord",
          "app.bsky.feed.post",
          ["cat:repo_records", "record:likes:*"],
          { matched: false },
        ),
        typedInScopeTest(
          "wrong operation type",
          "com.atproto.repo.createRecord",
          "app.bsky.feed.post",
          ["cat:repo_records", "record:posts:delete"],
          { matched: false },
        ),
        typedInScopeTest(
          "missing record scope entirely",
          "com.atproto.repo.createRecord",
          "app.bsky.feed.post",
          ["cat:repo_records"],
          { matched: false },
        ),
        typedInScopeTest(
          "missing record type but has scope",
          "com.atproto.repo.createRecord",
          undefined,
          ["cat:repo_records", "record:posts:create"],
          { matched: false },
        ),
        typedInScopeTest(
          "unsupported endpoint",
          "com.atproto.repo.doSomethingOtherRecord",
          "app.bsky.feed.post",
          ["cat:repo_records", "record:*:*"],
          { matched: false },
        ),
        typedInScopeTest(
          "unsupported record type",
          "com.atproto.repo.createRecord",
          "link.biosynth.bsky.invalidRecord" as any,
          ["cat:repo_records", "record:*:*"],
          { matched: false },
        ),
        typedInScopeTest(
          "forbidden endpoint",
          "com.atproto.repo.importRepo",
          "app.bsky.feed.post" as any,
          ["cat:repo_records", "record:*:*"],
          { matched: false },
        ),
        typedInScopeTest(
          "forbidden record type",
          "com.atproto.repo.createRecord",
          "app.bsky.feed.generator",
          ["cat:repo_records", "record:*:*"],
          { matched: false },
        ),
      ),
    )("%s", (testName, endpoint, recordType, scopes, expected) => {
      expect(typedInScope(endpoint, scopes, recordType)).toEqual(expected);
    });
  });
});
