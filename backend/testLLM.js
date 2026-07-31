require('dotenv').config();
const axios = require('axios');

async function testLLM() {
  const idea = 'a magical forest where trees can talk';
  const systemInstruction = `You are an expert AI Movie Director. 
Given the following raw idea, expand it into a full story.
Extract characters (type: 'human', 'animal', or 'object') and break down scenes.
Determine if each scene has dialogue (has_dialogue) and write the dialogue if applicable.
List which character IDs are present in each scene.

Return strictly as JSON matching this schema:
{
  "expanded_story": "...",
  "characters": [
    { "temp_id": "char_1", "name": "...", "type": "human", "description": "..." }
  ],
  "scenes": [
    { "scene_index": 1, "location": "...", "prompt": "...", "dialogue": "...", "has_dialogue": true, "character_ids_present": ["char_1"] }
  ]
}`;

  const headers = {
    'Authorization': `Bearer ${process.env.LLM_API_KEY}`,
    'Content-Type': 'application/json',
  };

  const response = await axios.post(
    `${process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'}/chat/completions`,
    {
      model: process.env.LLM_MODEL_PRIMARY || 'meta-llama/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: `Raw Idea: ${idea}` }
      ],
      response_format: { type: "json_object" }
    },
    { headers, timeout: 30000 }
  );

  console.log("LLM output:", response.data.choices[0].message.content);
}

testLLM();
