import type React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRightLeft,
  Bell,
  Compass,
  LifeBuoy,
  Lock,
  MessageCircleQuestion,
  Plug,
  Shield,
} from "lucide-react";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { PageContainer } from "~/components/layout/PageContainer";

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
  {
    title: "Notifications",
    href: "/help/notifications",
    icon: Bell,
    description: "How you're notified — in-app, email, and Discord DMs",
  },
  {
    title: "Discord Integration",
    href: "/help/discord",
    icon: Plug,
    description: "Sign in with Discord and receive issue updates as DMs",
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
          <Card className="h-full transition-colors duration-150 group-hover:border-primary/50">
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
    isAdmin = profile?.role === "admin"; // permissions-audit-allow: isAdmin flag drives help page section rendering
  }

  return (
    <PageContainer size="narrow">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-2xl">Help</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Getting Started</h2>
            <HelpCardGrid cards={gettingStartedCards} />
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Reference</h2>
            <HelpCardGrid cards={referenceCards} />
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Support</h2>
            <HelpCardGrid cards={supportCards} />
          </section>

          {isAdmin && (
            <section className="space-y-4 border-t pt-6">
              <h2 className="text-lg font-semibold">Admin</h2>
              <HelpCardGrid cards={adminCards} />
            </section>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
