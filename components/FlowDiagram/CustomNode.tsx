'use client';

import { memo, useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useMutation } from '@tanstack/react-query';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { useNodesStore, type CustomNodeData } from '../../store/useNodesStore';
import './CustomNode.css';

type EditableFieldProps = {
  value: string;
  onSave: (value: string) => void;
  placeholder?: string;
  className?: string;
  isItalic?: boolean;
  isBold?: boolean;
};

const EditableField = ({
  value,
  onSave,
  placeholder = '',
  className = '',
  isItalic = false,
  isBold = false,
  nodeId,
  fieldName,
}: EditableFieldProps & { nodeId?: string; fieldName?: string }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Move cursor to end of text
      const length = inputRef.current.value.length;
      inputRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  // React Query mutation for log-edit
  const logEditMutation = useMutation({
    mutationFn: async ({ nodeId, field, oldValue, newValue }: { nodeId: string; field: string; oldValue: string; newValue: string }) => {
      return axios.post('/api/log-edit', {
        nodeId,
        field,
        oldValue,
        newValue,
      });
    },
  });

  const handleSave = () => {
    if (inputValue.trim() !== '' || value === '') {
      if (inputValue !== value && nodeId && fieldName) {
        logEditMutation.mutate({
          nodeId,
          field: fieldName,
          oldValue: value,
          newValue: inputValue,
        });
      }
      onSave(inputValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setInputValue(value);
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    handleSave();
  };

  if (isEditing) {
    return (
      <div style={{ position: 'relative' }}>
        <textarea
          ref={inputRef}
          className={`editable-field ${className}`}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          style={{
            fontStyle: isItalic ? 'italic' : 'normal',
            fontWeight: isBold ? 'bold' : 'normal',
          }}
        />
        {logEditMutation.isPending && (
          <span className="editable-field__status" style={{ position: 'absolute', right: 4, top: 4, fontSize: 10, color: '#888' }}>Saving...</span>
        )}
        {logEditMutation.isError && (
          <span className="editable-field__status" style={{ position: 'absolute', right: 4, top: 4, fontSize: 10, color: 'red' }}>Error</span>
        )}
        {logEditMutation.isSuccess && (
          <span className="editable-field__status" style={{ position: 'absolute', right: 4, top: 4, fontSize: 10, color: 'green' }}>Saved</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`editable-field ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      style={{
        fontStyle: isItalic ? 'italic' : 'normal',
        fontWeight: isBold ? 'bold' : 'normal',
        cursor: 'text',
      }}
    >
      {value || placeholder}
    </div>
  );
};

// CustomNodeData is now imported from useNodesStore.ts

type CustomNodeProps = NodeProps<CustomNodeData>;

function CustomNode({ data, id, selected }: CustomNodeProps) {
  const nodeId = id || data.id;
  
    const updateNodeField = useNodesStore((state) => state.updateNodeField);

  const handleFieldChange = (field: keyof Omit<CustomNodeData, 'id'>, value: string) => {
    updateNodeField(nodeId, field, value);
  };

  const handleNodeClick = (e: React.MouseEvent) => {
    // Prevent node selection when clicking on non-header areas
    if (!(e.target as HTMLElement).closest('.custom-node__header')) {
      e.stopPropagation();
    }
  };

  return (
    <div 
      className={`custom-node ${selected ? 'selected' : ''}`}
      onClick={handleNodeClick}
    >
      <Handle type="target" position={Position.Top} />
      
      <div className="custom-node__header custom-node-drag-handle">
        <EditableField
          value={data.headline}
          onSave={(value) => handleFieldChange('headline', value)}
          placeholder="Enter headline"
          className="custom-node__headline"
          isBold
          nodeId={nodeId}
          fieldName="headline"
        />
      </div>
      
      <div className="custom-node__return-value">
        <EditableField
          value={data.returnValue || ''}
          onSave={(value) => handleFieldChange('returnValue', value)}
          placeholder="return type"
          isItalic
          nodeId={nodeId}
          fieldName="returnValue"
        />
      </div>
      
      <div className="custom-node__content">
        <EditableField
          value={data.content1 || ''}
          onSave={(value) => handleFieldChange('content1', value)}
          placeholder="Enter content"
          nodeId={nodeId}
          fieldName="content1"
        />
      </div>
      
      <div className="custom-node__content">
        <EditableField
          value={data.content2 || ''}
          onSave={(value) => handleFieldChange('content2', value)}
          placeholder="Enter content"
          nodeId={nodeId}
          fieldName="content2"
        />
      </div>
      
      <Handle type="source" position={Position.Bottom} id="a" />
    </div>
  );
}

export default memo(CustomNode);
