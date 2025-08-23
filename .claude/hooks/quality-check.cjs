#!/usr/bin/env node
/**
 * React App Quality Check Hook
 * Optimized for React applications with sensible defaults
 *
 * EXIT CODES:
 *   0 - Success (all checks passed)
 *   1 - General error (missing dependencies, etc.)
 *   2 - Quality issues found - ALL must be fixed (blocking)
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Find project root by looking for package.json
 * @param {string} startPath - Starting directory path
 * @returns {string} Project root directory
 */
function findProjectRoot(startPath) {
  let currentPath = startPath;
  while (currentPath !== '/') {
    if (require('fs').existsSync(path.join(currentPath, 'package.json'))) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }
  return process.cwd();
}

const projectRoot = findProjectRoot(process.cwd());

/**
 * Intelligent TypeScript Config Cache with checksum validation
 * Handles multiple tsconfig files and maps files to appropriate configs
 */
class TypeScriptConfigCache {
  /**
   * Creates a new TypeScript config cache instance.
   * Loads existing cache or initializes empty cache.
   */
  constructor() {
    // Store cache in the hook's directory for isolation
    this.cacheFile = path.join(__dirname, 'tsconfig-cache.json');
    this.cache = { hashes: {}, mappings: {} };
    this.loadCache();
  }

