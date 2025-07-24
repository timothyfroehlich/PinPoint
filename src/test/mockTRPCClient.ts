/* eslint-disable @typescript-eslint/no-explicit-any */
import { type AppRouter } from "~/server/api/root";
import { type IssueWithDetails, type Comment, type User } from "~/types/issue";

export type MockTRPCClient = {
  [K in keyof AppRouter]: {
    [P in keyof AppRouter[K]]: {
      [Q in keyof AppRouter[K][P]]:
        | jest.Mock
        | {
            useQuery?: jest.Mock;
            useMutation?: jest.Mock;
            _def?: jest.Mock;
            meta?: jest.Mock;
          };
    };
  };
};

export function createMockTRPCClient(
  mockImplementations: Partial<MockTRPCClient> = {},
): any {
  const defaultMock = {
    issue: {
      core: {
        getById: jest.fn<Promise<any>, [any]>(),
        create: jest.fn<Promise<any>, [any]>(),
        update: jest.fn<Promise<any>, [any]>(),
        updateStatus: jest.fn<Promise<any>, [any]>(),
        assign: jest.fn<Promise<any>, [any]>(),
        close: jest.fn<Promise<any>, [any]>(),
        list: jest.fn<Promise<any>, [any]>(),
      },
      comment: {
        create: jest.fn<Promise<any>, [any]>(),
        list: jest.fn<Promise<any>, [any]>(),
        update: jest.fn<Promise<any>, [any]>(),
        delete: jest.fn<Promise<any>, [any]>(),
      },
      attachment: {
        create: jest.fn<Promise<any>, [any]>(),
        list: jest.fn<Promise<any>, [any]>(),
        delete: jest.fn<Promise<any>, [any]>(),
      },
    },
    user: {
      getProfile: jest.fn<Promise<any>, [any]>(),
      updateProfile: jest.fn<Promise<any>, [any]>(),
      list: jest.fn<Promise<any>, [any]>(),
      getCurrentMembership: {
        useQuery: jest.fn(() => ({
          data: null,
          isLoading: false,
          error: null,
        })),
        _def: jest.fn(),
        meta: jest.fn(),
      },
    },
    organization: {
      getCurrent: jest.fn<Promise<any>, [any]>(),
      getMembers: jest.fn<Promise<any>, [any]>(),
      updateSettings: jest.fn<Promise<any>, [any]>(),
    },
  };

  // Deep merge mock implementations
  const mergedMocks = deepMerge(defaultMock, mockImplementations);

  // Create TRPC client-like object
  return {
    ...mergedMocks,
    useQuery: jest.fn(),
    useMutation: jest.fn(),
    useInfiniteQuery: jest.fn(),
    useUtils: jest.fn(() => ({
      invalidate: jest.fn(),
      setData: jest.fn(),
      getData: jest.fn(),
    })),
  };
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key in source) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(result[key] ?? {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

// Mock tRPC hooks for React components
export const createMockTRPCHooks = (
  mockClient: ReturnType<typeof createMockTRPCClient>,
): {
  useQuery: jest.Mock<any, [any]>;
  useMutation: jest.Mock<any, [any]>;
  useUtils: jest.Mock;
} => ({
  useQuery: jest.fn<any, [any]>((procedure: string, _input?: any) => {
    const keys = procedure.split(".");
    let handler = mockClient;

    for (const key of keys) {
      handler = handler[key];
    }

    return {
      data: undefined,
      error: null,
      isLoading: false,
      isError: false,
      isSuccess: true,
      refetch: jest.fn(),
    };
  }),

  useMutation: jest.fn<any, [any]>((procedure: string) => {
    const keys = procedure.split(".");
    let handler = mockClient;

    for (const key of keys) {
      handler = handler[key];
    }

    return {
      mutate: handler,
      mutateAsync: handler,
      isLoading: false,
      isError: false,
      isSuccess: false,
      error: null,
      data: undefined,
      reset: jest.fn(),
    };
  }),

  useUtils: jest.fn(() => ({
    invalidate: jest.fn(),
    setData: jest.fn(),
    getData: jest.fn(),
  })),
});

// Helper to create issue data factory
export const createMockIssue = (
  overrides: Partial<IssueWithDetails> = {},
): IssueWithDetails => ({
  id: "test-issue-1",
  title: "Test Issue",
  description: "Test description",
  organizationId: "test-org-1",
  machineId: "machine-1",
  statusId: "status-1",
  priorityId: "priority-1",
  status: { id: "status-1", name: "Open", color: "#ff0000", category: "NEW" },
  priority: { id: "priority-1", name: "Medium", color: "#ffa500", order: 2 },
  machine: {
    id: "machine-1",
    name: "Test Machine",
    serialNumber: "TEST123",
    qrCodeId: "qr-123",
    model: {
      id: "model-1",
      name: "Test Game",
      manufacturer: "Test Manufacturer",
      year: 2020,
    },
    location: {
      id: "location-1",
      name: "Test Location",
    },
  },
  createdById: "user-1",
  createdBy: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    image: null,
  },
  assignedTo: null,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  resolvedAt: null,
  comments: [],
  attachments: [],
  activities: [],
  ...overrides,
});

// Helper to create comment data factory
export const createMockComment = (
  overrides: Partial<Comment> = {},
): Comment => ({
  id: "comment-1",
  content: "Test comment",
  author: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    image: null,
  },
  createdBy: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    image: null,
  },
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  ...overrides,
});

// Helper to create user data factory
export const createMockUser = (
  overrides: Partial<
    User & {
      permissions: string[];
      role: { id: string; name: string; permissions: string[] };
    }
  > = {},
): User & {
  permissions: string[];
  role: { id: string; name: string; permissions: string[] };
} => ({
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  image: null,
  permissions: [],
  role: {
    id: "role-1",
    name: "Member",
    permissions: [],
  },
  ...overrides,
});

// Helper to create session data factory
export const createMockSession = (
  overrides: Partial<{
    user: User & { permissions: string[] };
    expires: string;
  }> = {},
): {
  user: User & { permissions: string[] };
  expires: string;
} => ({
  user: createMockUser(),
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  ...overrides,
});
