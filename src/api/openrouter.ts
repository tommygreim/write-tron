const BASE_URL = 'https://openrouter.ai/api/v1';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Call the OpenRouter API. If onChunk is provided, streams the response and
 * calls onChunk with each text delta. Returns the full accumulated text.
 */
export async function callOpenRouter(
  apiKey: string,
  model: string,
  messages: Message[],
  onChunk?: (chunk: string) => void
): Promise<string> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Write-Tron Story Editor',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: !!onChunk,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
  }

  if (onChunk) {
    // Streaming mode
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const content: string | undefined = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullText += content;
            onChunk(content);
          }
        } catch {
          // Ignore malformed SSE lines
        }
      }
    }

    return fullText;
  } else {
    // Non-streaming mode
    const data = await response.json();
    return data.choices[0].message.content as string;
  }
}

/**
 * Extract JSON from a model response that may wrap it in a markdown code block.
 */
export function extractJSON(text: string): unknown {
  // Strip markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  const raw = fenceMatch ? fenceMatch[1].trim() : text.trim();

  // Find the outermost { } block
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in response');

  return JSON.parse(raw.slice(start, end + 1));
}