  /**
   * Get config hash for cache validation
   * @param {string} configPath - Path to tsconfig file
   * @returns {string} SHA256 hash of config content
   */
  getConfigHash(configPath) {
    try {
      const content = require('fs').readFileSync(configPath, 'utf8');
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (e) {
      return null;
    }
  }

  /**
   * Find all tsconfig files in project
   * @returns {string[]} Array of tsconfig file paths
   */
  findTsConfigFiles() {
    const configs = [];
    try {
      // Try to use glob if available, fallback to manual search
      const globSync = require('glob').sync;
      return globSync('tsconfig*.json', { cwd: projectRoot }).map((file) =>
        path.join(projectRoot, file)
      );
    } catch (e) {
      // Fallback: manually check common config files
      const commonConfigs = [
        'tsconfig.json',
        'tsconfig.webview.json',
        'tsconfig.test.json',
        'tsconfig.node.json',
      ];

      for (const config of commonConfigs) {
        const configPath = path.join(projectRoot, config);
        if (require('fs').existsSync(configPath)) {
          configs.push(configPath);
        }
      }
      return configs;
    }
  }

  /**
   * Check if cache is valid by comparing config hashes
   * @returns {boolean} True if cache is valid
   */
  isValid() {
    const configFiles = this.findTsConfigFiles();

    // Check if we have the same number of configs
    if (Object.keys(this.cache.hashes).length !== configFiles.length) {
      return false;
    }

    // Check each config hash
    for (const configPath of configFiles) {
      const currentHash = this.getConfigHash(configPath);
      if (currentHash !== this.cache.hashes[configPath]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Rebuild cache by parsing all configs and creating file mappings
   */
  rebuild() {
    this.cache = { hashes: {}, mappings: {} };

    // Process configs in priority order (most specific first)
    const configPriority = [
      'tsconfig.webview.json', // Most specific
      'tsconfig.test.json', // Test-specific
      'tsconfig.json', // Base config
    ];

    configPriority.forEach((configName) => {
      const configPath = path.join(projectRoot, configName);
      if (!require('fs').existsSync(configPath)) {
        return;
      }

      // Store hash for validation
      this.cache.hashes[configPath] = this.getConfigHash(configPath);

      try {
        const configContent = require('fs').readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent);

        // Build file pattern mappings
        if (config.include) {
          config.include.forEach((pattern) => {
            // Only set if not already mapped by a more specific config
            if (!this.cache.mappings[pattern]) {
              this.cache.mappings[pattern] = {
                configPath,
                excludes: config.exclude || [],
              };
            }
          });
        }
      } catch (e) {
        // Skip invalid configs
      }
    });

    this.saveCache();
  }

  /**
   * Load cache from disk
   */
  loadCache() {
    try {
      const cacheContent = require('fs').readFileSync(this.cacheFile, 'utf8');
      this.cache = JSON.parse(cacheContent);
    } catch (e) {
      // Cache doesn't exist or is invalid, will rebuild
      this.cache = { hashes: {}, mappings: {} };
    }
  }

  /**
   * Save cache to disk
   */
  saveCache() {
    try {
      // Save cache directly in hook directory (directory already exists)
      require('fs').writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
    } catch (e) {
      // Ignore cache save errors
    }
  }

  /**
   * Get appropriate tsconfig for a file
   * @param {string} filePath - File path to check
   * @returns {string} Path to appropriate tsconfig file
   */
  getTsConfigForFile(filePath) {
    // Ensure cache is valid
    if (!this.isValid()) {
      this.rebuild();
    }

    const relativePath = path.relative(projectRoot, filePath);

    // Check cached mappings first - these are from actual tsconfig includes
    // Sort patterns by specificity to match most specific first
    const sortedMappings = Object.entries(this.cache.mappings).sort(([a], [b]) => {
      // More specific patterns first
      const aSpecificity = a.split('/').length + (a.includes('**') ? 0 : 10);
      const bSpecificity = b.split('/').length + (b.includes('**') ? 0 : 10);
      return bSpecificity - aSpecificity;
    });

    for (const [pattern, mapping] of sortedMappings) {
      // Handle both old format (string) and new format (object with excludes)
      const configPath = typeof mapping === 'string' ? mapping : mapping.configPath;
      const excludes = typeof mapping === 'string' ? [] : mapping.excludes;

      if (this.matchesPattern(relativePath, pattern)) {
        // Check if file is excluded
        let isExcluded = false;
        for (const exclude of excludes) {
          if (this.matchesPattern(relativePath, exclude)) {
            isExcluded = true;
            break;
          }
        }

        if (!isExcluded) {
          return configPath;
        }
      }
    }

    // Fast heuristics for common cases not in cache
    // Webview files
    if (relativePath.includes('src/webview/') || relativePath.includes('/webview/')) {
      const webviewConfig = path.join(projectRoot, 'tsconfig.webview.json');
      if (require('fs').existsSync(webviewConfig)) {
        return webviewConfig;
      }
    }

    // Test files
    if (
      relativePath.includes('/test/') ||
      relativePath.includes('.test.') ||
      relativePath.includes('.spec.')
    ) {
      const testConfig = path.join(projectRoot, 'tsconfig.test.json');
      if (require('fs').existsSync(testConfig)) {
        return testConfig;
      }
    }

    // Default fallback
    return path.join(projectRoot, 'tsconfig.json');
  }

  /**
   * Simple pattern matching for file paths
   * @param {string} filePath - File path to test
   * @param {string} pattern - Glob-like pattern
   * @returns {boolean} True if file matches pattern
   */
  matchesPattern(filePath, pattern) {
    // Simple pattern matching - convert glob to regex
    // Handle the common patterns specially
    if (pattern.endsWith('/**/*')) {
      // For patterns like src/webview/**/* or src/protocol/**/*
      // Match any file under that directory
      const baseDir = pattern.slice(0, -5); // Remove /**/*
      return filePath.startsWith(baseDir);
    }

    // For other patterns, use regex conversion
    let regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape regex special chars
      .replace(/\*\*/g, '🌟') // Temporary placeholder for **
      .replace(/\*/g, '[^/]*') // * matches anything except /
      .replace(/🌟/g, '.*') // ** matches anything including /
      .replace(/\?/g, '.'); // ? matches single character

    const regex = new RegExp(`^${regexPattern}$`);
    const result = regex.test(filePath);

    return result;
  }
}

// Global config cache instance
const tsConfigCache = new TypeScriptConfigCache();

/**
 * Debouncing system to reduce noise from rapid file edits
 * Only runs quality checks after a brief pause in editing
 */
class FileDebouncer {
  constructor(debounceMs = 2000) {
    this.debounceMs = debounceMs;
    this.pendingChecks = new Map();
    this.recentChecks = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000); // Cleanup every 30s
  }

  /**
   * Check if we should run quality check now or debounce it
   * @param {string} filePath - File being edited
   * @returns {boolean} True if should check now, false if debouncing
   */
  shouldCheck(filePath) {
    const now = Date.now();
    const lastCheck = this.recentChecks.get(filePath) || 0;
    
    // If we checked this file recently (within debounce window), skip
    if (now - lastCheck < this.debounceMs) {
      log.debug(`Debouncing check for ${path.basename(filePath)} (last check ${now - lastCheck}ms ago)`);
      return false;
    }

    // Clear any pending timeout for this file
    if (this.pendingChecks.has(filePath)) {
      clearTimeout(this.pendingChecks.get(filePath));
      this.pendingChecks.delete(filePath);
    }

    // Record this check time
    this.recentChecks.set(filePath, now);
    return true;
  }

  /**
   * Schedule a debounced check for later
   * @param {string} filePath - File to check later
   * @param {Function} checkFunction - Function to run the check
   */
  scheduleCheck(filePath, checkFunction) {
    // Clear existing timeout
    if (this.pendingChecks.has(filePath)) {
      clearTimeout(this.pendingChecks.get(filePath));
    }

    // Schedule new check
    const timeoutId = setTimeout(() => {
      log.debug(`Running debounced check for ${path.basename(filePath)}`);
      checkFunction();
      this.pendingChecks.delete(filePath);
    }, this.debounceMs);

    this.pendingChecks.set(filePath, timeoutId);
    log.debug(`Scheduled debounced check for ${path.basename(filePath)} in ${this.debounceMs}ms`);
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  cleanup() {
    const now = Date.now();
    const maxAge = this.debounceMs * 10; // Keep entries for 10x debounce time

    for (const [filePath, timestamp] of this.recentChecks.entries()) {
      if (now - timestamp > maxAge) {
        this.recentChecks.delete(filePath);
      }
    }
  }

  /**
   * Clean up all timers (for graceful shutdown)
   */
  destroy() {
    // Clear all pending timeouts
    for (const timeoutId of this.pendingChecks.values()) {
      clearTimeout(timeoutId);
    }
    this.pendingChecks.clear();
    
    // Clear cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global debouncer instance
const fileDebouncer = new FileDebouncer();

// ANSI color codes
const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[0;33m',
  blue: '\x1b[0;34m',
  cyan: '\x1b[0;36m',
  reset: '\x1b[0m',
};

/**
 * Load configuration from JSON file with environment variable overrides
 * @returns {Object} Configuration object
 */
function loadConfig() {
  let fileConfig = {};

  // Try to load hook-config.json
  try {
    const configPath = path.join(__dirname, 'hook-config.json');
    if (require('fs').existsSync(configPath)) {
      fileConfig = JSON.parse(require('fs').readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    // Config file not found or invalid, use defaults
  }

  // Build config with file settings as base, env vars as overrides
  return {
    // TypeScript settings
    typescriptEnabled:
      process.env.CLAUDE_HOOKS_TYPESCRIPT_ENABLED !== undefined
        ? process.env.CLAUDE_HOOKS_TYPESCRIPT_ENABLED !== 'false'
        : (fileConfig.typescript?.enabled ?? true),

    showDependencyErrors:
      process.env.CLAUDE_HOOKS_SHOW_DEPENDENCY_ERRORS !== undefined
        ? process.env.CLAUDE_HOOKS_SHOW_DEPENDENCY_ERRORS === 'true'
        : (fileConfig.typescript?.showDependencyErrors ?? false),

    // ESLint settings
    eslintEnabled:
      process.env.CLAUDE_HOOKS_ESLINT_ENABLED !== undefined
        ? process.env.CLAUDE_HOOKS_ESLINT_ENABLED !== 'false'
        : (fileConfig.eslint?.enabled ?? true),

    eslintAutofix:
      process.env.CLAUDE_HOOKS_ESLINT_AUTOFIX !== undefined
        ? process.env.CLAUDE_HOOKS_ESLINT_AUTOFIX === 'true'
        : (fileConfig.eslint?.autofix ?? false),

    // Prettier settings
    prettierEnabled:
      process.env.CLAUDE_HOOKS_PRETTIER_ENABLED !== undefined
        ? process.env.CLAUDE_HOOKS_PRETTIER_ENABLED !== 'false'
        : (fileConfig.prettier?.enabled ?? true),

    prettierAutofix:
      process.env.CLAUDE_HOOKS_PRETTIER_AUTOFIX !== undefined
        ? process.env.CLAUDE_HOOKS_PRETTIER_AUTOFIX === 'true'
        : (fileConfig.prettier?.autofix ?? false),

    // General settings
    autofixSilent:
      process.env.CLAUDE_HOOKS_AUTOFIX_SILENT !== undefined
        ? process.env.CLAUDE_HOOKS_AUTOFIX_SILENT === 'true'
        : (fileConfig.general?.autofixSilent ?? false),

    debug:
      process.env.CLAUDE_HOOKS_DEBUG !== undefined
        ? process.env.CLAUDE_HOOKS_DEBUG === 'true'
        : (fileConfig.general?.debug ?? false),

    // Ignore patterns
    ignorePatterns: fileConfig.ignore?.patterns || [],

    // Store the full config for rule access
    _fileConfig: fileConfig,
  };
}

/**
 * Hook Configuration
 *
 * Configuration is loaded from (in order of precedence):
 * 1. Environment variables (highest priority)
 * 2. .claude/hooks/config.json file
 * 3. Built-in defaults
 */
const config = loadConfig();

// Logging functions - define before using
const log = {
  info: (msg) => console.error(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  error: (msg) => console.error(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  success: (msg) => console.error(`${colors.green}[OK]${colors.reset} ${msg}`),
  warning: (msg) => console.error(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  debug: (msg) => {
    if (config.debug) {
      console.error(`${colors.cyan}[DEBUG]${colors.reset} ${msg}`);
    }
  },
};

// Note: errors and autofixes are tracked per QualityChecker instance

// Try to load modules, but make them optional
let ESLint, prettier, ts;

try {
  ({ ESLint } = require(path.join(projectRoot, 'node_modules', 'eslint')));
} catch (e) {
  log.debug('ESLint not found in project - will skip ESLint checks');
}

try {
  prettier = require(path.join(projectRoot, 'node_modules', 'prettier'));
} catch (e) {
  log.debug('Prettier not found in project - will skip Prettier checks');
}

try {
  ts = require(path.join(projectRoot, 'node_modules', 'typescript'));
} catch (e) {
  log.debug('TypeScript not found in project - will skip TypeScript checks');
}

/**
 * Context-aware file analysis to detect work-in-progress patterns
 * @param {string} filePath - Path to file
 * @param {string} content - File content
 * @returns {Object} Analysis result with shouldSkip flag and reasons
 */
function analyzeFileContext(filePath, content) {
  const reasons = [];
  let shouldSkip = false;

  // Check for explicit work-in-progress markers
  const wipMarkers = [
    '// TODO: implement',
    '/* TODO: implement',
    '// TEMP:',
    '/* TEMP:',
    '// WIP:',
    '/* WIP:',
    '// FIXME: incomplete',
    '/* FIXME: incomplete'
  ];

  for (const marker of wipMarkers) {
    if (content.includes(marker)) {
      reasons.push(`Found work-in-progress marker: ${marker}`);
      shouldSkip = true;
    }
  }

  // Check for incomplete import patterns
  const lines = content.split('\n');
  const importLines = lines.filter(line => line.trim().startsWith('import '));
  const nonImportLines = lines.filter(line => 
    line.trim() && 
    !line.trim().startsWith('import ') &&
    !line.trim().startsWith('//') &&
    !line.trim().startsWith('/*')
  );

  // If we have imports but very little other content, might be mid-edit
  if (importLines.length > 0 && nonImportLines.length < 3) {
    reasons.push('File appears to be mostly imports with minimal implementation');
    shouldSkip = true;
  }

  // Check for dangling imports (imports that aren't used yet)
  const importedNames = [];
  importLines.forEach(line => {
    const match = line.match(/import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))/);
    if (match) {
      if (match[1]) {
        // Named imports: { foo, bar }
        importedNames.push(...match[1].split(',').map(name => name.trim()));
      } else if (match[2]) {
        // Namespace import: * as foo
        importedNames.push(match[2].trim());
      } else if (match[3]) {
        // Default import: foo
        importedNames.push(match[3].trim());
      }
    }
  });

  // Count how many imports are actually used
  let unusedImports = 0;
  for (const importName of importedNames) {
    if (!content.includes(importName) || content.indexOf(importName) === content.lastIndexOf(importName)) {
      unusedImports++;
    }
  }

  // If more than half the imports are unused, likely still adding code
  if (importedNames.length > 2 && unusedImports / importedNames.length > 0.5) {
    reasons.push(`Many unused imports detected (${unusedImports}/${importedNames.length})`);
    shouldSkip = true;
  }

  // Check for empty function bodies or incomplete class definitions
  const emptyFunctionPattern = /(?:function\s+\w+\s*\([^)]*\)|(?:const|let|var)\s+\w+\s*=\s*(?:\([^)]*\)\s*)?=>?|export\s+function\s+\w+\s*\([^)]*\))\s*\{\s*(?:\/\/\s*TODO|\/\*\s*TODO|\/\/\s*FIXME|\/\*\s*FIXME)?\s*\}/g;
  const incompleteFunctions = content.match(emptyFunctionPattern);
  if (incompleteFunctions && incompleteFunctions.length > 0) {
    // Only skip if the function bodies are truly empty or just have TODO comments
    const hasActualEmptyFunctions = incompleteFunctions.some(func => {
      const body = func.match(/\{([^}]*)\}/);
      if (body) {
        const bodyContent = body[1].trim();
        return bodyContent === '' || /^\/\/\s*(TODO|FIXME)/.test(bodyContent) || /^\/\*\s*(TODO|FIXME)/.test(bodyContent);
      }
      return false;
    });
    
    if (hasActualEmptyFunctions) {
      reasons.push('Found functions with empty or TODO-marked bodies');
      shouldSkip = true;
    }
  }

  return { shouldSkip, reasons };
}

/**
 * Quality checker for a single file.
 * Runs TypeScript, ESLint, and Prettier checks with optional auto-fixing.
 */
class QualityChecker {
  /**
   * Creates a new QualityChecker instance.
   * @param {string} filePath - Path to file to check
   */
  constructor(filePath) {
    this.filePath = filePath;
    this.fileType = this.detectFileType(filePath);
    this.problemCounts = {
      typescript: 0,
      eslint: 0,
      prettier: 0,
      common: 0
    };
    this.autofixes = [];
  }

  /**
   * Detect file type from path
   * @param {string} filePath - File path
   * @returns {string} File type
   */
  detectFileType(filePath) {
    if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath)) {
      return 'test';
    }
    if (/\/store\/|\/slices\/|\/reducers\//.test(filePath)) {
      return 'redux';
    }
    if (/\/components\/.*\.(tsx|jsx)$/.test(filePath)) {
      return 'component';
    }
    if (/\.(ts|tsx)$/.test(filePath)) {
      return 'typescript';
    }
    if (/\.(js|jsx)$/.test(filePath)) {
      return 'javascript';
    }
    return 'unknown';
  }

  /**
   * Run all quality checks
   * @returns {Promise<{problemCounts: object, autofixes: string[]}>} Check results
   */
  async checkAll() {
    // This should never happen now since we filter out non-source files earlier,
    // but keeping for consistency with shell version
    if (this.fileType === 'unknown') {
      return { problemCounts: this.problemCounts, autofixes: [] };
    }

    // Run all checks in parallel for speed
    const checkPromises = [];

    if (config.typescriptEnabled) {
      checkPromises.push(this.checkTypeScript());
    }

    if (config.eslintEnabled) {
      checkPromises.push(this.checkESLint());
    }

    if (config.prettierEnabled) {
      checkPromises.push(this.checkPrettier());
    }

    checkPromises.push(this.checkCommonIssues());

    await Promise.all(checkPromises);

    return {
      problemCounts: this.problemCounts,
      autofixes: this.autofixes,
    };
  }

  /**
   * Get file dependencies by parsing imports
   * @param {string} filePath - File to analyze
   * @returns {string[]} Array of file paths including dependencies
   */
  getFileDependencies(filePath) {
    const dependencies = new Set([filePath]);

    try {
      const content = require('fs').readFileSync(filePath, 'utf8');
      const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
      let match;

      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];

        // Only include relative imports (project files)
        if (importPath.startsWith('.')) {
          const resolvedPath = this.resolveImportPath(filePath, importPath);
          if (resolvedPath && require('fs').existsSync(resolvedPath)) {
            dependencies.add(resolvedPath);
          }
        }
      }
    } catch (e) {
      // If we can't parse imports, just use the original file
      log.debug(`Could not parse imports for ${filePath}: ${e.message}`);
    }

    return Array.from(dependencies);
  }

