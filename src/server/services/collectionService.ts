import { eq, and, or, sql, count } from "drizzle-orm";

import { type DrizzleClient } from "../db/drizzle";
import {
  collections,
  collectionTypes,
  collectionMachines,
  machines,
  models,
} from "../db/schema";

import type { InferSelectModel } from "drizzle-orm";

// Type definitions using Drizzle schema inference
type Collection = InferSelectModel<typeof collections>;
type CollectionType = InferSelectModel<typeof collectionTypes>;

export interface CreateManualCollectionData {
  name: string;
  typeId: string;
  locationId?: string;
  description?: string;
}

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

type CollectionTypeWithCount = CollectionType & {
  collectionCount: number;
};

export class CollectionService {
  constructor(private db: DrizzleClient) {}

  /**
   * Get collections for a location (for public filtering)
   */
  async getLocationCollections(
    locationId: string,
    organizationId: string,
  ): Promise<{
    manual: CollectionWithMachines[];
    auto: CollectionWithMachines[];
  }> {
    // Use a join query instead of nested relational queries for better control
    const collectionsData = await this.db
      .select({
        collectionId: collections.id,
        collectionName: collections.name,
        collectionIsManual: collections.isManual,
        collectionSortOrder: collections.sortOrder,
        typeId: collectionTypes.id,
        typeName: collectionTypes.name,
        typeDisplayName: collectionTypes.displayName,
        typeSortOrder: collectionTypes.sortOrder,
        machineCount: count(machines.id).as("machine_count"),
      })
      .from(collections)
      .innerJoin(collectionTypes, eq(collections.typeId, collectionTypes.id))
      .leftJoin(
        machines,
        and(
          sql`EXISTS (
            SELECT 1 FROM ${collectionMachines} cm 
            WHERE cm.collection_id = ${collections.id} 
            AND cm.machine_id = ${machines.id}
          )`,
          eq(machines.locationId, locationId),
        ),
      )
      .where(
        and(
          or(
            eq(collections.locationId, locationId), // Location-specific collections
            and(
              sql`${collections.locationId} IS NULL`, // Organization-wide auto-collections
              eq(collections.isManual, false),
            ),
          ),
          eq(collectionTypes.organizationId, organizationId),
          eq(collectionTypes.isEnabled, true),
        ),
      )
      .groupBy(
        collections.id,
        collections.name,
        collections.isManual,
        collections.sortOrder,
        collectionTypes.id,
        collectionTypes.name,
        collectionTypes.displayName,
        collectionTypes.sortOrder,
      )
      .orderBy(collectionTypes.sortOrder, collections.sortOrder);

    const { manual, auto } = collectionsData.reduce(
      (acc, collection) => {
        const collectionData: CollectionWithMachines = {
          id: collection.collectionId,
          name: collection.collectionName,
          type: {
            id: collection.typeId,
            name: collection.typeName,
            displayName: collection.typeDisplayName,
          },
          machineCount: collection.machineCount,
        };

        if (collection.collectionIsManual) {
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
    // Use a join query to get machines in the collection at the location
    const machinesData = await this.db
      .select({
        id: machines.id,
        modelName: models.name,
        modelManufacturer: models.manufacturer,
        modelYear: models.year,
      })
      .from(machines)
      .innerJoin(models, eq(machines.modelId, models.id))
      .innerJoin(
        collectionMachines,
        eq(collectionMachines.machineId, machines.id),
      )
      .where(
        and(
          eq(machines.locationId, locationId),
          eq(collectionMachines.collectionId, collectionId),
        ),
      )
      .orderBy(models.name);

    return machinesData.map((machine) => ({
      id: machine.id,
      model: {
        name: machine.modelName,
        manufacturer: machine.modelManufacturer,
        year: machine.modelYear,
      },
    }));
  }

  /**
   * Create a manual collection
   */
  async createManualCollection(
    organizationId: string,
    data: CreateManualCollectionData,
  ): Promise<Collection> {
    // Validate that the collection type belongs to the specified organization
    const [type] = await this.db
      .select()
      .from(collectionTypes)
      .where(
        and(
          eq(collectionTypes.id, data.typeId),
          eq(collectionTypes.organizationId, organizationId),
        ),
      )
      .limit(1);

    if (!type) {
      throw new Error(
        "Collection type does not belong to the specified organization",
      );
    }
    const createData = {
      id: sql`gen_random_uuid()`, // Generate UUID in database
      name: data.name,
      typeId: data.typeId,
      locationId: data.locationId ?? null,
      description: data.description ?? null,
      isManual: true,
      isSmart: false,
      sortOrder: 0,
      filterCriteria: null,
    };

    const [newCollection] = await this.db
      .insert(collections)
      .values(createData)
      .returning();

    if (!newCollection) {
      throw new Error("Failed to create collection");
    }

    return newCollection;
  }

  /**
   * Add machines to a manual collection
   * Uses PostgreSQL-specific unnest function for efficient bulk insert
   *
   * TODO: Consider migrating to Drizzle's native many-to-many relations once the library
   * supports junction tables with additional fields (like createdAt timestamps).
   * Target timeline: Next major Drizzle version release or when collection audit trail is needed.
   */
  async addMachinesToCollection(
    collectionId: string,
    machineIds: string[],
  ): Promise<void> {
    if (machineIds.length === 0) return;

    // Use PostgreSQL-specific unnest function for bulk insert with proper conflict handling
    await this.db.execute(sql`
      INSERT INTO ${collectionMachines} (collection_id, machine_id)
      SELECT ${collectionId}, unnest(${machineIds})
      ON CONFLICT (collection_id, machine_id) DO NOTHING
    `);
  }

  /**
   * Generate auto-collections for an organization
   */
  async generateAutoCollections(organizationId: string): Promise<{
    generated: number;
    updated: number;
  }> {
    const autoTypes = await this.db.query.collectionTypes.findMany({
      where: and(
        eq(collectionTypes.organizationId, organizationId),
        eq(collectionTypes.isAutoGenerated, true),
        eq(collectionTypes.isEnabled, true),
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
    // Get all unique manufacturers for machines in this organization using Drizzle
    const manufacturerData = await this.db
      .selectDistinct({
        manufacturer: models.manufacturer,
      })
      .from(machines)
      .innerJoin(models, eq(machines.modelId, models.id))
      .where(
        and(
          eq(machines.organizationId, collectionType.organizationId),
          sql`${models.manufacturer} IS NOT NULL`,
        ),
      );

    const uniqueManufacturers = manufacturerData
      .map((m) => m.manufacturer)
      .filter((m): m is string => m !== null);

    let generated = 0;
    let updated = 0;

    for (const manufacturer of uniqueManufacturers) {
      // Check if collection already exists
      const existing = await this.db.query.collections.findFirst({
        where: and(
          eq(collections.name, manufacturer),
          eq(collections.typeId, collectionType.id),
          sql`${collections.locationId} IS NULL`, // Organization-wide
        ),
      });

      // Get all machines with this manufacturer
      const machinesWithManufacturer = await this.db
        .select({ id: machines.id })
        .from(machines)
        .innerJoin(models, eq(machines.modelId, models.id))
        .where(
          and(
            eq(machines.organizationId, collectionType.organizationId),
            eq(models.manufacturer, manufacturer),
          ),
        );

      const machineIds = machinesWithManufacturer.map((m) => m.id);

      if (!existing) {
        // Create new collection
        const [collection] = await this.db
          .insert(collections)
          .values({
            id: sql`gen_random_uuid()`,
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

        if (!collection) {
          throw new Error("Failed to create manufacturer collection");
        }

        // Add machines to collection (using placeholder SQL)
        if (machineIds.length > 0) {
          await this.addMachinesToCollection(collection.id, machineIds);
        }

        generated++;
      } else {
        // Update existing collection with new machines (replace all)
        // First remove existing associations, then add new ones
        await this.db.execute(sql`
          DELETE FROM ${collectionMachines} 
          WHERE collection_id = ${existing.id}
        `);

        if (machineIds.length > 0) {
          await this.addMachinesToCollection(existing.id, machineIds);
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
          sql`${collections.locationId} IS NULL`,
        ),
      });

      // Find machines in this era
      const machinesInEra = await this.db
        .select({ id: machines.id })
        .from(machines)
        .innerJoin(models, eq(machines.modelId, models.id))
        .where(
          and(
            eq(machines.organizationId, collectionType.organizationId),
            sql`${models.year} >= ${era.start}`,
            sql`${models.year} <= ${era.end}`,
          ),
        );

      if (machinesInEra.length === 0) continue; // Skip empty eras

      const machineIds = machinesInEra.map((m) => m.id);

      if (!existing) {
        // Create new collection
        const [collection] = await this.db
          .insert(collections)
          .values({
            id: sql`gen_random_uuid()`,
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

        if (!collection) {
          throw new Error("Failed to create year-based collection");
        }

        await this.addMachinesToCollection(collection.id, machineIds);
        generated++;
      } else {
        // Update existing collection with new machines (replace all)
        await this.db.execute(sql`
          DELETE FROM ${collectionMachines} 
          WHERE collection_id = ${existing.id}
        `);

        await this.addMachinesToCollection(existing.id, machineIds);
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
      .update(collectionTypes)
      .set({ isEnabled: enabled })
      .where(eq(collectionTypes.id, collectionTypeId));
  }

  /**
   * Get organization's collection types for admin management
   */
  async getOrganizationCollectionTypes(
    organizationId: string,
  ): Promise<CollectionTypeWithCount[]> {
    const typesWithCounts = await this.db
      .select({
        id: collectionTypes.id,
        name: collectionTypes.name,
        organizationId: collectionTypes.organizationId,
        isAutoGenerated: collectionTypes.isAutoGenerated,
        isEnabled: collectionTypes.isEnabled,
        sourceField: collectionTypes.sourceField,
        generationRules: collectionTypes.generationRules,
        displayName: collectionTypes.displayName,
        description: collectionTypes.description,
        sortOrder: collectionTypes.sortOrder,
        collectionCount: count(collections.id).as("collection_count"),
      })
      .from(collectionTypes)
      .leftJoin(collections, eq(collectionTypes.id, collections.typeId))
      .where(eq(collectionTypes.organizationId, organizationId))
      .groupBy(
        collectionTypes.id,
        collectionTypes.name,
        collectionTypes.organizationId,
        collectionTypes.isAutoGenerated,
        collectionTypes.isEnabled,
        collectionTypes.sourceField,
        collectionTypes.generationRules,
        collectionTypes.displayName,
        collectionTypes.description,
        collectionTypes.sortOrder,
      )
      .orderBy(collectionTypes.sortOrder);

    return typesWithCounts;
  }
}
