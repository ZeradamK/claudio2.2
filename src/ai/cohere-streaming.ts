import { CohereClient } from 'cohere-ai';
import { cohereClient } from './cohere-instance';

// Define our own interface for chat history to avoid direct dependency on Cohere types
interface ChatHistoryItem {
  role: string; // will be converted to USER or CHATBOT
  message: string;
}

interface StreamingOptions {
  model: string;
  message: string;
  promptContext?: string;
  temperature?: number;
  maxTokens?: number;
  chatHistory?: ChatHistoryItem[];
}

/**
 * Creates a streaming response from Cohere's API suitable for returning directly from a route handler
 * 
 * @param options The streaming options for Cohere chat
 * @returns A Response object with the streaming content
 */
export async function streamingCohereChatCompletion(
  options: StreamingOptions
): Promise<Response> {
  const {
    model = 'command-r-plus',
    message,
    promptContext = '',
    temperature = 0.7,
    maxTokens = 1024,
    chatHistory = []
  } = options;

  try {
    // Convert our chat history to Cohere's expected format
    const formattedHistory = chatHistory.map(msg => ({
      role: msg.role === 'USER' || msg.role === 'user' ? 'USER' as const : 'CHATBOT' as const,
      message: msg.message
    }));

    // Make the API call to Cohere with streaming
    const response = await cohereClient.chatStream({
      model,
      message,
      preamble: promptContext,
      temperature,
      maxTokens,
      chatHistory: formattedHistory
    });

    // Create a text encoder
    const encoder = new TextEncoder();
    
    // Create a stream directly using the Web Streams API
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            if (chunk.eventType === 'text-generation') {
              // Send the text chunk
              const text = chunk.text || '';
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (error) {
          console.error('Error in Cohere stream processing:', error);
          controller.error(error);
        }
      }
    });

    // Return a Response object with the stream
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked'
      }
    });
  } catch (error) {
    console.error('Error in Cohere streaming:', error);
    // Return an error response
    return new Response(
      JSON.stringify({ error: 'Failed to generate streaming response' }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
} 