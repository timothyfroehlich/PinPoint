import { createPrismaClient } from "../../db";
import { DatabaseProvider } from "../provider";

jest.mock("../../db", () => ({
  createPrismaClient: jest.fn().mockReturnValue({
    $disconnect: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe("DatabaseProvider", () => {
  let provider: DatabaseProvider;

  beforeEach(() => {
    provider = new DatabaseProvider();
    jest.clearAllMocks();
  });

  it("should create a new Prisma client instance on first call", () => {
    const client = provider.getClient();
    expect(client).toBeDefined();
    expect(createPrismaClient).toHaveBeenCalledTimes(1);
  });

  it("should return the same instance on subsequent calls", () => {
    const client1 = provider.getClient();
    const client2 = provider.getClient();
    expect(client1).toBe(client2);
    expect(createPrismaClient).toHaveBeenCalledTimes(1);
  });

  it("should disconnect the instance", async () => {
    const client = provider.getClient();
    await provider.disconnect();
    expect(client.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("should reset the instance", () => {
    provider.getClient();
    provider.reset();
    provider.getClient();
    expect(createPrismaClient).toHaveBeenCalledTimes(2);
  });
});
