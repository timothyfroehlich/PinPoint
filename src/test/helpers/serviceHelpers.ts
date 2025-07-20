import type { DeepMockProxy } from "jest-mock-extended";
import type { ServiceFactory } from "~/server/services/factory";

export function mockServiceMethod<T extends keyof ServiceFactory>(
  services: DeepMockProxy<ServiceFactory>,
  serviceName: T,
  methodName: keyof ReturnType<ServiceFactory[T]>,
  implementation?: (...args: unknown[]) => unknown,
): jest.MockedFunction<(...args: unknown[]) => unknown> {
  const service = services[serviceName]() as unknown as Record<string, unknown>;
  const method = service[methodName as string] as jest.MockedFunction<
    (...args: unknown[]) => unknown
  >;
  if (implementation) {
    method.mockImplementation(implementation);
  }
  return method;
}

// Helper to reset all service mocks
export function resetAllServiceMocks(
  services: DeepMockProxy<ServiceFactory>,
): void {
  for (const key in services) {
    if (typeof services[key as keyof ServiceFactory] === "function") {
      const service = (
        services[key as keyof ServiceFactory] as unknown as () => Record<
          string,
          unknown
        >
      )();
      for (const method in service) {
        if (jest.isMockFunction(service[method])) {
          (
            service[method] as unknown as jest.MockedFunction<
              (...args: unknown[]) => unknown
            >
          ).mockClear();
        }
      }
    }
  }
}
