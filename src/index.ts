import "source-map-support/register";

import app from "./routes";
import "dotenv/config";
import { migrateToLatest } from "./db/db";
import { getOAuthClient } from "./util/atprotoOAuth";
import { assertExpiry } from "./db/expiry";

async function main() {
  await migrateToLatest();

  setInterval(
    () => {
      assertExpiry().catch((err) =>
        console.error("Failed to assert expiry", err),
      );
    },
    1000 * 60 * 15,
  );

  // Register a single instance of the oauth client
  app.request.atprotoClient = await getOAuthClient();

  app.listen(3000, () => console.log("Server is running on port 3000"));
}

main().catch((err) => {
  console.error(err);
});
