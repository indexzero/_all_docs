// Simple test script for the Node.js worker
import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3000';

async function testWorker() {
  console.log('Testing Node.js worker...\n');
  
  // Test health endpoint
  try {
    const healthRes = await fetch(`${baseUrl}/health`);
    const health = await healthRes.json();
    console.log('Health check:', health);
  } catch (error) {
    console.error('Health check failed:', error.message);
    console.log('Make sure the worker is running with: node node.js');
    process.exit(1);
  }
  
  // Test partition work endpoint
  try {
    const workItem = {
      id: 'test-partition-1',
      type: 'partition',
      payload: {
        startKey: 'a',
        endKey: 'b'
      },
      priority: 1,
      attempts: 0
    };
    
    const res = await fetch(`${baseUrl}/work/partition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workItem)
    });
    
    const result = await res.json();
    console.log('\nPartition work result:', result);
  } catch (error) {
    console.error('Partition work test failed:', error.message);
  }
  
  // Test packument work endpoint
  try {
    const workItem = {
      id: 'test-packument-1',
      type: 'packument',
      payload: {
        packageName: 'express'
      },
      priority: 1,
      attempts: 0
    };
    
    const res = await fetch(`${baseUrl}/work/packument`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workItem)
    });
    
    const result = await res.json();
    console.log('\nPackument work result:', result);
  } catch (error) {
    console.error('Packument work test failed:', error.message);
  }
  
  // Test invalid request
  try {
    const res = await fetch(`${baseUrl}/work/partition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: 'data' })
    });
    
    const result = await res.json();
    console.log('\nInvalid request result:', result);
  } catch (error) {
    console.error('Invalid request test failed:', error.message);
  }
}

// Add delay to allow server to start
setTimeout(testWorker, 1000);