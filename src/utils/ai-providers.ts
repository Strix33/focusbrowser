/**
 * Unified AI provider abstraction for Ask AI tab.
 * Supports Gemini, ChatGPT (OpenAI), and Claude (Anthropic).
 */

export type AiProvider = 'gemini' | 'chatgpt' | 'claude';

export interface AiMessage {
  role: 'user' | 'model';
  text: string;
  image?: { base64: string; mimeType: string };
}

export interface AiProviderMeta {
  id: AiProvider;
  name: string;
  color: string;
  bgColor: string;
}

export const AI_PROVIDERS: AiProviderMeta[] = [
  { id: 'gemini',  name: 'Gemini',  color: '#4285f4', bgColor: 'rgba(66, 133, 244, 0.12)' },
  { id: 'chatgpt', name: 'ChatGPT', color: '#10a37f', bgColor: 'rgba(16, 163, 127, 0.12)' },
  { id: 'claude',  name: 'Claude',  color: '#e87f5f', bgColor: 'rgba(232, 127, 95, 0.12)' },
];

export interface ApiKeys {
  gemini: string;
  openai: string;
  anthropic: string;
}

// Map provider ID -> which key to use
const PROVIDER_KEY_MAP: Record<AiProvider, keyof ApiKeys> = {
  gemini: 'gemini',
  chatgpt: 'openai',
  claude: 'anthropic',
};

/**
 * Send a conversation to the selected AI provider and get a text response.
 */
export async function askAi(
  provider: AiProvider,
  messages: AiMessage[],
  apiKeys: ApiKeys
): Promise<string> {
  const keyField = PROVIDER_KEY_MAP[provider];
  const apiKey = apiKeys[keyField];

  if (!apiKey) {
    const providerMeta = AI_PROVIDERS.find(p => p.id === provider);
    throw new Error(`Please configure your ${providerMeta?.name || provider} API Key in the Settings tab first.`);
  }

  switch (provider) {
    case 'gemini':
      return callGemini(messages, apiKey);
    case 'chatgpt':
      return callChatGPT(messages, apiKey);
    case 'claude':
      return callClaude(messages, apiKey);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ─── Gemini ────────────────────────────────────────────────

async function callGemini(messages: AiMessage[], apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const contents = messages.map(msg => {
    const parts: any[] = [{ text: msg.text }];
    if (msg.image) {
      parts.push({
        inlineData: {
          mimeType: msg.image.mimeType,
          data: msg.image.base64,
        },
      });
    }
    return { role: msg.role, parts };
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  return result.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from AI.';
}

// ─── ChatGPT (OpenAI) ─────────────────────────────────────

async function callChatGPT(messages: AiMessage[], apiKey: string): Promise<string> {
  const url = 'https://api.openai.com/v1/chat/completions';

  const openaiMessages = messages.map(msg => {
    // Map 'model' role to 'assistant' for OpenAI
    const role = msg.role === 'model' ? 'assistant' : 'user';

    if (msg.image) {
      // Multimodal message with image
      return {
        role,
        content: [
          { type: 'text' as const, text: msg.text },
          {
            type: 'image_url' as const,
            image_url: {
              url: `data:${msg.image.mimeType};base64,${msg.image.base64}`,
            },
          },
        ],
      };
    }

    return { role, content: msg.text };
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: openaiMessages,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || 'No response from AI.';
}

// ─── Claude (Anthropic) ───────────────────────────────────

async function callClaude(messages: AiMessage[], apiKey: string): Promise<string> {
  const url = 'https://api.anthropic.com/v1/messages';

  // Claude expects alternating user/assistant messages, starting with user.
  // Map 'model' role to 'assistant'.
  const claudeMessages = messages.map(msg => {
    const role = msg.role === 'model' ? 'assistant' : 'user';

    if (msg.image) {
      return {
        role,
        content: [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: msg.image.mimeType,
              data: msg.image.base64,
            },
          },
          { type: 'text' as const, text: msg.text },
        ],
      };
    }

    return { role, content: msg.text };
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: claudeMessages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  // Claude returns content as an array of blocks
  const textBlocks = result.content?.filter((b: any) => b.type === 'text') || [];
  return textBlocks.map((b: any) => b.text).join('\n') || 'No response from AI.';
}
