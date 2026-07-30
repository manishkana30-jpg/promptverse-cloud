const fs = require('fs');
const path = require('path');

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
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace mismatched single or double quotes at the end of the URL
  // We look for: `${import.meta.env.VITE_API_URL || ""}/api/some-path' or "
  // and replace the ' or " with `
  content = content.replace(/(`\$\{import\.meta\.env\.VITE_API_URL \|\| ""\}\/api\/[^'"`\n]+)['"]/g, '$1`');
  
  // Also check if there are cases like `${import.meta.env.VITE_API_URL || ""}/api/something';
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed:', filePath);
});
