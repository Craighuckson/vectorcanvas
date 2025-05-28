
"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the main client component with SSR disabled
const DynamicVectorCanvasClient = dynamic(
  () => import('@/components/vector-canvas/VectorCanvasClient'),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden items-center justify-center">
        <p className="text-lg animate-pulse">Loading Vector Canvas...</p>
      </div>
    ),
  }
);

export default function VectorCanvasPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // This effect runs only on the client side
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    // Render a loading state or null until the component is mounted on the client
    // This helps avoid hydration mismatches if VectorCanvasClient has client-only logic
    // or uses browser APIs immediately upon rendering.
    // The "Loading Vector Canvas..." from the dynamic import might show first if it takes time to load the component itself.
    // This "Initializing Editor..." is for the brief moment before dynamic import loading kicks in or if isMounted is false for other reasons.
    return (
      <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden items-center justify-center">
        <p className="text-lg animate-pulse">Initializing Editor...</p>
      </div>
    );
  }

  // Once mounted, render the actual client component
  return <DynamicVectorCanvasClient />;
}
