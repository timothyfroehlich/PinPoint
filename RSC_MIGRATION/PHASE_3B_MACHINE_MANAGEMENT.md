# Phase 3B: Machine Management Server-First Conversion

**Goal**: Transform PinPoint's machine inventory and management system from client-heavy Material UI components to server-first architecture with strategic client islands for enhanced performance and simplified state management.

**Success Criteria**:
- Machine inventory transformation: Client DataGrid → Server Component with shadcn/ui table
- Machine detail pages converted to Server Components with targeted client islands
- QR code generation and management through Server Actions
- Location-based filtering and search with URL state management
- Material UI → shadcn/ui conversion for machine components (80%+ bundle reduction)

---

## Current Machine System Analysis (Updated: August 27, 2025)

### **ARCHIVED**: Machine Components Successfully Removed
```
✅ ARCHIVED to .claude/recycle_bin/mui-heavy-2025-08-27-094944/:
├── machine-components/
│   ├── MachineCard.tsx (Material UI Card with client state)
│   └── MachineList.tsx (387 lines Material UI DataGrid - PRIMARY TARGET)
└── machine-detail-components/
    └── MachineDetailView.tsx (298 lines Material UI form)

📍 REMAINING for Phase 3B Implementation:
├── src/app/machines/page.tsx - Simple page wrapper (19 MUI imports remaining)
└── Phase 3B will rebuild these components as:
    ├── Server Component machine inventory with shadcn/ui table
    ├── Server-side filtering and search with URL state management
    └── Strategic client islands for QR code generation and bulk operations
```

### Performance and Complexity Issues
- **Bundle Size**: 120KB+ for machine-related components and Material UI DataGrid
- **Initial Load**: 600ms+ due to DataGrid hydration and client-side data fetching
- **State Complexity**: Search filters, pagination, selection state, form validation
- **SEO Impact**: Machine inventory not crawlable, poor search engine visibility
- **Mobile Experience**: DataGrid not optimized for mobile devices

---

## Target Architecture: Server-First Machine Management

### Core Transformation Strategy
- **Server Components**: Machine inventory, details, specifications as server-rendered
- **Client Islands**: QR code operations, bulk actions, image uploads, search inputs
- **Hybrid Architecture**: Server data shells with client interaction layers
- **URL State**: Machine filtering, search, pagination through search parameters
- **Database Optimization**: Direct queries with joins and aggregations

### Component Architecture Blueprint
```
Transformed Machine System:
├── Server Components (Primary)
│   ├── MachineInventoryServer.tsx - Direct DB queries with location joins
│   ├── MachineDetailServer.tsx - Server-rendered machine specifications
│   ├── MachineStatsServer.tsx - Organization statistics and analytics
│   └── LocationMachineListServer.tsx - Location-scoped machine displays
├── Client Islands (Focused)
│   ├── MachineSearchInput.tsx - Debounced search with URL updates
│   ├── MachineFilters.tsx - Location/model filtering with immediate feedback
│   ├── QRCodeActions.tsx - QR generation, download, bulk operations
│   ├── MachineImageUpload.tsx - Image handling with preview
│   └── MachineBulkActions.tsx - Multi-select operations
└── Hybrid Components
    ├── MachineDetailHybrid.tsx - Server specs + client interaction islands
    ├── MachineFormHybrid.tsx - Server validation + client enhancements
    └── MachineInventoryHybrid.tsx - Server list + client action islands
```

---

## Implementation Deliverables

### 1. Machine Inventory Server Component (`src/app/machines/page.tsx`)

**Purpose**: Primary machine inventory with server-side filtering and URL-based state

