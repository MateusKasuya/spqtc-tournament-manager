import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, name, nickname, role, avatar_url")
    .eq("id", user.id)
    .single();

  return profile ?? null;
});
