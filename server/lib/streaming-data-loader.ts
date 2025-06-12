import Papa from 'papaparse';

export interface StreamingDataOptions {
  bucket: string;
  key: string;
  hasHeader: boolean;
  maxSampleRows?: number;
  maxPreviewRows?: number;
}

export interface StreamingDataResult {
  columns: Array<{ name: string; type: string; sample: string }>;
  preview: Record<string, any>[];
  estimatedTotalRows: number;
  actualSampleSize: number;
}

export class StreamingDataLoader {
  private s3Client: any;

  constructor(s3Client: any) {
    this.s3Client = s3Client;
  }

  async loadDataSample(config: any, options: StreamingDataOptions): Promise<StreamingDataResult> {
    const { bucket, key, hasHeader, maxSampleRows = 1000, maxPreviewRows = 100 } = options;

    try {
      // Download the file content
      const csvData = await this.s3Client.getObject(config, bucket, key);
      
      // For very large files, use a much smaller sample for faster processing
      const effectiveSampleSize = csvData.length > 50 * 1024 * 1024 ? 20 : maxSampleRows; // 20 rows for files > 50MB
      
      // Estimate total rows by counting newlines (fast operation)
      const estimatedTotalRows = this.estimateRowCount(csvData, hasHeader);
      
      // Parse only a very small sample for large files
      const parseResult = Papa.parse(csvData, {
        header: hasHeader,
        skipEmptyLines: 'greedy', // More aggressive empty line skipping
        preview: effectiveSampleSize, // Drastically reduce for large files
        dynamicTyping: false, // Keep as strings for type inference
        fastMode: false, // Disable fast mode to handle inconsistent field counts
      });

      // Filter out critical errors but allow field count warnings
      const criticalErrors = parseResult.errors.filter(error => 
        !error.message.includes('Too many fields') && 
        !error.message.includes('too few fields')
      );

      if (criticalErrors.length > 0) {
        throw new Error(`CSV parsing failed: ${criticalErrors[0].message}`);
      }

      const sampleData = parseResult.data as Record<string, any>[];
      
      if (sampleData.length === 0) {
        throw new Error('No data found in file');
      }

      // Infer column types from sample data
      const columns = this.inferColumnTypes(sampleData);
      
      // Create preview data (subset of sample)
      const preview = sampleData.slice(0, Math.min(maxPreviewRows, 50)); // Max 50 rows for preview

      return {
        columns,
        preview,
        estimatedTotalRows,
        actualSampleSize: sampleData.length,
      };
    } catch (error) {
      console.error('Error loading data sample:', error);
      throw error;
    }
  }

  private estimateRowCount(csvData: string, hasHeader: boolean): number {
    // Count newlines for a rough estimate
    const lineCount = (csvData.match(/\n/g) || []).length;
    return Math.max(0, lineCount - (hasHeader ? 1 : 0));
  }

  private inferColumnTypes(data: Record<string, any>[]): Array<{ name: string; type: string; sample: string }> {
    if (data.length === 0) return [];

    const firstRow = data[0];
    const columnNames = Object.keys(firstRow);

    return columnNames.map(name => {
      const sampleValues = data.slice(0, 50).map(row => row[name]).filter(val => val != null && val !== '');
      
      let inferredType = 'string';
      
      if (sampleValues.length > 0) {
        // Check if all non-empty values are numbers
        const allNumbers = sampleValues.every(val => !isNaN(Number(val)) && val !== '');
        if (allNumbers) {
          // Check if they're integers or floats
          const allIntegers = sampleValues.every(val => Number.isInteger(Number(val)));
          inferredType = allIntegers ? 'integer' : 'number';
        } else {
          // Check if they look like dates
          const datePattern = /^\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2}-\d{1,2}-\d{4}/;
          const mostlyDates = sampleValues.filter(val => datePattern.test(String(val))).length > sampleValues.length * 0.7;
          if (mostlyDates) {
            inferredType = 'date';
          }
        }
      }

      return {
        name,
        type: inferredType,
        sample: String(firstRow[name] || '')
      };
    });
  }

  async loadFullDataForAnalysis(config: any, options: StreamingDataOptions): Promise<Record<string, any>[]> {
    const { bucket, key, hasHeader } = options;

    try {
      // For quality analysis, we need more data but still not the entire file for very large datasets
      const csvData = await this.s3Client.getObject(config, bucket, key);
      
      // Parse up to 10,000 rows for quality analysis (good balance of accuracy vs performance)
      const parseResult = Papa.parse(csvData, {
        header: hasHeader,
        skipEmptyLines: 'greedy',
        preview: 10000,
        dynamicTyping: false,
        fastMode: false,
      });

      // Filter out critical errors but allow field count warnings
      const criticalErrors = parseResult.errors.filter(error => 
        !error.message.includes('Too many fields') && 
        !error.message.includes('too few fields')
      );

      if (criticalErrors.length > 0) {
        throw new Error(`CSV parsing failed: ${criticalErrors[0].message}`);
      }

      return parseResult.data as Record<string, any>[];
    } catch (error) {
      console.error('Error loading full data for analysis:', error);
      throw error;
    }
  }
}