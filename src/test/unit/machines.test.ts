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
    it("should watch if not already watching", async () => {
      vi.mocked(db.query.machineWatchers.findFirst).mockResolvedValue(
        undefined
      );

      const result = await toggleMachineWatcher({ machineId, userId });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isWatching).toBe(true);
        expect(result.value.watchMode).toBe("notify");
      }
      expect(db.insert).toHaveBeenCalled();
      expect(chain.values).toHaveBeenCalledWith({
        machineId,
        userId,
        watchMode: "notify",
      });
    });

    it("should unwatch if already watching", async () => {
      vi.mocked(db.query.machineWatchers.findFirst).mockResolvedValue({
        watchMode: "subscribe",
      } as any);

      const result = await toggleMachineWatcher({ machineId, userId });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isWatching).toBe(false);
        expect(result.value.watchMode).toBe("subscribe");
      }
      expect(db.delete).toHaveBeenCalled();
    });

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
    it("should update watch mode successfully", async () => {
      chain.returning.mockResolvedValue([{ userId, machineId }]);

      const result = await updateMachineWatchMode({
        machineId,
        userId,
        watchMode: "subscribe",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.watchMode).toBe("subscribe");
      }
      expect(db.update).toHaveBeenCalled();
      expect(chain.set).toHaveBeenCalledWith({ watchMode: "subscribe" });
    });

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
