"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useState } from "react";
import { useCodebaseStore } from "../store/useCodebaseStore";

export default function Providers({ children }: { children: React.ReactNode }) {
  // Ensure a single QueryClient instance per app session
  const [queryClient] = useState(() => new QueryClient());
  
  // Initialize the store
  const storeState = useCodebaseStore.getState();
  console.log('Store initialized with state:', {
    genClass: storeState.genClass,
    genMethods: storeState.genMethods.map(m => ({
      ...m,
      // Just show method names and positions to avoid too much output
      identifier: m.identifier.descriptor,
      position: m.position
    }))
  });
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
