import { redirect } from "next/navigation";

/** The wallet was merged into "Credits & plans" (payment history tab). Old links keep working. */
export default function WalletPage() { redirect("/pricing?tab=history"); }