  /**
   * Resolve relative import path to absolute path
   * @param {string} fromFile - File doing the import
   * @param {string} importPath - Relative import path
   * @returns {string|null} Absolute file path or null if not found
   */
  resolveImportPath(fromFile, importPath) {
    const dir = path.dirname(fromFile);
    const resolved = path.resolve(dir, importPath);

    // Try common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of extensions) {
      const fullPath = resolved + ext;
      if (require('fs').existsSync(fullPath)) {
        return fullPath;
      }
    }

    // Try index files
    for (const ext of extensions) {
      const indexPath = path.join(resolved, 'index' + ext);
      if (require('fs').existsSync(indexPath)) {
        return indexPath;
      }
    }

    return null;
  }

  /**
   * Check TypeScript compilation
   * @returns {Promise<void>}
   */
  async checkTypeScript() {
    if (!config.typescriptEnabled || !ts) {
      return;
    }

    // Skip TypeScript checking for JavaScript files in hook directories
    if (this.filePath.endsWith('.js') && this.filePath.includes('.claude/hooks/')) {
      log.debug('Skipping TypeScript check for JavaScript hook file');
      return;
    }


    try {
      // Get intelligent config for this file
      const configPath = tsConfigCache.getTsConfigForFile(this.filePath);

      if (!require('fs').existsSync(configPath)) {
        log.debug(`No TypeScript config found: ${configPath}`);
        return;
      }

      log.debug(
        `Using TypeScript config: ${path.basename(configPath)} for ${path.relative(projectRoot, this.filePath)}`
      );

      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(configPath)
      );

      // Only check the edited file, not its dependencies
      // Dependencies will be type-checked with their own appropriate configs
      log.debug(`TypeScript checking edited file only`);

      // Create program with just the edited file
      const program = ts.createProgram([this.filePath], parsedConfig.options);
      const diagnostics = ts.getPreEmitDiagnostics(program);

      // Group diagnostics by file
      const diagnosticsByFile = new Map();
      diagnostics.forEach((d) => {
        if (d.file) {
          const fileName = d.file.fileName;
          if (!diagnosticsByFile.has(fileName)) {
            diagnosticsByFile.set(fileName, []);
          }
          diagnosticsByFile.get(fileName).push(d);
        }
      });

      // Count TypeScript errors in the edited file
      const editedFileDiagnostics = diagnosticsByFile.get(this.filePath) || [];
      if (editedFileDiagnostics.length > 0) {
        this.problemCounts.typescript += editedFileDiagnostics.length;
      }
    } catch (error) {
      log.debug(`TypeScript check error: ${error.message}`);
    }
  }

  /**
   * Check ESLint rules
   * @returns {Promise<void>}
   */
  async checkESLint() {
    if (!config.eslintEnabled || !ESLint) {
      return;
    }


    try {
      const eslint = new ESLint({
        fix: config.eslintAutofix,
        cwd: projectRoot,
      });

      const results = await eslint.lintFiles([this.filePath]);
      const result = results[0];

      if (result.errorCount > 0 || result.warningCount > 0) {
        if (config.eslintAutofix) {
          // Write the fixed output
          if (result.output) {
            await fs.writeFile(this.filePath, result.output);

            // Re-lint to see if issues remain
            const resultsAfterFix = await eslint.lintFiles([this.filePath]);
            const resultAfterFix = resultsAfterFix[0];

            if (resultAfterFix.errorCount === 0 && resultAfterFix.warningCount === 0) {
              if (config.autofixSilent) {
                this.autofixes.push('ESLint auto-fixed formatting/style issues');
              } else {
                this.problemCounts.eslint += 1; // Count as resolved but flagged
              }
            } else {
              this.problemCounts.eslint += resultAfterFix.errorCount + resultAfterFix.warningCount;
            }
          } else {
            this.problemCounts.eslint += result.errorCount + result.warningCount;
          }
        } else {
          this.problemCounts.eslint += result.errorCount + result.warningCount;
        }
      }
    } catch (error) {
      log.debug(`ESLint check error: ${error.message}`);
    }
  }

  /**
   * Check Prettier formatting
   * @returns {Promise<void>}
   */
  async checkPrettier() {
    if (!config.prettierEnabled || !prettier) {
      return;
    }


    try {
      const fileContent = await fs.readFile(this.filePath, 'utf8');
      const prettierConfig = await prettier.resolveConfig(this.filePath);

      const isFormatted = await prettier.check(fileContent, {
        ...prettierConfig,
        filepath: this.filePath,
      });

      if (!isFormatted) {
        if (config.prettierAutofix) {
          const formatted = await prettier.format(fileContent, {
            ...prettierConfig,
            filepath: this.filePath,
          });

          await fs.writeFile(this.filePath, formatted);

          if (config.autofixSilent) {
            this.autofixes.push('Prettier auto-formatted the file');
          } else {
            this.problemCounts.prettier += 1; // Count as resolved but flagged
          }
        } else {
          this.problemCounts.prettier += 1;
        }
      }
    } catch (error) {
      log.debug(`Prettier check error: ${error.message}`);
    }
  }

  /**
   * Check for common code issues
   * @returns {Promise<void>}
   */
  async checkCommonIssues() {

    try {
      const content = await fs.readFile(this.filePath, 'utf8');
      const lines = content.split('\n');

      // Check for 'as any' in TypeScript files
      const asAnyRule = config._fileConfig.rules?.asAny || {};
      if (
        (this.fileType === 'typescript' || this.fileType === 'component') &&
        asAnyRule.enabled !== false
      ) {
        lines.forEach((line, index) => {
          if (line.includes('as any')) {
            const severity = asAnyRule.severity || 'error';
            if (severity === 'error') {
              this.problemCounts.common += 1;
            }
          }
        });
      }

      // Check for console statements based on React app rules
      const consoleRule = config._fileConfig.rules?.console || {};
      let allowConsole = false;

      // Check if console is allowed in this file
      if (consoleRule.enabled === false) {
        allowConsole = true;
      } else {
        // Check allowed paths
        const allowedPaths = consoleRule.allowIn?.paths || [];
        if (allowedPaths.some((path) => this.filePath.includes(path))) {
          allowConsole = true;
        }

        // Check allowed file types
        const allowedFileTypes = consoleRule.allowIn?.fileTypes || [];
        if (allowedFileTypes.includes(this.fileType)) {
          allowConsole = true;
        }

        // Check allowed patterns
        const allowedPatterns = consoleRule.allowIn?.patterns || [];
        const fileName = path.basename(this.filePath);
        if (
          allowedPatterns.some((pattern) => {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(fileName);
          })
        ) {
          allowConsole = true;
        }
      }

      // For React apps, console is generally allowed but shows as info
      if (!allowConsole && consoleRule.enabled !== false) {
        lines.forEach((line, index) => {
          if (/console\./.test(line)) {
            const severity = consoleRule.severity || 'info';
            if (severity === 'error') {
              this.problemCounts.common += 1;
            }
          }
        });
      }

    } catch (error) {
      log.debug(`Common issues check error: ${error.message}`);
    }
  }

  /**
   * Suggest related test files
   * @returns {Promise<void>}
   */
  async suggestRelatedTests() {
    // Only show test suggestions in debug mode
    if (this.fileType === 'test' || !config.debug) {
      return;
    }

    const baseName = this.filePath.replace(/\.[^.]+$/, '');
    const testExtensions = ['test.ts', 'test.tsx', 'spec.ts', 'spec.tsx'];

    for (const ext of testExtensions) {
      try {
        await fs.access(`${baseName}.${ext}`);
        log.warning(`💡 Test: ${path.basename(baseName)}.${ext}`);
        return;
      } catch {
        // File doesn't exist, continue
      }
    }

    // Check __tests__ directory
    const dir = path.dirname(this.filePath);
    const fileName = path.basename(this.filePath);
    const baseFileName = fileName.replace(/\.[^.]+$/, '');

    for (const ext of testExtensions) {
      try {
        await fs.access(path.join(dir, '__tests__', `${baseFileName}.${ext}`));
        log.warning(`💡 Test: __tests__/${baseFileName}.${ext}`);
        return;
      } catch {
        // File doesn't exist, continue
      }
    }
  }
}

