/**
 * Multi-Layer Processing System
 * 
 * This module exports all components of Jarvis's multi-layer processing system,
 * providing a sophisticated approach to handling different types of user requests.
 */

// Core processing components
export { 
  processWithMultiLayer,
  createStreamingProcessor,
  type ProcessingOptions 
} from './multi-layer-processor';

// Connector for external APIs
export {
  processJarvisRequestWithLayers,
  createStreamingResponse,
  type JarvisConnectorOptions
} from './jarvis-connector';

// Follow-up suggestion generators
export {
  generateFollowupSuggestions,
  generateArchitectureUpdateSuggestions,
  generateCdkFollowupSuggestions
} from './followup-generator';

/**
 * Use this function to process a request with the multi-layer system
 * 
 * @example
 * ```typescript
 * import { processRequest } from '@/ai/flows';
 * 
 * const result = await processRequest({
 *   message: "Update the architecture to add a CloudFront distribution",
 *   architectureId: "abc123",
 *   architectureContext: architecture,
 *   options: {
 *     debug: true,
 *     customModel: "gpt-4o"
 *   }
 * });
 * ```
 */
export async function processRequest({
  message,
  architectureId,
  architectureContext,
  messageHistory,
  options = {}
}: {
  message: string;
  architectureId: string;
  architectureContext: any;
  messageHistory?: any[];
  options?: {
    debug?: boolean;
    customModel?: string;
    enhancedPrompting?: boolean;
  };
}) {
  return processJarvisRequestWithLayers(
    message,
    architectureContext,
    {
      debugMode: options.debug,
      preferredModel: options.customModel,
      enhancedPrompting: options.enhancedPrompting
    }
  );
} 