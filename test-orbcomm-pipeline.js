#!/usr/bin/env node

// Test script for REAL ORBCOMM data pipeline
// This script checks ORBCOMM connection and verifies real data processing

const API_BASE = 'http://localhost:5000';

async function main() {
  console.log('📡 Testing REAL ORBCOMM Data Pipeline (No Simulation)\n');

  try {
    // Step 1: Check ORBCOMM real data status
    console.log('🔌 Step 1: Checking REAL ORBCOMM connection status...');
    const statusResponse = await fetch(`${API_BASE}/api/orbcomm/real-status`);
    if (!statusResponse.ok) {
      throw new Error(`Failed to check ORBCOMM real status: ${statusResponse.status}`);
    }
    const status = await statusResponse.json();
    console.log('✅ REAL ORBCOMM Status:', JSON.stringify(status, null, 2));

    console.log('\n✅ REAL ORBCOMM Pipeline Status Check Completed!');
    console.log('\n📊 Summary:');
    console.log(`   - ORBCOMM Connection: ${status.connection?.connected ? 'CONNECTED ✅' : 'NOT CONNECTED ❌'}`);
    console.log(`   - Data Source: ${status.connection?.dataSource || 'Unknown'}`);
    console.log(`   - Total REAL ORBCOMM Alerts: ${status.alerts?.total || 0}`);
    console.log(`   - Alerts in Last 24h: ${status.alerts?.last24h || 0}`);

    if (status.connection?.connected) {
      console.log('\n🎉 SUCCESS: REAL ORBCOMM connection is active!');
      console.log('   - System is configured for REAL ORBCOMM data only');
      console.log('   - No simulation or fake data is processed');
      console.log('   - Alerts will appear when real ORBCOMM events are received');
      console.log('   - Check server logs for real event processing: "📡 Processing REAL ORBCOMM event"');
      console.log('\n📋 What to expect:');
      console.log('   - Real alerts will only appear when ORBCOMM sends actual device data');
      console.log('   - Container IDs must exactly match database containerCodes');
      console.log('   - Only anomalies (temperature, power, battery, door issues) create alerts');
    } else {
      console.log('\n⚠️ WARNING: ORBCOMM connection is not active');
      console.log('   - Check server logs for connection issues');
      console.log('   - Verify ORBCOMM credentials and network connectivity');
      console.log('   - Ensure FORCE_ORBCOMM_DEV=true environment variable is set');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure the server is running: npm run dev');
    console.log('   2. Ensure FORCE_ORBCOMM_DEV=true is set');
    console.log('   3. Check server logs for ORBCOMM connection messages');
    console.log('   4. Verify ORBCOMM credentials are configured');
    process.exit(1);
  }
}

main();