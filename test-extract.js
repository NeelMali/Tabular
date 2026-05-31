/**
 * Quick test script — run with: node test-extract.js
 * Tests the extraction API with the AmesHousing.csv file.
 */
import fs from 'fs';
import path from 'path';

const API = 'http://localhost:5173/api';
const CSV_PATH = 'C:\\Users\\neelm\\Documents\\codes\\pracs\\house-pred-pro-1\\data\\AmesHousing.csv';

async function test() {
  console.log('\n🔍 Testing TableForge API...\n');

  // 1. Health check
  console.log('1️⃣  Health check...');
  const health = await fetch(`http://localhost:3000/api/health`);
  console.log('   ', await health.json());

  // 2. Upload & extract
  console.log('\n2️⃣  Uploading AmesHousing.csv...');

  if (!fs.existsSync(CSV_PATH)) {
    console.error('   ❌ File not found:', CSV_PATH);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(CSV_PATH);
  const blob = new Blob([fileBuffer], { type: 'text/csv' });

  const form = new FormData();
  form.append('file', blob, 'AmesHousing.csv');
  form.append('columns', JSON.stringify([
    'Address', 'Sale Price', 'Lot Area', 'Year Built', 'Overall Quality'
  ]));

  console.log('   📤 Sending to API (this may take 30-60 seconds)...');
  const start = Date.now();

  try {
    const res = await fetch(`${API}/extract`, {
      method: 'POST',
      body: form
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    if (!res.ok) {
      const err = await res.json();
      console.error(`   ❌ Error (${res.status}):`, err.error);
      return;
    }

    const result = await res.json();
    console.log(`   ✅ Success in ${elapsed}s!`);
    console.log(`   📊 Extracted ${result.rowCount} rows`);
    console.log(`   📋 Columns: ${result.columns.join(', ')}`);
    console.log('\n   First 3 rows:');
    result.data.slice(0, 3).forEach((row, i) => {
      console.log(`   [${i + 1}]`, JSON.stringify(row));
    });

    // 3. Check history
    console.log('\n3️⃣  Checking history...');
    const histRes = await fetch(`${API}/extractions`);
    const history = await histRes.json();
    console.log(`   📚 ${history.length} extraction(s) in history`);

  } catch (err) {
    console.error('   ❌ Request failed:', err.message);
  }

  console.log('\n✨ Test complete!\n');
}

test();
