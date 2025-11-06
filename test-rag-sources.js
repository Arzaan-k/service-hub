async function testRAG() {
  try {
    const response = await fetch('http://localhost:5000/api/rag/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user'
      },
      body: JSON.stringify({
        query: 'What causes compressor failure?'
      })
    });

    const data = await response.json();
    console.log('RAG Response:');
    console.log('Answer:', data.answer.substring(0, 200) + '...');
    console.log('\nSources:');
    data.sources.forEach((source, i) => {
      console.log(`${i + 1}. ${source.manual_name} - Page ${source.page}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

testRAG();
