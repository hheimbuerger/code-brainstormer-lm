import { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
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
}: EditableFieldProps) => {
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

  const handleSave = () => {
    if (inputValue.trim() !== '' || value === '') {
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

// Define the data type for our custom node
type CustomNodeData = {
  id: string;
  headline: string;
  returnValue?: string;
  content1?: string;
  content2?: string;
};

type CustomNodeProps = NodeProps<CustomNodeData> & {
  onNodeDataChange?: (nodeId: string, field: string, value: string) => void;
};

function CustomNode({ data, id, selected, onNodeDataChange }: CustomNodeProps) {
  const nodeId = id || data.id;
  
  const handleFieldChange = (field: keyof Omit<CustomNodeData, 'id'>, value: string) => {
    if (onNodeDataChange) {
      onNodeDataChange(nodeId, field, value);
    }
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
        />
      </div>
      
      <div className="custom-node__return-value">
        <EditableField
          value={data.returnValue || ''}
          onSave={(value) => handleFieldChange('returnValue', value)}
          placeholder="return type"
          isItalic
        />
      </div>
      
      <div className="custom-node__content">
        <EditableField
          value={data.content1 || ''}
          onSave={(value) => handleFieldChange('content1', value)}
          placeholder="Enter content"
        />
      </div>
      
      <div className="custom-node__content">
        <EditableField
          value={data.content2 || ''}
          onSave={(value) => handleFieldChange('content2', value)}
          placeholder="Enter content"
        />
      </div>
      
      <Handle type="source" position={Position.Bottom} id="a" />
    </div>
  );
}

export default memo(CustomNode);
