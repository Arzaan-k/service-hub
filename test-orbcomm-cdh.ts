import { startOrbcommClient, stopOrbcommClient, getOrbcommClient } from './server/services/orbcommClient';
import { logOrbcommAlert, closeOrbcommLogger } from './server/services/orbcommLogger';

/**
 * Standalone test script for Orbcomm CDH WebSocket connection
 *
 * Usage:
 *   npx tsx test-orbcomm-cdh.ts
 *
 * This script will:
 * 1. Connect to Orbcomm CDH production server
 * 2. Subscribe to real-time alerts
 * 3. Log all alerts to console and Excel
 * 4. Run for 5 minutes (or until Ctrl+C)
 */

const TEST_DURATION = 5 * 60 * 1000; // 5 minutes

async function testOrbcommCDH() {
  console.log('\n🧪 ============================================');
  console.log('🧪 Orbcomm CDH WebSocket Connection Test');
  console.log('🧪 ============================================\n');

  console.log('📋 Test Configuration:');
  console.log(`   - Duration: ${TEST_DURATION / 1000} seconds`);
  console.log(`   - Server: wss://wamc.wamcentral.net:44355/cdh`);
  console.log(`   - Protocol: cdh.orbcomm.com`);
  console.log(`   - Excel Logs: logs/orbcomm/`);
  console.log('');

  let alertCount = 0;
  const startTime = Date.now();

  try {
    // Start Orbcomm client with alert handler
    console.log('🚀 Starting Orbcomm CDH client...\n');

    await startOrbcommClient(async (alert) => {
      alertCount++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log('\n' + '='.repeat(80));
      console.log(`🔔 Alert #${alertCount} (${elapsed}s elapsed)`);
      console.log('='.repeat(80));
      console.log('📨 Raw Alert Data:');
      console.log(JSON.stringify(alert, null, 2));
      console.log('='.repeat(80) + '\n');

      // Log to Excel
      try {
        await logOrbcommAlert(alert);
        console.log('✅ Logged to Excel');
      } catch (error) {
        console.error('❌ Failed to log to Excel:', error);
      }
    });

    console.log('✅ Client started successfully!\n');
    console.log('⏳ Waiting for alerts...');
    console.log('   (Press Ctrl+C to stop early)\n');

    // Print status every 30 seconds
    const statusInterval = setInterval(() => {
      const client = getOrbcommClient();
      const stats = client?.getStats();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

      console.log(`\n📊 Status Update (${elapsed}s elapsed):`);
      console.log(`   - Connected: ${stats?.connected ? '✅' : '❌'}`);
      console.log(`   - Subscribed: ${stats?.isSubscribed ? '✅' : '❌'}`);
      console.log(`   - Total Alerts: ${stats?.totalAlertsReceived || 0}`);
      console.log(`   - Errors: ${stats?.errors || 0}`);
      console.log(`   - Reconnect Attempts: ${stats?.reconnectAttempts || 0}`);
      console.log(`   - Queue Length: ${stats?.queueLength || 0}`);
      if (stats?.lastAlertAt) {
        console.log(`   - Last Alert: ${stats.lastAlertAt.toISOString()}`);
      }
      console.log('');
    }, 30000);

    // Stop after test duration
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        clearInterval(statusInterval);
        resolve();
      }, TEST_DURATION);
    });

    console.log('\n⏰ Test duration completed\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    throw error;

  } finally {
    // Stop client and close logger
    console.log('🛑 Stopping Orbcomm CDH client...');
    stopOrbcommClient();

    console.log('💾 Closing Excel logger...');
    await closeOrbcommLogger();

    // Print summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(80));
    console.log('📊 Test Summary');
    console.log('='.repeat(80));
    console.log(`✅ Test completed successfully`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`🔔 Total Alerts Received: ${alertCount}`);
    if (alertCount > 0) {
      console.log(`📈 Average Rate: ${(alertCount / (duration / 60)).toFixed(2)} alerts/min`);
    }
    console.log('='.repeat(80) + '\n');

    process.exit(0);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Received SIGINT (Ctrl+C), shutting down gracefully...\n');

  stopOrbcommClient();
  await closeOrbcommLogger();

  console.log('✅ Shutdown complete\n');
  process.exit(0);
});

// Run the test
testOrbcommCDH().catch((error) => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
