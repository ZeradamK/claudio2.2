import { NextRequest, NextResponse } from 'next/server';
import { Architecture, getArchitecture, saveArchitecture } from '@/store/architecture-store';
import { ArchitectureContext } from '@/ai/context/contextManager';
import { orchestrateJarvisRequest } from '@/ai/jarvis-orchestrator';

/**
 * @deprecated This endpoint uses OpenAI. Please use /api/jarvis-chat instead which uses Cohere.
 */
export async function POST(req: NextRequest) {
  try {
    // Check if we should redirect to the Cohere endpoint
    return NextResponse.json(
      { 
        message: 'This endpoint is deprecated. Please use /api/jarvis-chat which uses Cohere AI.', 
        redirect: '/api/jarvis-chat' 
      }, 
      { status: 308 }
    );
    
    // Old implementation code below is no longer used
    const body = await req.json();
    const { message, architectureId, messageHistory } = body;

    if (!message || !architectureId) {
      return NextResponse.json(
        { message: 'Invalid request: message and architectureId are required' }, { status: 400 }
      );
    }

    const architecture = await getArchitecture(architectureId);
    if (!architecture) {
      return NextResponse.json(
        { message: `Architecture with ID ${architectureId} not found` }, { status: 404 }
      );
    }

    // Convert architecture to the expected format
    const architectureContext: ArchitectureContext = {
      nodes: architecture.nodes,
      edges: architecture.edges,
      metadata: architecture.metadata
    };

    // Process the request using our orchestration layer
    const result = await orchestrateJarvisRequest(
      message, 
      architectureId, 
      architectureContext, 
      messageHistory
    );
    
    // If the architecture was updated, save it
    if (result.architectureUpdated && result.updatedArchitecture) {
      await saveArchitecture(architectureId, result.updatedArchitecture as Architecture, 'Jarvis');
    }

    // Return the enhanced response with metadata
    return NextResponse.json({
      response: result.response,
      architectureUpdated: result.architectureUpdated,
      ...(result.architectureUpdated && { updatedArchitecture: result.updatedArchitecture }),
      ...(result.metadata && { metadata: result.metadata })
    });

  } catch (error: any) {
    console.error("Error in POST /api/jarvis-assistant:", error);
    return NextResponse.json(
      { message: 'Internal Server Error', error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 