import crypto from "crypto";
import * as sodium from "sodium-native";
import { generatePassphrase } from "niceware";

export function generateRandomUsername(
  actorHandle: string,
  targetHandle: string,
): string {
  const actorSub = actorHandle.split(".")[0].substring(0, 6);
  const targetSub = targetHandle.split(".")[0].substring(0, 6);
  const rnd = crypto.randomBytes(4).toString("hex");
  return `${actorSub}-${targetSub}-${rnd}`;
}
export function generateRandomPassword(): string {
  return generatePassphrase(8).join("-");
}
export function generateRandomValue(length: number) {
  return crypto.randomBytes(length).toString("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const buf = Buffer.alloc(sodium.crypto_pwhash_STRBYTES);
  sodium.crypto_pwhash_str(
    buf,
    Buffer.from(password),
    sodium.crypto_pwhash_OPSLIMIT_MODERATE,
    sodium.crypto_pwhash_MEMLIMIT_MODERATE,
  );
  return buf.toString("base64");
}
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return sodium.crypto_pwhash_str_verify(
    Buffer.from(hash, "base64"),
    Buffer.from(password),
  );
}

export function generateSecretKey() {
  const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES);
  sodium.randombytes_buf(key);
  return key;
}

export function encrypt(plaintext: Buffer, secretKey: Buffer): Buffer {
  const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
  sodium.randombytes_buf(nonce);

  const ciphertext = Buffer.alloc(
    plaintext.length + sodium.crypto_secretbox_MACBYTES,
  );
  sodium.crypto_secretbox_easy(ciphertext, plaintext, nonce, secretKey);

  return Buffer.concat([nonce, ciphertext]);
}

export function decrypt(ciphertext: Buffer, secretKey: Buffer): Buffer {
  const nonce = ciphertext.subarray(0, sodium.crypto_secretbox_NONCEBYTES);
  const realCiphertext = ciphertext.subarray(
    sodium.crypto_secretbox_NONCEBYTES,
  );

  const plaintext = Buffer.alloc(
    realCiphertext.length - sodium.crypto_secretbox_MACBYTES,
  );
  sodium.crypto_secretbox_open_easy(
    plaintext,
    realCiphertext,
    nonce,
    secretKey,
  );
  return plaintext;
}
