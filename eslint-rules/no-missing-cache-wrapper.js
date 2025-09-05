/**
 * ESLint rule to detect async server functions that should be wrapped in cache()
 * Enforces CORE-PERF-001: Cache server fetchers to prevent duplicate queries
 */

const ALLOWED_FILES = [
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/__tests__/**',
  '**/e2e/**',
  '**/scripts/**',
  '**/config/**',
  '**/shared.ts', // Action/DAL shared files may have utility functions
];

// Function name patterns that should NOT be cached (mutations, actions, etc.)
const MUTATION_PATTERNS = [
  /Action$/,           // Server Actions
  /Mutation$/,         // Mutations
  /^create/,           // Create operations
  /^update/,           // Update operations  
  /^delete/,           // Delete operations
  /^remove/,           // Remove operations
  /^add/,              // Add operations
  /^invite/,           // Invite operations
  /^send/,             // Send operations (emails, etc.)
  /^sign/,             // Sign in/out operations
  /^log(?!.*(get|find|query))/,  // Logging (but not log queries)
  /^track/,            // Tracking operations
  /^bind/,             // Binding operations
  /^ensure/,           // Validation operations
  /^require/,          // Requirement checks
  /^has/,              // Boolean checks (usually not cached)
  /^is/,               // Boolean checks (usually not cached)
];

const CACHE_FUNCTION_NAMES = [
  'cache' // React's cache function
];

const SERVER_DIRECTORIES = [
  'src/lib/dal/',           // Data access layer - should be cached
  'src/server/db/queries/', // Database queries - should be cached
  // Note: Actions are mutations and should NOT be cached
  // Note: Most server/ functions are utilities and may not need caching
];

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Detect async server functions that should use cache() wrapper',
      category: 'Best Practices',
    },
    fixable: null,
    schema: [],
    messages: {
      missingCacheWrapper: 'Async server function "{{functionName}}" should be wrapped in cache() per CORE-PERF-001. Use: export const {{functionName}} = cache(async (...) => { ... });',
      missingCacheImport: 'cache() wrapper used but React cache not imported. Add: import { cache } from "react";',
    },
  },

  create(context) {
    const filename = context.getFilename();
    
    // Skip allowed files
    if (ALLOWED_FILES.some(pattern => 
      filename.includes(pattern.replace('**/', ''))
    )) {
      return {};
    }

    // Only apply to server-side directories
    const isServerFile = SERVER_DIRECTORIES.some(dir => 
      filename.includes(dir.replace('src/', ''))
    );
    
    if (!isServerFile) {
      return {};
    }

    let hasCacheImport = false;
    // Track if cache is imported

    function isCacheWrapped(node) {
      // Check if this is a cache() call
      if (node.type === 'CallExpression') {
        if (node.callee.type === 'Identifier' && 
            CACHE_FUNCTION_NAMES.includes(node.callee.name)) {
          return true;
        }
      }
      
      return false;
    }

    function isAsyncFunction(node) {
      return node.async === true;
    }

    function getFunctionName(node) {
      if (node.id) {
        return node.id.name;
      }
      
      // For arrow functions assigned to variables
      const parent = node.parent;
      if (parent.type === 'VariableDeclarator' && parent.id) {
        return parent.id.name;
      }
      
      return 'anonymous';
    }

    function shouldFunctionBeCached(functionName) {
      // Skip mutations and actions
      return !MUTATION_PATTERNS.some(pattern => pattern.test(functionName));
    }

    function checkAsyncExport(node) {
      // Skip if already wrapped in cache()
      if (node.type === 'ExportNamedDeclaration') {
        if (node.declaration) {
          // export const fn = cache(async () => {})
          if (node.declaration.type === 'VariableDeclaration') {
            const declarator = node.declaration.declarations[0];
            if (declarator && isCacheWrapped(declarator.init)) {
              return; // Already cached
            }
            
            // Check if it's an async function that needs caching
            if (declarator && declarator.init && isAsyncFunction(declarator.init)) {
              const functionName = declarator.id.name;
              if (shouldFunctionBeCached(functionName)) {
                context.report({
                  node: declarator.init,
                  messageId: 'missingCacheWrapper',
                  data: { functionName }
                });
              }
            }
          }
          // export async function fn() {}
          else if (node.declaration.type === 'FunctionDeclaration' && isAsyncFunction(node.declaration)) {
            const functionName = getFunctionName(node.declaration);
            if (shouldFunctionBeCached(functionName)) {
              context.report({
                node: node.declaration,
                messageId: 'missingCacheWrapper',
                data: { functionName }
              });
            }
          }
        }
      }
      
      // Direct variable declarations that are exported
      else if (node.type === 'VariableDeclaration') {
        const declarator = node.declarations[0];
        if (declarator && declarator.init && isAsyncFunction(declarator.init)) {
          // Check if this variable is later exported
          const sourceCode = context.getSourceCode();
          const text = sourceCode.getText();
          const varName = declarator.id.name;
          
          // Simple check for export statements (not perfect but catches most cases)
          if (text.includes(`export { ${varName}`) || text.includes(`export {${varName}`)) {
            if (!isCacheWrapped(declarator.init) && shouldFunctionBeCached(varName)) {
              context.report({
                node: declarator.init,
                messageId: 'missingCacheWrapper',
                data: { functionName: varName }
              });
            }
          }
        }
      }
    }

    return {
      // Track cache imports
      ImportDeclaration(node) {
        if (node.source.value === 'react') {
          const cacheImport = node.specifiers.find(spec => 
            spec.type === 'ImportSpecifier' && spec.imported.name === 'cache'
          );
          if (cacheImport) {
            hasCacheImport = true;
          }
        }
      },

      // Check exported function declarations
      ExportNamedDeclaration(node) {
        checkAsyncExport(node);
      },

      // Check variable declarations that might be exported
      VariableDeclaration(node) {
        // Only check top-level declarations
        const parent = node.parent;
        if (parent.type === 'Program' || parent.type === 'ExportNamedDeclaration') {
          checkAsyncExport(node);
        }
      },

      // Check if cache is used but not imported
      'CallExpression[callee.name="cache"]'(node) {
        if (!hasCacheImport) {
          context.report({
            node,
            messageId: 'missingCacheImport'
          });
        }
      }
    };
  },
};