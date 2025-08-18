import { and, eq, or, gte, lte, sql, asc, isNull } from "drizzle-orm";

import { collections, collection_types, machines, models } from "../db/schema";

import type { DrizzleClient } from "../db/drizzle";
import type { InferSelectModel } from "drizzle-orm";

import { generateId } from "~/lib/utils/id-generation";

export interface CreateManualCollectionData {
  name: string;
  typeId: string;
  locationId?: string;
  description?: string;
}

// Type definitions for raw SQL query results
interface MachineIdResult {
  id: string;
}

interface CountResult {
  count: string | number;
}

interface MachineWithModelResult {
  id: string;
  model_name: string;
  manufacturer: string | null;
  year: number | null;
}

// Drizzle's execute() returns the results directly, not wrapped in a rows object
type SqlExecuteResult<T = unknown> = T[];

export interface CollectionWithMachines {
  id: string;
  name: string;
  type: {
    id: string;
    name: string;
    displayName: string | null;
  };
  machineCount: number;
  machines?: {
    id: string;
    model: {
      name: string;
      manufacturer: string | null;
    };
  }[];
}

// Type definitions using Drizzle schema inference
type Collection = InferSelectModel<typeof collections>;
type CollectionType = InferSelectModel<typeof collection_types>;

interface CollectionWithTypeAndCount {
  id: string;
  name: string;
  typeId: string;
  locationId: string | null;
  isManual: boolean;
  isSmart: boolean;
  description: string | null;
  sortOrder: number;
  filterCriteria: unknown;
  type: {
    id: string;
    name: string;
    displayName: string | null;
  };
  machineCount: number;
}

type CollectionTypeWithCount = CollectionType & {
  collectionCount: number;
};

export class CollectionService {
  constructor(private db: DrizzleClient) {}

  /**
   * Get collections for a location (for public filtering)
   * RLS automatically scopes to user's organization
   */
  async getLocationCollections(
    locationId: string,
  ): Promise<{
    manual: CollectionWithMachines[];
    auto: CollectionWithMachines[];
  }> {
    // Get collections with type information using Drizzle relational queries
    const collectionsWithTypes = await this.db.query.collections.findMany({
      where: or(
        eq(collections.locationId, locationId), // Location-specific collections
        and(
          isNull(collections.locationId), // Organization-wide auto-collections
          eq(collections.isManual, false),
        ),
      ),
      with: {
        type: {
          columns: {
            id: true,
            name: true,
            displayName: true,
            organizationId: true,
            isEnabled: true,
            sortOrder: true,
          },
        },
      },
      orderBy: [asc(collections.sortOrder)],
    });

    // Filter for enabled types in the organization and calculate machine counts
    const collectionsData: CollectionWithTypeAndCount[] = [];

    for (const collection of collectionsWithTypes) {
      // Skip if type is not enabled (RLS handles organization filtering)
      if (!collection.type.isEnabled) {
        continue;
      }

      // Count machines in this collection at the specific location
      // Note: This assumes a collection_machines junction table exists
      const machineCountResult = (await this.db.execute(sql`
        SELECT COUNT(*) as count
        FROM collection_machines cm
        INNER JOIN machines m ON cm.machine_id = m.id
        WHERE cm.collection_id = ${collection.id}
          AND m.location_id = ${locationId}
      `)) as unknown as SqlExecuteResult<CountResult>;

      const machineCount = Number(machineCountResult[0]?.count) || 0;

      collectionsData.push({
        ...collection,
        type: {
          id: collection.type.id,
          name: collection.type.name,
          displayName: collection.type.displayName,
        },
        machineCount,
      });
    }

    // Sort by type sort order, then collection sort order
    collectionsData.sort((a, b) => {
      const typeA = collectionsWithTypes.find((c) => c.id === a.id)?.type;
      const typeB = collectionsWithTypes.find((c) => c.id === b.id)?.type;

      if (typeA?.sortOrder !== typeB?.sortOrder) {
        return (typeA?.sortOrder ?? 0) - (typeB?.sortOrder ?? 0);
      }

      return a.sortOrder - b.sortOrder;
    });

    const { manual, auto } = collectionsData.reduce(
      (acc, collection) => {
        const collectionData: CollectionWithMachines = {
          id: collection.id,
          name: collection.name,
          type: {
            id: collection.type.id,
            name: collection.type.name,
            displayName: collection.type.displayName,
          },
          machineCount: collection.machineCount,
        };

        if (collection.isManual) {
          acc.manual.push(collectionData);
        } else {
          acc.auto.push(collectionData);
        }

        return acc;
      },
      {
        manual: [] as CollectionWithMachines[],
        auto: [] as CollectionWithMachines[],
      },
    );

    return { manual, auto };
  }

