import type { Dataset } from "@shared/schema";

export interface DataQualityIssue {
  type: 'missing_values' | 'duplicates' | 'data_types' | 'outliers' | 'patterns' | 'consistency' | 'completeness' | 'validity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  column: string;
  description: string;
  count: number;
  percentage: number;
  examples?: string[];
  recommendation: string;
}

export interface DataQualityMetrics {
  totalRows: number;
  totalColumns: number;
  completenessScore: number;
  consistencyScore: number;
  validityScore: number;
  uniquenessScore: number;
  overallScore: number;
}

export interface DataQualityAnalysis {
  metrics: DataQualityMetrics;
  issues: DataQualityIssue[];
  summary: {
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    recommendations: string[];
  };
  columnAnalysis: Record<string, {
    type: string;
    nullCount: number;
    nullPercentage: number;
    uniqueCount: number;
    uniquePercentage: number;
    mostCommonValues: Array<{ value: string; count: number }>;
    issues: DataQualityIssue[];
  }>;
}

export class DataQualityEngine {
  static async analyzeDataset(dataset: Dataset, checkTypes: string[] = []): Promise<DataQualityAnalysis> {
    // Use the full dataset data instead of just preview
    const data = dataset.data || dataset.preview || [];
    const columns = dataset.columns || [];
    
    if (data.length === 0) {
      throw new Error('No data available for analysis');
    }

    const analysis: DataQualityAnalysis = {
      metrics: {
        totalRows: dataset.totalRows,
        totalColumns: dataset.totalColumns,
        completenessScore: 0,
        consistencyScore: 0,
        validityScore: 0,
        uniquenessScore: 0,
        overallScore: 0,
      },
      issues: [],
      summary: {
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        recommendations: [],
      },
      columnAnalysis: {},
    };

    // Use actual data length for accurate analysis
    const actualRowCount = data.length;
    
    // Analyze each column
    for (const column of columns) {
      const columnData = data.map(row => row[column.name]);
      const columnAnalysis = this.analyzeColumn(column.name, column.type, columnData, actualRowCount);
      analysis.columnAnalysis[column.name] = columnAnalysis;
      analysis.issues.push(...columnAnalysis.issues);
    }

    // Calculate overall metrics using actual data counts
    analysis.metrics = this.calculateMetrics(analysis.columnAnalysis, actualRowCount, dataset.totalColumns);
    analysis.metrics.totalRows = actualRowCount;

    // Generate summary
    analysis.summary = this.generateSummary(analysis.issues);

    return analysis;
  }

