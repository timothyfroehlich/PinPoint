import type React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Target, Users, Wrench } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { MainLayout } from "~/components/layout/MainLayout";

/**
 * Landing Page
 *
 * Welcome page for PinPoint - the pinball machine issue tracker for Austin Pinball Collective.
 * Shows a hero section, feature highlights, and clear CTAs for both authenticated
 * and unauthenticated users.
 */
export default function LandingPage(): React.JSX.Element {
  return (
    <MainLayout>
      <div className="space-y-12">
        {/* Hero Section */}
        <section className="text-center space-y-6">
          <div className="flex justify-center mb-8">
            <Image
              src="/apc-logo.png"
              alt="Austin Pinball Collective"
              width={200}
              height={133}
              className="glow-primary"
              priority
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Welcome to PinPoint
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            The issue tracker for{" "}
            <span className="text-primary font-medium">
              Austin Pinball Collective
            </span>
            . Help keep the machines running by reporting problems, tracking
            repairs, and staying informed.
          </p>

          {/* Primary CTAs */}
          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <Button asChild size="lg" data-testid="cta-browse-machines">
              <Link href="/m">
                Browse Machines
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
              data-testid="cta-report-issue"
            >
              <Link href="/report">Report an Issue</Link>
            </Button>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="grid gap-6 md:grid-cols-3">
          <Card className="border-primary/20 bg-card">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Target className="size-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Track Issues
              </h3>
              <p className="text-muted-foreground text-sm">
                Report problems with any machine. Track severity, status, and
                priority so fixes happen faster.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Wrench className="size-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Stay Informed
              </h3>
              <p className="text-muted-foreground text-sm">
                See which machines need attention, which were recently fixed,
                and what&apos;s being worked on.
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card">
            <CardContent className="pt-6 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="size-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Community Driven
              </h3>
              <p className="text-muted-foreground text-sm">
                Anyone can report issues. Sign up to comment, get notifications,
                and help keep machines in top shape.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Secondary CTA - View Dashboard */}
        <section className="text-center pt-4">
          <p className="text-muted-foreground mb-4">
            Want to see the full picture?
          </p>
          <Button asChild variant="outline" data-testid="cta-dashboard">
            <Link href="/dashboard">View Dashboard</Link>
          </Button>
        </section>
      </div>
    </MainLayout>
  );
}
