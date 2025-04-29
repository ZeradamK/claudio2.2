/**
 * Multi-Layer Processor for Jarvis AI
 * 
 * Implements a sophisticated multi-layer approach for processing user requests:
 * 1. Intent Detection
 * 2. Language Detection
 * 3. Context Generation
 * 4. Prompt Engineering
 * 5. AI Processing
 * 6. Post-Processing
 */

import { EnhancedIntentMatch } from '../jarvis-integration';
import { ArchitectureContext, getContextLevelForIntent, generateContextString } from '../context/contextManager';
import { buildSystemPrompt, formatUserMessage, getModelConfigForIntent } from '../prompt/promptTemplates';
import { generateFollowupSuggestions } from './followup-generator';
import { postProcessResponse } from '../response/formatResponse';
import { openai, isOpenAIConfigured } from '../ai-instance';

// Removed local OpenAI client initialization - now using the centralized instance from ai-instance.ts

/**
 * Processing options for the multi-layer approach
 */
export interface ProcessingOptions {
  useEnhancedPrompting?: boolean;
  useRagAugmentation?: boolean;
  debug?: boolean;
  customModel?: string;
  language?: string;
  messageHistory?: Array<{role: string; content: string}>;
}

/**
 * Process a request through the multi-layer approach
 */
export async function processWithMultiLayer(
  message: string,
  intent: EnhancedIntentMatch,
  architecture: ArchitectureContext,
  options: ProcessingOptions = {}
): Promise<{
  response: string;
  metadata: any;
  architectureUpdated: boolean;
  updatedArchitecture?: any;
}> {
  try {
    // Check if OpenAI is configured
    if (!isOpenAIConfigured()) {
      console.error("OpenAI API key is not configured. Please check your .env.local file.");
      throw new Error("OpenAI API key is missing. Please check your .env.local file.");
    }

    // Validate inputs
    if (!message) {
      throw new Error("Message is required but was empty");
    }
    
    if (!intent || !intent.intentType) {
      throw new Error("Invalid intent object provided");
    }
    
    if (!architecture) {
      console.warn("Architecture context is missing or empty");
      // Continue without architecture (some intents don't require it)
    }
    
    // Start timing for performance metrics
    const startTime = performance.now();
    
    // Track timing of each layer
    const metrics = {
      contextGeneration: 0,
      promptEngineering: 0,
      aiProcessing: 0,
      postProcessing: 0,
      total: 0
    };
    
    // Layer 3: Context Generation
    const contextStartTime = performance.now();
    const contextLevel = getContextLevelForIntent(intent.intentType);
    const contextString = generateContextString(architecture, contextLevel);
    metrics.contextGeneration = performance.now() - contextStartTime;
    
    // Layer 4: Prompt Engineering
    const promptStartTime = performance.now();
    const systemPrompt = buildSystemPrompt(intent.intentType, contextString);
    const userMessage = formatUserMessage(intent.intentType, message);
    metrics.promptEngineering = performance.now() - promptStartTime;
    
    // Debug mode
    if (options.debug) {
      console.log('Intent:', intent);
      console.log('Context Level:', contextLevel);
      console.log('System Prompt:', systemPrompt);
      console.log('User Message:', userMessage);
    }
    
    // Calculate model to use
    const modelConfig = getModelConfigForIntent(intent.intentType);
    const model = options.customModel || process.env.OPENAI_MODEL || "gpt-4o";
    
    // Prepare messages for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add message history for context if available
    if (options.messageHistory && options.messageHistory.length > 0) {
      const recentMessages = options.messageHistory.slice(-5);
      messages.push(...recentMessages);
    }
    
    // Add the current user message
    messages.push({ role: 'user', content: userMessage });
    
    // Layer 5: AI Processing
    const aiStartTime = performance.now();
    
    // Prepare function calls for architecture updates
    const isArchitectureUpdate = intent.intentType === 'architecture_update';
    
    let response;
    if (isArchitectureUpdate) {
      // For architecture updates, use tools with function calling
      response = await openai.chat.completions.create({
        model,
        messages: messages as any,
        temperature: modelConfig.temperature,
        max_tokens: 4096,
        tools: [
          {
            type: "function",
            function: {
              name: "update_architecture",
              description: "Update the AWS architecture based on the user request",
              parameters: {
                type: "object",
                properties: {
                  architecture: {
                    type: "object",
                    properties: {
                      nodes: {
                        type: "array",
                        description: "Array of nodes in the architecture diagram"
                      },
                      edges: {
                        type: "array",
                        description: "Array of connections between nodes"
                      }
                    },
                    required: ["nodes", "edges"]
                  },
                  explanation: {
                    type: "string",
                    description: "Clear explanation of changes made to the architecture"
                  }
                },
                required: ["architecture", "explanation"]
              }
            }
          }
        ]
      });
    } else {
      // For other requests, use standard completion
      response = await openai.chat.completions.create({
        model,
        messages: messages as any,
        temperature: modelConfig.temperature,
        max_tokens: 2048,
      });
    }
    
    metrics.aiProcessing = performance.now() - aiStartTime;
    
    // Layer 6: Post-Processing
    const postStartTime = performance.now();
    
    // Process the response
    let finalResponse = '';
    let architectureUpdated = false;
    let updatedArchitecture = null;
    
    // Handle tool calls (function calling) if any
    if (response.choices[0]?.message?.tool_calls?.length) {
      const toolCall = response.choices[0].message.tool_calls[0];
      
      if (toolCall.function.name === 'update_architecture') {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          
          if (args.architecture && args.explanation) {
            // Extract architecture update
            updatedArchitecture = args.architecture;
            architectureUpdated = true;
            
            // Format the response
            finalResponse = `✅ **Architecture Updated Successfully**\n\n### Changes Made:\n${args.explanation}\n\n### Impact:\n- Your architecture has been updated with these changes\n- All connections and permissions have been configured appropriately\n- The diagram reflects the current state of your design`;
          }
        } catch (error) {
          console.error('Error processing architecture update:', error);
        }
      }
    } else {
      // Regular text response
      finalResponse = response.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response. Please try again.';
      
      // Check for architecture update in the response content
      if (isArchitectureUpdate && finalResponse.includes('<architecture>') && finalResponse.includes('</architecture>')) {
        // Extract architecture JSON and explanation
        const architectureRegex = /<architecture>([\s\S]*?)<\/architecture>/;
        const explanationRegex = /<explanation>([\s\S]*?)<\/explanation>/;
        
        const architectureMatch = finalResponse.match(architectureRegex);
        const explanationMatch = finalResponse.match(explanationRegex);
        
        if (architectureMatch && architectureMatch[1]) {
          try {
            updatedArchitecture = JSON.parse(architectureMatch[1].trim());
            
            if (updatedArchitecture && updatedArchitecture.nodes && updatedArchitecture.edges) {
              architectureUpdated = true;
              
              // Format the response
              let explanation = "Architecture updated.";
              if (explanationMatch && explanationMatch[1]) {
                explanation = explanationMatch[1].trim();
              }
              
              finalResponse = `✅ **Architecture Updated Successfully**\n\n### Changes Made:\n${explanation}\n\n### Impact:\n- Your architecture has been updated with these changes\n- All connections and permissions have been configured appropriately\n- The diagram reflects the current state of your design`;
            }
          } catch (error) {
            console.error('Error parsing architecture JSON:', error);
          }
        }
      } else {
        // Apply intent-specific post-processing for non-architecture updates
        finalResponse = postProcessResponse(intent.intentType, finalResponse, options.language);
      }
    }
    
    metrics.postProcessing = performance.now() - postStartTime;
    metrics.total = performance.now() - startTime;
    
    // Generate follow-up suggestions
    const suggestedFollowUps = generateFollowupSuggestions(intent, architecture);
    
    // Return the enhanced response with metadata
    return {
      response: finalResponse,
      architectureUpdated,
      ...(architectureUpdated && { updatedArchitecture }),
      metadata: {
        intent: intent.intentType,
        subIntent: intent.subType,
        confidence: intent.confidence,
        suggestedFollowUps,
        metrics,
        tokensUsed: response.usage?.total_tokens || 0,
        model: response.model
      }
    };
  } catch (error) {
    console.error('Error in multi-layer processor:', error);
    
    // Return a fallback response
    return {
      response: "I'm sorry, but I encountered an error while processing your request. Please try again or rephrase your question.",
      metadata: {
        intent: 'general_chat',
        format: 'conversation',
        suggestedFollowUps: [
          'How can I design a serverless architecture?',
          'What are best practices for AWS security?',
          'How do I optimize costs in AWS?'
        ]
      },
      architectureUpdated: false
    };
  }
}