  /**
   * Get machines in a collection at a specific location
   */
  async getCollectionMachines(
    collectionId: string,
    locationId: string,
  ): Promise<
    {
      id: string;
      model: {
        name: string;
        manufacturer: string | null;
        year: number | null;
      };
    }[]
  > {
    // Get machines in the collection at the specific location using junction table
    const machinesInCollection = (await this.db.execute(sql`
      SELECT 
        m.id,
        mo.name as model_name,
        mo.manufacturer,
        mo.year
      FROM machines m
      INNER JOIN collection_machines cm ON m.id = cm.machine_id
      INNER JOIN models mo ON m.model_id = mo.id
      WHERE cm.collection_id = ${collectionId}
        AND m.location_id = ${locationId}
      ORDER BY mo.name ASC
    `)) as unknown as SqlExecuteResult<MachineWithModelResult>;

    return machinesInCollection.map((row) => ({
      id: row.id,
      model: {
        name: row.model_name,
        manufacturer: row.manufacturer,
        year: row.year,
      },
    }));
  }

  /**
   * Create a manual collection
   * RLS automatically sets organizationId via trigger
   */
  async createManualCollection(
    data: CreateManualCollectionData,
  ): Promise<Collection> {
    const createData = {
      id: generateId(),
      name: data.name,
      typeId: data.typeId,
      locationId: data.locationId ?? null,
      description: data.description ?? null,
      isManual: true,
      isSmart: false,
      sortOrder: 0,
      filterCriteria: null,
    };

    const result = await this.db
      .insert(collections)
      .values(createData)
      .returning();

    const collection = result[0];
    if (!collection) {
      throw new Error("Failed to create collection");
    }

    return collection;
  }

  /**
   * Add machines to a manual collection
   * Uses PostgreSQL-specific unnest function for efficient bulk insert
   *
   * NOTE: Uses raw SQL for PostgreSQL-specific bulk operations. The machineIds parameter
   * is properly parameterized to prevent SQL injection. Drizzle supports many-to-many
   * relations via junction tables, but this approach provides better performance for
   * bulk operations with proper conflict handling.
   */
  async addMachinesToCollection(
    collectionId: string,
    machineIds: string[],
  ): Promise<void> {
    // Insert into junction table, ignoring duplicates
    if (machineIds.length > 0) {
      const machineIdArray = sql.join(
        machineIds.map((id) => sql`${id}`),
        sql`, `,
      );
      await this.db.execute(sql`
        INSERT INTO collection_machines (collection_id, machine_id)
        SELECT ${collectionId}, unnest(ARRAY[${machineIdArray}])
        ON CONFLICT (collection_id, machine_id) DO NOTHING
      `);
    }
  }

  /**
   * Generate auto-collections for an organization
   * RLS automatically scopes to user's organization
   */
  async generateAutoCollections(): Promise<{
    generated: number;
    updated: number;
  }> {
    const autoTypes = await this.db.query.collection_types.findMany({
      where: and(
        eq(collection_types.isAutoGenerated, true),
        eq(collection_types.isEnabled, true),
      ),
    });

    let generated = 0;
    let updated = 0;

    for (const type of autoTypes) {
      if (type.sourceField === "manufacturer") {
        const result = await this.generateManufacturerCollections(type);
        generated += result.generated;
        updated += result.updated;
      } else if (type.sourceField === "year") {
        const result = await this.generateYearCollections(type);
        generated += result.generated;
        updated += result.updated;
      }
    }

    return { generated, updated };
  }

