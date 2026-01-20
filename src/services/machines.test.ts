import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockDeep, mockReset, type DeepMockProxy } from "vitest-mock-extended";
import { toggleMachineWatcher } from "./machines";
import { db } from "~/server/db";

vi.mock("~/server/db", () => ({
  db: mockDeep(),
}));

const mockDb = db as unknown as DeepMockProxy<typeof db>;

describe("machines service", () => {
  beforeEach(() => {
    mockReset(mockDb);
  });

  describe("toggleMachineWatcher", () => {
    it("should add user as watcher if not already watching", async () => {
      const machineId = "machine-123";
      const userId = "user-456";

      // Mock: user is not already watching
      mockDb.query.machineWatchers.findFirst.mockResolvedValue(undefined);

      const insertMock = vi.fn().mockResolvedValue(undefined);
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue(undefined),
      } as unknown as ReturnType<typeof db.insert>);

      const result = await toggleMachineWatcher({ machineId, userId });

      expect(result.isWatching).toBe(true);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("should remove user as watcher if already watching", async () => {
      const machineId = "machine-123";
      const userId = "user-456";

      // Mock: user is already watching
      mockDb.query.machineWatchers.findFirst.mockResolvedValue({
        machineId,
        userId,
      });

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      } as unknown as ReturnType<typeof db.delete>);

      const result = await toggleMachineWatcher({ machineId, userId });

      expect(result.isWatching).toBe(false);
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
