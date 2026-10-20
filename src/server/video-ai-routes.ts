/**
 * CineAI Studio — Server-Side Video AI Router
 * Uses @google/genai with gemini-3.8-flash on server side.
 * Validates all AI-generated operations before returning structured edit plans.
 */

import { Router, Request, Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { EditPlan, VideoProject } from '../video-editor/types.js';
import { generateLocalRuleBasedPlan, validateEditPlan } from '../video-editor/ai-planner.js';

export const videoAiRouter = Router();

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

/**
 * POST /api/video-editor/ai-plan
 * Analyzes user prompt + project state, calls Gemini model, and returns a verified edit plan.
 */
videoAiRouter.post('/ai-plan', async (req: Request, res: Response) => {
  try {
    const { prompt, project }: { prompt: string; project: VideoProject } = req.body;
    if (!prompt || !project) {
      return res.status(400).json({ error: 'Missing prompt or project in request body' });
    }

    const ai = getGeminiClient();

    // If Gemini API key is available, call gemini-3.8-flash with structured JSON response
    if (ai) {
      try {
        const systemInstruction = `You are CineAI Studio, an expert AI video editing director and media engineer.
The user wants to edit their video project. You must analyze the project clips, tracks, transcripts, and duration,
and translate the user's intent into a structured sequence of verified editing operations.
Controlled operations vocabulary:
- 'trim': { type: 'trim', clipId: string, start?: number, end?: number, description: string }
- 'split': { type: 'split', clipId: string, time: number, description: string }
- 'move': { type: 'move', clipId: string, start: number, trackId?: string, description: string }
- 'delete': { type: 'delete', clipId: string, parameters: { ripple: boolean }, description: string }
- 'caption': { type: 'caption', start: number, end: number, value: string, description: string }
- 'color': { type: 'color', clipId: string, parameters: { preset: string, brightness?: number, contrast?: number, saturation?: number }, description: string }
- 'audio': { type: 'audio', trackId?: string, parameters: { autoDucking?: boolean, volume?: number }, description: string }
- 'transition': { type: 'transition', clipId: string, parameters: { transitionType: string, duration?: number }, description: string }
- 'speed': { type: 'speed', clipId: string, value: number, description: string }

Rules:
1. ONLY reference clip IDs that exist in the provided project clips list.
2. Ensure all timestamps are strictly within clip bounds.
3. Every operation must include a clear, concise human-readable description.
4. Provide a structured summary of the overall editing plan.`;

        const clipsSummary = project.clips.map(c => ({
          id: c.id,
          name: c.name,
          trackId: c.trackId,
          start: c.start,
          end: c.end,
          duration: c.end - c.start,
          type: c.type
        }));

        const promptText = `User Instruction: "${prompt}"
Project Name: "${project.settings.name}"
Aspect Ratio: ${project.settings.aspectRatio}
Duration: ${project.duration}s
Available Clips: ${JSON.stringify(clipsSummary)}
Available Tracks: ${JSON.stringify(project.tracks.map(t => ({ id: t.id, name: t.name, type: t.type })))}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: promptText,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                estimatedDurationDelta: { type: Type.NUMBER },
                operations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      clipId: { type: Type.STRING },
                      trackId: { type: Type.STRING },
                      start: { type: Type.NUMBER },
                      end: { type: Type.NUMBER },
                      time: { type: Type.NUMBER },
                      value: { type: Type.STRING },
                      description: { type: Type.STRING }
                    },
                    required: ['type', 'description']
                  }
                }
              },
              required: ['summary', 'operations']
            }
          }
        });

        if (response.text) {
          const parsed = JSON.parse(response.text.trim());
          const plan: EditPlan = {
            id: 'plan_' + Math.random().toString(36).substring(2, 9),
            prompt,
            summary: parsed.summary || 'AI-generated editing plan',
            operations: parsed.operations || [],
            estimatedDurationDelta: parsed.estimatedDurationDelta || 0,
            createdAt: Date.now(),
            isValidated: false,
            validationErrors: []
          };

          // Strict validation before responding
          const validation = validateEditPlan(plan, project);
          plan.isValidated = validation.isValid;
          plan.validationErrors = validation.errors;

          return res.json({ success: true, plan, source: 'gemini-3.8-flash' });
        }
      } catch (geminiError: any) {
        console.warn('Gemini API call failed, falling back to local planner:', geminiError.message);
      }
    }

    // Fallback to local intelligent rule-based planner
    const plan = generateLocalRuleBasedPlan(prompt, project);
    const validation = validateEditPlan(plan, project);
    plan.isValidated = validation.isValid;
    plan.validationErrors = validation.errors;

    return res.json({ success: true, plan, source: 'local-planner' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal server error processing edit plan' });
  }
});

/**
 * POST /api/video-editor/assistant
 * Handles interactive natural-language chat requests within the editor workspace
 */
videoAiRouter.post('/assistant', async (req: Request, res: Response) => {
  try {
    const { message, project }: { message: string; project: VideoProject } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Missing message' });
    }

    const ai = getGeminiClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `You are CineAI Studio Assistant. The user asks: "${message}". Current project has ${project.clips.length} clips and total length of ${project.duration} seconds. Provide a helpful, direct 2-3 sentence recommendation or confirmation of the edit action.`,
        });
        return res.json({ reply: response.text || 'Action received and processed.' });
      } catch (err: any) {
        // Fallback
      }
    }

    return res.json({
      reply: `I analyzed your request "${message}". Ready to apply adjustments to the timeline with 1 click.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
