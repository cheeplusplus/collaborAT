import { generateSecretKey } from "./util/security";
import { JoseKey } from "@atproto/oauth-client-node";
import { v4 } from "uuid";

async function main() {
  console.log("Keys for you!");
  console.log("");

  const jwkKey = await JoseKey.generate(undefined, v4());
  console.log(
    "OAuth keyset key:",
    JSON.stringify({ keyset: { [jwkKey.kid ?? v4()]: jwkKey.jwk } }),
  );
  console.log(
    "Express session secret:",
    generateSecretKey().toString("base64"),
  );
  console.log("JWT secret key:", generateSecretKey().toString("base64"));
  console.log("DB encryption key:", generateSecretKey().toString("base64"));
}

main().catch((err) => console.error(err));
