"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, RotateCcw, Lightbulb, Copy, Check, Code, Terminal, Loader2, Send } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { v4 as uuidv4 } from 'uuid';
import remarkGfm from 'remark-gfm';

// Add this debounce function if you don't want to install lodash
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface JarvisChatProps {
  architectureId: string;
  onArchitectureUpdate: () => void;
}

// Add React.memo to optimize rendering performance of code blocks
const MemoizedSyntaxHighlighter = React.memo(SyntaxHighlighter);

// Memoize the ReactMarkdown component for better performance
const MemoizedReactMarkdown = React.memo(ReactMarkdown);

export default function JarvisChat({ architectureId, onArchitectureUpdate }: JarvisChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [displayValue, setDisplayValue] = useState(''); // New state for immediate visual feedback
  const [isLoading, setIsLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [isAutoscrollEnabled, setIsAutoscrollEnabled] = useState(true);
  const [animatingMessageId, setAnimatingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null); // Ref for AbortController
  const fullContentRef = useRef<string>(''); // Store the complete content received
  const typingSpeedRef = useRef<number>(15); // Characters per frame for typing effect

  // First, let's update the welcome message to better highlight the architecture modification capabilities
  const welcomeMessage: Message = {
    id: 'welcome',
    role: 'assistant',
    content: `# Hi, I'm Jarvis, your Architecture Assistant 👋

I can help you design and modify your AWS cloud architecture using natural language commands. Just describe the changes you want, and I'll update the diagram for you. What changes would you like to make to your architecture today?`,
    timestamp: new Date()
  };

  // Update the example prompts to include more architecture modification examples
  const examplePrompts = [
    "Add a Multi-AZ Aurora RDS cluster connected to my application tier",
    "Convert my architecture to use API Gateway, Lambda, and DynamoDB",
    "Add a caching layer with ElastiCache Redis in front of the database",
    "Replace the EC2 web servers with a serverless architecture",
    "Add a CloudFront CDN with an S3 origin for static assets", 
    "Implement a disaster recovery region with cross-region replication",
    "Add auto-scaling for EC2 instances based on CPU utilization",
    "Implement a private VPC with proper public and private subnets",
    "Update the architecture to include ECS for containerized services",
    "Add AWS WAF and Shield for improved security"
  ];

  // Load messages from localStorage on component mount
  useEffect(() => {
    const loadedMessages = loadMessages();
    if (loadedMessages.length === 0) {
      // If no messages, add the welcome message
      setMessages([welcomeMessage]);
    } else {
      setMessages(loadedMessages);
      // Only show examples if there are no messages
      setShowExamples(loadedMessages.length <= 1);
    }
  }, []);
  
  // Track scroll position to determine if we should auto-scroll
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
    
    // Only auto-scroll if the user is already at the bottom
    setIsAutoscrollEnabled(isAtBottom);
  }, []);

  // Add scroll event listener
  useEffect(() => {
    const messagesContainer = messagesContainerRef.current;
    if (messagesContainer) {
      messagesContainer.addEventListener('scroll', handleScroll);
      return () => messagesContainer.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);
  
  // Improved scroll to bottom that respects the user's scroll position
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current && isAutoscrollEnabled) {
      // Use requestAnimationFrame to optimize scrolling
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [isAutoscrollEnabled]);
  
  // Typing animation effect
  useEffect(() => {
    if (!animatingMessageId) return;
    
    // Find the message being animated
    const messageIndex = messages.findIndex(msg => msg.id === animatingMessageId);
    if (messageIndex === -1) return;
    
    const fullContent = fullContentRef.current;
    const currentContent = messages[messageIndex].content;
    
    // If we've displayed all content, stop animating
    if (currentContent === fullContent) {
      setAnimatingMessageId(null);
      return;
    }
    
    // Calculate characters to add in this frame
    const nextChunkSize = Math.min(typingSpeedRef.current, fullContent.length - currentContent.length);
    if (nextChunkSize <= 0) return;
    
    // Display the next chunk of characters
    const nextContent = fullContent.substring(0, currentContent.length + nextChunkSize);
    
    // Update the message with the new content
    const animationTimeout = setTimeout(() => {
      setMessages(prevMessages => {
        const updatedMessages = [...prevMessages];
        updatedMessages[messageIndex] = {
          ...updatedMessages[messageIndex],
          content: nextContent
        };
        return updatedMessages;
      });
    }, 8); // Smooth typing speed
    
    return () => clearTimeout(animationTimeout);
  }, [animatingMessageId, messages]);
  
  // Optimize scrolling to prevent performance issues
  useEffect(() => {
    if (!animatingMessageId) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, animatingMessageId]);

  // Reset copied snippet after 2 seconds
  useEffect(() => {
    if (copiedSnippet) {
      const timer = setTimeout(() => {
        setCopiedSnippet(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedSnippet]);

  // Load messages from localStorage
  const loadMessages = () => {
    try {
      const savedMessages = localStorage.getItem(`jarvis-chat-${architectureId}`);
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        // Convert string timestamps back to Date objects
        return parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.error('Error loading messages from localStorage:', error);
    }
    return [];
  };

  // Save messages to localStorage
  const saveMessages = (messagesToSave: Message[]) => {
    try {
      localStorage.setItem(`jarvis-chat-${architectureId}`, JSON.stringify(messagesToSave));
    } catch (error) {
      console.error('Error saving messages to localStorage:', error);
    }
  };

  // Select random examples
  const getRandomExamples = (count: number) => {
    const shuffled = [...examplePrompts].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Randomized examples that change on each render
  const randomExamples = useMemo(() => getRandomExamples(3), []);

  // Enhanced version of handleExampleClick to immediately set display value too
  const handleExampleClick = (example: string) => {
    setDisplayValue(example);
    setInputValue(example);
    setShowExamples(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Copy code to clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(code);
  };

  // Debounced input handler to prevent typing lag
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetInput = useCallback(
    debounce((value: string) => {
      setInputValue(value);
    }, 150), // 150ms debounce time - adjust as needed
    []
  );

  // Handle immediate visual update + debounced state update
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setDisplayValue(value); // Update display immediately for responsive feel
    debouncedSetInput(value); // Debounce the actual state update
  };

  // Send message to Jarvis
  const handleSendMessage = async () => {
    const valueToSend = displayValue.trim();
    if (!valueToSend || isLoading) return;

    setIsLoading(true);
    abortControllerRef.current = new AbortController(); // Create new controller
    const signal = abortControllerRef.current.signal;

    // Enable auto-scrolling for new messages
    setIsAutoscrollEnabled(true);

    // Add user message to chat
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: valueToSend,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    saveMessages(updatedMessages);
    
    // Clear input and show loading
    setInputValue('');
    setDisplayValue('');
    
    // Temporary loading message (will be replaced)
    const loadingId = uuidv4();
    const loadingMessage: Message = {
      id: loadingId,
      role: 'assistant',
      content: '', // Empty content indicates loading
      timestamp: new Date()
    };
    
    setMessages([...updatedMessages, loadingMessage]);
    
    try {
      // Use the jarvis-chat endpoint with streaming response
      const response = await fetch('/api/jarvis-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          architectureId,
          messageHistory: updatedMessages.slice(-10) // Send last 10 messages for context
        }),
        signal: signal, // Pass the signal to fetch
      });

      // Clear controller ref after fetch completes or fails normally
      abortControllerRef.current = null;

      // Handle non-OK responses first
      if (!response.ok) {
        // Check if aborted
        if (signal.aborted) {
          console.log("Jarvis fetch aborted by user.");
          // Remove the temporary loading message if aborted
          setMessages(updatedMessages);
          saveMessages(updatedMessages);
          return; // Exit early
        }
        // Handle other errors
        throw new Error(`Server responded with ${response.status}`);
      }

      // Check if architecture was updated from response headers
      const intentType = response.headers.get('X-Intent-Type');
      const architectureUpdated = response.headers.get('X-Architecture-Updated') === 'true' || 
                                 intentType === 'architecture_update';
      
      // Create the assistant message first with empty content
      const assistantMessage: Message = {
        id: loadingId, // Use the same ID to replace the loading message
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      
      // Update the messages array with the empty assistant message
      setMessages(prevMessages => {
        const updatedMsgs = [...prevMessages];
        const loadingIndex = updatedMsgs.findIndex(msg => msg.id === loadingId);
        if (loadingIndex !== -1) {
          updatedMsgs[loadingIndex] = assistantMessage;
        }
        return updatedMsgs;
      });
      
      // Set up for animation
      fullContentRef.current = ''; // Reset the full content
      setAnimatingMessageId(loadingId); // Start animating this message
      
      // Process the streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response has no body');
      
      const decoder = new TextDecoder();
      
      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decode the chunk and append to the full content reference
        const chunk = decoder.decode(value, { stream: true });
        fullContentRef.current += chunk;
      }
      
      // Complete any remaining animation
      setMessages(prevMessages => {
        const finalMessages = [...prevMessages];
        const assistantIndex = finalMessages.findIndex(msg => msg.id === loadingId);
        if (assistantIndex !== -1) {
          finalMessages[assistantIndex] = {
            ...finalMessages[assistantIndex],
            content: fullContentRef.current
          };
        }
        saveMessages(finalMessages);
        return finalMessages;
      });
      
      // Clear the animating message ID to stop animation
      setAnimatingMessageId(null);
      
      // Enhanced architecture update detection
      const updateIndicators = [
        'Architecture Updated Successfully',
        '**Architecture Updated Successfully**',
        '*Architecture Updated Successfully*',
        'The architecture has been updated',
        'I\'ve updated the architecture',
        'I\'ve modified the architecture',
        'The diagram has been updated',
        'Changes have been applied to your architecture',
        'The architecture diagram now includes',
        'I\'ve added the requested components'
      ];
      
      // Check for update indicators in the response
      const wasArchitectureUpdated = architectureUpdated || 
                                  updateIndicators.some(indicator => 
                                    fullContentRef.current.includes(indicator));
      
      // If any condition indicates architecture was updated, refresh the diagram
      if (wasArchitectureUpdated) {
        console.log("Architecture updated, refreshing diagram...");
        
        // Add a visual indicator that the update is in progress
        setMessages(prevMessages => {
          const finalMessages = [...prevMessages];
          const assistantIndex = finalMessages.findIndex(msg => msg.id === loadingId);
          if (assistantIndex !== -1) {
            // Add a loading indicator at the end of the message
            finalMessages[assistantIndex] = {
              ...finalMessages[assistantIndex],
              content: finalMessages[assistantIndex].content + "\n\n*Refreshing diagram...*"
            };
          }
          return finalMessages;
        });
        
        // Wait a moment before refreshing to allow the UI to update
        setTimeout(() => {
          // Call the onArchitectureUpdate callback to refresh the diagram
          onArchitectureUpdate();
          
          // Replace the loading indicator with a success message if needed
          if (!updateIndicators.some(indicator => fullContentRef.current.includes(indicator))) {
            const confirmationAddendum = "\n\n**✅ Architecture diagram has been updated successfully!**";
            
            // Update the assistant message with the confirmation
            setMessages(prevMessages => {
              const finalMessages = [...prevMessages];
              const assistantIndex = finalMessages.findIndex(msg => msg.id === loadingId);
              if (assistantIndex !== -1) {
                // Replace the loading indicator with the success message
                const updatedContent = finalMessages[assistantIndex].content
                  .replace("\n\n*Refreshing diagram...*", confirmationAddendum);
                
                finalMessages[assistantIndex] = {
                  ...finalMessages[assistantIndex],
                  content: updatedContent
                };
              }
              saveMessages(finalMessages);
              return finalMessages;
            });
          }
        }, 800); // Short delay to show loading indicator
      }
    } catch (error: any) {
      // Clear the controller ref if an error occurs
      abortControllerRef.current = null;
      setAnimatingMessageId(null);

      // Check if it's an AbortError
      if (error.name === 'AbortError') {
        console.log('Jarvis fetch operation aborted.');
        // Remove the temporary loading message if aborted
        setMessages(updatedMessages);
        saveMessages(updatedMessages);
      } else {
        console.error('Error sending message to Jarvis:', error);
        
        // Replace loading message with error message
        const errorMessage: Message = {
          id: loadingId, // Use same ID
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date()
        };
        
        setMessages(prevMessages => {
          const finalMessages = [...prevMessages];
          const loadingIndex = finalMessages.findIndex(msg => msg.id === loadingId);
          if (loadingIndex !== -1) {
            finalMessages[loadingIndex] = errorMessage;
          }
          saveMessages(finalMessages); // Save the final state
          return finalMessages;
        });
      }
    } finally {
      // Reset loading state only if not aborted (abortion resets it already)
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };

  // Function to handle stopping the message sending
  const handleStopSending = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // Abort the fetch
      abortControllerRef.current = null; // Clear the ref
    }
    setIsLoading(false); // Reset loading state
    setAnimatingMessageId(null); // Stop any animation
    // The AbortError handler in handleSendMessage will clean up the message list
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Clear conversation history
  const clearConversation = () => {
    const clearedMessages = [welcomeMessage];
    setMessages(clearedMessages);
    saveMessages(clearedMessages);
    setShowExamples(true);
    setAnimatingMessageId(null);
  };

  // Toggle auto-scroll button handler
  const toggleAutoScroll = () => {
    setIsAutoscrollEnabled(prev => !prev);
    if (!isAutoscrollEnabled) {
      // If turning auto-scroll back on, scroll to bottom
      scrollToBottom();
    }
  };

  // Use a more comprehensive set of syntax highlighting styles
  const CodeBlock = useCallback(({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const code = String(children).replace(/\n$/, '');
    
    // Enhanced language detection with more comprehensive patterns
    const detectLanguage = (code: string): string => {
      // Python patterns
      if (code.includes('import boto3') || 
          code.includes('def ') || 
          code.includes('print(') || 
          code.includes('elif ') ||
          code.includes('import numpy') ||
          code.includes('import pandas') ||
          /from\s+[\w.]+\s+import/.test(code)) {
        return 'python';
      }
      
      // TypeScript/JavaScript patterns
      if (code.includes('const ') || 
          code.includes('let ') || 
          code.includes('import {') || 
          code.includes('function(') || 
          code.includes('=>') ||
          code.includes('export class') ||
          code.includes('interface ') ||
          code.includes('async ') ||
          /import\s+[*{}]?\s+from/.test(code)) {
        // Differentiate between TypeScript and JavaScript
        if (code.includes(': string') || 
            code.includes(': number') || 
            code.includes(': boolean') ||
            code.includes('interface ') ||
            code.includes('<T>') ||
            /:\s*[A-Z][a-zA-Z0-9]*(?:<[^>]+>)?/.test(code)) {
          return 'typescript';
        }
        return 'javascript';
      }
      
      // Bash/Shell script patterns
      if (code.includes('#!/bin/bash') || 
          code.includes('export PATH') || 
          code.includes('aws ') || 
          code.includes('npm ') || 
          code.includes('cd ') || 
          code.includes('mkdir ') ||
          code.includes('sudo ') ||
          /\$\([^)]+\)/.test(code) ||
          /if \[ .*? \];/.test(code)) {
        return 'bash';
      }
      
      // HTML patterns
      if (code.includes('<html') || 
          code.includes('</div>') || 
          code.includes('<body') ||
          /<[a-z]+(?:\s+[a-z]+="[^"]*")*\s*\/?>/.test(code)) {
        return 'html';
      }
      
      // SQL patterns
      if (code.includes('SELECT ') || 
          code.includes('FROM ') || 
          code.includes('WHERE ') ||
          code.includes('INSERT INTO') ||
          code.includes('UPDATE ') ||
          code.includes('GROUP BY') ||
          code.includes('ORDER BY')) {
        return 'sql';
      }
      
      // Java patterns
      if (code.includes('public class ') || 
          code.includes('private void') || 
          code.includes('System.out.println') ||
          code.includes('@Override')) {
        return 'java';
      }
      
      // C# patterns
      if (code.includes('using System;') || 
          code.includes('namespace ') || 
          code.includes('public class ') ||
          code.includes('.NET')) {
        return 'csharp';
      }
      
      // Go patterns
      if (code.includes('package main') || 
          code.includes('import (') || 
          code.includes('func ') ||
          code.includes('go ')) {
        return 'go';
      }
      
      // Add better detection for CDK code
      if (code.includes('new Stack(') || 
          code.includes('aws-cdk-lib') || 
          code.includes('cdk.Stack') ||
          code.includes('constructs')) {
        return 'typescript';
      }
      
      // Better detection for serverless.yml
      if (code.includes('serverless:') ||
          code.includes('provider:') ||
          code.includes('functions:')) {
        return 'yaml';
      }
      
      // Default to TypeScript for AWS-related code if we can't determine
      if (code.includes('AWS') || 
          code.includes('CloudFormation') || 
          code.includes('Lambda') ||
          code.includes('DynamoDB') ||
          code.includes('API Gateway') ||
          code.includes('S3')) {
        return 'typescript';
      }
      
      // Final fallback
      return 'typescript';
    };
    
    // Get language from class or try to detect it
    const language = match ? match[1] : detectLanguage(code);
    
    if (inline) {
      return (
        <code className="px-1 py-0.5 bg-gray-100 rounded text-[0.85em] font-mono text-blue-600" {...props}>
          {children}
        </code>
      );
    }
    
    // Enhanced code block with better IDE-like styling and specific syntax highlighting
    return (
      <div className="relative rounded-md my-3 bg-gray-50 group overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-50 text-xs text-gray-700 rounded-t-md border-b border-gray-200">
          <div className="flex items-center">
            <Code className="w-3.5 h-3.5 mr-2 text-blue-500" />
            <span className="font-medium">{language.toUpperCase()}</span>
          </div>
          <button
            onClick={() => handleCopyCode(code)}
            className="text-gray-500 hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50 focus:outline-none focus:ring-1 focus:ring-blue-200"
            aria-label="Copy code"
          >
            {copiedSnippet === code ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <MemoizedSyntaxHighlighter
          style={oneLight}
          language={language}
          {...props}
          customStyle={{
            margin: 0,
            padding: '12px 16px',
            borderRadius: '0 0 6px 6px',
            background: '#f9fafb',
            fontSize: '0.85rem',
            maxHeight: '400px',
            overflow: 'auto'
          }}
          showLineNumbers={true}
          wrapLongLines={false}
        >
          {code}
        </MemoizedSyntaxHighlighter>
      </div>
    );
  }, [copiedSnippet, handleCopyCode]);

  // Optimize example prompts rendering
  const ExamplePrompts = useMemo(() => {
    if (!showExamples || messages.length >= 2) return null;
    
    return (
      <div className="mt-4 mb-2">
        <div className="flex items-center mb-3">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 mr-2">
            <Lightbulb className="text-amber-500 h-3.5 w-3.5" />
          </div>
          <p className="text-sm font-medium text-gray-700">Try asking about:</p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {randomExamples.map((example, index) => (
            <button
              key={index}
              className="jarvis-suggestion-card text-left text-sm bg-white rounded-xl px-4 py-3 hover:bg-blue-50 transition-all border border-gray-200 shadow-sm hover:shadow hover:border-blue-200"
              onClick={() => handleExampleClick(example)}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    );
  }, [showExamples, messages.length, randomExamples, handleExampleClick]);

  // Optimize the rendering of chat messages with windowing for long conversations
  const visibleMessages = useMemo(() => {
    // If there are fewer than 20 messages, just show them all
    if (messages.length <= 20) {
      return messages;
    }
    
    // Otherwise, only show the last 20 messages to avoid rendering too many at once
    return messages.slice(messages.length - 20);
  }, [messages]);

  // Track if we need to show the "Load More" button
  const hasMoreMessages = messages.length > 20;
  
  // Function to load previous messages
  const loadMoreMessages = useCallback(() => {
    // This is a simple implementation - in a real app, you might load messages in chunks
    // For now, we'll just show all messages
    setMessages([...messages]);
  }, [messages]);

  // Memoize the markdown rendering components to prevent unnecessary re-renders
  const markdownComponents = useMemo(() => ({
    code: CodeBlock,
    h1: ({node, ...props}: any) => <h1 className="text-lg font-semibold mt-3 mb-2 text-gray-900 border-b border-gray-200 pb-1" {...props} />,
    h2: ({node, ...props}: any) => <h2 className="text-base font-semibold mt-3 mb-2 text-gray-800" {...props} />,
    h3: ({node, ...props}: any) => <h3 className="text-sm font-semibold mt-2 mb-1 text-gray-700" {...props} />,
    p: ({node, ...props}: any) => <p className="mb-2 leading-relaxed" {...props} />,
    ul: ({node, ...props}: any) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
    ol: ({node, ...props}: any) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
    li: ({node, ...props}: any) => <li className="text-sm" {...props} />,
    a: ({node, ...props}: any) => <a className="text-blue-600 hover:underline hover:text-blue-700 transition-colors" {...props} />,
    blockquote: ({node, ...props}: any) => <blockquote className="border-l-2 border-blue-300 pl-4 italic my-2 text-gray-600 bg-blue-50 bg-opacity-30 py-1 rounded-sm" {...props} />,
    table: ({node, ...props}: any) => <div className="overflow-x-auto my-3 rounded border border-gray-200"><table className="min-w-full divide-y divide-gray-200" {...props} /></div>,
    thead: ({node, ...props}: any) => <thead className="bg-gray-100" {...props} />,
    tbody: ({node, ...props}: any) => <tbody className="divide-y divide-gray-200" {...props} />,
    th: ({node, ...props}: any) => <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider" {...props} />,
    td: ({node, ...props}: any) => <td className="px-3 py-2 text-sm border-r last:border-r-0 border-gray-200" {...props} />,
    tr: ({node, ...props}: any) => <tr className="hover:bg-gray-50 transition-colors" {...props} />,
    strong: ({node, ...props}: any) => <strong className="font-semibold text-gray-800" {...props} />,
    em: ({node, ...props}: any) => <em className="italic text-gray-700" {...props} />,
    hr: ({node, ...props}: any) => <hr className="my-3 border-t border-gray-200" {...props} />,
  }), [CodeBlock]);

  return (
    <div className="flex flex-col h-full jarvis-chat-container w-full mx-auto shadow-sm border rounded-lg overflow-hidden max-w-[1200px]" style={{ maxHeight: 'calc(100vh - 60px)' }}>
      {/* Header with subtle gradient background */}
      <div className="border-b pb-2 px-3 pt-2 flex justify-between items-center bg-gradient-to-r from-gray-50 to-blue-50 flex-shrink-0">
        <div className="flex items-center">
          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-blue-500 bg-opacity-10 mr-2">
            <Sparkles className="text-blue-500 h-3.5 w-3.5" />
          </div>
          <h3 className="font-medium text-sm text-gray-700">Jarvis<span className="text-blue-500">.</span></h3>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && !isAutoscrollEnabled && (
            <button
              onClick={toggleAutoScroll}
              className="flex items-center justify-center h-7 w-7 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors"
              title={isAutoscrollEnabled ? "Disable auto-scroll" : "Enable auto-scroll"}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2">
                <path d={isAutoscrollEnabled ? "M19 14l-7 7m0 0l-7-7m7 7V3" : "M5 10l7-7m0 0l7 7m-7-7v18"} />
              </svg>
            </button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearConversation}
            className="h-7 w-7 p-0 transition-all flex items-center justify-center"
          >
            <RotateCcw 
              className="h-3 w-3 text-gray-500 metallic-blue-icon transition-all duration-300 hover:-rotate-45 transform" 
            />
          </Button>
        </div>
      </div>

      {/* Messages area with custom scrollbar */}
      <div 
        className={`flex-grow overflow-y-auto px-4 py-4 chat-messages-container bg-gradient-to-b from-white to-gray-50 relative ${isLoading && !isAutoscrollEnabled ? 'scroll-indicator' : ''}`} 
        style={{ minHeight: '300px', height: 'calc(100% - 130px)' }} 
        ref={messagesContainerRef}
      >
        {/* Show Load More button if needed */}
        {hasMoreMessages && (
          <div className="flex justify-center mb-4">
            <button 
              onClick={loadMoreMessages}
              className="text-xs text-blue-600 bg-blue-50 py-1 px-3 rounded-full hover:bg-blue-100 transition-colors"
            >
              Load previous messages
            </button>
          </div>
        )}
        
        {/* Auto-scroll indicator when disabled during generation */}
        {isLoading && !isAutoscrollEnabled && (
          <div 
            className="absolute bottom-4 right-4 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-full text-xs shadow-sm flex items-center cursor-pointer hover:bg-blue-200 transition-colors"
            onClick={toggleAutoScroll}
          >
            <span className="mr-1">Auto-scroll disabled</span>
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        )}
      
        {/* Render only visible messages for better performance */}
        {visibleMessages.map((message) => (
          <div
            key={message.id}
            className={`mb-6 last:mb-2 ${message.role === 'user' ? 'flex justify-end' : ''}`}
          >
            {message.role === 'assistant' && (
              <div className="flex mb-2 ml-1">
                <div className={`h-6 w-6 rounded-full bg-white flex items-center justify-center text-black text-xs font-medium transition-all ${
                  (isLoading && message.content === "") || message.id === animatingMessageId 
                  ? 'j-profile-loader shadow-md' 
                  : 'border border-gray-200 hover:border-blue-300'
                }`}>
                  {!((isLoading && message.content === "") || message.id === animatingMessageId) && 'J'}
                </div>
                <span className="text-xs text-gray-500 ml-2 self-end mb-0.5">Jarvis</span>
              </div>
            )}
            
            {/* Remove shadow-sm and background/padding/border for assistant messages */}
            <div className={`max-w-[85%] transition-all ${ 
              message.role === 'user' 
                ? 'bg-white text-gray-800 rounded-2xl rounded-tr-sm px-4 py-2 border border-gray-200 hover:shadow-md shadow-sm' // Keep user bubble styling
                : '' // No background, border, padding, or shadow for assistant
            }`} style={message.role === 'user' ? {borderWidth: '0.1px'} : {}}>
              {message.role === 'user' ? (
                <p className="text-sm">{message.content}</p>
              ) : message.content ? (
                <div className={`jarvis-markdown text-sm px-3 py-1.5 text-gray-800 ${message.id === animatingMessageId ? 'animating-text' : ''}`}> {/* Inner padding remains */}
                  {/* Replace ReactMarkdown with MemoizedReactMarkdown */}
                  <MemoizedReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {message.content}
                  </MemoizedReactMarkdown>
                </div>
              ) : (
                <div className="px-3 py-3 text-gray-500 text-sm flex items-center"> {/* Inner padding remains */}
                  <span>Thinking...</span>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Use memoized example prompts */}
        {ExamplePrompts}

        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area with improved styling */}
      <div className="mt-auto px-4 pb-6 pt-4 flex-shrink-0">
        <div className="relative mx-auto w-full max-w-3xl border border-gray-200 rounded-2xl bg-white shadow transition-shadow hover:shadow-md focus-within:shadow-lg">
          <textarea
            ref={inputRef}
            value={displayValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask Jarvis to design, edit, or explain your architecture..."
            className="w-full max-w-full mx-auto block resize-none rounded-2xl bg-transparent p-4 pr-12 text-sm text-gray-900 placeholder-gray-400 focus:outline-none"
            disabled={isLoading}
            rows={1} // Start with 1 row
            style={{ minHeight: '44px' }} // Minimum height matching button + padding
          />

          <div className="absolute bottom-3 right-3">
            <Button
              className={`
                group h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm
                ${isLoading
                  ? 'bg-gray-700 hover:bg-gray-600 cursor-pointer' // Grayish when loading, slightly lighter on hover
                  : displayValue.trim()
                    ? 'bg-white text-black hover:bg-black hover:text-white' // White bg/black text -> Black bg/white text on hover
                    : 'bg-white text-black opacity-50 cursor-not-allowed' // White bg/black text, disabled
                }
              `}
              disabled={!isLoading && !displayValue.trim()} // Disabled only if not loading AND no text
              onClick={isLoading ? handleStopSending : handleSendMessage}
              variant="ghost"
              aria-label={isLoading ? "Stop Sending" : "Send Message"}
            >
              {isLoading ? (
                // Stop Icon (White Square with 2px radius)
                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5">
                  <rect x="1" y="1" width="8" height="8" rx="1" ry="1" fill="#ffffff" />
                </svg> 
              ) : (
                // Arrow Icon (Changes color via group-hover)
                <ArrowRight className={`
                  h-4 w-4 transition-colors
                  ${displayValue.trim()
                    ? 'text-black group-hover:text-white' // Black text normally, white on hover when active
                    : 'text-black' // Black text when disabled/inactive
                  }
                `} />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
} 