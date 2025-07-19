import type { DeepMockProxy } from "jest-mock-extended";
import type { ServiceFactory } from "~/server/services/factory";

export function mockServiceMethod<
  T extends keyof ServiceFactory,
  M extends keyof ReturnType<ServiceFactory[T]>,
>(
  services: DeepMockProxy<ServiceFactory>,
  serviceName: T,
  methodName: M,
  implementation?: (...args: any[]) => any,
): jest.Mock {
  const serviceFactory = services[serviceName] as jest.Mock;
  const service = serviceFactory() as ReturnType<ServiceFactory[T]>;
  const method = service[methodName] as jest.Mock;
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
    const serviceKey = key as keyof ServiceFactory;
    if (typeof services[serviceKey] === "function") {
      const serviceFactory = services[serviceKey] as jest.Mock;
      if (jest.isMockFunction(serviceFactory) && serviceFactory.mock.calls.length > 0) {
        const service = serviceFactory() as Record<string, unknown>;
        for (const method in service) {
          if (jest.isMockFunction(service[method])) {
            (service[method] as jest.Mock).mockClear();
          }
        }
      }
    }
  }
}