/**
 * Parse JSON input from stdin
 * @returns {Promise<Object>} Parsed JSON object
 */
async function parseJsonInput() {
  let inputData = '';

  // Read from stdin
  for await (const chunk of process.stdin) {
    inputData += chunk;
  }

  if (!inputData.trim()) {
    log.warning('No JSON input provided. This hook expects JSON input from Claude Code.');
    log.info(
      'For testing, provide JSON like: echo \'{"tool_name":"Edit","tool_input":{"file_path":"/path/to/file.ts"}}\' | node hook.js'
    );
    console.error(`\n${colors.yellow}👉 Hook executed but no input to process.${colors.reset}`);
    process.exit(0);
  }

  try {
    return JSON.parse(inputData);
  } catch (error) {
    log.error(`Failed to parse JSON input: ${error.message}`);
    log.debug(`Input was: ${inputData}`);
    process.exit(1);
  }
}

/**
 * Extract file path from tool input
 * @param {Object} input - Tool input object
 * @returns {string|null} File path or null
 */
function extractFilePath(input) {
  const { tool_input } = input;
  if (!tool_input) {
    return null;
  }

  return tool_input.file_path || tool_input.path || tool_input.notebook_path || null;
}

/**
 * Check if file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} True if exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if file is a source file
 * @param {string} filePath - Path to check
 * @returns {boolean} True if source file
 */
