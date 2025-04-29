import React, { useEffect, useState } from 'react';

interface LoadingScreenProps {
  minDisplayTime?: number; // Minimum time to display in ms
  onComplete?: () => void; // Callback when minimum time has elapsed
}

export default function LoadingScreen({
  minDisplayTime = 4000, // Updated to 4 seconds (4000ms)
  onComplete
}: LoadingScreenProps) {
  const [visibleText, setVisibleText] = useState<string>("");
  const [active, setActive] = useState<boolean>(true);
  const fullText = "CLOUDIO";
  const letterInterval = 300; // Updated to 0.3 seconds (300ms) per letter

  useEffect(() => {
    let startTime = Date.now();
    let letterAnimationInterval: NodeJS.Timeout;
    
    // Function to handle the loading animation
    const animateLetters = () => {
      letterAnimationInterval = setInterval(() => {
        setVisibleText(prev => {
          // If we've shown all letters, start over
          if (prev.length >= fullText.length) {
            return fullText.charAt(0);
          }
          // Otherwise add the next letter
          return fullText.substring(0, prev.length + 1);
        });
      }, letterInterval);
    };

    // Start animation
    animateLetters();

    // Set timeout for minimum display time
    const minTimeTimeout = setTimeout(() => {
      const elapsedTime = Date.now() - startTime;
      
      // If minimum time has elapsed, allow component to be unmounted
      if (elapsedTime >= minDisplayTime) {
        clearInterval(letterAnimationInterval);
        setActive(false);
        if (onComplete) onComplete();
      } else {
        // If not enough time has elapsed, wait the remaining time
        const remainingTime = minDisplayTime - elapsedTime;
        setTimeout(() => {
          clearInterval(letterAnimationInterval);
          setActive(false);
          if (onComplete) onComplete();
        }, remainingTime);
      }
    }, minDisplayTime);

    // Cleanup function
    return () => {
      clearInterval(letterAnimationInterval);
      clearTimeout(minTimeTimeout);
    };
  }, [fullText, letterInterval, minDisplayTime, onComplete]);

  // Don't render if not active (allows parent to unmount)
  if (!active && onComplete) return null;

  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <div className="text-center">
        <h1 
          className="text-[55px] font-light text-black font-space-grotesk"
          style={{ 
            fontFamily: 'var(--font-space-grotesk)', 
            fontWeight: 300,
            letterSpacing: '-0.03em' // Closer letter spacing
          }}
        >
          {visibleText}
        </h1>
      </div>
    </div>
  );
} 