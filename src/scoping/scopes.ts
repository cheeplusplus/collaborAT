import _ from "lodash";

type XrpcGroup =
  | "actor"
  | "feed"
  | "graph"
  | "notifications"
  | "video"
  | "chat"
  | "admin"
  | "identity"
  | "moderation"
  | "repo"
  | "server"
  | "sync"
  | "ozone";

export type EndpointCategory =
  | "client_prefs"
  | "feed_interactivity"
  | "graph_mute"
  | "moderation"
  | "image_upload"
  | "push"
  | "seen"
  | "video_upload"
  | "repo_records"
  | "_FORBID";

// Known XRPC endpoints that are allowed to be interacted with
export const EndpointCategories: {
  [key: string]: [XrpcGroup, EndpointCategory];
} = {
  "app.bsky.actor.putPreferences": ["actor", "client_prefs"],
  "app.bsky.feed.sendInteractions": ["feed", "feed_interactivity"],
  "app.bsky.graph.muteActorList": ["graph", "graph_mute"],
  "app.bsky.graph.muteActor": ["graph", "graph_mute"],
  "app.bsky.graph.muteThread": ["graph", "graph_mute"],
  "app.bsky.graph.unmuteActorList": ["graph", "graph_mute"],
  "app.bsky.graph.unmuteActor": ["graph", "graph_mute"],
  "app.bsky.graph.unmuteThread": ["graph", "graph_mute"],
  "app.bsky.notification.putPreferences": ["notifications", "client_prefs"],
  "app.bsky.notification.registerPush": ["notifications", "push"],
  "app.bsky.notification.updateSeen": ["notifications", "seen"],
  "app.bsky.video.uploadVideo": ["video", "video_upload"],
  "chat.bsky.*": ["chat", "_FORBID"], // chat is not supported
  "com.atproto.admin.*": ["admin", "_FORBID"], // PDS admin is not supported
  "com.atproto.identity.*": ["identity", "_FORBID"], // none of the POST actions here are allowed, important ones are intercepted already
  "com.atproto.moderation.createReport": ["moderation", "moderation"],
  "com.atproto.repo.*": ["repo", "repo_records"], // see RecordCollectionCategories
  "com.atproto.repo.uploadBlob": ["repo", "image_upload"], // special cased into its own category
  "com.atproto.server.*": ["server", "_FORBID"], // none of the POST actions here are allowed, important ones are intercepted already
  "com.atproto.sync.*": ["sync", "_FORBID"], // pretty sure this is PDS-only
  "tools.ozone.*": ["ozone", "_FORBID"], // moderation tools are not supported
};

export const EndpointCategoryDescriptions: { [T in EndpointCategory]: string } =
  {
    client_prefs: "Client preferences",
    feed_interactivity: "Feed interactivity (report clickthroughs, etc)",
    graph_mute: "Mute users or threads",
    push: "Register for push notifications",
    seen: "Mark notifications as read",
    video_upload: "Upload video",
    image_upload: "Upload images",
    moderation: "Send moderation reports",
    repo_records: "Manage repository records (posts, likes, follows, etc.)",
    _FORBID: "[Not allowed]",
  };

export type RecordCollectionCategory =
  | "block"
  | "follow"
  | "lists"
  | "posts"
  | "likes"
  | "profile"
  | "_FORBID";

// Known record collection types that are allowed to be touched
export const RecordCollectionCategories = {
  "app.bsky.graph.block": "block",
  "app.bsky.graph.follow": "follow",
  "app.bsky.graph.listblock": "follow",
  "app.bsky.graph.starterpack": "lists",
  "app.bsky.graph.listitem": "lists",
  "app.bsky.graph.list": "lists",
  "app.bsky.feed.generator": "_FORBID",
  "app.bsky.feed.postgate": "posts",
  "app.bsky.feed.threadgate": "posts",
  "app.bsky.feed.like": "likes",
  "app.bsky.feed.repost": "posts",
  "app.bsky.feed.post": "posts",
  "app.bsky.actor.profile": "profile",
  "app.bsky.labeler.service": "_FORBID",
  "chat.bsky.actor.declaration": "_FORBID",
} as const satisfies { [key: string]: RecordCollectionCategory };

export const RecordCollectionCategoryDescriptions: {
  [T in RecordCollectionCategory]: string;
} = {
  block: "Manage blocks (block/unblock)",
  follow: "Manage followers (follow/unfollow)",
  lists: "Manage lists (create/add/remove/delete)",
  posts: "Post (create/delete)",
  likes: "Like posts (like/unlike)",
  profile: "Edit profile",
  _FORBID: "[Not allowed]",
};

export type RepoOperation = "create" | "update" | "delete" | "_FORBID";

// Repo operations mapped to their allowed groups
export const RepoOperations = {
  // applyWrites are broken out because this will have to be called for each `writes` item
  "com.atproto.repo.applyWrites#create": "create",
  "com.atproto.repo.applyWrites#update": "update",
  "com.atproto.repo.applyWrites#delete": "delete",
  "com.atproto.repo.createRecord": "create",
  "com.atproto.repo.deleteRecord": "delete",
  "com.atproto.repo.importRepo": "_FORBID",
  "com.atproto.repo.putRecord": "update",
} as const satisfies { [key: string]: RepoOperation };

export type RepoOperationSource = keyof typeof RepoOperations;

export type EndpointCategoryScope =
  `cat:${Exclude<EndpointCategory, "_FORBID"> | "*"}`;

export type RecordCollectionCategoryScope =
  `record:${Exclude<RecordCollectionCategory, "_FORBID"> | "*"}:${Exclude<RepoOperation, "_FORBID"> | "*"}`;

export type AnyScope = EndpointCategoryScope | RecordCollectionCategoryScope;

const AllEndpointCategoryScopes: EndpointCategoryScope[] = _.chain(
  EndpointCategories,
)
  .mapValues((v, k) => v[1] as EndpointCategory | "*")
  .values()
  .filter((f) => f !== "_FORBID")
  .uniq()
  .concat(["*"])
  .map((v) => `cat:${v}` satisfies EndpointCategoryScope)
  .uniq()
  .value();
const AllRepoOperationSubscopes = _.chain(RepoOperations)
  .mapValues((v, k) => v as RepoOperation | "*")
  .values()
  .filter((f) => f !== "_FORBID")
  .uniq()
  .concat(["*"])
  .value();
const AllRepoOperationScopes = _.chain(RecordCollectionCategories)
  .values()
  .filter((f) => f !== "_FORBID")
  .uniq()
  .flatMap((v) =>
    AllRepoOperationSubscopes.map(
      (ss) => `record:${v}:${ss}` satisfies RecordCollectionCategoryScope,
    ),
  )
  .uniq()
  .value();
const AllScopes = _.uniq([
  ...AllEndpointCategoryScopes,
  ...AllRepoOperationScopes,
]);

export function isValidScope(scope: string): scope is AnyScope {
  return AllScopes.includes(scope as any);
}
