import { Intent } from '../intent/inferIntent';

/**
 * Interface for all prompt templates
 */
export interface PromptTemplate {
  systemPrompt: string;
  userPromptPrefix?: string;
  userPromptSuffix?: string;
  temperature?: number;
  model?: string;
}

/**
 * Base system prompt used as foundation for all prompts
 */
const BASE_SYSTEM_PROMPT = `You are Jarvis, an intelligent AI assistant specialized in cloud architecture and system design.
You provide helpful, accurate, and concise responses. 
Always prioritize clarity, security best practices, and scalable design when giving recommendations.
`;

/**
 * Architecture-specific system prompt extension
 */
const ARCHITECTURE_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}
You excel at cloud architecture design using AWS services. When analyzing or modifying architectures:
1. Focus on security, scalability, and cost-effectiveness
2. Use appropriate AWS services for each requirement
3. Consider separation of concerns and system boundaries
4. Suggest efficient data flows between services
5. Recommend appropriate connection protocols between services
`;

/**
 * Code generation system prompt extension
 */
const CODE_SYSTEM_PROMPT = `${BASE_SYSTEM_PROMPT}
You excel at writing clean, efficient, and well-documented code. When generating code:
1. Follow best practices and design patterns for the target language
2. Include necessary error handling and edge cases
3. Write clear comments explaining complex logic
4. Structure the code for maintainability and extensibility
5. Use modern syntax and features when appropriate
`;

/**
 * CDK-specific system prompt extension
 */
const CDK_SYSTEM_PROMPT = `${CODE_SYSTEM_PROMPT}
You specialize in AWS CDK (Cloud Development Kit) using TypeScript. When generating CDK code:
1. Use L2 constructs when available for better abstractions
2. Apply security best practices (least privilege IAM, encryption)
3. Create reusable and modular constructs 
4. Use proper CDK patterns and idioms
5. Include necessary imports and explicit dependencies
6. Consider resource removal policies and retention strategies
`;

/**
 * Specialized prompt templates for each intent type
 */
const promptTemplates: Record<Intent, PromptTemplate> = {
  architecture_update: {
    systemPrompt: `${ARCHITECTURE_SYSTEM_PROMPT}
When updating an architecture based on user requirements:
1. Always maintain the structure of the existing architecture where possible
2. Add or modify only the necessary components to fulfill the request
3. Preserve IDs and relationships of existing components
4. Explain your reasoning for each change
5. Return the updated nodes and edges JSON that can be directly used to replace the existing architecture`,
    userPromptPrefix: "Please update the current architecture based on this requirement: ",
    temperature: 0.2
  },
  
  architecture_rationale: {
    systemPrompt: `${ARCHITECTURE_SYSTEM_PROMPT}
When providing a comprehensive architecture rationale:
1. Analyze the current architecture in detail including costs, scalability, and security
2. Estimate the cost of each AWS service and provide a total monthly cost estimate
3. Describe the purpose and importance of each component in the system
4. Explain data flows and service connections, including why certain connections exist
5. Evaluate the security, compliance, and operational aspects of the design
6. Provide relevant best practices and potential improvements
7. Format your response with clear markdown headings and structure`,
    userPromptPrefix: "Please provide a comprehensive rationale and analysis for this architecture: ",
    temperature: 0.3,
    model: "gpt-4"
  },
  
  cdk_generation: {
    systemPrompt: `${CDK_SYSTEM_PROMPT}
When generating CDK code for the architecture:
1. Create TypeScript CDK constructs that implement the entire architecture
2. Organize code into logical stacks based on service boundaries
3. Include all necessary connections and permissions between services
4. Add appropriate comments explaining implementation decisions
5. Format your response as compilable TypeScript code in markdown code blocks`,
    userPromptPrefix: "Generate AWS CDK TypeScript code for the following architecture: ",
    temperature: 0.2,
    model: "gpt-4"
  },
  
  code_generation: {
    systemPrompt: `${CODE_SYSTEM_PROMPT}
