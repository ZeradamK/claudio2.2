import { NextRequest, NextResponse } from 'next/server';
import { streamingCohereChatCompletion } from '@/ai/cohere-streaming';
import { isCohereConfigured } from '@/ai/cohere-instance';
import { detectEnhancedIntent } from '@/ai/jarvis-integration';
import { detectLanguage } from '@/utils/language-detection';
import { Architecture, getArchitecture } from '@/store/architecture-store';
import { getOrCreateSession, updateSession } from '@/ai/jarvis-orchestrator';
import { getContextLevelForIntent, generateContextString } from '@/ai/context/contextManager';

export const maxDuration = 60; // Set max duration to 60 seconds

interface StreamRequest {
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
    // 1. Validate Cohere API key
    if (!isCohereConfigured()) {
      return NextResponse.json(
        { error: 'Cohere API key is not configured' },
        { status: 500 }
      );
    }

    // 2. Parse request
    const requestData: StreamRequest = await req.json();
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

    // 4. Get architecture
    const architecture: Architecture | null = await getArchitecture(architectureId);
    if (!architecture) {
      return NextResponse.json(
        { error: 'Architecture not found' },
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
    
    // Layer 5: System Prompt Construction
    const systemPrompt = `You are Jarvis, an AWS architecture assistant specialized in cloud infrastructure design.
${contextString}

INTENT DETECTED: ${intentType}
${enhancedIntent.subType ? `SUB-INTENT: ${enhancedIntent.subType}` : ''}

YOUR TASK:
- Provide clear, concise, and technically accurate responses
- When discussing AWS architectures, recommend best practices
- Use markdown formatting for clarity
- For code, use proper code blocks with language tags
- Consider the detected language: ${detectedLanguage || 'Not specified'}`;

    // Update session with the new user message
    await updateSession(session.id, {
      messages: [
        ...(session.messages || []),
        { role: 'user', content: message, timestamp: new Date().toISOString() }
      ]
    });
    
    // Layer 6: Generate Streaming Response with Cohere
    const streamResponse = await streamingCohereChatCompletion({
      model: process.env.COHERE_MODEL || 'command-r-plus',
      message,
      promptContext: systemPrompt,
      temperature: 0.7,
      maxTokens: 2000,
      chatHistory: formattedHistory
    });

    // Return the streaming response
    return streamResponse;
    
  } catch (error: any) {
    console.error('Error processing Cohere streaming request:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
} 