/**
 * Script to add "SOLD" status to the frontend statusMap
 * This ensures the frontend displays "Sold" instead of just "SOLD"
 */

import fs from 'fs';
import path from 'path';

async function addSoldStatusToFrontend() {
  console.log('🔄 Adding "SOLD" status to frontend statusMap...');

  try {
    // Path to the containers.tsx file
    const containersFilePath = path.join(process.cwd(), 'client', 'src', 'pages', 'containers.tsx');

    // Read the file
    let content = fs.readFileSync(containersFilePath, 'utf8');

    // Check if "SOLD" status is already in the statusMap
    if (content.includes('"SOLD"')) {
      console.log('✅ "SOLD" status already exists in frontend statusMap');
      return;
    }

    // Find the statusMap and add "SOLD" status
    const statusMapRegex = /const statusMap = \{(.*?)\n\s*\};/s;
    const statusMapMatch = content.match(statusMapRegex);

    if (statusMapMatch) {
      const existingStatuses = statusMapMatch[1];
      const newStatusMap = `const statusMap = {
      "DEPLOYED": { color: "bg-green-100 text-green-800", label: "Deployed" },
      "SALE": { color: "bg-blue-100 text-blue-800", label: "For Sale" },
      "SOLD": { color: "bg-red-100 text-red-800", label: "Sold" },
      "MAINTENANCE": { color: "bg-yellow-100 text-yellow-800", label: "Maintenance" },
      "STOCK": { color: "bg-gray-100 text-gray-800", label: "In Stock" },
    };`;

      content = content.replace(statusMapRegex, newStatusMap);
      fs.writeFileSync(containersFilePath, content, 'utf8');

      console.log('✅ Successfully added "SOLD" status to frontend statusMap');
      console.log('📝 Frontend will now display "Sold" for containers with status "SOLD"');
    } else {
      console.log('❌ Could not find statusMap in containers.tsx');
    }

  } catch (error) {
    console.error('❌ Error updating frontend statusMap:', error);
    process.exit(1);
  }
}

addSoldStatusToFrontend();






