```tsx
import { Suspense } from "react";
import { requireServerAuth } from "~/lib/auth/server-auth";
import { getMachinesWithFilters, getMachineStats } from "~/lib/dal/machines";
import { getLocations } from "~/lib/dal/locations";
import { MachineInventoryServer } from "~/components/machines/machine-inventory-server";
import { MachineFiltersServer } from "~/components/machines/machine-filters-server";
import { MachineStatsServer } from "~/components/machines/machine-stats-server";
import { MachineInventorySkeleton } from "~/components/machines/machine-inventory-skeleton";
import { CreateMachineButton } from "~/components/machines/create-machine-button";

export async function generateMetadata() {
  return {
    title: "Machine Inventory - PinPoint",
    description: "Manage pinball machine inventory and maintenance tracking",
  };
}

interface MachinePageProps {
  searchParams: {
    location?: string;
    model?: string;
    status?: string;
    search?: string;
    page?: string;
    view?: 'grid' | 'table';
    sort?: string;
    order?: 'asc' | 'desc';
  };
}

export default async function MachinesPage({ searchParams }: MachinePageProps) {
  const { organizationId } = await requireServerAuth();
  
  // Parse URL parameters for server-side filtering
  const filters = {
    locationIds: searchParams.location ? searchParams.location.split(',') : undefined,
    models: searchParams.model ? searchParams.model.split(',') : undefined,
    status: searchParams.status as 'active' | 'maintenance' | 'retired' | undefined,
    search: searchParams.search,
  };
  
  const pagination = {
    page: parseInt(searchParams.page || '1'),
    limit: searchParams.view === 'grid' ? 12 : 20,
  };
  
  const sorting = {
    field: searchParams.sort || 'name',
    order: searchParams.order || 'asc',
  };

  const viewMode = searchParams.view || 'table';

  // Parallel data fetching
  const [machines, machineStats, locations] = await Promise.all([
    getMachinesWithFilters({
      organizationId,
      filters,
      pagination,
      sorting,
    }),
    getMachineStats(organizationId),
    getLocations(organizationId),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Machine Inventory</h1>
          <p className="text-muted-foreground">
            Manage your pinball machine fleet and track maintenance
          </p>
        </div>
        <div className="flex gap-2">
          <CreateMachineButton />
          <QRCodeBulkActionsButton />
        </div>
      </div>

      {/* Server-rendered statistics */}
      <Suspense fallback={<MachineStatsSkeleton />}>
        <MachineStatsServer stats={machineStats} />
      </Suspense>

      {/* Server-rendered filters */}
      <MachineFiltersServer
        initialFilters={filters}
        locations={locations}
        viewMode={viewMode}
      />

      {/* Server-rendered machine inventory */}
      <Suspense fallback={<MachineInventorySkeleton view={viewMode} />}>
        <MachineInventoryServer
          machines={machines}
          viewMode={viewMode}
          pagination={pagination}
        />
      </Suspense>
    </div>
  );
}
```

### 2. Machine Inventory Server Component (`src/components/machines/machine-inventory-server.tsx`)

**Purpose**: Server Component replacing Material UI DataGrid with shadcn/ui table/grid

```tsx
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { MachineCard } from "~/components/machines/machine-card";
import { MachineTableRow } from "~/components/machines/machine-table-row";
import { MachineBulkActionsClient } from "~/components/machines/machine-bulk-actions-client";
import { MachineInventoryPagination } from "~/components/machines/machine-inventory-pagination";

interface MachineInventoryServerProps {
  machines: {
    items: Array<{
      id: string;
      name: string;
      model: string;
      manufacturer: string;
      year?: number;
      status: 'active' | 'maintenance' | 'retired';
      location: {
        id: string;
        name: string;
      } | null;
      qrCode?: string;
      lastMaintenanceDate?: Date;
      issueCount: number;
      createdAt: Date;
    }>;
    totalCount: number;
    hasNextPage: boolean;
  };
  viewMode: 'grid' | 'table';
  pagination: {
    page: number;
    limit: number;
  };
}

export async function MachineInventoryServer({
  machines,
  viewMode,
  pagination
}: MachineInventoryServerProps) {
  if (machines.items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-medium">No machines found</h3>
            <p className="text-muted-foreground max-w-md">
              Get started by adding your first pinball machine to the inventory.
            </p>
            <CreateMachineButton />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with count and bulk actions */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary">
          {machines.totalCount.toLocaleString()} machine{machines.totalCount !== 1 ? 's' : ''}
        </Badge>
        
        {/* Client island for bulk operations */}
        <MachineBulkActionsClient machines={machines.items} />
      </div>

      {/* Machine inventory display */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {machines.items.map((machine) => (
            <MachineCard key={machine.id} machine={machine} />
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox />
                </TableHead>
                <TableHead>Machine</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead>Last Maintenance</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {machines.items.map((machine) => (
                <MachineTableRow key={machine.id} machine={machine} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Server-rendered pagination */}
      <MachineInventoryPagination
        currentPage={pagination.page}
        hasNextPage={machines.hasNextPage}
        totalCount={machines.totalCount}
        limit={pagination.limit}
      />
    </div>
  );
}
```

