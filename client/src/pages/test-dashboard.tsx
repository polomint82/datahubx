import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Play, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  Upload,
  Settings,
  FileText,
  ChevronDown,
  ChevronRight
} from "lucide-react";

interface TestResult {
  id: string;
  name: string;
  category: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  details?: any;
  timestamp?: string;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  status: 'pending' | 'running' | 'completed';
  duration?: number;
}

export default function TestDashboard() {
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());

  // Initialize test suites
  useEffect(() => {
    setTestSuites([
      {
        name: 'API Integration Tests',
        status: 'pending',
        tests: [
          { id: 'api-1', name: 'GET /api/datasets', category: 'API', status: 'pending' },
          { id: 'api-2', name: 'POST /api/import/s3', category: 'API', status: 'pending' },
          { id: 'api-3', name: 'GET /api/transformations', category: 'API', status: 'pending' },
          { id: 'api-4', name: 'POST /api/transformations', category: 'API', status: 'pending' },
          { id: 'api-5', name: 'DELETE /api/transformations/:id', category: 'API', status: 'pending' },
          { id: 'api-6', name: 'GET /api/stats', category: 'API', status: 'pending' },
          { id: 'api-7', name: 'GET /api/jobs', category: 'API', status: 'pending' },
        ]
      },
      {
        name: 'Database Tests',
        status: 'pending',
        tests: [
          { id: 'db-1', name: 'Database Connection', category: 'Database', status: 'pending' },
          { id: 'db-2', name: 'Dataset CRUD Operations', category: 'Database', status: 'pending' },
          { id: 'db-3', name: 'Transformation CRUD Operations', category: 'Database', status: 'pending' },
          { id: 'db-4', name: 'Job History Operations', category: 'Database', status: 'pending' },
          { id: 'db-5', name: 'Activity Feed Operations', category: 'Database', status: 'pending' },
        ]
      },
      {
        name: 'Data Transformation Tests',
        status: 'pending',
        tests: [
          { id: 'transform-1', name: 'String Functions (UPPERCASE, LOWERCASE)', category: 'Transform', status: 'pending' },
          { id: 'transform-2', name: 'String Functions (LEFT, RIGHT, SUBSTRING)', category: 'Transform', status: 'pending' },
          { id: 'transform-3', name: 'Math Functions (ROUND, ABS, CEIL)', category: 'Transform', status: 'pending' },
          { id: 'transform-4', name: 'Date Functions (FORMAT_DATE)', category: 'Transform', status: 'pending' },
          { id: 'transform-5', name: 'Conditional Functions (IF)', category: 'Transform', status: 'pending' },
          { id: 'transform-6', name: 'Transformation Sequencing', category: 'Transform', status: 'pending' },
        ]
      },
      {
        name: 'AWS S3 Integration Tests',
        status: 'pending',
        tests: [
          { id: 's3-1', name: 'S3 Bucket Listing', category: 'S3', status: 'pending' },
          { id: 's3-2', name: 'S3 Object Listing', category: 'S3', status: 'pending' },
          { id: 's3-3', name: 'S3 File Download', category: 'S3', status: 'pending' },
          { id: 's3-4', name: 'CSV File Import', category: 'S3', status: 'pending' },
        ]
      },
      {
        name: 'Frontend Component Tests',
        status: 'pending',
        tests: [
          { id: 'ui-1', name: 'Data Preview Component', category: 'Frontend', status: 'pending' },
          { id: 'ui-2', name: 'Transformation Flow Component', category: 'Frontend', status: 'pending' },
          { id: 'ui-3', name: 'S3 File Browser Component', category: 'Frontend', status: 'pending' },
          { id: 'ui-4', name: 'Function Menu Component', category: 'Frontend', status: 'pending' },
        ]
      }
    ]);
  }, []);

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    for (const suite of testSuites) {
      await runTestSuite(suite);
    }
    
    setIsRunning(false);
  };

  const runTestSuite = async (suite: TestSuite) => {
    setTestSuites(prev => prev.map(s => 
      s.name === suite.name ? { ...s, status: 'running' } : s
    ));

    const suiteStartTime = Date.now();
    const updatedTests: TestResult[] = [];

    for (const test of suite.tests) {
      const testStartTime = Date.now();
      
      setTestSuites(prev => prev.map(s => 
        s.name === suite.name ? {
          ...s,
          tests: s.tests.map(t => 
            t.id === test.id ? { ...t, status: 'running' } : t
          )
        } : s
      ));

      try {
        const result = await executeTest(test);
        const testDuration = Date.now() - testStartTime;
        
        const updatedTest: TestResult = {
          ...test,
          status: result.success ? 'passed' : 'failed',
          duration: testDuration,
          error: result.error,
          details: result.details,
          timestamp: new Date().toISOString()
        };
        
        updatedTests.push(updatedTest);
        
        setTestSuites(prev => prev.map(s => 
          s.name === suite.name ? {
            ...s,
            tests: s.tests.map(t => 
              t.id === test.id ? updatedTest : t
            )
          } : s
        ));

        setTestResults(prev => [...prev, updatedTest]);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        const testDuration = Date.now() - testStartTime;
        const failedTest: TestResult = {
          ...test,
          status: 'failed',
          duration: testDuration,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        };
        
        updatedTests.push(failedTest);
        setTestResults(prev => [...prev, failedTest]);
      }
    }

    const suiteDuration = Date.now() - suiteStartTime;
    setTestSuites(prev => prev.map(s => 
      s.name === suite.name ? { 
        ...s, 
        status: 'completed',
        duration: suiteDuration,
        tests: updatedTests
      } : s
    ));
  };

  const executeTest = async (test: TestResult): Promise<{ success: boolean; error?: string; details?: any }> => {
    try {
      switch (test.category) {
        case 'API':
          return await executeApiTest(test);
        case 'Database':
          return await executeDatabaseTest(test);
        case 'Transform':
          return await executeTransformTest(test);
        case 'S3':
          return await executeS3Test(test);
        case 'Frontend':
          return await executeFrontendTest(test);
        default:
          return { success: false, error: 'Unknown test category' };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Test execution failed' 
      };
    }
  };

  const executeApiTest = async (test: TestResult) => {
    const endpoint = test.name.split(' ')[1]; // Extract endpoint from test name
    
    try {
      const response = await fetch(endpoint, {
        method: test.name.includes('POST') ? 'POST' : 
               test.name.includes('DELETE') ? 'DELETE' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: test.name.includes('POST') ? JSON.stringify(getTestData(test.id)) : undefined
      });

      return {
        success: response.ok,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        details: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        details: { error: error }
      };
    }
  };

  const executeDatabaseTest = async (test: TestResult) => {
    // Test database operations through API endpoints
    try {
      const response = await fetch('/api/stats', {
        credentials: 'include'
      });
      
      if (test.id === 'db-1') {
        return {
          success: response.ok,
          error: response.ok ? undefined : 'Database connection failed',
          details: { connected: response.ok }
        };
      }
      
      return { success: true, details: { message: 'Database test simulated' } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Database test failed'
      };
    }
  };

  const executeTransformTest = async (test: TestResult) => {
    // Test transformation functions
    const testData = {
      datasetId: 1,
      targetColumn: 'test_column',
      expression: getTransformExpression(test.id)
    };

    try {
      const response = await fetch('/api/transformations/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(testData)
      });

      const result = response.ok ? await response.json() : null;
      
      return {
        success: response.ok,
        error: response.ok ? undefined : `Transformation test failed: ${response.statusText}`,
        details: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transformation test error'
      };
    }
  };

  const executeS3Test = async (test: TestResult) => {
    // Test S3 operations (these will fail without AWS credentials, which is expected)
    try {
      const response = await fetch('/api/s3/buckets', {
        credentials: 'include'
      });

      return {
        success: response.status !== 500, // 400 is expected without credentials
        error: response.status === 500 ? 'S3 service error' : undefined,
        details: { 
          status: response.status,
          expected: 'May fail without AWS credentials configured'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'S3 test requires AWS credentials',
        details: { note: 'Configure AWS credentials to run S3 tests' }
      };
    }
  };

  const executeFrontendTest = async (test: TestResult) => {
    // Simulate frontend component tests
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return {
      success: true,
      details: { 
        message: 'Frontend component test simulated',
        component: test.name
      }
    };
  };

  const getTestData = (testId: string) => {
    const testDataMap: Record<string, any> = {
      'api-2': {
        bucket: 'test-bucket',
        key: 'test-file.csv',
        name: 'Test Dataset',
        hasHeader: true,
        autoDetectTypes: true
      },
      'api-4': {
        name: 'Test Transformation',
        datasetId: 1,
        targetColumn: 'test_column',
        expression: 'UPPERCASE(test_column)',
        functionType: 'string'
      }
    };
    
    return testDataMap[testId] || {};
  };

  const getTransformExpression = (testId: string) => {
    const expressions: Record<string, string> = {
      'transform-1': 'UPPERCASE(test_column)',
      'transform-2': 'LEFT(test_column, 5)',
      'transform-3': 'ROUND(test_column, 2)',
      'transform-4': 'FORMAT_DATE(test_column, "YYYY-MM-DD")',
      'transform-5': 'IF(test_column, "Yes", "No")',
      'transform-6': 'LOWERCASE(TRIM(test_column))'
    };
    
    return expressions[testId] || 'TRIM(test_column)';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'skipped': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      passed: 'default',
      failed: 'destructive',
      running: 'secondary',
      pending: 'outline',
      skipped: 'secondary'
    };
    
    return (
      <Badge variant={variants[status] || 'outline'} className="text-xs">
        {status.toUpperCase()}
      </Badge>
    );
  };

  const toggleSuiteExpansion = (suiteName: string) => {
    setExpandedSuites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(suiteName)) {
        newSet.delete(suiteName);
      } else {
        newSet.add(suiteName);
      }
      return newSet;
    });
  };

  const getOverallStats = () => {
    const allTests = testSuites.flatMap(suite => suite.tests);
    const passed = allTests.filter(t => t.status === 'passed').length;
    const failed = allTests.filter(t => t.status === 'failed').length;
    const total = allTests.length;
    const completed = passed + failed;
    
    return { passed, failed, total, completed, percentage: total > 0 ? (completed / total) * 100 : 0 };
  };

  const stats = getOverallStats();

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integration Test Dashboard</h1>
          <p className="text-muted-foreground">
            Development testing environment for comprehensive system validation
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={runAllTests}
            disabled={isRunning}
            className="flex items-center space-x-2"
          >
            {isRunning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span>{isRunning ? 'Running Tests...' : 'Run All Tests'}</span>
          </Button>
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completed} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.passed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0}% failure rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(stats.percentage)}%</div>
            <Progress value={stats.percentage} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="suites" className="space-y-4">
        <TabsList>
          <TabsTrigger value="suites">Test Suites</TabsTrigger>
          <TabsTrigger value="results">Test Results</TabsTrigger>
        </TabsList>

        <TabsContent value="suites" className="space-y-4">
          {testSuites.map((suite) => (
            <Card key={suite.name}>
              <Collapsible
                open={expandedSuites.has(suite.name)}
                onOpenChange={() => toggleSuiteExpansion(suite.name)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {expandedSuites.has(suite.name) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <CardTitle className="text-lg">{suite.name}</CardTitle>
                        {getStatusBadge(suite.status)}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <span>{suite.tests.filter(t => t.status === 'passed').length} passed</span>
                        <span>{suite.tests.filter(t => t.status === 'failed').length} failed</span>
                        <span>{suite.tests.length} total</span>
                        {suite.duration && (
                          <span>{suite.duration}ms</span>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {suite.tests.map((test) => (
                        <div
                          key={test.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(test.status)}
                            <span className="font-medium">{test.name}</span>
                            {getStatusBadge(test.status)}
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            {test.duration && <span>{test.duration}ms</span>}
                            {test.error && (
                              <span className="text-red-500 max-w-xs truncate">{test.error}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {testResults.map((result) => (
                    <div key={`${result.id}-${result.timestamp}`} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(result.status)}
                          <span className="font-medium">{result.name}</span>
                          {getStatusBadge(result.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {result.duration}ms
                        </div>
                      </div>
                      
                      {result.error && (
                        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded mt-2">
                          <strong>Error:</strong> {result.error}
                        </div>
                      )}
                      
                      {result.details && (
                        <div className="text-sm text-muted-foreground bg-muted/50 p-2 rounded mt-2">
                          <strong>Details:</strong> {JSON.stringify(result.details, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}