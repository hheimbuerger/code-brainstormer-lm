'use client';

// Basic Next.js App Router page
import { ReactFlowProvider } from 'reactflow';
import ProjectCanvas from "@/components/ProjectCanvas/ProjectCanvas";

export default function Page() {
  return (
    <ReactFlowProvider>
      <ProjectCanvas />
    </ReactFlowProvider>
  );
}
