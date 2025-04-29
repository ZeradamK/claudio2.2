import { cohere } from '@/ai/cohere-instance';

export interface CohereStreamMessage {
  text: string;
  isFinished: boolean;
  finish_reason?: string;
}

/**
 * Creates a readable stream from Cohere API streaming response
 * @param streamingRequest The request parameters for Cohere's streaming API
 * @returns An async generator that yields chunks of the streaming response
 */
export async function* createCohereStream(streamingRequest: any): AsyncGenerator<CohereStreamMessage> {
  try {
    // Call Cohere's streaming API
    const stream = await cohere.chatStream({
      message: streamingRequest.message,
      chatHistory: streamingRequest.chat_history || [],
      model: streamingRequest.model,
      temperature: streamingRequest.temperature,
      maxTokens: streamingRequest.max_tokens,
      preamble: streamingRequest.preamble,
    });

    // Process each chunk from the stream
    for await (const chunk of stream) {
      if (chunk.eventType === 'text-generation') {
        yield {
          text: chunk.text || '',
          isFinished: false,
        };
      }
      
      // Handle the end of the stream
      if (chunk.eventType === 'stream-end') {
        yield {
          text: '',
          isFinished: true,
          finish_reason: chunk.finishReason,
        };
      }
    }
  } catch (error) {
    console.error('Error in Cohere stream:', error);
    yield {
      text: '\n\nError: Failed to stream response from Cohere API.',
      isFinished: true,
      finish_reason: 'error',
    };
  }
}

/**
 * Performs a non-streaming Cohere chat completion
 * @param requestParams The request parameters for Cohere's chat API
 * @returns The completed text response
 */
export async function cohereCompletion(requestParams: any): Promise<string> {
  try {
    const response = await cohere.chat({
      message: requestParams.message,
      chatHistory: requestParams.chat_history || [],
      model: requestParams.model,
      temperature: requestParams.temperature,
      maxTokens: requestParams.max_tokens,
      preamble: requestParams.preamble,
    });
    
    return response.text;
  } catch (error) {
    console.error('Error in Cohere completion:', error);
    throw error;
  }
} 