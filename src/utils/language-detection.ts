/**
 * Language Detection Utility
 * 
 * Provides utilities for detecting programming languages and technical contexts
 * from user messages. This helps Jarvis tailor responses appropriately.
 */

// CDK generation patterns to help with language detection
const cdkGenerationPatterns = [
  /cdk|cloud development kit/i,
  /infrastructure as code/i,
  /iac/i,
  /cloudformation/i,
  /terraform/i
];

/**
 * Language detection for code generation
 * Attempts to identify the programming language from user message content
 */
export function detectLanguage(message: string): string | null {
  if (!message) return null;
  
  const lowerMessage = message.toLowerCase();
  
  // AWS CDK defaults to TypeScript
  if (cdkGenerationPatterns.some(pattern => pattern.test(lowerMessage))) {
    // If explicitly mentioned another language with CDK
    if (/python cdk|cdk.* python|in python/i.test(lowerMessage)) return 'python';
    if (/java cdk|cdk.* java|in java/i.test(lowerMessage)) return 'java';
    if (/csharp cdk|cdk.* csharp|c# cdk|in c#|\.net/i.test(lowerMessage)) return 'csharp';
    if (/go cdk|cdk.* go|golang|in go/i.test(lowerMessage)) return 'go';
    
    // Default for CDK is TypeScript
    return 'typescript';
  }
  
  // General language detection
  if (/python|boto3|django|flask|pandas|numpy|pip|\.py\b/i.test(lowerMessage)) return 'python';
  if (/typescript|ts|angular|vue|react|\.ts\b/i.test(lowerMessage)) return 'typescript';
  if (/javascript|js|node|express|\.js\b/i.test(lowerMessage)) return 'javascript';
  if (/java\b|spring|maven|gradle|\.java\b/i.test(lowerMessage)) return 'java';
  if (/\bc#\b|\.net|asp\.net|azure|\.cs\b/i.test(lowerMessage)) return 'csharp';
  if (/\bgo\b|golang|\.go\b/i.test(lowerMessage)) return 'go';
  if (/rust|cargo|\.rs\b/i.test(lowerMessage)) return 'rust';
  if (/ruby|rails|\.rb\b/i.test(lowerMessage)) return 'ruby';
  if (/php|laravel|symfony|\.php\b/i.test(lowerMessage)) return 'php';
  if (/yaml|yml/i.test(lowerMessage)) return 'yaml';
  if (/bash|shell|sh|command line|terminal/i.test(lowerMessage)) return 'bash';
  if (/sql|mysql|postgresql|database query/i.test(lowerMessage)) return 'sql';
  if (/html|css|web|frontend/i.test(lowerMessage) && !/code|function|class|program/i.test(lowerMessage)) return 'html';
  
  // Check for explicit language mentions with various prepositions
  const explicitPattern = /\b(?:in|using|with|for)\s+([a-zA-Z#]+(?:\s*[a-zA-Z]+)?)\b/i;
  const explicitMatch = lowerMessage.match(explicitPattern);
  
  if (explicitMatch) {
    const lang = explicitMatch[1].trim().toLowerCase();
    
    if (lang === 'python') return 'python';
    if (lang === 'typescript' || lang === 'ts') return 'typescript';
    if (lang === 'javascript' || lang === 'js') return 'javascript';
    if (lang === 'java') return 'java';
    if (lang === 'c#' || lang === 'csharp' || lang === 'c sharp') return 'csharp';
    if (lang === 'go' || lang === 'golang') return 'go';
    if (lang === 'rust') return 'rust';
    if (lang === 'ruby') return 'ruby';
    if (lang === 'php') return 'php';
  }
  
  // Look for code snippets to detect language
  if (message.includes('```')) {
    const codeBlockMatch = message.match(/```([a-zA-Z]+)\s/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      const blockLang = codeBlockMatch[1].toLowerCase();
      
      if (['python', 'typescript', 'javascript', 'java', 'csharp', 'go', 'rust', 'ruby', 'php'].includes(blockLang)) {
        return blockLang;
      }
      
      if (blockLang === 'ts') return 'typescript';
      if (blockLang === 'js') return 'javascript';
      if (blockLang === 'cs' || blockLang === 'c#') return 'csharp';
    }
  }
  
  // Infer language from common syntax patterns
  if (/def\s+\w+\s*\(|if\s+\w+\s*:|\s{4}|\bself\b/i.test(message)) return 'python';
  if (/function\s+\w+\s*\(|\bconst\b|\blet\b|=>|interface\s+\w+|type\s+\w+/i.test(message)) {
    // Differentiate between TS and JS
    if (/:\s*(\w+|\{|\[|any|string|number|boolean)/i.test(message)) return 'typescript';
    return 'javascript';
  }
  if (/public\s+(static\s+)?(void|class|int|String)/i.test(message)) return 'java';
  
  return null;
}

/**
 * Detect if the message is about code generation
 */
export function isCodeGenerationRequest(message: string): boolean {
  if (!message) return false;
  
  const lowerMessage = message.toLowerCase();
  
  // Keywords and patterns that strongly suggest code generation
  const codeGenPatterns = [
    /generate\s+code/i,
    /write\s+(a|some|the)?\s*code/i,
    /implement\s+(a|an|the)?\s*function/i,
    /create\s+(a|an|the)?\s*(function|class|module|script)/i,
    /how\s+(would|do)\s+(i|you)\s+(code|program|implement)/i,
    /code\s+to\s+(perform|do|handle|process)/i,
    /script\s+that\s+(will|can|would)/i
  ];
  
  return codeGenPatterns.some(pattern => pattern.test(lowerMessage));
}

/**
 * Detect if message is CDK-related
 */
export function isCdkRequest(message: string): boolean {
  if (!message) return false;
  
  return cdkGenerationPatterns.some(pattern => pattern.test(message.toLowerCase()));
}

/**
 * More precise language detection for code blocks
 */
export function detectCodeBlockLanguage(codeBlock: string): string {
  // Default to TypeScript if we can't determine
  if (!codeBlock) return 'typescript';
  
  // Python patterns
  if (/def\s+\w+\s*\(|\s{4}|from\s+\w+\s+import|import\s+\w+\s+as|#.*\n|if\s+\w+\s*:/.test(codeBlock)) {
    return 'python';
  }
  
  // TypeScript patterns
  if (/interface\s+\w+|type\s+\w+|:\s*(\w+|\{|\[|any|string|number|boolean)|<[^>]+>/.test(codeBlock)) {
    return 'typescript';
  }
  
  // JavaScript patterns
  if (/const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|function\s+\w+\s*\(|new\s+\w+\s*\(/.test(codeBlock)) {
    return 'javascript';
  }
  
  // Java patterns
  if (/public\s+(static\s+)?(void|class|int|String)|@Override|System\.out\.println/.test(codeBlock)) {
    return 'java';
  }
  
  // C# patterns
  if (/namespace\s+\w+|using\s+\w+;|public\s+class\s+\w+|Console\.WriteLine/.test(codeBlock)) {
    return 'csharp';
  }
  
  // Go patterns
  if (/func\s+\w+\s*\(|package\s+\w+|import\s+\(|fmt\.Println/.test(codeBlock)) {
    return 'go';
  }
  
  // Default to TypeScript for AWS code
  if (/AWS\.|aws-|cdk\.|new\s+\w+Stack/.test(codeBlock)) {
    return 'typescript';
  }
  
  return 'typescript';
} 