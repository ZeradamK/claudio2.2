/**
 * Jarvis Connector
 * 
 * This module provides a connector between the Jarvis multi-layer processing
 * system and the external API endpoints.
 */

import { openai } from '../ai-instance';
import { EnhancedIntentMatch } from '../jarvis-integration';
import { ArchitectureContext } from '../context/contextManager';
import { processWithMultiLayer, ProcessingOptions, createStreamingProcessor } from './multi-layer-processor';
import { detectEnhancedIntent } from '../jarvis-integration';
import { detectProgrammingLanguage } from '../intent/inferIntent';
import { detectLanguage } from '../../utils/language-detection';

/**
 * Configuration options for the Jarvis connector
 */
export interface JarvisConnectorOptions {
  enhancedPrompting?: boolean;
  ragAugmentation?: boolean;
  debugMode?: boolean;
  preferredModel?: string;
}

/**
 * Process a request through the multi-layer approach
 */
export async function processJarvisRequestWithLayers(
  message: string,
  architectureContext: ArchitectureContext,
  options: JarvisConnectorOptions = {}
): Promise<{
  response: string;
  metadata: any;
  architectureUpdated: boolean;
  updatedArchitecture?: any;
}> {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is not configured. Please check your .env.local file.");
      return {
        response: "I'm sorry, but I'm having trouble connecting to my AI services. Please check the OpenAI API key configuration in the .env.local file.",
        metadata: {
          error: "Missing OpenAI API key",
          intent: 'general_chat',
          format: 'conversation'
        },
        architectureUpdated: false
      };
    }

    // Layer 1: Intent Detection
    const enhancedIntent = detectEnhancedIntent(message, true);
    if (options.debugMode) {
      console.log('Detected Intent:', enhancedIntent);
    }
    
    // Layer 2: Language Detection
    const targetLanguage = detectLanguage(message) || 'typescript';
    if (options.debugMode) {
      console.log('Detected Language:', targetLanguage);
    }
    
    // Configure processing options
    const processingOptions: ProcessingOptions = {
      useEnhancedPrompting: options.enhancedPrompting || false,
      useRagAugmentation: options.ragAugmentation || false,
      debug: options.debugMode || false,
      customModel: options.preferredModel,
      language: targetLanguage
    };
    
    // Process with multi-layer approach
    const result = await processWithMultiLayer(
      message,
      enhancedIntent,
      architectureContext,
      processingOptions
    );
    
    return result;
  } catch (error: any) {
    console.error('Error processing Jarvis request with layers:', error);
    
    // Return a more detailed error message
    return {
      response: `I'm sorry, but I encountered an error while processing your request: ${error.message || "Unknown error"}. Please try again or check the API configuration.`,
      metadata: {
        error: error.message || "Unknown error",
        intent: 'general_chat',
        format: 'conversation',
        suggestedFollowUps: [
          'Try a simpler request',
          'Check API configuration',
          'Restart the application'
        ]
      },
      architectureUpdated: false
    };
  }
}

/**
 * Create a streaming response for the multi-layer approach
 */
export async function createStreamingResponse(
  message: string,
  architectureContext: ArchitectureContext,
  options: JarvisConnectorOptions = {}
): Promise<ReadableStream> {
  try {
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error("OpenAI API key is not configured. Please check your .env.local file.");
      // Return an error stream
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("I'm sorry, but I'm having trouble connecting to my AI services. Please check the OpenAI API key configuration."));
          controller.close();
        }
      });
    }

    // Layer 1: Intent Detection
    const enhancedIntent = detectEnhancedIntent(message, true);
    
    // Layer 2: Language Detection
    const targetLanguage = detectLanguage(message) || 'typescript';
    
    if (options.debugMode) {
      console.log('Creating stream for intent:', enhancedIntent.intentType);
      console.log('Using language:', targetLanguage);
    }
    
    // This would normally create a streaming response using the OpenAI API
    const encoder = new TextEncoder();
    
    // Check if streaming is enabled in environment
    if (process.env.ENABLE_STREAMING !== 'true') {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("Streaming is disabled. Please enable it by setting ENABLE_STREAMING=true in your .env.local file."));
          controller.close();
        }
      });
    }
    
    // Process the request using our streaming processor
    const processingOptions: ProcessingOptions = {
      useEnhancedPrompting: options.enhancedPrompting || false,
      useRagAugmentation: options.ragAugmentation || false,
      debug: options.debugMode || false,
      customModel: options.preferredModel,
      language: targetLanguage
    };
    
    // Create streaming processor
    const processor = createStreamingProcessor(enhancedIntent, architectureContext, processingOptions);
    
    // Generate stream
    return await processor.generateStream(message);
  } catch (error: any) {
    console.error('Error creating streaming response:', error);
    
    // Return an error stream
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`I'm sorry, but I encountered an error: ${error.message || "Unknown error"}. Please try again or check the configuration.`));
        controller.close();
      }
    });
  }
} 