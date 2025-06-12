import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, Clock, AlertCircle, ArrowLeft, Database, FileDown, Zap, Eye } from "lucide-react";

interface ImportStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime?: string;
  endTime?: string;
  details?: any;
  error?: string;
}

interface ImportExecution {
  id: number;
  jobId: number;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  steps: ImportStep[];
  results?: {
    tableName: string;
    totalRows: number;
    datasetName: string;
    preview: Record<string, any>[];
    columns: { name: string; type: string; }[];
  };
}

export default function ImportStatus() {
  const { jobId } = useParams();
  const [, setLocation] = useLocation();
  const [progress, setProgress] = useState(0);

  const { data: execution, isLoading } = useQuery({
    queryKey: ["/api/jobs", jobId, "execution"],
    refetchInterval: (data: any) => {
      // Stop polling when execution is complete
      return data?.status === 'running' ? 2000 : false;
    },
  }) as { data: ImportExecution | undefined, isLoading: boolean };

  useEffect(() => {
    if (execution?.steps) {
      const completedSteps = execution.steps.filter(step => step.status === 'completed').length;
      const totalSteps = execution.steps.length;
      setProgress((completedSteps / totalSteps) * 100);
    }
  }, [execution]);

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'running':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStepDuration = (step: ImportStep) => {
    if (!step.startTime) return '';
    if (!step.endTime) return 'Running...';
    
    const start = new Date(step.startTime);
    const end = new Date(step.endTime);
    const duration = Math.round((end.getTime() - start.getTime()) / 1000);
    return `${duration}s`;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="ghost" onClick={() => setLocation('/jobs')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Jobs
          </Button>
          <h1 className="text-2xl font-bold">Import Status</h1>
        </div>
        <div className="text-center py-8">Loading execution details...</div>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          <Button variant="ghost" onClick={() => setLocation('/jobs')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Jobs
          </Button>
          <h1 className="text-2xl font-bold">Import Status</h1>
        </div>
        <div className="text-center py-8 text-gray-500">Execution not found</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => setLocation('/jobs')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Jobs
          </Button>
          <h1 className="text-2xl font-bold">Import Status</h1>
          <Badge variant={execution.status === 'completed' ? 'default' : execution.status === 'failed' ? 'destructive' : 'secondary'}>
            {execution.status}
          </Badge>
        </div>
        <div className="text-sm text-gray-500">
          Job ID: {jobId}
        </div>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="w-5 h-5" />
            <span>Execution Progress</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>Overall Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="w-full" />
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Started: {new Date(execution.startTime).toLocaleString()}</span>
              {execution.endTime && (
                <span>Completed: {new Date(execution.endTime).toLocaleString()}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Execution Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileDown className="w-5 h-5" />
            <span>Execution Steps</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {execution.steps.map((step, index) => (
              <div key={step.id} className="flex items-start space-x-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex-shrink-0 mt-1">
                  {getStepIcon(step.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {step.name}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {getStepDuration(step)}
                      </Badge>
                      <Badge variant={step.status === 'completed' ? 'default' : step.status === 'error' ? 'destructive' : 'secondary'}>
                        {step.status}
                      </Badge>
                    </div>
                  </div>
                  {step.details && (
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      {step.details.description || JSON.stringify(step.details, null, 2)}
                    </div>
                  )}
                  {step.error && (
                    <div className="mt-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                      {step.error}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Results Preview */}
      {execution.results && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="w-5 h-5" />
              <span>Import Results</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{execution.results.totalRows}</div>
                  <div className="text-sm text-gray-500">Records Imported</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-lg font-medium text-green-600">{execution.results.tableName}</div>
                  <div className="text-sm text-gray-500">Table Created</div>
                </div>
                <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-lg font-medium text-purple-600">{execution.results.datasetName}</div>
                  <div className="text-sm text-gray-500">Source Dataset</div>
                </div>
              </div>

              {/* Data Preview */}
              {execution.results.preview && execution.results.preview.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Eye className="w-4 h-4" />
                    <h3 className="font-medium">Data Preview (First 10 rows)</h3>
                  </div>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {execution.results.columns.map((col) => (
                            <TableHead key={col.name} className="font-medium">
                              {col.name}
                              <Badge variant="outline" className="ml-2 text-xs">
                                {col.type}
                              </Badge>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {execution.results.preview.slice(0, 10).map((row, index) => (
                          <TableRow key={index}>
                            {execution.results!.columns.map((col) => (
                              <TableCell key={col.name} className="max-w-xs truncate">
                                {row[col.name] ?? '—'}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}