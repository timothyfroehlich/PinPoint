/**
 * PinPoint Static Homepage
 * Professional landing page describing PinPoint with login CTA
 */

import Link from "next/link";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  ZapIcon,
  UsersIcon,
  BarChart3Icon,
  ShieldCheckIcon,
  ArrowRightIcon,
  WrenchIcon,
  ClipboardListIcon,
} from "lucide-react";

export function PinPointHomepage(): JSX.Element {
  return (
    <div className="min-h-screen bg-gradient-to-b from-surface to-surface-variant">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8">
          {/* Logo/Brand */}
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-on-surface tracking-tight">
              PinPoint
            </h1>
            <p className="text-xl text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
              Streamline your pinball machine maintenance with intelligent issue
              tracking, team collaboration, and actionable insights.
            </p>
          </div>

          {/* CTA Button */}
          <div className="pt-4">
            <Button asChild size="lg" className="text-lg px-8 py-3">
              <Link href="/auth/sign-in">
                Get Started
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-24 grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="border-outline hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-primary-container rounded-lg flex items-center justify-center mx-auto mb-4">
                <ClipboardListIcon className="h-6 w-6 text-on-primary-container" />
              </div>
              <CardTitle className="text-lg">Issue Tracking</CardTitle>
              <CardDescription>
                Log, track, and resolve machine issues with detailed reporting
                and status updates.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-outline hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-secondary-container rounded-lg flex items-center justify-center mx-auto mb-4">
                <UsersIcon className="h-6 w-6 text-on-secondary-container" />
              </div>
              <CardTitle className="text-lg">Team Collaboration</CardTitle>
              <CardDescription>
                Coordinate maintenance tasks across your team with role-based
                permissions and real-time updates.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-outline hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-tertiary-container rounded-lg flex items-center justify-center mx-auto mb-4">
                <WrenchIcon className="h-6 w-6 text-on-tertiary-container" />
              </div>
              <CardTitle className="text-lg">Machine Management</CardTitle>
              <CardDescription>
                Maintain detailed records of your pinball machine inventory,
                locations, and maintenance history.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-outline hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-secondary-container rounded-lg flex items-center justify-center mx-auto mb-4">
                <BarChart3Icon className="h-6 w-6 text-on-secondary-container" />
              </div>
              <CardTitle className="text-lg">Analytics & Insights</CardTitle>
              <CardDescription>
                Track maintenance trends, identify recurring issues, and
                optimize your operations.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-outline hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-error-container rounded-lg flex items-center justify-center mx-auto mb-4">
                <ZapIcon className="h-6 w-6 text-on-error-container" />
              </div>
              <CardTitle className="text-lg">Real-time Updates</CardTitle>
              <CardDescription>
                Stay informed with instant notifications when issues are updated
                or resolved.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-outline hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-primary-container rounded-lg flex items-center justify-center mx-auto mb-4">
                <ShieldCheckIcon className="h-6 w-6 text-on-primary-container" />
              </div>
              <CardTitle className="text-lg">Secure & Reliable</CardTitle>
              <CardDescription>
                Enterprise-grade security with organization-level data isolation
                and role-based access control.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Bottom CTA */}
        <div className="mt-24 text-center bg-surface-variant rounded-xl px-8 py-12 text-on-surface">
          <h2 className="text-3xl font-bold mb-4">
            Ready to streamline your pinball maintenance?
          </h2>
          <p className="text-on-surface-variant mb-8 text-lg">
            Join organizations already using PinPoint to manage their pinball
            operations more effectively.
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="text-lg px-8 py-3"
          >
            <Link href="/auth/sign-in">
              Sign In to Your Organization
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-surface py-8">
        <div className="container mx-auto px-4 text-center text-on-surface-variant">
          <p>&copy; 2025 PinPoint. Streamlined pinball machine maintenance.</p>
        </div>
      </footer>
    </div>
  );
}
