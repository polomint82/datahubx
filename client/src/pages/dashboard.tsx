import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FileText, ServerCog, Clock, Database, Upload, Wand2, Table, TrendingUp, AlertCircle, CheckCircle, Play, Pause, Settings } from "lucide-react";
import { ImportModal } from "@/components/import-modal";
import { TransformationBuilder } from "@/components/transformation-builder";
import { ActivityFeed } from "@/components/activity-feed";
import { useState } from "react";

export default function Dashboard() {
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTransformModal, setShowTransformModal] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [pipelineStatus, setPipelineStatus] = useState<'running' | 'paused'>('running');

  const { data: stats = {}, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/stats"],
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["/api/jobs"],
  });

  const { data: datasets = [] } = useQuery({
    queryKey: ["/api/datasets"],
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatTime = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return "Just now";
  };

  return (
    <>
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center">
            <div className="ml-4 flex items-center">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Data Management Dashboard
              </h1>
            </div>
          </div>
          

        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-none">
          {/* Stats Overview */}
          <div className="grid lg:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Active Datasets
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {statsLoading ? "..." : (stats as any)?.activeDatasets || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                      <ServerCog className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Transformations
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {statsLoading ? "..." : (stats as any)?.transformations || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                      <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Processing Jobs
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {statsLoading ? "..." : (stats as any)?.processingJobs || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                      <Database className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                        Total Records
                      </dt>
                      <dd className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {statsLoading ? "..." : formatNumber((stats as any)?.totalRecords || 0)}
                      </dd>
                    </dl>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h2>
            <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4">
              <Button
                variant="outline"
                className="h-auto p-6 justify-start text-left hover:shadow-md transition-shadow"
                onClick={() => setShowImportModal(true)}
              >
                <div className="flex items-center w-full">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Upload className="h-5 w-5 text-primary" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Import CSV from S3
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Upload new data for processing
                    </p>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto p-6 justify-start text-left hover:shadow-md transition-shadow"
                onClick={() => setShowTransformModal(true)}
              >
                <div className="flex items-center w-full">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                    <Wand2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Create Transformation
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Build data transformation rules
                    </p>
                  </div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-auto p-6 justify-start text-left hover:shadow-md transition-shadow"
                onClick={() => window.location.href = '/datasets'}
              >
                <div className="flex items-center w-full">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                    <Table className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Browse Datasets
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      View and manage your data
                    </p>
                  </div>
                </div>
              </Button>
            </div>
          </div>

          {/* Recent Activity & System Controls */}
          <div className="grid lg:grid-cols-2 grid-cols-1 gap-6">
            {/* Recent Activity with Infinite Scroll */}
            <ActivityFeed 
              enableInfiniteScroll={true}
              maxHeight="400px"
              initialLimit={15}
              showTitle={true}
              compact={false}
            />

            {/* System Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>System Controls</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Pipeline Status */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Pipeline Status</Label>
                    <Badge variant={pipelineStatus === 'running' ? 'default' : 'secondary'} className="flex items-center space-x-1">
                      {pipelineStatus === 'running' ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          <span>Running</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3 w-3" />
                          <span>Paused</span>
                        </>
                      )}
                    </Badge>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant={pipelineStatus === 'running' ? 'outline' : 'default'}
                      onClick={() => setPipelineStatus('running')}
                      className="flex items-center space-x-1"
                    >
                      <Play className="h-3 w-3" />
                      <span>Start</span>
                    </Button>
                    <Button
                      size="sm"
                      variant={pipelineStatus === 'paused' ? 'outline' : 'default'}
                      onClick={() => setPipelineStatus('paused')}
                      className="flex items-center space-x-1"
                    >
                      <Pause className="h-3 w-3" />
                      <span>Pause</span>
                    </Button>
                  </div>
                </div>

                {/* Processing Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Current Processing</Label>
                    <span className="text-sm text-gray-500 dark:text-gray-400">73%</span>
                  </div>
                  <Progress value={73} className="h-2" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Processing transformation batch 3 of 5
                  </p>
                </div>

                {/* Settings Toggles */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Auto-Sync S3</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Automatically sync new files from S3 buckets
                      </p>
                    </div>
                    <Switch
                      checked={autoSync}
                      onCheckedChange={setAutoSync}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Email Notifications</Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Receive alerts for job completions and errors
                      </p>
                    </div>
                    <Switch
                      checked={notifications}
                      onCheckedChange={setNotifications}
                    />
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Performance Overview</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600 dark:text-green-400">98.2%</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Uptime</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">2.3s</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Avg Response</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ImportModal open={showImportModal} onOpenChange={setShowImportModal} />
      <TransformationBuilder open={showTransformModal} onOpenChange={setShowTransformModal} />
    </>
  );
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
