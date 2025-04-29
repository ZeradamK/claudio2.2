/**
 * Advanced intent detection system for Jarvis
 * Detects user intents through multiple pattern matching techniques
 */

/**
 * List of possible intents that can be detected from user messages
 */
export type Intent = 
  | 'architecture_update'
  | 'cdk_generation'
  | 'code_generation'
  | 'code_explanation'
  | 'architecture_explanation'
  | 'architecture_rationale'
  | 'system_design'
  | 'comparison'
  | 'question'
  | 'greeting'
  | 'general_chat';

/**
 * Interface for intent detection rules
 */
interface IntentRule {
  intent: Intent;
  patterns: RegExp[];
  keywordSets?: string[][];  // Each inner array is an AND condition, outer array is OR
  requiresContext?: boolean;
  // Higher weight means this intent should be prioritized over others when multiple matches
  weight: number;  
}

/**
 * Rules for detecting intents based on user input patterns
 */
const intentRules: IntentRule[] = [
  {
    intent: 'greeting',
    patterns: [
      /^(hi|hello|hey|greetings|howdy|good (morning|afternoon|evening)|what'?s up)/i,
    ],
    weight: 10
  },
  {
    intent: 'architecture_update',
    patterns: [
      /update (the|this|my|our) (architecture|diagram|system)/i,
      /add .+ to (the|this|my|our) (architecture|diagram|system)/i,
      /modify (the|this|my|our) (architecture|diagram|system)/i,
      /change (the|this|my|our) (architecture|diagram|system)/i,
      /redesign (the|this|my|our) (architecture|diagram|system)/i
    ],
    keywordSets: [
      ['add', 'architecture'],
      ['update', 'architecture'],
      ['modify', 'architecture'],
      ['change', 'architecture'],
      ['redesign', 'architecture']
    ],
    requiresContext: true,
    weight: 90
  },
  {
    intent: 'architecture_rationale',
    patterns: [
      /provide.*(rationale|explanation|analysis|assessment|evaluation|review|breakdown|cost analysis|costing).*(for|of|about).*(this|the|current|existing).*(architecture|design|system|diagram)/i,
      /generate.*(rationale|explanation|analysis|assessment|evaluation|review|breakdown|cost analysis|costing).*(for|of|about).*(this|the|current|existing).*(architecture|design|system|diagram)/i,
      /explain.*(rationale|reasoning|thinking|logic|decision|costs?|pricing).*(behind|for|of).*(this|the|current|existing).*(architecture|design|system|diagram)/i,
      /(analyze|assess|evaluate|review).*(this|the|current|existing).*(architecture|design|system|diagram)/i,
      /what('s| is| are).*(the).*(costs?|pricing|expenses?|budget).*(of|for).*(this|the|current|existing).*(architecture|design|system|diagram)/i,
      /how much.*(would|does|will).*(this|the|current|existing).*(architecture|design|system|diagram).*(cost)/i,
      /break down.*(this|the|current).*(architecture|design|system|diagram)/i
    ],
    keywordSets: [
      ['rationale', 'architecture'],
      ['explain', 'architecture'],
      ['analyze', 'architecture'],
      ['cost', 'architecture'],
      ['costs', 'architecture'],
      ['pricing', 'architecture'],
      ['evaluation', 'architecture'],
      ['breakdown', 'architecture'],
      ['analysis', 'architecture'],
      ['assessment', 'architecture']
    ],
    requiresContext: true,
    weight: 85
  },
  {
    intent: 'cdk_generation',
    patterns: [
      /generate.*(cdk|cloud development kit).*(code|implementation)/i,
      /create.*(cdk|cloud development kit).*(code|implementation)/i,
      /write.*(cdk|cloud development kit).*(code|implementation)/i,
      /implement.*(architecture|diagram|design).*(using|with|in).*(cdk|cloud development kit)/i,
      /convert.*(architecture|diagram|design).*(to|into).*(cdk|cloud development kit)/i
    ],
    keywordSets: [
      ['generate', 'cdk'],
      ['create', 'cdk'],
      ['write', 'cdk'],
      ['implement', 'cdk'],
      ['convert', 'cdk']
    ],
    requiresContext: true,
    weight: 100
  },
  {
    intent: 'code_generation',
    patterns: [
      /generate.*(code|function|class|module)/i,
      /write.*(code|function|class|module)/i,
      /create.*(code|function|class|module)/i,
      /implement.*(in|using).*(javascript|typescript|python|java|c#|go)/i,
      /code.*(for|that).*(does|performs|handles|implements)/i
    ],
    keywordSets: [
      ['generate', 'code'],
      ['write', 'code'],
      ['create', 'code'],
      ['implement', 'function'],
      ['code', 'for']
    ],
    weight: 80
  },
  {
    intent: 'code_explanation',
    patterns: [
      /explain.*(this|the).*(code|function|class|module)/i,
      /how.*(does|do).*(this|the).*(code|function|class|module).*(work|function)/i,
      /what.*(does|do).*(this|the).*(code|function|class|module).*(do|mean)/i,
      /understand.*(this|the).*(code|function|class|module)/i,
      /analyze.*(this|the).*(code|function|class|module)/i
    ],
    keywordSets: [
      ['explain', 'code'],
      ['how', 'code', 'work'],
      ['what', 'code', 'do'],
      ['understand', 'code'],
      ['analyze', 'code']
    ],
    weight: 70
  },
  {
    intent: 'architecture_explanation',
    patterns: [
      /explain.*(this|the).*(architecture|diagram|system|design)/i,
      /how.*(does|do).*(this|the).*(architecture|diagram|system|design).*(work|function)/i,
      /what.*(does|do).*(this|the).*(architecture|diagram|system|design).*(do|mean)/i,
      /understand.*(this|the).*(architecture|diagram|system|design)/i,
      /analyze.*(this|the).*(architecture|diagram|system|design)/i
    ],
    keywordSets: [
      ['explain', 'architecture'],
      ['how', 'architecture', 'work'],
      ['what', 'architecture', 'do'],
      ['understand', 'architecture'],
      ['analyze', 'architecture']
    ],
    requiresContext: true,
    weight: 75
  },
  {
    intent: 'system_design',
    patterns: [
      /design.*(a|an).*(architecture|system|solution)/i,
      /create.*(a|an).*(architecture|system|solution).*(for|that)/i,
      /architect.*(a|an).*(system|solution).*(for|that)/i,
      /how.*(would|should|could).*(you|we|I).*(architect|design|build|create).*(a|an).*(system|solution)/i,
      /what.*(architecture|system|solution).*(would|should|could).*(you|we|I).*(use|implement|create).*(for|to)/i
    ],
    keywordSets: [
      ['design', 'architecture'],
      ['create', 'system'],
      ['architect', 'solution'],
      ['how', 'design', 'system'],
      ['what', 'architecture', 'use']
    ],
    weight: 85
  },
  {
    intent: 'comparison',
    patterns: [
      /compare.*(between|with|and)/i,
      /difference.*(between|with|and)/i,
      /similarities.*(between|with|and)/i,
      /pros.*(and).*(cons|benefits|advantages|disadvantages)/i,
      /better.*(option|choice|alternative|approach)/i,
      /which.*(is|are).*(better|best|optimal|preferred)/i
    ],
    keywordSets: [
      ['compare'],
      ['difference', 'between'],
      ['similarities'],
      ['pros', 'cons'],
      ['better', 'option'],
      ['which', 'better']
    ],
    weight: 60
  },
  {
    intent: 'question',
    patterns: [
      /^(what|how|why|when|where|who|which|can|could|would|should|is|are|do|does|did|has|have|had)/i,
      /\?(.*)?$/
    ],
    weight: 20
  },
  // This is the fallback intent and should have the lowest weight
  {
    intent: 'general_chat',
    patterns: [/.+/],  // Matches any non-empty string
    weight: 1
  }
];

/**
 * Infer the intent from a user message
 * @param message User's message text
 * @param hasArchitectureContext Whether the current conversation has architecture context
 * @returns The detected intent
 */
export function inferIntent(
  message: string, 
  hasArchitectureContext: boolean = false
): Intent {
  // Initialize empty array for matches
  const matches: {intent: Intent, weight: number}[] = [];
  
  // Check message against each intent rule
  for (const rule of intentRules) {
    // Skip rules that require context if we don't have it
    if (rule.requiresContext && !hasArchitectureContext) {
      continue;
    }
    
    // Check patterns (any pattern match counts)
    const patternMatched = rule.patterns.some(pattern => pattern.test(message));
    
    // Check keyword sets (if defined)
    let keywordMatched = true;
    if (rule.keywordSets) {
      // Check if ANY of the keyword sets match (outer OR)
      keywordMatched = rule.keywordSets.some(keywordSet => {
        // Check if ALL keywords in this set are present (inner AND)
        return keywordSet.every(keyword => 
          message.toLowerCase().includes(keyword.toLowerCase())
        );
      });
    }
    
    // If both pattern and keywords (if defined) match, add to matches
    if (patternMatched && keywordMatched) {
      matches.push({
        intent: rule.intent,
        weight: rule.weight
      });
    }
  }
  
  // Sort matches by weight in descending order and take the highest
  matches.sort((a, b) => b.weight - a.weight);
  
  // Return the highest weighted intent, or general_chat as fallback
  return matches.length > 0 ? matches[0].intent : 'general_chat';
}

/**
 * Helper function to determine if a message might be a greeting
 * @param message User's message text
 * @returns True if the message appears to be a greeting
 */
export function isGreeting(message: string): boolean {
  return inferIntent(message) === 'greeting';
}

// CDK generation patterns to help with language detection
const cdkGenerationPatterns = [
  /cdk|cloud development kit/i,
  /infrastructure as code/i,
  /iac/i,
  /cloudformation/i
];

/**
 * Language detection for code generation
 */
export function detectProgrammingLanguage(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  if (/python|boto3|django|flask|pandas|numpy|pip|\.py/i.test(lowerMessage)) return 'python';
  if (/typescript|ts|angular|vue|react|\.ts/i.test(lowerMessage)) return 'typescript';
  if (/javascript|js|node|express|\.js/i.test(lowerMessage)) return 'javascript';
  if (/java|spring|maven|gradle|\.java/i.test(lowerMessage)) return 'java';
  if (/c#|\.net|asp\.net|azure|\.cs/i.test(lowerMessage)) return 'csharp';
  if (/golang|go\s+lang|\.go/i.test(lowerMessage)) return 'go';
  if (/rust|cargo|\.rs/i.test(lowerMessage)) return 'rust';
  if (/ruby|rails|\.rb/i.test(lowerMessage)) return 'ruby';
  if (/php|laravel|symfony|\.php/i.test(lowerMessage)) return 'php';
  if (/yaml|yml/i.test(lowerMessage)) return 'yaml';
  if (/bash|shell|sh|command line|terminal/i.test(lowerMessage)) return 'bash';
  
  // Check for explicit language mentions
  if (/\b(?:in|using|with)\s+python\b/i.test(lowerMessage)) return 'python';
  if (/\b(?:in|using|with)\s+typescript\b/i.test(lowerMessage)) return 'typescript';
  if (/\b(?:in|using|with)\s+javascript\b/i.test(lowerMessage)) return 'javascript';
  if (/\b(?:in|using|with)\s+java\b/i.test(lowerMessage)) return 'java';
  if (/\b(?:in|using|with)\s+c#\b/i.test(lowerMessage)) return 'csharp';
  if (/\b(?:in|using|with)\s+go\b/i.test(lowerMessage)) return 'go';
  if (/\b(?:in|using|with)\s+rust\b/i.test(lowerMessage)) return 'rust';
  if (/\b(?:in|using|with)\s+ruby\b/i.test(lowerMessage)) return 'ruby';
  if (/\b(?:in|using|with)\s+php\b/i.test(lowerMessage)) return 'php';
  
  // Default for CDK is TypeScript
  if (cdkGenerationPatterns.some(pattern => pattern.test(lowerMessage))) return 'typescript';
  
  return null;
} 