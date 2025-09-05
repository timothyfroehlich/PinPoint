/**
 * ESLint rule: no-duplicate-validation
 * 
 * Prevents inline validation patterns that should use centralized schemas.
 * Enforces consistent use of validation schemas from ~/lib/validation/schemas.
 */

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Prevent duplicate validation patterns that should use centralized schemas",
      category: "Best Practices",
      recommended: true
    },
    fixable: "code",
    hasSuggestions: true,
    schema: []
  },

  create(context) {
    const sourceCode = context.getSourceCode();

    /**
     * Check if a CallExpression represents a Zod validation chain
     */
    function isZodValidationChain(node) {
      if (node.type !== 'CallExpression') return false;
      
      // Check for z.string() patterns
      if (node.callee?.type === 'MemberExpression' &&
          node.callee?.object?.type === 'CallExpression' &&
          node.callee?.object?.callee?.type === 'MemberExpression' &&
          node.callee?.object?.callee?.object?.name === 'z' &&
          node.callee?.object?.callee?.property?.name === 'string') {
        return true;
      }
      
      return false;
    }

    /**
     * Extract the validation chain pattern from a node
     */
    function getValidationPattern(node) {
      const text = sourceCode.getText(node);
      return text;
    }

    /**
     * Check if validation should use centralized schema
     */
    function shouldUseCentralizedSchema(validationText) {
      const patterns = [
        {
          pattern: /z\.string\(\)\.min\(1.*?required.*?\)/i,
          schema: 'idSchema',
          import: "import { idSchema } from '~/lib/validation/schemas'"
        },
        {
          pattern: /z\.string\(\)\.min\(1.*?name.*?required.*?\)\.max\(255/i,
          schema: 'nameSchema', 
          import: "import { nameSchema } from '~/lib/validation/schemas'"
        },
        {
          pattern: /z\.string\(\)\.min\(1.*?title.*?required.*?\)\.max\(200/i,
          schema: 'titleSchema',
          import: "import { titleSchema } from '~/lib/validation/schemas'"
        },
        {
          pattern: /z\.string\(\)\.min\(1.*?comment.*?\)\.max\(2000/i,
          schema: 'commentContentSchema',
          import: "import { commentContentSchema } from '~/lib/validation/schemas'"
        },
        {
          pattern: /z\.string\(\)\.email\(/i,
          schema: 'emailSchema',
          import: "import { emailSchema } from '~/lib/validation/schemas'"
        },
        {
          pattern: /z\.string\(\).*?uuid/i,
          schema: 'uuidSchema',
          import: "import { uuidSchema } from '~/lib/validation/schemas'"
        }
      ];

      return patterns.find(p => p.pattern.test(validationText));
    }


    return {
      CallExpression(node) {
        // Skip if this is in the centralized validation files
        const filename = context.getFilename();
        if (filename.includes('lib/validation') || filename.includes('inputValidation')) {
          return;
        }

        if (isZodValidationChain(node)) {
          const validationText = getValidationPattern(node);
          const centralizedMatch = shouldUseCentralizedSchema(validationText);
          
          if (centralizedMatch) {
            context.report({
              node,
              message: `Use centralized ${centralizedMatch.schema} instead of inline validation pattern`,
              data: {
                schema: centralizedMatch.schema,
                import: centralizedMatch.import
              },
              suggest: [
                {
                  desc: `Replace with ${centralizedMatch.schema}`,
                  fix(fixer) {
                    // Add import if not present
                    const sourceCode = context.getSourceCode();
                    const imports = sourceCode.ast.body.filter(node => node.type === 'ImportDeclaration');
                    const hasImport = imports.some(imp => 
                      imp.source.value === '~/lib/validation/schemas' &&
                      imp.specifiers.some(spec => spec.imported?.name === centralizedMatch.schema)
                    );

                    const fixes = [];
                    
                    if (!hasImport) {
                      // Find the right place to add import
                      const lastImport = imports[imports.length - 1];
                      const insertPoint = lastImport ? lastImport.range[1] : 0;
                      
                      fixes.push(fixer.insertTextAfterRange([insertPoint, insertPoint], 
                        `\n${centralizedMatch.import};`));
                    }
                    
                    // Replace the validation pattern
                    fixes.push(fixer.replaceText(node, centralizedMatch.schema));
                    
                    return fixes;
                  }
                }
              ]
            });
          }
        }
      },

      // Check for hardcoded limits that should use LIMITS constants
      Literal(node) {
        if (typeof node.value === 'number' && node.parent?.type === 'CallExpression') {
          const parentText = sourceCode.getText(node.parent);
          
          if (parentText.includes('.max(') && [200, 255, 320, 2000, 5000].includes(node.value)) {
            const filename = context.getFilename();
            if (filename.includes('lib/validation') || filename.includes('inputValidation')) {
              return;
            }

            context.report({
              node,
              message: `Use LIMITS constant instead of hardcoded limit ${node.value}`,
              suggest: [
                {
                  desc: `Replace with LIMITS constant`,
                  fix(fixer) {
                    const limitName = {
                      200: 'TITLE_MAX',
                      255: 'NAME_MAX', 
                      320: 'EMAIL_MAX',
                      2000: 'COMMENT_MAX',
                      5000: 'DESCRIPTION_MAX'
                    }[node.value];

                    if (limitName) {
                      return [
                        fixer.replaceText(node, `LIMITS.${limitName}`),
                        // Add import if needed
                        fixer.insertTextAfterRange([0, 0], 
                          `import { LIMITS } from '~/lib/validation/schemas';\n`)
                      ];
                    }
                  }
                }
              ]
            });
          }
        }
      }
    };
  }
};