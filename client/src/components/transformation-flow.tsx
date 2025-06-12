import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trash2, GripVertical, Play, ArrowRight, Database, Zap, Filter, FileOutput, ChevronDown, ChevronRight, Folder, X } from "lucide-react";
import type { Dataset, Transformation } from "@shared/schema";

interface TransformationFlowProps {
  dataset: Dataset;
  transformations: Transformation[];
  onTransformationReorder: (transformations: Transformation[]) => void;
  onTransformationDelete: (transformationId: number) => void;
  onExecuteFlow: () => void;
  sampleData: Record<string, any>[];
  allDatasets?: Dataset[];
  onDatasetChange?: (datasetId: number) => void;
}

interface FlowNode {
  id: string;
  type: 'dataset' | 'transformation' | 'output';
  data: any;
  position: { x: number; y: number };
}

export function TransformationFlow({ 
  dataset, 
  transformations, 
  onTransformationReorder, 
  onTransformationDelete,
  onExecuteFlow,
  sampleData,
  allDatasets = [],
  onDatasetChange
}: TransformationFlowProps) {
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  const [showSidePanel, setShowSidePanel] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize default positions for nodes
  const getNodePosition = (nodeId: string, defaultX: number, defaultY: number) => {
    return nodePositions[nodeId] || { x: defaultX, y: defaultY };
  };

  // Create flow nodes from dataset and transformations
  const createFlowNodes = (): FlowNode[] => {
    const nodes: FlowNode[] = [];
    
    // Dataset input node
    const datasetPos = getNodePosition('dataset', 150, 300);
    nodes.push({
      id: 'dataset',
      type: 'dataset',
      data: dataset,
      position: datasetPos
    });

    // Transformation nodes
    transformations.forEach((transform, index) => {
      const transformPos = getNodePosition(`transform-${transform.id}`, 350 + index * 250, 300);
      nodes.push({
        id: `transform-${transform.id}`,
        type: 'transformation',
        data: transform,
        position: transformPos
      });
    });

    // Output node
    const outputPos = getNodePosition('output', 350 + transformations.length * 250, 300);
    nodes.push({
      id: 'output',
      type: 'output',
      data: { name: 'Processed Data' },
      position: outputPos
    });

    return nodes;
  };

  const nodes = createFlowNodes();

  // Calculate dynamic viewBox based on node positions
  const calculateViewBox = () => {
    if (nodes.length === 0) return "0 0 1200 600";
    
    const allPositions = nodes.map(n => n.position);
    const minX = Math.min(...allPositions.map(p => p.x)) - 100;
    const maxX = Math.max(...allPositions.map(p => p.x)) + 100;
    const minY = Math.min(...allPositions.map(p => p.y)) - 100;
    const maxY = Math.max(...allPositions.map(p => p.y)) + 100;
    
    const width = Math.max(1200, maxX - minX);
    const height = Math.max(600, maxY - minY);
    
    return `${minX} ${minY} ${width} ${height}`;
  };

  const viewBox = calculateViewBox();

  // Handle mouse events for dragging nodes
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const svgPoint = svgRef.current.createSVGPoint();
      svgPoint.x = e.clientX;
      svgPoint.y = e.clientY;
      const screenCTM = svgRef.current.getScreenCTM();
      
      if (screenCTM) {
        const transformedPoint = svgPoint.matrixTransform(screenCTM.inverse());
        setDragStart({ x: transformedPoint.x, y: transformedPoint.y });
      }
    }
    
    setIsDragging(true);
    setDraggedNodeId(nodeId);
  };

  // Handle canvas panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !isDragging) { // Left mouse button
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && draggedNodeId && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const svgPoint = svgRef.current.createSVGPoint();
      svgPoint.x = e.clientX;
      svgPoint.y = e.clientY;
      const screenCTM = svgRef.current.getScreenCTM();
      
      if (screenCTM) {
        const transformedPoint = svgPoint.matrixTransform(screenCTM.inverse());
        
        // Calculate the new position relative to the transform group
        const currentNode = nodes.find(n => n.id === draggedNodeId);
        if (currentNode) {
          const deltaX = transformedPoint.x - dragStart.x;
          const deltaY = transformedPoint.y - dragStart.y;
          
          const newX = currentNode.position.x + deltaX;
          const newY = currentNode.position.y + deltaY;
          
          // No boundary restrictions - infinite canvas
          setNodePositions(prev => ({
            ...prev,
            [draggedNodeId]: { 
              x: newX, 
              y: newY 
            }
          }));
          
          // Update drag start for next delta calculation
          setDragStart({ x: transformedPoint.x, y: transformedPoint.y });
        }
      }
    } else if (isPanning) {
      // Canvas panning
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      
      setPanOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, draggedNodeId, isPanning, lastPanPoint, dragStart, nodes]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedNodeId(null);
    setIsPanning(false);
  }, []);

  // Handle zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoomLevel(prev => Math.max(0.5, Math.min(2, prev * delta)));
  }, []);

  // Zoom controls
  const zoomIn = () => setZoomLevel(prev => Math.min(2, prev * 1.2));
  const zoomOut = () => setZoomLevel(prev => Math.max(0.5, prev / 1.2));
  const resetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Add global mouse event listeners
  React.useEffect(() => {
    if (isDragging || isPanning) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isPanning, handleMouseMove, handleMouseUp]);

  // Add wheel event listener for zoom
  React.useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // Apply single transformation to value for preview
  const applyTransformationToValue = (expression: string, value: any): any => {
    try {
      // Convert to string for processing
      const strValue = String(value || '');
      const numValue = parseFloat(strValue) || 0;

      // String Functions
      if (expression.includes('UPPERCASE(')) {
        return strValue.toUpperCase();
      }
      if (expression.includes('LOWERCASE(')) {
        return strValue.toLowerCase();
      }
      if (expression.includes('TRIM(')) {
        return strValue.trim();
      }
      if (expression.includes('LENGTH(')) {
        return strValue.length;
      }
      if (expression.includes('LEFT(')) {
        const match = expression.match(/LEFT\([^,]+,\s*"?(\d+)"?\)/);
        if (match) {
          const length = parseInt(match[1]);
          return strValue.substring(0, length);
        }
      }
      if (expression.includes('RIGHT(')) {
        const match = expression.match(/RIGHT\([^,]+,\s*"?(\d+)"?\)/);
        if (match) {
          const length = parseInt(match[1]);
          return strValue.substring(Math.max(0, strValue.length - length));
        }
      }
      if (expression.includes('SUBSTRING(')) {
        const match = expression.match(/SUBSTRING\([^,]+,\s*"?(\d+)"?(?:,\s*"?(\d+)"?)?\)/);
        if (match) {
          const start = parseInt(match[1]) - 1; // Convert to 0-based
          const length = match[2] ? parseInt(match[2]) : undefined;
          return length ? strValue.substring(start, start + length) : strValue.substring(start);
        }
      }
      if (expression.includes('REPLACE(')) {
        const match = expression.match(/REPLACE\([^,]+,\s*"([^"]*)",\s*"([^"]*)"\)/);
        if (match) {
          const search = match[1];
          const replace = match[2];
          return strValue.replace(new RegExp(search, 'g'), replace);
        }
      }

      // Mathematical Functions
      if (expression.includes('ABS(')) {
        return Math.abs(numValue);
      }
      if (expression.includes('ROUND(')) {
        const match = expression.match(/ROUND\([^,]+(?:,\s*(\d+))?\)/);
        const decimals = match && match[1] ? parseInt(match[1]) : 0;
        return Number(numValue.toFixed(decimals));
      }

      // Date Functions
      if (expression.includes('FORMAT_DATE(')) {
        const match = expression.match(/FORMAT_DATE\([^,]+,\s*"([^"]*)"\)/);
        if (match) {
          const format = match[1];
          const date = new Date(strValue);
          if (!isNaN(date.getTime())) {
            if (format === 'YYYY-MM-DD') {
              return date.toISOString().split('T')[0];
            }
            if (format === 'MM/DD/YYYY') {
              return date.toLocaleDateString('en-US');
            }
          }
        }
        return strValue;
      }

      // Conditional Functions
      if (expression.includes('IF(')) {
        const match = expression.match(/IF\(([^,]+),\s*"([^"]*)",\s*"([^"]*)"\)/);
        if (match) {
          const condition = match[1];
          const trueValue = match[2];
          const falseValue = match[3];
          // Simple condition evaluation (can be expanded)
          if (condition.includes('=')) {
            const [left, right] = condition.split('=').map(s => s.trim().replace(/"/g, ''));
            return strValue === right ? trueValue : falseValue;
          }
        }
      }

      return value;
    } catch (error) {
      console.error('Error applying transformation:', error);
      return value;
    }
  };



  const handleDragStart = (index: number) => {
    setDraggedItem(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem === null) return;

    const updatedTransformations = [...transformations];
    const draggedTransformation = updatedTransformations[draggedItem];
    updatedTransformations.splice(draggedItem, 1);
    updatedTransformations.splice(index, 0, draggedTransformation);

    // Update sequence numbers
    const reorderedTransformations = updatedTransformations.map((t, i) => ({
      ...t,
      sequenceNumber: i + 1
    }));

    onTransformationReorder(reorderedTransformations);
    setDraggedItem(null);
  };



  return (
    <div className="flex h-full bg-gray-100 dark:bg-gray-900">
      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Transformation Flow Canvas
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Drag nodes to reposition • {transformations.length} transformations
              </p>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div 
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-white dark:bg-gray-900"
          onMouseDown={handleCanvasMouseDown}
        >
          {/* Zoom Controls */}
          <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={zoomIn}
              className="h-8 w-8 p-0 bg-white dark:bg-gray-800"
              title="Zoom In"
            >
              +
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={zoomOut}
              className="h-8 w-8 p-0 bg-white dark:bg-gray-800"
              title="Zoom Out"
            >
              -
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetZoom}
              className="h-8 w-8 p-0 bg-white dark:bg-gray-800 text-xs"
              title="Reset Zoom"
            >
              ⌂
            </Button>
            <div className="text-xs text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded px-1">
              {Math.round(zoomLevel * 100)}%
            </div>
          </div>

          <svg 
            ref={svgRef}
            className="w-full h-full"
            viewBox={viewBox}
            style={{ 
              cursor: isPanning ? 'grabbing' : isDragging ? 'grabbing' : 'grab'
            }}
          >
            {/* Grid Background */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
              </pattern>
              <pattern id="grid-dark" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#374151" strokeWidth="1"/>
              </pattern>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
              </marker>
            </defs>
            
            {/* Full canvas grid background */}
            <rect x="-10000" y="-10000" width="20000" height="20000" fill="url(#grid)" className="dark:hidden" />
            <rect x="-10000" y="-10000" width="20000" height="20000" fill="url(#grid-dark)" className="hidden dark:block" />

            <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}>
              {/* Draw connections */}
              {nodes.slice(0, -1).map((node, index) => {
                const nextNode = nodes[index + 1];
                const startX = node.position.x + 30;
                const startY = node.position.y;
                const endX = nextNode.position.x - 30;
                const endY = nextNode.position.y;
                
                // Calculate control points for smooth curve
                const controlOffset = Math.abs(endX - startX) * 0.3;
                const pathData = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
                
                return (
                  <path
                    key={`connection-${index}`}
                    d={pathData}
                    stroke="#6b7280"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                  />
                );
              })}

              {/* Draw nodes */}
              {nodes.map((node, index) => {
                const nodeColor = node.type === 'dataset' ? '#3b82f6' : 
                                 node.type === 'transformation' ? '#10b981' : '#8b5cf6';
                
                return (
                  <g key={node.id}>
                    {/* Node circle */}
                    <circle
                      cx={node.position.x}
                      cy={node.position.y}
                      r="30"
                      fill={nodeColor}
                      stroke="#fff"
                      strokeWidth="3"
                      className="cursor-move drop-shadow-lg"
                      onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    />
                    
                    {/* Node icon */}
                    <foreignObject 
                      x={node.position.x - 12} 
                      y={node.position.y - 12} 
                      width="24" 
                      height="24"
                      className="pointer-events-none"
                    >
                      <div className="flex items-center justify-center w-full h-full text-white">
                        {node.type === 'dataset' && <Database className="h-6 w-6" />}
                        {node.type === 'transformation' && <Zap className="h-6 w-6" />}
                        {node.type === 'output' && <FileOutput className="h-6 w-6" />}
                      </div>
                    </foreignObject>

                    {/* Node label */}
                    <text
                      x={node.position.x}
                      y={node.position.y + 50}
                      textAnchor="middle"
                      className="fill-gray-700 dark:fill-gray-300 font-medium pointer-events-none"
                      style={{ fontSize: '12px' }}
                    >
                      {node.type === 'dataset' ? dataset.name.split('.')[0] : 
                       node.type === 'transformation' ? node.data.expression.split('(')[0] :
                       'Output'}
                    </text>

                    {/* Transformation step number */}
                    {node.type === 'transformation' && (
                      <text
                        x={node.position.x}
                        y={node.position.y + 65}
                        textAnchor="middle"
                        className="fill-gray-500 dark:fill-gray-400 pointer-events-none"
                        style={{ fontSize: '10px' }}
                      >
                        Step {index}
                      </text>
                    )}
                    
                    {/* Delete button for transformations */}
                    {node.type === 'transformation' && (
                      <foreignObject 
                        x={node.position.x + 20} 
                        y={node.position.y - 30} 
                        width="24" 
                        height="24"
                      >
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => onTransformationDelete(node.data.id)}
                          className="h-6 w-6 p-0 rounded-full"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </foreignObject>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Mini Map */}
          {showMiniMap && (
            <div className="absolute bottom-4 right-4 w-48 h-32 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
              <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Overview</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMiniMap(false)}
                  className="h-4 w-4 p-0 text-gray-500 hover:text-gray-700"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <svg className="w-full h-full" viewBox="0 0 1200 600">
                {/* Mini map grid */}
                <rect width="100%" height="100%" fill="#f9fafb" className="dark:fill-gray-900" />
                <defs>
                  <pattern id="mini-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#mini-grid)" />
                
                {/* Mini map connections */}
                {nodes.slice(0, -1).map((node, index) => {
                  const nextNode = nodes[index + 1];
                  const startX = node.position.x + 15;
                  const startY = node.position.y;
                  const endX = nextNode.position.x - 15;
                  const endY = nextNode.position.y;
                  
                  const controlOffset = Math.abs(endX - startX) * 0.3;
                  const pathData = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
                  
                  return (
                    <path
                      key={`mini-connection-${index}`}
                      d={pathData}
                      stroke="#9ca3af"
                      strokeWidth="1"
                      fill="none"
                    />
                  );
                })}

                {/* Mini map nodes */}
                {nodes.map((node) => {
                  const nodeColor = node.type === 'dataset' ? '#3b82f6' : 
                                   node.type === 'transformation' ? '#10b981' : '#8b5cf6';
                  
                  return (
                    <circle
                      key={`mini-${node.id}`}
                      cx={node.position.x}
                      cy={node.position.y}
                      r="8"
                      fill={nodeColor}
                      stroke="#fff"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Viewport indicator */}
                <rect
                  x={-panOffset.x / zoomLevel}
                  y={-panOffset.y / zoomLevel}
                  width={1200 / zoomLevel}
                  height={600 / zoomLevel}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                />
              </svg>
            </div>
          )}
        </div>
        

      </div>
    </div>
  );
}