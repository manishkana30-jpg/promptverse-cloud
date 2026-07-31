require('dotenv').config({ path: 'c:/Users/manis/Downloads/PromptVerse cloud AI/backend/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testSupabase() {
  const user_id = '21554bb3-b74c-4f56-b4f5-c0042553177e';

  const { data: newProject, error: projErr } = await supabase
    .from('projects')
    .insert({
      user_id: user_id,
      title: 'Test',
      idea: 'Test',
      story: 'Test',
      status: 'DRAFT',
    })
    .select('id')
    .single();

  if (projErr) {
    console.error('Project Error:', projErr);
    return;
  }
  console.log('Project created:', newProject.id);

  const char = { "temp_id": "char_1", "name": "Oakley", "type": "object", "description": "A wise old tree" };
  
  const { data: insertedChar, error: charErr } = await supabase
    .from('characters')
    .insert({
      project_id: newProject.id,
      name: char.name,
      type: char.type,
      description: char.description,
      temp_id: char.temp_id
    })
    .select('id')
    .single();

  if (charErr) {
    console.error('Character Error:', charErr);
  } else {
    console.log('Character inserted:', insertedChar.id);
  }

  const scene = { "scene_index": 1, "location": "magical forest", "prompt": "Lily's first encounter", "has_dialogue": true, "dialogue": "Hello", "character_ids_present": ["char_1"] };
  const realCharIds = [insertedChar?.id].filter(Boolean);

  const { data: insertedScene, error: sceneErr } = await supabase
    .from('scenes')
    .insert({
      project_id: newProject.id,
      prompt: scene.prompt,
      status: 'PLANNING',
      dialogue: scene.dialogue || null,
      has_dialogue: scene.has_dialogue || false,
      character_ids_present: realCharIds
    })
    .select('id')
    .single();

  if (sceneErr) {
    console.error('Scene Error:', sceneErr);
  } else {
    console.log('Scene inserted:', insertedScene.id);
  }
}

testSupabase();
