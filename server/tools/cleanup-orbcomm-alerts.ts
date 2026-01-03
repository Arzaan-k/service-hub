/**
 * Cleanup Orbcomm Alerts Script
 * 
 * This script cleans up the alerts table by:
 * 1. Removing rawData from alert metadata
 * 2. Keeping only the latest 50 alerts per container
 * 3. Removing duplicate alerts
 * 4. Deleting alerts older than 7 days (except critical ones)
 * 
 * Run with: npx tsx server/tools/cleanup-orbcomm-alerts.ts
 */

import { db } from '../db';
import { alerts } from '@shared/schema';
import { sql, eq, and, lt, desc } from 'drizzle-orm';

async function cleanupOrbcommAlerts() {
    console.log('🧹 Starting Orbcomm alerts cleanup...\n');

    try {
        // Step 1: Get total count before cleanup
        const countBefore: any = await db.execute(sql`SELECT COUNT(*) as count FROM alerts`);
        const totalBefore = parseInt(countBefore.rows?.[0]?.count || countBefore[0]?.count || '0');
        console.log(`📊 Total alerts before cleanup: ${totalBefore}`);

        // Step 2: Strip rawData from all alert metadata
        console.log('\n🔧 Stripping rawData from alert metadata...');
        const strippedResult = await db.execute(sql`
      UPDATE alerts 
      SET metadata = metadata - 'rawData'
      WHERE metadata->>'rawData' IS NOT NULL
    `);
        console.log(`   ✅ Stripped rawData from metadata`);

        // Step 3: Delete old non-critical Orbcomm alerts (older than 7 days)
        console.log('\n🗑️  Deleting old non-critical alerts (>7 days)...');
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const deleteOldResult = await db.execute(sql`
      DELETE FROM alerts 
      WHERE source = 'orbcomm' 
      AND severity NOT IN ('critical', 'high')
      AND detected_at < ${sevenDaysAgo.toISOString()}
    `);
        console.log(`   ✅ Deleted old non-critical alerts`);

        // Step 4: Delete resolved alerts older than 3 days
        console.log('\n🗑️  Deleting resolved alerts (>3 days)...');
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        await db.execute(sql`
      DELETE FROM alerts 
      WHERE resolved_at IS NOT NULL
      AND detected_at < ${threeDaysAgo.toISOString()}
    `);
        console.log(`   ✅ Deleted old resolved alerts`);

        // Step 5: Keep only latest 50 alerts per container (delete older duplicates)
        console.log('\n📉 Trimming to latest 50 alerts per container...');
        await db.execute(sql`
      DELETE FROM alerts 
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (
            PARTITION BY container_id 
            ORDER BY detected_at DESC
          ) as rn 
          FROM alerts
        ) ranked 
        WHERE rn > 50
      )
    `);
        console.log(`   ✅ Trimmed excess alerts per container`);

        // Step 6: Delete duplicate alerts (same container, same type, within 5 minutes)
        console.log('\n🔄 Removing duplicate alerts...');
        await db.execute(sql`
      DELETE FROM alerts a1
      USING alerts a2
      WHERE a1.id < a2.id
      AND a1.container_id = a2.container_id
      AND a1.alert_type = a2.alert_type
      AND a1.severity = a2.severity
      AND ABS(EXTRACT(EPOCH FROM (a1.detected_at - a2.detected_at))) < 300
    `);
        console.log(`   ✅ Removed duplicate alerts`);

        // Step 7: Get total count after cleanup
        const countAfter: any = await db.execute(sql`SELECT COUNT(*) as count FROM alerts`);
        const totalAfter = parseInt(countAfter.rows?.[0]?.count || countAfter[0]?.count || '0');

        console.log('\n================================================');
        console.log(`📊 Cleanup Summary:`);
        console.log(`   Before: ${totalBefore} alerts`);
        console.log(`   After:  ${totalAfter} alerts`);
        console.log(`   Removed: ${totalBefore - totalAfter} alerts`);
        console.log('================================================');

        // Step 8: Estimate space saved
        const spaceSaved = (totalBefore - totalAfter) * 10; // Rough estimate: ~10KB per alert with rawData
        console.log(`\n💾 Estimated space saved: ~${Math.round(spaceSaved / 1024)}MB`);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    }

    console.log('\n✅ Cleanup complete!');
    process.exit(0);
}

// Run the cleanup
cleanupOrbcommAlerts().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
