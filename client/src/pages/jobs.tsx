import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, Play, Pause, Trash2, Clock, Calendar, FileText, Database, Settings, Eye, Edit, MoreHorizontal, FolderOpen, Check, List, ChevronDown, ChevronRight, Grid3X3 } from "lucide-react";
// import { S3FileBrowser } from "@/components/s3-file-browser";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { Dataset } from "@shared/schema";

interface Job {
  id: number;
  name: string;
  description: string;
  type: 'import' | 'export' | 'transformation' | 'validation' | 'notification';
  status: 'active' | 'paused' | 'disabled';
  schedule: string; // CRON expression
  lastRun?: string;
  nextRun?: string;
  config: any;
  details?: string; // JSON string containing job details
  createdAt: string;
  updatedAt: string;
}

interface ImportJobConfig {
  s3Bucket: string;
  s3Path: string;
  fileMask: string;
  targetDataset?: string;
  overwriteExisting: boolean;
  validateData: boolean;
  notifyOnCompletion: boolean;
}

const CRON_PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every 30 minutes", value: "*/30 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 2 hours", value: "0 */2 * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 12 hours", value: "0 */12 * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Daily at 6 AM", value: "0 6 * * *" },
  { label: "Daily at 12 PM", value: "0 12 * * *" },
  { label: "Daily at 6 PM", value: "0 18 * * *" },
  { label: "Weekly (Sunday)", value: "0 0 * * 0" },
  { label: "Weekly (Monday)", value: "0 0 * * 1" },
  { label: "Monthly (1st)", value: "0 0 1 * *" },
  { label: "Custom", value: "custom" }
];

const JOB_TYPES = [
  { value: 'import', label: 'Data Import', icon: Database, description: 'Import data from S3 or other sources' },
  { value: 'export', label: 'Data Export', icon: FileText, description: 'Export data to external destinations' },
  { value: 'transformation', label: 'Data Transformation', icon: Settings, description: 'Apply transformations to datasets' },
  { value: 'validation', label: 'Data Validation', icon: Eye, description: 'Validate data quality and integrity' },
  { value: 'notification', label: 'Notification', icon: Calendar, description: 'Send notifications and alerts' }
];

// File mask template variables
const FILE_MASK_VARIABLES = [
  { 
    variable: '{{YYYY}}', 
    description: 'Four-digit year (2025)', 
    example: 'data_{{YYYY}}.csv → data_2025.csv' 
  },
  { 
    variable: '{{YY}}', 
    description: 'Two-digit year (25)', 
    example: 'report_{{YY}}.xlsx → report_25.xlsx' 
  },
  { 
    variable: '{{MM}}', 
    description: 'Two-digit month (01-12)', 
    example: 'sales_{{MM}}.csv → sales_01.csv' 
  },
  { 
    variable: '{{DD}}', 
    description: 'Two-digit day (01-31)', 
    example: 'daily_{{DD}}.json → daily_15.json' 
  },
  { 
    variable: '{{MM-DD-YYYY}}', 
    description: 'US date format', 
    example: 'log_{{MM-DD-YYYY}}.txt → log_01-15-2025.txt' 
  },
  { 
    variable: '{{YYYY-MM-DD}}', 
    description: 'ISO date format', 
    example: 'backup_{{YYYY-MM-DD}}.sql → backup_2025-01-15.sql' 
  },
  { 
    variable: '{{HH}}', 
    description: 'Two-digit hour (00-23)', 
    example: 'hourly_{{HH}}.csv → hourly_14.csv' 
  },
  { 
    variable: '{{mm}}', 
    description: 'Two-digit minute (00-59)', 
    example: 'stream_{{HH}}_{{mm}}.log → stream_14_30.log' 
  },
  { 
    variable: '{{WEEK}}', 
    description: 'Week number (01-53)', 
    example: 'weekly_{{WEEK}}.xlsx → weekly_03.xlsx' 
  },
  { 
    variable: '{{QUARTER}}', 
    description: 'Quarter number (Q1-Q4)', 
    example: 'quarterly_{{QUARTER}}.csv → quarterly_Q1.csv' 
  }
];