When generating code based on requirements:
1. Implement a complete solution that meets all specified requirements
2. Structure the code logically with proper separation of concerns
3. Include error handling, validation, and edge case management
4. Add appropriate comments explaining implementation decisions
5. Format your response as compilable code in markdown code blocks`,
    userPromptPrefix: "Please generate code for the following requirement: ",
    temperature: 0.3
  },
  
  code_explanation: {
    systemPrompt: `${BASE_SYSTEM_PROMPT}
When explaining code:
1. First summarize what the code does at a high level
2. Break down key sections and explain their purpose
3. Identify important patterns, algorithms, or techniques used
4. Note any potential issues, optimizations, or security concerns
5. Use clear, educational language assuming the user has technical background`,
    userPromptPrefix: "Please explain this code: ",
    temperature: 0.3
  },
  
  architecture_explanation: {
    systemPrompt: `${ARCHITECTURE_SYSTEM_PROMPT}
When explaining an architecture:
1. Provide a high-level overview of the system and its purpose
2. Describe each component and its role in the architecture
3. Explain the data flow and interactions between components
4. Highlight key design decisions and their rationales
5. Discuss scalability, security, and resilience aspects`,
    userPromptPrefix: "Please explain this architecture: ",
    temperature: 0.3
  },
  
  system_design: {
    systemPrompt: `${ARCHITECTURE_SYSTEM_PROMPT}
When designing a system from requirements:
1. First analyze the functional and non-functional requirements
2. Propose a high-level architecture with appropriate services
3. Justify your choice of components and their relationships
4. Consider scalability, security, reliability, and cost
5. Suggest implementation approaches and potential challenges`,
    userPromptPrefix: "Please design a system for these requirements: ",
    temperature: 0.4
  },
  
  comparison: {
    systemPrompt: `${BASE_SYSTEM_PROMPT}
When making comparisons:
1. Identify the key dimensions for comparison
2. Objectively evaluate each option against these dimensions
3. Highlight the strengths and weaknesses of each option
4. Consider contextual factors that might affect the decision
5. Provide a balanced assessment without unwarranted bias`,
    userPromptPrefix: "Compare the following: ",
    temperature: 0.3
  },
  
  question: {
    systemPrompt: BASE_SYSTEM_PROMPT,
    temperature: 0.4
  },
  
  greeting: {
    systemPrompt: `${BASE_SYSTEM_PROMPT}
When greeting users:
1. Be friendly, concise, and professional
2. Briefly mention your capabilities relevant to cloud architecture
3. Ask how you can assist them with their cloud architecture needs`,
    temperature: 0.7
  },
  
  general_chat: {
    systemPrompt: BASE_SYSTEM_PROMPT,
    temperature: 0.5
  }
};

/**
 * Get the appropriate prompt template for a given intent
 */
export function getPromptTemplateForIntent(intent: Intent): PromptTemplate {
  return promptTemplates[intent] || promptTemplates.general_chat;
}

/**
 * Build a complete system prompt with context
 */
export function buildSystemPrompt(
  intent: Intent, 
  contextString: string
): string {
  const template = getPromptTemplateForIntent(intent);
  
  // Add context to the system prompt if available
  if (contextString) {
    return `${template.systemPrompt}
    
CONTEXT:
${contextString}`;
  }
  
  return template.systemPrompt;
}

/**
 * Format user message with appropriate prefixes and suffixes
 */
export function formatUserMessage(
  intent: Intent,
  userMessage: string
): string {
  const template = getPromptTemplateForIntent(intent);
  
  let formattedMessage = userMessage;
  
  if (template.userPromptPrefix) {
    formattedMessage = template.userPromptPrefix + formattedMessage;
  }
  
  if (template.userPromptSuffix) {
    formattedMessage = formattedMessage + template.userPromptSuffix;
  }
  
  return formattedMessage;
}

/**
 * Get model configuration for the given intent
 */
export function getModelConfigForIntent(intent: Intent): {
  temperature: number;
  model?: string;
} {
  const template = getPromptTemplateForIntent(intent);
  
  return {
    temperature: template.temperature || 0.4,
    model: template.model
  };
} 