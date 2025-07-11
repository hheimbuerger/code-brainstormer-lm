'use client';

// Basic Next.js App Router page
import { ReactFlowProvider } from 'reactflow';
import ClassDiagram from "../components/ClassDiagram/ClassDiagram";

export default function Page() {
  return (
    <ReactFlowProvider>
      <ClassDiagram />
    </ReactFlowProvider>
  );
}
