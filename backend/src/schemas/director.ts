import { z } from "zod";

export const CharacterSchema = z.object({
  temp_id: z.string(),
  name: z.string(),
  type: z.enum(["human", "animal", "object"]),
  description: z.string()
});

export const SceneSchema = z.object({
  scene_index: z.number().int().positive(),
  location: z.string(),
  prompt: z.string(),
  dialogue: z.string().nullable().optional(),
  has_dialogue: z.boolean(),
  character_ids_present: z.array(z.string())
});

export const DirectorOutputSchema = z.object({
  expanded_story: z.string(),
  characters: z.array(CharacterSchema),
  scenes: z.array(SceneSchema)
});

export type DirectorOutput = z.infer<typeof DirectorOutputSchema>;
