
"use client";

import type { HistoryEntry } from '@/lib/types';
import { useState, useCallback } from 'react';

const MAX_HISTORY_LENGTH = 20; // Increased capacity

interface UseCanvasHistoryReturn {
  currentHistory: HistoryEntry | null;
  setHistory: (entry: HistoryEntry) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  canUndo: boolean;
  canRedo: boolean;
  resetHistory: (initialEntry: HistoryEntry) => void;
}

export function useCanvasHistory(initialEntry: HistoryEntry): UseCanvasHistoryReturn {
  const [history, setHistoryStack] = useState<HistoryEntry[]>([initialEntry]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const currentHistory = history[currentIndex] || null;

  const setHistory = useCallback((entry: HistoryEntry) => {
    setHistoryStack(prev => {
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(entry);
      if (newHistory.length > MAX_HISTORY_LENGTH) {
        newHistory.shift(); // Remove the oldest entry
        setCurrentIndex(MAX_HISTORY_LENGTH - 1);
        return newHistory;
      }
      setCurrentIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [currentIndex]);

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      return history[currentIndex - 1];
    }
    return null;
  }, [currentIndex, history]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1);
      return history[currentIndex + 1];
    }
    return null;
  }, [currentIndex, history]);
  
  const resetHistory = useCallback((newInitialEntry: HistoryEntry) => {
    setHistoryStack([newInitialEntry]);
    setCurrentIndex(0);
  }, []);

  return {
    currentHistory,
    setHistory,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    resetHistory,
  };
}
