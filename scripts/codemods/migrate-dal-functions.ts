#!/usr/bin/env tsx
/**
 * JSCodeshift codemod to migrate DAL functions from ensureOrgContextAndBindRLS to explicit organizationId pattern
 * 
 * Usage:
 *   npx jscodeshift -t scripts/codemods/migrate-dal-functions.ts src/lib/dal/users.ts
 *   npx jscodeshift -t scripts/codemods/migrate-dal-functions.ts src/lib/dal/*.ts
 * 
 * Transforms:
 * - Functions using ensureOrgContextAndBindRLS -> withOrgRLS pattern
 * - Adds organizationId: string parameters where needed
 * - Updates imports
 * - Replaces context.organization.id references
 */

import type {
  Transform,
  FileInfo,
  API,
  Collection,
  JSCodeshift,
  CallExpression,
  ArrowFunctionExpression,
  FunctionDeclaration,
  VariableDeclarator,
  ImportDeclaration,
  StringLiteral,
  Identifier,
  BlockStatement,
  ReturnStatement,
  AwaitExpression,
} from 'jscodeshift';

const transform: Transform = (fileInfo: FileInfo, api: API) => {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // Track changes to determine if we need to update imports
  let hasChanges = false;
  let needsWithOrgRLS = false;
  let needsDb = false;

  // Helper to check if a function already has organizationId parameter
  function hasOrganizationIdParam(params: any[]): boolean {
    return params.some((param: any) => {
      if (param.type === 'Identifier') {
        return param.name === 'organizationId';
      }
      if (param.type === 'ObjectPattern') {
        return param.properties?.some((prop: any) => 
          prop.key?.name === 'organizationId' || prop.value?.name === 'organizationId'
        );
      }
      return false;
    });
  }

  // Helper to create organizationId parameter
  function createOrganizationIdParam() {
    return j.identifier.from({
      name: 'organizationId',
      typeAnnotation: j.tsTypeAnnotation(j.tsStringKeyword())
    });
  }

  // Helper to get the function's existing parameters
  function getFunctionParams(node: any): any[] {
    if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration') {
      return node.params || [];
    }
    return [];
  }

  // Transform cache() calls that contain ensureOrgContextAndBindRLS
  root.find(j.CallExpression, {
    callee: { name: 'cache' }
  }).forEach(cachePath => {
    const cacheArg = cachePath.value.arguments[0];
    
    if (!cacheArg || cacheArg.type !== 'ArrowFunctionExpression') {
      return;
    }

    // Look for ensureOrgContextAndBindRLS call in the arrow function body
    const arrowFunction = cacheArg as ArrowFunctionExpression;
    
    // Check if the body contains a return statement with ensureOrgContextAndBindRLS
    if (arrowFunction.body?.type === 'BlockStatement') {
      const blockStatement = arrowFunction.body as BlockStatement;
      const returnStatement = blockStatement.body.find(stmt => stmt.type === 'ReturnStatement') as ReturnStatement;
      
      if (returnStatement?.argument?.type === 'CallExpression') {
        const callExpr = returnStatement.argument as CallExpression;
        
        if (callExpr.callee?.type === 'Identifier' && callExpr.callee.name === 'ensureOrgContextAndBindRLS') {
          migrateEnsureOrgContextCall(cachePath, arrowFunction, callExpr, returnStatement);
        }
      }
    } else if (arrowFunction.body?.type === 'CallExpression') {
      // Handle direct return of ensureOrgContextAndBindRLS call
      const callExpr = arrowFunction.body as CallExpression;
      
      if (callExpr.callee?.type === 'Identifier' && callExpr.callee.name === 'ensureOrgContextAndBindRLS') {
        migrateDirectEnsureOrgContextCall(cachePath, arrowFunction, callExpr);
      }
    }
  });

  // Helper function to migrate ensureOrgContextAndBindRLS calls within return statements
  function migrateEnsureOrgContextCall(
    cachePath: any,
    arrowFunction: ArrowFunctionExpression,
    ensureCall: CallExpression,
    returnStatement: ReturnStatement
  ) {
    const innerCallback = ensureCall.arguments[0];
    if (!innerCallback || (innerCallback.type !== 'ArrowFunctionExpression' && innerCallback.type !== 'FunctionExpression')) {
      return;
    }

    // Add organizationId parameter to the outer function if it doesn't have one
    const existingParams = getFunctionParams(arrowFunction);
    if (!hasOrganizationIdParam(existingParams)) {
      arrowFunction.params.push(createOrganizationIdParam());
    }

    // Transform the ensureOrgContextAndBindRLS call to withOrgRLS
    const newCall = j.callExpression(
      j.identifier('withOrgRLS'),
      [
        j.identifier('db'),
        j.identifier('organizationId'),
        transformInnerCallback(innerCallback)
      ]
    );

    // Replace the return statement
    returnStatement.argument = newCall;
    
    hasChanges = true;
    needsWithOrgRLS = true;
    needsDb = true;
  }

  // Helper function to migrate direct ensureOrgContextAndBindRLS calls
  function migrateDirectEnsureOrgContextCall(
    cachePath: any,
    arrowFunction: ArrowFunctionExpression,
    ensureCall: CallExpression
  ) {
    const innerCallback = ensureCall.arguments[0];
    if (!innerCallback || (innerCallback.type !== 'ArrowFunctionExpression' && innerCallback.type !== 'FunctionExpression')) {
      return;
    }

    // Add organizationId parameter to the outer function if it doesn't have one
    const existingParams = getFunctionParams(arrowFunction);
    if (!hasOrganizationIdParam(existingParams)) {
      arrowFunction.params.push(createOrganizationIdParam());
    }

    // Transform the ensureOrgContextAndBindRLS call to withOrgRLS
    const newCall = j.callExpression(
      j.identifier('withOrgRLS'),
      [
        j.identifier('db'),
        j.identifier('organizationId'),
        transformInnerCallback(innerCallback)
      ]
    );

    // Replace the entire body
    arrowFunction.body = newCall;
    
    hasChanges = true;
    needsWithOrgRLS = true;
    needsDb = true;
  }

  // Transform the inner callback to remove context parameter and replace context.organization.id
  function transformInnerCallback(callback: any) {
    if (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression') {
      // Update parameters: (tx, context) => ... becomes (tx) => ...
      if (callback.params.length >= 2) {
        callback.params = [callback.params[0]]; // Keep only tx parameter
      }

      // Replace context.organization.id with organizationId in the callback body
      const callbackRoot = j(callback);
      
      // Handle variable declarations like: const organizationId = context.organization.id;
      callbackRoot.find(j.VariableDeclarator, {
        id: { name: 'organizationId' },
        init: {
          type: 'MemberExpression',
          object: {
            type: 'MemberExpression',
            object: { name: 'context' },
            property: { name: 'organization' }
          },
          property: { name: 'id' }
        }
      }).forEach(path => {
        // Remove the entire variable declaration since organizationId is now a parameter
        const declarationPath = path.parent;
        if (declarationPath?.value?.type === 'VariableDeclaration') {
          const declarations = declarationPath.value.declarations;
          if (declarations.length === 1) {
            // Remove the entire variable declaration
            j(declarationPath).remove();
          } else {
            // Remove just this declarator
            j(path).remove();
          }
        }
      });

      // Handle member expressions like context.organization.id
      callbackRoot.find(j.MemberExpression, {
        object: {
          type: 'MemberExpression',
          object: { name: 'context' },
          property: { name: 'organization' }
        },
        property: { name: 'id' }
      }).replaceWith(j.identifier('organizationId'));

      // Handle direct context.organization access that might be used elsewhere
      callbackRoot.find(j.MemberExpression, {
        object: { name: 'context' },
        property: { name: 'organization' }
      }).forEach(path => {
        // Only replace if it's being used to access .id
        const parent = path.parent;
        if (parent?.value?.type === 'MemberExpression' && parent.value.property?.name === 'id') {
          // This will be handled by the previous find/replace
          return;
        } else {
          // Log this case for manual review
          console.warn(`Warning: Found context.organization usage that may need manual review in ${fileInfo.path}`);
        }
      });

      // Also handle context.user checks - these need to be removed or replaced
      callbackRoot.find(j.MemberExpression, {
        object: { name: 'context' },
        property: { name: 'user' }
      }).forEach(path => {
        console.warn(`Warning: Found context.user usage that needs manual migration in ${fileInfo.path}`);
        console.warn(`  Line: ${path.value.loc?.start.line || 'unknown'}`);
        console.warn(`  This will need manual review - consider removing auth checks or handling differently`);
      });
    }

    return callback;
  }

  // Update imports if changes were made
  if (hasChanges) {
    // Remove ensureOrgContextAndBindRLS import
    root.find(j.ImportDeclaration)
      .filter(path => path.value.source.value === '~/lib/organization-context')
      .forEach(path => {
        const importDecl = path.value;
        if (importDecl.specifiers) {
          // Remove ensureOrgContextAndBindRLS from the import
          importDecl.specifiers = importDecl.specifiers.filter(spec => {
            if (spec.type === 'ImportSpecifier' && spec.imported?.name === 'ensureOrgContextAndBindRLS') {
              return false;
            }
            return true;
          });

          // If no specifiers remain, remove the entire import
          if (importDecl.specifiers.length === 0) {
            j(path).remove();
          }
        }
      });

    // Add withOrgRLS import if needed
    if (needsWithOrgRLS) {
      const existingRLSImport = root.find(j.ImportDeclaration)
        .filter(path => path.value.source.value === '~/server/db/utils/rls')
        .at(0);

      if (existingRLSImport.length > 0) {
        // Add withOrgRLS to existing import
        const importDecl = existingRLSImport.get().value;
        const hasWithOrgRLS = importDecl.specifiers?.some(spec => 
          spec.type === 'ImportSpecifier' && spec.imported?.name === 'withOrgRLS'
        );

        if (!hasWithOrgRLS) {
          importDecl.specifiers?.push(
            j.importSpecifier(j.identifier('withOrgRLS'))
          );
        }
      } else {
        // Create new import for withOrgRLS
        const newImport = j.importDeclaration(
          [j.importSpecifier(j.identifier('withOrgRLS'))],
          j.literal('~/server/db/utils/rls')
        );

        // Insert after the last import
        const lastImport = root.find(j.ImportDeclaration).at(-1);
        if (lastImport.length > 0) {
          lastImport.insertAfter(newImport);
        } else {
          // Insert at the beginning if no imports exist
          root.get().node.body.unshift(newImport);
        }
      }
    }

    // Add db import if needed
    if (needsDb) {
      const existingSharedImport = root.find(j.ImportDeclaration)
        .filter(path => path.value.source.value === './shared')
        .at(0);

      if (existingSharedImport.length > 0) {
        // Add db to existing import from ./shared
        const importDecl = existingSharedImport.get().value;
        const hasDb = importDecl.specifiers?.some(spec => 
          spec.type === 'ImportSpecifier' && spec.imported?.name === 'db'
        );

        if (!hasDb) {
          importDecl.specifiers?.push(
            j.importSpecifier(j.identifier('db'))
          );
        }
      } else {
        // Check if db is imported from elsewhere
        const existingDbImport = root.find(j.ImportDeclaration)
          .filter(path => {
            return path.value.specifiers?.some(spec => 
              spec.type === 'ImportSpecifier' && spec.imported?.name === 'db'
            );
          });

        if (existingDbImport.length === 0) {
          // Create new import for db
          const newImport = j.importDeclaration(
            [j.importSpecifier(j.identifier('db'))],
            j.literal('./shared')
          );

          // Insert after organization-context import or at appropriate location
          const orgContextImport = root.find(j.ImportDeclaration)
            .filter(path => path.value.source.value === '~/lib/organization-context')
            .at(0);

          if (orgContextImport.length > 0) {
            orgContextImport.insertAfter(newImport);
          } else {
            const lastImport = root.find(j.ImportDeclaration).at(-1);
            if (lastImport.length > 0) {
              lastImport.insertAfter(newImport);
            } else {
              root.get().node.body.unshift(newImport);
            }
          }
        }
      }
    }
  }

  return hasChanges ? root.toSource({ quote: 'double' }) : null;
};

export default transform;