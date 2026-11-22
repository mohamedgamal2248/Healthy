"use client";
import Link from "next/link";
import { Logo } from "./Icon";
import { VerifiedBadge } from "./ui";
import { useApp } from "./AppProvider";

export function SharedHeader({ username, verified }: { username: string; verified: boolean }) {
  const { tr } = useApp();
  return (
    <div className="card !p-4">
      <div className="flex items-center gap-3">
        <Logo size={40} />
        <div className="min-w-0 flex-1">
          <p className="muted">{tr("وصفة من", "Shared from")} <b className="text-ink" dir="ltr">Healthy</b></p>
          <p className="flex flex-wrap items-center gap-2 font-extrabold"><bdi dir="ltr" className="break-all">@{username}</bdi>{verified && <VerifiedBadge small />}</p>
        </div>
      </div>
      <Link href="/" className="btn-primary mt-3 w-full">{tr("جرّب التطبيق", "Try the app")}</Link>
    </div>
  );
}
