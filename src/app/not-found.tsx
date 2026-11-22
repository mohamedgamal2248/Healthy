import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function NotFound() {
  return (
    <div className="mx-auto mt-10 flex max-w-sm flex-col items-center gap-3 rounded-3xl border border-line bg-white p-8 text-center shadow-sm">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><Icon name="search" size={28} /></span>
      <h2 className="text-lg font-extrabold">الصفحة غير موجودة / Page not found</h2>
      <Link href="/" className="btn-primary w-full">الرئيسية / Home</Link>
    </div>
  );
}
