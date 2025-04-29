/**
 * Follow-up Generator for Jarvis AI
 * 
 * Generates contextually relevant follow-up questions and suggestions
 * based on the current intent and architecture state.
 */

import { EnhancedIntentMatch } from '../jarvis-integration';
import { ArchitectureContext } from '../context/contextManager';
import { Intent } from '../intent/inferIntent';

/**
 * Generates follow-up suggestions based on the current intent and architecture
 */
export function generateFollowupSuggestions(
  intent: EnhancedIntentMatch,
  architecture: ArchitectureContext
): string[] {
  const suggestions: string[] = [];
  
  // Suggest follow-ups based on current intent
  switch (intent.intentType) {
    case 'architecture_update':
      suggestions.push(...[
        'Generate CDK code for this architecture',
        'What are the security considerations for this design?',
        'Explain the data flow in this architecture',
        'What is the estimated cost for this architecture?',
        'How does this architecture handle scaling during peak loads?'
      ]);
      break;
    
    case 'architecture_rationale':
      suggestions.push(...[
        'How can we optimize the costs of this architecture?',
        'What would be the disaster recovery strategy for this design?',
        'Generate CDK code for this architecture',
        'How would this architecture scale to handle 10x the load?',
        'What are the security best practices we should implement?'
      ]);
      break;
    
    case 'cdk_generation':
      suggestions.push(...[
        'How would I deploy this CDK code?',
        'What AWS permissions are needed to deploy this?',
        'Explain how the CDK constructs work together',
        'How can I add monitoring to this infrastructure?',
        'What is the estimated cost of running this infrastructure?'
      ]);
      break;
    
    case 'code_generation':
      suggestions.push(...[
        'Explain how this code works',
        'What error handling should I add?',
        'How would I test this code?',
        'How can I make this code more efficient?',
        'How do I integrate this with the rest of my application?'
      ]);
      break;
    
    case 'architecture_explanation':
      suggestions.push(...[
        'What are the security considerations for this architecture?',
        'How much would this architecture cost to run?',
        'How would this architecture scale with increased load?',
        'Generate CDK code for this architecture',
        'What are alternative approaches to this architecture?'
      ]);
      break;
      
    case 'code_explanation':
      suggestions.push(...[
        'How can I optimize this code?',
        'What are potential security vulnerabilities in this code?',
        'How would I test this code?',
        'What are best practices for this type of implementation?',
        'Generate similar code for a different use case'
      ]);
      break;
    
    case 'question':
    case 'comparison':
      suggestions.push(...[
        'Generate code example for this concept',
        'What are the best practices for this?',
        'What are common mistakes to avoid?',
        'How does this compare to alternative approaches?',
        'How would you implement this in a production environment?'
      ]);
      break;
    
    default:
      suggestions.push(...[
        'Update the architecture diagram',
        'Generate CDK code for AWS deployment',
        'Explain the benefits of this architecture',
        'What AWS services would you recommend for my use case?',
        'How can I optimize costs in my AWS architecture?'
      ]);
  }
  
  // Architecture-specific suggestions
  if (architecture?.nodes?.length > 0) {
    // Suggest based on current architecture components
    const serviceTypes = architecture.nodes.map(node => node.data.service);
    
    // Identify missing common components
    if (!serviceTypes.some(s => s?.includes('Lambda'))) {
      suggestions.push('How can I add a Lambda function to process data in this architecture?');
    }
    
    if (!serviceTypes.some(s => s?.includes('DynamoDB') || s?.includes('RDS'))) {
      suggestions.push('What database would you recommend for this architecture?');
    }
    
    if (!serviceTypes.some(s => s?.includes('CloudFront') || s?.includes('API Gateway'))) {
      suggestions.push('How can I add an API layer to this architecture?');
    }
    
    if (!serviceTypes.some(s => s?.includes('SQS') || s?.includes('SNS') || s?.includes('EventBridge'))) {
      suggestions.push('How can I make this architecture event-driven?');
    }
    
    // Check security components
    if (!serviceTypes.some(s => s?.includes('WAF') || s?.includes('Shield'))) {
      suggestions.push('What security measures should I add to protect this architecture?');
    }
    
    // Check monitoring
    if (!serviceTypes.some(s => s?.includes('CloudWatch') || s?.includes('X-Ray'))) {
      suggestions.push('How should I monitor this architecture?');
    }
  }
  
  // Shuffle and return 3-4 most relevant suggestions
  return shuffleArray(suggestions).slice(0, 3);
}

/**
 * Helper function to shuffle array
 */
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

/**
 * Generate follow-up suggestions specifically for architecture updates
 */
export function generateArchitectureUpdateSuggestions(
  architecture: ArchitectureContext,
  recentChanges?: string[]
): string[] {
  const suggestions: string[] = [
    'Add authentication with Cognito',
    'Make this architecture more cost-efficient',
    'Improve the security of this architecture',
    'Make this architecture more scalable',
    'Add monitoring and alerting to this architecture',
    'Optimize database performance in this design',
    'Add a CDN to improve performance',
    'Implement a disaster recovery strategy',
    'Add a caching layer to improve performance',
    'Implement a serverless version of this architecture'
  ];
  
  return shuffleArray(suggestions).slice(0, 3);
}

/**
 * Generate follow-up suggestions specifically for CDK code
 */
export function generateCdkFollowupSuggestions(
  architecture: ArchitectureContext
): string[] {
  const suggestions: string[] = [
    'How do I deploy this CDK code?',
    'Add monitoring and alerting to this CDK code',
    'How can I make this CDK code more modular?',
    'Add proper IAM permissions to this CDK code',
    'How do I add CI/CD for this CDK deployment?',
    'Implement cost optimizations in this CDK code',
    'Add proper logging to this infrastructure',
    'How should I manage secrets in this CDK code?',
    'Implement proper tagging for all resources',
    'Add environment-specific configurations'
  ];
  
  return shuffleArray(suggestions).slice(0, 3);
} 