export type LlmMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export async function generateAssistantMessage(messages: LlmMessage[], model: string): Promise<string> {
  const userMessages = messages.filter((m) => m.role === 'user');
  const lastUserMessage = userMessages[userMessages.length - 1];
  const preview = lastUserMessage?.content ?? '';

  return `Simulated response (${model}): ${preview.slice(0, 200)}`;
}
