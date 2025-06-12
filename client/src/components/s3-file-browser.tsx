import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Folder, 
  FileText, 
  ArrowLeft, 
  Search, 
  RefreshCw,
  Check,
  ChevronRight,
  Home
} from "lucide-react";

interface S3Object {
  key: string;
  size?: number;
  lastModified?: string;
  isFolder?: boolean;
}

interface S3FileBrowserProps {
  onFileSelect: (bucket: string, key: string) => void;
  allowFolderSelection?: boolean;
  fileFilter?: (filename: string) => boolean;
}

export function S3FileBrowser({ 
  onFileSelect, 
  allowFolderSelection = false,
  fileFilter = () => true 
}: S3FileBrowserProps) {
  const [selectedBucket, setSelectedBucket] = useState<string>("");
  const [currentPath, setCurrentPath] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<string>("");

  // Fetch S3 buckets
  const { data: buckets = [], isLoading: bucketsLoading } = useQuery({
    queryKey: ["/api/s3/buckets"],
  }) as { data: any[], isLoading: boolean };

  // Fetch objects in current bucket/path
  const { data: objects = [], isLoading: objectsLoading, refetch } = useQuery({
    queryKey: ["/api/s3/objects", selectedBucket, currentPath],
    enabled: !!selectedBucket,
    queryFn: async () => {
      const response = await fetch('/api/s3/objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bucket: selectedBucket,
          prefix: currentPath
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch S3 objects');
      }
      
      return response.json();
    }
  });

  const filteredObjects = objects.filter((obj: S3Object) => {
    const matchesSearch = obj.key.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = obj.isFolder || fileFilter(obj.key);
    return matchesSearch && matchesFilter;
  });

  const navigateToFolder = (folderKey: string) => {
    setCurrentPath(folderKey);
    setSelectedItem("");
  };

  const navigateBack = () => {
    if (currentPath) {
      const pathParts = currentPath.split('/').filter(Boolean);
      pathParts.pop();
      setCurrentPath(pathParts.length > 0 ? pathParts.join('/') + '/' : '');
      setSelectedItem("");
    }
  };

  const navigateToRoot = () => {
    setCurrentPath("");
    setSelectedItem("");
  };

  const getBreadcrumbParts = () => {
    if (!currentPath) return [];
    return currentPath.split('/').filter(Boolean);
  };

  const navigateToBreadcrumb = (index: number) => {
    const parts = getBreadcrumbParts();
    const newPath = parts.slice(0, index + 1).join('/') + '/';
    setCurrentPath(newPath);
    setSelectedItem("");
  };

  const handleItemClick = (obj: S3Object) => {
    if (obj.isFolder) {
      navigateToFolder(obj.key);
    } else {
      setSelectedItem(obj.key);
    }
  };

  const handleSelect = () => {
    if (selectedItem) {
      onFileSelect(selectedBucket, selectedItem);
    } else if (allowFolderSelection && currentPath) {
      onFileSelect(selectedBucket, currentPath);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!selectedBucket) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Select S3 Bucket</h3>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        
        {bucketsLoading ? (
          <div className="text-center py-8">Loading buckets...</div>
        ) : (buckets as any[]).length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No S3 buckets found. Check your AWS credentials.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(buckets as any[]).map((bucket: any) => (
              <Card 
                key={bucket.name} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedBucket(bucket.name)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <Folder className="h-8 w-8 text-blue-500" />
                    <div>
                      <div className="font-medium">{bucket.name}</div>
                      <div className="text-sm text-gray-500">
                        Created: {formatDate(bucket.creationDate)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedBucket("")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Buckets
          </Button>
          <h3 className="text-lg font-semibold">{selectedBucket}</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button 
            onClick={handleSelect}
            disabled={!selectedItem && (!allowFolderSelection || !currentPath)}
          >
            <Check className="h-4 w-4 mr-2" />
            Select {selectedItem ? 'File' : 'Folder'}
          </Button>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-1 text-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={navigateToRoot}
          className="h-8 px-2"
        >
          <Home className="h-4 w-4" />
        </Button>
        {getBreadcrumbParts().map((part, index) => (
          <div key={index} className="flex items-center space-x-1">
            <ChevronRight className="h-4 w-4 text-gray-400" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigateToBreadcrumb(index)}
              className="h-8 px-2 text-blue-600 hover:text-blue-800"
            >
              {part}
            </Button>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search files and folders..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Current Selection */}
      {(selectedItem || (allowFolderSelection && currentPath)) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="text-sm">
            <span className="font-medium">Selected: </span>
            <span className="text-blue-600 dark:text-blue-400">
              s3://{selectedBucket}/{selectedItem || currentPath}
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      {currentPath && (
        <Button variant="outline" size="sm" onClick={navigateBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Up one level
        </Button>
      )}

      {/* Objects Table */}
      <Card>
        <CardContent className="p-0">
          {objectsLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredObjects.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'No files match your search.' : 'This folder is empty.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredObjects.map((obj: S3Object) => (
                  <TableRow 
                    key={obj.key}
                    className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      selectedItem === obj.key ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    onClick={() => handleItemClick(obj)}
                  >
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {obj.isFolder ? (
                          <Folder className="h-4 w-4 text-blue-500" />
                        ) : (
                          <FileText className="h-4 w-4 text-gray-500" />
                        )}
                        <span className="font-medium">
                          {obj.isFolder ? obj.key.replace(currentPath, '').replace('/', '') : obj.key.split('/').pop()}
                        </span>
                        {selectedItem === obj.key && (
                          <Badge variant="secondary" className="ml-2">Selected</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {obj.isFolder ? '-' : obj.size ? formatFileSize(obj.size) : '-'}
                    </TableCell>
                    <TableCell>
                      {obj.lastModified ? formatDate(obj.lastModified) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {obj.isFolder ? 'Folder' : obj.key.split('.').pop()?.toUpperCase() || 'File'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}