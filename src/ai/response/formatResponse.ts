import { Intent } from '../intent/inferIntent';

/**
 * Response format type to indicate how the UI should render the response
 */
export type ResponseFormat = 
  | 'markdown'         // General markdown with potential formatting
  | 'code'             // Pure code block
  | 'code_with_explanation' // Code with explanations
  | 'architecture_update' // Architecture update with explanation
  | 'list'             // Lists or bullet points
  | 'comparison'       // Comparison table or points
  | 'conversation';    // Conversational plain text

/**
 * Metadata to attach to responses for additional context
 */
export interface ResponseMetadata {
  intent: Intent;
  language?: string | null; // For code-related responses
  needs_architecture_refresh?: boolean; // If architecture was modified
  suggestions?: string[]; // Potential follow-up questions
}

/**
 * Maps an intent to the expected response format
 */
export function getResponseFormatForIntent(intent: Intent): ResponseFormat {
  switch (intent) {
    case 'architecture_update':
      return 'architecture_update';
    case 'cdk_generation':
    case 'code_generation':
      return 'code';
    case 'code_explanation':
      return 'code_with_explanation';
    case 'architecture_explanation':
    case 'system_design':
      return 'markdown';
    case 'question':
    case 'comparison':
      return 'list';
    case 'greeting':
    case 'general_chat':
    default:
      return 'conversation';
  }
}

/**
 * Creates instructions for the AI model based on the detected intent
 */
export function getPromptForIntent(intent: Intent, message: string, language?: string | null): string {
  const baseInstructions = "You are Jarvis, an AWS architecture assistant. ";
  
  switch (intent) {
    case 'architecture_update':
      return `${baseInstructions}
Modify the architecture according to the user's request. Extract the exact changes needed from: "${message}"
Return the response in the following format:
<architecture>
{ "nodes": [...], "edges": [...] }
</architecture>
<explanation>
Clear, bullet-point explanation of the changes made.
</explanation>`;

    case 'cdk_generation':
      return `${baseInstructions}
Generate AWS CDK code in ${language || 'TypeScript'} based on the architecture and the request: "${message}"
Focus exclusively on providing implementation-ready code with proper imports and configurations.
Format your output as a single code block with language identifier.
Include only brief, necessary comments within the code.`;

    case 'code_generation':
      return `${baseInstructions}
Generate clear, concise ${language || ''} code that fulfills this request: "${message}"
Provide only the implementation code with minimal explanation.
Format your output as a single code block with language identifier.
Include proper imports and error handling.`;

    case 'code_explanation':
      return `${baseInstructions}
Explain how to implement code for this request: "${message}"
First provide a clear explanation of the approach in bullet points or step-by-step format.
Then provide a complete code implementation with descriptive comments.
Format code sections using proper markdown code blocks with language identifiers.`;

    case 'architecture_explanation':
      return `${baseInstructions}
Provide a clear explanation about this architectural topic: "${message}"
Use bullet points for key concepts.
Focus on AWS best practices and real-world applications.
Format your response using markdown for readability (headings, lists, bold for key terms).`;

    case 'system_design':
      return `${baseInstructions}
Design an AWS architecture approach for: "${message}"
Outline the key components and their relationships.
Explain the reasoning behind design choices.
Structure your response with clear sections using markdown formatting.`;

    case 'question':
      return `${baseInstructions}
Answer this question directly and concisely: "${message}"
Provide factual information about AWS services and best practices.
Use bullet points for multiple points if applicable.
Be direct and accurate - no need for lengthy explanations unless necessary.`;

    case 'comparison':
      return `${baseInstructions}
Compare the options as requested: "${message}"
Structure your response with clear categories:
1. Key differences
2. Use cases for each option
3. Trade-offs
Use bullet points and formatting to make the comparison clear.`;

    case 'greeting':
      return `${baseInstructions}
Respond briefly and conversationally to this greeting: "${message}"
Keep it short, friendly, and offer to help with their AWS architecture.
No need to mention specific architecture details unless the user specifically asks.`;

    case 'general_chat':
    default:
      return `${baseInstructions}
Respond conversationally to: "${message}"
Be helpful, concise, and focus on providing value related to AWS and cloud architecture.
Use natural, friendly language while maintaining professionalism.`;
  }
}

/**
 * Post-processes AI response based on intent
 * Ensures the response adheres to the expected format for that intent
 */
export function postProcessResponse(intent: Intent, rawResponse: string, language?: string | null): string {
  switch (intent) {
    case 'architecture_update':
      // Architecture updates are handled separately by the API route
      return rawResponse;
      
    case 'cdk_generation':
    case 'code_generation':
      // Ensure code is properly formatted with markdown code blocks
      if (!rawResponse.includes('```')) {
        // If no code block, wrap the entire response
        const lang = language || (intent === 'cdk_generation' ? 'typescript' : 'javascript');
        return `\`\`\`${lang}\n${rawResponse.trim()}\n\`\`\``;
      }
      
      // Extract the first code block with optional brief intro
      const codeBlockMatch = rawResponse.match(/```[a-z]*\n[\s\S]+?```/i);
      if (codeBlockMatch) {
        const introText = rawResponse.substring(0, rawResponse.indexOf('```')).trim();
        if (introText.length < 100) {
          return introText ? `${introText}\n\n${codeBlockMatch[0]}` : codeBlockMatch[0];
        }
        return codeBlockMatch[0];
      }
      
      return rawResponse;
      
    case 'code_explanation':
      // Ensure there's at least one code block, otherwise format properly
      if (!rawResponse.includes('```')) {
        // Split into explanation and code if possible
        const parts = rawResponse.split(/(?:Here'?s the code|Implementation:|Code example)/i);
        if (parts.length > 1) {
          const explanation = parts[0].trim();
          const code = parts[1].trim();
          const lang = language || 'javascript';
          return `${explanation}\n\n\`\`\`${lang}\n${code}\n\`\`\``;
        }
      }
      return rawResponse;
      
    case 'architecture_explanation':
    case 'system_design':
    case 'question':
    case 'comparison':
      // Ensure markdown formatting for structure
      // Add headers if none exist
      if (!rawResponse.includes('#')) {
        const lines = rawResponse.split('\n');
        if (lines.length > 3 && !lines[0].startsWith('#')) {
          // Add an appropriate header
          if (intent === 'architecture_explanation') {
            return `## Architecture Explanation\n\n${rawResponse}`;
          } else if (intent === 'system_design') {
            return `## System Design\n\n${rawResponse}`;
          } else if (intent === 'comparison') {
            return `## Comparison\n\n${rawResponse}`;
          }
        }
      }
      
      // Convert paragraphs to bullet points for improved readability if appropriate
      if ((intent === 'comparison' || intent === 'question') && 
          !rawResponse.includes('-') && 
          !rawResponse.includes('*') && 
          rawResponse.split('\n\n').length > 2) {
        
        const paragraphs = rawResponse.split('\n\n');
        const bulletPoints = paragraphs.map(p => p.trim().replace(/^\d+\.\s*/, '- '));
        return bulletPoints.join('\n\n');
      }
      
      return rawResponse;
      
    case 'greeting':
    case 'general_chat':
      // Keep it simple for conversational responses
      return rawResponse.trim();
      
    default:
      return rawResponse;
  }
} 