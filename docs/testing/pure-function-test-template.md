# Pure Function Test Template

## Standard Structure

```typescript
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import {
  testValidationFunction,
  testFunctionWithScenarios,
  testErrorFunction,
  TEST_SCENARIOS,
  customMatchers,
} from "~/test/helpers/pure-function-test-utils";
import { functionUnderTest } from "../moduleUnderTest";

// Add custom matchers if needed
expect.extend(customMatchers);

describe("Module Under Test", () => {
  describe("functionUnderTest", () => {
    // For validation functions
    testValidationFunction(
      functionUnderTest,
      TEST_SCENARIOS.validInputs,
      TEST_SCENARIOS.invalidInputs,
    );

    // For transformation functions
    testFunctionWithScenarios(functionUnderTest, [
      { input: "input1", expected: "output1", description: "handles case 1" },
      { input: "input2", expected: "output2", description: "handles case 2" },
    ]);

    // For error cases
    testErrorFunction(functionUnderTest, [
      { input: "badInput", expectedError: "Expected error message" },
    ]);

    // Custom edge cases
    test("handles specific business logic", () => {
      const result = functionUnderTest(SEED_TEST_IDS.ORGANIZATIONS.primary);
      expect(result).toBe("expected-value");
    });
  });
});
```
