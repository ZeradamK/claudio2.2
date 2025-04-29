/**
 * Jarvis AI Integration Layer
 * 
 * This file serves as the integration layer between the Jarvis API route handler
 * and the various AI modules (intent detection, context management, prompt generation).
 * It orchestrates the multi-layer processing pipeline for handling user requests.
 * 
 * All AI text generation is handled by Cohere's Command-R Plus model.
 */

import { inferIntent, detectProgrammingLanguage, Intent } from './intent/inferIntent';
import { getContextLevelForIntent, generateContextString, ArchitectureContext } from './context/contextManager';
import { buildSystemPrompt, formatUserMessage, getModelConfigForIntent } from './prompt/promptTemplates';
import { postProcessResponse, getResponseFormatForIntent, ResponseFormat } from './response/formatResponse';
// Dynamically import generateCohereChatCompletion to avoid circular dependencies

/**
 * Enhanced intent match with additional metadata
 */
export interface EnhancedIntentMatch {
  intentType: Intent;
  confidence: number;
  subType?: string;
  entities?: Record<string, string>;
  trigger?: string;
}

/**
 * Architecture modification subtypes and entity extraction patterns
 */
const architectureIntents = [
  {
    pattern: /(?:add|include|incorporate)\s+(?:a|an)?\s*([A-Za-z0-9\s]+)(?:\s+to|\s+in|\s+into|\s+for)?/i,
    subType: 'add_service',
    entityKeys: ['serviceName']
  },
  {
    pattern: /(?:remove|delete|exclude)\s+(?:the|a|an)?\s*([A-Za-z0-9\s]+)(?:\s+from|\s+in)?\s*(?:the|my|our)?\s*(?:architecture|system|diagram|project)?/i,
    subType: 'remove_service',
    entityKeys: ['serviceName']
  },
  {
    pattern: /(?:connect|link|integrate)\s+(?:the|a|an)?\s*([A-Za-z0-9\s]+)\s+(?:to|with|and)\s+(?:the|a|an)?\s*([A-Za-z0-9\s]+)/i,
    subType: 'connect_services',
    entityKeys: ['sourceService', 'targetService']
  },
  {
    pattern: /(?:edit|modify|change|update)\s+(?:the|a|an)?\s*([A-Za-z0-9\s]+)/i,
    subType: 'edit_service',
    entityKeys: ['serviceName']
  }
];

/**
 * Enhanced intent detection that combines inferIntent with entity extraction
 */
export function detectEnhancedIntent(message: string, hasArchitecture: boolean = true): EnhancedIntentMatch {
  // Use the inferIntent system as primary classifier
  const primaryIntent = inferIntent(message, hasArchitecture);
  
  // Start with high confidence for the primary intent
  const enhancedIntent: EnhancedIntentMatch = {
    intentType: primaryIntent,
    confidence: 0.9
  };
  
  // Extract entities and determine subtypes for architecture updates
  if (primaryIntent === 'architecture_update') {
    for (const intent of architectureIntents) {
      const match = message.match(intent.pattern);
      if (match) {
        const entities: Record<string, string> = {};
        
        // Extract entities if they exist in the match
        if (match.length > 1 && intent.entityKeys.length > 0) {
          for (let i = 0; i < intent.entityKeys.length && i + 1 < match.length; i++) {
            entities[intent.entityKeys[i]] = match[i + 1]?.trim() || '';
          }
        }
        
        enhancedIntent.subType = intent.subType;
        enhancedIntent.entities = entities;
        enhancedIntent.trigger = intent.pattern.toString();
        break;
      }
    }
  }
  
  // Adjust confidence based on heuristics
  adjustIntentConfidence(enhancedIntent, message);
  
  return enhancedIntent;
}

/**
 * Adjust intent confidence based on message characteristics
 */
function adjustIntentConfidence(intent: EnhancedIntentMatch, message: string): void {
  // 1. Question mark detection
  if (message.includes('?') && intent.intentType !== 'question') {
    intent.confidence -= 0.15;
  }
  
  // 2. Code-related keywords overrides
  if ((message.includes('code') || message.includes('script') || message.includes('snippet')) && 
      intent.intentType !== 'code_generation' && intent.intentType !== 'cdk_generation') {
    intent.confidence -= 0.1;
  }
  
  // 3. CDK priority
  if (message.toLowerCase().includes('cdk') && intent.intentType !== 'cdk_generation') {
    intent.confidence -= 0.2;
  }
  
  // 4. Very short messages - likely not architecture updates
  if (intent.intentType === 'architecture_update' && message.length < 15) {
    intent.confidence -= 0.3;
  }
}

/**
 * Generate the appropriate AI prompt based on intent and context
 */
