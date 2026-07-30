require('dotenv').config();

async function testGeneration() {
  console.log('Testing voiceover generation...');
  const res = await fetch('http://localhost:3000/api/generate-scene/voiceover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: '6426b50f-9034-48b2-b62a-7ea84138f7b4',
      scene_id: '00000000-0000-0000-0000-000000000000',
      text: 'Welcome to PromptVerse. This is a real AI generated voiceover test!'
    })
  });

  const data = await res.json();
  console.log('Response:', data);

  if (data.url) {
    console.log('✅ Voiceover successfully generated and returned url:', data.url);
  } else {
    console.error('❌ Failed to return voiceover url');
  }
}

testGeneration();
