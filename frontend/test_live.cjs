const https = require('https');

function fetchWithTimeout(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, data }));
    });
    
    req.on('error', err => reject(err));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function testLive() {
  console.log("--- Starting E2E Live Tests ---");
  
  // 1. Test Vercel Frontend
  try {
    const fe = await fetchWithTimeout('https://frontend-mu-three-52.vercel.app');
    console.log(`[Frontend] Vercel Status: ${fe.statusCode}`);
  } catch (err) {
    console.log(`[Frontend] Error: ${err.message}`);
  }

  // 2. Test Render Backend Health
  try {
    const beHealth = await fetchWithTimeout('https://promptverse-cloud.onrender.com/api/health');
    console.log(`[Backend Health] Render Status: ${beHealth.statusCode}, Data: ${beHealth.data}`);
  } catch (err) {
    console.log(`[Backend Health] Error: ${err.message}`);
  }

  // 3. Test Render Database Connection (Community Feed)
  try {
    const beFeed = await fetchWithTimeout('https://promptverse-cloud.onrender.com/api/community/feed?limit=1');
    console.log(`[Backend API] Community Feed Status: ${beFeed.statusCode}`);
    if (beFeed.statusCode === 200) {
      console.log(`[Backend API] Success! Database is connected and returning rows.`);
    } else {
      console.log(`[Backend API] Failure data: ${beFeed.data.slice(0, 200)}`);
    }
  } catch (err) {
    console.log(`[Backend API] Error: ${err.message}`);
  }
}

testLive();
