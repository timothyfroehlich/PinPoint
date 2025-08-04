#!/usr/bin/env node

/**
 * Validation script to check that all data-testid selectors used in the smoke test
 * are actually present in the corresponding component files.
 */

const fs = require('fs');
const path = require('path');

// Define the selectors and their expected locations
const selectorMappings = [
  {
    selector: 'machine-selector',
    file: 'src/components/issues/MachineSelector.tsx',
    description: 'Machine dropdown selector'
  },
  {
    selector: 'issue-title-input',
    file: 'src/components/issues/IssueCreateForm.tsx',
    description: 'Issue title input field'
  },
  {
    selector: 'issue-email-input',
    file: 'src/components/issues/IssueCreateForm.tsx',
    description: 'Issue email input field'
  },
  {
    selector: 'issue-submit-button',
    file: 'src/components/issues/IssueCreateForm.tsx',
    description: 'Issue submit button'
  },
  {
    selector: 'issue-success-message',
    file: 'src/components/issues/IssueCreateForm.tsx',
    description: 'Issue creation success message'
  },
  {
    selector: 'issue-search-input',
    file: 'src/components/issues/SearchTextField.tsx',
    description: 'Issue search input field'
  },
  {
    selector: 'comment-textarea',
    file: 'src/components/issues/IssueComments.tsx',
    description: 'Comment textarea'
  },
  {
    selector: 'submit-comment-button',
    file: 'src/components/issues/IssueComments.tsx',
    description: 'Submit comment button'
  },
  {
    selector: 'status-dropdown',
    file: 'src/components/issues/IssueStatusControl.tsx',
    description: 'Status change dropdown'
  }
];

let allValid = true;

console.log('🔍 Validating smoke test data-testid selectors...\n');

for (const mapping of selectorMappings) {
  const filePath = path.join(__dirname, '..', mapping.file);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const hasSelector = content.includes(`data-testid="${mapping.selector}"`);
    
    if (hasSelector) {
      console.log(`✅ ${mapping.selector} - Found in ${mapping.file}`);
    } else {
      console.log(`❌ ${mapping.selector} - NOT FOUND in ${mapping.file}`);
      console.log(`   Expected: data-testid="${mapping.selector}"`);
      allValid = false;
    }
  } catch (error) {
    console.log(`❌ ${mapping.selector} - Could not read ${mapping.file}: ${error.message}`);
    allValid = false;
  }
}

console.log('\n📊 Validation Summary:');
if (allValid) {
  console.log('✅ All data-testid selectors are present in their respective components');
  console.log('🎯 Smoke test should be more reliable with these robust selectors');
  process.exit(0);
} else {
  console.log('❌ Some selectors are missing - smoke test may fail');
  console.log('📝 Please add the missing data-testid attributes to the components');
  process.exit(1);
}