### 3. Machine Detail Server Component (`src/app/machines/[id]/page.tsx`)

**Purpose**: Server Component machine detail with client islands for interactions

```tsx
import { notFound } from "next/navigation";
import { requireServerAuth } from "~/lib/auth/server-auth";
import { getMachineById, getMachineIssues, getMachineMaintenanceHistory } from "~/lib/dal/machines";
import { MachineHeader } from "~/components/machines/machine-header";
import { MachineSpecifications } from "~/components/machines/machine-specifications";
import { MachineStatusClient } from "~/components/machines/machine-status-client";
import { MachineQRCodeClient } from "~/components/machines/machine-qr-code-client";
import { MachineIssuesList } from "~/components/machines/machine-issues-list";
import { MachineMaintenanceHistory } from "~/components/machines/machine-maintenance-history";
import { MachineImageGallery } from "~/components/machines/machine-image-gallery";

interface MachineDetailPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: MachineDetailPageProps) {
  const { organizationId } = await requireServerAuth();
  const machine = await getMachineById(params.id, organizationId);
  
  if (!machine) return { title: "Machine Not Found" };
  
  return {
    title: `${machine.name} - Machine Inventory`,
    description: `${machine.manufacturer} ${machine.model} pinball machine details and maintenance tracking`,
  };
}

export default async function MachineDetailPage({ params }: MachineDetailPageProps) {
  const { organizationId } = await requireServerAuth();
  
  // Parallel data fetching with organization scoping
  const [machine, issues, maintenanceHistory] = await Promise.all([
    getMachineById(params.id, organizationId),
    getMachineIssues(params.id, organizationId, { limit: 10 }),
    getMachineMaintenanceHistory(params.id, organizationId, { limit: 5 }),
  ]);
  
  if (!machine) {
    notFound();
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Server-rendered machine header */}
      <MachineHeader machine={machine} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Server-rendered specifications */}
          <MachineSpecifications machine={machine} />
          
          {/* Server-rendered image gallery */}
          <MachineImageGallery images={machine.images} />
          
          {/* Server-rendered recent issues */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Recent Issues</h3>
              <Button asChild variant="outline" size="sm">
                <Link href={`/issues?machine=${machine.id}`}>
                  View All ({issues.totalCount})
                </Link>
              </Button>
            </div>
            <MachineIssuesList issues={issues.items} />
          </div>
          
          {/* Server-rendered maintenance history */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Maintenance History</h3>
              <Button asChild variant="outline" size="sm">
                <Link href={`/machines/${machine.id}/maintenance`}>
                  View All
                </Link>
              </Button>
            </div>
            <MachineMaintenanceHistory history={maintenanceHistory.items} />
          </div>
        </div>
        
        <div className="space-y-4">
          {/* Client islands for interactive elements */}
          <MachineStatusClient
            machineId={machine.id}
            currentStatus={machine.status}
            organizationId={organizationId}
          />
          
          <MachineQRCodeClient
            machineId={machine.id}
            qrCode={machine.qrCode}
            machineName={machine.name}
          />
          
          {/* Server-rendered machine metadata */}
          <MachineMetadata machine={machine} />
        </div>
      </div>
    </div>
  );
}
```

### 4. Machine Server Actions (`src/lib/actions/machine-actions.ts`)

**Purpose**: CRUD operations with QR code management and validation