  private static analyzeColumn(
    columnName: string, 
    columnType: string, 
    data: any[], 
    totalRows: number
  ) {
    const issues: DataQualityIssue[] = [];
    
    // Count nulls and unique values
    const nullCount = data.filter(value => value === null || value === undefined || value === '').length;
    const nullPercentage = (nullCount / totalRows) * 100;
    
    const nonNullData = data.filter(value => value !== null && value !== undefined && value !== '');
    const uniqueValues = new Set(nonNullData);
    const uniqueCount = uniqueValues.size;
    const uniquePercentage = nonNullData.length > 0 ? (uniqueCount / nonNullData.length) * 100 : 0;

    // Get most common values
    const valueCounts = new Map<string, number>();
    nonNullData.forEach(value => {
      const strValue = String(value);
      valueCounts.set(strValue, (valueCounts.get(strValue) || 0) + 1);
    });
    
    const mostCommonValues = Array.from(valueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ value, count }));

    // Check for missing values
    if (nullPercentage > 5) {
      issues.push({
        type: 'missing_values',
        severity: nullPercentage > 30 ? 'critical' : nullPercentage > 15 ? 'high' : 'medium',
        column: columnName,
        description: `${nullPercentage.toFixed(1)}% of values are missing`,
        count: nullCount,
        percentage: nullPercentage,
        recommendation: nullPercentage > 30 
          ? 'Consider removing this column or finding alternative data sources'
          : 'Implement data imputation strategies or improve data collection'
      });
    }

    // Check for duplicates (low uniqueness)
    if (uniquePercentage < 50 && uniqueCount > 1 && columnType !== 'category') {
      issues.push({
        type: 'duplicates',
        severity: uniquePercentage < 10 ? 'high' : 'medium',
        column: columnName,
        description: `Only ${uniquePercentage.toFixed(1)}% of values are unique`,
        count: nonNullData.length - uniqueCount,
        percentage: 100 - uniquePercentage,
        recommendation: 'Review data collection process to ensure data accuracy'
      });
    }

    // Check data type consistency
    if (columnType === 'number') {
      const invalidNumbers = nonNullData.filter(value => isNaN(Number(value)));
      if (invalidNumbers.length > 0) {
        const invalidPercentage = (invalidNumbers.length / nonNullData.length) * 100;
        issues.push({
          type: 'data_types',
          severity: invalidPercentage > 10 ? 'high' : 'medium',
          column: columnName,
          description: `${invalidNumbers.length} values cannot be converted to numbers`,
          count: invalidNumbers.length,
          percentage: invalidPercentage,
          examples: invalidNumbers.slice(0, 3).map(String),
          recommendation: 'Clean and standardize numeric data format'
        });
      }
    }

    // Check for outliers in numeric data
    if (columnType === 'number') {
      const numericData = nonNullData.filter(value => !isNaN(Number(value))).map(Number);
      if (numericData.length > 0) {
        const outliers = this.detectOutliers(numericData);
        if (outliers.length > 0 && outliers.length / numericData.length > 0.05) {
          issues.push({
            type: 'outliers',
            severity: 'medium',
            column: columnName,
            description: `${outliers.length} potential outliers detected`,
            count: outliers.length,
            percentage: (outliers.length / numericData.length) * 100,
            examples: outliers.slice(0, 3).map(String),
            recommendation: 'Review outlier values for data entry errors or genuine edge cases'
          });
        }
      }
    }

    // Check for pattern consistency in text data
    if (columnType === 'text') {
      const patternIssues = this.checkTextPatterns(nonNullData.map(String), columnName);
      issues.push(...patternIssues);
    }

    return {
      type: columnType,
      nullCount,
      nullPercentage,
      uniqueCount,
      uniquePercentage,
      mostCommonValues,
      issues,
    };
  }

  private static detectOutliers(data: number[]): number[] {
    if (data.length < 4) return [];
    
    const sorted = [...data].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return data.filter(value => value < lowerBound || value > upperBound);
  }

  private static checkTextPatterns(data: string[], columnName: string): DataQualityIssue[] {
    const issues: DataQualityIssue[] = [];
    
    // Check for inconsistent casing
    const casings = new Set(data.map(value => {
      if (value.toLowerCase() === value) return 'lower';
      if (value.toUpperCase() === value) return 'upper';
      if (value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() === value) return 'title';
      return 'mixed';
    }));
    
    if (casings.size > 2) {
      issues.push({
        type: 'consistency',
        severity: 'medium',
        column: columnName,
        description: 'Inconsistent text casing detected',
        count: data.length,
        percentage: 100,
        recommendation: 'Standardize text casing (e.g., all uppercase or title case)'
      });
    }

    // Check for leading/trailing whitespace
    const whitespaceIssues = data.filter(value => value !== value.trim());
    if (whitespaceIssues.length > 0) {
      issues.push({
        type: 'consistency',
        severity: 'low',
        column: columnName,
        description: `${whitespaceIssues.length} values have leading/trailing whitespace`,
        count: whitespaceIssues.length,
        percentage: (whitespaceIssues.length / data.length) * 100,
        recommendation: 'Trim whitespace from text values'
      });
    }

    return issues;
  }

  private static calculateMetrics(
    columnAnalysis: Record<string, any>, 
    totalRows: number, 
    totalColumns: number
  ): DataQualityMetrics {
    const columns = Object.values(columnAnalysis);
    
    // Completeness: average non-null percentage across columns
    const completenessScore = columns.reduce((sum, col) => sum + (100 - col.nullPercentage), 0) / columns.length;
    
    // Consistency: based on pattern and format issues
    const consistencyIssues = columns.reduce((sum, col) => 
      sum + col.issues.filter((issue: DataQualityIssue) => issue.type === 'consistency').length, 0
    );
    const consistencyScore = Math.max(0, 100 - (consistencyIssues / totalColumns) * 10);
    
    // Validity: based on data type and format correctness
    const validityIssues = columns.reduce((sum, col) => 
      sum + col.issues.filter((issue: DataQualityIssue) => 
        issue.type === 'data_types' || issue.type === 'validity'
      ).length, 0
    );
    const validityScore = Math.max(0, 100 - (validityIssues / totalColumns) * 15);
    
    // Uniqueness: average uniqueness across columns
    const uniquenessScore = columns.reduce((sum, col) => sum + col.uniquePercentage, 0) / columns.length;
    
    // Overall score: weighted average
    const overallScore = Math.round(
      (completenessScore * 0.3) + 
      (consistencyScore * 0.25) + 
      (validityScore * 0.25) + 
      (uniquenessScore * 0.2)
    );

    return {
      totalRows,
      totalColumns,
      completenessScore: Math.round(completenessScore),
      consistencyScore: Math.round(consistencyScore),
      validityScore: Math.round(validityScore),
      uniquenessScore: Math.round(uniquenessScore),
      overallScore,
    };
  }

  private static generateSummary(issues: DataQualityIssue[]) {
    const criticalIssues = issues.filter(issue => issue.severity === 'critical').length;
    const highIssues = issues.filter(issue => issue.severity === 'high').length;
    const mediumIssues = issues.filter(issue => issue.severity === 'medium').length;
    const lowIssues = issues.filter(issue => issue.severity === 'low').length;

    const recommendations = [];
    
    if (criticalIssues > 0) {
      recommendations.push('Address critical data quality issues immediately');
    }
    if (highIssues > 0) {
      recommendations.push('Review and fix high-priority data quality problems');
    }
    if (issues.some(issue => issue.type === 'missing_values')) {
      recommendations.push('Implement data validation at the source to reduce missing values');
    }
    if (issues.some(issue => issue.type === 'consistency')) {
      recommendations.push('Establish data formatting standards and validation rules');
    }
    if (issues.some(issue => issue.type === 'duplicates')) {
      recommendations.push('Review data collection processes to minimize duplicates');
    }

    return {
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      recommendations,
    };
  }
}