export function generateAIPrompt(
  intent: EnhancedIntentMatch, 
  message: string,
  architecture: ArchitectureContext,
  targetLanguage: string
): string {
  // Get the appropriate context level for this intent
  const contextLevel = getContextLevelForIntent(intent.intentType);
  
  // Generate context string
  const contextString = generateContextString(architecture, contextLevel);
  
  // Get base system prompt
  const systemPrompt = buildSystemPrompt(intent.intentType, contextString);
  
  // Format user message
  const formattedUserMessage = formatUserMessage(intent.intentType, message);
  
  // Customize prompt based on intent type
  if (intent.intentType === 'architecture_update') {
    // Special case for architecture updates to ensure proper JSON formatting
    const nodesJson = JSON.stringify(architecture.nodes, null, 2);
    const edgesJson = JSON.stringify(architecture.edges, null, 2);
    const editType = intent.subType || 'modify';
    
    return `
You are an AWS architecture expert modifying a diagram JSON based on a user request.
CURRENT ARCHITECTURE JSON:
\`\`\`json
{ "nodes": ${nodesJson}, "edges": ${edgesJson} }
\`\`\`
USER REQUEST: "${message}"
TASK: Directly modify the architecture JSON to perform the '${editType}' action.
OUTPUT FORMAT (Strictly follow):
<architecture>
{ "nodes": [...], "edges": [...] }
</architecture>
<explanation>
Brief bullet points of changes made.
</explanation>
IMPORTANT: Return the COMPLETE, modified architecture JSON. Ensure nodes/edges arrays are valid.
`;
  } else if (intent.intentType === 'architecture_rationale') {
    // Special case for architecture rationale analysis
    const nodesJson = JSON.stringify(architecture.nodes, null, 2);
    const edgesJson = JSON.stringify(architecture.edges, null, 2);
    
    // Create a service list summary for cost estimation
    const servicesSummary = architecture.nodes.map(node => 
      `${node.data.service} (${node.data.label}): ${node.data.description || 'No description'}`
    ).join('\n- ');
    
    return `
You are an AWS architecture expert providing a comprehensive rationale and analysis.
CURRENT ARCHITECTURE JSON:
\`\`\`json
{ "nodes": ${nodesJson}, "edges": ${edgesJson} }
\`\`\`

Services Summary:
- ${servicesSummary}

USER REQUEST: "${message}"

TASK: Provide a detailed rationale and analysis of this AWS architecture, responding to the user's specific request.

Include in your comprehensive analysis:
1. Executive Summary - Brief overview of the architecture's purpose and design
2. Cost Analysis - Estimated monthly costs for each AWS service and approximate total cost
3. Architecture Components - Detailed explanation of each service's purpose
4. Data Flow - How information moves through the system
5. Security Assessment - Security features and potential improvements
6. Scalability Analysis - How the system handles increased load
7. Reliability & Availability - Disaster recovery and high availability features
8. Operational Excellence - Monitoring, alerting, and management
9. Best Practices - AWS recommendations that are followed or could be implemented
10. Trade-offs - Key design decisions and their implications

FORMAT: Use proper markdown formatting with clear headings, bullet points, and tables where appropriate.
For the cost analysis, include a table with service names, estimated usage, and monthly costs.

IMPORTANT: Make all cost estimates realistic based on typical usage patterns for this type of architecture.
`;
  } else if (intent.intentType === 'cdk_generation') {
    // Special case for CDK code generation
    return `
You are an AWS CDK expert generating COMPLETE, production-ready Infrastructure as Code.
${contextString}
USER REQUEST: "${message}"
TASK: Generate complete AWS CDK v2 code in ${targetLanguage} for the user's request, based on the provided architecture context.
OUTPUT FORMAT:
- Start with a brief one-sentence description (optional).
- Provide the code ONLY within a single markdown code block with the correct language tag (e.g., \`\`\`${targetLanguage} ... \`\`\`).
- Include necessary imports and structure the code properly (e.g., Stack class).
- DO NOT include explanations outside the code block unless specifically asked.
`;
  } else if (intent.intentType === 'code_generation') {
    // Special case for general code generation
    return `
You are a software engineer generating a concise code snippet.
${contextString}
USER REQUEST: "${message}"
TASK: Generate a code snippet in ${targetLanguage} that fulfills the user's request, referencing the provided architecture context if needed.
OUTPUT FORMAT:
- Start with a brief one-sentence description (optional, max 1 sentence).
- Provide the code ONLY within a single markdown code block with the correct language tag (\`\`\`${targetLanguage} ... \`\`\`).
- Include necessary imports/setup for the snippet to be understandable.
- DO NOT include lengthy explanations outside the code block.
`;
  } else {
    // Standard prompt for other intent types
    return `${systemPrompt}\n\nUSER MESSAGE: ${formattedUserMessage}`;
  }
}

/**
 * Process architecture update response to extract JSON and explanation
 */