  /**
   * Generate manufacturer-based collections
   */
  private async generateManufacturerCollections(
    collectionType: CollectionType,
  ): Promise<{ generated: number; updated: number }> {
    // Get all unique manufacturers for machines in this organization
    const machineModels = await this.db
      .selectDistinct({
        manufacturer: models.manufacturer,
      })
      .from(machines)
      .innerJoin(models, eq(machines.modelId, models.id))
      .where(
        // RLS automatically scopes machines to user's organization
        sql`${models.manufacturer} IS NOT NULL`,
      );

    const uniqueManufacturers = machineModels
      .map((m) => m.manufacturer)
      .filter((m: string | null): m is string => m !== null);

    let generated = 0;
    let updated = 0;

    for (const manufacturer of uniqueManufacturers) {
      // Check if collection already exists
      const existing = await this.db.query.collections.findFirst({
        where: and(
          eq(collections.name, manufacturer),
          eq(collections.typeId, collectionType.id),
          isNull(collections.locationId), // Organization-wide
        ),
      });

      if (!existing) {
        // Create new collection
        const result = await this.db
          .insert(collections)
          .values({
            id: generateId(),
            name: manufacturer,
            typeId: collectionType.id,
            locationId: null,
            isManual: false,
            isSmart: false,
            sortOrder: 0,
            filterCriteria: { manufacturer },
            description: null,
          })
          .returning();

        const collection = result[0];
        if (!collection) {
          throw new Error("Failed to create manufacturer collection");
        }

        // Add all machines with this manufacturer (RLS scoped)
        const manufacturerMachines = await this.db
          .select({ id: machines.id })
          .from(machines)
          .innerJoin(models, eq(machines.modelId, models.id))
          .where(
            // RLS automatically scopes machines to user's organization
            eq(models.manufacturer, manufacturer),
          );

        if (manufacturerMachines.length > 0) {
          const machineIdArray = sql.join(
            manufacturerMachines.map((m: MachineIdResult) => sql`${m.id}`),
            sql`, `,
          );
          await this.db.execute(sql`
            INSERT INTO collection_machines (collection_id, machine_id)
            SELECT ${collection.id}, unnest(ARRAY[${machineIdArray}])
          `);
        }

        generated++;
      } else {
        // Update existing collection with new machines (replace all, RLS scoped)
        const manufacturerMachines = await this.db
          .select({ id: machines.id })
          .from(machines)
          .innerJoin(models, eq(machines.modelId, models.id))
          .where(
            // RLS automatically scopes machines to user's organization
            eq(models.manufacturer, manufacturer),
          );

        // First remove all existing associations
        await this.db.execute(sql`
          DELETE FROM collection_machines 
          WHERE collection_id = ${existing.id}
        `);

        // Then add current machines
        if (manufacturerMachines.length > 0) {
          const machineIdArray = sql.join(
            manufacturerMachines.map((m: MachineIdResult) => sql`${m.id}`),
            sql`, `,
          );
          await this.db.execute(sql`
            INSERT INTO collection_machines (collection_id, machine_id)
            SELECT ${existing.id}, unnest(ARRAY[${machineIdArray}])
          `);
        }

        updated++;
      }
    }

    return { generated, updated };
  }

  /**
   * Generate year/era-based collections
   */
  private async generateYearCollections(
    collectionType: CollectionType,
  ): Promise<{ generated: number; updated: number }> {
    // Define eras
    const eras = [
      { name: "1970s", start: 1970, end: 1979 },
      { name: "1980s", start: 1980, end: 1989 },
      { name: "1990s", start: 1990, end: 1999 },
      { name: "2000s", start: 2000, end: 2009 },
      { name: "2010s", start: 2010, end: 2019 },
      { name: "2020s", start: 2020, end: 2029 },
    ];

    let generated = 0;
    let updated = 0;

    for (const era of eras) {
      // Check if collection exists
      const existing = await this.db.query.collections.findFirst({
        where: and(
          eq(collections.name, era.name),
          eq(collections.typeId, collectionType.id),
          isNull(collections.locationId),
        ),
      });

      const eraMachines = await this.db
        .select({ id: machines.id })
        .from(machines)
        .innerJoin(models, eq(machines.modelId, models.id))
        .where(
          // RLS automatically scopes machines to user's organization
          and(
            gte(models.year, era.start),
            lte(models.year, era.end),
          ),
        );

      if (eraMachines.length === 0) continue; // Skip empty eras

      if (!existing) {
        const result = await this.db
          .insert(collections)
          .values({
            id: generateId(),
            name: era.name,
            typeId: collectionType.id,
            locationId: null,
            isManual: false,
            isSmart: false,
            sortOrder: 0,
            filterCriteria: {
              yearStart: era.start,
              yearEnd: era.end,
            },
            description: null,
          })
          .returning();

        const collection = result[0];
        if (!collection) {
          throw new Error("Failed to create era collection");
        }

        await this.addMachinesToCollection(
          collection.id,
          eraMachines.map((m) => m.id),
        );
        generated++;
      } else {
        // Update existing era collection (replace all machines)
        await this.db.execute(sql`
          DELETE FROM collection_machines 
          WHERE collection_id = ${existing.id}
        `);

        await this.addMachinesToCollection(
          existing.id,
          eraMachines.map((m) => m.id),
        );
        updated++;
      }
    }

    return { generated, updated };
  }

  /**
   * Enable/disable a collection type for an organization
   */
  async toggleCollectionType(
    collectionTypeId: string,
    enabled: boolean,
  ): Promise<void> {
    await this.db
      .update(collection_types)
      .set({ isEnabled: enabled })
      .where(eq(collection_types.id, collectionTypeId));
  }

  /**
   * Get organization's collection types for admin management
   * RLS automatically scopes to user's organization
   */
  async getOrganizationCollectionTypes(): Promise<CollectionTypeWithCount[]> {
    const types = await this.db.query.collection_types.findMany({
      orderBy: [asc(collection_types.sortOrder)],
    });

    // Get collection counts for each type
    const typesWithCounts: CollectionTypeWithCount[] = [];

    for (const type of types) {
      const countResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(collections)
        .where(eq(collections.typeId, type.id));

      typesWithCounts.push({
        ...type,
        collectionCount: countResult[0]?.count ?? 0,
      });
    }

    return typesWithCounts;
  }
}
