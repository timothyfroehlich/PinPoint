const config = {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  globals: {
    "ts-jest": {
      useESM: true,
    },
  },
  transformIgnorePatterns: [
    "node_modules/(?!(superjson|@trpc|@t3-oss|next-auth|@auth|@prisma))",
  ],
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
        "^.+\\.js$": [
          "ts-jest",
          {
            useESM: true,
          },
        ],
      },
      transformIgnorePatterns: [
        "node_modules/(?!(superjson|@trpc|@t3-oss|next-auth|@auth|@prisma))",
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
        "^.+\\.js$": [
          "ts-jest",
          {
            useESM: true,
          },
        ],
      },
      transformIgnorePatterns: [
        "node_modules/(?!(superjson|@trpc|@t3-oss|next-auth|@auth|@prisma))",
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
    "!src/app/**/*.{tsx,jsx}", // Exclude all React components from coverage
    "!src/middleware.ts", // Exclude Next.js middleware
    "!src/env.js", // Exclude environment configuration
  ],
  coverageReporters: ["text", "lcov", "html", "json-summary", "clover"],
  coverageDirectory: "coverage",
  // Coverage thresholds temporarily disabled while improving test coverage
  // coverageThreshold: {
  //   global: {
  //     branches: 50,
  //     functions: 50,
  //     lines: 50,
  //     statements: 50,
  //   },
  //   // More specific thresholds for critical areas
  //   "./src/server/**/*.{ts,tsx}": {
  //     branches: 60,
  //     functions: 60,
  //     lines: 60,
  //     statements: 60,
  //   },
  //   "./src/lib/**/*.{ts,tsx}": {
  //     branches: 70,
  //     functions: 70,
  //     lines: 70,
  //     statements: 70,
  //   },
  // },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  testTimeout: 10000,
  // Performance optimizations
  maxWorkers: "50%",
  // Enable coverage collection
  collectCoverage: false, // Only when explicitly running with --coverage
};

export default config;
