import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, AlertCircle, CheckCircle, Info, Download } from "lucide-react";

interface SarifIssue {
  id: string;
  message: string;
  level: 'error' | 'warning' | 'note' | 'info';
  severity: 'High' | 'Medium' | 'Low' | 'Info';
  rule: {
    id: string;
    name?: string;
    description?: string;
    helpUri?: string;
  };
  location: {
    file: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    snippet?: string;
  };
}

interface SarifSummary {
  totalIssues: number;
  severityBreakdown: Record<string, number>;
  ruleBreakdown: Record<string, number>;
  fileBreakdown: Record<string, number>;
}

interface SarifAnalysis {
  summary: SarifSummary;
  issues: SarifIssue[];
  toolInfo: {
    name: string;
    version: string;
  };
}

export function SarifAnalyzer() {
  const [analysis, setAnalysis] = useState<SarifAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedFile, setSelectedFile] = useState<string>("all");

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const sarif = JSON.parse(content);
        const analysis = parseSarifFile(sarif);
        setAnalysis(analysis);
      } catch (err) {
        setError(`Failed to parse SARIF file: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  }, []);

  const parseSarifFile = (sarif: any): SarifAnalysis => {
    const issues: SarifIssue[] = [];
    const summary: SarifSummary = {
      totalIssues: 0,
      severityBreakdown: {},
      ruleBreakdown: {},
      fileBreakdown: {}
    };

    let toolInfo = { name: 'Unknown', version: 'Unknown' };

    if (sarif.runs && sarif.runs.length > 0) {
      const run = sarif.runs[0];
      toolInfo = {
        name: run.tool?.driver?.name || 'Unknown',
        version: run.tool?.driver?.version || 'Unknown'
      };

      const results = run.results || [];
      
      results.forEach((result: any) => {
        const rule = findRule(result.ruleId, run);
        const location = parseLocation(result.locations?.[0]);
        const severity = mapSeverity(result.level);
        
        const issue: SarifIssue = {
          id: result.ruleId || 'unknown',
          message: result.message?.text || result.message?.markdown || 'No message',
          level: result.level || 'warning',
          severity,
          rule: {
            id: result.ruleId,
            name: rule?.name || result.ruleId,
            description: rule?.shortDescription?.text || rule?.fullDescription?.text,
            helpUri: rule?.helpUri
          },
          location
        };

        issues.push(issue);
        
        // Update summary
        summary.totalIssues++;
        summary.severityBreakdown[severity] = (summary.severityBreakdown[severity] || 0) + 1;
        summary.ruleBreakdown[issue.rule.id] = (summary.ruleBreakdown[issue.rule.id] || 0) + 1;
        summary.fileBreakdown[location.file] = (summary.fileBreakdown[location.file] || 0) + 1;
      });
    }

    return { summary, issues, toolInfo };
  };

  const findRule = (ruleId: string, run: any) => {
    if (!ruleId || !run.tool?.driver?.rules) return null;
    return run.tool.driver.rules.find((rule: any) => rule.id === ruleId);
  };

  const parseLocation = (location: any) => {
    if (!location?.physicalLocation) {
      return { file: 'unknown', line: 0, column: 0 };
    }

    const physical = location.physicalLocation;
    return {
      file: physical.artifactLocation?.uri || 'unknown',
      line: physical.region?.startLine || 0,
      column: physical.region?.startColumn || 0,
      endLine: physical.region?.endLine,
      endColumn: physical.region?.endColumn,
      snippet: physical.region?.snippet?.text
    };
  };

  const mapSeverity = (level: string): 'High' | 'Medium' | 'Low' | 'Info' => {
    const severityMap: Record<string, 'High' | 'Medium' | 'Low' | 'Info'> = {
      'error': 'High',
      'warning': 'Medium',
      'note': 'Low',
      'info': 'Info'
    };
    return severityMap[level] || 'Medium';
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      'High': 'destructive',
      'Medium': 'default',
      'Low': 'secondary',
      'Info': 'outline'
    };
    return colors[severity] || 'default';
  };

  const getSeverityIcon = (severity: string) => {
    const icons: Record<string, React.ReactNode> = {
      'High': <AlertCircle className="h-4 w-4" />,
      'Medium': <Info className="h-4 w-4" />,
      'Low': <CheckCircle className="h-4 w-4" />,
      'Info': <Info className="h-4 w-4" />
    };
    return icons[severity] || <Info className="h-4 w-4" />;
  };

  const filteredIssues = analysis?.issues.filter(issue => {
    const matchesSearch = searchTerm === "" || 
      issue.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.rule.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.location.file.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = selectedSeverity === "all" || issue.severity === selectedSeverity;
    const matchesFile = selectedFile === "all" || issue.location.file === selectedFile;
    
    return matchesSearch && matchesSeverity && matchesFile;
  }) || [];

  const exportToJson = () => {
    if (!analysis) return;
    
    const dataStr = JSON.stringify(analysis, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sarif-analysis.json';
    link.click();
    
    URL.revokeObjectURL(url);
  };

  const exportToCsv = () => {
    if (!analysis) return;
    
    const headers = ['File', 'Line', 'Column', 'Severity', 'Rule', 'Message', 'Description'];
    const rows = analysis.issues.map(issue => [
      issue.location.file,
      issue.location.line.toString(),
      issue.location.column.toString(),
      issue.severity,
      issue.rule.id,
      issue.message.replace(/"/g, '""'),
      (issue.rule.description || '').replace(/"/g, '""')
    ]);
    
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    const dataBlob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sarif-issues.csv';
    link.click();
    
    URL.revokeObjectURL(url);
  };

  const uniqueFiles = Array.from(new Set(analysis?.issues.map(issue => issue.location.file) || []));
  const uniqueSeverities = Array.from(new Set(analysis?.issues.map(issue => issue.severity) || []));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            SARIF Analyzer
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Upload and analyze SARIF files from static analysis tools
          </p>
        </div>
      </div>

      {!analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload SARIF File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Upload your SARIF file</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Select a SARIF file from your code analysis tools
                </p>
                <Input
                  type="file"
                  accept=".sarif,.json"
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="max-w-md mx-auto"
                />
              </div>
            </div>
            {loading && (
              <div className="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
                Analyzing SARIF file...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {analysis && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{analysis.summary.totalIssues}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Issues</div>
              </CardContent>
            </Card>
            
            {Object.entries(analysis.summary.severityBreakdown).map(([severity, count]) => (
              <Card key={severity}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    {getSeverityIcon(severity)}
                    <div>
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{severity}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tool Information */}
          <Card>
            <CardHeader>
              <CardTitle>Analysis Tool Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Tool:</strong> {analysis.toolInfo.name}
                </div>
                <div>
                  <strong>Version:</strong> {analysis.toolInfo.version}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filters and Export */}
          <Card>
            <CardHeader>
              <CardTitle>Filters and Export</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-center">
                <Input
                  placeholder="Search issues..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
                
                <select
                  value={selectedSeverity}
                  onChange={(e) => setSelectedSeverity(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background"
                >
                  <option value="all">All Severities</option>
                  {uniqueSeverities.map(severity => (
                    <option key={severity} value={severity}>{severity}</option>
                  ))}
                </select>

                <select
                  value={selectedFile}
                  onChange={(e) => setSelectedFile(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-background max-w-xs"
                >
                  <option value="all">All Files</option>
                  {uniqueFiles.map(file => (
                    <option key={file} value={file}>{file.split('/').pop()}</option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportToJson}>
                    <Download className="h-4 w-4 mr-2" />
                    JSON
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportToCsv}>
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Issues Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                Issues ({filteredIssues.length} of {analysis.summary.totalIssues})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Line</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredIssues.map((issue, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Badge variant={getSeverityColor(issue.severity) as any}>
                            <div className="flex items-center gap-1">
                              {getSeverityIcon(issue.severity)}
                              {issue.severity}
                            </div>
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {issue.location.file.split('/').pop()}
                        </TableCell>
                        <TableCell>{issue.location.line}:{issue.location.column}</TableCell>
                        <TableCell className="font-mono text-sm">{issue.rule.id}</TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate" title={issue.message}>
                            {issue.message}
                          </div>
                          {issue.rule.description && (
                            <div className="text-xs text-gray-500 mt-1 truncate" title={issue.rule.description}>
                              {issue.rule.description}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}