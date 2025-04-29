import { NextRequest } from 'next/server';
import { Architecture, getArchitecture, saveArchitecture } from '@/store/architecture-store';
import { ArchitectureContext } from '@/ai/context/contextManager';
import { OpenAI } from 'openai';
import { detectEnhancedIntent } from '@/ai/jarvis-integration';
import { getContextLevelForIntent, generateContextString } from '@/ai/context/contextManager';
import { buildSystemPrompt, formatUserMessage, getModelConfigForIntent } from '@/ai/prompt/promptTemplates';
import { detectProgrammingLanguage } from '@/ai/intent/inferIntent';
import { generateFollowupSuggestions } from '@/ai/flows/followup-generator';

// Initialize OpenAI client with API key from environment variable
// IMPORTANT: Set this in your .env.local file, not directly in code
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Save architecture helper function is no longer needed since we're using the architecture-store module

interface MultiModalRequest {
  message: string;
  architectureId: string;
  messageHistory?: Array<{id: string; role: string; content: string; timestamp: string}>;
  imageUrls?: string[];
  attachments?: {
    type: 'image' | 'file';
    url: string;
    name?: string;
  }[];
}

export async function POST(req: NextRequest) {
  try {
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { message: 'OpenAI API key not configured. Please set the OPENAI_API_KEY environment variable.' }, 
        { status: 500 }
      );
    }

    const body = await req.json() as MultiModalRequest;
    const { message, architectureId, messageHistory, imageUrls, attachments } = body;

    if (!message || !architectureId) {
      return Response.json(
        { message: 'Invalid request: message and architectureId are required' }, 
        { status: 400 }
      );
    }

    // Get architecture using the architecture-store module
    const architecture = await getArchitecture(architectureId);
    if (!architecture) {
      return Response.json(
        { message: `Architecture with ID ${architectureId} not found` }, 
        { status: 404 }
      );
    }

    // Convert architecture to the expected format
    const architectureContext: ArchitectureContext = {
      nodes: architecture.nodes,
      edges: architecture.edges,
      metadata: architecture.metadata
    };

    // MULTI-LAYER PROCESSING APPROACH
    
    // Layer 1: Intent Detection 
    const enhancedIntent = detectEnhancedIntent(message, true);
    console.log('Detected Intent:', enhancedIntent.intentType, enhancedIntent.subType || '');
    
    // Layer 2: Language Detection
    const targetLanguage = detectProgrammingLanguage(message) || 'typescript';
    console.log('Detected Language:', targetLanguage);
    
    // Layer 3: Context Generation
    const contextLevel = getContextLevelForIntent(enhancedIntent.intentType);
    const contextString = generateContextString(architectureContext, contextLevel);
    
    // Layer 4: Prompt Engineering
    const systemPrompt = buildSystemPrompt(enhancedIntent.intentType, contextString);
    const userMessage = formatUserMessage(enhancedIntent.intentType, message);
    
    // Additional context for GPT-4o
    const modelConfig = getModelConfigForIntent(enhancedIntent.intentType);
    const isArchitectureUpdate = enhancedIntent.intentType === 'architecture_update';
    
    // Generate follow-up suggestions
    const suggestedFollowUps = generateFollowupSuggestions(enhancedIntent, architectureContext);
    
    // Add image content if provided
    const messages: Array<{role: string; content: any}> = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add message history for context if available
    if (messageHistory && messageHistory.length > 0) {
      const recentMessages = messageHistory.slice(-5).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));
      messages.push(...recentMessages);
    }
    
    // Build the final user message with optional images
    if (imageUrls && imageUrls.length > 0) {
      // For multi-modal content, we need to use an array of content parts
      const contentParts: Array<{type: string; text?: string; image_url?: {url: string}}> = [
        { type: 'text', text: userMessage }
      ];
      
      // Add each image URL as a content part
      imageUrls.forEach(url => {
        contentParts.push({
          type: 'image_url',
          image_url: { url }
        });
      });
      
      messages.push({ role: 'user', content: contentParts });
    } else {
      // Simple text message
      messages.push({ role: 'user', content: userMessage });
    }
    
    // Layer 5: Function Calling Setup for architecture updates
    const functions = isArchitectureUpdate ? [
      {
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
    ] : undefined;

    // Layer 6: AI Response Generation with GPT-4o
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages,
      temperature: modelConfig.temperature,
      max_tokens: isArchitectureUpdate ? 4096 : 2048,
      response_format: isArchitectureUpdate 
        ? { type: "text" }  // We'll handle JSON parsing manually for architecture updates
        : undefined,
      tools: functions,
    });
    
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
            // Save the updated architecture using our store module
            updatedArchitecture = args.architecture;
            await saveArchitecture(architectureId, args.architecture as Architecture, 'Jarvis');
            
            architectureUpdated = true;
            finalResponse = args.explanation;
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
              // Save the updated architecture
              await saveArchitecture(architectureId, updatedArchitecture);
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
      }
    }
    
    // Return the enhanced response with metadata
    return Response.json({
      response: finalResponse,
      architectureUpdated: architectureUpdated,
      ...(architectureUpdated && { updatedArchitecture }),
      metadata: {
        intent: enhancedIntent.intentType,
        subIntent: enhancedIntent.subType,
        suggestedFollowUps: suggestedFollowUps,
        tokensUsed: response.usage?.total_tokens || 0,
        model: response.model
      }
    });

  } catch (error: any) {
    console.error("Error in POST /api/jarvis-multi-modal:", error);
    return Response.json(
      { message: 'Internal Server Error', error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 