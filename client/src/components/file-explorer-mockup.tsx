import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  Folder,
  File,
  FileText,
  Database,
  Download,
  Share,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  HardDrive,
  Cloud,
  ChevronDown
} from "lucide-react";

interface FileItem {
  id: string;
  name: string;
  type: 'folder' | 'csv' | 'file';
  size?: string;
  modified: string;
  path: string;
}

const mockData: FileItem[] = [
  { id: '1', name: 'Construction Plans V1', type: 'folder', modified: '2 hours ago', path: '/Construction Plans V1', size: '50 MB' },
  { id: '2', name: 'Floor plans.pdf', type: 'file', modified: '1 day ago', path: '/Floor plans.pdf', size: '220 KB' },
  { id: '3', name: 'Site visit.mov', type: 'file', size: '4 MB', modified: '3 hours ago', path: '/Site visit.mov' },
  { id: '4', name: 'inventory_tracking.csv', type: 'csv', size: '856 KB', modified: '5 hours ago', path: '/inventory_tracking.csv' },
  { id: '5', name: 'user_analytics.csv', type: 'csv', size: '1.2 MB', modified: '1 day ago', path: '/user_analytics.csv' },
  { id: '6', name: 'financial_reports', type: 'folder', modified: '2 days ago', path: '/financial_reports', size: '15 MB' },
  { id: '7', name: 'product_catalog.csv', type: 'csv', size: '3.1 MB', modified: '6 hours ago', path: '/product_catalog.csv' },
];

export function FileExplorerMockup() {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState('Dropbox');

  const getFileIcon = (type: string, name: string) => {
    if (type === 'folder') {
      return <Folder className="h-4 w-4 text-yellow-500" fill="currentColor" />;
    }
    if (name.endsWith('.pdf')) {
      return (
        <div className="h-4 w-4 bg-red-500 text-white text-xs font-bold flex items-center justify-center rounded-sm">
          PDF
        </div>
      );
    }
    if (name.endsWith('.mov')) {
      return <div className="h-4 w-4 bg-gray-600 rounded-sm flex items-center justify-center">
        <div className="w-0 h-0 border-l-2 border-l-white border-y-1 border-y-transparent ml-0.5"></div>
      </div>;
    }
    if (type === 'csv') {
      return <FileText className="h-4 w-4 text-green-600" />;
    }
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const handleItemSelect = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleImportCsv = (item: FileItem) => {
    console.log('Importing CSV:', item.name);
  };

  return (
    <div className="h-screen flex bg-white dark:bg-gray-900">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-12 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 z-10">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex-1 mx-4">
          <div className="flex items-center bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded px-3 py-1 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Windows</span>
            <ChevronRight className="h-4 w-4 mx-1 text-gray-400" />
            <span className="text-gray-900 dark:text-gray-100">{currentPath}</span>
            <ChevronDown className="h-4 w-4 ml-2 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 pt-12">
        <div className="p-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              <HardDrive className="h-4 w-4 text-blue-500" />
              <span>Desktop</span>
            </div>
            <div className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
              <Download className="h-4 w-4 text-green-500" />
              <span>Downloads</span>
            </div>
            <div className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
              <File className="h-4 w-4 text-blue-500" />
              <span>Documents</span>
            </div>
            <div className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-gray-700 rounded">
              <Cloud className="h-4 w-4 text-blue-500" />
              <span>Dropbox</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 pt-12">
        <div className="h-full overflow-auto">
          {/* File List */}
          <div className="p-4">
            <div className="space-y-0">
              {mockData.map((item) => (
                <ContextMenu key={item.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer rounded transition-colors ${
                        selectedItems.includes(item.id) 
                          ? 'bg-blue-50 dark:bg-blue-900/20' 
                          : ''
                      }`}
                      onClick={() => handleItemSelect(item.id)}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {getFileIcon(item.type, item.name)}
                        <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                          {item.name}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                          <div className="w-4 h-4 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                        </div>
                        <div className="w-16 text-right">
                          {item.size}
                        </div>
                      </div>
                    </div>
                  </ContextMenuTrigger>

                  <ContextMenuContent className="w-56">
                    {item.type === 'csv' && (
                      <>
                        <ContextMenuItem onClick={() => handleImportCsv(item)}>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}