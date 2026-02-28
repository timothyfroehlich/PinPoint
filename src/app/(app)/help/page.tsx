import type React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRightLeft,
  Compass,
  LifeBuoy,
  Lock,
  MessageCircleQuestion,
  Shield,
} from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export const metadata = {
  title: "Help | PinPoint",
};

const gettingStartedCards = [
  {
    title: "Getting Started",
    href: "/help/getting-started",
    icon: Compass,
    description: "New to PinPoint? Start here for a quick tour",
  },
  {
    title: "Reporting Issues",
    href: "/help/reporting",
    icon: AlertCircle,
    description: "How to file a clear, useful issue report",
  },
];

const referenceCards = [
  {
    title: "Issue Lifecycle",
    href: "/help/issues",
    icon: ArrowRightLeft,
    description: "Statuses, severity levels, and how issues progress",
  },
  {
    title: "Roles & Permissions",
    href: "/help/permissions",
    icon: Shield,
    description: "What each access level can do",
  },
];

const supportCards = [
  {
    title: "FAQ",
    href: "/help/faq",
    icon: MessageCircleQuestion,
    description: "Answers to common questions",
  },
  {
    title: "Contact & Support",
    href: "/help/support",
    icon: LifeBuoy,
    description: "Get help from Austin Pinball Collective",
  },
];

const adminCards = [
  {
    title: "Admin Help",
    href: "/help/admin",
    icon: Lock,
    description: "Username accounts and admin procedures",
  },
];

interface HelpCard {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

function HelpCardGrid({ cards }: { cards: HelpCard[] }): React.JSX.Element {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cards.map((card) => (
        <Link key={card.href} href={card.href} className="group">
          <Card className="h-full transition-colors group-hover:border-primary/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <card.icon className="size-5 text-muted-foreground" />
                <CardTitle className="text-base">{card.title}</CardTitle>
              </div>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default async function HelpPage(): Promise<React.JSX.Element> {
  let isAdmin = false;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, user.id),
      columns: { role: true },
    });
    isAdmin = profile?.role === "admin";
  }

  return (
    <div className="max-w-3xl mx-auto py-10">
      <header className="mb-8 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Help</h1>
        <p className="text-sm text-muted-foreground">
          Learn how to use PinPoint to report issues, track repairs, and keep
          machines playable at Austin Pinball Collective.
        </p>
      </header>

      <section className="mb-8 space-y-4">
        <h2 className="text-lg font-semibold">Getting Started</h2>
        <HelpCardGrid cards={gettingStartedCards} />
      </section>

      <section className="mb-8 space-y-4">
        <h2 className="text-lg font-semibold">Reference</h2>
        <HelpCardGrid cards={referenceCards} />
      </section>

      <section className="mb-8 space-y-4">
        <h2 className="text-lg font-semibold">Support</h2>
        <HelpCardGrid cards={supportCards} />
      </section>

      {isAdmin && (
        <section className="space-y-4 border-t pt-6">
          <h2 className="text-lg font-semibold">Admin</h2>
          <HelpCardGrid cards={adminCards} />
        </section>
      )}
    </div>
  );
}
