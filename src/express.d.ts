interface RequestUserData {
  userDid: string;
  userRecord: import("./db/model").User;
}

declare namespace Express {
  export interface Request {
    atprotoClient: import("@atproto/oauth-client-node").NodeOAuthClient;

    user?: RequestUserData;
  }
}
