import { Intent } from '../intent/inferIntent';

/**
 * Context detail level for AI prompts
 */
export type ContextLevel = 
  | 'none'      // No architecture context (simple chat)
  | 'minimal'   // Just basic counts and high-level summary
  | 'summary'   // List of services and connections without JSON
  | 'full'      // Complete architecture JSON

/**
 * Architecture representation for AI context
 */
export interface ArchitectureContext {
  nodes: any[];
  edges: any[];
  metadata?: {
    prompt?: string;
    lastEditedAt?: string;
    lastEditedBy?: string;
    [key: string]: any;
  };
}

/**
 * Determine appropriate context level based on intent
 */
export function getContextLevelForIntent(intent: Intent): ContextLevel {
  switch (intent) {
    case 'architecture_update':
      return 'full';      // Need complete data for updates
    
    case 'cdk_generation':
      return 'full';      // Need complete data for CDK generation
    
    case 'code_generation':
    case 'code_explanation':
    case 'system_design':
      return 'summary';   // Detailed but not full JSON
    
    case 'architecture_explanation':
    case 'comparison':
    case 'question':
      return 'minimal';   // Basic info is sufficient
    
    case 'greeting':
    case 'general_chat':
    default:
      return 'none';      // No architecture data needed
  }
}

/**
 * Generate context string for AI prompts based on architecture and required detail level
 */
export function generateContextString(architecture: ArchitectureContext, level: ContextLevel): string {
  if (level === 'none') {
    return '';
  }
  
  // Basic counts for all levels
  const serviceCount = architecture.nodes.length;
  const connectionCount = architecture.edges.length;
  
  // Original requirement from metadata if available
  const originalRequirement = architecture.metadata?.prompt 
    ? `Original requirement: ${architecture.metadata.prompt}`
    : 'No original requirement specified';
  
  if (level === 'minimal') {
    return `
CURRENT ARCHITECTURE (MINIMAL):
- ${serviceCount} services
- ${connectionCount} connections
${originalRequirement}
`;
  }
  
  // Generate service summary for summary and full levels
  const servicesSummary = architecture.nodes.map(node =>
    `${node.data.service} (${node.data.label}): ${node.data.description || 'No description'}`
  ).join('\n- ');
  
  // Generate connections summary for summary and full levels
  const connectionsSummary = architecture.edges.map(edge => {
    const sourceNode = architecture.nodes.find(n => n.id === edge.source);
    const targetNode = architecture.nodes.find(n => n.id === edge.target);
    return `${sourceNode?.data.label || 'Unknown'} → ${targetNode?.data.label || 'Unknown'} (${edge.data?.protocol || 'default'})`;
  }).join('\n- ');
  
  if (level === 'summary') {
    return `
CURRENT ARCHITECTURE SUMMARY:
Services (${serviceCount}):
- ${servicesSummary}

Connections (${connectionCount}):
- ${connectionsSummary}

${originalRequirement}
`;
  }
  
  // Full level includes JSON data
  if (level === 'full') {
    const nodesJson = JSON.stringify(architecture.nodes, null, 2);
    const edgesJson = JSON.stringify(architecture.edges, null, 2);
    
    return `
FULL CURRENT ARCHITECTURE:
Nodes JSON: 
\`\`\`json
${nodesJson}
\`\`\`

Edges JSON: 
\`\`\`json
${edgesJson}
\`\`\`

Services Summary:
- ${servicesSummary}

Connections Summary:
- ${connectionsSummary}

${originalRequirement}
`;
  }
  
  // Should never reach here
  return '';
}

/**
 * Generate message history context from previous messages
 */
export function generateMessageHistoryContext(messages: any[], limit: number = 10): string {
  if (!messages || messages.length === 0) {
    return '';
  }
  
  // Take only the last few messages for context
  const recentMessages = messages.slice(-limit);
  
  return `
CONVERSATION HISTORY:
${recentMessages.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}
`;
} 