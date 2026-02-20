"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export async function signOut() {
  const sb = supabaseServer();
  await sb.auth.signOut();
  redirect("/");
}

export async function createCompany(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const address = String(formData.get("address") || "").trim();

  if (!name) redirect("/app?e=" + encodeURIComponent("Falta el nombre de la empresa"));

  const sb = supabaseServer();
  const { data: userData } = await sb.auth.getUser();
  const user = userData.user;
  if (!user) redirect("/login");

  const { error } = await sb.from("companies").insert({
    owner_id: user.id,
    name,
    address: address || null,
  });

  if (error) redirect("/app?e=" + encodeURIComponent(error.message));
  redirect("/app");
}