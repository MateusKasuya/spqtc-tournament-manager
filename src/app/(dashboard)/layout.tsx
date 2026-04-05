import { redirect } from "next/navigation";
import { getProfile } from "@/lib/get-profile";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileHeader } from "@/components/layout/mobile-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar user={profile} />

      <main className="flex-1 pb-16 md:pb-0 min-w-0">
        <MobileHeader user={profile} />

        <div className="p-4 md:p-6">{children}</div>
      </main>

      <BottomNav user={profile} />
    </div>
  );
}
