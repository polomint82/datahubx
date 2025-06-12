import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Search, Upload, Eye, Download, FileCheck2, Grid3X3, List, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DataPreview } from "@/components/data-preview";
import { DataQualityReport } from "@/components/data-quality-report";
import { ImportModal } from "@/components/import-modal";
import type { Dataset } from "@shared/schema";

export default function Datasets() {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [qualityReportDataset, setQualityReportDataset] = useState<Dataset | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [datasetsExpanded, setDatasetsExpanded] = useState(true);
  const [previewExpanded, setPreviewExpanded] = useState(true);

  const { data: datasets = [], isLoading } = useQuery({
    queryKey: ["/api/datasets"],
  });

  const filteredDatasets = (datasets as Dataset[])?.filter((dataset: Dataset) =>
    dataset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dataset.filename.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatFileSize = (rows: number, columns: number) => {
    const estimatedSize = rows * columns * 50; // Rough estimate
    if (estimatedSize > 1000000) return `~${(estimatedSize / 1000000).toFixed(1)}MB`;
    if (estimatedSize > 1000) return `~${(estimatedSize / 1000).toFixed(1)}KB`;
    return `~${estimatedSize}B`;
  };

  return (
    <>
      {qualityReportDataset ? (
        <DataQualityReport 
          dataset={qualityReportDataset} 
          onClose={() => setQualityReportDataset(null)} 
        />
      ) : (
        <>
          {/* Header */}
          <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center">
                <div className="ml-4 flex items-center">
                  <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Datasets
                  </h1>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <div className="flex-1 overflow-auto">
            <div className="p-4 sm:p-6 lg:p-8 w-full max-w-none">
              {/* Search */}
              <Card className="mb-6">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search datasets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
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
                      <Button onClick={() => setShowImportModal(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Import CSV from S3
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

          {/* Data Preview - appears above when dataset is selected */}
          {selectedDataset && (
            <Collapsible open={previewExpanded} onOpenChange={setPreviewExpanded} className="mb-6">
              <div className="mb-4">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Dataset Preview: {selectedDataset.name}
                    </span>
                  </div>
                  {previewExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <DataPreview 
                  dataset={selectedDataset} 
                  onClose={() => setSelectedDataset(null)}
                  maxRows={50}
                  onDatasetChange={(datasetId) => {
                    const newDataset = datasets.find((d: Dataset) => d.id === datasetId);
                    if (newDataset) {
                      setSelectedDataset(newDataset);
                    }
                  }}
                />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Dataset List */}
          <Collapsible open={datasetsExpanded} onOpenChange={setDatasetsExpanded} className="w-full">
            <div className="mb-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    All Datasets ({filteredDatasets.length})
                  </span>
                </div>
                {datasetsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              {isLoading ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">Loading datasets...</div>
                    </CardContent>
                  </Card>
                ) : filteredDatasets.length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        {searchTerm ? 'No datasets found' : 'No datasets yet'}
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 mb-4">
                        {searchTerm 
                          ? 'Try adjusting your search terms' 
                          : 'Import your first CSV file to get started'
                        }
                      </p>
                      {!searchTerm && (
                        <Button onClick={() => setShowImportModal(true)}>
                          <Upload className="mr-2 h-4 w-4" />
                          Import Dataset
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : viewMode === 'card' ? (
                  <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDatasets.map((dataset: Dataset) => (
                      <Card key={dataset.id} className="hover:shadow-lg transition-shadow duration-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {dataset.name}
                              </CardTitle>
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                                {dataset.filename}
                              </p>
                            </div>
                            <Badge className={`text-xs ${getStatusColor(dataset.status)} ml-2 flex-shrink-0`}>
                              {dataset.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Rows</p>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {dataset.totalRows.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Columns</p>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {dataset.totalColumns}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Size</p>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {formatFileSize(dataset.totalRows, dataset.totalColumns)}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 dark:text-gray-400">Created</p>
                              <p className="font-medium text-gray-900 dark:text-gray-100">
                                {formatDate(dataset.createdAt)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-center space-x-1 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                              onClick={() => setSelectedDataset(dataset)}
                              title="Preview Data"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20 dark:hover:text-green-400 transition-colors"
                              onClick={() => setQualityReportDataset(dataset)}
                              title="Quality Report"
                            >
                              <FileCheck2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/20 dark:hover:text-purple-400 transition-colors"
                              onClick={() => {
                                // In production, this would trigger actual download
                                console.log('Download dataset:', dataset.name);
                              }}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>All Datasets ({filteredDatasets.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 dark:bg-gray-800/50">
                          <TableHead className="text-xs font-semibold">Name</TableHead>
                          <TableHead className="text-xs font-semibold">Status</TableHead>
                          <TableHead className="text-xs font-semibold">Rows</TableHead>
                          <TableHead className="text-xs font-semibold">Columns</TableHead>
                          <TableHead className="text-xs font-semibold">Size</TableHead>
                          <TableHead className="text-xs font-semibold">Created</TableHead>
                          <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDatasets.map((dataset: Dataset) => (
                          <TableRow key={dataset.id}>
                            <TableCell>
                              <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-48">
                                  {dataset.name}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-48">
                                  {dataset.filename}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-xs ${getStatusColor(dataset.status)}`}>
                                {dataset.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {dataset.totalRows.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs">
                              {dataset.totalColumns}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500 dark:text-gray-400">
                              {formatFileSize(dataset.totalRows, dataset.totalColumns)}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(dataset.createdAt)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition-colors"
                                  onClick={() => setSelectedDataset(dataset)}
                                  title="Preview Data"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/20 dark:hover:text-green-400 transition-colors"
                                  onClick={() => setQualityReportDataset(dataset)}
                                  title="Quality Report"
                                >
                                  <FileCheck2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/20 dark:hover:text-purple-400 transition-colors"
                                  onClick={() => {
                                    // In production, this would trigger actual download
                                    console.log('Download dataset:', dataset.name);
                                  }}
                                  title="Download"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </CollapsibleContent>
          </Collapsible>
            </div>
          </div>
        </>
      )}

      {/* Import Modal */}
      <ImportModal open={showImportModal} onOpenChange={setShowImportModal} />
    </>
  );
}
