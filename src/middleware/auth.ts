import { RequestHandler } from "express-serve-static-core";
import { getUser } from "../db/repository/user";

export function requireUser(onFailure?: string | number | undefined) {
  const handler: RequestHandler = async (req, res, next) => {
    const fail = () => {
      if (!onFailure) {
        res.redirect("/login");
      } else if (typeof onFailure === "number") {
        res.status(onFailure);
      } else {
        res.redirect(onFailure);
      }
    };

    if (!req.session?.loggedInDid) {
      return fail();
    }

    const userRecord = await getUser(req.session.loggedInDid);
    if (!userRecord) {
      return fail();
    }

    req.user = {
      userDid: req.session.loggedInDid,
      userRecord,
    };

    next();
  };
  return handler;
}

export const optionalUser: RequestHandler = async (req, res, next) => {
  if (req.session.loggedInDid) {
    const userRecord = await getUser(req.session.loggedInDid);
    if (userRecord) {
      req.user = {
        userDid: req.session.loggedInDid,
        userRecord,
      };
    }
  }
  next();
};

export function assertUser(
  user: RequestUserData | undefined,
): asserts user is RequestUserData {
  if (!user || !user.userRecord || !user.userDid) {
    throw new Error("User not found.");
  }
}
