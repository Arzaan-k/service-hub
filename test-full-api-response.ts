import 'dotenv/config';
import { storage } from './server/storage';

async function testFullAPI() {
  console.log('🔍 Testing full API data flow...\n');

  try {
    const containers = await storage.getAllContainers();

    console.log('✅ Total containers fetched:', containers.length);

    if (containers.length > 0) {
      const first = containers[0];
      console.log('\n📦 First container structure:');
      console.log('All keys:', Object.keys(first).slice(0, 50));

      console.log('\n=== Direct DB columns (snake_case) ===');
      console.log('product_type:', first.product_type);
      console.log('size:', first.size);
      console.log('size_type:', first.size_type);
      console.log('group_name:', first.group_name);
      console.log('gku_product_name:', first.gku_product_name);
      console.log('category:', first.category);
      console.log('depot:', first.depot);
      console.log('available_location:', first.available_location);
      console.log('mfg_year:', first.mfg_year);
      console.log('inventory_status:', first.inventory_status);
      console.log('current:', first.current);
      console.log('grade:', first.grade);
      console.log('reefer_unit:', first.reefer_unit);
      console.log('reefer_unit_model_name:', first.reefer_unit_model_name);

      console.log('\n=== Potential camelCase versions ===');
      console.log('productType:', (first as any).productType);
      console.log('sizeType:', (first as any).sizeType);
      console.log('groupName:', (first as any).groupName);
      console.log('gkuProductName:', (first as any).gkuProductName);

      console.log('\n=== container_id / containerCode ===');
      console.log('container_id:', first.container_id);
      console.log('containerCode:', (first as any).containerCode);

      console.log('\n=== excelMetadata ===');
      console.log('Has excelMetadata?', !!(first as any).excelMetadata);
      console.log('Has excel_metadata?', !!(first as any).excel_metadata);

      if ((first as any).excelMetadata) {
        console.log('excelMetadata.productType:', (first as any).excelMetadata.productType);
      }
      if ((first as any).excel_metadata) {
        console.log('excel_metadata.Product Type:', (first as any).excel_metadata['Product Type']);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

testFullAPI();
