import type { DeepMockProxy } from "jest-mock-extended";
import type { ServiceFactory } from "~/server/services/factory";

export function mockServiceMethod<
  T extends keyof ServiceFactory,
  M extends keyof ReturnType<ServiceFactory[T]>,
>(
  services: DeepMockProxy<ServiceFactory>,
  serviceName: T,
  methodName: M,
  implementation?: (...args: never[]) => unknown,
) {
  const service = services[serviceName]();
  const method = service[methodName] as jest.Mock;
  if (implementation) {
    method.mockImplementation(implementation);
  }
  return method;
}

// Helper to reset all service mocks
export function resetAllServiceMocks(services: DeepMockProxy<ServiceFactory>) {
  for (const key in services) {
    if (typeof services[key as keyof ServiceFactory] === "function") {
      const service = (
        services[key as keyof ServiceFactory] as () => Record<string, unknown>
      )();
      for (const method in service) {
        if (typeof service[method] === "function") {
          (service[method] as jest.Mock).mockClear();
        }
      }
    }
  }
}