// Cron expression examples for autocomplete
const CRON_EXAMPLES = [
  { value: '0 0 * * *', description: 'Daily at midnight' },
  { value: '0 9 * * *', description: 'Daily at 9:00 AM' },
  { value: '0 18 * * *', description: 'Daily at 6:00 PM' },
  { value: '0 0 * * 1', description: 'Weekly on Monday at midnight' },
  { value: '0 9 * * 1-5', description: 'Weekdays at 9:00 AM' },
  { value: '0 0 1 * *', description: 'Monthly on the 1st at midnight' },
  { value: '0 0 1 1 *', description: 'Yearly on January 1st at midnight' },
  { value: '*/15 * * * *', description: 'Every 15 minutes' },
  { value: '0 */2 * * *', description: 'Every 2 hours' },
  { value: '0 0 */3 * *', description: 'Every 3 days at midnight' }
];

// Popular file mask presets
const FILE_MASK_PRESETS = [
  {
    name: 'Daily Files',
    masks: [
      'data_{{YYYY-MM-DD}}.csv',
      'daily_{{MM-DD-YYYY}}.xlsx',
      'log_{{YYYY}}{{MM}}{{DD}}.txt',
      'export_{{DD}}_{{MM}}_{{YY}}.json'
    ]
  },
  {
    name: 'Monthly Reports',
    masks: [
      'report_{{YYYY}}_{{MM}}.xlsx',
      'monthly_{{MM}}_{{YYYY}}.csv',
      'summary_{{YYYY}}{{MM}}.pdf'
    ]
  },
  {
    name: 'Timestamped Files',
    masks: [
      'backup_{{YYYY-MM-DD}}_{{HH}}_{{mm}}.sql',
      'snapshot_{{YYYY}}{{MM}}{{DD}}{{HH}}{{mm}}.zip',
      'log_{{MM-DD-YYYY}}_{{HH}}{{mm}}.txt'
    ]
  },
  {
    name: 'Financial Data',
    masks: [
      'transactions_{{QUARTER}}_{{YYYY}}.csv',
      'financial_{{MM}}_{{YYYY}}.xlsx',
      'invoice_{{YYYY}}{{MM}}*.pdf'
    ]
  }
];

