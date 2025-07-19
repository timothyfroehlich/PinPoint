import type { DeepMockProxy } from "jest-mock-extended";
import type { ServiceFactory } from "~/server/services/factory";

export function mockServiceMethod<
  T extends keyof ServiceFactory,
  M extends keyof ReturnType<ServiceFactory[T]>,
>(
  services: DeepMockProxy<ServiceFactory>,
  serviceName: T,
  methodName: M,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  implementation?: (...args: any[]) => unknown,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = services[serviceName]() as any;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = (services[key as keyof ServiceFactory] as any)();
      for (const method in service) {
        if (typeof service[method] === "function") {
          (service[method] as jest.Mock).mockClear();
        }
      }
    }
  }
}
