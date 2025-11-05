#!/usr/bin/env node

/**
 * Simple test to debug manual lookup
 */

import 'dotenv/config';
import { db } from './server/db.js';
import { manuals } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function debugManualLookup() {
  console.log('🔍 Debugging Manual Lookup\n');

  try {
    // Get all manuals first
    const allManuals = await db.select({ id: manuals.id, name: manuals.name }).from(manuals);
    console.log('📚 All manuals in database:');
    allManuals.forEach((manual, index) => {
      console.log(`${index + 1}. ID: ${manual.id}, Name: "${manual.name}"`);
    });

    // Test a specific lookup
    const testId = allManuals[0]?.id;
    if (testId) {
      console.log(`\n🔎 Testing lookup for ID: ${testId}`);
      const [manual] = await db.select({ name: manuals.name }).from(manuals).where(eq(manuals.id, testId)).limit(1);
      console.log('Lookup result:', manual);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugManualLookup();
