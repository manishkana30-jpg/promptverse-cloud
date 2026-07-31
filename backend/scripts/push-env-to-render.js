const fs = require('fs');
const https = require('https');
const readline = require('readline');
const path = require('path');

// Go to the backend directory
const backendDir = path.resolve(__dirname, '..');
const envPath = path.join(backendDir, '.env');

if (!fs.existsSync(envPath)) {
  console.error(`❌ Could not find .env file at ${envPath}`);
  process.exit(1);
}

// Load .env manually
const envFile = fs.readFileSync(envPath, 'utf8');
const envMap = {};

envFile.split('\n').forEach(line => {
  const match = line.match(/^([^#\s][^=]+)=(.*)$/);
  if (match) {
    envMap[match[1].trim()] = match[2].trim();
  }
});

// Add extra required ones if missing
if (!envMap['NODE_ENV']) envMap['NODE_ENV'] = 'production';
if (!envMap['PORT']) envMap['PORT'] = '5000';
if (!envMap['FRONTEND_URL']) envMap['FRONTEND_URL'] = 'https://promptversecloudai.vercel.app';
if (!envMap['BASE_URL']) envMap['BASE_URL'] = 'https://promptverse-cloud.onrender.com';

// Render API expects an array of { key, value }
const envVars = Object.keys(envMap).map(key => ({ key, value: envMap[key] }));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('=============================================');
console.log('🚀 Render Environment Variable Automator 🚀');
console.log('=============================================\n');

rl.question('1. Enter your Render API Key (Create one at https://dashboard.render.com/user/settings): ', (apiKey) => {
  rl.question('2. Enter your Render Service ID (Starts with srv-..., found in your Service Settings on Render): ', (serviceId) => {
    
    console.log('\nUploading environment variables to Render...');
    
    const data = JSON.stringify(envVars);
    
    const req = https.request({
      hostname: 'api.render.com',
      path: `/v1/services/${serviceId}/env-vars`,
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', d => responseBody += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('\n✅ Successfully uploaded environment variables to Render!');
          console.log('✅ Render should now start a new deployment automatically. Check your Render dashboard!');
        } else {
          console.log(`\n❌ Failed to upload (Status ${res.statusCode}):`);
          console.log(responseBody);
        }
        rl.close();
      });
    });

    req.on('error', (e) => {
      console.error('\n❌ Network Error:', e.message);
      rl.close();
    });

    req.write(data);
    req.end();
  });
});
