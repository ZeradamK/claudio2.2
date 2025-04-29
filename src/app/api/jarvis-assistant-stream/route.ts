import { NextRequest, NextResponse } from 'next/server';

/**
 * @deprecated This endpoint uses OpenAI. Please use /api/jarvis-chat instead which uses Cohere.
 */
export async function POST(req: NextRequest) {
  try {
    // Redirect to the Cohere endpoint
    return NextResponse.json(
      { 
        message: 'This endpoint is deprecated. Please use /api/jarvis-chat which uses Cohere AI.', 
        redirect: '/api/jarvis-chat' 
      }, 
      { status: 308 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/jarvis-assistant-stream:", error);
    return NextResponse.json(
      { message: 'Internal Server Error', error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 