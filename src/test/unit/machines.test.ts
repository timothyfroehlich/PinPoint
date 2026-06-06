import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  toggleMachineWatcher,
  updateMachineWatchMode,
} from "~/services/machines";
import { db } from "~/server/db";

// Setup a shared chain for DB mocks
const chain = {
  values: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
  returning: vi.fn(),
} as any;

chain.values.mockReturnValue(chain);
chain.set.mockReturnValue(chain);
chain.where.mockReturnValue(chain);
chain.returning.mockResolvedValue([]);

// Mock DB
vi.mock("~/server/db", () => ({
  db: {
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    query: {
      machineWatchers: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("~/lib/logger", () => ({
  log: {
    error: vi.fn(),
  },
}));

describe("Machines Service", () => {
  const machineId = "machine-123";
  const userId = "user-abc";

  beforeEach(() => {
    vi.clearAllMocks();
    chain.returning.mockResolvedValue([]);
  });

  describe("toggleMachineWatcher", () => {
    it("should handle DB errors gracefully", async () => {
      vi.mocked(db.query.machineWatchers.findFirst).mockRejectedValue(
        new Error("DB Error")
      );

      const result = await toggleMachineWatcher({ machineId, userId });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
      }
    });
  });

  describe("updateMachineWatchMode", () => {
    it("should validate watch mode", async () => {
      const result = await updateMachineWatchMode({
        machineId,
        userId,
        watchMode: "invalid-mode" as any,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
      expect(db.update).not.toHaveBeenCalled();
    });

    it("should handle DB errors gracefully", async () => {
      chain.returning.mockRejectedValue(new Error("DB Error"));

      const result = await updateMachineWatchMode({
        machineId,
        userId,
        watchMode: "subscribe",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
      }
    });
  });
});
