const config = {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  projects: [
    {
      displayName: "node",
      testEnvironment: "node",
      testMatch: [
        "<rootDir>/src/server/**/__tests__/**/*.test.{js,ts}",
        "<rootDir>/src/lib/**/__tests__/**/*.test.{js,ts}",
        "<rootDir>/src/app/api/**/__tests__/**/*.test.{js,ts}",
      ],
      setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
      transform: {
        "^.+\\.(ts|tsx)$": [
          "ts-jest",
          {
            useESM: true,
          },
        ],
      },
      transformIgnorePatterns: [
        "node_modules/(?!(superjson|@trpc|@t3-oss|next-auth|@auth))",
      ],
      moduleNameMapper: {
        "^~/(.*)$": "<rootDir>/src/$1",
      },
    },
    {
      displayName: "jsdom",
      testEnvironment: "jsdom",
      testMatch: [
        "<rootDir>/src/app/**/__tests__/**/*.test.{js,ts,tsx}",
        "<rootDir>/src/lib/hooks/**/__tests__/**/*.test.{js,ts,tsx}",
      ],
      setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
      transform: {
        "^.+\\.(ts|tsx)$": [
          "ts-jest",
          {
            useESM: true,
          },
        ],
      },
      transformIgnorePatterns: [
        "node_modules/(?!(superjson|@trpc|@t3-oss|next-auth|@auth))",
      ],
      moduleNameMapper: {
        "^~/(.*)$": "<rootDir>/src/$1",
      },
    },
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/__tests__/**",
    "!src/test/**",
    "!src/_archived_frontend/**",
    "!src/app/**/page.tsx", // Exclude Next.js page components (mostly UI)
    "!src/app/**/layout.tsx", // Exclude Next.js layout components
    "!src/app/**/loading.tsx", // Exclude Next.js loading components
    "!src/app/**/error.tsx", // Exclude Next.js error components
    "!src/app/**/not-found.tsx", // Exclude Next.js not-found components
    "!src/middleware.ts", // Exclude Next.js middleware
    "!src/env.js", // Exclude environment configuration
  ],
  coverageReporters: ["text", "lcov", "html", "json-summary", "clover"],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
    // More specific thresholds for critical areas
    "./src/server/**/*.{ts,tsx}": {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
    "./src/lib/**/*.{ts,tsx}": {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testTimeout: 10000,
  // Performance optimizations
  maxWorkers: "50%",
  // Enable coverage collection
  collectCoverage: false, // Only when explicitly running with --coverage
};

export default config;
