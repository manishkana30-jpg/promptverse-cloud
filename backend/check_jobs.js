require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('stitch_jobs').select('*').order('created_at', { ascending: false }).limit(5);
  if (error) console.error(error);
  else console.log("JOBS:\n", JSON.stringify(data, null, 2));

  const { data: sceneData, error: sceneErr } = await supabase.from('scenes').insert({ project_id: data[0].project_id, scene_index: 1, location: "test", prompt: "test" }).select('id');
  if (sceneErr) console.error("INSERT SCENE ERROR:", sceneErr);
}

check();
