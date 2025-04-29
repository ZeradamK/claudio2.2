import { NextRequest, NextResponse } from 'next/server';
import { Architecture, getArchitecture } from '@/store/architecture-store';
import { ArchitectureContext } from '@/ai/context/contextManager';
import { detectEnhancedIntent } from '@/ai/jarvis-integration';
import { getContextLevelForIntent, generateContextString, generateMessageHistoryContext } from '@/ai/context/contextManager';
import { getOrCreateSession, updateSession } from '@/ai/jarvis-orchestrator';
import cohereInstance from '@/ai/cohere-instance';

export async function POST(req: NextRequest) {
  try {
    // 1. Check if Cohere API key is configured
    if (!process.env.COHERE_API_KEY) {
      return NextResponse.json(
        { message: 'Cohere API key is not configured. Please add it to your .env.local file.' },
        { status: 500 }
      );
    }

    // 2. Parse the request
    const body = await req.json();
    const { message, architectureId, messageHistory = [] } = body;

    // 3. Validate required fields
    if (!message) {
      return NextResponse.json(
        { message: 'Message is required' },
        { status: 400 }
      );
    }

    if (!architectureId) {
      return NextResponse.json(
        { message: 'Architecture ID is required' },
        { status: 400 }
      );
    }

    // 4. Retrieve architecture
    const architecture = await getArchitecture(architectureId);
    if (!architecture) {
      return NextResponse.json(
        { message: `Architecture with ID ${architectureId} not found` },
        { status: 404 }
      );
    }

    // 5. Convert to the expected format
    const architectureContext: ArchitectureContext = {
      nodes: architecture.nodes,
      edges: architecture.edges,
      metadata: architecture.metadata
    };

    // 6. Multi-layer processing
    // Layer 1: Intent Detection
    const startTime = performance.now();
    const enhancedIntent = detectEnhancedIntent(message, true);
    const intentDetectionTimeMs = performance.now() - startTime;
    
    // Layer 2: Context Generation
    const contextLevel = getContextLevelForIntent(enhancedIntent.intentType);
    const contextString = generateContextString(architectureContext, contextLevel);
    
    // Layer 3: Session & Message History Management
    const session = getOrCreateSession(architectureId);
    const previousMessages = session.messages || [];
    
    // Process message history for context
    let formattedHistory = [];
    if (messageHistory && messageHistory.length > 0) {
      formattedHistory = messageHistory.slice(-8).map(msg => ({
        role: msg.role,
        message: msg.content
      }));
    }
    
    // Layer 4: System Prompt Construction
    // Create a system prompt based on intent and architecture
    const systemPrompt = `You are Jarvis, an AWS architecture assistant specialized in cloud infrastructure design.
${contextString}

INTENT DETECTED: ${enhancedIntent.intentType}
${enhancedIntent.subType ? `SUB-INTENT: ${enhancedIntent.subType}` : ''}

YOUR TASK:
- Provide clear, concise, and technically accurate responses
- When discussing AWS architectures, recommend best practices
- Use markdown formatting for clarity
- For code, use proper code blocks with language tags`;

    // Layer 5: Generate Response with Cohere
    const cohereResponse = await cohereInstance.createChatCompletion({
      message,
      model: process.env.COHERE_MODEL || 'command-r-plus', // Use command-r-plus by default, but allow override
      chatHistory: formattedHistory,
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt
    });
    
    // Layer 6: Process Response
    const aiResponse = cohereResponse.response;
    const endTime = performance.now();
    const totalProcessingTimeMs = endTime - startTime;
    
    // Update session
    await updateSession(architectureId, {
      messages: [
        ...previousMessages,
        { role: 'user', content: message, timestamp: new Date().toISOString() },
        { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() }
      ]
    });
    
    // 7. Return enhanced response with metadata
    return NextResponse.json({
      response: aiResponse,
      architectureUpdated: false, // Cohere doesn't currently support architecture updates
      metadata: {
        intent: enhancedIntent.intentType,
        subIntent: enhancedIntent.subType,
        confidence: enhancedIntent.confidence,
        model: process.env.COHERE_MODEL || 'command-r-plus',
        metrics: {
          intentDetectionTimeMs,
          totalProcessingTimeMs
        }
      }
    });
  } catch (error: any) {
    console.error('Error in Jarvis-Cohere API:', error);
    
    return NextResponse.json(
      { message: error.message || 'An error occurred processing your request' },
      { status: 500 }
    );
  }
} 