import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Play, Pause, Settings, Calendar, Clock, Database, Zap, Upload, CheckCircle, AlertCircle, Plus, RotateCcw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Pipeline {
  id: number;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'archived';
  lastRunAt?: string;
  nextRunAt?: string;
  runCount: number;
  successCount: number;
  failureCount: number;
  schedule?: {
    enabled: boolean;
    cronExpression?: string;
    timezone: string;
  };
  createdAt: string;
}

interface PipelineRun {
  id: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  triggerType: 'manual' | 'scheduled' | 'webhook' | 'file_trigger';
  startedAt: string;
  completedAt?: string;
  duration?: number;
  error?: string;
}

export default function Pipelines() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [automationDialogOpen, setAutomationDialogOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [pipelineName, setPipelineName] = useState("");
  const [pipelineDescription, setPipelineDescription] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [cronExpression, setCronExpression] = useState("0 9 * * *");
  const [timezone, setTimezone] = useState("UTC");
  const [triggerType, setTriggerType] = useState<'file_upload' | 'data_change' | 'time_interval' | 'webhook'>('file_upload');
  const [triggerConfig, setTriggerConfig] = useState<any>({});
  const { toast } = useToast();

  // Fetch pipelines
  const { data: pipelines = [], isLoading: pipelinesLoading } = useQuery({
    queryKey: ['/api/pipelines'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/pipelines');
      return await response.json();
    },
  });

  // Fetch pipeline runs for selected pipeline
  const { data: pipelineRuns = [] } = useQuery({
    queryKey: ['/api/pipelines', selectedPipeline?.id, 'runs'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/pipelines/${selectedPipeline?.id}/runs`);
      return await response.json();
    },
    enabled: !!selectedPipeline,
  });

  // Create pipeline mutation
  const createPipelineMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/pipelines', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Pipeline created",
        description: "Data pipeline has been created successfully.",
      });
      setCreateDialogOpen(false);
      setPipelineName("");
      setPipelineDescription("");
      setScheduleEnabled(false);
      setCronExpression("0 9 * * *");
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create pipeline",
        description: error.message || "Could not create data pipeline.",
        variant: "destructive",
      });
    },
  });

  // Run pipeline mutation
  const runPipelineMutation = useMutation({
    mutationFn: async (pipelineId: number) => {
      const response = await apiRequest('POST', `/api/pipelines/${pipelineId}/run`, {
        triggerType: 'manual',
      });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Pipeline started",
        description: "Pipeline execution has been triggered successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
      if (selectedPipeline) {
        queryClient.invalidateQueries({ queryKey: ['/api/pipelines', selectedPipeline.id, 'runs'] });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Failed to run pipeline",
        description: error.message || "Could not start pipeline execution.",
        variant: "destructive",
      });
    },
  });

  // Toggle pipeline status mutation
  const togglePipelineMutation = useMutation({
    mutationFn: async ({ pipelineId, status }: { pipelineId: number; status: string }) => {
      const response = await apiRequest('PATCH', `/api/pipelines/${pipelineId}`, { status });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Pipeline updated",
        description: "Pipeline status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update pipeline",
        description: error.message || "Could not update pipeline status.",
        variant: "destructive",
      });
    },
  });

  // Schedule pipeline mutation
  const schedulePipelineMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', `/api/pipelines/${selectedPipeline?.id}/schedule`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Schedule updated",
        description: "Pipeline schedule has been configured successfully.",
      });
      setScheduleDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update schedule",
        description: error.message || "Could not configure pipeline schedule.",
        variant: "destructive",
      });
    },
  });

  // Create automation trigger mutation
  const createAutomationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', `/api/pipelines/${selectedPipeline?.id}/triggers`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Automation created",
        description: "Automation trigger has been configured successfully.",
      });
      setAutomationDialogOpen(false);
      setTriggerConfig({});
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create automation",
        description: error.message || "Could not configure automation trigger.",
        variant: "destructive",
      });
    },
  });

  const handleCreatePipeline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pipelineName.trim()) return;

    createPipelineMutation.mutate({
      name: pipelineName,
      description: pipelineDescription,
      schedule: scheduleEnabled ? {
        enabled: true,
        cronExpression,
        timezone
      } : null
    });
  };

  const handleSchedulePipeline = (e: React.FormEvent) => {
    e.preventDefault();
    
    schedulePipelineMutation.mutate({
      enabled: scheduleEnabled,
      cronExpression: scheduleEnabled ? cronExpression : null,
      timezone
    });
  };

  const handleCreateAutomation = (e: React.FormEvent) => {
    e.preventDefault();

    createAutomationMutation.mutate({
      triggerType,
      config: triggerConfig,
      enabled: true
    });
  };

  const formatScheduleDescription = (cronExpression: string) => {
    const scheduleMap: Record<string, string> = {
      "0 9 * * *": "Daily at 9:00 AM",
      "0 12 * * *": "Daily at 12:00 PM", 
      "0 18 * * *": "Daily at 6:00 PM",
      "0 9 * * 1": "Weekly on Monday at 9:00 AM",
      "0 9 1 * *": "Monthly on 1st at 9:00 AM",
      "0 0 * * *": "Daily at midnight"
    };
    return scheduleMap[cronExpression] || cronExpression;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Play className="h-4 w-4" />;
      case 'paused': return <Pause className="h-4 w-4" />;
      case 'running': return <Clock className="h-4 w-4 animate-spin" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'paused': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'running': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatSchedule = (schedule?: any) => {
    if (!schedule || !schedule.enabled) return 'No schedule';
    return formatScheduleDescription(schedule.cronExpression || '0 9 * * *');
  };

  return (
    <div className="w-full max-w-none py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Database className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Data Pipelines</h1>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Pipeline
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Data Pipeline</DialogTitle>
              <DialogDescription>
                Create a new automated data processing pipeline.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreatePipeline} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Pipeline Name</Label>
                <Input
                  id="name"
                  placeholder="Daily Sales Data Import"
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Imports sales data from S3 and processes it daily..."
                  value={pipelineDescription}
                  onChange={(e) => setPipelineDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="schedule"
                    checked={scheduleEnabled}
                    onChange={(e) => setScheduleEnabled(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="schedule">Enable Scheduling</Label>
                </div>
                {scheduleEnabled && (
                  <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                    <div className="space-y-2">
                      <Label htmlFor="cronExpression">Schedule</Label>
                      <Select value={cronExpression} onValueChange={setCronExpression}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select schedule" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0 9 * * *">Daily at 9:00 AM</SelectItem>
                          <SelectItem value="0 12 * * *">Daily at 12:00 PM</SelectItem>
                          <SelectItem value="0 18 * * *">Daily at 6:00 PM</SelectItem>
                          <SelectItem value="0 9 * * 1">Weekly on Monday at 9:00 AM</SelectItem>
                          <SelectItem value="0 9 1 * *">Monthly on 1st at 9:00 AM</SelectItem>
                          <SelectItem value="0 0 * * *">Daily at midnight</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UTC">UTC</SelectItem>
                          <SelectItem value="America/New_York">Eastern Time</SelectItem>
                          <SelectItem value="America/Chicago">Central Time</SelectItem>
                          <SelectItem value="America/Denver">Mountain Time</SelectItem>
                          <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                          <SelectItem value="Europe/London">London</SelectItem>
                          <SelectItem value="Europe/Paris">Paris</SelectItem>
                          <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createPipelineMutation.isPending}>
                  {createPipelineMutation.isPending ? "Creating..." : "Create Pipeline"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipelines List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Active Pipelines</CardTitle>
              <CardDescription>Manage your automated data processing workflows</CardDescription>
            </CardHeader>
            <CardContent>
              {pipelinesLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg animate-pulse">
                      <div className="h-10 w-10 bg-gray-300 rounded-lg"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-300 rounded w-1/3"></div>
                        <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : pipelines.length === 0 ? (
                <div className="text-center py-8">
                  <Database className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No pipelines yet</p>
                  <p className="text-sm text-gray-500 mb-4">Create your first automated data pipeline to get started.</p>
                  <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Pipeline
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {pipelines.map((pipeline: Pipeline) => (
                    <div 
                      key={pipeline.id} 
                      className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedPipeline?.id === pipeline.id ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => setSelectedPipeline(pipeline)}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                          <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-gray-100">{pipeline.name}</h3>
                          <p className="text-sm text-gray-500">
                            {formatSchedule(pipeline.schedule)} • {pipeline.runCount} runs
                          </p>
                          {pipeline.lastRunAt && (
                            <p className="text-xs text-gray-400">
                              Last run: {new Date(pipeline.lastRunAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(pipeline.status)}>
                          {getStatusIcon(pipeline.status)}
                          <span className="ml-1 capitalize">{pipeline.status}</span>
                        </Badge>
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              runPipelineMutation.mutate(pipeline.id);
                            }}
                            disabled={runPipelineMutation.isPending}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPipeline(pipeline);
                              setScheduleDialogOpen(true);
                            }}
                          >
                            <Calendar className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPipeline(pipeline);
                              setAutomationDialogOpen(true);
                            }}
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePipelineMutation.mutate({
                                pipelineId: pipeline.id,
                                status: pipeline.status === 'active' ? 'paused' : 'active'
                              });
                            }}
                          >
                            {pipeline.status === 'active' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pipeline Details */}
        <div>
          {selectedPipeline ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="h-5 w-5" />
                    <span>{selectedPipeline.name}</span>
                  </CardTitle>
                  <CardDescription>{selectedPipeline.description || 'No description'}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Status</p>
                        <Badge className={getStatusColor(selectedPipeline.status)}>
                          {getStatusIcon(selectedPipeline.status)}
                          <span className="ml-1 capitalize">{selectedPipeline.status}</span>
                        </Badge>
                      </div>
                      <div>
                        <p className="text-gray-500">Total Runs</p>
                        <p className="font-medium">{selectedPipeline.runCount}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Success Rate</p>
                        <p className="font-medium">
                          {selectedPipeline.runCount > 0 
                            ? Math.round((selectedPipeline.successCount / selectedPipeline.runCount) * 100)
                            : 0}%
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Failures</p>
                        <p className="font-medium text-red-600">{selectedPipeline.failureCount}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="h-5 w-5" />
                    <span>Recent Runs</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pipelineRuns.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No runs yet</p>
                  ) : (
                    <div className="space-y-3">
                      {pipelineRuns.slice(0, 5).map((run: PipelineRun) => (
                        <div key={run.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="flex items-center space-x-2">
                              <Badge className={getStatusColor(run.status)}>
                                {getStatusIcon(run.status)}
                                <span className="ml-1 capitalize">{run.status}</span>
                              </Badge>
                              <span className="text-xs text-gray-500 capitalize">{run.triggerType}</span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(run.startedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">
                              {formatDuration(run.duration)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Select a Pipeline</p>
                  <p className="text-sm text-gray-500">Choose a pipeline from the list to view details and recent runs.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Pipeline</DialogTitle>
            <DialogDescription>
              Configure automated scheduling for {selectedPipeline?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSchedulePipeline} className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="scheduleEnable"
                checked={scheduleEnabled}
                onChange={(e) => setScheduleEnabled(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="scheduleEnable">Enable Scheduling</Label>
            </div>
            {scheduleEnabled && (
              <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                <div className="space-y-2">
                  <Label htmlFor="cronSchedule">Schedule</Label>
                  <Select value={cronExpression} onValueChange={setCronExpression}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select schedule" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0 9 * * *">Daily at 9:00 AM</SelectItem>
                      <SelectItem value="0 12 * * *">Daily at 12:00 PM</SelectItem>
                      <SelectItem value="0 18 * * *">Daily at 6:00 PM</SelectItem>
                      <SelectItem value="0 9 * * 1">Weekly on Monday at 9:00 AM</SelectItem>
                      <SelectItem value="0 9 1 * *">Monthly on 1st at 9:00 AM</SelectItem>
                      <SelectItem value="0 0 * * *">Daily at midnight</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {formatScheduleDescription(cronExpression)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezoneSchedule">Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      <SelectItem value="America/Chicago">Central Time</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                      <SelectItem value="Europe/Paris">Paris</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setScheduleDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={schedulePipelineMutation.isPending}>
                {schedulePipelineMutation.isPending ? "Updating..." : "Update Schedule"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Automation Dialog */}
      <Dialog open={automationDialogOpen} onOpenChange={setAutomationDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Automation Trigger</DialogTitle>
            <DialogDescription>
              Set up automated triggers for {selectedPipeline?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAutomation} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="triggerType">Trigger Type</Label>
              <Select value={triggerType} onValueChange={(value: any) => setTriggerType(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select trigger type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="file_upload">File Upload</SelectItem>
                  <SelectItem value="data_change">Data Change</SelectItem>
                  <SelectItem value="time_interval">Time Interval</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {triggerType === 'file_upload' && (
              <div className="space-y-4 pl-6 border-l-2 border-green-200">
                <div className="space-y-2">
                  <Label htmlFor="watchPath">Watch Path</Label>
                  <Input
                    id="watchPath"
                    placeholder="s3://bucket/path/to/watch/"
                    value={triggerConfig.watchPath || ''}
                    onChange={(e) => setTriggerConfig({...triggerConfig, watchPath: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filePattern">File Pattern</Label>
                  <Input
                    id="filePattern"
                    placeholder="*.csv"
                    value={triggerConfig.filePattern || ''}
                    onChange={(e) => setTriggerConfig({...triggerConfig, filePattern: e.target.value})}
                  />
                </div>
              </div>
            )}

            {triggerType === 'data_change' && (
              <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                <div className="space-y-2">
                  <Label htmlFor="datasetId">Dataset to Monitor</Label>
                  <Input
                    id="datasetId"
                    placeholder="Dataset ID"
                    value={triggerConfig.datasetId || ''}
                    onChange={(e) => setTriggerConfig({...triggerConfig, datasetId: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="changeThreshold">Change Threshold (%)</Label>
                  <Input
                    id="changeThreshold"
                    type="number"
                    placeholder="10"
                    value={triggerConfig.changeThreshold || ''}
                    onChange={(e) => setTriggerConfig({...triggerConfig, changeThreshold: e.target.value})}
                  />
                </div>
              </div>
            )}

            {triggerType === 'time_interval' && (
              <div className="space-y-4 pl-6 border-l-2 border-purple-200">
                <div className="space-y-2">
                  <Label htmlFor="intervalMinutes">Interval (minutes)</Label>
                  <Select 
                    value={triggerConfig.intervalMinutes || '60'} 
                    onValueChange={(value) => setTriggerConfig({...triggerConfig, intervalMinutes: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">Every 5 minutes</SelectItem>
                      <SelectItem value="15">Every 15 minutes</SelectItem>
                      <SelectItem value="30">Every 30 minutes</SelectItem>
                      <SelectItem value="60">Every hour</SelectItem>
                      <SelectItem value="360">Every 6 hours</SelectItem>
                      <SelectItem value="1440">Daily</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {triggerType === 'webhook' && (
              <div className="space-y-4 pl-6 border-l-2 border-orange-200">
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    placeholder="https://api.example.com/webhook"
                    value={triggerConfig.webhookUrl || ''}
                    onChange={(e) => setTriggerConfig({...triggerConfig, webhookUrl: e.target.value})}
                    readOnly
                  />
                  <p className="text-xs text-gray-500">
                    This URL will be generated after creating the trigger
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secretKey">Secret Key</Label>
                  <Input
                    id="secretKey"
                    placeholder="webhook-secret-key"
                    value={triggerConfig.secretKey || ''}
                    onChange={(e) => setTriggerConfig({...triggerConfig, secretKey: e.target.value})}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setAutomationDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createAutomationMutation.isPending}>
                {createAutomationMutation.isPending ? "Creating..." : "Create Trigger"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}