export function processArchitectureUpdate(rawResponse: string): { 
  parsedArchitecture: any | null; 
  explanation: string;
} {
  // Multiple regex patterns to extract architecture JSON
  const patterns = [
    // XML-style tags (primary pattern)
    /<architecture>([\s\S]*?)<\/architecture>/,
    // JSON code block with architecture label
    /```(?:json)?\s*(?:architecture|diagram)?\s*([\s\S]*?)```/,
    // Fallback: any JSON code block
    /```json\s*([\s\S]*?)```/,
    // Last resort: try to find any JSON object with nodes and edges
    /(\{[\s\S]*?"nodes"\s*:\s*\[[\s\S]*?"edges"\s*:\s*\[[\s\S]*?\})/
  ];
  
  const explanationRegex = /<explanation>([\s\S]*?)<\/explanation>/;
  
  let parsedArchitecture = null;
  let architectureText = null;
  let explanation = "Architecture updated."; 
  
  // Try each pattern until we find a match
  for (const pattern of patterns) {
    const match = rawResponse.match(pattern);
    if (match && match[1]) {
      architectureText = match[1].trim();
      try { 
        // Clean up the text - remove any markdown artifacts
        architectureText = architectureText.replace(/^```json\s*|\s*```$/g, '');
        parsedArchitecture = JSON.parse(architectureText);
        
        // Validate that we have a proper architecture object
        if (parsedArchitecture && 
            Array.isArray(parsedArchitecture.nodes) && 
            Array.isArray(parsedArchitecture.edges)) {
          break; // Valid architecture found, exit the loop
        } else {
          parsedArchitecture = null; // Reset if invalid format
        }
      } 
      catch (e) { 
        console.error("Failed to parse extracted architecture JSON:", e);
        // Continue to next pattern
      }
    }
  }
  
  // Extract explanation
  const explanationMatch = rawResponse.match(explanationRegex);
  if (explanationMatch && explanationMatch[1]) {
    explanation = explanationMatch[1].trim();
  } else {
    // If no explicit explanation tag, use the response text minus any JSON blocks
    let cleanedResponse = rawResponse;
    patterns.forEach(pattern => {
      cleanedResponse = cleanedResponse.replace(pattern, '');
    });
    
    explanation = cleanedResponse.trim() || explanation;
    
    // If explanation is too long, trim it to a reasonable size
    if (explanation.length > 1500) {
      explanation = explanation.substring(0, 1500) + "...";
    }
  }
  
  return { parsedArchitecture, explanation };
}

/**
 * Main processing function that orchestrates the entire Jarvis pipeline
 */
export async function processJarvisRequest(
  message: string,
  architecture: ArchitectureContext,
  messageHistory?: any[]
): Promise<{
  response: string;
  architectureUpdated: boolean;
  updatedArchitecture?: any;
}> {
  try {
    // Layer 1: Intent Detection
    const enhancedIntent = detectEnhancedIntent(message, true);
    console.log('Detected Intent:', enhancedIntent);
    
    // Layer 2: Language Detection (if relevant)
    const targetLanguage = detectProgrammingLanguage(message) || 'typescript';
    console.log('Detected Language:', targetLanguage);
    
    // Layer 3: Generate AI Prompt
    const aiPrompt = generateAIPrompt(enhancedIntent, message, architecture, targetLanguage);
    
    // Layer 4: Generate AI Response using Cohere
    // Import generateCohereChatCompletion dynamically to avoid circular dependencies
    const { generateCohereChatCompletion } = await import('./cohere-chat');
    
    // Generate response with Cohere
    const rawResponse = await generateCohereChatCompletion({
      model: process.env.COHERE_MODEL || 'command-r-plus',
      message: message,
      promptContext: aiPrompt,
      temperature: enhancedIntent.intentType.includes('code') ? 0.5 : 0.7,
      maxTokens: 2000
    });
    
    // Layer 5: Process Response
    let responseContent = '';
    let architectureUpdated = false;
    let updatedArchitecture = null;
    
    if (enhancedIntent.intentType === 'architecture_update') {
      // Process architecture update
      const { parsedArchitecture, explanation } = processArchitectureUpdate(rawResponse);
      
      if (parsedArchitecture && parsedArchitecture.nodes && parsedArchitecture.edges) {
        responseContent = `✅ Architecture updated successfully.\n\n${explanation}`;
        architectureUpdated = true;
        updatedArchitecture = parsedArchitecture;
      } else {
        responseContent = "I tried to update the architecture, but couldn't parse the result properly. Please try rephrasing your request.";
      }
    } else {
      // Process other types of responses
      responseContent = postProcessResponse(enhancedIntent.intentType, rawResponse, targetLanguage);
    }
    
    return {
      response: responseContent,
      architectureUpdated,
      ...(architectureUpdated && { updatedArchitecture })
    };
  } catch (error: any) {
    console.error("Error in Jarvis processing:", error);
    return {
      response: "Sorry, I encountered an error while processing your request.",
      architectureUpdated: false
    };
  }
} 