'use client';

// Basic Next.js App Router page
import { ReactFlowProvider } from 'reactflow';
import FlowDiagram from "../components/FlowDiagram/FlowDiagram";

export default function Page() {
  return (
    <ReactFlowProvider>
      <FlowDiagram />
    </ReactFlowProvider>
  );
}
