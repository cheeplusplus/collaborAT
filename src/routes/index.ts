import express from "express";
import nunjucks from "nunjucks";
import authRouter from "./auth";
import xrpcRouter from "./xrpc";
import adminRouter from "./admin";
import aclRouter from "./acl";
import session from "express-session";
import { ExpressSessionStore } from "../db/repository/session";
import { getConfig } from "../config";
import compression from "compression";
import { optionalUser } from "../middleware/auth";
import { userHasWriteAtScopes } from "../db/repository/user";
import { typedRender } from "../util/typedViews";

const app = express();
app.use(compression());

if (!getConfig().oauth.isLocalhostDev) {
  app.set("trust proxy", 1);
}

app.use(
  session({
    secret: getConfig().express.sessionSecret,
    store: new ExpressSessionStore(),
    resave: true,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  }),
);

app.engine("html.njk", nunjucks.render);
app.set("view engine", "html.njk");
const njk = nunjucks.configure("views", {
  autoescape: true,
  express: app,
  noCache: true,
});
njk.addFilter("json", (context) => JSON.stringify(context));
njk.addFilter("jsonF", (context) => JSON.stringify(context, null, 2));

// View renderer helpers
app.use((req, res, next) => {
  njk.addGlobal("global_nav", {
    path: req.path,
    is_logged_in: !!req.session?.loggedInDid,
    logged_in_did: req.session?.loggedInDid,
    logged_in_handle: req.session?.loggedInHandle ?? req.session?.loggedInDid,
  });
  res.typedRender = (view, locals) => typedRender(res, view, locals);
  next();
});

app.use(authRouter);
app.use("/xrpc", xrpcRouter);
app.use("/admin", adminRouter);
app.use("/acl", aclRouter);

app.get("/", optionalUser, async (req, res) => {
  res.typedRender("index/index", {
    loggedInDid: req.session.loggedInDid,
    loggedInHandle: req.user?.userRecord?.handle,
    atReadOnly: !userHasWriteAtScopes(req.user?.userRecord),
  });
});

export default app;
