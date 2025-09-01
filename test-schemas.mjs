import { z } from 'zod';
import {
  idSchema,
  emailSchema,
  optionalEmailSchema,
  titleSchema,
  nameSchema,
  descriptionSchema
} from './src/lib/validation/schemas.js';

console.log('Testing centralized validation schemas...');

// Test ID schema
console.log('Testing idSchema...');
const idResult = idSchema.safeParse('test-id-123');
console.log('Valid ID:', idResult.success);

// Test email schema
console.log('Testing emailSchema...');
const emailResult = emailSchema.safeParse('user@example.com');
console.log('Valid email:', emailResult.success);

// Test optional email
console.log('Testing optionalEmailSchema...');
const optionalEmailResult = optionalEmailSchema.safeParse(undefined);
console.log('Optional email (undefined):', optionalEmailResult.success);

// Test title schema
console.log('Testing titleSchema...');
const titleResult = titleSchema.safeParse('My Test Title');
console.log('Valid title:', titleResult.success);

// Test name schema
console.log('Testing nameSchema...');
const nameResult = nameSchema.safeParse('Test Name');
console.log('Valid name:', nameResult.success);

// Test description schema
console.log('Testing descriptionSchema...');
const descResult = descriptionSchema.safeParse('This is a test description');
console.log('Valid description:', descResult.success);

// Test error cases
console.log('\nTesting error cases...');
const emptyIdResult = idSchema.safeParse('');
console.log('Empty ID error:', !emptyIdResult.success);
if (!emptyIdResult.success) {
  console.log('Error message:', emptyIdResult.error.issues[0]?.message);
}

const invalidEmailResult = emailSchema.safeParse('invalid-email');
console.log('Invalid email error:', !invalidEmailResult.success);
if (!invalidEmailResult.success) {
  console.log('Error message:', invalidEmailResult.error.issues[0]?.message);
}

const emptyTitleResult = titleSchema.safeParse('');
console.log('Empty title error:', !emptyTitleResult.success);
if (!emptyTitleResult.success) {
  console.log('Error message:', emptyTitleResult.error.issues[0]?.message);
}

console.log('\nAll centralized schema tests completed successfully! ✅');
