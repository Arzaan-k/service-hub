/**
 * Feature Validation Script
 * 
 * This script validates that all critical features are properly configured
 * and prevents deployment if any issues are found.
 * 
 * Run with: npx tsx server/scripts/validate-features.ts
 */

import { storage } from '../storage';

interface ValidationResult {
  feature: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message: string;
}

const results: ValidationResult[] = [];

function log(feature: string, status: 'PASS' | 'FAIL' | 'WARN', message: string) {
  results.push({ feature, status, message });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${feature}] ${message}`);
}

async function validateStorageMethods() {
  console.log('\n🔍 Validating Storage Methods...\n');

  const requiredMethods = [
    'getTechnicianDocuments',
    'getTechnicianDocument',
    'createTechnicianDocument',
    'updateTechnicianDocument',
    'deleteTechnicianDocument',
    'getTechnicianByUserId',
    'getAllServiceRequests',
    'getServiceRequest',
    'getServiceRequestsByTechnician',
    'getDuplicateContainerCounts',
    'getDuplicateContainers',
    'getContainer',
    'getCustomer',
    'getTechnician',
    'getAllTechnicians',
    'updateTechnician',
  ];

  for (const method of requiredMethods) {
    if (typeof (storage as any)[method] === 'function') {
      log('Storage', 'PASS', `Method ${method}() exists`);
    } else {
      log('Storage', 'FAIL', `Method ${method}() is MISSING`);
    }
  }
}

async function validateDatabaseConnection() {
  console.log('\n🔍 Validating Database Connection...\n');

  try {
    // Try to fetch a simple record
    const technicians = await storage.getAllTechnicians();
    log('Database', 'PASS', `Connected successfully (${technicians.length} technicians found)`);
  } catch (error: any) {
    log('Database', 'FAIL', `Connection failed: ${error.message}`);
  }
}

async function validateDuplicateDetection() {
  console.log('\n🔍 Validating Duplicate Container Detection...\n');

  try {
    const duplicateCounts = await storage.getDuplicateContainerCounts();
    const duplicatesFound = Array.from(duplicateCounts.values()).filter(count => count > 1).length;
    
    if (duplicatesFound > 0) {
      log('Duplicates', 'PASS', `Duplicate detection working (${duplicatesFound} containers with duplicates)`);
    } else {
      log('Duplicates', 'WARN', 'No duplicate containers found (this may be normal)');
    }
  } catch (error: any) {
    log('Duplicates', 'FAIL', `Duplicate detection failed: ${error.message}`);
  }
}

async function validateTechnicianDocuments() {
  console.log('\n🔍 Validating Technician Document System...\n');

  try {
    const technicians = await storage.getAllTechnicians();
    
    if (technicians.length === 0) {
      log('Documents', 'WARN', 'No technicians found to test document system');
      return;
    }

    const testTech = technicians[0];
    const documents = await storage.getTechnicianDocuments(testTech.id);
    
    log('Documents', 'PASS', `Document retrieval working (${documents.length} documents for ${testTech.id})`);

    // Test document retrieval if any exist
    if (documents.length > 0) {
      const doc = await storage.getTechnicianDocument(documents[0].id);
      if (doc) {
        log('Documents', 'PASS', `Single document retrieval working`);
      } else {
        log('Documents', 'FAIL', `Single document retrieval failed`);
      }
    }
  } catch (error: any) {
    log('Documents', 'FAIL', `Document system failed: ${error.message}`);
  }
}

async function validateServiceRequests() {
  console.log('\n🔍 Validating Service Request System...\n');

  try {
    const requests = await storage.getAllServiceRequests();
    log('Service Requests', 'PASS', `Service request retrieval working (${requests.length} requests)`);

    // Check if isDuplicate and duplicateCount fields are present
    if (requests.length > 0) {
      const firstRequest = requests[0];
      if ('isDuplicate' in firstRequest && 'duplicateCount' in firstRequest) {
        log('Service Requests', 'PASS', 'Duplicate detection fields present in service requests');
      } else {
        log('Service Requests', 'FAIL', 'Duplicate detection fields MISSING from service requests');
      }
    }
  } catch (error: any) {
    log('Service Requests', 'FAIL', `Service request system failed: ${error.message}`);
  }
}

async function validateEnvironmentVariables() {
  console.log('\n🔍 Validating Environment Variables...\n');

  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
  ];

  const optionalVars = [
    'MAILGUN_API_KEY',
    'MAILGUN_DOMAIN',
    'EMAIL_USER',
    'EMAIL_PASS',
    'CLIENT_URL',
  ];

  for (const varName of requiredVars) {
    if (process.env[varName]) {
      log('Environment', 'PASS', `${varName} is set`);
    } else {
      log('Environment', 'FAIL', `${varName} is MISSING (required)`);
    }
  }

  for (const varName of optionalVars) {
    if (process.env[varName]) {
      log('Environment', 'PASS', `${varName} is set`);
    } else {
      log('Environment', 'WARN', `${varName} is not set (optional)`);
    }
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 VALIDATION REPORT');
  console.log('='.repeat(60) + '\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`📝 Total Checks: ${results.length}\n`);

  if (failed > 0) {
    console.log('❌ VALIDATION FAILED - Please fix the following issues:\n');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • [${r.feature}] ${r.message}`);
    });
    console.log('\n');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('⚠️  VALIDATION PASSED WITH WARNINGS\n');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`   • [${r.feature}] ${r.message}`);
    });
    console.log('\n');
  } else {
    console.log('✅ ALL VALIDATIONS PASSED!\n');
  }

  console.log('='.repeat(60) + '\n');
}

async function main() {
  console.log('\n🚀 Starting Feature Validation...\n');

  await validateEnvironmentVariables();
  await validateDatabaseConnection();
  await validateStorageMethods();
  await validateDuplicateDetection();
  await validateTechnicianDocuments();
  await validateServiceRequests();
  await generateReport();
}

// Run validation
main().catch(error => {
  console.error('\n❌ Validation script crashed:', error);
  process.exit(1);
});
