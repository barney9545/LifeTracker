import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import BottomNav from "@/components/bottom-nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <div className="app-shell min-h-dvh">
      <div className="mx-auto w-full max-w-[430px] px-5 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
