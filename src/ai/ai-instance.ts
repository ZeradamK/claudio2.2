/**
 * AI Instance Module 
 * 
 * This module provides access to the Cohere AI models used by the application.
 * It's configured to use Cohere's Command-R Plus model for all AI interactions.
 */

import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { isCohereConfigured } from './cohere-instance';
import { Intent } from './intent/inferIntent';

// Initialize Genkit with Google AI (kept for compatibility with existing code)
export const ai = genkit({
  promptDir: './prompts',
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    }),
  ],
  model: 'googleai/gemini-2.0-flash',
});

// Helper to check if Google AI is properly configured
export function isGoogleAIConfigured(): boolean {
  return !!process.env.GOOGLE_GENAI_API_KEY;
}

// Helper to select the best available model based on intent
export function selectModelForIntent(intent: Intent): {
  provider: 'cohere';
  model: string;
  temperature: number;
} {
  // Default to the Cohere model for all intents
  return {
    provider: 'cohere',
    model: process.env.COHERE_MODEL || 'command-r-plus',
    temperature: getTemperatureForIntent(intent)
  };
}

// Helper function to get appropriate temperature based on the intent
function getTemperatureForIntent(intent: Intent): number {
  // Code generation needs lower temperature for precision
  if (intent === 'code_generation' || intent === 'cdk_generation') {
    return 0.5;
  }
  
  // Explanations benefit from slightly higher temperature
  if (intent === 'architecture_explanation' || intent === 'code_explanation') {
    return 0.8;
  }
  
  // Default temperature for other intents
  return 0.7;
}

// Log configuration status at startup
if (process.env.DEBUG_JARVIS === 'true') {
  console.log('AI Configuration Status:');
  console.log(`- Google AI API Key: ${isGoogleAIConfigured() ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`- Cohere API Key: ${isCohereConfigured() ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`- Primary Model: ${process.env.COHERE_MODEL || 'command-r-plus'}`);
}
