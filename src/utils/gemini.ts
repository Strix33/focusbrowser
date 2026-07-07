/**
 * Helper to call Gemini API directly from the frontend
 */

// Helper to clean JSON string from Gemini (removes markdown backticks)
function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  return cleaned.trim();
}

export async function analyzeNote(
  text: string,
  imageBase64: string | null,
  mimeType: string | null,
  apiKey: string
): Promise<{ transcription: string; topic: string; tags: string[] }> {
  if (!apiKey) {
    throw new Error('API Key is missing');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const prompt = `
You are an AI assistant built into the 'Focus Browser' productivity application. Your task is to analyze this note (which may contain text, an image of handwritten/printed notes, or both) and:
1. Extract any text/transcribe it if it's an image.
2. Determine the main topic/subject of the note as a short single-word or two-word category (e.g. 'Mathematics', 'Cooking', 'To-Do', 'React Dev', 'History', 'Personal'). Be consistent with categories where possible.
3. Identify 2-5 relevant tags.

Return the result STRICTLY as a JSON object of this structure:
{
  "transcription": "transcribed text from the image, or empty string if no image/no text in image",
  "topic": "the detected topic category (e.g., Mathematics)",
  "tags": ["tag1", "tag2"]
}

Do not wrap in markdown or add any markdown formatting. Return only raw JSON.
Note Content:
${text}
`;

  const parts: any[] = [{ text: prompt }];

  if (imageBase64 && mimeType) {
    parts.push({
      inlineData: {
        mimeType: mimeType,
        data: imageBase64
      }
    });
  }

  const payload = {
    contents: [{ parts }]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  try {
    const cleaned = cleanJsonString(rawText);
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to parse Gemini JSON output:', rawText);
    // Return standard fallback
    return {
      transcription: '',
      topic: 'Uncategorized',
      tags: []
    };
  }
}

export async function askAiAboutNotes(
  notes: any[],
  question: string,
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    throw new Error('API Key is missing');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  // Format notes into a readable context string
  const notesContext = notes.map((note, index) => {
    let noteStr = `Note #${index + 1}:\n`;
    noteStr += `Title/Text: ${note.content}\n`;
    if (note.transcription) {
      noteStr += `Image Transcription: ${note.transcription}\n`;
    }
    noteStr += `Topic: ${note.topic}\n`;
    noteStr += `Tags: ${note.tags?.join(', ') || ''}\n`;
    noteStr += `Created: ${note.date}\n`;
    return noteStr;
  }).join('\n---\n');

  const prompt = `
You are an AI assistant built into the 'Focus Browser' productivity application. The user is asking a question about their saved notes.
Here is the complete list of their notes for context:
---
${notesContext}
---

Based on these notes, please answer the user's question. If the notes do not contain the answer, state that clearly, but try to find any relevant matches or summaries. Be concise and structured.

Question: ${question}
`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI.';
}

// askGeneralAi has been moved to ai-providers.ts as a multi-provider abstraction.
// Use askAi() from '../utils/ai-providers' instead.