```typescript
"use server";

import { revalidateTag, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireServerAuth } from "~/lib/auth/server-auth";
import { createMachine, updateMachine, deleteMachine } from "~/lib/dal/machines";
import { generateQRCode, regenerateQRCode } from "~/lib/services/qr-code-service";
import { SECURITY_ERRORS } from "~/lib/errors";
import type { ActionResult } from "~/lib/types/actions";

// Validation schemas
const CreateMachineSchema = z.object({
  name: z.string().min(1, "Machine name is required").max(100),
  model: z.string().min(1, "Model is required").max(100),
  manufacturer: z.string().min(1, "Manufacturer is required").max(100),
  year: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  serialNumber: z.string().optional(),
  locationId: z.string().min(1, "Location is required"),
  status: z.enum(["active", "maintenance", "retired"]).default("active"),
  notes: z.string().optional(),
});

const UpdateMachineSchema = CreateMachineSchema.partial();

const BulkQRRegenerateSchema = z.object({
  machineIds: z.array(z.string()).min(1, "At least one machine must be selected").max(50, "Cannot process more than 50 machines at once"),
});

export async function createMachineAction(
  formData: FormData
): Promise<ActionResult<{ machineId: string }>> {
  const { user, organizationId } = await requireServerAuth();

  const result = CreateMachineSchema.safeParse({
    name: formData.get("name"),
    model: formData.get("model"),
    manufacturer: formData.get("manufacturer"),
    year: formData.get("year"),
    serialNumber: formData.get("serialNumber"),
    locationId: formData.get("locationId"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    // Create machine
    const machine = await createMachine({
      ...result.data,
      organizationId,
      createdBy: user.id,
    });

    // Generate QR code
    const qrCode = await generateQRCode(machine.id, {
      type: "machine",
      url: `/report?machine=${machine.id}`,
      organizationId,
    });

    // Update machine with QR code
    await updateMachine(machine.id, organizationId, {
      qrCode: qrCode.url,
      updatedBy: user.id,
    });

    // Cache invalidation
    revalidateTag(`machines-${organizationId}`);
    revalidateTag(`dashboard-${organizationId}`);
    revalidatePath("/machines");

    return { success: true, data: { machineId: machine.id } };
  } catch (error) {
    console.error("Create machine error:", error);
    return {
      success: false,
      errors: { _form: ["Failed to create machine. Please try again."] },
    };
  }
}

export async function updateMachineAction(
  machineId: string,
  formData: FormData
): Promise<ActionResult<{ machineId: string }>> {
  const { user, organizationId } = await requireServerAuth();

  const result = UpdateMachineSchema.safeParse({
    name: formData.get("name"),
    model: formData.get("model"),
    manufacturer: formData.get("manufacturer"),
    year: formData.get("year"),
    serialNumber: formData.get("serialNumber"),
    locationId: formData.get("locationId"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    await updateMachine(machineId, organizationId, {
      ...result.data,
      updatedBy: user.id,
    });

    // Granular cache invalidation
    revalidateTag(`machine-${machineId}`);
    revalidateTag(`machines-${organizationId}`);
    revalidatePath(`/machines/${machineId}`);
    revalidatePath("/machines");

    return { success: true, data: { machineId } };
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return {
        success: false,
        errors: { _form: [SECURITY_ERRORS.RESOURCE_NOT_FOUND] },
      };
    }

    console.error("Update machine error:", error);
    return {
      success: false,
      errors: { _form: ["Failed to update machine. Please try again."] },
    };
  }
}

export async function regenerateQRCodeAction(
  machineId: string
): Promise<ActionResult<{ qrCodeUrl: string }>> {
  const { user, organizationId } = await requireServerAuth();

  try {
    const qrCode = await regenerateQRCode(machineId, {
      type: "machine",
      url: `/report?machine=${machineId}`,
      organizationId,
    });

    await updateMachine(machineId, organizationId, {
      qrCode: qrCode.url,
      updatedBy: user.id,
    });

    // Cache invalidation
    revalidateTag(`machine-${machineId}`);
    revalidatePath(`/machines/${machineId}`);

    return { success: true, data: { qrCodeUrl: qrCode.url } };
  } catch (error) {
    console.error("Regenerate QR code error:", error);
    return {
      success: false,
      errors: { _form: ["Failed to regenerate QR code. Please try again."] },
    };
  }
}

export async function bulkRegenerateQRCodesAction(
  formData: FormData
): Promise<ActionResult<{ processedCount: number }>> {
  const { user, organizationId } = await requireServerAuth();

  const machineIdsString = formData.get("machineIds") as string;
  const machineIds = machineIdsString ? machineIdsString.split(",") : [];

  const result = BulkQRRegenerateSchema.safeParse({ machineIds });

  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors,
    };
  }

  try {
    let processedCount = 0;

    // Process machines in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < result.data.machineIds.length; i += batchSize) {
      const batch = result.data.machineIds.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (machineId) => {
          try {
            const qrCode = await regenerateQRCode(machineId, {
              type: "machine",
              url: `/report?machine=${machineId}`,
              organizationId,
            });

            await updateMachine(machineId, organizationId, {
              qrCode: qrCode.url,
              updatedBy: user.id,
            });

            processedCount++;
          } catch (error) {
            console.error(`Failed to regenerate QR for machine ${machineId}:`, error);
          }
        })
      );
    }

    // Cache invalidation
    revalidateTag(`machines-${organizationId}`);
    revalidatePath("/machines");

    return { success: true, data: { processedCount } };
  } catch (error) {
    console.error("Bulk QR regeneration error:", error);
    return {
      success: false,
      errors: { _form: ["Failed to regenerate QR codes. Please try again."] },
    };
  }
}

export async function bulkUpdateMachinesAction(
  machineIds: string[],
  updates: {
    status?: string;
    locationId?: string;
  }
): Promise<ActionResult<{ updatedCount: number }>> {
  const { user, organizationId } = await requireServerAuth();

  if (machineIds.length === 0) {
    return {
      success: false,
      errors: { _form: ["No machines selected for update"] },
    };
  }

  if (machineIds.length > 50) {
    return {
      success: false,
      errors: { _form: ["Cannot update more than 50 machines at once"] },
    };
  }

  try {
    const updatedCount = await bulkUpdateMachines(
      machineIds,
      organizationId,
      {
        ...updates,
        updatedBy: user.id,
      }
    );

    // Cache invalidation
    revalidateTag(`machines-${organizationId}`);
    revalidatePath("/machines");

    return { success: true, data: { updatedCount } };
  } catch (error) {
    console.error("Bulk machine update error:", error);
    return {
      success: false,
      errors: { _form: ["Failed to update machines. Please try again."] },
    };
  }
}
```

