import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Eye, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TRANSFORMATION_FUNCTIONS } from "@/lib/transformations";
import type { TransformationPreviewRequest, ApplyTransformationRequest } from "@shared/schema";

interface TransformationBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransformationBuilder({ open, onOpenChange }: TransformationBuilderProps) {
  const [selectedDataset, setSelectedDataset] = useState<number | null>(null);
  const [targetColumn, setTargetColumn] = useState("");
  const [expression, setExpression] = useState("");
  const [transformationName, setTransformationName] = useState("");
  const [preview, setPreview] = useState<Array<{before: string, after: string}>>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [filteredColumns, setFilteredColumns] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: datasets = [] } = useQuery({
    queryKey: ["/api/datasets"],
  });

  const selectedDatasetData = (datasets as any[])?.find((d: any) => d.id === selectedDataset);

  const previewMutation = useMutation({
    mutationFn: async (data: TransformationPreviewRequest) => {
      const response = await apiRequest("POST", "/api/transformations/preview", data);
      return response.json();
    },
    onSuccess: (data) => {
      setPreview(data.preview);
    },
    onError: (error: any) => {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to preview transformation",
        variant: "destructive",
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (data: ApplyTransformationRequest) => {
      const response = await apiRequest("POST", "/api/transformations", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transformation Applied",
        description: "Your transformation has been successfully applied.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/transformations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Apply Failed",
        description: error.message || "Failed to apply transformation",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedDataset(null);
    setTargetColumn("");
    setExpression("");
    setTransformationName("");
    setPreview([]);
  };

  const handlePreview = () => {
    if (!selectedDataset || !targetColumn || !expression) {
      toast({
        title: "Missing Fields",
        description: "Please select a dataset, target column, and expression",
        variant: "destructive",
      });
      return;
    }

    previewMutation.mutate({
      datasetId: selectedDataset,
      targetColumn,
      expression,
    });
  };

  const handleApply = () => {
    if (!selectedDataset || !targetColumn || !expression || !transformationName) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    applyMutation.mutate({
      name: transformationName,
      datasetId: selectedDataset,
      targetColumn,
      expression,
    });
  };

  const addFunctionToExpression = (functionName: string) => {
    const func = TRANSFORMATION_FUNCTIONS.find(f => f.name === functionName);
    if (func && targetColumn) {
      // Replace column_name placeholder with the selected target column
      const template = func.template.replace(/column_name/g, targetColumn);
      setExpression(template);
    } else if (func) {
      // If no target column selected, show template as-is
      setExpression(func.template);
    }
  };

  // Autocomplete logic
  const getColumnNames = () => {
    return selectedDatasetData?.columns?.map((col: any) => col.name) || [];
  };

  const handleExpressionChange = (value: string) => {
    setExpression(value);
    
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    
    // Look for partial column name being typed
    const columnNameMatch = textBeforeCursor.match(/(\w+)$/);
    
    if (columnNameMatch && selectedDatasetData?.columns) {
      const partialName = columnNameMatch[1].toLowerCase();
      const columnNames = getColumnNames();
      const filtered = columnNames.filter((name: string) => 
        name.toLowerCase().includes(partialName) && name.toLowerCase() !== partialName.toLowerCase()
      );
      
      if (filtered.length > 0 && partialName.length > 0) {
        setFilteredColumns(filtered);
        setSelectedSuggestion(0);
        setShowAutocomplete(true);
        
        // Calculate position for autocomplete dropdown
        const rect = textarea.getBoundingClientRect();
        const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
        const lines = textBeforeCursor.split('\n').length;
        
        setAutocompletePosition({
          top: rect.top + (lines * lineHeight) + 30,
          left: rect.left + 10
        });
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showAutocomplete) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestion(prev => 
        prev < filteredColumns.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestion(prev => 
        prev > 0 ? prev - 1 : filteredColumns.length - 1
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertColumnName(filteredColumns[selectedSuggestion]);
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
    }
  };

  const insertColumnName = (columnName: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = expression.substring(0, cursorPosition);
    const textAfterCursor = expression.substring(cursorPosition);
    
    // Find the partial word to replace
    const match = textBeforeCursor.match(/(\w+)$/);
    if (match) {
      const partialWord = match[1];
      const newTextBefore = textBeforeCursor.substring(0, textBeforeCursor.length - partialWord.length);
      const newExpression = newTextBefore + columnName + textAfterCursor;
      
      setExpression(newExpression);
      setShowAutocomplete(false);
      
      // Set cursor position after inserted column name
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = newTextBefore.length + columnName.length;
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowAutocomplete(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transformation Builder</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-12 gap-6 min-h-[400px]">
          {/* Function Library */}
          <div className="col-span-3 border-r border-gray-200 dark:border-gray-700 pr-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Function Library</h4>
            <div className="space-y-3">
              {Object.entries(
                TRANSFORMATION_FUNCTIONS.reduce((acc, func) => {
                  if (!acc[func.category]) acc[func.category] = [];
                  acc[func.category].push(func);
                  return acc;
                }, {} as Record<string, typeof TRANSFORMATION_FUNCTIONS>)
              ).map(([category, functions]) => (
                <div key={category}>
                  <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                    {category} Functions
                  </h5>
                  <div className="space-y-1">
                    {functions.map((func) => (
                      <Button
                        key={func.name}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left h-auto p-2"
                        onClick={() => addFunctionToExpression(func.name)}
                      >
                        <div>
                          <div className="font-mono text-xs">{func.name}()</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{func.description}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transformation Builder */}
          <div className="col-span-5 px-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Build Transformation</h4>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="dataset-select">Dataset</Label>
                <Select value={selectedDataset?.toString() || ""} onValueChange={(value) => setSelectedDataset(parseInt(value))}>
                  <SelectTrigger id="dataset-select" className="mt-1">
                    <SelectValue placeholder="Select dataset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(datasets as any[])?.map((dataset: any) => (
                      <SelectItem key={dataset.id} value={dataset.id.toString()}>
                        {dataset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="target-column">Target Column</Label>
                <Select value={targetColumn} onValueChange={setTargetColumn} disabled={!selectedDatasetData}>
                  <SelectTrigger id="target-column" className="mt-1">
                    <SelectValue placeholder="Select column..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedDatasetData?.columns?.map((column: any) => (
                      <SelectItem key={column.name} value={column.name}>
                        <div className="flex items-center gap-2">
                          <span>{column.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {column.type}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="transformation-name">Transformation Name</Label>
                <Input
                  id="transformation-name"
                  type="text"
                  placeholder="Uppercase Names"
                  value={transformationName}
                  onChange={(e) => setTransformationName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="relative">
                <Label htmlFor="transformation">Expression</Label>
                <Textarea
                  ref={textareaRef}
                  id="transformation"
                  rows={4}
                  placeholder="CONCAT(First Name, ' ', Last Name) - Start typing column names for autocomplete"
                  value={expression}
                  onChange={(e) => handleExpressionChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="mt-1 font-mono"
                />
                
                {/* Autocomplete Dropdown */}
                {showAutocomplete && (
                  <div 
                    className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto"
                    style={{ 
                      top: autocompletePosition.top,
                      left: autocompletePosition.left,
                      minWidth: '200px'
                    }}
                  >
                    {filteredColumns.map((columnName, index) => (
                      <div
                        key={columnName}
                        className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          index === selectedSuggestion 
                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100' 
                            : 'text-gray-900 dark:text-gray-100'
                        }`}
                        onClick={() => insertColumnName(columnName)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono">{columnName}</span>
                          <Badge variant="secondary" className="text-xs ml-2">
                            {selectedDatasetData?.columns?.find((col: any) => col.name === columnName)?.type}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handlePreview}
                  disabled={previewMutation.isPending}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {previewMutation.isPending ? "Previewing..." : "Preview"}
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleApply}
                  disabled={applyMutation.isPending || preview.length === 0}
                >
                  <Check className="mr-2 h-4 w-4" />
                  {applyMutation.isPending ? "Applying..." : "Apply"}
                </Button>
              </div>
            </div>
          </div>

          {/* Preview Results */}
          <div className="col-span-4 pl-4 border-l border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Preview Results</h4>
            
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 h-full overflow-auto">
              {preview.length > 0 ? (
                <>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-medium">Before → After</div>
                  <div className="space-y-3">
                    {preview.map((result, idx) => (
                      <div key={idx} className="border-b border-gray-200 dark:border-gray-600 pb-2 last:border-b-0">
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Row {idx + 1}</div>
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">Before:</span>
                            <div className="text-gray-900 dark:text-gray-100 font-mono text-xs bg-white dark:bg-gray-900 p-2 rounded border break-all">
                              {result.before || '(empty)'}
                            </div>
                          </div>
                          <div className="text-sm">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">After:</span>
                            <div className="text-gray-900 dark:text-gray-100 font-mono text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded border break-all">
                              {result.after || '(empty)'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  Click "Preview" to see transformation results
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
