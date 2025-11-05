#!/usr/bin/env node

/**
 * Script to inspect Qdrant collections and show what manual names/content are stored
 * This helps understand what PDFs are stored in each collection for RAG processing
 */

import 'dotenv/config';
import { db } from './server/db.js';
import { QdrantClient } from '@qdrant/js-client-rest';
import { manuals } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function inspectQdrantCollections() {
  console.log('🔍 Inspecting Qdrant Collections - Manual Names & Content');
  console.log('═'.repeat(60));

  try {
    // First, get all manuals from database
    console.log('\n📚 Fetching manual names from database...');
    const allManuals = await db.select({
      id: manuals.id,
      name: manuals.name,
      meta: manuals.meta
    }).from(manuals);

    console.log(`Found ${allManuals.length} manuals in database:`);
    allManuals.forEach((manual, index) => {
      console.log(`${index + 1}. ${manual.name} (ID: ${manual.id})`);
      if (manual.meta) {
        const meta = typeof manual.meta === 'object' ? manual.meta : JSON.parse(manual.meta);
        if (meta.brand || meta.model) {
          console.log(`   Brand: ${meta.brand || 'N/A'}, Model: ${meta.model || 'N/A'}`);
        }
      }
    });

    console.log('\n' + '═'.repeat(60));

    // Collection 1: Local Qdrant (manual_chunks)
    console.log('\n🏠 COLLECTION 1: Local Qdrant (manual_chunks)');
    console.log('─'.repeat(40));

    const localQdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
    const localQdrant = new QdrantClient({ url: localQdrantUrl });

    try {
      await localQdrant.api('get', '/health');
      console.log('✅ Local Qdrant connection successful');

      const localCollection = await localQdrant.getCollection('manual_chunks');
      console.log(`📊 Points count: ${localCollection.points_count || 0}`);

      // Get sample points
      const localSamples = await localQdrant.scroll('manual_chunks', {
        limit: 10,
        with_payload: true,
        with_vector: false
      });

      console.log('\n📄 Sample entries from local collection:');
      localSamples.points?.forEach((point, index) => {
        const payload = point.payload;
        const manualId = payload?.manualId || 'unknown';
        const pageNum = payload?.pageNum || 'N/A';
        const textPreview = (payload?.text || '').substring(0, 100) + '...';

        // Find manual name from database
        const manual = allManuals.find(m => m.id === manualId);
        const manualName = manual?.name || `Manual ID: ${manualId}`;

        console.log(`${index + 1}. ${manualName}`);
        console.log(`   Page: ${pageNum}, Text: "${textPreview}"`);

        if (payload?.metadata) {
          const meta = payload.metadata;
          const metadataStr = [];
          if (meta.brand) metadataStr.push(`Brand: ${meta.brand}`);
          if (meta.model) metadataStr.push(`Model: ${meta.model}`);
          if (meta.heading) metadataStr.push(`Heading: ${meta.heading.substring(0, 50)}`);
          if (metadataStr.length > 0) {
            console.log(`   Metadata: ${metadataStr.join(', ')}`);
          }
        }
        console.log('');
      });

    } catch (error) {
      console.log('❌ Local Qdrant connection failed:', error.message);
    }

    // Collection 2: Cloud Qdrant (manual_chunks)
    console.log('\n☁️  COLLECTION 2: Cloud Qdrant (manual_chunks)');
    console.log('─'.repeat(40));

    const cloudQdrantUrl = process.env.QDRANT_URL || 'https://7f02b3b5-b0f1-4a1c-9a6b-1c0b8f0c2f7a.us-east4-0.gcp.cloud.qdrant.io';
    const cloudQdrantKey = process.env.QDRANT_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.64bUNfBLe8l3-nce12wzvpoA-feqxbg7uHgkgSAXC7o';

    const cloudQdrant = new QdrantClient({
      url: cloudQdrantUrl,
      apiKey: cloudQdrantKey,
      checkCompatibility: false
    });

    try {
      await cloudQdrant.api('get', '/health');
      console.log('✅ Cloud Qdrant connection successful');

      const cloudCollection = await cloudQdrant.getCollection('manual_chunks');
      console.log(`📊 Points count: ${cloudCollection.points_count || 0}`);

      // Get sample points
      const cloudSamples = await cloudQdrant.scroll('manual_chunks', {
        limit: 10,
        with_payload: true,
        with_vector: false
      });

      console.log('\n📄 Sample entries from cloud collection:');
      cloudSamples.points?.forEach((point, index) => {
        const payload = point.payload;
        const manualId = payload?.manualId || 'unknown';
        const pageNum = payload?.pageNum || 'N/A';
        const textPreview = (payload?.text || '').substring(0, 100) + '...';

        // Find manual name from database
        const manual = allManuals.find(m => m.id === manualId);
        const manualName = manual?.name || `Manual ID: ${manualId}`;

        console.log(`${index + 1}. ${manualName}`);
        console.log(`   Page: ${pageNum}, Text: "${textPreview}"`);

        if (payload?.metadata) {
          const meta = payload.metadata;
          const metadataStr = [];
          if (meta.brand) metadataStr.push(`Brand: ${meta.brand}`);
          if (meta.model) metadataStr.push(`Model: ${meta.model}`);
          if (meta.heading) metadataStr.push(`Heading: ${meta.heading.substring(0, 50)}`);
          if (metadataStr.length > 0) {
            console.log(`   Metadata: ${metadataStr.join(', ')}`);
          }
        }
        console.log('');
      });

    } catch (error) {
      console.log('❌ Cloud Qdrant connection failed:', error.message);
    }

    // Collection 3: MP4000 Specialized Collection
    console.log('\n🔧 COLLECTION 3: MP4000 Specialized (mp4000_manual_chunks)');
    console.log('─'.repeat(50));

    try {
      const mp4000Collection = await cloudQdrant.getCollection('mp4000_manual_chunks');
      console.log(`📊 Points count: ${mp4000Collection.points_count || 0}`);

      // Get sample points
      const mp4000Samples = await cloudQdrant.scroll('mp4000_manual_chunks', {
        limit: 10,
        with_payload: true,
        with_vector: false
      });

      console.log('\n📄 Sample entries from MP4000 collection:');
      mp4000Samples.points?.forEach((point, index) => {
        const payload = point.payload;
        const manualName = payload?.manual_name || 'unknown';
        const page = payload?.page || 'N/A';
        const textPreview = (payload?.text || '').substring(0, 100) + '...';

        console.log(`${index + 1}. ${manualName}`);
        console.log(`   Page: ${page}, Text: "${textPreview}"`);
        console.log('');
      });

    } catch (error) {
      console.log('❌ MP4000 collection access failed:', error.message);
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Inspection complete!');

    // Summary
    console.log('\n📋 SUMMARY:');
    console.log(`- Total manuals in database: ${allManuals.length}`);
    console.log('- Manual names found:', allManuals.map(m => m.name).join(', '));

  } catch (error) {
    console.error('❌ Error inspecting collections:', error.message);
  }
}

// Run the inspection
inspectQdrantCollections();
