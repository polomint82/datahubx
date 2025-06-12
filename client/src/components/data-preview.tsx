import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { X, Wand2, ArrowUpDown, ArrowUp, ArrowDown, Search, Type, Hash, Calendar, ToggleLeft, FileText, Settings, Sparkles, Trash2, GripVertical, ChevronDown, ChevronRight, PanelRightOpen, PanelRightClose } from "lucide-react";
import type { Dataset, Transformation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { FunctionMenu } from "./function-menu";
import { CellAnnotation } from "./cell-annotation";
import { TransformationFlow } from "./transformation-flow";

interface DataPreviewProps {
  dataset: Dataset;
  onClose?: () => void;
  maxRows?: number;
  onDatasetChange?: (datasetId: number) => void;
}

export function DataPreview({ dataset, onClose, maxRows = 50, onDatasetChange }: DataPreviewProps) {
  const queryClient = useQueryClient();
  const [showWithTransforms, setShowWithTransforms] = useState(true);
  const [transformedData, setTransformedData] = useState<Record<string, any>[]>([]);
  const [isApplyingTransforms, setIsApplyingTransforms] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showTransformationsPopup, setShowTransformationsPopup] = useState(false);
  const [selectedColumnForTransforms, setSelectedColumnForTransforms] = useState<string | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [activeTransformsExpanded, setActiveTransformsExpanded] = useState(true);
  const [datasetsExpanded, setDatasetsExpanded] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'flow'>('table');

  // Handle function selection from menu for a specific column
  const handleFunctionSelect = (columnName?: string) => 
    async (functionDef: any, parameters: Record<string, any>) => {
      let expression;
      if (parameters && Object.keys(parameters).length > 0) {
        const paramString = Object.entries(parameters).map(([key, value]) => `"${value}"`).join(', ');
        expression = `${functionDef.name}(${columnName || 'column_name'}, ${paramString})`;
      } else {
        expression = `${functionDef.name}(column_name)`;
      }

      try {
        // Use the specific column or fall back to first column
        const targetColumn = columnName || dataset.columns[0]?.name || 'column_name';
        
        // Check for duplicate function on same column
        const existingTransforms = transformations.filter((t: any) => 
          t.targetColumn === targetColumn && 
          (t.status === 'active' || t.status === 'applied')
        );
        
        const duplicateFunction = existingTransforms.some((t: Transformation) => {
          const existingFunctionName = t.expression.match(/^(\w+)\(/)?.[1];
          return existingFunctionName === functionDef.name;
        });
        
        if (duplicateFunction) {
          alert(`The ${functionDef.name} function is already applied to the ${targetColumn} column. Remove the existing transformation first or choose a different function.`);
          return;
        }
        
        // Calculate next sequence number for this column
        const maxSequence = Math.max(0, ...existingTransforms.map((t: any) => t.sequenceNumber || 0));
        const sequenceNumber = maxSequence + 1;
        
        const transformationName = `${functionDef.name.toLowerCase()}_${targetColumn}_${Date.now()}`;
        
        const response = await fetch('/api/transformations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            name: transformationName,
            datasetId: dataset.id,
            tenantId: 1, // Default tenant
            targetColumn,
            expression: expression.replace('column_name', targetColumn),
            functionType: functionDef.category,
            status: 'active',
            sequenceNumber
          })
        });

        if (!response.ok) {
          throw new Error('Failed to create transformation');
        }

        const transformation = await response.json();
        console.log('Created transformation:', transformation);

        // Refresh transformations and clear transformed data
        await queryClient.invalidateQueries({ 
          queryKey: ["/api/transformations", dataset.id] 
        });
        setTransformedData([]);
      } catch (error) {
        console.error('Failed to create transformation:', error);
        alert('Failed to create transformation. Please try again.');
      }
    };

  // Handle transformation deletion
  const handleDeleteTransformation = async (transformationId: number) => {
    try {
      setIsApplyingTransforms(true);
      
      const response = await fetch(`/api/transformations/${transformationId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete transformation');
      }

      // Refresh transformations and clear transformed data to trigger re-calculation
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/transformations", dataset.id] 
      });
      setTransformedData([]);
      setIsApplyingTransforms(false);
    } catch (error) {
      console.error('Failed to delete transformation:', error);
      alert('Failed to delete transformation. Please try again.');
      setIsApplyingTransforms(false);
    }
  };

  // Handle transformation reordering
  const handleReorderTransformations = async (columnName: string, reorderedTransforms: Transformation[]) => {
    try {
      // Update sequence numbers
      const updates = reorderedTransforms.map((transform, index) => ({
        id: transform.id,
        sequenceNumber: index + 1
      }));

      // Send updates to server
      await Promise.all(updates.map(update =>
        fetch(`/api/transformations/${update.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ sequenceNumber: update.sequenceNumber })
        })
      ));

      // Refresh transformations
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/transformations", dataset.id] 
      });
      
      setTransformedData([]);
    } catch (error) {
      console.error('Failed to reorder transformations:', error);
    }
  };

  // Open transformation management popup
  const openTransformationsPopup = (columnName: string) => {
    setSelectedColumnForTransforms(columnName);
    setShowTransformationsPopup(true);
  };

  // Handle transformation reordering from flow view
  const handleTransformationReorder = async (reorderedTransformations: Transformation[]) => {
    try {
      // Update each transformation's sequence number in the backend
      await Promise.all(
        reorderedTransformations.map(transform =>
          fetch(`/api/transformations/${transform.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              sequenceNumber: transform.sequenceNumber
            })
          })
        )
      );

      // Refresh transformations
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/transformations", dataset.id] 
      });
      setTransformedData([]);
    } catch (error) {
      console.error('Failed to reorder transformations:', error);
    }
  };

  // Execute transformation flow
  const handleExecuteFlow = async () => {
    setIsApplyingTransforms(true);
    try {
      // Trigger transformation application
      setShowWithTransforms(true);
    } finally {
      setIsApplyingTransforms(false);
    }
  };

  // Fetch transformations for this dataset
  const { data: transformations = [] } = useQuery({
    queryKey: ["/api/transformations", dataset.id],
    queryFn: async () => {
      // First cleanup any duplicates
      await fetch('/api/transformations/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ datasetId: dataset.id })
      });
      
      // Then fetch clean transformations
      const response = await fetch(`/api/transformations?datasetId=${dataset.id}`, { 
        credentials: "include" 
      });
      if (!response.ok) throw new Error("Failed to fetch transformations");
      return response.json();
    },
  });

  // Fetch all datasets for the side panel
  const { data: allDatasets = [] } = useQuery({
    queryKey: ["/api/datasets"],
    queryFn: async () => {
      const response = await fetch('/api/datasets', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch datasets');
      return response.json();
    }
  });

  // Helper functions for transformations
  const hasTransformations = (columnName: string) => {
    return transformations.some((t: Transformation) => 
      t.targetColumn === columnName && (t.status === 'active' || t.status === 'applied')
    );
  };

  const getColumnTransformations = (columnName: string) => {
    return transformations.filter((t: Transformation) => 
      t.targetColumn === columnName && (t.status === 'active' || t.status === 'applied')
    );
  };

  // Comprehensive transformation engine
  const applyTransformationToValue = (expression: string, value: any, row: Record<string, any>): any => {
    try {
      const strValue = String(value || '');
      const numValue = parseFloat(value) || 0;

      // String Functions
      if (expression.includes('UPPERCASE(') || expression.includes('UPPER(')) {
        return strValue.toUpperCase();
      }
      if (expression.includes('LOWERCASE(') || expression.includes('LOWER(')) {
        return strValue.toLowerCase();
      }
      if (expression.includes('TRIM(')) {
        return strValue.trim();
      }
      if (expression.includes('CLEAN(')) {
        return strValue.replace(/[^\x20-\x7E]/g, '');
      }
      if (expression.includes('REVERSE(')) {
        return strValue.split('').reverse().join('');
      }
      if (expression.includes('LENGTH(')) {
        return strValue.length;
      }
      if (expression.includes('REMOVE_SPACES(')) {
        return strValue.replace(/\s/g, '');
      }

      // String functions with parameters
      if (expression.includes('LEFT(')) {
        const match = expression.match(/LEFT\([^,]+,\s*(\d+)\)/);
        if (match) {
          const length = parseInt(match[1]);
          return strValue.substring(0, length);
        }
      }
      if (expression.includes('RIGHT(')) {
        const match = expression.match(/RIGHT\([^,]+,\s*(\d+)\)/);
        if (match) {
          const length = parseInt(match[1]);
          return strValue.substring(strValue.length - length);
        }
      }
      if (expression.includes('SUBSTRING(')) {
        const match = expression.match(/SUBSTRING\([^,]+,\s*(\d+)(?:,\s*(\d+))?\)/);
        if (match) {
          const start = parseInt(match[1]);
          const length = match[2] ? parseInt(match[2]) : undefined;
          return length ? strValue.substring(start, start + length) : strValue.substring(start);
        }
      }
      if (expression.includes('REPLACE(')) {
        const match = expression.match(/REPLACE\([^,]+,\s*"([^"]*)",\s*"([^"]*)"\)/);
        if (match) {
          return strValue.replace(new RegExp(match[1], 'g'), match[2]);
        }
      }
      if (expression.includes('SPLIT(')) {
        const match = expression.match(/SPLIT\([^,]+,\s*"([^"]*)",\s*(\d+)\)/);
        if (match) {
          const delimiter = match[1];
          const index = parseInt(match[2]);
          const parts = strValue.split(delimiter);
          return parts[index] || '';
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
      if (expression.includes('CEIL(')) {
        return Math.ceil(numValue);
      }
      if (expression.includes('FLOOR(')) {
        return Math.floor(numValue);
      }
      if (expression.includes('SQRT(')) {
        return Math.sqrt(numValue);
      }
      if (expression.includes('ADD(')) {
        const match = expression.match(/ADD\([^,]+,\s*([+-]?\d*\.?\d+)\)/);
        if (match) {
          return numValue + parseFloat(match[1]);
        }
      }
      if (expression.includes('MULTIPLY(')) {
        const match = expression.match(/MULTIPLY\([^,]+,\s*([+-]?\d*\.?\d+)\)/);
        if (match) {
          return numValue * parseFloat(match[1]);
        }
      }
      if (expression.includes('DIVIDE(')) {
        const match = expression.match(/DIVIDE\([^,]+,\s*([+-]?\d*\.?\d+)\)/);
        if (match) {
          const divisor = parseFloat(match[1]);
          return divisor !== 0 ? numValue / divisor : 0;
        }
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
            if (format === 'DD/MM/YYYY') {
              return date.toLocaleDateString('en-GB');
            }
            if (format === 'YYYY') {
              return date.getFullYear().toString();
            }
            if (format === 'MM') {
              return (date.getMonth() + 1).toString().padStart(2, '0');
            }
            if (format === 'DD') {
              return date.getDate().toString().padStart(2, '0');
            }
          }
        }
        return strValue;
      }

      // Conditional Functions
      if (expression.includes('IF(')) {
        const match = expression.match(/IF\([^,]+,\s*"([^"]*)"(?:,\s*"([^"]*)")?\)/);
        if (match) {
          const trueValue = match[1];
          const falseValue = match[2] || '';
          
          if (strValue && strValue.trim() !== '' && strValue !== '0' && strValue.toLowerCase() !== 'false') {
            return trueValue;
          } else {
            return falseValue;
          }
        }
      }

      return value;
    } catch (error) {
      console.error('Transformation error:', error);
      return value;
    }
  };

  // Apply transformations to data
  useEffect(() => {
    if (!showWithTransforms || transformations.length === 0) {
      setTransformedData([]);
      return;
    }

    setIsApplyingTransforms(true);
    const activeTransforms = transformations.filter((t: Transformation) => 
      t.status === 'active' || t.status === 'applied'
    );

    if (activeTransforms.length === 0) {
      setTransformedData([]);
      setIsApplyingTransforms(false);
      return;
    }

    // Apply transformations to data
    const baseData = dataset.data || dataset.preview || [];
    const transformedRows = baseData.map((row: Record<string, any>) => {
      const newRow = { ...row };
      
      // Group transformations by column and sort by sequence number
      const transformsByColumn = activeTransforms.reduce((acc: Record<string, Transformation[]>, transform: Transformation) => {
        if (!acc[transform.targetColumn]) {
          acc[transform.targetColumn] = [];
        }
        acc[transform.targetColumn].push(transform);
        return acc;
      }, {} as Record<string, Transformation[]>);

      // Apply transformations column by column in sequence order
      Object.entries(transformsByColumn).forEach(([columnName, columnTransforms]) => {
        // Sort by sequence number
        const sortedTransforms = (columnTransforms as Transformation[]).sort((a: Transformation, b: Transformation) => 
          (a.sequenceNumber || 0) - (b.sequenceNumber || 0)
        );
        
        // Apply each transformation in sequence
        let currentValue = newRow[columnName];
        sortedTransforms.forEach((transform: Transformation) => {
          console.log('Applying transform:', {
            targetColumn: transform.targetColumn,
            expression: transform.expression,
            originalValue: currentValue,
            transformedValue: applyTransformationToValue(transform.expression, currentValue, newRow)
          });
          currentValue = applyTransformationToValue(transform.expression, currentValue, newRow);
        });
        
        newRow[columnName] = currentValue;
      });

      return newRow;
    });

    console.log('Transformed data sample:', transformedRows.slice(0, 2));
    setTransformedData(transformedRows);
    setIsApplyingTransforms(false);
  }, [transformations, dataset.data, showWithTransforms]);

  // Data processing with sorting and filtering
  const processedData = useMemo(() => {
    console.log('ProcessedData selection:', {
      showWithTransforms,
      transformedDataLength: transformedData.length,
      datasetDataLength: dataset.data?.length || 0,
      datasetPreviewLength: dataset.preview?.length || 0,
      usingTransformed: showWithTransforms && transformedData.length > 0
    });

    // Use dataset.data if available, otherwise fall back to preview
    const baseData = dataset.data || dataset.preview || [];
    const dataToUse = showWithTransforms && transformedData.length > 0 ? transformedData : baseData;
    
    // Apply column filters
    let filteredData = dataToUse.filter(row => {
      return Object.entries(columnFilters).every(([column, filter]) => {
        if (!filter) return true;
        const cellValue = String(row[column] || '').toLowerCase();
        return cellValue.includes(filter.toLowerCase());
      });
    });

    // Apply sorting
    if (sortColumn) {
      filteredData.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        // Handle numeric values
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        // Handle string values
        const aStr = String(aVal || '').toLowerCase();
        const bStr = String(bVal || '').toLowerCase();
        if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1;
        if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    const finalData = filteredData.slice(0, maxRows);
    console.log('Final processed data:', {
      finalDataLength: finalData.length,
      filteredDataLength: filteredData.length,
      maxRows,
      hasFilters: Object.keys(columnFilters).length > 0,
      sampleRow: finalData[0]
    });
    return finalData;
  }, [dataset.data, transformedData, showWithTransforms, columnFilters, sortColumn, sortDirection, maxRows]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleFilterChange = (column: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  const getDataTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'string':
      case 'text':
        return <Type className="h-3 w-3" />;
      case 'number':
      case 'integer':
      case 'float':
        return <Hash className="h-3 w-3" />;
      case 'date':
      case 'datetime':
        return <Calendar className="h-3 w-3" />;
      case 'boolean':
        return <ToggleLeft className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  const getDataTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'string':
      case 'text':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
      case 'number':
      case 'integer':
      case 'float':
        return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300';
      case 'date':
      case 'datetime':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300';
      case 'boolean':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800/20 dark:text-gray-300';
    }
  };

  return (
    <div className="flex w-full h-full relative">
      {/* Main Content */}
      <div className="flex-1">
        <Card className="w-full h-full">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-lg font-semibold">Data Preview</span>
                {showWithTransforms && (
                  <Badge variant="secondary" className="text-xs">
                    {transformedData.length > 0 ? 'With Transforms' : 'Applying Transforms...'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-4">
                {/* View Mode Toggle */}
                {transformations.length > 0 && (
                  <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('table')}
                      className="h-8 px-3 text-xs"
                    >
                      Table View
                    </Button>
                    <Button
                      variant={viewMode === 'flow' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('flow')}
                      className="h-8 px-3 text-xs"
                    >
                      Flow View
                    </Button>
                  </div>
                )}
                {transformations.length > 0 && viewMode === 'table' && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="show-transforms"
                      checked={showWithTransforms}
                      onCheckedChange={(checked) => {
                        console.log('Switch toggled:', checked);
                        setShowWithTransforms(checked);
                      }}
                      disabled={isApplyingTransforms}
                    />
                    <Label htmlFor="show-transforms" className="text-sm font-medium">
                      Show with Transforms
                    </Label>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSidePanel(!showSidePanel)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title={showSidePanel ? "Hide side panel" : "Show side panel"}
                >
                  {showSidePanel ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </Button>
                {onClose && (
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-gray-100">{dataset.filename}</span>
                <span>•</span>
                <span>{dataset.totalRows.toLocaleString()} rows</span>
                <span>•</span>
                <span>{dataset.columns.length} columns</span>
                {showWithTransforms && transformations.some((t: Transformation) => t.status === 'active' || t.status === 'applied') && (
                  <>
                    <span>•</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {transformations.filter((t: Transformation) => t.status === 'active' || t.status === 'applied').length} active transforms
                    </span>
                  </>
                )}
              </div>
              
              {/* Action buttons after view toggle */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <FunctionMenu
                    onFunctionSelect={handleFunctionSelect()}
                    triggerClassName="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    datasetData={dataset.data}
                  />
                </div>
              </div>
            </div>

            {viewMode === 'flow' ? (
              <TransformationFlow
                dataset={dataset}
                transformations={transformations}
                onTransformationReorder={handleTransformationReorder}
                onTransformationDelete={handleDeleteTransformation}
                onExecuteFlow={handleExecuteFlow}
                sampleData={processedData.slice(0, 5)}
                allDatasets={[]}
                onDatasetChange={() => {}}
              />
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full table-fixed">
                    <thead>
                      <tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                        {dataset.columns.map((column) => {
                          const isTransformed = showWithTransforms && hasTransformations(column.name);
                          const columnTransforms = getColumnTransformations(column.name);
                        
                        return (
                          <th
                            key={column.name}
                            className={`text-left p-2 min-w-[120px] transition-all duration-200 ${
                              isTransformed 
                                ? 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border-2 border-amber-300 dark:border-amber-600 shadow-sm' 
                                : 'bg-gray-50 dark:bg-gray-800/50'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => handleSort(column.name)}
                                    className="flex items-center space-x-1 text-xs font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                    style={{ fontSize: '11px' }}
                                  >
                                    <span className="truncate max-w-[60px]" title={column.name}>
                                      {column.name}
                                    </span>
                                    {isTransformed && (
                                      <div className="flex items-center space-x-1">
                                        <Sparkles 
                                          className="h-3 w-3 text-amber-500 animate-pulse" 
                                          data-tooltip={`${columnTransforms.length} transformation${columnTransforms.length > 1 ? 's' : ''} applied`}
                                        />
                                        {columnTransforms.length > 1 && (
                                          <Badge variant="secondary" className="text-xs px-1 py-0 h-4 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                            {columnTransforms.length}
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                    {sortColumn === column.name ? (
                                      sortDirection === 'asc' ? (
                                        <ArrowUp className="h-3 w-3" />
                                      ) : (
                                        <ArrowDown className="h-3 w-3" />
                                      )
                                    ) : (
                                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                                    )}
                                  </button>

                                </div>

                              </div>
                              <div className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-xs font-medium ${getDataTypeColor(column.type)}`}>
                                {getDataTypeIcon(column.type)}
                                <span style={{ fontSize: '9px' }}>{(column.type || '').toUpperCase()}</span>
                              </div>
                              <div className="relative">
                                <Search className="absolute left-1.5 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
                                <Input
                                  placeholder="Filter..."
                                  value={columnFilters[column.name] || ''}
                                  onChange={(e) => handleFilterChange(column.name, e.target.value)}
                                  className="h-6 pl-6 text-xs border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                                  style={{ fontSize: '10px' }}
                                />
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {processedData.map((row, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        {dataset.columns.map((column) => {
                          const isTransformed = showWithTransforms && hasTransformations(column.name);
                          return (
                            <td 
                              key={column.name} 
                              className={`p-2 text-xs transition-all duration-200 ${
                                isTransformed 
                                  ? 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border-l-2 border-r-2 border-amber-300 dark:border-amber-600' 
                                  : ''
                              }`}
                            >
                              <CellAnnotation
                                datasetId={dataset.id}
                                rowIndex={index}
                                columnName={column.name}
                                cellValue={String(row[column.name] || '')}
                              >
                                <div className="max-w-[120px] truncate" title={String(row[column.name] || '')}>
                                  {String(row[column.name] || '')}
                                </div>
                              </CellAnnotation>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {processedData.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No data matches your current filters.
              </div>
            )}

            {processedData.length > 0 && processedData.length === maxRows && (
              <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                Showing first {maxRows} rows of {dataset.totalRows.toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Side Panel */}
      <div className={`fixed top-0 right-0 h-full w-[640px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl transform transition-transform duration-300 z-50 ${
        showSidePanel ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Data Tools</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSidePanel(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Active Transformations Section */}
            <Collapsible open={activeTransformsExpanded} onOpenChange={setActiveTransformsExpanded}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  <span className="text-xs font-medium text-gray-900 dark:text-gray-100">Active Transformations</span>
                  <Badge variant="secondary" className="text-xs">
                    {transformations.filter((t: Transformation) => t.status === 'active' || t.status === 'applied').length}
                  </Badge>
                </div>
                {activeTransformsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {transformations
                  .filter((t: Transformation) => t.status === 'active' || t.status === 'applied')
                  .map((transformation: Transformation) => (
                    <div key={transformation.id} className="flex items-center justify-between p-1.5 bg-gray-50 dark:bg-gray-800 rounded border text-xs">
                      <div className="flex items-center space-x-1 flex-1 min-w-0">
                        <Badge variant="outline" className="text-xs px-1 py-0.5 shrink-0">
                          {transformation.targetColumn}
                        </Badge>
                        <span className="text-gray-600 dark:text-gray-300 font-mono text-xs truncate">
                          {transformation.expression}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openTransformationsPopup(transformation.targetColumn)}
                          className="h-5 w-5 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/20"
                          title="Manage transformations"
                        >
                          <Settings className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTransformation(transformation.id)}
                          className="h-5 w-5 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Remove transformation"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                {transformations.filter((t: Transformation) => t.status === 'active' || t.status === 'applied').length === 0 && (
                  <div className="text-center py-3 text-gray-500 dark:text-gray-400 text-xs">
                    No active transformations
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* All Datasets Section */}
            <Collapsible open={datasetsExpanded} onOpenChange={setDatasetsExpanded}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  <FileText className="h-3 w-3 text-blue-500" />
                  <span className="text-xs font-medium text-gray-900 dark:text-gray-100">All Datasets</span>
                  <Badge variant="secondary" className="text-xs">
                    {allDatasets.length}
                  </Badge>
                </div>
                {datasetsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {allDatasets.map((ds: Dataset) => (
                  <div 
                    key={ds.id} 
                    onClick={() => {
                      if (ds.id !== dataset.id && onDatasetChange) {
                        onDatasetChange(ds.id);
                      }
                    }}
                    className={`p-1.5 rounded border text-xs cursor-pointer transition-colors ${
                      ds.id === dataset.id 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
                      {ds.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {ds.totalRows.toLocaleString()} rows • {ds.columns.length} cols
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </div>

      {/* Transformation Management Popup */}
      <Dialog open={showTransformationsPopup} onOpenChange={setShowTransformationsPopup}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Manage Transformations for "{selectedColumnForTransforms}"
            </DialogTitle>
          </DialogHeader>
          
          {selectedColumnForTransforms && (
            <TransformationManager
              columnName={selectedColumnForTransforms}
              transformations={transformations.filter((t: Transformation) => 
                t.targetColumn === selectedColumnForTransforms && 
                (t.status === 'active' || t.status === 'applied')
              )}
              onReorder={handleReorderTransformations}
              onDelete={handleDeleteTransformation}
              datasetData={dataset.data}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Transformation Manager Component with Drag and Drop
function TransformationManager({ 
  columnName, 
  transformations, 
  onReorder, 
  onDelete,
  datasetData
}: {
  columnName: string;
  transformations: Transformation[];
  onReorder: (columnName: string, reorderedTransforms: Transformation[]) => void;
  onDelete: (id: number) => void;
  datasetData: Record<string, any>[];
}) {
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [draggedOverItem, setDraggedOverItem] = useState<number | null>(null);

  const sortedTransformations = [...transformations].sort((a, b) => 
    (a.sequenceNumber || 0) - (b.sequenceNumber || 0)
  );

  // Use the actual dataset data passed from parent component
  const sampleValue = datasetData?.[0]?.[columnName] || 'Sample Value';

  // Apply transformations step by step to show progression
  const getTransformationSteps = () => {
    let currentValue = sampleValue;
    const steps = [{ step: 0, value: currentValue, label: 'Original Value' }];

    sortedTransformations.forEach((transform, index) => {
      currentValue = applyTransformationToValue(transform.expression, currentValue, datasetData?.[0] || {});
      steps.push({
        step: index + 1,
        value: currentValue,
        label: transform.expression
      });
    });

    return steps;
  };

  // Helper function to apply transformation (simplified version)
  const applyTransformationToValue = (expression: string, value: any, row: Record<string, any>): any => {
    try {
      const strValue = String(value || '');
      const numValue = parseFloat(value) || 0;

      // String Functions
      if (expression.includes('UPPERCASE(') || expression.includes('UPPER(')) {
        return strValue.toUpperCase();
      }
      if (expression.includes('LOWERCASE(') || expression.includes('LOWER(')) {
        return strValue.toLowerCase();
      }
      if (expression.includes('TRIM(')) {
        return strValue.trim();
      }
      if (expression.includes('CLEAN(')) {
        return strValue.replace(/[^\x20-\x7E]/g, '');
      }
      if (expression.includes('REVERSE(')) {
        return strValue.split('').reverse().join('');
      }
      if (expression.includes('LENGTH(')) {
        return strValue.length;
      }

      // String functions with parameters
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
        const match = expression.match(/IF\([^,]+,\s*"([^"]*)"(?:,\s*"([^"]*)")?\)/);
        if (match) {
          const trueValue = match[1];
          const falseValue = match[2] || '';
          
          if (strValue && strValue.trim() !== '' && strValue !== '0' && strValue.toLowerCase() !== 'false') {
            return trueValue;
          } else {
            return falseValue;
          }
        }
      }

      return value;
    } catch (error) {
      return value;
    }
  };

  const transformationSteps = getTransformationSteps();

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDraggedOverItem(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedItem === null) return;
    
    const reorderedTransforms = [...sortedTransformations];
    const draggedTransform = reorderedTransforms[draggedItem];
    
    // Remove the dragged item and insert it at the new position
    reorderedTransforms.splice(draggedItem, 1);
    reorderedTransforms.splice(dropIndex, 0, draggedTransform);
    
    onReorder(columnName, reorderedTransforms);
    setDraggedItem(null);
    setDraggedOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggedOverItem(null);
  };

  return (
    <div className="space-y-6">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Drag and drop to reorder transformations. They will be applied in sequence from top to bottom.
      </div>

      {/* Transformation Preview */}
      {sortedTransformations.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">Value Transformation Preview</h4>
          <div className="space-y-2">
            {transformationSteps.map((step, index) => (
              <div key={index} className="flex items-center space-x-3">
                <Badge variant={step.step === 0 ? "outline" : "default"} className="text-xs min-w-[60px] justify-center">
                  {step.step === 0 ? 'Start' : `Step ${step.step}`}
                </Badge>
                <div className="flex-1 font-mono text-sm bg-white dark:bg-gray-800 px-2 py-1 rounded border">
                  "{step.value}"
                </div>
                {step.step > 0 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                    {step.label.split('(')[0]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="space-y-2">
        {sortedTransformations.map((transform, index) => (
          <div
            key={transform.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center justify-between p-3 border rounded-lg bg-white dark:bg-gray-800 cursor-move transition-all ${
              draggedItem === index ? 'opacity-50 scale-95' : ''
            } ${
              draggedOverItem === index ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-center space-x-3 flex-1">
              <GripVertical className="h-4 w-4 text-gray-400" />
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs">
                  #{transform.sequenceNumber || index + 1}
                </Badge>
                <span className="font-mono text-sm">
                  {transform.expression}
                </span>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(transform.id)}
              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              title="Remove transformation"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      
      {sortedTransformations.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No transformations applied to this column
        </div>
      )}
    </div>
  );
}