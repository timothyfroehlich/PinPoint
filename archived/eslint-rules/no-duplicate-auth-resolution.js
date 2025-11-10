/**
 * ESLint rule to prevent duplicate authentication resolution calls
 * Prevents multiple auth function calls within the same function scope
 */

const AUTH_FUNCTIONS = [
  "requireMemberAccess",
  "requireOrganizationContext",
  "getOrganizationContext",
  "getRequestAuthContext",
  "requireSupabaseUserContext",
  "getUserWithOrganization",
  "getActionAuthContext",
  "getServerAuthContext",
  "getDALAuthContext",
  "requireActionAuthContextWithPermission",
  "getUploadAuthContext",
  "ensureOrgContextAndBindRLS",
];

const ALLOWED_FILES = [
  "**/legacy-adapters.ts",
  "**/legacy-inventory.ts",
  "**/organization-context.ts", // Contains adapter exports
  "**/*.test.ts",
  "**/*.spec.ts",
  "**/shared.ts", // Action/DAL shared files may need multiple patterns
];

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent duplicate authentication resolution calls within the same function",
      category: "Possible Errors",
    },
    fixable: null,
    schema: [],
    messages: {
      duplicateAuthResolution:
        'Multiple authentication calls detected in function "{{functionName}}". Found: {{authCalls}}. Use a single auth call and store the result.',
    },
  },

  create(context) {
    const filename = context.getFilename();

    // Skip allowed files
    if (
      ALLOWED_FILES.some((pattern) =>
        filename.includes(pattern.replace("**/", "")),
      )
    ) {
      return {};
    }

    const functionStack = [];
    const authCallsPerFunction = new Map();

    function getCurrentFunction() {
      return functionStack[functionStack.length - 1];
    }

    function trackAuthCall(node, authFunctionName) {
      const currentFunction = getCurrentFunction();
      if (!currentFunction) return;

      const functionKey = `${currentFunction.name}:${currentFunction.start}`;
      const authCalls = authCallsPerFunction.get(functionKey) || [];
      authCalls.push({
        name: authFunctionName,
        node,
        line: node.loc.start.line,
      });
      authCallsPerFunction.set(functionKey, authCalls);
    }

    function checkForDuplicates(functionNode) {
      const functionKey = `${functionNode.name}:${functionNode.start}`;
      const authCalls = authCallsPerFunction.get(functionKey) || [];

      if (authCalls.length > 1) {
        const callNames = authCalls.map((call) => call.name);
        // Multiple calls detected - report violation

        // Report if we have multiple different auth functions OR multiple calls to same function
        if (authCalls.length > 1) {
          context.report({
            node: functionNode.node,
            messageId: "duplicateAuthResolution",
            data: {
              functionName: functionNode.name || "anonymous",
              authCalls: callNames.join(", "),
            },
          });
        }
      }
    }

    return {
      // Function declarations
      FunctionDeclaration(node) {
        const functionInfo = {
          name: node.id?.name || "anonymous",
          node,
          start: node.range[0],
        };
        functionStack.push(functionInfo);
      },

      "FunctionDeclaration:exit"() {
        const functionInfo = functionStack.pop();
        checkForDuplicates(functionInfo);
      },

      // Arrow functions
      ArrowFunctionExpression(node) {
        const parent = node.parent;
        let functionName = "anonymous";

        if (parent.type === "VariableDeclarator" && parent.id) {
          functionName = parent.id.name;
        } else if (parent.type === "Property" && parent.key) {
          functionName = parent.key.name;
        }

        const functionInfo = {
          name: functionName,
          node,
          start: node.range[0],
        };
        functionStack.push(functionInfo);
      },

      "ArrowFunctionExpression:exit"() {
        const functionInfo = functionStack.pop();
        checkForDuplicates(functionInfo);
      },

      // Function expressions
      FunctionExpression(node) {
        const functionInfo = {
          name: node.id?.name || "anonymous",
          node,
          start: node.range[0],
        };
        functionStack.push(functionInfo);
      },

      "FunctionExpression:exit"() {
        const functionInfo = functionStack.pop();
        checkForDuplicates(functionInfo);
      },

      // Call expressions - track auth function calls
      CallExpression(node) {
        let calleeName = null;

        // Direct function call: authFunction()
        if (node.callee.type === "Identifier") {
          calleeName = node.callee.name;
        }
        // Method call: object.authFunction() or await authFunction()
        else if (
          node.callee.type === "MemberExpression" &&
          node.callee.property
        ) {
          calleeName = node.callee.property.name;
        }

        if (calleeName && AUTH_FUNCTIONS.includes(calleeName)) {
          trackAuthCall(node, calleeName);
        }
      },

      // Note: AwaitExpression handler removed to avoid double-counting
      // CallExpression already handles both direct calls and awaited calls
    };
  },
};
