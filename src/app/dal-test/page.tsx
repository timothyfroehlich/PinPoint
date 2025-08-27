/**
 * DAL Test Page - Validates Phase 2A Data Access Layer Implementation
 * This page tests all our new DAL functions to ensure they compile and work correctly
 */

import { getDashboardData, getCurrentUserProfile, getOrganizationStats } from "~/lib/dal";

export default async function DALTestPage() {
  try {
    // Test basic DAL functions
    const userProfile = await getCurrentUserProfile();
    const orgStats = await getOrganizationStats();
    const dashboardData = await getDashboardData();
    
    return (
      <div className="p-8 space-y-6">
        <h1 className="text-3xl font-bold">DAL Test Page</h1>
        <p className="text-green-600">✅ All DAL functions compiled successfully!</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">User Profile</h2>
            <p>Name: {userProfile.name}</p>
            <p>Email: {userProfile.email}</p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Organization Stats</h2>
            <p>Total Issues: {orgStats.issues.total}</p>
            <p>Total Machines: {orgStats.machines.total}</p>
            <p>Total Members: {orgStats.members.total}</p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Dashboard Data</h2>
            <p>Organization: {dashboardData.organization.name}</p>
            <p>Recent Issues: {dashboardData.recentIssues.length}</p>
            <p>Issue Stats: {dashboardData.issueStats.total}</p>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-red-600">DAL Test Error</h1>
        <p className="mt-4">Error: {error instanceof Error ? error.message : String(error)}</p>
      </div>
    );
  }
}