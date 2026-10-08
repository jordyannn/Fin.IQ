import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("finiq_session")?.value;

  if (!sessionToken) {
    redirect("/login");
  }

  redirect("/overview");
}
