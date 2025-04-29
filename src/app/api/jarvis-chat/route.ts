import { NextRequest, NextResponse } from 'next/server';
import { streamingCohereChatCompletion } from '@/ai/cohere-streaming';
import { isCohereConfigured } from '@/ai/cohere-instance';
import { detectEnhancedIntent } from '@/ai/jarvis-integration';
import { detectLanguage } from '@/utils/language-detection';
import { Architecture, getArchitecture, saveArchitecture } from '@/store/architecture-store';
import { getOrCreateSession, updateSession } from '@/ai/jarvis-orchestrator';
import { getContextLevelForIntent, generateContextString } from '@/ai/context/contextManager';
import { processArchitectureUpdate } from '@/ai/jarvis-integration';

export const maxDuration = 60; // Set max duration to 60 seconds

interface ChatRequest {
  message: string;
  architectureId: string;
  sessionId?: string;
  messageHistory?: Array<{id: string; role: string; content: string; timestamp: string}>;
}

interface ChatHistoryItem {
  role: string;
  message: string;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Check if Cohere API key is configured
    if (!isCohereConfigured()) {
      return NextResponse.json(
        { error: 'Cohere API key is not configured. Please add it to your .env.local file.' },
        { status: 500 }
      );
    }

    // 2. Parse the request
    const requestData: ChatRequest = await req.json();
    const { message, architectureId, sessionId, messageHistory = [] } = requestData;

    // 3. Validate required fields
    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    if (!architectureId) {
      return NextResponse.json(
        { error: 'Architecture ID is required' },
        { status: 400 }
      );
    }

    // 4. Retrieve architecture
    const architecture = await getArchitecture(architectureId);
    if (!architecture) {
      return NextResponse.json(
        { error: `Architecture with ID ${architectureId} not found` },
        { status: 404 }
      );
    }

    // 5. Multi-layer processing
    // Layer 1: Intent Detection
    const enhancedIntent = detectEnhancedIntent(message, !!architecture);
    const intentType = enhancedIntent.intentType;
    
    // Layer 2: Language Detection
    const detectedLanguage = detectLanguage(message);
    
    // Layer 3: Conversation Context Management
    const session = getOrCreateSession(sessionId || architectureId);
    
    // Process message history for context
    const formattedHistory: ChatHistoryItem[] = [];
    if (messageHistory && messageHistory.length > 0) {
      messageHistory.slice(-8).forEach(msg => {
        formattedHistory.push({
          role: msg.role === 'user' ? 'USER' : 'CHATBOT',
          message: msg.content
        });
      });
    }
    
    // Layer 4: Context Generation
    const contextLevel = getContextLevelForIntent(intentType);
    const architectureContext = {
      nodes: architecture.nodes,
      edges: architecture.edges,
      metadata: architecture.metadata
    };
    const contextString = generateContextString(architectureContext, contextLevel);
    
    // Layer 5: System Prompt Construction - Enhanced for architecture updates
    const isArchitectureUpdate = intentType === 'architecture_update';
    
    const systemPrompt = `You are Jarvis, an AWS cloud architecture assistant specialized in cloud infrastructure design.
${contextString}

INTENT DETECTED: ${intentType}
${enhancedIntent.subType ? `SUB-INTENT: ${enhancedIntent.subType}` : ''}

${isArchitectureUpdate ? `
ARCHITECTURE MODIFICATION CAPABILITIES:
You have the ability to directly modify this architecture diagram. When the user asks you to:
- Add new services or components
- Remove existing components
- Change connections between services 
- Optimize the architecture
- Implement architectural patterns

IMPORTANT RESPONSE FORMAT FOR ARCHITECTURE UPDATES:
1. First provide an explanation of what changes you'll make and why 
2. Then include the complete updated architecture JSON like this:

\`\`\`json
{
  "nodes": [
    // Full array of ALL nodes (existing and new)
    {
      "id": "node-1",
      "type": "awsService",
      "position": { "x": 100, "y": 100 },
      "data": { 
        "label": "API Gateway",
        "service": "Amazon API Gateway",
        "description": "Description here"
      },
      "style": { "background": "#ec407a", "color": "white" }
    },
    // Include all other nodes here - NEVER omit any nodes unless explicitly asked to remove them
  ],
  "edges": [
    // Full array of ALL edges (connections between nodes)
    {
      "id": "edge-1-2",
      "source": "node-1",
      "target": "node-2",
      "animated": true,
      "data": { "dataFlow": "REST API requests", "protocol": "HTTPS" }
    },
    // Include all other edges here
  ]
}
\`\`\`

3. After the JSON, add "Architecture Updated Successfully" to confirm the update
4. Always preserve existing node positions when modifying
5. When adding new nodes, place them logically near related services
6. CRITICAL: Include EVERY existing node and edge in your response JSON unless explicitly asked to remove them
` : ''}

YOUR TASK:
- Provide clear, concise, and technically accurate responses
- When discussing AWS architectures, recommend best practices
- Use markdown formatting for clarity
- For code, use proper code blocks with language tags
- Consider the detected language: ${detectedLanguage || 'Not specified'}

