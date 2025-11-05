// Test script to verify dropdown functionality
import React, { useEffect } from 'react';
import ReeferDiagnosticChat from './components/rag/ReeferDiagnosticChat';

function TestComponent() {
  useEffect(() => {
    console.log('TestComponent mounted - dropdown should be visible');
  }, []);

  return (
    <div className="p-8 bg-gray-900 min-h-screen">
      <h1 className="text-white text-2xl mb-4">Testing Reefer Diagnostic Chat</h1>
      <div className="border-2 border-red-500 p-4 mb-4">
        <p className="text-white">If you see this red box, the component should load below:</p>
      </div>
      <ReeferDiagnosticChat />
    </div>
  );
}

export default TestComponent;
