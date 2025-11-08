import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const machinesFindFirstMock = vi.fn();
const organizationsFindFirstMock = vi.fn();

vi.mock("~/server/db/provider", () => ({
  getGlobalDatabaseProvider: () => ({
    getClient: () => ({
      query: {
        machines: {
          findFirst: machinesFindFirstMock,
        },
        organizations: {
          findFirst: organizationsFindFirstMock,
        },
      },
    }),
  }),
}));

describe("getPublicMachineById", () => {
  beforeEach(() => {
    vi.resetModules();
    machinesFindFirstMock.mockReset();
    organizationsFindFirstMock.mockReset();
  });

  it("returns machine when visibility is inherited from a public location", async () => {
    machinesFindFirstMock.mockResolvedValue({
      id: "machine-1",
      name: "Medieval Madness",
      model_id: "model-1",
      location_id: "location-1",
      is_public: null,
      model: {
        id: "model-1",
        name: "Medieval Madness",
        manufacturer: "Williams",
        year: 1997,
      },
      location: {
        id: "location-1",
        name: "Main Floor",
        organization_id: "org-1",
        is_public: true,
      },
      organization: {
        id: "org-1",
        is_public: true,
        allow_anonymous_issues: true,
      },
    });
    organizationsFindFirstMock.mockResolvedValue({
      is_public: true,
      allow_anonymous_issues: true,
    });

    const { getPublicMachineById } = await import("./public-machines");
    const machine = await getPublicMachineById("machine-1");

    expect(machine).not.toBeNull();
    expect(machine?.id).toBe("machine-1");
    expect(machine?.location.name).toBe("Main Floor");
  });
});