### 5. Enhanced Machine Data Access Layer (`src/lib/dal/machines.ts`)

**Purpose**: Server-side data access with complex joins and caching

```typescript
import { cache } from "react";
import { and, eq, ilike, inArray, desc, asc, count, sql } from "drizzle-orm";
import { db } from "~/lib/db";
import { machines, locations, issues, maintenanceRecords } from "~/lib/db/schema";
import type { MachineFilters, PaginationParams, SortParams } from "~/lib/types";

// Request-level cached machine queries
export const getMachinesWithFilters = cache(async ({
  organizationId,
  filters,
  pagination,
  sorting,
}: {
  organizationId: string;
  filters: MachineFilters;
  pagination: PaginationParams;
  sorting: SortParams;
}) => {
  const offset = (pagination.page - 1) * pagination.limit;
  
  // Build where conditions
  const whereConditions = [eq(machines.organizationId, organizationId)];
  
  if (filters.locationIds?.length) {
    whereConditions.push(inArray(machines.locationId, filters.locationIds));
  }
  
  if (filters.models?.length) {
    whereConditions.push(inArray(machines.model, filters.models));
  }
  
  if (filters.status) {
    whereConditions.push(eq(machines.status, filters.status));
  }
  
  if (filters.search) {
    whereConditions.push(
      sql`(${machines.name} ILIKE ${`%${filters.search}%`} OR ${machines.model} ILIKE ${`%${filters.search}%`} OR ${machines.manufacturer} ILIKE ${`%${filters.search}%`})`
    );
  }
  
  // Build order by
  const orderBy = sorting.order === 'desc' 
    ? desc(machines[sorting.field as keyof typeof machines])
    : asc(machines[sorting.field as keyof typeof machines]);

  // Parallel queries for data and count
  const [machinesResult, totalCountResult] = await Promise.all([
    db.query.machines.findMany({
      where: and(...whereConditions),
      with: {
        location: {
          columns: { id: true, name: true, address: true },
        },
        _count: {
          issues: count(sql`CASE WHEN ${issues.status} IN ('open', 'in_progress') THEN 1 END`),
        },
      },
      limit: pagination.limit + 1,
      offset,
      orderBy: [orderBy],
    }),
    
    db.select({ count: count() })
      .from(machines)
      .where(and(...whereConditions))
      .then(result => result[0].count),
  ]);

  const hasNextPage = machinesResult.length > pagination.limit;
  const items = hasNextPage ? machinesResult.slice(0, -1) : machinesResult;

  return {
    items,
    totalCount: totalCountResult,
    hasNextPage,
  };
});

export const getMachineById = cache(async (machineId: string, organizationId: string) => {
  return await db.query.machines.findFirst({
    where: and(
      eq(machines.id, machineId),
      eq(machines.organizationId, organizationId)
    ),
    with: {
      location: {
        columns: { id: true, name: true, address: true },
      },
      images: {
        columns: { id: true, filename: true, url: true },
      },
    },
  });
});

export const getMachineStats = cache(async (organizationId: string) => {
  const stats = await db
    .select({
      total: count(),
      active: count(sql`CASE WHEN ${machines.status} = 'active' THEN 1 END`),
      maintenance: count(sql`CASE WHEN ${machines.status} = 'maintenance' THEN 1 END`),
      retired: count(sql`CASE WHEN ${machines.status} = 'retired' THEN 1 END`),
      withQR: count(sql`CASE WHEN ${machines.qrCode} IS NOT NULL THEN 1 END`),
      averageAge: sql`AVG(EXTRACT(YEAR FROM NOW()) - ${machines.year})`,
    })
    .from(machines)
    .where(eq(machines.organizationId, organizationId));

  return stats[0];
});

export const getMachineIssues = cache(async (
  machineId: string, 
  organizationId: string,
  options: { limit?: number } = {}
) => {
  const limit = options.limit || 10;
  
  const [issuesResult, totalCount] = await Promise.all([
    db.query.issues.findMany({
      where: and(
        eq(issues.machineId, machineId),
        eq(issues.organizationId, organizationId)
      ),
      with: {
        assignee: {
          columns: { id: true, name: true },
        },
      },
      limit,
      orderBy: [desc(issues.createdAt)],
    }),
    
    db.select({ count: count() })
      .from(issues)
      .where(and(
        eq(issues.machineId, machineId),
        eq(issues.organizationId, organizationId)
      ))
      .then(result => result[0].count),
  ]);

  return {
    items: issuesResult,
    totalCount,
  };
});

// Database mutations (not cached)
export async function createMachine(data: {
  name: string;
  model: string;
  manufacturer: string;
  year?: number;
  serialNumber?: string;
  locationId: string;
  organizationId: string;
  createdBy: string;
  status: string;
  notes?: string;
}) {
  const result = await db.insert(machines).values({
    ...data,
    id: generateId(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return result[0];
}

export async function updateMachine(
  machineId: string,
  organizationId: string,
  updates: Partial<Machine>
) {
  const result = await db
    .update(machines)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(
      eq(machines.id, machineId),
      eq(machines.organizationId, organizationId)
    ))
    .returning({ id: machines.id });

  if (result.length === 0) {
    throw new Error(`Machine ${machineId} not found or access denied`);
  }
}

export async function bulkUpdateMachines(
  machineIds: string[],
  organizationId: string,
  updates: {
    status?: string;
    locationId?: string;
    updatedBy: string;
  }
): Promise<number> {
  const result = await db
    .update(machines)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(
      inArray(machines.id, machineIds),
      eq(machines.organizationId, organizationId)
    ))
    .returning({ id: machines.id });

  return result.length;
}
```

