import { User } from "../db/model";
import { getUser } from "../db/repository/user";

export class UserLookupCache {
  private userRowCache: Map<string, User | undefined> = new Map();

  async getUser(did: string) {
    if (this.userRowCache.has(did)) {
      return this.userRowCache.get(did);
    }
    const user = await getUser(did);
    this.userRowCache.set(did, user);
    return user;
  }

  async getHandle(did: string) {
    const user = await this.getUser(did);
    return user?.handle;
  }
}
