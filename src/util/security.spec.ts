import { describe, expect, it } from "@jest/globals";
import {
  decrypt,
  encrypt,
  generateRandomPassword,
  generateRandomUsername,
  generateSecretKey,
  hashPassword,
  verifyPassword,
} from "./security";

describe("usernames", () => {
  it("generates random usernames", () => {
    const username = generateRandomUsername("superlongalice", "bob");
    expect(username).toMatch(/^superl-bob-\w{8}$/);
  });
});

describe("passwords", () => {
  it("correctly roundtrips passwords", async () => {
    const pw = generateRandomPassword();
    expect(pw.length).toBeGreaterThan(15);

    const hashed = await hashPassword(pw);
    expect(hashed.length).toBeGreaterThan(15);
    expect(hashed).not.toEqual(pw);

    const match = await verifyPassword(pw, hashed);
    expect(match).toBeTruthy();
  });
});

describe("encryption", () => {
  it("correctly roundtrips encryption", () => {
    const plaintext = "hello world!";
    const key = generateSecretKey();

    const encrypted = encrypt(Buffer.from(plaintext), key);
    // make sure we didn't not encrypt it
    expect(encrypted.toString("base64")).not.toEqual(
      Buffer.from(plaintext).toString("base64"),
    );

    const decrypted = decrypt(encrypted, key);
    expect(decrypted.toString("utf-8")).toEqual(plaintext);
  });
});
