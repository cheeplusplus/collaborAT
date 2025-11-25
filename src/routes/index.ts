import { engine } from "express-handlebars";
import express from "express";
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

const helpers = {
  json: (context: any) => JSON.stringify(context),
  jsonF: (context: any) => JSON.stringify(context, null, 2),
};

app.engine(".hbs", engine({ extname: ".hbs", helpers }));
app.set("view engine", "hbs");
app.set("views", "./views");

app.use(authRouter);
app.use("/xrpc", xrpcRouter);
app.use("/admin", adminRouter);
app.use("/acl", aclRouter);

app.get("/", optionalUser, async (req, res) => {
  res.render("index/index", {
    loggedInDid: req.session.loggedInDid,
    loggedInHandle: req.user?.userRecord?.handle,
    atReadOnly: !userHasWriteAtScopes(req.user?.userRecord),
  });
});

export default app;
