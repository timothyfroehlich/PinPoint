import type React from "react";
import Link from "next/link";
import { Flag, MessageSquare, Gamepad2, CircleCheck } from "lucide-react";

interface ProfileStatGridProps {
  reported: number;
  comments: number;
  machinesOwned: number;
  fixed: number;
  collectionHref: string;
}

const tileBase = "rounded-xl border border-outline-variant bg-card p-4";
const linkTile =
  "transition-[border-color,box-shadow] duration-150 hover:border-primary/50 hover:glow-primary";

function Stat({
  icon,
  value,
  label,
  accent,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent?: "primary" | "secondary";
}): React.JSX.Element {
  const numClass =
    accent === "secondary"
      ? "text-secondary"
      : accent === "primary"
        ? "text-primary"
        : "text-foreground";
  return (
    <>
      <div className={`text-2xl font-bold ${numClass}`}>{value}</div>
      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
    </>
  );
}

export function ProfileStatGrid({
  reported,
  comments,
  machinesOwned,
  fixed,
  collectionHref,
}: ProfileStatGridProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className={tileBase}>
        <Stat
          icon={<Flag className="size-3.5" aria-hidden="true" />}
          value={reported}
          label="Issues reported"
          accent="primary"
        />
      </div>
      <div className={tileBase}>
        <Stat
          icon={<MessageSquare className="size-3.5" aria-hidden="true" />}
          value={comments}
          label="Comments"
        />
      </div>
      <Link href={collectionHref} className={`${tileBase} ${linkTile}`}>
        <Stat
          icon={<Gamepad2 className="size-3.5" aria-hidden="true" />}
          value={machinesOwned}
          label="Machines owned"
          accent="primary"
        />
      </Link>
      <div className={tileBase}>
        <Stat
          icon={<CircleCheck className="size-3.5" aria-hidden="true" />}
          value={fixed}
          label="Issues fixed"
          accent="secondary"
        />
      </div>
    </div>
  );
}
