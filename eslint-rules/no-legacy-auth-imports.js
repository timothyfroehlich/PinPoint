/**
 * ESLint rule to prevent legacy authentication function imports
 * Enforces Phase 1 auth consolidation
 */

const LEGACY_FUNCTIONS = [
  'requireMemberAccess',
  'requireOrganizationContext', 
  'getOrganizationContext',
  'ensureOrgContextAndBindRLS'
];

const ALLOWED_FILES = [
  '**/legacy-adapters.ts',
  '**/legacy-inventory.ts',
];

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow imports of legacy authentication functions',
      category: 'Possible Errors',
    },
    fixable: null,
    schema: [],
    messages: {
      legacyAuthImport: 'Legacy authentication function "{{functionName}}" should not be imported. Use getRequestAuthContext() instead.',
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

    return {
      ImportSpecifier(node) {
        if (LEGACY_FUNCTIONS.includes(node.imported.name)) {
          context.report({
            node,
            messageId: 'legacyAuthImport',
            data: {
              functionName: node.imported.name,
            },
          });
        }
      },
    };
  },
};