import { db } from "../db";
import { users } from "../db/schema";

export interface Context {
  db: typeof db;
  userId: string;
}

export async function createContext(opts?: { req?: Request }): Promise<Context> {
  // Ambil user pemilik data dari database secara dinamis
  const activeUser = await db.query.users.findFirst();
  const userId = activeUser?.id || process.env.DEMO_USER_ID || "9728be5f-a414-42f3-a827-4504a56c1370";

  return {
    db,
    userId,
  };
}