You can help users with:
1. Modifying architecture design
2. Adding or removing components
3. Generating code for implementation
4. Explaining AWS services
5. Optimizing cost and performance`;

    // Update session with the new user message
    await updateSession(session.id, {
      messages: [
        ...(session.messages || []),
        { role: 'user', content: message, timestamp: new Date().toISOString() }
      ]
    });
    
    // For architecture updates, we need to get a complete response for processing
    if (isArchitectureUpdate) {
      // Use non-streaming for architecture updates to process the complete response
      const cohereResponse = await streamingCohereChatCompletion({
        model: process.env.COHERE_MODEL || 'command-r-plus',
        message,
        promptContext: systemPrompt,
        temperature: 0.7,
        maxTokens: 3000, // Increased for complete architecture details
        chatHistory: formattedHistory
      });
      
      // Read the entire response
      const responseText = await new Response(cohereResponse.body).text();
      
      // Track if we need to update the session with the assistant's response
      let sessionUpdated = false;
      
      // Process architecture updates if this is an architecture update intent
      try {
        console.log('Processing architecture update...');
        // Process the architecture update
        const { parsedArchitecture, explanation } = processArchitectureUpdate(responseText);
        
        // If we have parsed architecture changes, apply them
        if (parsedArchitecture && Object.keys(parsedArchitecture).length > 0 && 
            Array.isArray(parsedArchitecture.nodes) && Array.isArray(parsedArchitecture.edges)) {
          
          // Validate that nodes have the required structure
          const validNodes = parsedArchitecture.nodes.every((node: any) => 
            node.id && node.position && node.data && node.data.label && node.data.service
          );
          
          // Validate that edges have the required structure
          const validEdges = parsedArchitecture.edges.every((edge: any) => 
            edge.id && edge.source && edge.target
          );
          
          if (validNodes && validEdges) {
            // Create updated architecture
            const updatedArchitecture: Architecture = {
              ...architecture,
              nodes: parsedArchitecture.nodes,
              edges: parsedArchitecture.edges,
              metadata: {
                ...architecture.metadata,
                lastEditedAt: new Date().toISOString(),
                lastEditedBy: 'Jarvis',
                lastUpdateRequest: message
              }
            };
            
            // Save the updated architecture
            await saveArchitecture(architectureId, updatedArchitecture, 'Jarvis');
            console.log(`Architecture updated by Jarvis: ${architectureId}`);
            
            // Update the session with the assistant's response
            await updateSession(session.id, {
              messages: [
                ...(session.messages || []),
                { 
                  role: 'assistant', 
                  content: responseText, 
                  timestamp: new Date().toISOString() 
                }
              ]
            });
            sessionUpdated = true;
            
            // Add confirmation to the response if not already present
            let finalResponse = responseText;
            if (!finalResponse.includes('Architecture Updated Successfully')) {
              finalResponse += '\n\n**Architecture Updated Successfully**';
            }
            
            // Return the streaming response with the updated architecture confirmation
            return new Response(finalResponse, {
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Intent-Type': intentType,
                'X-Intent-Confidence': enhancedIntent.confidence.toString(),
                'X-Architecture-Updated': 'true'
              }
            });
          } else {
            // Invalid node or edge structure
            console.error('Invalid node or edge structure in architecture update');
            const errorMessage = 'I tried to update the architecture, but the structure was invalid. Please try again with more specific instructions.';
            
            // Update session with error message
            await updateSession(session.id, {
              messages: [
                ...(session.messages || []),
                { 
                  role: 'assistant', 
                  content: errorMessage, 
                  timestamp: new Date().toISOString() 
                }
              ]
            });
            sessionUpdated = true;
            
            return new Response(errorMessage, {
              headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Intent-Type': intentType,
                'X-Intent-Confidence': enhancedIntent.confidence.toString(),
                'X-Architecture-Updated': 'false'
              }
            });
          }
        } else {
          // No valid architecture found in the response
          console.log('No valid architecture found in response');
        }
      } catch (updateError) {
        console.error('Error processing architecture update:', updateError);
        // If session wasn't updated yet, update it with an error message
        if (!sessionUpdated) {
          const errorMessage = 'I encountered an error while trying to update the architecture. Please try again with more specific instructions.';
          
          await updateSession(session.id, {
            messages: [
              ...(session.messages || []),
              { 
                role: 'assistant', 
                content: errorMessage, 
                timestamp: new Date().toISOString() 
              }
            ]
          });
        }
        // Continue with normal response if update processing fails
      }
      
      // If architecture update processing failed or did not produce changes,
      // update the session if it wasn't already updated
      if (!sessionUpdated) {
        await updateSession(session.id, {
          messages: [
            ...(session.messages || []),
            { 
              role: 'assistant', 
              content: responseText, 
              timestamp: new Date().toISOString() 
            }
          ]
        });
      }
      
      // Return the original response with headers
      return new Response(responseText, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Intent-Type': intentType,
          'X-Intent-Confidence': enhancedIntent.confidence.toString(),
          'X-Architecture-Updated': 'false'
        }
      });
    }
    
    // For non-architecture updates, use streaming response
    const streamResponse = await streamingCohereChatCompletion({
      model: process.env.COHERE_MODEL || 'command-r-plus',
      message,
      promptContext: systemPrompt,
      temperature: 0.7,
      maxTokens: 2000,
      chatHistory: formattedHistory
    });

    // Set custom headers for intent detection
    const responseWithHeaders = new Response(streamResponse.body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Intent-Type': intentType,
        'X-Intent-Confidence': enhancedIntent.confidence.toString(),
        'Transfer-Encoding': 'chunked'
      }
    });

    // Return the streaming response
    return responseWithHeaders;
    
  } catch (error: any) {
    console.error('Error processing Jarvis chat request:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
} 