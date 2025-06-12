import type { Express } from "express";
import { storage } from "./storage";
import { TransformationEngine } from "./routes";
import { pool } from "./db";

interface TestResult {
  success: boolean;
  error?: string;
  details?: any;
  duration: number;
}

export function registerTestEndpoints(app: Express) {
  // Health check endpoint for testing
  app.get("/api/test/health", async (req, res) => {
    const startTime = Date.now();
    try {
      // Test database connection
      const dbResult = await pool.query('SELECT 1 as test');
      const duration = Date.now() - startTime;
      
      res.json({
        success: true,
        status: 'healthy',
        database: 'connected',
        duration,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Database connectivity test
  app.get("/api/test/database", async (req, res) => {
    const startTime = Date.now();
    const tests: Record<string, TestResult> = {};
    
    try {
      // Test basic connection
      const connectionStart = Date.now();
      await pool.query('SELECT NOW() as current_time');
      tests.connection = {
        success: true,
        duration: Date.now() - connectionStart,
        details: { message: 'Database connection successful' }
      };

      // Test table existence
      const tablesStart = Date.now();
      const tableQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('datasets', 'transformations', 'job_history', 'tenants', 'users')
      `;
      const tableResult = await pool.query(tableQuery);
      tests.tables = {
        success: tableResult.rows.length === 5,
        duration: Date.now() - tablesStart,
        details: { 
          expectedTables: 5, 
          foundTables: tableResult.rows.length,
          tables: tableResult.rows.map(row => row.table_name)
        }
      };

      // Test data counts
      const countsStart = Date.now();
      const datasets = await pool.query('SELECT COUNT(*) as count FROM datasets');
      const transformations = await pool.query('SELECT COUNT(*) as count FROM transformations');
      const jobs = await pool.query('SELECT COUNT(*) as count FROM job_history');
      
      tests.data_counts = {
        success: true,
        duration: Date.now() - countsStart,
        details: {
          datasets: parseInt(datasets.rows[0].count),
          transformations: parseInt(transformations.rows[0].count),
          jobs: parseInt(jobs.rows[0].count)
        }
      };

      const totalDuration = Date.now() - startTime;
      const overallSuccess = Object.values(tests).every(test => test.success);
      
      res.json({
        success: overallSuccess,
        duration: totalDuration,
        tests,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Database test failed',
        duration,
        tests,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Transformation engine test
  app.post("/api/test/transformations", async (req, res) => {
    const startTime = Date.now();
    const { testCase } = req.body;
    
    const testCases = {
      string_functions: {
        data: [
          { name: 'John Doe', email: 'john@example.com' },
          { name: 'jane smith', email: 'JANE@EXAMPLE.COM' }
        ],
        tests: [
          { expression: 'UPPERCASE(name)', column: 'name', expected: ['JOHN DOE', 'JANE SMITH'] },
          { expression: 'LOWERCASE(email)', column: 'email', expected: ['john@example.com', 'jane@example.com'] },
          { expression: 'LEFT(name, 4)', column: 'name', expected: ['John', 'jane'] }
        ]
      },
      math_functions: {
        data: [
          { price: '123.456', quantity: '5' },
          { price: '99.99', quantity: '3' }
        ],
        tests: [
          { expression: 'ROUND(price, 2)', column: 'price', expected: [123.46, 99.99] },
          { expression: 'ABS(price)', column: 'price', expected: [123.456, 99.99] }
        ]
      },
      conditional_functions: {
        data: [
          { status: 'active', value: '100' },
          { status: '', value: '0' }
        ],
        tests: [
          { expression: 'IF(status, "Yes", "No")', column: 'status', expected: ['Yes', 'No'] }
        ]
      }
    };

    try {
      const selectedTestCase = testCases[testCase as keyof typeof testCases];
      if (!selectedTestCase) {
        return res.status(400).json({
          success: false,
          error: 'Invalid test case',
          availableTests: Object.keys(testCases)
        });
      }

      const results = [];
      for (const test of selectedTestCase.tests) {
        const testStart = Date.now();
        const actualResults = selectedTestCase.data.map(row => 
          TransformationEngine.parseExpression(test.expression, row)
        );
        
        const testDuration = Date.now() - testStart;
        const passed = JSON.stringify(actualResults) === JSON.stringify(test.expected);
        
        results.push({
          expression: test.expression,
          column: test.column,
          expected: test.expected,
          actual: actualResults,
          passed,
          duration: testDuration
        });
      }

      const totalDuration = Date.now() - startTime;
      const allPassed = results.every(r => r.passed);
      
      res.json({
        success: allPassed,
        testCase,
        duration: totalDuration,
        results,
        summary: {
          total: results.length,
          passed: results.filter(r => r.passed).length,
          failed: results.filter(r => !r.passed).length
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Transformation test failed',
        duration,
        timestamp: new Date().toISOString()
      });
    }
  });

  // API endpoint validation test
  app.get("/api/test/endpoints", async (req, res) => {
    const startTime = Date.now();
    const endpoints = [
      { method: 'GET', path: '/api/stats', expectedStatus: 200 },
      { method: 'GET', path: '/api/datasets', expectedStatus: 200 },
      { method: 'GET', path: '/api/transformations', expectedStatus: 200 },
      { method: 'GET', path: '/api/jobs', expectedStatus: 200 },
      { method: 'GET', path: '/api/activity/feed', expectedStatus: 200 }
    ];

    const results = [];
    
    for (const endpoint of endpoints) {
      const testStart = Date.now();
      try {
        // Simulate internal API call
        const mockReq = { 
          method: endpoint.method,
          path: endpoint.path,
          query: {},
          headers: {}
        };
        
        let testResult;
        try {
          // Test the endpoint logic directly based on path
          switch (endpoint.path) {
            case '/api/stats':
              const stats = await storage.getStats(1); // tenant ID 1
              testResult = { success: true, data: stats };
              break;
            case '/api/datasets':
              const datasets = await storage.getDatasets(1);
              testResult = { success: true, data: datasets };
              break;
            case '/api/transformations':
              const transformations = await storage.getTransformations(1);
              testResult = { success: true, data: transformations };
              break;
            case '/api/jobs':
              const jobs = await storage.getJobHistory(1, 10);
              testResult = { success: true, data: jobs };
              break;
            case '/api/activity/feed':
              const activities = await storage.getActivityFeed(1, 10);
              testResult = { success: true, data: activities };
              break;
            default:
              testResult = { success: false, error: 'Unknown endpoint' };
          }
        } catch (error) {
          testResult = { 
            success: false, 
            error: error instanceof Error ? error.message : 'Endpoint test failed' 
          };
        }

        const testDuration = Date.now() - testStart;
        results.push({
          ...endpoint,
          actualStatus: testResult.success ? 200 : 500,
          passed: testResult.success,
          duration: testDuration,
          error: testResult.error,
          dataSize: testResult.data ? JSON.stringify(testResult.data).length : 0
        });
        
      } catch (error) {
        const testDuration = Date.now() - testStart;
        results.push({
          ...endpoint,
          actualStatus: 500,
          passed: false,
          duration: testDuration,
          error: error instanceof Error ? error.message : 'Test execution failed'
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const allPassed = results.every(r => r.passed);
    
    res.json({
      success: allPassed,
      duration: totalDuration,
      results,
      summary: {
        total: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length
      },
      timestamp: new Date().toISOString()
    });
  });

  // Data quality test
  app.post("/api/test/data-quality", async (req, res) => {
    const startTime = Date.now();
    
    try {
      // Get a sample dataset for testing
      const datasets = await storage.getDatasets(1);
      if (datasets.length === 0) {
        return res.json({
          success: false,
          error: 'No datasets available for testing',
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
      }

      const dataset = datasets[0];
      const sampleData = dataset.data || dataset.preview || [];
      
      if (sampleData.length === 0) {
        return res.json({
          success: false,
          error: 'No data available in dataset',
          duration: Date.now() - startTime,
          timestamp: new Date().toISOString()
        });
      }

      // Perform basic data quality checks
      const qualityChecks = {
        row_count: sampleData.length,
        column_count: Object.keys(sampleData[0] || {}).length,
        null_values: 0,
        empty_strings: 0,
        unique_values: new Set(),
        data_types: {} as Record<string, string>
      };

      // Analyze each column
      const columns = Object.keys(sampleData[0] || {});
      for (const column of columns) {
        const values = sampleData.map(row => row[column]);
        
        // Count null/empty values
        const nullCount = values.filter(v => v === null || v === undefined).length;
        const emptyCount = values.filter(v => v === '').length;
        
        qualityChecks.null_values += nullCount;
        qualityChecks.empty_strings += emptyCount;
        
        // Determine data type
        const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
        if (nonNullValues.length > 0) {
          const sampleValue = nonNullValues[0];
          if (typeof sampleValue === 'number') {
            qualityChecks.data_types[column] = 'number';
          } else if (!isNaN(Date.parse(String(sampleValue)))) {
            qualityChecks.data_types[column] = 'date';
          } else {
            qualityChecks.data_types[column] = 'string';
          }
        } else {
          qualityChecks.data_types[column] = 'unknown';
        }
      }

      // Calculate quality score
      const totalCells = sampleData.length * columns.length;
      const badCells = qualityChecks.null_values + qualityChecks.empty_strings;
      const qualityScore = totalCells > 0 ? Math.round(((totalCells - badCells) / totalCells) * 100) : 0;

      const duration = Date.now() - startTime;
      
      res.json({
        success: true,
        duration,
        dataset: {
          id: dataset.id,
          name: dataset.name,
          filename: dataset.filename
        },
        quality_checks: qualityChecks,
        quality_score: qualityScore,
        recommendations: generateQualityRecommendations(qualityChecks, qualityScore),
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Data quality test failed',
        duration,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Performance test
  app.get("/api/test/performance", async (req, res) => {
    const startTime = Date.now();
    const tests = [];
    
    try {
      // Test database query performance
      const dbStart = Date.now();
      await pool.query('SELECT COUNT(*) FROM datasets');
      tests.push({
        name: 'Database Query',
        duration: Date.now() - dbStart,
        passed: true
      });

      // Test storage operations
      const storageStart = Date.now();
      await storage.getStats(1);
      tests.push({
        name: 'Storage Operations',
        duration: Date.now() - storageStart,
        passed: true
      });

      // Test transformation performance
      const transformStart = Date.now();
      const testData = Array.from({ length: 100 }, (_, i) => ({ value: `test${i}` }));
      testData.forEach(row => 
        TransformationEngine.parseExpression('UPPERCASE(value)', row)
      );
      tests.push({
        name: 'Transformation Engine (100 rows)',
        duration: Date.now() - transformStart,
        passed: true
      });

      const totalDuration = Date.now() - startTime;
      
      res.json({
        success: true,
        duration: totalDuration,
        tests,
        performance_metrics: {
          average_response_time: tests.reduce((sum, test) => sum + test.duration, 0) / tests.length,
          fastest_operation: Math.min(...tests.map(t => t.duration)),
          slowest_operation: Math.max(...tests.map(t => t.duration))
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Performance test failed',
        duration,
        tests,
        timestamp: new Date().toISOString()
      });
    }
  });
}

function generateQualityRecommendations(checks: any, score: number): string[] {
  const recommendations = [];
  
  if (score < 70) {
    recommendations.push('Data quality is below acceptable threshold. Consider data cleaning.');
  }
  
  if (checks.null_values > 0) {
    recommendations.push(`Found ${checks.null_values} null values. Consider data imputation or source validation.`);
  }
  
  if (checks.empty_strings > 0) {
    recommendations.push(`Found ${checks.empty_strings} empty strings. Review data collection process.`);
  }
  
  if (checks.column_count < 3) {
    recommendations.push('Dataset has very few columns. Verify data completeness.');
  }
  
  if (score >= 90) {
    recommendations.push('Excellent data quality! Dataset is ready for analysis.');
  }
  
  return recommendations;
}