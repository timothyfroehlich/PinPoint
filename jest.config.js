export default {
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
      transformIgnorePatterns: ["node_modules/(?!(superjson|@trpc|@t3-oss|next-auth|@auth))"],
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
      transformIgnorePatterns: ["node_modules/(?!(superjson|@trpc|@t3-oss|next-auth|@auth))"],
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
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  testTimeout: 10000,
};
