
"use client";

import React, { useState, useEffect } from 'react';

export default function MinimalTestPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setIsMounted(true);
    console.log("MinimalTestPage mounted successfully.");
  }, []);

  if (!isMounted) {
    return (
      <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden items-center justify-center">
        <p className="text-lg animate-pulse">Initializing Page...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-4">Minimal Test Page</h1>
      <p className="mb-2">Current count: {count}</p>
      <button 
        onClick={() => setCount(c => c + 1)}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        Increment
      </button>
      <p className="mt-6 text-sm text-muted-foreground">
        If this page is stable (not reloading and the counter works), the issue is likely within the VectorCanvasClient component or its imports.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Please check the browser console and your terminal (Next.js server logs) for any errors, especially related to "React.cache".
      </p>
    </div>
  );
}
