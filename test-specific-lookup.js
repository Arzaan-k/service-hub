#!/usr/bin/env node

/**
 * Test specific manual ID lookup
 */

import 'dotenv/config';
import { db } from './server/db.js';
import { manuals } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function testSpecificLookup() {
  console.log('🔍 Testing Specific Manual ID Lookup\n');

  const testIds = [
    '734d2219-ccd4-4613-9fd0-7228692e3c4f', // Thermoking MAGNUM SL mP4000 TK 548414PM
    '0df5ac39-2078-4412-b2b7-f51e201bf3f5', // ThermoKing Mp4000 TK-61110-4-OP
  ];

  try {
    for (const testId of testIds) {
      console.log(`🔎 Testing lookup for ID: ${testId}`);

      try {
        const [manual] = await db.select({ name: manuals.name }).from(manuals).where(eq(manuals.id, testId)).limit(1);
        console.log('Lookup result:', manual);

        if (manual) {
          console.log(`✅ Found manual: "${manual.name}"`);
        } else {
          console.log('❌ No manual found');
        }
      } catch (error) {
        console.error('❌ Lookup error:', error.message);
      }

      console.log('─'.repeat(40));
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSpecificLookup();
