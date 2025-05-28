
"use client"; // This is crucial

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// The new component that will contain the actual canvas UI and logic
const DynamicVectorCanvasClient = dynamic(
  () => import('@/components/vector-canvas/VectorCanvasClient'),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden items-center justify-center">
        <p className="text-lg animate-pulse">Loading Vector Editor...</p>
      </div>
    ),
  }
);

export default function VectorCanvasPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // This effect runs only on the client, after the component mounts
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    // While isMounted is false, the loading component from dynamic import will be shown.
    // You can also return a specific skeleton here if preferred,
    // but dynamic's loading prop handles this.
    return (
        <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden items-center justify-center">
            <p className="text-lg animate-pulse">Initializing Editor...</p>
        </div>
    );
  }

  // Once mounted, render the actual client-side component
  return <DynamicVectorCanvasClient />;
}
