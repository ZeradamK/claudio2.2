/**
 * Cohere API Integration for Jarvis
 * 
 * This module provides integration with Cohere's AI models as an alternative to OpenAI.
 */

import { CohereClient } from "cohere-ai";

// Initialize Cohere client with API key from environment variable
export const cohereClient = new CohereClient({
  token: process.env.COHERE_API_KEY || "",
});

// Validate that the API key is set
if (!process.env.COHERE_API_KEY) {
  console.warn('COHERE_API_KEY environment variable is not set. Cohere API will not function correctly.');
}

// Helper function to check if the Cohere client is properly configured
export function isCohereConfigured(): boolean {
  return !!process.env.COHERE_API_KEY;
} 