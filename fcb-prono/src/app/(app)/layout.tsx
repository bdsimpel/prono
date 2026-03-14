import Navigation from "@/components/Navigation";
import ScrollToTop from "@/components/ScrollToTop";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.is_admin ?? false;
  }

  return (
    <div className="min-h-screen pb-16 md:pb-0 flex flex-col">
      <ScrollToTop />
      <Navigation isAdmin={isAdmin} />
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border-subtle mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md bg-cb-blue flex items-center justify-center">
              <span className="heading-display text-[7px] text-white font-bold tracking-wider">
                FCB
              </span>
            </div>
            <span className="text-sm text-gray-500">FCB PRONO 2026</span>
          </Link>
          <span className="text-xs text-gray-600 tracking-[0.25em] uppercase heading-display">
            No Sweat No Glory &middot; Bluvn Goan
          </span>
          <span className="text-xs text-gray-600">Gemaakt met passie</span>
        </div>
      </footer>
    </div>
  );
}
