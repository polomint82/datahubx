import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { useToast } from "@/hooks/use-toast";
import { 
  Folder, 
  File, 
  FileText,
  ChevronLeft, 
  ChevronRight, 
  RotateCcw,
  ChevronDown,
  Cloud,
  Database,
  Download,
  Share,
  HardDrive,
  Search,
  X
} from "lucide-react";
import { formatFileSize, getFilenameFromKey, isCSVFile } from "@/lib/s3-utils";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface S3Object {
  key: string;
  size: number;
  lastModified: string;
  isFolder: boolean;
}

export default function FileExplorer() {
  const { toast } = useToast();
  const [currentPath, setCurrentPath] = useState("");
  const [currentBucket, setCurrentBucket] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Check AWS configuration status
  const { data: awsConfig } = useQuery({
    queryKey: ['/api/aws/credentials'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/aws/credentials');
      return await response.json();
    },
  });

  const isAWSConfigured = awsConfig?.isConfigured || false;

  // List S3 buckets using stored credentials
  const { data: buckets = [], isLoading: bucketsLoading, refetch: refetchBuckets } = useQuery({
    queryKey: ['/api/s3/buckets'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/s3/buckets');
      return await response.json();
    },
    enabled: isAWSConfigured,
  });

  // List S3 objects in current bucket/path using stored credentials
  const { data: objects = [], isLoading: objectsLoading, refetch: refetchObjects } = useQuery({
    queryKey: ['/api/s3/objects', currentBucket, currentPath],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/s3/objects', {
        bucket: currentBucket,
        prefix: currentPath,
      });
      return await response.json();
    },
    enabled: !!currentBucket && isAWSConfigured,
  });

  // Import single file mutation
  const importSingleMutation = useMutation({
    mutationFn: async (file: string) => {
      const response = await apiRequest('POST', '/api/s3/import-files', {
        bucket: currentBucket,
        files: [file],
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Import started",
        description: "Successfully started CSV import.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/datasets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.message || "Failed to start import process.",
        variant: "destructive",
      });
    },
  });

  // Navigate to path
  const navigateTo = (path: string) => {
    if (!path) {
      setCurrentBucket("");
      setCurrentPath("");
    } else if (path.includes('/')) {
      const [bucket, ...pathParts] = path.split('/');
      setCurrentBucket(bucket);
      setCurrentPath(pathParts.join('/'));
    } else {
      setCurrentBucket(path);
      setCurrentPath("");
    }
    setSelectedFiles([]);
  };

  // Fuzzy search implementation
  const fuzzyMatch = (query: string, text: string): { score: number; matches: number[] } => {
    if (!query) return { score: 1, matches: [] };
    
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    // Exact substring match gets highest score
    if (textLower.includes(queryLower)) {
      const index = textLower.indexOf(queryLower);
      return { 
        score: 0.9 - (index / text.length) * 0.1, 
        matches: Array.from({length: query.length}, (_, i) => index + i)
      };
    }
    
    // Check file extension match for searches like "csv", "json", etc.
    if (queryLower.length <= 4 && textLower.endsWith('.' + queryLower)) {
      const extIndex = textLower.lastIndexOf('.' + queryLower);
      return {
        score: 0.8,
        matches: Array.from({length: queryLower.length}, (_, i) => extIndex + 1 + i)
      };
    }
    
    // Fuzzy character-by-character matching
    let score = 0;
    let queryIndex = 0;
    const matches: number[] = [];
    let consecutiveMatches = 0;
    
    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIndex]) {
        matches.push(i);
        queryIndex++;
        consecutiveMatches++;
        // Bonus for consecutive matches
        score += (1 + consecutiveMatches * 0.5) / (i + 1);
      } else {
        consecutiveMatches = 0;
      }
    }
    
    if (queryIndex !== queryLower.length) return { score: 0, matches: [] };
    
    // Normalize score and boost if query matches a significant portion
    const normalizedScore = (score / queryLower.length) * (queryIndex / text.length);
    return { score: normalizedScore, matches };
  };

  // Recursive function to get all objects from a bucket
  const getAllObjectsFromBucket = async (bucketName: string, prefix = ''): Promise<S3Object[]> => {
    const allObjects: S3Object[] = [];
    
    try {
      const response = await apiRequest('POST', '/api/s3/objects', {
        bucket: bucketName,
        prefix: prefix,
      });
      const objects = await response.json();
      
      for (const obj of objects) {
        if (obj.isFolder) {
          // Recursively search in folders
          const folderObjects = await getAllObjectsFromBucket(bucketName, obj.key);
          allObjects.push(...folderObjects);
        } else {
          allObjects.push(obj);
        }
      }
    } catch (error) {
      console.error(`Error getting objects from ${bucketName}/${prefix}:`, error);
    }
    
    return allObjects;
  };

  // Search across all buckets and objects
  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ['/api/s3/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim() || !isAWSConfigured) return [];
      
      const results: Array<S3Object & { bucket: string; score: number; path: string }> = [];
      
      // Search in all buckets recursively
      for (const bucket of buckets) {
        try {
          console.log(`Searching bucket ${bucket.name} recursively...`);
          const allObjects = await getAllObjectsFromBucket(bucket.name);
          
          console.log(`Found ${allObjects.length} total objects in bucket ${bucket.name}`);
          
          for (const obj of allObjects) {
            const filename = getFilenameFromKey(obj.key);
            const match = fuzzyMatch(searchQuery, filename);
            
            // Special handling for extension searches (e.g., "csv")
            const isExtensionSearch = searchQuery.toLowerCase() === 'csv' || 
                                     searchQuery.toLowerCase() === 'json' || 
                                     searchQuery.toLowerCase() === 'xlsx';
            
            const threshold = isExtensionSearch ? 0.01 : (searchQuery.length <= 3 ? 0.05 : 0.1);
            
            console.log(`File: ${filename}, Query: ${searchQuery}, Score: ${match.score}, Threshold: ${threshold}`);
            
            if (match.score > threshold) {
              results.push({
                ...obj,
                bucket: bucket.name,
                score: match.score,
                path: obj.key
              });
            }
          }
        } catch (error) {
          console.error(`Error searching bucket ${bucket.name}:`, error);
        }
      }
      
      console.log(`Search completed. Found ${results.length} results for "${searchQuery}"`);
      return results.sort((a, b) => b.score - a.score);
    },
    enabled: searchQuery.trim().length > 0 && isAWSConfigured,
  });

  // Filter objects based on current view or search
  const filteredObjects = isSearching && searchQuery ? searchResults : (objects || []);

  // Highlight matching characters in search results
  const highlightMatches = (text: string, query: string) => {
    if (!query || !isSearching) return text;
    
    const match = fuzzyMatch(query, text);
    if (match.score === 0) return text;
    
    let result = [];
    let lastIndex = 0;
    
    match.matches.forEach((matchIndex) => {
      if (matchIndex > lastIndex) {
        result.push(text.slice(lastIndex, matchIndex));
      }
      result.push(
        <span key={matchIndex} className="bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-200 px-0.5 rounded">
          {text[matchIndex]}
        </span>
      );
      lastIndex = matchIndex + 1;
    });
    
    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }
    
    return result;
  };

  // Get file icon
  const getFileIcon = (obj: S3Object) => {
    if (obj.isFolder) {
      return <Folder className="h-4 w-4 text-yellow-500" fill="currentColor" />;
    }
    const filename = getFilenameFromKey(obj.key);
    if (filename.endsWith('.pdf')) {
      return (
        <div className="h-4 w-4 bg-red-500 text-white text-xs font-bold flex items-center justify-center rounded-sm">
          PDF
        </div>
      );
    }
    if (filename.endsWith('.mov') || filename.endsWith('.mp4')) {
      return <div className="h-4 w-4 bg-gray-600 rounded-sm flex items-center justify-center">
        <div className="w-0 h-0 border-l-2 border-l-white border-y-1 border-y-transparent ml-0.5"></div>
      </div>;
    }
    if (isCSVFile(obj.key)) {
      return <FileText className="h-4 w-4 text-green-600" />;
    }
    return <File className="h-4 w-4 text-gray-500" />;
  };

  // Handle CSV import
  const handleImportCsv = (obj: S3Object) => {
    importSingleMutation.mutate(obj.key);
  };

  if (!awsConfig?.accessKeyId) {
    return (
      <div className="h-screen flex bg-white dark:bg-gray-900">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Database className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">AWS Configuration Required</h3>
            <p className="text-gray-500 mb-4">
              Please configure your AWS credentials in the Admin page to access S3 buckets.
            </p>
            <Button onClick={() => window.location.href = '/admin'}>
              Go to Admin Configuration
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <div className="ml-4 flex items-center">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                File Explorer
              </h1>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search files across all buckets..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearching(e.target.value.trim().length > 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchQuery("");
                    setIsSearching(false);
                  }
                }}
                className="pl-10 pr-10 w-80"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setIsSearching(false);
                  }}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full bg-white dark:bg-gray-900">
          {/* Navigation Bar */}
          {!isSearching && (currentBucket || currentPath) && (
            <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (currentPath) {
                    const pathParts = currentPath.split('/').filter(Boolean);
                    pathParts.pop();
                    navigateTo(currentBucket + (pathParts.length ? '/' + pathParts.join('/') : ''));
                  } else {
                    navigateTo('');
                  }
                }}
                className="mr-3"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {currentBucket && (
                  <>
                    <span className="font-medium">{currentBucket}</span>
                    {currentPath && <span> / {currentPath}</span>}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Search Results Header */}
          {isSearching && searchQuery && (
            <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <Search className="h-4 w-4 mr-2 text-gray-500" />
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {searchLoading ? (
                  <span>Searching for "{searchQuery}"...</span>
                ) : (
                  <span>
                    Found {filteredObjects.length} result{filteredObjects.length !== 1 ? 's' : ''} for "{searchQuery}"
                  </span>
                )}
              </div>
            </div>
          )}

          {/* File Content */}
          <div className="flex-1">
            <div className="h-full overflow-auto">
              {(objectsLoading || (isSearching && searchLoading)) ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <RotateCcw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">
                      {isSearching ? 'Searching...' : 'Loading...'}
                    </p>
                  </div>
                </div>
              ) : isSearching ? (
                <div className="p-4">
                  <div className="space-y-0">
                    {filteredObjects.map((obj: any) => (
                      <ContextMenu key={`${obj.bucket}-${obj.key}`}>
                        <ContextMenuTrigger asChild>
                          <div
                            className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer rounded transition-colors"
                            onClick={() => {
                              if (obj.isFolder) {
                                setSearchQuery("");
                                setIsSearching(false);
                                navigateTo(`${obj.bucket}/${obj.key}`);
                              } else {
                                setSearchQuery("");
                                setIsSearching(false);
                                const pathParts = obj.key.split('/');
                                pathParts.pop();
                                navigateTo(obj.bucket + (pathParts.length ? '/' + pathParts.join('/') : ''));
                              }
                            }}
                          >
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              {getFileIcon(obj)}
                              <div className="flex flex-col">
                                <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                  {highlightMatches(getFilenameFromKey(obj.key), searchQuery)}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {obj.bucket} / {obj.key}
                                </span>
                              </div>
                              {isCSVFile(obj.key) && (
                                <Badge variant="secondary" className="text-xs">CSV</Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                <div className="w-4 h-4 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                              </div>
                              <div className="w-16 text-right">
                                {obj.isFolder ? '-' : formatFileSize(obj.size)}
                              </div>
                            </div>
                          </div>
                        </ContextMenuTrigger>

                        <ContextMenuContent className="w-56">
                          {isCSVFile(obj.key) && (
                            <>
                              <ContextMenuItem onClick={() => {
                                setCurrentBucket(obj.bucket);
                                handleImportCsv(obj);
                              }}>
                                <Database className="mr-2 h-4 w-4" />
                                Import as Dataset
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                            </>
                          )}
                          <ContextMenuItem>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </ContextMenuItem>
                          <ContextMenuItem>
                            <Share className="mr-2 h-4 w-4" />
                            Share
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem>
                            Properties
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}
                    
                    {filteredObjects.length === 0 && !searchLoading && (
                      <div className="text-center py-12">
                        <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">
                          No files found for "{searchQuery}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : !currentBucket ? (
                <div className="p-4">
                  <div className="space-y-0">
                    {buckets.map((bucket: any) => (
                      <div
                        key={bucket.name}
                        className="flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer rounded transition-colors"
                        onClick={() => navigateTo(bucket.name)}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <Folder className="h-4 w-4 text-yellow-500" fill="currentColor" />
                          <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                            {bucket.name}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                            <div className="w-4 h-4 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                          </div>
                          <div className="w-16 text-right">
                            {new Date(bucket.creationDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="space-y-0">
                    {filteredObjects.map((obj: S3Object) => (
                      <ContextMenu key={obj.key}>
                        <ContextMenuTrigger asChild>
                          <div
                            className={`flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer rounded transition-colors ${
                              selectedFiles.includes(obj.key) 
                                ? 'bg-blue-50 dark:bg-blue-900/20' 
                                : ''
                            }`}
                            onClick={() => {
                              if (obj.isFolder) {
                                navigateTo(`${currentBucket}/${obj.key}`);
                              }
                            }}
                          >
                            <div className="flex items-center space-x-3 flex-1 min-w-0">
                              {getFileIcon(obj)}
                              <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                {getFilenameFromKey(obj.key)}
                              </span>
                              {isCSVFile(obj.key) && (
                                <Badge variant="secondary" className="text-xs">CSV</Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                <div className="w-4 h-4 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                              </div>
                              <div className="w-16 text-right">
                                {obj.isFolder ? '-' : formatFileSize(obj.size)}
                              </div>
                            </div>
                          </div>
                        </ContextMenuTrigger>

                        <ContextMenuContent className="w-56">
                          {isCSVFile(obj.key) && (
                            <>
                              <ContextMenuItem onClick={() => handleImportCsv(obj)}>
                                <Database className="mr-2 h-4 w-4" />
                                Import as Dataset
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                            </>
                          )}
                          <ContextMenuItem>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </ContextMenuItem>
                          <ContextMenuItem>
                            <Share className="mr-2 h-4 w-4" />
                            Share
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem>
                            Properties
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}
                    
                    {filteredObjects.length === 0 && (
                      <div className="text-center py-12">
                        <Folder className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">
                          This folder is empty
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}