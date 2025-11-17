import * as fs from "fs/promises";
import { generateSecretKey } from "./util/security";
import { JoseKey } from "@atproto/oauth-client-node";
import { v4 } from "uuid";
import { Config } from "./config";

async function genKeys() {
  const jwkKey = await JoseKey.generate(undefined, v4());
  const formattedJwkKey = { [jwkKey.kid ?? v4()]: jwkKey.jwk };
  const sessionSecret = generateSecretKey().toString("base64");
  const jwtSecretKey = generateSecretKey().toString("base64");
  const dbEncryptionKey = generateSecretKey().toString("base64");

  return {
    jwkKey: formattedJwkKey,
    sessionSecret,
    jwtSecretKey,
    dbEncryptionKey,
  };
}

async function main() {
  const { jwkKey, sessionSecret, jwtSecretKey, dbEncryptionKey } =
    await genKeys();

  if (process.argv.length > 1 && process.argv[2] === "--generate-config") {
    const configFile: Config = {
      baseUrl: "FILL_ME",
      domain: "FILL_ME",
      oauth: {
        clientName: "FILL_ME",
        keyset: jwkKey,
      },
      express: { sessionSecret },
      jwtSecretKey,
      dbEncryptionKey,
    };
    if (!(await fs.stat("sharesky.config.json").catch(() => false))) {
      await fs.writeFile(
        "sharesky.config.json",
        JSON.stringify(configFile, null, 2),
      );
    } else {
      console.log("Config file already exists");
    }
  } else {
    console.log("Keys for you!");
    console.log("");

    console.log("OAuth keyset key:", JSON.stringify(jwkKey));
    console.log("Express session secret:", sessionSecret);
    console.log("JWT secret key:", jwtSecretKey);
    console.log("DB encryption key:", dbEncryptionKey);
  }
}

main().catch((err) => console.error(err));
