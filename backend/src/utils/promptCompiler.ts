/**
 * Compiles a final prompt for downstream video AI engines by prepending 
 * the strict character bible to the scene action.
 * 
 * @param characterBible The 50-word permanent physical description of the character
 * @param sceneAction The specific action the character is taking in the scene
 * @param environment The environment description for the scene
 * @returns A consolidated, optimized prompt string wrapped in strict XML delimiters
 */
export function compileVideoPrompt(characterBible: string, sceneAction: string, environment: string): string {
  // CRITICAL FIX: Use strict XML-style delimiters to prevent prompt injection 
  // from overriding downstream engine instructions.
  return `
<character_appearance>
${characterBible.trim()}
</character_appearance>

<environment>
${environment.trim()}
</environment>

<action>
${sceneAction.trim()}
</action>
`.trim();
}
