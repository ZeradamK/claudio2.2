import { cohereClient } from './cohere-instance';
import { ChatMessage } from '@/types/chat';

export interface CohereChatOptions {
  model?: string;
  message: string;
  promptContext?: string;
  temperature?: number;
  maxTokens?: number;
  chatHistory?: ChatMessage[];
}

/**
 * Generate a chat completion response using Cohere's API
 * 
 * @param options The chat completion options
 * @returns The AI's response as a string
 */
export async function generateCohereChatCompletion({
  model = 'command-r-plus',
  message,
  promptContext = '',
  temperature = 0.7,
  maxTokens = 1000,
  chatHistory = [],
}: CohereChatOptions): Promise<string> {
  try {
    // Convert our chat history format to Cohere's expected format
    const cohereHistory = chatHistory.map(msg => ({
      role: msg.role === 'user' ? 'USER' as const : 'CHATBOT' as const,
      message: msg.content,
    }));

    // Make the API call to Cohere
    const response = await cohereClient.chat({
      model,
      message,
      temperature,
      maxTokens,
      chatHistory: cohereHistory,
      preamble: promptContext || undefined,
    });

    // Return the generated text response
    return response.text;
  } catch (error) {
    console.error('Error generating Cohere chat completion:', error);
    throw new Error(`Failed to generate chat completion: ${error instanceof Error ? error.message : String(error)}`);
  }
} 