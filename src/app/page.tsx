// src/app/page.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { useRouter } from 'next/navigation';
import { ArrowRight, Moon, Sun, Code, Zap, Server, Cloud, Database, Shield, Cpu, Workflow, GitBranch, Check } from 'lucide-react';
import LoadingScreen from '@/components/LoadingScreen';

const featurePhrases = [
  "Map a cloud architecture from a prompt",
  "Visualize microservices in real time",
  "Design cloud systems with AI precision",
  "Auto-generate scalable backend blueprints",
  "Prompt → Deployable cloud infra",
  "Diagram your ideas into production-ready systems",
  "Generate AWS CDK code from your architecture",
  "Design multi-tier cloud systems effortlessly",
  "Architect serverless applications with AI guidance",
  "Visualize complex data flows across services",
  "Create cloud-native architectures in seconds",
  "Optimize for performance, cost, and resilience",
  "Design architectures that follow AWS best practices",
  "Implement security controls with one prompt",
  "Build microservice systems with clear boundaries",
  "Generate infrastructure as code automatically",
  "Design disaster recovery solutions with AI",
  "Create multi-region high availability architectures",
  "Automate cloud compliance with intelligent design",
  "Transform business requirements into AWS architecture",
  "Plan migration paths with AI assistance",
  "Design event-driven architectures graphically",
  "Prototype cloud solutions in minutes, not days",
  "Build container orchestration with accurate dependencies",
  "Design data lakes and analytics pipelines visually"
];

/**
 * API key validation hook to check configuration on page load
 */
function useApiKeyValidation() {
  const [apiKeyStatus, setApiKeyStatus] = useState<{
    loading: boolean;
    cohereConfigured: boolean;
    googleaiConfigured: boolean;
    error: string | null;
  }>({
    loading: true,
    cohereConfigured: false,
    googleaiConfigured: false,
    error: null
  });

  useEffect(() => {
    const checkApiConfiguration = async () => {
      try {
        const response = await fetch('/api/check-config');
        
        if (!response.ok) {
          throw new Error('Failed to check API configuration');
        }
        
        const data = await response.json();
        
        setApiKeyStatus({
          loading: false,
          cohereConfigured: data.cohereConfigured,
          googleaiConfigured: data.googleaiConfigured,
          error: data.error || null
        });
      } catch (error) {
        console.error('Error checking API configuration:', error);
        setApiKeyStatus({
          loading: false,
          cohereConfigured: false,
          googleaiConfigured: false,
          error: 'Failed to check API configuration. Please check console for details.'
        });
      }
    };

    checkApiConfiguration();
  }, []);

  return apiKeyStatus;
}

// Add window interface declaration
declare global {
  interface Window {
    completeLoading?: () => void;
  }
}

