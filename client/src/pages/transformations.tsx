import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wand2, Eye, Grid3X3, List, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { TransformationBuilder } from "@/components/transformation-builder";
import type { Transformation, Dataset } from "@shared/schema";

export default function Transformations() {
  const [showTransformModal, setShowTransformModal] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  const [searchTerm, setSearchTerm] = useState("");
  const [previewTransformation, setPreviewTransformation] = useState<Transformation | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  const { data: datasets = [] } = useQuery({
    queryKey: ["/api/datasets"],
  });

  const { data: transformations = [], isLoading } = useQuery({
    queryKey: ["/api/transformations", selectedDataset],
    queryFn: async () => {
      const url = selectedDataset && selectedDataset !== "all"
        ? `/api/transformations?datasetId=${selectedDataset}`
        : "/api/transformations";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch transformations");
      return response.json();
    },
  });

  // Query for transformation preview data
  const { data: previewData, isLoading: isLoadingPreview } = useQuery({
    queryKey: ["/api/transformations/preview", previewTransformation?.id],
    queryFn: async () => {
      if (!previewTransformation) return null;
      
      const response = await fetch('/api/transformations/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          datasetId: previewTransformation.datasetId,
          targetColumn: previewTransformation.targetColumn,
          expression: previewTransformation.expression
        })
      });
      
      if (!response.ok) throw new Error("Failed to fetch preview");
      return response.json();
    },
    enabled: !!previewTransformation && showPreviewDialog,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applied':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'math':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
      case 'date':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handlePreviewTransformation = (transformation: Transformation) => {
    setPreviewTransformation(transformation);
    setShowPreviewDialog(true);
  };

  const closePreviewDialog = () => {
    setShowPreviewDialog(false);
    setPreviewTransformation(null);
  };

  // Filter transformations based on search term and selected dataset
  const filteredTransformations = (transformations as Transformation[]).filter((transformation: Transformation) => {
    const matchesSearch = !searchTerm || 
      transformation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transformation.expression.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDataset = !selectedDataset || selectedDataset === "all" || 
      transformation.datasetId.toString() === selectedDataset;
    
    return matchesSearch && matchesDataset;
  });

  return (
    <>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Transformations</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-none">
          {/* Search and Filters */}
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search transformations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="w-64">
                    <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by dataset..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Datasets</SelectItem>
                        {(datasets as Dataset[]).map((dataset: Dataset) => (
                          <SelectItem key={dataset.id} value={dataset.id.toString()}>
                            {dataset.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant={viewMode === 'card' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('card')}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('table')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button onClick={() => setShowTransformModal(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Transformation
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transformations Content */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500 dark:text-gray-400">Loading transformations...</div>
            </div>
          ) : filteredTransformations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Wand2 className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {transformations.length === 0 ? "No transformations found" : "No transformations match your filters"}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {transformations.length === 0 
                    ? "Get started by creating your first data transformation."
                    : "Try adjusting your search or filter criteria."
                  }
                </p>
                {transformations.length === 0 && (
                  <Button onClick={() => setShowTransformModal(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Transformation
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : viewMode === 'card' ? (
            <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredTransformations.map((transformation: Transformation) => {
                const dataset = (datasets as Dataset[]).find((d: Dataset) => d.id === transformation.datasetId);
                
                return (
                  <Card key={transformation.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{transformation.name}</CardTitle>
                        <Badge className={getStatusColor(transformation.status)}>
                          {transformation.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Dataset</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {dataset?.name || 'Unknown'}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Expression</div>
                          <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono block mt-1">
                            {transformation.expression}
                          </code>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge className={getTypeColor(transformation.functionType)}>
                              {transformation.functionType}
                            </Badge>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handlePreviewTransformation(transformation)}
                              className="h-6 w-6 p-0"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(transformation.createdAt)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                    <TableHead className="text-xs font-semibold">Name</TableHead>
                    <TableHead className="text-xs font-semibold">Dataset</TableHead>
                    <TableHead className="text-xs font-semibold">Expression</TableHead>
                    <TableHead className="text-xs font-semibold">Type</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">Created</TableHead>
                    <TableHead className="text-xs font-semibold text-right w-[50px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransformations.map((transformation: Transformation) => {
                    const dataset = (datasets as Dataset[]).find((d: Dataset) => d.id === transformation.datasetId);
                    
                    return (
                      <TableRow key={transformation.id}>
                        <TableCell className="font-medium">{transformation.name}</TableCell>
                        <TableCell>{dataset?.name || 'Unknown'}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            {transformation.expression}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge className={getTypeColor(transformation.functionType)}>
                            {transformation.functionType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(transformation.status)}>
                            {transformation.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(transformation.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handlePreviewTransformation(transformation)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Transformation Builder Modal */}
      <TransformationBuilder 
        open={showTransformModal} 
        onOpenChange={setShowTransformModal} 
      />

      {/* Transformation Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Transformation Preview</span>
              <DialogClose asChild>
                <Button variant="ghost" size="sm" onClick={closePreviewDialog}>
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </DialogTitle>
          </DialogHeader>
          
          {previewTransformation && (
            <div className="space-y-6">
              {/* Transformation Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Transformation Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{previewTransformation.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Dataset</label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {(datasets as Dataset[]).find(d => d.id === previewTransformation.datasetId)?.name || 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Target Column</label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">{previewTransformation.targetColumn}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Expression</label>
                      <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded block mt-1">
                        {previewTransformation.expression}
                      </code>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                        <div className="mt-1">
                          <Badge className={getTypeColor(previewTransformation.functionType)}>
                            {previewTransformation.functionType}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                        <div className="mt-1">
                          <Badge className={getStatusColor(previewTransformation.status)}>
                            {previewTransformation.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Created</label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {formatDate(previewTransformation.createdAt)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sequence Number</label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {previewTransformation.sequenceNumber || 1}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Transformation ID</label>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{previewTransformation.id}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Preview Results */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Transformation Preview</span>
                    {isLoadingPreview && (
                      <div className="text-sm text-gray-500">Loading preview...</div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingPreview ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">Loading transformation preview...</div>
                    </div>
                  ) : previewData?.preview ? (
                    <div className="space-y-4">
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        Sample transformation results (showing first 5 rows):
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs font-semibold">Original Value</TableHead>
                              <TableHead className="text-xs font-semibold">Transformed Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewData.preview.map((item: any, index: number) => (
                              <TableRow key={index}>
                                <TableCell className="font-mono text-sm">
                                  {item.before || '(empty)'}
                                </TableCell>
                                <TableCell className="font-mono text-sm font-medium">
                                  {item.after || '(empty)'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">
                        No preview data available. The transformation may need to be applied to a dataset first.
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}