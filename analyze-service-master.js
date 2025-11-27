import XLSX from 'xlsx';
const workbook = XLSX.readFile('Serivce Master.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });

console.log('=== EXCEL FILE ANALYSIS ===');
console.log('Sheet name:', sheetName);
console.log('Total rows:', data.length);
console.log('');
console.log('=== ALL COLUMN NAMES ===');
const columns = Object.keys(data[0] || {});
columns.forEach((col, i) => console.log((i+1) + '. ' + col));

console.log('');
console.log('=== SAMPLE DATA (First 3 rows) ===');
data.slice(0, 3).forEach((row, i) => {
  console.log('--- Row', i+1, '---');
  Object.entries(row).forEach(([k, v]) => {
    if (v !== null && v !== '') console.log('  ' + k + ':', v);
  });
});

// Look for PM / Preventive Maintenance related columns
console.log('');
console.log('=== PM/PREVENTIVE MAINTENANCE RELATED COLUMNS ===');
const pmColumns = columns.filter(c => 
  c.toLowerCase().includes('pm') || 
  c.toLowerCase().includes('preventive') ||
  c.toLowerCase().includes('maintenance') ||
  c.toLowerCase().includes('job type') ||
  c.toLowerCase().includes('work type') ||
  c.toLowerCase().includes('service type')
);
pmColumns.forEach(col => console.log('- ' + col));

// Check unique values in Job Type and Work Type
console.log('');
console.log('=== UNIQUE JOB TYPES ===');
const jobTypes = [...new Set(data.map(r => r['Job Type']).filter(Boolean))];
jobTypes.forEach(jt => console.log('- ' + jt));

console.log('');
console.log('=== UNIQUE WORK TYPES ===');
const workTypes = [...new Set(data.map(r => r['Work Type']).filter(Boolean))];
workTypes.forEach(wt => console.log('- ' + wt));

console.log('');
console.log('=== UNIQUE SERVICE TYPES ===');
const serviceTypes = [...new Set(data.map(r => r['Service Type']).filter(Boolean))];
serviceTypes.forEach(st => console.log('- ' + st));

// Count PM vs non-PM records (fixed to check for PREVENTIVE MAINTENANCE)
console.log('');
console.log('=== PM VS BREAKDOWN COUNTS ===');
const pmCount = data.filter(r => 
  (r['Work Type'] || '').toUpperCase().includes('PREVENTIVE') ||
  (r['Work Type'] || '').toUpperCase().includes('PM')
).length;
console.log('PM records:', pmCount);
console.log('Breakdown/Other records:', data.length - pmCount);

// Show containers with PM records
console.log('');
console.log('=== SAMPLE PM RECORDS ===');
const pmRecords = data.filter(r => 
  (r['Work Type'] || '').toUpperCase().includes('PREVENTIVE') ||
  (r['Work Type'] || '').toUpperCase().includes('PM')
).slice(0, 10);

pmRecords.forEach((row, i) => {
  console.log('--- PM Record', i+1, '---');
  console.log('  Container:', row['Container No'] || row['Container Number'] || row['Container No_1']);
  console.log('  Job Order:', row['Job Order No.'] || row['Job Order No']);
  console.log('  Job Type:', row['Job Type']);
  console.log('  Work Type:', row['Work Type']);
  console.log('  Service Type:', row['Service Type']);
  console.log('  Client:', row['Client Name']);
  console.log('  Technician:', row['Technician Name']);
  console.log('  Date:', row['Complaint Attended Date'] || row['Timestamp_5']);
});

// Summary by Work Type
console.log('');
console.log('=== RECORDS BY WORK TYPE ===');
const workTypeCounts = {};
data.forEach(r => {
  const wt = r['Work Type'] || 'UNKNOWN';
  workTypeCounts[wt] = (workTypeCounts[wt] || 0) + 1;
});
Object.entries(workTypeCounts).sort((a, b) => b[1] - a[1]).forEach(([wt, count]) => {
  console.log('  ' + wt + ': ' + count);
});

// Summary by Client
console.log('');
console.log('=== TOP 10 CLIENTS BY SERVICE COUNT ===');
const clientCounts = {};
data.forEach(r => {
  const client = r['Client Name'] || r['Client Name_1'] || 'UNKNOWN';
  clientCounts[client] = (clientCounts[client] || 0) + 1;
});
Object.entries(clientCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([client, count]) => {
  console.log('  ' + client + ': ' + count);
});

// Summary by Technician
console.log('');
console.log('=== TOP 10 TECHNICIANS BY SERVICE COUNT ===');
const techCounts = {};
data.forEach(r => {
  const tech = r['Technician Name'] || r['Technician Name_1'] || 'UNKNOWN';
  techCounts[tech] = (techCounts[tech] || 0) + 1;
});
Object.entries(techCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([tech, count]) => {
  console.log('  ' + tech + ': ' + count);
});

// Containers with most services
console.log('');
console.log('=== TOP 10 CONTAINERS BY SERVICE COUNT ===');
const containerCounts = {};
data.forEach(r => {
  const container = r['Container No'] || r['Container Number'] || r['Container No_1'] || r['Container Number_1'];
  if (container) containerCounts[container] = (containerCounts[container] || 0) + 1;
});
Object.entries(containerCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([container, count]) => {
  console.log('  ' + container + ': ' + count);
});