/**
 * Create a streaming processor for the multi-layer approach
 */
export function createStreamingProcessor(
  intent: EnhancedIntentMatch,
  architecture: ArchitectureContext,
  options: ProcessingOptions = {}
) {
  return {
    /**
     * Generate a stream for the multi-layer approach
     */
    async generateStream(
      message: string,
      callbacks?: {
        onToken?: (token: string) => void;
        onComplete?: (response: string) => void;
      }
    ): Promise<ReadableStream> {
      try {
        // Check if OpenAI is configured
        if (!isOpenAIConfigured()) {
          console.error("OpenAI API key is not configured. Please check your .env.local file.");
          throw new Error("OpenAI API key is missing. Please check your .env.local file.");
        }

        // Validate inputs
        if (!message) {
          throw new Error("Message is required but was empty");
        }
        
        if (!intent || !intent.intentType) {
          throw new Error("Invalid intent object provided");
        }
        
        // Layer 3-4: Context and Prompt Generation
        const contextLevel = getContextLevelForIntent(intent.intentType);
        const contextString = generateContextString(architecture, contextLevel);
        const systemPrompt = buildSystemPrompt(intent.intentType, contextString);
        const userMessage = formatUserMessage(intent.intentType, message);
        
        // Calculate model to use
        const modelConfig = getModelConfigForIntent(intent.intentType);
        const model = options.customModel || process.env.OPENAI_MODEL || "gpt-4o";
        
        // Prepare messages for OpenAI
        const messages = [
          { role: 'system', content: systemPrompt }
        ];
        
        // Add message history for context if available
        if (options.messageHistory && options.messageHistory.length > 0) {
          const recentMessages = options.messageHistory.slice(-5);
          messages.push(...recentMessages);
        }
        
        // Add the current user message
        messages.push({ role: 'user', content: userMessage });
        
        // Call OpenAI API with streaming
        const stream = await openai.chat.completions.create({
          model,
          messages: messages as any,
          temperature: modelConfig.temperature,
          max_tokens: 2048,
          stream: true,
        });
        
        // Process the stream
        let fullResponse = '';
        
        // Convert the OpenAI stream to a standard ReadableStream
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        
        const readableStream = new ReadableStream({
          async start(controller) {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                fullResponse += content;
                if (callbacks?.onToken) {
                  callbacks.onToken(content);
                }
                controller.enqueue(encoder.encode(content));
              }
            }
            
            // Apply post-processing to the full response if needed
            if (intent.intentType !== 'architecture_update') {
              fullResponse = postProcessResponse(intent.intentType, fullResponse, options.language);
              
              if (callbacks?.onComplete) {
                callbacks.onComplete(fullResponse);
              }
            }
            
            controller.close();
          },
          cancel() {
            // Cancel the upstream request if needed
          }
        });
        
        return readableStream;
      } catch (error) {
        console.error('Error in streaming processor:', error);
        
        // Return an error stream
        const encoder = new TextEncoder();
        return new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode("I'm sorry, but I encountered an error while processing your request."));
            controller.close();
          }
        });
      }
    }
  };
} 