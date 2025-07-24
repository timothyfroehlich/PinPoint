

import { exec } from 'child_process';

console.log('Running validation script... This may take a moment.');

exec('npm run validate:agent', (error, stdout, stderr) => {
  console.log('\nValidation Summary:');
  console.log('-------------------');

  const output = stdout + stderr;

  // TypeScript Check
  const tsMatch = output.match(/Found (\d+) error/);
  const tsSuccess = output.includes('✓ TypeScript: 0 errors');
  if (tsSuccess) {
    console.log('✓ TypeScript: No errors found.');
  } else if (tsMatch && tsMatch[1]) {
    console.log(`✗ TypeScript: ${tsMatch[1]} errors found.`);
  } else {
    // Fallback for when grep filters everything but there are still errors
    const tsErrors = (output.match(/error TS/g) || []).length;
    if (tsErrors > 0) {
        console.log(`✗ TypeScript: At least ${tsErrors} errors found.`);
    } else {
        console.log('? TypeScript: Could not determine status.');
    }
  }

  // ESLint Check
  const lintMatch = output.match(/(\d+) problems?/);
  const lintSuccess = output.includes('✓ ESLint: 0 problems');
  if (lintSuccess) {
    console.log('✓ ESLint: No problems found.');
  } else if (lintMatch && lintMatch[1]) {
    console.log(`✗ ESLint: ${lintMatch[1]} problems found.`);
  } else {
    console.log('? ESLint: Could not determine status.');
  }

  // Prettier Check
  const prettierMatch = output.match(/Prettier: (\d+) files need formatting/);
  const prettierSuccess = output.includes('✓ Prettier: All formatted');
  if (prettierSuccess) {
    console.log('✓ Prettier: All files formatted.');
  } else if (prettierMatch && prettierMatch[1]) {
    console.log(`✗ Prettier: ${prettierMatch[1]} files need formatting.`);
  } else {
    console.log('? Prettier: Could not determine status.');
  }

  // Tests Check
  const testSuccess = output.includes('✓ Tests: All passing');
  const testFailMatch = output.match(/Tests:.*?(\d+) failed/);
  const testSuiteFailMatch = output.match(/Test suite failed to run/g);
  
  if (testSuccess) {
    console.log('✓ Tests: All passing.');
  } else if (testFailMatch && testFailMatch[1]) {
    const failedCount = testFailMatch[1];
    const totalMatch = output.match(/Tests:.*?(\d+) total/);
    const totalCount = totalMatch ? totalMatch[1] : '?';
    console.log(`✗ Tests: ${failedCount} of ${totalCount} tests failed.`);
  } else if (testSuiteFailMatch) {
    console.log(`✗ Tests: ${testSuiteFailMatch.length} test suite(s) failed to run.`);
  }
  else {
    console.log('? Tests: Could not determine status.');
  }

  console.log('-------------------');
  console.log('For details, run: npm run validate:agent');
});

