async function testAPI() {
  try {
    const response = await fetch('http://localhost:5000/api/containers');
    const data = await response.json();

    console.log('✅ API Response:');
    console.log('Total containers:', data.length);

    if (data.length > 0) {
      const sample = data[0];
      console.log('\n📦 First container:');
      console.log('- ID:', sample.id);
      console.log('- container_id:', sample.containerCode || sample.container_id);
      console.log('- product_type:', sample.product_type);
      console.log('- depot:', sample.depot);
      console.log('- grade:', sample.grade);
      console.log('- reefer_unit:', sample.reefer_unit);
      console.log('- inventory_status:', sample.inventory_status);

      // Count containers with reefer data
      const withReeferData = data.filter((c: any) => c.product_type).length;
      console.log('\n✅ Containers with product_type:', withReeferData);
      console.log('❌ Containers without product_type:', data.length - withReeferData);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAPI();