---

## Client Island Components

### 1. Machine Search Input Client (`src/components/machines/machine-search-input.tsx`)

**Purpose**: Debounced search with URL parameter updates

```tsx
"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "~/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useDebounce } from "~/lib/hooks/use-debounce";

export function MachineSearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  const initialSearch = searchParams.get("search") || "";
  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, 300);
  
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    } else {
      params.delete("search");
    }
    
    // Reset to first page when search changes
    params.delete("page");
    
    startTransition(() => {
      router.push(`/machines?${params.toString()}`);
    });
  }, [debouncedSearch, router, searchParams]);
  
  const clearSearch = () => {
    setSearch("");
  };
  
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Search machines by name, model, or manufacturer..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-10 pr-10"
        disabled={isPending}
      />
      {search && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearSearch}
          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
```

### 2. QR Code Management Client (`src/components/machines/machine-qr-code-client.tsx`)

**Purpose**: QR code operations with download and regeneration

```tsx
"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Download, RefreshCw, QrCode } from "lucide-react";
import { regenerateQRCodeAction } from "~/lib/actions/machine-actions";
import { toast } from "~/components/ui/use-toast";

interface MachineQRCodeClientProps {
  machineId: string;
  qrCode?: string;
  machineName: string;
}

export function MachineQRCodeClient({ 
  machineId, 
  qrCode, 
  machineName 
}: MachineQRCodeClientProps) {
  const [currentQRCode, setCurrentQRCode] = useState(qrCode);
  const [isPending, startTransition] = useTransition();

  const handleRegenerate = () => {
    startTransition(async () => {
      const result = await regenerateQRCodeAction(machineId);
      
      if (result.success) {
        setCurrentQRCode(result.data.qrCodeUrl);
        toast({
          title: "QR Code regenerated",
          description: "The QR code has been updated successfully",
        });
      } else {
        toast({
          title: "Failed to regenerate QR code",
          description: result.errors._form?.[0] || "Please try again",
          variant: "destructive",
        });
      }
    });
  };

  const handleDownload = () => {
    if (!currentQRCode) return;
    
    // Create download link
    const link = document.createElement('a');
    link.href = currentQRCode;
    link.download = `${machineName.replace(/[^a-zA-Z0-9]/g, '_')}_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentQRCode ? (
          <>
            <div className="flex justify-center">
              <img 
                src={currentQRCode} 
                alt={`QR Code for ${machineName}`}
                className="w-32 h-32 border rounded"
              />
            </div>
            <Badge variant="success" className="w-full justify-center">
              Active
            </Badge>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownload}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRegenerate}
                disabled={isPending}
                className="flex-1"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${isPending ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center items-center h-32 border rounded bg-muted">
              <div className="text-center text-muted-foreground">
                <QrCode className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">No QR Code</p>
              </div>
            </div>
            <Badge variant="secondary" className="w-full justify-center">
              Not Generated
            </Badge>
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleRegenerate}
              disabled={isPending}
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isPending ? 'animate-spin' : ''}`} />
              Generate QR Code
            </Button>
          </>
        )}
        
        <p className="text-xs text-muted-foreground text-center">
          QR code links to issue reporting form for this machine
        </p>
      </CardContent>
    </Card>
  );
}
```