function isSourceFile(filePath) {
  return /\.(ts|tsx|js|jsx)$/.test(filePath);
}

/**
 * Print concise summary of problems by tool
 * @param {object} problemCounts - Problem counts by tool
 * @param {string[]} autofixes - List of autofixes
 */
function printSummary(problemCounts, autofixes) {
  const problems = [];
  
  if (problemCounts.typescript > 0) {
    problems.push(`TypeScript: ${problemCounts.typescript} error${problemCounts.typescript > 1 ? 's' : ''}`);
  }
  if (problemCounts.eslint > 0) {
    problems.push(`ESLint: ${problemCounts.eslint} issue${problemCounts.eslint > 1 ? 's' : ''}`);
  }
  if (problemCounts.prettier > 0) {
    problems.push(`Prettier: ${problemCounts.prettier} issue${problemCounts.prettier > 1 ? 's' : ''}`);
  }
  if (problemCounts.common > 0) {
    problems.push(`Code issues: ${problemCounts.common} problem${problemCounts.common > 1 ? 's' : ''}`);
  }
  
  if (problems.length > 0) {
    console.error(problems.join(', '));
  }
}

/**
 * Main entry point
 * @returns {Promise<void>}
 */
async function main() {

  // Parse input
  const input = await parseJsonInput();
  const filePath = extractFilePath(input);

  if (!filePath) {
    process.exit(0);
  }

  // Check if file exists
  if (!(await fileExists(filePath))) {
    process.exit(0);
  }

  // For non-source files, exit successfully without checks (matching shell behavior)
  if (!isSourceFile(filePath)) {
    process.exit(0);
  }

  // Check if we should skip this check due to debouncing
  if (!fileDebouncer.shouldCheck(filePath)) {
    process.exit(0);
  }

  // Read file content for context analysis
  let fileContent = '';
  try {
    fileContent = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    log.error(`Could not read file content: ${error.message}`);
    process.exit(1);
  }

  // Analyze file context to see if we should skip
  const contextAnalysis = analyzeFileContext(filePath, fileContent);
  if (contextAnalysis.shouldSkip) {
    process.exit(0);
  }


  // Run quality checks
  const checker = new QualityChecker(filePath);
  const { problemCounts, autofixes } = await checker.checkAll();

  // Calculate total problems
  const totalProblems = problemCounts.typescript + problemCounts.eslint + problemCounts.prettier + problemCounts.common;

  // Print summary if problems found
  if (totalProblems > 0) {
    printSummary(problemCounts, autofixes);
    console.error(`${colors.yellow}💡 Remember to resolve the issues before moving on to another file${colors.reset}`);
    
    // Generate specific commands for this file
    const relativePath = path.relative(projectRoot, filePath);
    const commands = [];
    
    if (problemCounts.typescript > 0) {
      commands.push(`npm run typecheck:brief`);
    }
    if (problemCounts.eslint > 0) {
      commands.push(`npx eslint "${relativePath}"`);
    }
    if (problemCounts.prettier > 0) {
      commands.push(`npx prettier --check "${relativePath}"`);
    }
    
    if (commands.length > 0) {
      console.error(`${colors.blue}💡 Run: ${commands.join(' && ')}${colors.reset}`);
    }
    
    console.error(`${colors.yellow}⚠ ${path.basename(filePath)} - has issues to resolve${colors.reset}`);
    process.exit(0); // Advisory only - don't block workflow
  } else {
    process.exit(0);
  }
}

// Handle errors and cleanup
process.on('unhandledRejection', (error) => {
  log.error(`Unhandled error: ${error.message}`);
  fileDebouncer.destroy();
  process.exit(1);
});

process.on('SIGINT', () => {
  log.debug('Received SIGINT, cleaning up...');
  fileDebouncer.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log.debug('Received SIGTERM, cleaning up...');
  fileDebouncer.destroy();
  process.exit(0);
});

// Run main
main().catch((error) => {
  log.error(`Fatal error: ${error.message}`);
  fileDebouncer.destroy();
  process.exit(1);
});
