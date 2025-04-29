/**
 * Jarvis AI Orchestrator
 * 
 * Higher-level orchestration layer that combines all AI modules with:
 * - Conversation context management
 * - Session-based memory
 * - Performance analytics
 * - Error handling and fallback strategies
 */

import { processJarvisRequest, EnhancedIntentMatch, detectEnhancedIntent } from './jarvis-integration';
import { ArchitectureContext } from './context/contextManager';
import { Intent } from './intent/inferIntent';

// Track conversation sessions
interface ConversationSession {
  id: string;
  messageCount: number;
  lastMessageTimestamp: number;
  intents: Array<{intent: Intent, timestamp: number}>;
  conversationSummary?: string;
  messages?: Array<{role: string; content: string; timestamp?: string}>;
}

// Global session store (in production this would be in Redis/DB)
const activeSessions: Record<string, ConversationSession> = {};

/**
 * Response metrics for tracking AI performance
 */
interface ResponseMetrics {
  intentDetectionTimeMs: number;
  promptGenerationTimeMs: number;
  aiRequestTimeMs: number;
  responseProcessingTimeMs: number;
  totalProcessingTimeMs: number;
}

/**
 * Enhanced response with additional metadata
 */
interface EnhancedResponse {
  response: string;
  architectureUpdated: boolean;
  updatedArchitecture?: any;
  metadata?: {
    intent: Intent | string;
    subIntent?: string;
    confidence: number;
    metrics?: ResponseMetrics;
    suggestedFollowups?: string[];
  };
}

/**
 * Initialize or retrieve a conversation session
 */
export function getOrCreateSession(architectureId: string): ConversationSession {
  if (!activeSessions[architectureId]) {
    activeSessions[architectureId] = {
      id: architectureId,
      messageCount: 0,
      lastMessageTimestamp: Date.now(),
      intents: []
    };
  }
  
  return activeSessions[architectureId];
}

/**
 * Update session with new message information
 */
export function updateSession(sessionId: string, update: any): Promise<void> {
  // Get the session
  const session = getOrCreateSession(sessionId);
  
  // Apply updates
  if (update.messages) {
    // Store messages in the session
    session.messages = update.messages;
    session.messageCount = update.messages.length;
  }
  
  if (update.intent) {
    // Add intent to history
    session.intents.push({
      intent: update.intent,
      timestamp: Date.now()
    });
    
    // Limit history size
    if (session.intents.length > 20) {
      session.intents = session.intents.slice(-20);
    }
  }
  
  // Update timestamp
  session.lastMessageTimestamp = Date.now();
  
  return Promise.resolve();
}

/**
 * Generate relevant follow-up suggestions based on current intent
 */
function generateFollowupSuggestions(
  intent: EnhancedIntentMatch,
  architecture: ArchitectureContext
): string[] {
  const suggestions: string[] = [];
  
  // Suggest follow-ups based on current intent
  switch (intent.intentType) {
    case 'architecture_update':
      suggestions.push('Generate CDK code for this architecture');
      suggestions.push('What are the security considerations for this design?');
      suggestions.push('Explain the data flow in this architecture');
      break;
    
    case 'architecture_rationale':
      suggestions.push('How can we optimize the costs of this architecture?');
      suggestions.push('What would be the disaster recovery strategy for this design?');
      suggestions.push('Generate CDK code for this architecture');
      suggestions.push('How would this architecture scale to handle 10x the load?');
      suggestions.push('What are the security best practices we should implement?');
      break;
    
    case 'cdk_generation':
      suggestions.push('How would I deploy this CDK code?');
      suggestions.push('What AWS permissions are needed to deploy this?');
      suggestions.push('Explain how the CDK constructs work together');
      break;
    
    case 'code_generation':
      suggestions.push('Explain how this code works');
      suggestions.push('What error handling should I add?');
      suggestions.push('How would I test this code?');
      break;
    
    case 'architecture_explanation':
    case 'code_explanation':
    case 'question':
      suggestions.push('Generate code example for this concept');
      suggestions.push('What are the best practices for this?');
      suggestions.push('What are common mistakes to avoid?');
      break;
    
    default:
      suggestions.push('Update the architecture diagram');
      suggestions.push('Generate CDK code for AWS deployment');
      suggestions.push('Explain the benefits of this architecture');
  }
  
  // Architecture-specific suggestions
  if (architecture.nodes.length > 0) {
    // Suggest based on current architecture components
    const serviceTypes = architecture.nodes.map(node => node.data.service);
    
    // Identify missing common components
    if (!serviceTypes.some(s => s.includes('Lambda'))) {
      suggestions.push('Add a Lambda function to handle API requests');
    }
    
    if (!serviceTypes.some(s => s.includes('DynamoDB') || s.includes('RDS'))) {
      suggestions.push('Add a database to store application data');
    }
    
    if (!serviceTypes.some(s => s.includes('CloudFront') || s.includes('API Gateway'))) {
      suggestions.push('Add an API Gateway to manage API endpoints');
    }
  }
  
  // Return 2-3 most relevant suggestions
  return shuffleArray(suggestions).slice(0, 3);
}

