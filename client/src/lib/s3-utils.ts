// S3 utility functions for client-side operations
// Note: In production, these would interact with actual AWS SDK

export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface S3Object {
  key: string;
  size: number;
  lastModified: Date;
}

// Mock S3 operations for demo
export class S3Utils {
  private config: S3Config;

  constructor(config: S3Config) {
    this.config = config;
  }

  // List objects in bucket (mock implementation)
  async listObjects(bucket: string, prefix?: string): Promise<S3Object[]> {
    // In production, this would make actual S3 API calls
    return [
      {
        key: 'data/customer-data.csv',
        size: 1024000,
        lastModified: new Date('2023-11-15'),
      },
      {
        key: 'data/sales-data.csv',
        size: 2048000,
        lastModified: new Date('2023-11-14'),
      },
      {
        key: 'reports/monthly-summary.csv',
        size: 512000,
        lastModified: new Date('2023-11-13'),
      },
    ];
  }

  // Validate S3 credentials
  async validateCredentials(): Promise<boolean> {
    // In production, this would test actual S3 connection
    return this.config.accessKeyId && this.config.secretAccessKey && this.config.region;
  }

  // Get object metadata
  async getObjectMetadata(bucket: string, key: string): Promise<{
    size: number;
    lastModified: Date;
    contentType: string;
  }> {
    // In production, this would get actual object metadata
    return {
      size: 1024000,
      lastModified: new Date(),
      contentType: 'text/csv',
    };
  }

  // Generate presigned URL for download
  async getPresignedUrl(bucket: string, key: string, expiresIn = 3600): Promise<string> {
    // In production, this would generate actual presigned URL
    return `https://${bucket}.s3.${this.config.region}.amazonaws.com/${key}?expires=${expiresIn}`;
  }
}

// Helper function to parse S3 URI
export function parseS3Uri(uri: string): { bucket: string; key: string } | null {
  const s3UriPattern = /^s3:\/\/([^\/]+)\/(.+)$/;
  const match = uri.match(s3UriPattern);
  
  if (match) {
    return {
      bucket: match[1],
      key: match[2],
    };
  }
  
  return null;
}

// Helper function to format file size
export function formatFileSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
}

// Helper function to validate CSV file extension
export function isCSVFile(filename: string): boolean {
  return filename.toLowerCase().endsWith('.csv');
}

// Helper function to extract filename from S3 key
export function getFilenameFromKey(key: string): string {
  return key.split('/').pop() || key;
}
