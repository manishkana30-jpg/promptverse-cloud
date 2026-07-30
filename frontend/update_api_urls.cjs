const fs = require('fs');
const path = require('path');

const API_VAR = '`${import.meta.env.VITE_API_URL || ""}/api';

const files = [
  'store/useStoryboardStore.ts',
  'pages/WatchPage.tsx',
  'pages/ExplorePage.tsx',
  'pages/AdminDashboard.tsx',
  'pages/AdminAnalytics.tsx',
  'components/StoryboardTimeline.tsx',
  'components/SocialShareButton.tsx',
  'components/RateGeneration.tsx',
  'components/PricingTiers.tsx',
  'components/InviteFriend.tsx'
];

const basePath = 'c:\\Users\\manis\\Downloads\\PromptVerse cloud AI\\frontend\\src';

files.forEach(file => {
  const filePath = path.join(basePath, file);
  if (!fs.existsSync(filePath)) {
    console.log('Not found:', filePath);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace http://127.0.0.1:5000/api
  content = content.replace(/['"`]http:\/\/127\.0\.0\.1:5000\/api/g, '`${import.meta.env.VITE_API_URL || ""}/api');
  content = content.replace(/['"`]http:\/\/localhost:5000\/api/g, '`${import.meta.env.VITE_API_URL || ""}/api');
  
  // Replace '/api/...'
  content = content.replace(/['"]\/api\//g, '`${import.meta.env.VITE_API_URL || ""}/api/');
  content = content.replace(/`\/api\//g, '`${import.meta.env.VITE_API_URL || ""}/api/');
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated:', filePath);
});
