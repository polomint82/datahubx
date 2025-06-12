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
import { X, Wand2, ArrowUpDown, ArrowUp, ArrowDown, Search, Type, Hash, Calendar, ToggleLeft, FileText, Menu, Sparkles, Trash2, Settings, GripVertical, ChevronDown, ChevronRight, PanelRightOpen, PanelRightClose } from "lucide-react";
import type { Dataset, Transformation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { FunctionMenu } from "./function-menu";

interface DataPreviewProps {
  dataset: Dataset;
  onClose?: () => void;
  maxRows?: number;
}

export function DataPreview({ dataset, onClose, maxRows = 50 }: DataPreviewProps) {
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

  // Handle function selection from menu for a specific column
  const handleFunctionSelect = (columnName?: string) => 
    async (functionDef: any, parameters: Record<string, any>) => {
      // Build expression from function and parameters
      let expression = functionDef.name;
      
      if (functionDef.parameters.length > 0) {
        const paramValues = functionDef.parameters.map((param: any) => {
          const value = parameters[param.name] || param.defaultValue;
          if (param.type === 'string') {
            return `"${value}"`;
          }
          return value;
        });
        expression = `${functionDef.name}(column_name${paramValues.length > 0 ? ', ' + paramValues.join(', ') : ''})`;
      } else {
        expression = `${functionDef.name}(column_name)`;
      }

      try {
        // Use the specific column or fall back to first column
        const targetColumn = columnName || dataset.columns[0]?.name || 'column_name';
        
        // Check for duplicate function on same column
        const existingTransforms = transformations.filter((t: Transformation) => 
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
        const maxSequence = Math.max(0, ...existingTransforms.map(t => t.sequenceNumber || 0));
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

        // Invalidate and refetch transformations
        await queryClient.invalidateQueries({ 
          queryKey: ["/api/transformations", dataset.id] 
        });
        
        // Reset transformed data to force re-application
        setTransformedData([]);
        setIsApplyingTransforms(false);
      } catch (error) {
        console.error('Failed to create transformation:', error);
      }
    };

  // Handle transformation deletion
  const handleDeleteTransformation = async (transformationId: number) => {
    try {
      const response = await fetch(`/api/transformations/${transformationId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete transformation');
      }

      // Invalidate and refetch transformations
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/transformations", dataset.id] 
      });
      
      // Reset transformed data to force re-application
      setTransformedData([]);
      setIsApplyingTransforms(false);
    } catch (error) {
      console.error('Failed to delete transformation:', error);
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

  // Fetch transformations for this dataset
  const { data: transformations = [] } = useQuery({
    queryKey: ["/api/transformations", dataset.id],
    queryFn: async () => {
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

  // Comprehensive transformation engine
  const applyTransformationToValue = (expression: string, value: any, row: Record<string, any>): any => {
    try {
      const strValue = String(value || '');
      const numValue = parseFloat(value) || 0;

      // String Functions
      if (expression.includes('LOWERCASE(') || expression.includes('LOWER(')) {
        return strValue.toLowerCase();
      }
      if (expression.includes('UPPERCASE(') || expression.includes('UPPER(')) {
        return strValue.toUpperCase();
      }
      if (expression.includes('CAPITALIZE(')) {
        return strValue.replace(/\b\w/g, l => l.toUpperCase());
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

      // Math Functions
      if (expression.includes('ADD(')) {
        const match = expression.match(/ADD\([^,]+,\s*([+-]?\d*\.?\d+)\)/);
        if (match) {
          return numValue + parseFloat(match[1]);
        }
      }
      if (expression.includes('SUBTRACT(')) {
        const match = expression.match(/SUBTRACT\([^,]+,\s*([+-]?\d*\.?\d+)\)/);
        if (match) {
          return numValue - parseFloat(match[1]);
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
      if (expression.includes('ABS(')) {
        return Math.abs(numValue);
      }

      // Utility Functions
      if (expression.includes('IF(')) {
        // Handle IF function: IF(column, "trueValue", "falseValue") or IF(column, condition, "trueValue", "falseValue")
        const match = expression.match(/IF\([^,]+(?:,\s*"[^"]*")?,\s*"([^"]*)",\s*"([^"]*)"\)/);
        if (match) {
          const trueValue = match[1];
          const falseValue = match[2];
          
          // Check if value exists and is not empty
          if (value && String(value).trim() !== '' && value !== null && value !== undefined) {
            return trueValue;
          } else {
            return falseValue;
          }
        }
      }
      if (expression.includes('COALESCE(')) {
        const match = expression.match(/COALESCE\([^,]+,\s*"([^"]*)"\)/);
        if (match) {
          return (value == null || value === '') ? match[1] : value;
        }
      }
      if (expression.includes('IF_EMPTY(')) {
        const match = expression.match(/IF_EMPTY\([^,]+,\s*"([^"]*)"\)/);
        if (match) {
          return (strValue === '') ? match[1] : value;
        }
      }
      if (expression.includes('DUPLICATE(')) {
        return value;
      }

      // Handle CONCAT function with multiple parameters
      if (expression.includes('CONCAT(')) {
        const match = expression.match(/CONCAT\(([^)]+)\)/);
        if (match) {
          const params = match[1].split(',').map(p => p.trim());
          const values = params.map(param => {
            if (param.startsWith('"') && param.endsWith('"')) {
              return param.slice(1, -1);
            }
            return param === 'column_name' ? strValue : param;
          });
          return values.join('');
        }
      }

      // If no specific function matches, return original value
      return value;
    } catch (error) {
      console.error('Error applying transformation:', error);
      return value;
    }
  };

  // Apply transformations to dataset
  useEffect(() => {
    console.log('Transformation effect triggered:', {
      showWithTransforms,
      transformationsCount: transformations.length,
      transformations: transformations.map((t: Transformation) => ({ id: t.id, status: t.status, targetColumn: t.targetColumn, expression: t.expression }))
    });

    if (showWithTransforms && transformations.length > 0) {
      setIsApplyingTransforms(true);
      
      try {
        const activeTransforms = transformations.filter((t: Transformation) => 
          (t.status === 'active' || t.status === 'applied') && t.targetColumn
        );
        
        console.log('Active transforms:', activeTransforms.length);
        
        const transformed = dataset.data.map(row => {
          const newRow = { ...row };
          
          activeTransforms.forEach((transform: Transformation) => {
            const originalValue = row[transform.targetColumn!];
            const transformedValue = applyTransformationToValue(
              transform.expression, 
              originalValue, 
              row
            );
            
            console.log('Applying transform:', {
              targetColumn: transform.targetColumn,
              expression: transform.expression,
              originalValue,
              transformedValue
            });
            
            newRow[transform.targetColumn!] = transformedValue;
          });
          
          return newRow;
        });
        
        console.log('Transformed data sample:', transformed.slice(0, 2));
        setTransformedData(transformed);
      } catch (error) {
        console.error('Error applying transformations:', error);
        setTransformedData([]);
      } finally {
        setIsApplyingTransforms(false);
      }
    } else {
      console.log('Not applying transforms - showWithTransforms:', showWithTransforms, 'transformations:', transformations.length);
      setTransformedData([]);
      setIsApplyingTransforms(false);
    }
  }, [showWithTransforms, transformations, dataset.data]);

  // Handle sorting
  const handleSort = (columnName: string) => {
    if (sortColumn === columnName) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnName);
      setSortDirection('asc');
    }
  };

  // Handle column filtering
  const handleFilterChange = (columnName: string, value: string) => {
    setColumnFilters(prev => ({
      ...prev,
      [columnName]: value
    }));
  };

  // Process data with sorting and filtering
  const processedData = useMemo(() => {
    let data = showWithTransforms && transformedData.length > 0 
      ? transformedData 
      : dataset.data;
    
    console.log('ProcessedData selection:', {
      showWithTransforms,
      transformedDataLength: transformedData.length,
      datasetDataLength: dataset.data.length,
      usingTransformed: showWithTransforms && transformedData.length > 0
    });

    // Apply filters
    if (Object.keys(columnFilters).length > 0) {
      data = data.filter(row => {
        return Object.entries(columnFilters).every(([column, filterValue]) => {
          if (!filterValue) return true;
          const cellValue = String(row[column] || '').toLowerCase();
          return cellValue.includes(filterValue.toLowerCase());
        });
      });
    }

    // Apply sorting
    if (sortColumn) {
      data = [...data].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        // Handle null/undefined values
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
        if (bVal == null) return sortDirection === 'asc' ? -1 : 1;
        
        // Convert to strings for comparison
        const aStr = String(aVal);
        const bStr = String(bVal);
        
        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr, undefined, { numeric: true, sensitivity: 'base' });
        } else {
          return bStr.localeCompare(aStr, undefined, { numeric: true, sensitivity: 'base' });
        }
      });
    }

    return data.slice(0, maxRows);
  }, [dataset.data, transformedData, showWithTransforms, sortColumn, sortDirection, columnFilters, maxRows]);

  const getDataTypeIcon = (dataType: string) => {
    switch ((dataType || '').toLowerCase()) {
      case 'string':
      case 'text':
        return <Type className="h-3 w-3" />;
      case 'number':
      case 'integer':
      case 'float':
      case 'decimal':
        return <Hash className="h-3 w-3" />;
      case 'date':
      case 'datetime':
      case 'timestamp':
        return <Calendar className="h-3 w-3" />;
      case 'boolean':
        return <ToggleLeft className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  // Check if a column has transformations
  const getColumnTransformations = (columnName: string) => {
    return transformations.filter((t: Transformation) => 
      t.targetColumn === columnName && (t.status === 'active' || t.status === 'applied')
    );
  };

  const hasTransformations = (columnName: string) => {
    return getColumnTransformations(columnName).length > 0;
  };

  const getDataTypeColor = (dataType: string) => {
    switch ((dataType || '').toLowerCase()) {
      case 'string':
      case 'text':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
      case 'number':
      case 'integer':
      case 'float':
      case 'decimal':
        return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300';
      case 'date':
      case 'datetime':
      case 'timestamp':
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
      <div className={`flex-1 transition-all duration-300 ${showSidePanel ? 'mr-80' : 'mr-0'}`}>
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
                <FunctionMenu
                  onFunctionSelect={handleFunctionSelect()}
                  triggerClassName="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  datasetData={dataset.data}
                />
                {transformations.length > 0 && (
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
        </div>

        {/* Active Transformations List */}
        {transformations.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Active Transformations</h4>
              <Badge variant="secondary" className="text-xs">
                {transformations.filter((t: Transformation) => t.status === 'active' || t.status === 'applied').length} applied
              </Badge>
            </div>
            <div className="space-y-2">
              {transformations
                .filter((t: Transformation) => t.status === 'active' || t.status === 'applied')
                .map((transformation: Transformation) => (
                  <div key={transformation.id} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border text-xs">
                    <div className="flex items-center space-x-2 flex-1">
                      <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                        {transformation.targetColumn}
                      </Badge>
                      <span className="text-gray-600 dark:text-gray-300 font-mono text-xs truncate">
                        {transformation.expression}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteTransformation(transformation.id)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Remove transformation"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
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
                            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700' 
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
                              {columnTransforms.length > 1 && (
                                <button
                                  onClick={() => openTransformationsPopup(column.name)}
                                  className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/20 rounded text-amber-600 dark:text-amber-400"
                                  title={`Manage ${columnTransforms.length} transformations`}
                                >
                                  <Settings className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <FunctionMenu
                              onFunctionSelect={handleFunctionSelect(column.name)}
                              triggerClassName="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              triggerIcon={<Menu className="h-3 w-3 text-gray-500 hover:text-blue-600" />}
                              columnName={column.name}
                              datasetData={dataset.data}
                            />
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
                  <tr
                    key={index}
                    className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    {dataset.columns.map((column) => {
                      const isTransformed = showWithTransforms && hasTransformations(column.name);
                      
                      return (
                        <td
                          key={column.name}
                          className={`p-2 text-sm transition-all duration-200 ${
                            isTransformed 
                              ? 'bg-amber-50/50 dark:bg-amber-900/10 text-amber-900 dark:text-amber-100 border-l-2 border-amber-400' 
                              : 'text-gray-900 dark:text-gray-100'
                          }`}
                          style={{ fontSize: '10px' }}
                        >
                          <div className="truncate max-w-[120px]" title={String(row[column.name] || '')}>
                            {row[column.name] !== null && row[column.name] !== undefined 
                              ? String(row[column.name]) 
                              : '—'
                            }
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
      <div className={`fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-lg transform transition-transform duration-300 z-50 ${
        showSidePanel ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Data Tools</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSidePanel(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Active Transformations Section */}
            <Collapsible open={activeTransformsExpanded} onOpenChange={setActiveTransformsExpanded}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">Active Transformations</span>
                  <Badge variant="secondary" className="text-xs">
                    {transformations.filter((t: Transformation) => t.status === 'active' || t.status === 'applied').length}
                  </Badge>
                </div>
                {activeTransformsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {transformations
                  .filter((t: Transformation) => t.status === 'active' || t.status === 'applied')
                  .map((transformation: Transformation) => (
                    <div key={transformation.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded border text-xs">
                      <div className="flex items-center space-x-2 flex-1">
                        <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                          {transformation.targetColumn}
                        </Badge>
                        <span className="text-gray-600 dark:text-gray-300 font-mono text-xs truncate">
                          {transformation.expression}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTransformation(transformation.id)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Remove transformation"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                {transformations.filter((t: Transformation) => t.status === 'active' || t.status === 'applied').length === 0 && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                    No active transformations
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* All Datasets Section */}
            <Collapsible open={datasetsExpanded} onOpenChange={setDatasetsExpanded}>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-gray-900 dark:text-gray-100">All Datasets</span>
                  <Badge variant="secondary" className="text-xs">
                    {allDatasets.length}
                  </Badge>
                </div>
                {datasetsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {allDatasets.map((ds: Dataset) => (
                  <div key={ds.id} className={`p-2 rounded border text-xs cursor-pointer transition-colors ${
                    ds.id === dataset.id 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}>
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {ds.name}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400 mt-1">
                      {ds.totalRows.toLocaleString()} rows • {ds.columns.length} columns
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
  onDelete 
}: {
  columnName: string;
  transformations: Transformation[];
  onReorder: (columnName: string, reorderedTransforms: Transformation[]) => void;
  onDelete: (id: number) => void;
}) {
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [draggedOverItem, setDraggedOverItem] = useState<number | null>(null);

  const sortedTransformations = [...transformations].sort((a, b) => 
    (a.sequenceNumber || 0) - (b.sequenceNumber || 0)
  );

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
    <div className="space-y-4">
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Drag and drop to reorder transformations. They will be applied in sequence from top to bottom.
      </div>
      
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
            <div className="flex items-center space-x-3">
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