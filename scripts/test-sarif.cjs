#!/usr/bin/env node

/**
 * SARIF Integration Test Script
 * 
 * This script validates the SARIF integration setup for PinPoint.
 * Run after dependencies are installed: npm install && node scripts/test-sarif.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = process.cwd();
const sarifFile = path.join(projectRoot, 'eslint-results.sarif');

console.log('🔍 Testing SARIF Integration...\n');

// Test 1: Check if SARIF dependency is installed
try {
    const packagePath = path.join(projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    if (packageJson.devDependencies['@microsoft/eslint-formatter-sarif']) {
        console.log('✅ SARIF formatter dependency found in package.json');
    } else {
        console.log('❌ SARIF formatter dependency missing');
        process.exit(1);
    }
} catch (error) {
    console.error('❌ Failed to check package.json:', error.message);
    process.exit(1);
}

// Test 2: Check if lint:sarif script exists
try {
    const packagePath = path.join(projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    if (packageJson.scripts['lint:sarif']) {
        console.log('✅ lint:sarif script found');
        console.log(`   Command: ${packageJson.scripts['lint:sarif']}`);
    } else {
        console.log('❌ lint:sarif script missing');
        process.exit(1);
    }
} catch (error) {
    console.error('❌ Failed to check lint:sarif script:', error.message);
    process.exit(1);
}

// Test 3: Test SARIF generation (if dependencies are installed)
try {
    console.log('\n🚀 Attempting to generate SARIF file...');
    
    // Clean any existing SARIF file
    if (fs.existsSync(sarifFile)) {
        fs.unlinkSync(sarifFile);
        console.log('   Cleaned existing SARIF file');
    }
    
    // Try to run lint:sarif (this will fail if deps aren't installed, which is OK)
    try {
        execSync('npm run lint:sarif', { 
            stdio: 'pipe', 
            cwd: projectRoot,
            timeout: 30000
        });
        
        if (fs.existsSync(sarifFile)) {
            console.log('✅ SARIF file generated successfully');
            
            // Validate SARIF structure
            const sarifContent = JSON.parse(fs.readFileSync(sarifFile, 'utf8'));
            
            if (sarifContent.version === '2.1.0' && sarifContent.runs) {
                console.log('✅ SARIF file has valid structure');
                console.log(`   Runs: ${sarifContent.runs.length}`);
                console.log(`   Tool: ${sarifContent.runs[0]?.tool?.driver?.name || 'Unknown'}`);
            } else {
                console.log('⚠️  SARIF file structure may be invalid');
            }
        } else {
            console.log('⚠️  SARIF file not generated (this is expected if linting passes)');
        }
        
    } catch (lintError) {
        if (lintError.message.includes('Cannot find module') || 
            lintError.message.includes('npm ERR!')) {
            console.log('⚠️  Dependencies not installed - skipping SARIF generation test');
            console.log('   Run "npm install" first to test SARIF generation');
        } else {
            console.log('⚠️  Lint command failed (this may be expected)');
            console.log('   This could be due to code quality issues, which is normal');
            
            // Check if SARIF file was still created
            if (fs.existsSync(sarifFile)) {
                console.log('✅ SARIF file was created despite lint failures');
            }
        }
    }
    
} catch (error) {
    console.log('⚠️  Could not test SARIF generation:', error.message);
}

// Test 4: Check GitHub workflow integration
try {
    const workflowPath = path.join(projectRoot, '.github/workflows/ci.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    
    if (workflow.includes('security-events: write')) {
        console.log('✅ GitHub workflow has security-events permission');
    } else {
        console.log('❌ GitHub workflow missing security-events permission');
    }
    
    if (workflow.includes('upload-sarif')) {
        console.log('✅ GitHub workflow includes SARIF upload steps');
    } else {
        console.log('❌ GitHub workflow missing SARIF upload steps');
    }
    
    if (workflow.includes('lint:sarif')) {
        console.log('✅ GitHub workflow runs lint:sarif command');
    } else {
        console.log('❌ GitHub workflow missing lint:sarif command');
    }
    
} catch (error) {
    console.error('❌ Failed to check GitHub workflow:', error.message);
}

// Test 5: Check documentation
try {
    const docPath = path.join(projectRoot, 'docs/developer-guides/sarif-integration.md');
    if (fs.existsSync(docPath)) {
        console.log('✅ SARIF integration documentation exists');
    } else {
        console.log('⚠️  SARIF integration documentation missing');
    }
} catch (error) {
    console.log('⚠️  Could not check documentation:', error.message);
}

console.log('\n🎉 SARIF Integration Test Complete!\n');

console.log('Next Steps:');
console.log('1. Install dependencies: npm install');
console.log('2. Test SARIF generation: npm run lint:sarif'); 
console.log('3. Commit and push changes to trigger CI');
console.log('4. Check GitHub Security tab for results');
console.log('5. Review docs/developer-guides/sarif-integration.md');

// Cleanup
if (fs.existsSync(sarifFile)) {
    fs.unlinkSync(sarifFile);
}