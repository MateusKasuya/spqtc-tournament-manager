import { db } from "@/db";
import { users } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function getAllUsers() {
  return db
    .select({
      id: users.id,
      name: users.name,
      nickname: users.nickname,
      role: users.role,
    })
    .from(users)
    .orderBy(asc(users.name));
}