---

## Implementation Timeline

### Day 6-7: Machine Inventory Server Component
**Files**: `src/app/machines/page.tsx`, `src/components/machines/machine-inventory-server.tsx`
- [ ] Convert machine inventory page to Server Component with URL filtering
- [ ] Replace Material UI DataGrid with shadcn/ui table and grid views
- [ ] Implement server-side search and location-based filtering
- [ ] Add machine statistics server component

### Day 8-9: Machine Detail and Management
**Files**: `src/app/machines/[id]/page.tsx`, hybrid components
- [ ] Convert machine detail page to hybrid Server Component architecture
- [ ] Create client islands for QR code management and status updates
- [ ] Implement machine form as hybrid component with server validation
- [ ] Add maintenance history and issue tracking integration

### Day 10: Server Actions and QR Code System
**Files**: `src/lib/actions/machine-actions.ts`, `src/lib/services/qr-code-service.ts`
- [ ] Complete Server Actions for machine CRUD operations
- [ ] Implement QR code generation and bulk regeneration
- [ ] Add bulk machine operations with proper validation
- [ ] Enhanced cache invalidation strategies

---

## Success Validation

### Performance Targets
- **Bundle Size**: <40KB for machine components (vs current 120KB+)
- **Initial Load**: <250ms for machine inventory page
- **Database Queries**: <3 queries per page through React 19 cache()
- **Mobile Experience**: Touch-optimized table/grid views

### Functional Requirements
- [ ] Complete machine inventory management preserved
- [ ] QR code generation and bulk operations working
- [ ] Location-based filtering and search functionality
- [ ] Mobile-responsive design with optimal touch targets
- [ ] Accessibility compliance maintained

---

**Dependencies & Prerequisites**:
- ✅ Phase 3A: Issue system patterns established
- ✅ Data Access Layer and Server Actions infrastructure
- ✅ shadcn/ui components and Material UI coexistence

**Next Phase**: [Phase 3C: Search and Filtering Systems](./PHASE_3C_SEARCH_AND_FILTERING.md)

**User Goal Progress**: Phase 3B transforms machine inventory management to server-first architecture, establishing efficient asset management patterns while delivering significant performance improvements and mobile optimization.