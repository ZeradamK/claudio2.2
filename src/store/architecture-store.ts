/**
 * Architecture Store Module
 * 
 * Provides functions for managing architecture data in the CloudMap application.
 * Uses the in-memory architectureStore from src/app/api/store.ts
 * In a production environment, this would be replaced with database operations.
 */

import { architectureStore } from '@/app/api/store';

/**
 * Architecture interface defining the expected structure
 */
export interface Architecture {
  nodes: any[];
  edges: any[];
  metadata?: {
    prompt?: string;
    rationale?: string;
    cdkCode?: string;
    cdkLanguage?: string;
    lastEditedAt?: string;
    lastEditedBy?: string;
    [key: string]: any;
  };
}

/**
 * Get an architecture by ID
 */
export async function getArchitecture(architectureId: string): Promise<Architecture | null> {
  if (!architectureId) return null;
  
  // Retrieve from the in-memory store
  const architecture = architectureStore[architectureId];
  return architecture || null;
}

/**
 * Save or update an architecture
 */
export async function saveArchitecture(
  architectureId: string, 
  architecture: Architecture, 
  editedBy: string = 'system'
): Promise<Architecture> {
  if (!architectureId) throw new Error('Architecture ID is required');
  
  // Update metadata
  const updatedArchitecture = {
    ...architecture,
    metadata: {
      ...architecture.metadata,
      lastEditedAt: new Date().toISOString(),
      lastEditedBy: editedBy
    }
  };
  
  // Store in memory
  architectureStore[architectureId] = updatedArchitecture;
  
  return updatedArchitecture;
}

/**
 * Delete an architecture by ID
 */
export async function deleteArchitecture(architectureId: string): Promise<boolean> {
  if (!architectureId) return false;
  
  if (architectureStore[architectureId]) {
    delete architectureStore[architectureId];
    return true;
  }
  
  return false;
}

/**
 * Get all architectures (for listing)
 */
export async function getAllArchitectures(): Promise<{id: string, architecture: Architecture}[]> {
  return Object.entries(architectureStore).map(([id, architecture]) => ({
    id,
    architecture: architecture as Architecture
  }));
}

/**
 * Update specific fields of an architecture
 */
export async function updateArchitectureFields(
  architectureId: string,
  fields: Partial<Architecture>,
  editedBy: string = 'system'
): Promise<Architecture | null> {
  const architecture = await getArchitecture(architectureId);
  if (!architecture) return null;
  
  const updatedArchitecture = {
    ...architecture,
    ...fields,
    metadata: {
      ...architecture.metadata,
      ...fields.metadata,
      lastEditedAt: new Date().toISOString(),
      lastEditedBy: editedBy
    }
  };
  
  return saveArchitecture(architectureId, updatedArchitecture, editedBy);
} 