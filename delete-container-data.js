import { db } from './server/db.ts';
import { 
  containers, 
  containerMetrics, 
  alerts, 
  serviceRequests, 
  invoices,
  feedback,
  scheduledServices
} from './shared/schema.ts';

async function deleteAllContainerData() {
  console.log('🗑️  Starting deletion of all container data...');
  
  try {
    // First, let's check what data exists
    console.log('📊 Checking current data...');
    
    const containerCount = await db.select().from(containers);
    const metricsCount = await db.select().from(containerMetrics);
    const alertsCount = await db.select().from(alerts);
    const serviceRequestsCount = await db.select().from(serviceRequests);
    const invoicesCount = await db.select().from(invoices);
    const feedbackCount = await db.select().from(feedback);
    const scheduledServicesCount = await db.select().from(scheduledServices);
    
    console.log(`📈 Current data counts:`);
    console.log(`   - Containers: ${containerCount.length}`);
    console.log(`   - Container Metrics: ${metricsCount.length}`);
    console.log(`   - Alerts: ${alertsCount.length}`);
    console.log(`   - Service Requests: ${serviceRequestsCount.length}`);
    console.log(`   - Invoices: ${invoicesCount.length}`);
    console.log(`   - Feedback: ${feedbackCount.length}`);
    console.log(`   - Scheduled Services: ${scheduledServicesCount.length}`);
    
    if (containerCount.length === 0) {
      console.log('✅ No container data found. Database is already clean.');
      return;
    }
    
    console.log('\n⚠️  WARNING: This will delete ALL container-related data!');
    console.log('This includes:');
    console.log('  - All containers');
    console.log('  - All container metrics');
    console.log('  - All alerts');
    console.log('  - All service requests');
    console.log('  - All invoices');
    console.log('  - All feedback');
    console.log('  - All scheduled services');
    console.log('\nProceeding with deletion...\n');
    
    // Delete in the correct order to respect foreign key constraints
    console.log('1️⃣  Deleting scheduled services...');
    await db.delete(scheduledServices);
    console.log('   ✅ Scheduled services deleted');
    
    console.log('2️⃣  Deleting feedback...');
    await db.delete(feedback);
    console.log('   ✅ Feedback deleted');
    
    console.log('3️⃣  Deleting invoices...');
    await db.delete(invoices);
    console.log('   ✅ Invoices deleted');
    
    console.log('4️⃣  Deleting service requests...');
    await db.delete(serviceRequests);
    console.log('   ✅ Service requests deleted');
    
    console.log('5️⃣  Deleting alerts...');
    await db.delete(alerts);
    console.log('   ✅ Alerts deleted');
    
    console.log('6️⃣  Deleting container metrics...');
    await db.delete(containerMetrics);
    console.log('   ✅ Container metrics deleted');
    
    console.log('7️⃣  Deleting containers...');
    await db.delete(containers);
    console.log('   ✅ Containers deleted');
    
    // Verify deletion
    console.log('\n🔍 Verifying deletion...');
    const remainingContainers = await db.select().from(containers);
    const remainingMetrics = await db.select().from(containerMetrics);
    const remainingAlerts = await db.select().from(alerts);
    const remainingServiceRequests = await db.select().from(serviceRequests);
    const remainingInvoices = await db.select().from(invoices);
    const remainingFeedback = await db.select().from(feedback);
    const remainingScheduledServices = await db.select().from(scheduledServices);
    
    console.log('📊 Remaining data counts:');
    console.log(`   - Containers: ${remainingContainers.length}`);
    console.log(`   - Container Metrics: ${remainingMetrics.length}`);
    console.log(`   - Alerts: ${remainingAlerts.length}`);
    console.log(`   - Service Requests: ${remainingServiceRequests.length}`);
    console.log(`   - Invoices: ${remainingInvoices.length}`);
    console.log(`   - Feedback: ${remainingFeedback.length}`);
    console.log(`   - Scheduled Services: ${remainingScheduledServices.length}`);
    
    if (remainingContainers.length === 0) {
      console.log('\n✅ SUCCESS: All container data has been successfully deleted!');
    } else {
      console.log('\n❌ ERROR: Some container data still remains. Please check the database.');
    }
    
  } catch (error) {
    console.error('❌ Error deleting container data:', error);
    throw error;
  }
}

// Run the deletion
deleteAllContainerData()
  .then(() => {
    console.log('\n🎉 Container data deletion completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Container data deletion failed:', error);
    process.exit(1);
  });
