import { NextResponse } from 'next/server';
import { isGoogleAIConfigured } from '@/ai/ai-instance';
import { isCohereConfigured } from '@/ai/cohere-instance';

/**
 * API endpoint that checks if all required API keys are configured
 * This helps provide clear error messages to users when there are configuration issues
 */
export async function GET() {
  try {
    // Check if Cohere API key is configured (primary)
    const cohereConfigured = isCohereConfigured();
    
    // Check if Google AI API key is configured (optional)
    const googleaiConfigured = isGoogleAIConfigured();
    
    // Generate error message for UI if keys are missing
    let error: string | undefined;
    if (!cohereConfigured) {
      error = "Cohere API key is missing. Please add it to your .env.local file to enable Jarvis.";
    }
    
    // Check for ENABLE_STREAMING flag
    const streamingEnabled = process.env.ENABLE_STREAMING === 'true';
    
    // Return the configuration status
    return NextResponse.json({
      cohereConfigured,
      googleaiConfigured,
      streamingEnabled,
      primaryProvider: 'cohere',
      models: {
        cohere: process.env.COHERE_MODEL || 'command-r-plus',
        googleai: 'gemini-2.0-flash'
      },
      debug: {
        jarvis: process.env.DEBUG_JARVIS === 'true',
        intent: process.env.DEBUG_INTENT_DETECTION === 'true',
        prompts: process.env.DEBUG_PROMPTS === 'true'
      },
      error,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    // Log the error and return an error response
    console.error('Error checking API configuration:', error);
    return NextResponse.json(
      { 
        error: error.message || 'An error occurred while checking API configuration',
        cohereConfigured: false,
        googleaiConfigured: false,
        streamingEnabled: false,
        primaryProvider: 'cohere'
      },
      { status: 500 }
    );
  }
} 