/**
 * ESLint rule to prevent direct Supabase client usage outside approved wrappers
 * Enforces CORE-SSR-001: Use SSR wrapper and cookie contract
 */

const FORBIDDEN_IMPORTS = [
  {
    module: "@supabase/supabase-js",
    importName: "createClient",
    message:
      "Use createClient from ~/lib/supabase/server for SSR-compatible client per CORE-SSR-001",
  },
  {
    module: "@supabase/auth-helpers-nextjs",
    importName: "*",
    message:
      "auth-helpers-nextjs is deprecated. Use ~/lib/supabase/server createClient() wrapper instead",
  },
];

const ALLOWED_FILES = [
  "**/lib/supabase/server.ts",
  "**/lib/supabase/client.ts",
  "**/*.test.ts",
  "**/*.spec.ts",
  "**/config/**",
  "**/scripts/**",
];

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Prevent direct Supabase client usage, enforce SSR wrapper usage",
      category: "Possible Errors",
    },
    fixable: null,
    schema: [],
    messages: {
      directSupabaseImport: "{{message}}",
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

    return {
      ImportDeclaration(node) {
        const moduleName = node.source.value;

        // Check each forbidden import configuration
        FORBIDDEN_IMPORTS.forEach((forbiddenImport) => {
          if (moduleName === forbiddenImport.module) {
            // Check for specific import names or all imports
            if (forbiddenImport.importName === "*") {
              // Any import from this module is forbidden
              context.report({
                node,
                messageId: "directSupabaseImport",
                data: { message: forbiddenImport.message },
              });
            } else {
              // Check for specific import names
              node.specifiers.forEach((specifier) => {
                let importName = null;

                if (specifier.type === "ImportSpecifier") {
                  importName = specifier.imported.name;
                } else if (specifier.type === "ImportDefaultSpecifier") {
                  importName = "default";
                }

                if (importName === forbiddenImport.importName) {
                  context.report({
                    node: specifier,
                    messageId: "directSupabaseImport",
                    data: { message: forbiddenImport.message },
                  });
                }
              });
            }
          }
        });
      },

      // Also check for dynamic imports
      ImportExpression(node) {
        if (node.source.type === "Literal") {
          const moduleName = node.source.value;

          FORBIDDEN_IMPORTS.forEach((forbiddenImport) => {
            if (moduleName === forbiddenImport.module) {
              context.report({
                node,
                messageId: "directSupabaseImport",
                data: { message: `Dynamic import: ${forbiddenImport.message}` },
              });
            }
          });
        }
      },

      // Check for require() calls (though project uses ES modules)
      CallExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require"
        ) {
          if (
            node.arguments.length > 0 &&
            node.arguments[0].type === "Literal"
          ) {
            const moduleName = node.arguments[0].value;

            FORBIDDEN_IMPORTS.forEach((forbiddenImport) => {
              if (moduleName === forbiddenImport.module) {
                context.report({
                  node,
                  messageId: "directSupabaseImport",
                  data: {
                    message: `CommonJS require: ${forbiddenImport.message}`,
                  },
                });
              }
            });
          }
        }
      },
    };
  },
};
