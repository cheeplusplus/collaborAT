import { getDbEncryptionKey } from "../config";
import { encrypt, decrypt } from "../util/security";

export const dbEncryptJson = (json: any) =>
  encrypt(Buffer.from(JSON.stringify(json)), getDbEncryptionKey()).toString(
    "base64",
  );
export const dbDecryptJson = <T>(data: string): T =>
  JSON.parse(
    decrypt(Buffer.from(data, "base64"), getDbEncryptionKey()).toString(
      "utf-8",
    ),
  );
