#!/usr/bin/env node

/**
 * Check what manual IDs are stored in Qdrant
 */

import 'dotenv/config';
import { QdrantClient } from '@qdrant/js-client-rest';

async function checkQdrantManualIds() {
  console.log('🔍 Checking Manual IDs in Qdrant\n');

  try {
    const qdrantUrl = process.env.QDRANT_URL || 'https://7f02b3b5-b0f1-4a1c-9a6b-1c0b8f0c2f7a.us-east4-0.gcp.cloud.qdrant.io';
    const qdrantKey = process.env.QDRANT_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.64bUNfBLe8l3-nce12wzvpoA-feqxbg7uHgkgSAXC7o';

    const qdrant = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantKey,
      checkCompatibility: false
    });

    console.log('📡 Connecting to Qdrant...');
    await qdrant.api('get', '/health');
    console.log('✅ Connected to Qdrant');

    // Get sample points from manual_chunks collection
    const samples = await qdrant.scroll('manual_chunks', {
      limit: 10,
      with_payload: true,
      with_vector: false
    });

    console.log('\n📋 Sample manual IDs from Qdrant:');
    const manualIds = new Set();

    samples.points?.forEach((point, index) => {
      const payload = point.payload;
      const manualId = payload?.manualId;
      const pageNum = payload?.pageNum;

      if (manualId) {
        manualIds.add(manualId);
        console.log(`${index + 1}. Manual ID: ${manualId}, Page: ${pageNum}`);
      }
    });

    console.log(`\n🔢 Unique manual IDs found in Qdrant: ${manualIds.size}`);
    console.log('Manual IDs:', Array.from(manualIds));

  } catch (error) {
    console.error('❌ Failed to check Qdrant:', error.message);
  }
}

checkQdrantManualIds();
