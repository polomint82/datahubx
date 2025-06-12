import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  FileCheck2, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  Download,
  RefreshCw,
  Eye,
  Clock,
  Target
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Dataset } from "@shared/schema";

interface DataQualityReportProps {
  dataset: Dataset;
  onClose?: () => void;
}

interface DataQualityIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  column: string;
  description: string;
  count: number;
  percentage: number;
  examples?: string[];
  recommendation: string;
}

interface DataQualityMetrics {
  totalRows: number;
  totalColumns: number;
  completenessScore: number;
  consistencyScore: number;
  validityScore: number;
  uniquenessScore: number;
  overallScore: number;
}

interface DataQualityAnalysis {
  metrics: DataQualityMetrics;
  issues: DataQualityIssue[];
  summary: {
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    recommendations: string[];
  };
  columnAnalysis: Record<string, any>;
}

export function DataQualityReport({ dataset, onClose }: DataQualityReportProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentReport, setCurrentReport] = useState<any>(null);
  const { toast } = useToast();

  // Fetch existing quality reports for this dataset
  const { data: existingReports = [], isLoading: reportsLoading } = useQuery({
    queryKey: ['/api/datasets', dataset.id, 'quality-reports'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/datasets/${dataset.id}/quality-reports`);
      return await response.json();
    },
  });

  // Generate quality report mutation
  const generateReportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/datasets/${dataset.id}/quality-report`, {
        includeDetailed: true,
        checkTypes: [
          'missing_values',
          'duplicates', 
          'data_types',
          'outliers',
          'patterns',
          'consistency',
          'completeness',
          'validity'
        ]
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setCurrentReport(data);
      toast({
        title: "Quality report generated",
        description: "Data quality analysis completed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/datasets', dataset.id, 'quality-reports'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to generate report",
        description: error.message || "Could not analyze dataset quality.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateReport = () => {
    setIsGenerating(true);
    generateReportMutation.mutate();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 50) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (score >= 70) return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    return <XCircle className="h-5 w-5 text-red-600" />;
  };

  const analysis: DataQualityAnalysis | null = currentReport?.analysis || (existingReports[0]?.reportData as DataQualityAnalysis) || null;

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6'];

  const chartData = analysis ? [
    { name: 'Completeness', score: analysis.metrics.completenessScore },
    { name: 'Consistency', score: analysis.metrics.consistencyScore },
    { name: 'Validity', score: analysis.metrics.validityScore },
    { name: 'Uniqueness', score: analysis.metrics.uniquenessScore },
  ] : [];

  const issueDistribution = analysis ? [
    { name: 'Critical', value: analysis.summary.criticalIssues, color: '#ef4444' },
    { name: 'High', value: analysis.summary.highIssues, color: '#f97316' },
    { name: 'Medium', value: analysis.summary.mediumIssues, color: '#eab308' },
    { name: 'Low', value: analysis.summary.lowIssues, color: '#3b82f6' },
  ].filter(item => item.value > 0) : [];

  return (
    <div className="w-full max-w-none py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FileCheck2 className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Data Quality Report</h1>
            <p className="text-gray-500">{dataset.name}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleGenerateReport}
            disabled={generateReportMutation.isPending}
            className="flex items-center space-x-2"
          >
            {generateReportMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Target className="h-4 w-4" />
            )}
            <span>{generateReportMutation.isPending ? 'Analyzing...' : 'Generate Report'}</span>
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              <Eye className="h-4 w-4 mr-2" />
              Back to Dataset
            </Button>
          )}
        </div>
      </div>

      {!analysis && existingReports.length === 0 && !generateReportMutation.isPending && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileCheck2 className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No Quality Reports Yet
              </h2>
              <p className="text-gray-500 mb-6">
                Generate your first data quality report to identify issues and get recommendations for improving your data.
              </p>
              <Button onClick={handleGenerateReport} size="lg">
                <Target className="h-5 w-5 mr-2" />
                Generate Quality Report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Overall Score Card */}
          <Card className="lg:col-span-1">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center space-x-2">
                {getScoreIcon(analysis.metrics.overallScore)}
                <span>Overall Score</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className={`text-4xl font-bold ${getScoreColor(analysis.metrics.overallScore)}`}>
                {analysis.metrics.overallScore}%
              </div>
              <Progress 
                value={analysis.metrics.overallScore} 
                className="mt-4"
              />
              <p className="text-sm text-gray-500 mt-2">
                {analysis.metrics.overallScore >= 90 ? 'Excellent' :
                 analysis.metrics.overallScore >= 70 ? 'Good' :
                 analysis.metrics.overallScore >= 50 ? 'Needs Improvement' : 'Poor'}
              </p>
            </CardContent>
          </Card>

          {/* Metrics Cards */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Completeness</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getScoreColor(analysis.metrics.completenessScore)}`}>
                  {analysis.metrics.completenessScore}%
                </div>
                <Progress value={analysis.metrics.completenessScore} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Consistency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getScoreColor(analysis.metrics.consistencyScore)}`}>
                  {analysis.metrics.consistencyScore}%
                </div>
                <Progress value={analysis.metrics.consistencyScore} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Validity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getScoreColor(analysis.metrics.validityScore)}`}>
                  {analysis.metrics.validityScore}%
                </div>
                <Progress value={analysis.metrics.validityScore} className="mt-2" />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {analysis && (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="issues">Issues</TabsTrigger>
            <TabsTrigger value="columns">Columns</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Quality Metrics Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Quality Metrics</CardTitle>
                  <CardDescription>Breakdown of data quality dimensions</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="score" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Issue Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Issue Distribution</CardTitle>
                  <CardDescription>Breakdown of issues by severity</CardDescription>
                </CardHeader>
                <CardContent>
                  {issueDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={issueDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={120}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {issueDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px]">
                      <div className="text-center">
                        <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                        <p className="text-lg font-medium">No Issues Found</p>
                        <p className="text-gray-500">Your data quality is excellent!</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-gray-500">Total Rows</p>
                      <p className="text-2xl font-bold">{analysis.metrics.totalRows.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <FileCheck2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-500">Total Columns</p>
                      <p className="text-2xl font-bold">{analysis.metrics.totalColumns}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="text-sm text-gray-500">Issues Found</p>
                      <p className="text-2xl font-bold">{analysis.issues.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="text-sm text-gray-500">Recommendations</p>
                      <p className="text-2xl font-bold">{analysis.summary.recommendations.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="issues" className="space-y-4">
            {analysis.issues.length > 0 ? (
              analysis.issues.map((issue, index) => (
                <Card key={index}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <Badge className={getSeverityColor(issue.severity)}>
                            {issue.severity.toUpperCase()}
                          </Badge>
                          <span className="text-sm text-gray-500">{issue.column}</span>
                        </div>
                        <h3 className="font-semibold mb-1">{issue.description}</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-3">{issue.recommendation}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Count: {issue.count.toLocaleString()}</span>
                          <span>Percentage: {issue.percentage.toFixed(1)}%</span>
                        </div>
                        {issue.examples && issue.examples.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Examples:</p>
                            <div className="flex flex-wrap gap-2">
                              {issue.examples.map((example, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {example}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      No Issues Found
                    </h2>
                    <p className="text-gray-500">
                      Your dataset has excellent data quality with no issues detected.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="columns" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(analysis.columnAnalysis).map(([columnName, columnData]: [string, any]) => (
                <Card key={columnName}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{columnName}</CardTitle>
                    <CardDescription className="capitalize">{columnData.type}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Completeness</span>
                        <span className="font-medium">{(100 - columnData.nullPercentage).toFixed(1)}%</span>
                      </div>
                      <Progress value={100 - columnData.nullPercentage} />
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Uniqueness</span>
                        <span className="font-medium">{columnData.uniquePercentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={columnData.uniquePercentage} />
                      
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Null values:</span>
                          <span>{columnData.nullCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Unique values:</span>
                          <span>{columnData.uniqueCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Issues:</span>
                          <span>{columnData.issues.length}</span>
                        </div>
                      </div>

                      {columnData.mostCommonValues.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Most Common:</p>
                          <div className="space-y-1">
                            {columnData.mostCommonValues.slice(0, 3).map((item: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span className="truncate flex-1 mr-2">{item.value}</span>
                                <span className="text-gray-500">{item.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            {analysis.summary.recommendations.length > 0 ? (
              analysis.summary.recommendations.map((recommendation, index) => (
                <Alert key={index}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{recommendation}</AlertDescription>
                </Alert>
              ))
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      No Recommendations Needed
                    </h2>
                    <p className="text-gray-500">
                      Your data quality is excellent and no improvements are needed at this time.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Previous Reports */}
      {existingReports.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Previous Reports</span>
            </CardTitle>
            <CardDescription>
              Historical data quality reports for this dataset
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {existingReports.slice(1).map((report: any) => (
                <div key={report.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Quality Score: {report.qualityScore}%</p>
                    <p className="text-sm text-gray-500">
                      {report.issuesFound} issues • {new Date(report.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentReport({ analysis: report.reportData })}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}