export default function Jobs() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [showS3Browser, setShowS3Browser] = useState(false);
  const [showDatasetSelector, setShowDatasetSelector] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showFileMaskAutocomplete, setShowFileMaskAutocomplete] = useState(false);
  const [showEditFileMaskAutocomplete, setShowEditFileMaskAutocomplete] = useState(false);
  const [fileMaskCursorPosition, setFileMaskCursorPosition] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list');
  const [jobsExpanded, setJobsExpanded] = useState(true);
  const fileMaskInputRef = useRef<HTMLInputElement>(null);
  const editFileMaskInputRef = useRef<HTMLInputElement>(null);
  
  const [newJob, setNewJob] = useState({
    name: '',
    description: '',
    type: 'import' as Job['type'],
    schedule: '0 0 * * *',
    customCron: '',
    config: {} as any
  });
  const [editJob, setEditJob] = useState({
    name: '',
    description: '',
    type: 'import' as Job['type'],
    schedule: '0 0 * * *',
    customCron: '',
    config: {} as any
  });
  const [selectedPreset, setSelectedPreset] = useState('0 0 * * *');
  const [editSelectedPreset, setEditSelectedPreset] = useState('0 0 * * *');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Helper function to safely parse job details
  const parseJobDetails = (job: any) => {
    try {
      const details = job.details ? JSON.parse(job.details) : {};
      return {
        name: details.name || details.jobName || 'Unnamed Job',
        description: details.description || '',
        schedule: details.schedule || details.cronExpression || job.schedule || 'Not set',
        config: details.config || {},
        ...details
      };
    } catch (error) {
      console.warn('Failed to parse job details:', error);
      return {
        name: 'Unnamed Job',
        description: '',
        schedule: 'Not set',
        config: {}
      };
    }
  };

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["/api/jobs"],
  });

  const { data: datasets = [] } = useQuery({
    queryKey: ["/api/datasets"],
  });

  const createJobMutation = useMutation({
    mutationFn: async (jobData: any) => {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(jobData)
      });
      if (!response.ok) throw new Error('Failed to create job');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: "Job created successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error creating job", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const updateJobMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: any }) => {
      const response = await fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update job');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setShowEditDialog(false);
      setEditingJob(null);
      resetEditForm();
      toast({ title: "Job updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating job", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/jobs/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to delete job');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job deleted successfully" });
    }
  });

  const runJobMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/jobs/${id}/run`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to run job');
      return response.json();
    },
    onSuccess: (data, jobId) => {
      toast({ title: "Job execution started" });
      setLocation(`/jobs/${jobId}/status`);
    }
  });

  const resetForm = () => {
    setNewJob({
      name: '',
      description: '',
      type: 'import',
      schedule: '0 0 * * *',
      customCron: '',
      config: {}
    });
    setSelectedPreset('0 0 * * *');
  };

  const resetEditForm = () => {
    setEditJob({
      name: '',
      description: '',
      type: 'import',
      schedule: '0 0 * * *',
      customCron: '',
      config: {}
    });
    setEditSelectedPreset('0 0 * * *');
  };

  const handleToggleJob = async (jobId: number, newStatus: 'active' | 'paused') => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) throw new Error('Failed to update job');
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: `Job ${newStatus === 'active' ? 'activated' : 'paused'} successfully` });
    } catch (error) {
      toast({ title: "Failed to update job", variant: "destructive" });
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    try {
      await deleteJobMutation.mutateAsync(jobId);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const openEditDialog = (job: Job) => {
    let jobDetails = {};
    
    // Safely parse job details JSON
    try {
      jobDetails = job.details ? JSON.parse(job.details) : {};
    } catch (error) {
      console.warn('Failed to parse job details JSON, using defaults:', error);
      jobDetails = {};
    }
    
    setEditingJob(job);
    setEditJob({
      name: (jobDetails as any).name || job.name || `Job ${job.id}`,
      description: (jobDetails as any).description || job.description || '',
      type: job.type,
      schedule: (jobDetails as any).schedule || job.schedule || '0 0 * * *',
      customCron: '',
      config: (jobDetails as any).config || {}
    });
    setEditSelectedPreset((jobDetails as any).schedule || job.schedule || '0 0 * * *');
    setIsEditMode(true);
    setShowEditDialog(true);
  };

  const handleFileMaskInput = (value: string, isEdit: boolean = false) => {
    // Update the job config first
    if (isEdit) {
      setEditJob(prev => ({
        ...prev,
        config: { ...prev.config, fileMask: value }
      }));
    } else {
      setNewJob(prev => ({
        ...prev,
        config: { ...prev.config, fileMask: value }
      }));
    }

    // Check if user typed "{{" to trigger autocomplete - use timeout to get updated cursor position
    setTimeout(() => {
      const inputRef = isEdit ? editFileMaskInputRef : fileMaskInputRef;
      const cursorPos = inputRef.current?.selectionStart || 0;
      
      if (value.slice(cursorPos - 2, cursorPos) === '{{') {
        setFileMaskCursorPosition(cursorPos);
        if (isEdit) {
          setShowEditFileMaskAutocomplete(true);
        } else {
          setShowFileMaskAutocomplete(true);
        }
      }
    }, 0);
  };

  const insertFileMaskVariable = (variable: string, isEdit: boolean = false) => {
    const inputRef = isEdit ? editFileMaskInputRef : fileMaskInputRef;
    const currentValue = isEdit ? editJob.config.fileMask || '' : newJob.config.fileMask || '';
    
    if (inputRef.current) {
      const cursorPos = inputRef.current.selectionStart || 0;
      const beforeCursor = currentValue.slice(0, cursorPos - 2); // Remove the "{{"
      const afterCursor = currentValue.slice(cursorPos);
      const newValue = beforeCursor + variable + afterCursor;
      
      if (isEdit) {
        setEditJob(prev => ({
          ...prev,
          config: { ...prev.config, fileMask: newValue }
        }));
        setShowEditFileMaskAutocomplete(false);
      } else {
        setNewJob(prev => ({
          ...prev,
          config: { ...prev.config, fileMask: newValue }
        }));
        setShowFileMaskAutocomplete(false);
      }
      
      // Focus back to input and set cursor position
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newCursorPos = beforeCursor.length + variable.length;
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 100);
    }
  };

  const selectPresetMask = (mask: string, isEdit: boolean = false) => {
    if (isEdit) {
      setEditJob(prev => ({
        ...prev,
        config: { ...prev.config, fileMask: mask }
      }));
      setShowEditFileMaskAutocomplete(false);
    } else {
      setNewJob(prev => ({
        ...prev,
        config: { ...prev.config, fileMask: mask }
      }));
      setShowFileMaskAutocomplete(false);
    }
  };

  const handleDatasetSelection = (dataset: any) => {
    // Extract S3 bucket and path from dataset fields
    const bucket = dataset.s3Bucket || '';
    const s3Key = dataset.s3Key || '';
    
    // Parse path and filename from S3 key
    const keyParts = s3Key.split('/');
    const filename = keyParts[keyParts.length - 1] || '';
    const path = keyParts.length > 1 ? keyParts.slice(0, -1).join('/') : '';
    
    if (isEditMode) {
      setEditJob(prev => ({
        ...prev,
        config: {
          ...prev.config,
          datasetId: dataset.id,
          s3Bucket: bucket,
          s3Path: path,
          fileMask: filename || '*.csv'
        }
      }));
    } else {
      setNewJob(prev => ({
        ...prev,
        config: {
          ...prev.config,
          datasetId: dataset.id,
          s3Bucket: bucket,
          s3Path: path,
          fileMask: filename || '*.csv'
        }
      }));
    }
    
    setShowDatasetSelector(false);
    setIsEditMode(false);
  };

  const handleCreateJob = () => {
    const schedule = selectedPreset === 'custom' ? newJob.customCron : selectedPreset;
    
    const jobData = {
      ...newJob,
      schedule,
      status: 'active'
    };

    createJobMutation.mutate(jobData);
  };

  const handleUpdateJob = () => {
    if (!editingJob) return;
    
    const schedule = editSelectedPreset === 'custom' ? editJob.customCron : editSelectedPreset;
    
    const jobData = {
      name: editJob.name,
      description: editJob.description,
      type: editJob.type,
      schedule,
      config: editJob.config
    };

    updateJobMutation.mutate({ id: editingJob.id, data: jobData });
  };

  const handleScheduleChange = (value: string) => {
    setSelectedPreset(value);
    if (value !== 'custom') {
      setNewJob(prev => ({ ...prev, schedule: value }));
    }
  };

  const handleS3LocationSelect = (bucket: string, path: string) => {
    setNewJob(prev => ({
      ...prev,
      config: {
        ...prev.config,
        s3Bucket: bucket,
        s3Path: path
      }
    }));
    setShowS3Browser(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'paused': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'disabled': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getTypeIcon = (type: string) => {
    const jobType = JOB_TYPES.find(t => t.value === type);
    const Icon = jobType?.icon || Database;
    return <Icon className="h-4 w-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const ImportJobConfig = () => (
    <div className="space-y-4">
      <div>
        <Label>Data Source</Label>
        <div className="flex items-center space-x-2 mt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowS3Browser(true)}
            className="flex-1"
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            Browse S3 Location
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsEditMode(false);
              setShowDatasetSelector(true);
            }}
            className="flex-1"
          >
            <Database className="h-4 w-4 mr-2" />
            Use Existing Dataset
          </Button>
        </div>
        {(newJob.config.s3Bucket || newJob.config.s3Path) && (
          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
            <strong>S3 Location:</strong> s3://{newJob.config.s3Bucket}{newJob.config.s3Path ? `/${newJob.config.s3Path}` : ''}
          </div>
        )}
      </div>

      <div className="relative">
        <Label htmlFor="file-mask">File Mask</Label>
        <div className="relative mt-1">
          <Input
            ref={fileMaskInputRef}
            id="file-mask"
            value={newJob.config.fileMask || ''}
            onChange={(e) => handleFileMaskInput(e.target.value)}
            placeholder="Type {{ for template variables or *.csv for wildcards"
            className="pr-10"
          />
          <Popover open={showFileMaskAutocomplete} onOpenChange={setShowFileMaskAutocomplete}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 w-8 p-0"
                onClick={() => setShowFileMaskAutocomplete(!showFileMaskAutocomplete)}
              >
                <Calendar className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search variables and presets..." />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  <CommandGroup heading="Template Variables">
                    {FILE_MASK_VARIABLES.map((item) => (
                      <CommandItem
                        key={item.variable}
                        onSelect={() => insertFileMaskVariable(item.variable)}
                        className="flex flex-col items-start py-3"
                      >
                        <div className="font-mono text-sm font-bold">{item.variable}</div>
                        <div className="text-xs text-gray-500">{item.description}</div>
                        <div className="text-xs text-blue-600 mt-1">{item.example}</div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {FILE_MASK_PRESETS.map((preset) => (
                    <CommandGroup key={preset.name} heading={preset.name}>
                      {preset.masks.map((mask) => (
                        <CommandItem
                          key={mask}
                          onSelect={() => selectPresetMask(mask)}
                          className="font-mono text-sm"
                        >
                          {mask}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Use template variables like YYYY, MM, DD for dates, or * for wildcards. Type two opening braces for autocomplete.
        </p>
      </div>

      <div>
        <Label htmlFor="target-dataset">Target Dataset (Optional)</Label>
        <Input
          id="target-dataset"
          value={newJob.config.targetDataset || ''}
          onChange={(e) => setNewJob(prev => ({
            ...prev,
            config: { ...prev.config, targetDataset: e.target.value }
          }))}
          placeholder="Leave empty to create new dataset"
          className="mt-1"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="overwrite"
          checked={newJob.config.overwriteExisting || false}
          onCheckedChange={(checked) => setNewJob(prev => ({
            ...prev,
            config: { ...prev.config, overwriteExisting: checked }
          }))}
        />
        <Label htmlFor="overwrite">Overwrite existing data</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="validate"
          checked={newJob.config.validateData || true}
          onCheckedChange={(checked) => setNewJob(prev => ({
            ...prev,
            config: { ...prev.config, validateData: checked }
          }))}
        />
        <Label htmlFor="validate">Validate data on import</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="notify"
          checked={newJob.config.notifyOnCompletion || false}
          onCheckedChange={(checked) => setNewJob(prev => ({
            ...prev,
            config: { ...prev.config, notifyOnCompletion: checked }
          }))}
        />
        <Label htmlFor="notify">Notify on completion</Label>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Scheduled Jobs</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-none">
          
          {/* View Toggle Card */}
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Manage automated tasks and data processing schedules
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant={viewMode === 'cards' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('cards')}
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Job
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Active Jobs List */}
          <Collapsible open={jobsExpanded} onOpenChange={setJobsExpanded} className="mb-6">
            <div className="mb-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    Active Jobs ({(jobs as Job[]).length})
                  </span>
                </div>
                {jobsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              {isLoading ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <div className="text-gray-500 dark:text-gray-400">Loading jobs...</div>
                  </CardContent>
                </Card>
              ) : (jobs as Job[]).length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Clock className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                      No scheduled jobs yet
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      Create your first automated job to get started with data processing
                    </p>
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Job
                    </Button>
                  </CardContent>
                </Card>
              ) : viewMode === 'list' ? (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Schedule</TableHead>
                            <TableHead>Last Run</TableHead>
                            <TableHead>Next Run</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(jobs as Job[]).map((job) => {
                            const details = parseJobDetails(job.details);
                            const jobName = details?.name || job.name || 'Unnamed Job';
                            const jobSchedule = details?.schedule || job.schedule || 'No schedule';
                            
                            return (
                              <TableRow key={job.id}>
                                <TableCell className="font-medium">{jobName}</TableCell>
                                <TableCell>
                                  <div className="flex items-center space-x-2">
                                    {(() => {
                                      const jobType = JOB_TYPES.find(t => t.value === job.type);
                                      if (jobType?.icon) {
                                        const IconComponent = jobType.icon;
                                        return <IconComponent className="h-4 w-4" />;
                                      }
                                      return null;
                                    })()}
                                    <span>{JOB_TYPES.find(t => t.value === job.type)?.label || job.type}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    job.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                    job.status === 'paused' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                    'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                  }`}>
                                    {job.status}
                                  </span>
                                </TableCell>
                                <TableCell className="font-mono text-sm">{jobSchedule}</TableCell>
                                <TableCell>{job.lastRun ? new Date(job.lastRun).toLocaleDateString() : 'Never'}</TableCell>
                                <TableCell>{job.nextRun ? new Date(job.nextRun).toLocaleDateString() : 'Not scheduled'}</TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end space-x-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openEditDialog(job)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleToggleJob(job.id, job.status === 'active' ? 'paused' : 'active')}
                                    >
                                      {job.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleDeleteJob(job.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {(jobs as Job[]).map((job) => {
                    const details = parseJobDetails(job.details);
                    const jobName = details?.name || job.name || 'Unnamed Job';
                    const jobSchedule = details?.schedule || job.schedule || 'No schedule';
                    
                    return (
                      <Card key={job.id} className="hover:shadow-lg transition-shadow duration-200">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base flex items-center space-x-2">
                              {(() => {
                                const jobType = JOB_TYPES.find(t => t.value === job.type);
                                if (jobType?.icon) {
                                  const IconComponent = jobType.icon;
                                  return <IconComponent className="h-4 w-4" />;
                                }
                                return null;
                              })()}
                              <span>{jobName}</span>
                            </CardTitle>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              job.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                              job.status === 'paused' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                            }`}>
                              {job.status}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {job.description}
                            </div>
                            <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                              <Clock className="h-3 w-3" />
                              <span className="font-mono">{jobSchedule}</span>
                            </div>
                            <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                              <Calendar className="h-3 w-3" />
                              <span>Last: {job.lastRun ? new Date(job.lastRun).toLocaleDateString() : 'Never'}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-end space-x-2 mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(job)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleJob(job.id, job.status === 'active' ? 'paused' : 'active')}
                            >
                              {job.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteJob(job.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>


        </div>
      </div>

      {/* Create Job Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Scheduled Job</DialogTitle>
          </DialogHeader>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="job-name">Job Name</Label>
                  <Input
                    id="job-name"
                    value={newJob.name}
                    onChange={(e) => setNewJob(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter job name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="job-type">Job Type</Label>
                  <Select value={newJob.type} onValueChange={(value: Job['type']) => setNewJob(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center space-x-2">
                            <type.icon className="h-4 w-4" />
                            <span>{type.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newJob.description}
                  onChange={(e) => setNewJob(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this job does"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Schedule</Label>
                <div className="mt-1 space-y-2">
                  <Select value={selectedPreset} onValueChange={handleScheduleChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CRON_PRESETS.map(preset => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  {selectedPreset === 'custom' && (
                    <div>
                      <Input
                        value={newJob.customCron}
                        onChange={(e) => setNewJob(prev => ({ ...prev, customCron: e.target.value }))}
                        placeholder="* * * * * (minute hour day month weekday)"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Format: minute hour day month weekday. Example: "0 6 * * 1" runs every Monday at 6 AM
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Job Configuration</Label>
                <div className="mt-2 border rounded-lg p-4">
                  {newJob.type === 'import' && <ImportJobConfig />}
                  {newJob.type !== 'import' && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Configuration options for {newJob.type} jobs will be available here
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateJob}
                  disabled={!newJob.name || !newJob.type || createJobMutation.isPending}
                >
                  {createJobMutation.isPending ? 'Creating...' : 'Create Job'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      {/* S3 Browser Dialog */}
      <Dialog open={showS3Browser} onOpenChange={setShowS3Browser}>
        <DialogContent className="max-w-4xl h-[600px]">
          <DialogHeader>
            <DialogTitle>Select S3 Location</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            S3 File Browser coming soon...
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Job Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl" aria-describedby="edit-job-description">
          <DialogHeader>
            <DialogTitle>Edit Job</DialogTitle>
            <p id="edit-job-description" className="text-sm text-gray-600 mt-2">
              Modify job configuration, schedule, and settings.
            </p>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-job-name">Job Name</Label>
                <Input
                  id="edit-job-name"
                  value={editJob.name}
                  onChange={(e) => setEditJob(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter job name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-job-type">Job Type</Label>
                <Select value={editJob.type} onValueChange={(value: Job['type']) => setEditJob(prev => ({ ...prev, type: value }))}>
                  <SelectTrigger id="edit-job-type" className="mt-1">
                    <SelectValue placeholder="Select job type" />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center space-x-2">
                          {type.icon && <type.icon className="h-4 w-4" />}
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-job-description">Description</Label>
              <Textarea
                id="edit-job-description"
                value={editJob.description}
                onChange={(e) => setEditJob(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter job description"
                className="mt-1"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="edit-job-schedule">Schedule (Cron Expression)</Label>
              <div className="mt-1 relative">
                <Input
                  ref={editFileMaskInputRef}
                  id="edit-job-schedule"
                  value={editJob.schedule}
                  onChange={(e) => {
                    setEditJob(prev => ({ ...prev, schedule: e.target.value }));
                    setShowEditFileMaskAutocomplete(true);
                  }}
                  onFocus={() => setShowEditFileMaskAutocomplete(true)}
                  onBlur={() => setTimeout(() => setShowEditFileMaskAutocomplete(false), 200)}
                  placeholder="0 0 * * * (daily at midnight)"
                  className="font-mono"
                />
                {showEditFileMaskAutocomplete && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {CRON_EXAMPLES.map((example, index) => (
                      <div
                        key={index}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => {
                          setEditJob(prev => ({ ...prev, schedule: example.value }));
                          setShowEditFileMaskAutocomplete(false);
                        }}
                      >
                        <div className="font-mono text-sm">{example.value}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{example.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateJob} disabled={updateJobMutation.isPending}>
                {updateJobMutation.isPending ? 'Updating...' : 'Update Job'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dataset Selector Dialog */}
      <Dialog open={showDatasetSelector} onOpenChange={setShowDatasetSelector}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Existing Dataset</DialogTitle>
            <p className="text-sm text-gray-600 mt-2">
              Choose a dataset to use as the data source for this job.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8">Loading datasets...</div>
            ) : (datasets as any[]).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No datasets found. Upload a dataset first.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {(datasets as any[]).map((dataset: any) => (
                  <div
                    key={dataset.id}
                    className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={() => handleDatasetSelection(dataset)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {dataset.name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {dataset.filename} • {dataset.totalRows ? `${dataset.totalRows} rows` : 'No data'}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {new Date(dataset.createdAt).toLocaleDateString()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowDatasetSelector(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
