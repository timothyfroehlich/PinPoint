/**
 * PinPoint Static Homepage
 * Professional landing page describing PinPoint with login CTA
 */

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { 
  ZapIcon, 
  UsersIcon, 
  BarChart3Icon, 
  ShieldCheckIcon,
  ArrowRightIcon,
  WrenchIcon,
  ClipboardListIcon
} from "lucide-react";

export function PinPointHomepage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-8">
          {/* Logo/Brand */}
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
              PinPoint
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Streamline your pinball machine maintenance with intelligent issue tracking, 
              team collaboration, and actionable insights.
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
          <Card className="border-gray-200 hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <ClipboardListIcon className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-lg">Issue Tracking</CardTitle>
              <CardDescription>
                Log, track, and resolve machine issues with detailed reporting and status updates.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-gray-200 hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <UsersIcon className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-lg">Team Collaboration</CardTitle>
              <CardDescription>
                Coordinate maintenance tasks across your team with role-based permissions and real-time updates.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-gray-200 hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <WrenchIcon className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle className="text-lg">Machine Management</CardTitle>
              <CardDescription>
                Maintain detailed records of your pinball machine inventory, locations, and maintenance history.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-gray-200 hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <BarChart3Icon className="h-6 w-6 text-yellow-600" />
              </div>
              <CardTitle className="text-lg">Analytics & Insights</CardTitle>
              <CardDescription>
                Track maintenance trends, identify recurring issues, and optimize your operations.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-gray-200 hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <ZapIcon className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-lg">Real-time Updates</CardTitle>
              <CardDescription>
                Stay informed with instant notifications when issues are updated or resolved.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-gray-200 hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <ShieldCheckIcon className="h-6 w-6 text-indigo-600" />
              </div>
              <CardTitle className="text-lg">Secure & Reliable</CardTitle>
              <CardDescription>
                Enterprise-grade security with organization-level data isolation and role-based access control.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Bottom CTA */}
        <div className="mt-24 text-center bg-gray-900 rounded-xl px-8 py-12 text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to streamline your pinball maintenance?</h2>
          <p className="text-gray-300 mb-8 text-lg">
            Join organizations already using PinPoint to manage their pinball operations more effectively.
          </p>
          <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-3">
            <Link href="/auth/sign-in">
              Sign In to Your Organization
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>&copy; 2025 PinPoint. Streamlined pinball machine maintenance.</p>
        </div>
      </footer>
    </div>
  );
}