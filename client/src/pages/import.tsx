import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Eye, Database, ArrowLeft, Type, Hash, Calendar, ToggleLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import type { S3ImportRequest } from "@shared/schema";

export default function Import() {
  const [formData, setFormData] = useState<S3ImportRequest>({
    bucket: "",
    key: "",
    name: "",
    hasHeader: true,
    autoDetectTypes: true,
  });
  const [showPreview, setShowPreview] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'number':
      case 'integer':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'string':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'date':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'boolean':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
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
  
  // Parse URL parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const bucket = urlParams.get('bucket');
    const key = urlParams.get('key');
    const name = urlParams.get('name');
    const preview = urlParams.get('preview');
    
    if (bucket && key && name) {
      setFormData({
        bucket,
        key,
        name,
        hasHeader: true,
        autoDetectTypes: true,
      });
      
      if (preview === 'true') {
        setShowPreview(true);
      }
    }
  }, []);

  // Fetch data preview when in preview mode
  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['/api/import/preview', formData.bucket, formData.key],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/import/preview', {
        bucket: formData.bucket,
        key: formData.key,
        hasHeader: formData.hasHeader,
      });
      return await response.json();
    },
    enabled: !!(showPreview && formData.bucket && formData.key),
  });

  const importMutation = useMutation({
    mutationFn: async (data: S3ImportRequest) => {
      const response = await apiRequest("POST", "/api/import/s3", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Import Started",
        description: "Your dataset is being imported. You can check the progress in Job History.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/datasets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setFormData({
        bucket: "",
        key: "",
        name: "",
        hasHeader: true,
        autoDetectTypes: true,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import dataset",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bucket || !formData.key || !formData.name) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    importMutation.mutate(formData);
  };

  return (
    <>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {showPreview ? 'Preview & Import Data' : 'Import Data'}
            </h1>
            {showPreview && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowPreview(false);
                  setLocation('/files');
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Files
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8 h-full w-full max-w-none">
          <div className={showPreview ? "h-full flex flex-col space-y-6" : "max-w-4xl mx-auto space-y-6"}>
            
            {/* Preview Section */}
            {showPreview && formData.bucket && formData.key && (
              <Card className="flex-1 flex flex-col min-h-0">
                <CardHeader className="flex-shrink-0">
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Data Preview
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Badge variant="secondary">{formData.bucket}</Badge>
                    <span>/</span>
                    <span>{formData.key}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0">
                  {previewLoading ? (
                    <div className="flex items-center justify-center flex-1">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-2">Loading preview...</span>
                    </div>
                  ) : previewData ? (
                    <div className="flex flex-col h-full space-y-4">
                      <div className="flex items-center justify-between flex-shrink-0">
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {previewData.totalRows} rows • {previewData.columns?.length} columns
                        </div>
                        <Badge variant="outline">Preview (first 50 rows)</Badge>
                      </div>
                      
                      {/* Data table preview */}
                      <div className="border rounded-lg overflow-hidden flex-1 flex flex-col">
                        <div className="overflow-auto flex-1">
                          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                              <tr>
                                {previewData.columns?.map((column: any, index: number) => (
                                  <th
                                    key={index}
                                    className="px-3 py-2 text-left whitespace-nowrap bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                                  >
                                    <div className="flex flex-col space-y-1.5">
                                      {/* Header row with icon and name */}
                                      <div className="flex items-center space-x-1.5 min-h-[20px]">
                                        <div className={`flex items-center justify-center w-5 h-5 rounded-sm ${getTypeColor(column.type)} flex-shrink-0`}>
                                          {getTypeIcon(column.type)}
                                        </div>
                                        <span className="font-mono text-[11px] font-medium text-gray-900 dark:text-gray-100 truncate">
                                          {column.name}
                                        </span>
                                      </div>
                                      
                                      {/* Type label */}
                                      <div className="flex items-center">
                                        <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
                                          {column.type}
                                        </span>
                                      </div>
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                              {previewData.preview?.map((row: any, rowIndex: number) => (
                                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800'}>
                                  {previewData.columns?.map((column: any, colIndex: number) => (
                                    <td
                                      key={colIndex}
                                      className="px-3 py-1.5 text-[10px] text-gray-900 dark:text-gray-100 font-mono border-r border-gray-200 dark:border-gray-700 last:border-r-0"
                                      title={row[column.name] || '-'}
                                    >
                                      <div className="max-w-xs truncate">
                                        {row[column.name] || '-'}
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                      Failed to load preview data
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Import Form */}
            <div className={showPreview ? 'max-w-2xl' : 'max-w-2xl mx-auto'}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Import CSV from S3
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <Label htmlFor="s3-bucket">S3 Bucket *</Label>
                      <Input
                        id="s3-bucket"
                        type="text"
                        placeholder="my-data-bucket"
                        value={formData.bucket}
                        onChange={(e) => setFormData({ ...formData, bucket: e.target.value })}
                        className="mt-1"
                        required
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        The name of your S3 bucket containing the CSV file
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="s3-key">File Path *</Label>
                      <Input
                        id="s3-key"
                        type="text"
                        placeholder="data/customer-data.csv"
                        value={formData.key}
                        onChange={(e) => setFormData({ ...formData, key: e.target.value })}
                        className="mt-1"
                        required
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        The full path to your CSV file within the bucket
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="dataset-name">Dataset Name *</Label>
                      <Input
                        id="dataset-name"
                        type="text"
                        placeholder="Customer Data"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="mt-1"
                        required
                      />
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        A descriptive name for your dataset
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="has-header"
                          checked={formData.hasHeader}
                          onCheckedChange={(checked) => setFormData({ ...formData, hasHeader: !!checked })}
                        />
                        <Label htmlFor="has-header">File has header row</Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="auto-detect"
                          checked={formData.autoDetectTypes}
                          onCheckedChange={(checked) => setFormData({ ...formData, autoDetectTypes: !!checked })}
                        />
                        <Label htmlFor="auto-detect">Auto-detect data types</Label>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setFormData({
                          bucket: "",
                          key: "",
                          name: "",
                          hasHeader: true,
                          autoDetectTypes: true,
                        })}
                        disabled={importMutation.isPending}
                      >
                        Reset
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={importMutation.isPending}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {importMutation.isPending ? "Importing..." : "Import Dataset"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* Import Tips */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Import Tips
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                    <div>
                      <strong>Supported Formats:</strong> CSV files with UTF-8 encoding
                    </div>
                    <div>
                      <strong>File Size:</strong> Files up to 100MB are supported for optimal performance
                    </div>
                    <div>
                      <strong>Data Types:</strong> Auto-detection supports strings, numbers, dates, and booleans
                    </div>
                    <div>
                      <strong>S3 Access:</strong> Ensure your S3 credentials have read access to the specified bucket
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}