/**
 * Helper function to shuffle array
 */
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

/**
 * Process a request with full orchestration, metrics, and session management
 */
export async function orchestrateJarvisRequest(
  message: string,
  architectureId: string,
  architecture: ArchitectureContext,
  messageHistory?: any[]
): Promise<EnhancedResponse> {
  // Start performance metrics
  const startTime = performance.now();
  const metrics: ResponseMetrics = {
    intentDetectionTimeMs: 0,
    promptGenerationTimeMs: 0,
    aiRequestTimeMs: 0,
    responseProcessingTimeMs: 0,
    totalProcessingTimeMs: 0
  };
  
  try {
    // Get or create session
    const session = getOrCreateSession(architectureId);
    
    // Detect intent (with timing)
    const intentStartTime = performance.now();
    const intent = detectEnhancedIntent(message, true);
    metrics.intentDetectionTimeMs = performance.now() - intentStartTime;
    
    // Update session with new message info
    updateSession(architectureId, { intent: intent.intentType });
    
    // Process request through integration layer
    const processingStartTime = performance.now();
    const result = await processJarvisRequest(message, architecture, messageHistory);
    metrics.promptGenerationTimeMs = 0; // We don't have direct access to this timing
    metrics.aiRequestTimeMs = performance.now() - processingStartTime;
    metrics.responseProcessingTimeMs = 0; // We don't have direct access to this timing
    
    // Generate follow-up suggestions
    const suggestedFollowups = generateFollowupSuggestions(intent, architecture);
    
    // Finish metrics
    metrics.totalProcessingTimeMs = performance.now() - startTime;
    
    // Return enhanced response
    return {
      ...result,
      metadata: {
        intent: intent.intentType,
        subIntent: intent.subType,
        confidence: intent.confidence,
        metrics,
        suggestedFollowups
      }
    };
  } catch (error) {
    console.error('Orchestration error:', error);
    
    // Return fallback response with a valid intent string
    return {
      response: "I'm sorry, I encountered an error while processing your request. Please try again or rephrase your question.",
      architectureUpdated: false,
      metadata: {
        intent: 'general_chat', // Fixed error intent to a valid Intent type
        confidence: 0,
        metrics: {
          ...metrics,
          totalProcessingTimeMs: performance.now() - startTime
        }
      }
    };
  }
}

/**
 * Get analytics for a specific architecture conversation
 */
export function getConversationAnalytics(architectureId: string): {
  sessionData?: ConversationSession;
  intentDistribution?: Record<Intent, number>;
  messageCount: number;
  hasActiveSession: boolean;
} {
  const session = activeSessions[architectureId];
  
  if (!session) {
    return {
      messageCount: 0,
      hasActiveSession: false
    };
  }
  
  // Calculate intent distribution
  const intentDistribution: Record<Intent, number> = {} as Record<Intent, number>;
  session.intents.forEach(item => {
    intentDistribution[item.intent] = (intentDistribution[item.intent] || 0) + 1;
  });
  
  return {
    sessionData: session,
    intentDistribution,
    messageCount: session.messageCount,
    hasActiveSession: true
  };
}

/**
 * Clear conversation session data
 */
export function clearConversationSession(architectureId: string): boolean {
  if (activeSessions[architectureId]) {
    delete activeSessions[architectureId];
    return true;
  }
  return false;
} 