export default function HomePage() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('generating');
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const router = useRouter();
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Validate API keys on page load
  const { loading, cohereConfigured, googleaiConfigured, error } = useApiKeyValidation();
  
  // Handle initial loading screen
  useEffect(() => {
    // Set a timeout to ensure the loading screen is displayed for at least 4 seconds
    const timer = setTimeout(() => {
      setShowLoadingScreen(false);
    }, 4000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Rotating loading messages
  useEffect(() => {
    if (!isLoading) return;
    
    const messages = [
      'generating', 
      'building architecture', 
      'connecting services', 
      'optimizing design'
    ];
    
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % messages.length;
      setLoadingMessage(messages[index]);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [isLoading]);

  // Phrase rotation animation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhraseIndex((prevIndex) => (prevIndex + 1) % featurePhrases.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !cohereConfigured) return;
    
    try {
      setIsLoading(true);
      setLoadingMessage("generating");
      
      // Create abort controller for cancelling request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      // Generate the architecture
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal
      });

      if (!response.ok) {
        // Check specifically for 503 errors which indicate Google AI is overloaded
        if (response.status === 503) {
          const errorData = await response.json();
          console.warn("AI service temporarily unavailable:", errorData);
          
          // Show a more helpful message to the user
          setLoadingMessage("AI service busy, waiting to retry...");
          
          // Wait 3 seconds before retrying automatically
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Check if the request was aborted during the wait
          if (signal.aborted) throw new Error("Request was cancelled");
          
          setLoadingMessage("retrying request...");
          
          // Try again recursively (the backend already implements exponential backoff)
          return handleGenerate();
        }
        
        throw new Error("Failed to generate architecture");
      }

      const data = await response.json();

      if (data && data.id) {
        // Save the current state in sessionStorage before navigating away
        sessionStorage.setItem('lastPrompt', prompt);
        
        // Navigate to the architecture page
        router.push(`/architecture/${data.id}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error("Error generating architecture:", error);
        setLoadingMessage("Error: " + (error.message || "Failed to generate architecture"));
        
        // Reset loading state after showing error message for 3 seconds
        setTimeout(() => {
          if (isLoading) {
            setIsLoading(false);
          }
        }, 3000);
      }
    } finally {
      // Don't set isLoading to false here, as we may be retrying
      // We'll set it to false after a successful request or in the error handler
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setLoadingMessage('generating');
  };

  // If loading screen is active, show only that
  if (showLoadingScreen) {
    return <LoadingScreen onComplete={() => setShowLoadingScreen(false)} />;
  }

  return (
    <div className={`flex flex-col min-h-screen ${darkMode ? 'bg-black text-white' : 'bg-white text-black'} relative overflow-hidden transition-colors duration-300`}>
      {/* Theme toggle button */}
      <div className="absolute top-4 right-4 z-10">
        <button 
          onClick={toggleTheme}
          className={`p-2 rounded-full ${darkMode ? 'bg-gray-800 text-white' : 'bg-gray-50 text-gray-800'} transition-colors duration-300`}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
      
      {/* Main content */}
      <main className="flex-grow flex flex-col items-center justify-center px-4 relative">
        <div className={`max-w-[1100px] w-full mx-auto flex flex-col items-center rounded-2xl p-8 transition-colors duration-300 ${darkMode ? 'bg-black' : 'bg-white'}`}>
        
          {/* Div 1: Feature Button */}
          <div className="mb-8 w-full flex justify-center mt-5">
            <div className="feature-button-container">
              <Button 
                variant="outline" 
                className={`feature-button rounded-full text-sm font-light py-1.5 px-6 ${
                  darkMode 
                  ? 'bg-gray-900 text-white border-gray-700' 
                  : 'bg-white text-black border-gray-300'
                } transition-all hover:shadow-md relative z-1`}
              >
                <span className={`mr-2 ${darkMode ? 'text-blue-400' : 'text-blue-500'} font-medium`}>✨</span>
                Cloud CDK Available
              </Button>

              {/* CDK Converter Popup Overlay */}
              <div className="cdk-popup-overlay">
                <div className={`cdk-popup-content ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
                  <div className="cdk-popup-header">
                    <h2 className={`text-xl font-medium ${darkMode ? 'text-gray-200' : 'text-black'} mb-2 flex items-center`}>
                      <Code className={`w-5 h-5 mr-2 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`} />
                      Cloudio CDK Converter
                    </h2>
                    <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Transform your architecture diagrams into production-ready infrastructure code</p>
                  </div>

                  <div className="cdk-popup-section">
                    <h3 className={darkMode ? 'text-gray-200' : ''}><Code className="w-4 h-4" /> Technical Overview</h3>
                    <p className={darkMode ? 'text-gray-300' : ''}>Our CDK converter performs a sophisticated translation of visual architecture designs into fully deployable AWS CDK code in TypeScript. The process leverages advanced graph analysis algorithms to identify node relationships and service dependencies, ensuring the generated code follows AWS best practices.</p>
                    <p className={darkMode ? 'text-gray-300' : ''}>The converter maps each service node to its corresponding CDK construct, preserving all defined properties, configurations, and connections. It implements proper IAM permissions, networking configurations, and security settings automatically based on your architecture's intent.</p>
                    
                    <div className="cdk-popup-tech-list">
                      <span className="cdk-popup-tech-tag">AWS CDK v2</span>
                      <span className="cdk-popup-tech-tag">TypeScript</span>
                      <span className="cdk-popup-tech-tag">IaC</span>
                      <span className="cdk-popup-tech-tag">CloudFormation</span>
                      <span className="cdk-popup-tech-tag">Graph Analysis</span>
                    </div>
                  </div>

                  <div className="cdk-popup-section">
                    <h3 className={darkMode ? 'text-gray-200' : ''}><Zap className="w-4 h-4" /> Key Benefits</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                      <div className="flex items-start gap-2">
                        <Server className="w-4 h-4 text-blue-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm mb-1">Infrastructure as Code</p>
                          <p className="text-xs">Enables version-controlled, repeatable deployments across environments</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Cloud className="w-4 h-4 text-blue-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm mb-1">Multi-Region Support</p>
                          <p className="text-xs">Generated code includes multi-AZ and regional failover configurations</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Database className="w-4 h-4 text-blue-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm mb-1">Stateful Resource Management</p>
                          <p className="text-xs">Properly handles stateful services with data persistence strategies</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Shield className="w-4 h-4 text-blue-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm mb-1">Security Best Practices</p>
                          <p className="text-xs">Implements least-privilege IAM policies and security groups</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="cdk-popup-section">
                    <h3 className={darkMode ? 'text-gray-200' : ''}><Cpu className="w-4 h-4" /> Conversion Process</h3>
                    <p className={darkMode ? 'text-gray-300' : ''}>The Cloudio system uses a five-step conversion pipeline to transform your architecture design to CDK code:</p>
                    
                    <ol className="ml-5 mt-3 space-y-2 text-sm">
                      <li className={darkMode ? "text-gray-300" : "text-gray-700"}>
                        <span className="font-medium">Graph Analysis:</span> Parses your architecture diagram's nodes and edges to create a directed dependency graph
                      </li>
                      <li className={darkMode ? "text-gray-300" : "text-gray-700"}>
                        <span className="font-medium">Service Mapping:</span> Maps each AWS service to its corresponding CDK construct with appropriate configuration
                      </li>
                      <li className={darkMode ? "text-gray-300" : "text-gray-700"}>
                        <span className="font-medium">Dependency Ordering:</span> Determines the correct order for resource creation to handle cross-service dependencies
                      </li>
                      <li className={darkMode ? "text-gray-300" : "text-gray-700"}>
                        <span className="font-medium">Code Generation:</span> Produces TypeScript CDK code with proper imports, stack definition, and resource configurations
                      </li>
                      <li className={darkMode ? "text-gray-300" : "text-gray-700"}>
                        <span className="font-medium">Validation:</span> Verifies the generated code against AWS CDK best practices and deployment constraints
                      </li>
                    </ol>
                  </div>

                  <div className="cdk-popup-section">
                    <h3 className={darkMode ? 'text-gray-200' : ''}><Workflow className="w-4 h-4" /> Development Roadmap</h3>
                    <p className={darkMode ? 'text-gray-300' : ''}>The Cloudio engineering team is actively working on enhancing the CDK converter with these upcoming features:</p>
                    
                    <div className="space-y-3 mt-4">
                      <div className="cdk-popup-roadmap-item">
                        <div className="cdk-popup-roadmap-icon"><Check className="w-3 h-3" /></div>
                        <div>
                          <p className={`font-medium text-sm ${darkMode ? 'text-gray-200' : ''}`}>Multi-language Support</p>
                          <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>Generate CDK in TypeScript, Python, Java, C# and more</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Input form section */}
          <div className="relative w-full max-w-4xl mx-auto mt-6">
            <div className={`relative border rounded-[15px] shadow-lg ${darkMode ? 'bg-[#1e1e1e] border-gray-600' : 'bg-white border-gray-600/50'}`} style={{ backgroundColor: darkMode ? '#1e1e1e' : '#fff' }}>
              <textarea
                className={`w-full p-4 resize-none rounded-[15px] focus:outline-none mb-2 focus:ring-0 ${darkMode ? 'text-white' : 'text-gray-900'} text-base`}
                rows={4}
                placeholder="Describe the architecture you want to build..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isLoading}
                style={{ backgroundColor: darkMode ? '#374151' : '#fff', color: darkMode ? '#fff' : '#000' }}
              />
              
              <div className={`flex justify-between items-center mt-2 mb-3 mr-2 px-2`} style={{ backgroundColor: darkMode ? '#1e1e1e ' : '#fff' }}>
                <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-500'}`}>
                  {isLoading && (
                    <span className="ml-3">
                      {loadingMessage.toLowerCase().includes('error') ? (
                        <span className="text-red-500">{loadingMessage}</span>
                      ) : loadingMessage.toLowerCase().includes('retry') || loadingMessage.toLowerCase().includes('busy') ? (
                        <span className="text-amber-500">{loadingMessage}</span>
                      ) : (
                        <span className="dot-animation">{loadingMessage}</span>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  {isLoading ? (
                    <button
                      onClick={handleStop}
                      className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center focus:outline-none"
                      aria-label="Stop generating"
                    >
                      <div className="w-3 h-3 bg-white rounded-sm"></div>
                    </button>
                  ) : (
                    <button
                      onClick={handleGenerate}
                      disabled={!prompt.trim() || loading || !cohereConfigured}
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center focus:outline-none transition-all
                        ${!prompt.trim() || loading || !cohereConfigured
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-blue-500 hover:bg-blue-600 generate-btn-shadow'}
                      `}
                      aria-label="Generate architecture"
                    >
                      <ArrowRight className="h-5 w-5 text-white" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Generate tooltip */}
            {!prompt.trim() && !isLoading && (
              <div className="generate-tooltip">
                Try "Design a scalable e-commerce architecture with caching and payment processing"
              </div>
            )}
          </div>
        </div>

        {/* Feature phrase text loop - positioned between input container and footer */}
        <div className="phrase-container">
          <div className="phrase-item text-gray-800" style={{ fontSize: '13px' }}>
            <p>{featurePhrases[currentPhraseIndex]}</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={`py-6 px-8 border-t ${darkMode ? 'border-gray-800 text-gray-100 ' : 'border-gray-200 text-gray-600'}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm">
              © {new Date().getFullYear()} Cloudio - Cloud Architecture Designer
            </p>
          </div>
          <div className="flex space-x-6">
            <a href="#" className="text-sm hover:underline">About</a>
            <a href="#" className="text-sm hover:underline">Documentation</a>
            <a href="#" className="text-sm hover:underline">GitHub</a>
            <a href="#" className="text-sm hover:underline">Privacy</a>
          </div>
        </div>
      </footer>
      
      {/* API key error notification */}
      {!loading && error && (
        <div className="fixed bottom-4 left-4 right-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg">
          <p className="font-bold">Configuration Error</p>
          <p>{error}</p>
          <p className="mt-2 text-sm">Please check your .env.local file and add the required API keys.</p>
        </div>
      )}
    </div>
  );
}