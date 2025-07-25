import {
  type Collection,
  type CollectionType,
  Prisma,
  type ExtendedPrismaClient,
} from "./types";

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

// Type definitions for Prisma queries
type CollectionWithTypeAndCount = Prisma.CollectionGetPayload<{
  include: {
    type: {
      select: {
        id: true;
        name: true;
        displayName: true;
      };
    };
    _count: {
      select: {
        machines: true;
      };
    };
  };
}>;

type MachineWithModelManufacturer = Prisma.MachineGetPayload<{
  select: {
    model: {
      select: {
        manufacturer: true;
      };
    };
  };
}>;

type CollectionTypeWithCount = Prisma.CollectionTypeGetPayload<{
  include: {
    _count: {
      select: {
        collections: true;
      };
    };
  };
}>;

export class CollectionService {
  constructor(private prisma: ExtendedPrismaClient) {}

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
    // Get all collections in one query to avoid N+1 pattern
    const collections = await this.prisma.collection.findMany({
      where: {
        OR: [
          { locationId }, // Location-specific collections
          { locationId: null, isManual: false }, // Organization-wide auto-collections
        ],
        type: {
          organizationId,
          isEnabled: true,
        },
      },
      include: {
        type: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            machines: {
              where: {
                locationId, // Only count machines at this location
              },
            },
          },
        },
      },
      orderBy: [
        {
          type: {
            sortOrder: "asc",
          },
        },
        {
          sortOrder: "asc",
        },
      ],
    });

    const { manual, auto } = collections.reduce(
      (acc, collection) => {
        const typedCollection = collection as CollectionWithTypeAndCount;
        const collectionData: CollectionWithMachines = {
          id: typedCollection.id,
          name: typedCollection.name,
          type: {
            id: typedCollection.type.id,
            name: typedCollection.type.name,
            displayName: typedCollection.type.displayName,
          },
          machineCount: typedCollection._count.machines,
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
    const machines = await this.prisma.machine.findMany({
      where: {
        locationId,
        collections: {
          some: {
            id: collectionId,
          },
        },
      },
      include: {
        model: true,
      },
      orderBy: {
        model: {
          name: "asc",
        },
      },
    });
    return machines;
  }

  /**
   * Create a manual collection
   */
  createManualCollection(
    organizationId: string,
    data: CreateManualCollectionData,
  ): Promise<Collection> {
    const createData: {
      name: string;
      typeId: string;
      organizationId: string;
      locationId?: string | null;
      description?: string | null;
      isManual: true;
      isSmart: false;
    } = {
      name: data.name,
      typeId: data.typeId,
      organizationId,
      isManual: true,
      isSmart: false,
    };

    if (data.locationId) {
      createData.locationId = data.locationId;
    }

    if (data.description) {
      createData.description = data.description;
    }

    return this.prisma.collection.create({
      data: createData,
    });
  }

  /**
   * Add machines to a manual collection
   */
  async addMachinesToCollection(
    collectionId: string,
    machineIds: string[],
  ): Promise<void> {
    await this.prisma.collection.update({
      where: { id: collectionId },
      data: {
        machines: {
          connect: machineIds.map((id) => ({ id })),
        },
      },
    });
  }

  /**
   * Generate auto-collections for an organization
   */
  async generateAutoCollections(organizationId: string): Promise<{
    generated: number;
    updated: number;
  }> {
    const autoTypes = await this.prisma.collectionType.findMany({
      where: {
        organizationId,
        isAutoGenerated: true,
        isEnabled: true,
      },
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
    const machines = await this.prisma.machine.findMany({
      where: {
        organizationId: collectionType.organizationId,
        model: {
          manufacturer: {
            not: null,
          },
        },
      },
      select: {
        model: {
          select: {
            manufacturer: true,
          },
        },
      },
      distinct: ["modelId"],
    });

    const uniqueManufacturers = Array.from(
      new Set(
        (machines as unknown as MachineWithModelManufacturer[])
          .map((m) => m.model.manufacturer)
          .filter((m): m is string => m !== null),
      ),
    );

    let generated = 0;
    let updated = 0;

    for (const manufacturer of uniqueManufacturers) {
      // Check if collection already exists
      const existing = await this.prisma.collection.findFirst({
        where: {
          name: manufacturer,
          typeId: collectionType.id,
          locationId: null, // Organization-wide
        },
      });

      if (!existing) {
        // Create new collection
        const collection = await this.prisma.collection.create({
          data: {
            name: manufacturer,
            typeId: collectionType.id,
            locationId: null,
            isManual: false,
            isSmart: false,
            filterCriteria: { manufacturer } as Prisma.JsonObject,
          },
        });

        // Add all machines with this manufacturer
        const machines = await this.prisma.machine.findMany({
          where: {
            organizationId: collectionType.organizationId,
            model: {
              manufacturer,
            },
          },
          select: { id: true },
        });

        await this.prisma.collection.update({
          where: { id: collection.id },
          data: {
            machines: {
              connect: machines.map((m) => ({ id: m.id })),
            },
          },
        });

        generated++;
      } else {
        // Update existing collection with new machines
        const machines = await this.prisma.machine.findMany({
          where: {
            organizationId: collectionType.organizationId,
            model: {
              manufacturer,
            },
          },
          select: { id: true },
        });

        await this.prisma.collection.update({
          where: { id: existing.id },
          data: {
            machines: {
              set: machines.map((m) => ({ id: m.id })),
            },
          },
        });

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
      const existing = await this.prisma.collection.findFirst({
        where: {
          name: era.name,
          typeId: collectionType.id,
          locationId: null,
        },
      });

      const machines = await this.prisma.machine.findMany({
        where: {
          organizationId: collectionType.organizationId,
          model: {
            year: {
              gte: era.start,
              lte: era.end,
            },
          },
        },
        select: { id: true },
      });

      if (machines.length === 0) continue; // Skip empty eras

      if (!existing) {
        const collection = await this.prisma.collection.create({
          data: {
            name: era.name,
            typeId: collectionType.id,
            locationId: null,
            isManual: false,
            isSmart: false,
            filterCriteria: {
              yearStart: era.start,
              yearEnd: era.end,
            } as Prisma.JsonObject,
          },
        });

        await this.prisma.collection.update({
          where: { id: collection.id },
          data: {
            machines: {
              connect: machines.map((m) => ({ id: m.id })),
            },
          },
        });

        generated++;
      } else {
        await this.prisma.collection.update({
          where: { id: existing.id },
          data: {
            machines: {
              set: machines.map((m) => ({ id: m.id })),
            },
          },
        });

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
    await this.prisma.collectionType.update({
      where: { id: collectionTypeId },
      data: { isEnabled: enabled },
    });
  }

  /**
   * Get organization's collection types for admin management
   */
  async getOrganizationCollectionTypes(
    organizationId: string,
  ): Promise<CollectionTypeWithCount[]> {
    const types: CollectionTypeWithCount[] =
      await this.prisma.collectionType.findMany({
        where: { organizationId },
        include: {
          _count: {
            select: {
              collections: true,
            },
          },
        },
        orderBy: {
          sortOrder: "asc",
        },
      });

    return types.map((type) => ({
      ...type,
      collectionCount: type._count.collections,
    }));
  }
}
