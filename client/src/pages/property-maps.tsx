import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Map, Grid3X3, List, Search, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PropertyMap, Dataset, Transformation } from "@shared/schema";

export default function PropertyMaps() {
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [viewMode, setViewMode] = useState<'card' | 'table'>('table');
  const [searchTerm, setSearchTerm] = useState("");

  const { data: datasets = [] } = useQuery({
    queryKey: ["/api/datasets"],
  });

  const { data: propertyMaps = [], isLoading } = useQuery({
    queryKey: ["/api/property-maps", selectedDataset],
    queryFn: async () => {
      const url = selectedDataset && selectedDataset !== "all"
        ? `/api/property-maps?datasetId=${selectedDataset}`
        : "/api/property-maps";
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch property maps");
      return response.json();
    },
  });

  const { data: transformations = [] } = useQuery({
    queryKey: ["/api/transformations"],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'archived':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString();
  };

  // Filter property maps based on search term and selected dataset
  const filteredPropertyMaps = (propertyMaps as PropertyMap[]).filter((propertyMap: PropertyMap) => {
    const matchesSearch = !searchTerm || 
      propertyMap.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (propertyMap.description && propertyMap.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesDataset = !selectedDataset || selectedDataset === "all" || 
      propertyMap.datasetId.toString() === selectedDataset;
    
    return matchesSearch && matchesDataset;
  });

  // Get transformations count for each property map
  const getTransformationsCount = (propertyMapId: number) => {
    return (transformations as Transformation[]).filter(t => t.propertyMapId === propertyMapId).length;
  };

  return (
    <>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Property Maps</h1>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Property Map
          </Button>
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
                      placeholder="Search property maps..."
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
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Property Maps Content */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500 dark:text-gray-400">Loading property maps...</div>
            </div>
          ) : filteredPropertyMaps.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Map className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  {propertyMaps.length === 0 ? "No property maps found" : "No property maps match your filters"}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {propertyMaps.length === 0 
                    ? "Property maps organize transformations by dataset. Create your first property map to get started."
                    : "Try adjusting your search or filter criteria."
                  }
                </p>
                {propertyMaps.length === 0 && (
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Property Map
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : viewMode === 'card' ? (
            <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredPropertyMaps.map((propertyMap: PropertyMap) => {
                const dataset = (datasets as Dataset[]).find((d: Dataset) => d.id === propertyMap.datasetId);
                const transformationsCount = getTransformationsCount(propertyMap.id);
                
                return (
                  <Card key={propertyMap.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{propertyMap.name}</CardTitle>
                        <Badge className={getStatusColor(propertyMap.status)}>
                          {propertyMap.status}
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
                        
                        {propertyMap.description && (
                          <div>
                            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {propertyMap.description}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <ArrowUpDown className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {transformationsCount} transformations
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(propertyMap.createdAt)}
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
                    <TableHead className="text-xs font-semibold">Description</TableHead>
                    <TableHead className="text-xs font-semibold">Transformations</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPropertyMaps.map((propertyMap: PropertyMap) => {
                    const dataset = (datasets as Dataset[]).find((d: Dataset) => d.id === propertyMap.datasetId);
                    const transformationsCount = getTransformationsCount(propertyMap.id);
                    
                    return (
                      <TableRow key={propertyMap.id} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <TableCell className="font-medium">{propertyMap.name}</TableCell>
                        <TableCell>{dataset?.name || 'Unknown'}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {propertyMap.description || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <ArrowUpDown className="h-4 w-4 text-gray-400" />
                            <span>{transformationsCount}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(propertyMap.status)}>
                            {propertyMap.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(propertyMap.createdAt)}
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
    </>
  );
}