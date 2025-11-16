import { Session } from "express-session";

declare module "express-session" {
  interface SessionData {
    loggedInDid?: string;
    oauthState?: string;
  }
}
