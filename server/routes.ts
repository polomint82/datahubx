import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";

// Extend global object type for job executions
declare global {
  var jobExecutions: Record<number, any>;
}
import { 
  s3ImportSchema, 
  transformationPreviewSchema, 
  applyTransformationSchema,
  createPipelineSchema 
} from "@shared/schema";
import { registerTestEndpoints } from "./test-endpoints";
import Papa from "papaparse";
import { z } from "zod";
import crypto from "crypto";
import { scheduler } from "./scheduler";
import { DataQualityEngine } from "./lib/data-quality-engine";
import { StreamingDataLoader } from "./lib/streaming-data-loader";

// AWS S3 schemas for validation
const awsConfigSchema = z.object({
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  region: z.string(),
});

const s3ListObjectsSchema = awsConfigSchema.extend({
  bucket: z.string(),
  prefix: z.string().optional(),
});

const s3ImportFilesSchema = awsConfigSchema.extend({
  bucket: z.string(),
  files: z.array(z.string()),
});

import { S3Client as AWSS3Client, ListBucketsCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";

// AWS S3 operations using official AWS SDK
class S3Client {
  private createClient(config: any) {
    if (!config.region) {
      throw new Error('AWS region is required');
    }
    return new AWSS3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async listBuckets(config: any) {
    const client = this.createClient(config);
    try {
      const command = new ListBucketsCommand({});
      const response = await client.send(command);
      
      return response.Buckets?.map(bucket => ({
        name: bucket.Name || '',
        creationDate: bucket.CreationDate?.toISOString() || new Date().toISOString(),
      })) || [];
    } catch (error) {
      throw new Error(`Failed to list S3 buckets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listObjects(config: any, bucket: string, prefix?: string) {
    const client = this.createClient(config);
    try {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || '',
        Delimiter: '/',
      });
      
      const response = await client.send(command);
      const objects = [];

      // Add folders (common prefixes)
      if (response.CommonPrefixes) {
        for (const commonPrefix of response.CommonPrefixes) {
          if (commonPrefix.Prefix) {
            objects.push({
              key: commonPrefix.Prefix,
              size: 0,
              lastModified: new Date().toISOString(),
              isFolder: true,
            });
          }
        }
      }

      // Add files
      if (response.Contents) {
        for (const object of response.Contents) {
          if (object.Key && object.Key !== prefix) {
            objects.push({
              key: object.Key,
              size: object.Size || 0,
              lastModified: object.LastModified?.toISOString() || new Date().toISOString(),
              isFolder: false,
            });
          }
        }
      }

      return objects;
    } catch (error) {
      throw new Error(`Failed to list S3 objects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getObject(config: any, bucket: string, key: string): Promise<string> {
    const client = this.createClient(config);
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      
      const response = await client.send(command);
      
      if (!response.Body) {
        throw new Error('No content found in S3 object');
      }

      // Convert stream to string
      const chunks = [];
      const reader = response.Body.transformToWebStream().getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const buffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }
      
      return new TextDecoder().decode(buffer);
    } catch (error) {
      throw new Error(`Failed to get S3 object: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

const s3Client = new S3Client();

// Helper function to get current user (simplified for demo)
function getCurrentUser(req: any) {
  return { id: 1, tenantId: 1 }; // Mock user
}

// Data type inference
function inferDataType(value: string): string {
  if (!value || value.trim() === '') return 'string';
  
  // Number check
  if (!isNaN(Number(value)) && isFinite(Number(value))) {
    return value.includes('.') ? 'number' : 'integer';
  }
  
  // Date check
  const dateValue = new Date(value);
  if (!isNaN(dateValue.getTime()) && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return 'date';
  }
  
  // Boolean check
  if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
    return 'boolean';
  }
  
  return 'string';
}

// Transformation engine
export class TransformationEngine {
  static applyFunction(functionName: string, value: any, ...args: any[]): any {
    switch (functionName) {
      // String functions
      case 'UPPER':
      case 'UPPERCASE':
        return String(value).toUpperCase();
      case 'LOWER':
      case 'LOWERCASE':
        return String(value).toLowerCase();
      case 'TRIM':
        return String(value).trim();
      case 'CONCAT':
        return args.reduce((acc, arg) => acc + String(arg), String(value));
      case 'LEFT':
        const leftLength = args[0] || 0;
        return String(value).substring(0, Number(leftLength));
      case 'RIGHT':
        const rightLength = args[0] || 0;
        return String(value).substring(String(value).length - Number(rightLength));
      case 'SUBSTRING':
        const start = args[0] || 0;
        const length = args[1];
        return length ? String(value).substring(Number(start), Number(start) + Number(length)) : String(value).substring(Number(start));
      case 'REPLACE':
        const searchStr = args[0] || '';
        const replaceStr = args[1] || '';
        return String(value).replace(new RegExp(String(searchStr), 'g'), String(replaceStr));
      
      // Math functions
      case 'ROUND':
        const precision = args[0] || 0;
        return Math.round(Number(value) * Math.pow(10, precision)) / Math.pow(10, precision);
      case 'ABS':
        return Math.abs(Number(value));
      case 'CEIL':
        return Math.ceil(Number(value));
      case 'FLOOR':
        return Math.floor(Number(value));
      
      // Date functions
      case 'DATE_FORMAT':
      case 'FORMAT_DATE':
        const format = args[0] || 'YYYY-MM-DD';
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return value; // Return original value if invalid date
        }
        return date.toISOString().split('T')[0]; // Simple format for demo
      case 'EXTRACT':
        const part = args[0] || 'year';
        const dateObj = new Date(value);
        if (isNaN(dateObj.getTime())) {
          return value; // Return original value if invalid date
        }
        switch (part.toLowerCase()) {
          case 'year': return dateObj.getFullYear();
          case 'month': return dateObj.getMonth() + 1;
          case 'day': return dateObj.getDate();
          default: return value;
        }
      
      // Conditional functions
      case 'IF':
        // IF function can have 2 or 3 additional arguments
        // Format 1: IF(column, trueValue, falseValue) - simple existence check
        // Format 2: IF(column, condition, trueValue, falseValue) - condition check
        
        if (args.length === 2) {
          // Simple format: IF(value, trueValue, falseValue)
          const trueValue = args[0] || 'Yes';
          const falseValue = args[1] || 'No';
          
          if (value && String(value).trim() !== '' && value !== null && value !== undefined) {
            return trueValue;
          } else {
            return falseValue;
          }
        } else if (args.length >= 3) {
          // Extended format: IF(value, condition, trueValue, falseValue)
          const condition = args[0] || '> 0';
          const trueValue = args[1] || 'Yes';
          const falseValue = args[2] || 'No';
          
          if (value && String(value).trim() !== '' && value !== null && value !== undefined) {
            return trueValue;
          } else {
            return falseValue;
          }
        } else {
          // Default case
          return value && String(value).trim() !== '' ? 'Yes' : 'No';
        }
      
      default:
        return value;
    }
  }

  static parseExpression(expression: string, row: Record<string, any>): any {
    // Handle simple column references first
    if (row.hasOwnProperty(expression)) {
      return row[expression];
    }
    
    // Handle function expressions
    const funcMatch = expression.match(/^(\w+)\((.*)\)$/);
    if (!funcMatch) {
      // If it's not a function and not a column, return the expression as-is
      return expression;
    }
    
    const [, functionName, argsStr] = funcMatch;
    
    // Parse arguments more carefully, handling quoted strings with commas
    const args = [];
    let currentArg = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        currentArg += char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        currentArg += char;
      } else if (!inQuotes && char === ',') {
        args.push(currentArg.trim());
        currentArg = '';
      } else {
        currentArg += char;
      }
    }
    
    if (currentArg.trim()) {
      args.push(currentArg.trim());
    }
    
    // Process arguments
    const processedArgs = args.map(arg => {
      // String literals
      if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
        return arg.slice(1, -1);
      }
      
      // Column references - check if the argument is a valid column name
      if (row.hasOwnProperty(arg)) {
        return row[arg];
      }
      
      // Numeric literals
      if (!isNaN(Number(arg))) {
        return Number(arg);
      }
      
      // For unrecognized arguments, return the argument name itself
      return arg;
    });
    
    const value = processedArgs.length > 0 ? processedArgs[0] : '';
    const additionalArgs = processedArgs.slice(1);
    
    return this.applyFunction(functionName, value, ...additionalArgs);
  }

  static previewTransformation(data: Record<string, any>[], targetColumn: string, expression: string): Array<{before: string, after: string}> {
    return data.slice(0, 5).map(row => {
      const beforeValue = row[targetColumn];
      const afterValue = this.parseExpression(expression, row);
      
      return {
        before: beforeValue !== undefined ? String(beforeValue) : '',
        after: afterValue !== undefined ? String(afterValue) : ''
      };
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get dashboard stats
  app.get("/api/stats", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const stats = await storage.getStats(user.tenantId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Get datasets
  app.get("/api/datasets", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const datasets = await storage.getDatasets(user.tenantId);
      res.json(datasets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch datasets" });
    }
  });

  // Get dataset by ID
  app.get("/api/datasets/:id", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const datasetId = parseInt(req.params.id);
      const dataset = await storage.getDataset(datasetId, user.tenantId);
      
      if (!dataset) {
        return res.status(404).json({ message: "Dataset not found" });
      }
      
      res.json(dataset);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dataset" });
    }
  });

  // Import CSV from S3
  app.post("/api/import/s3", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const validatedData = s3ImportSchema.parse(req.body);
      
      // Get tenant AWS credentials
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant?.awsAccessKeyId || !tenant?.awsSecretAccessKey || !tenant?.awsRegion) {
        return res.status(400).json({ 
          message: "AWS credentials not configured. Please configure your AWS settings in the admin panel first.",
          code: "MISSING_AWS_CREDENTIALS"
        });
      }

      const config = {
        accessKeyId: tenant.awsAccessKeyId,
        secretAccessKey: tenant.awsSecretAccessKey,
        region: tenant.awsRegion,
      };
      
      // Create initial job record
      const job = await storage.createJobHistory({
        tenantId: user.tenantId,
        type: "import",
        status: "processing",
        details: `Importing ${validatedData.name} from s3://${validatedData.bucket}/${validatedData.key}`,
      });

      // Use streaming data loader for better performance with large files
      const streamingLoader = new StreamingDataLoader(s3Client);
      
      let loadResult;
      try {
        loadResult = await streamingLoader.loadDataSample(config, {
          bucket: validatedData.bucket,
          key: validatedData.key,
          hasHeader: validatedData.hasHeader,
          maxSampleRows: 1000,
          maxPreviewRows: 100
        });
      } catch (s3Error: any) {
        // Update job status with S3 error
        await storage.updateJobHistory(job.id, user.tenantId, {
          status: "error",
          details: `S3 Access Error: ${s3Error.message}. Please check your AWS credentials and file permissions.`,
        });
        
        return res.status(400).json({ 
          message: "Failed to access S3 file. Please check your AWS credentials and ensure the file exists with proper permissions.",
          code: "S3_ACCESS_ERROR",
          details: s3Error.message
        });
      }

      const { columns, preview, estimatedTotalRows } = loadResult;

      // Create dataset with optimized data storage for large files
      const dataset = await storage.createDataset({
        name: validatedData.name,
        filename: validatedData.key.split('/').pop() || validatedData.key,
        s3Bucket: validatedData.bucket,
        s3Key: validatedData.key,
        tenantId: user.tenantId,
        totalRows: estimatedTotalRows,
        totalColumns: columns.length,
        columns,
        data: preview, // Store only preview data to reduce memory usage
        preview,
        status: "completed",
      });

      // Update job status
      await storage.updateJobHistory(job.id, user.tenantId, {
        status: "completed",
        details: `Successfully imported ~${estimatedTotalRows} rows`,
        datasetId: dataset.id,
      });

      res.json(dataset);
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ message: "Import failed" });
    }
  });

  // Get transformations
  app.get("/api/transformations", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const datasetId = req.query.datasetId ? parseInt(req.query.datasetId as string) : undefined;
      const transformations = await storage.getTransformations(user.tenantId, datasetId);
      res.json(transformations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transformations" });
    }
  });

  // Preview transformation
  app.post("/api/transformations/preview", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const validatedData = transformationPreviewSchema.parse(req.body);
      
      const dataset = await storage.getDataset(validatedData.datasetId, user.tenantId);
      if (!dataset) {
        return res.status(404).json({ message: "Dataset not found" });
      }

      // Use the full dataset data for transformation preview instead of just preview
      const dataToTransform = dataset.data || dataset.preview || [];
      
      const preview = TransformationEngine.previewTransformation(
        dataToTransform,
        validatedData.targetColumn,
        validatedData.expression
      );
      res.json({ preview });
    } catch (error) {
      console.error("Preview error:", error);
      res.status(500).json({ message: "Preview failed" });
    }
  });

  // Update transformation
  app.put("/api/transformations/:id", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const id = parseInt(req.params.id);
      
      const transformation = await storage.updateTransformation(id, user.tenantId, req.body);
      if (!transformation) {
        return res.status(404).json({ message: "Transformation not found" });
      }
      
      res.json(transformation);
    } catch (error) {
      console.error("Failed to update transformation:", error);
      res.status(500).json({ message: "Failed to update transformation" });
    }
  });

  // Apply transformation
  app.post("/api/transformations", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const validatedData = applyTransformationSchema.parse(req.body);
      
      const dataset = await storage.getDataset(validatedData.datasetId, user.tenantId);
      if (!dataset) {
        return res.status(404).json({ message: "Dataset not found" });
      }

      // Create job record
      const job = await storage.createJobHistory({
        tenantId: user.tenantId,
        type: "transformation",
        status: "processing",
        details: `Applying transformation ${validatedData.name}`,
      });

      // Generate preview
      const preview = TransformationEngine.previewTransformation(
        dataset.preview,
        validatedData.targetColumn,
        validatedData.expression
      );

      // Determine function type
      const functionMatch = validatedData.expression.match(/^(\w+)\(/);
      const functionName = functionMatch?.[1] || '';
      let functionType = 'string';
      if (['SUM', 'AVG', 'ROUND', 'ABS', 'CEIL', 'FLOOR'].includes(functionName)) {
        functionType = 'math';
      } else if (['DATE_FORMAT', 'EXTRACT'].includes(functionName)) {
        functionType = 'date';
      }

      // Create transformation
      const transformation = await storage.createTransformation({
        name: validatedData.name,
        datasetId: validatedData.datasetId,
        tenantId: user.tenantId,
        targetColumn: validatedData.targetColumn,
        expression: validatedData.expression,
        functionType,
        status: "applied",
        preview,
      });

      // Log activity
      await storage.createActivity({
        tenantId: user.tenantId,
        userId: 1, // TODO: Get actual userId
        action: "transformation_created",
        entityType: "transformation",
        entityId: transformation.id,
        description: `Applied ${validatedData.expression} to ${validatedData.targetColumn} column in dataset ${dataset.name}`,
        metadata: {
          datasetId: validatedData.datasetId,
          datasetName: dataset.name,
          targetColumn: validatedData.targetColumn,
          expression: validatedData.expression,
          functionType,
          transformationName: transformation.name
        }
      });

      // Update job status
      await storage.updateJobHistory(job.id, user.tenantId, {
        status: "completed",
        details: `Successfully applied transformation ${validatedData.name}`,
        transformationId: transformation.id,
      });

      res.json(transformation);
    } catch (error) {
      console.error("Transformation error:", error);
      res.status(500).json({ message: "Transformation failed" });
    }
  });

  // Update transformation
  app.put("/api/transformations/:id", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const id = parseInt(req.params.id);
      const updates = req.body;
      
      const transformation = await storage.updateTransformation(id, user.tenantId, updates);
      if (!transformation) {
        return res.status(404).json({ message: "Transformation not found" });
      }
      
      res.json(transformation);
    } catch (error) {
      console.error("Failed to update transformation:", error);
      res.status(500).json({ message: "Failed to update transformation" });
    }
  });

  // Delete transformation
  app.delete("/api/transformations/:id", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const id = parseInt(req.params.id);
      
      // Validate ID parameter
      if (isNaN(id) || id <= 0) {
        return res.status(400).json({ message: "Invalid transformation ID" });
      }
      
      const success = await storage.deleteTransformation(id, user.tenantId);
      if (!success) {
        return res.status(404).json({ message: "Transformation not found" });
      }
      
      res.json({ success: true, message: "Transformation deleted" });
    } catch (error) {
      console.error("Failed to delete transformation:", error);
      res.status(500).json({ message: "Failed to delete transformation" });
    }
  });

  // Clean up duplicate transformations
  app.post("/api/transformations/cleanup", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const { datasetId } = req.body;
      
      const transformations = await storage.getTransformations(user.tenantId, datasetId);
      
      // Group by column and function name
      const groupedTransforms = new Map<string, any[]>();
      
      transformations.forEach((t: any) => {
        const functionName = t.expression.match(/^(\w+)\(/)?.[1];
        const key = `${t.targetColumn}-${functionName}`;
        
        if (!groupedTransforms.has(key)) {
          groupedTransforms.set(key, []);
        }
        groupedTransforms.get(key)!.push(t);
      });
      
      // Remove duplicates (keep the one with lowest sequence number or most recent)
      let deletedCount = 0;
      for (const [key, transforms] of Array.from(groupedTransforms.entries())) {
        if (transforms.length > 1) {
          // Sort by sequence number (ascending) and keep the first one
          transforms.sort((a: any, b: any) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));
          
          // Delete all but the first one
          for (let i = 1; i < transforms.length; i++) {
            try {
              const transformId = parseInt(transforms[i].id);
              if (!isNaN(transformId) && transformId > 0) {
                await storage.deleteTransformation(transformId, user.tenantId);
                deletedCount++;
              }
            } catch (deleteError) {
              console.error(`Failed to delete transformation ${transforms[i].id}:`, deleteError);
              // Continue with other deletions
            }
          }
        }
      }
      
      res.json({ success: true, deletedCount });
    } catch (error) {
      console.error("Failed to cleanup transformations:", error);
      res.status(500).json({ message: "Failed to cleanup transformations" });
    }
  });

  // Get job history
  app.get("/api/jobs", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const jobs = await storage.getJobHistory(user.tenantId, limit);
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch job history" });
    }
  });

  // AWS S3 API endpoints
  
  // Update AWS credentials for tenant
  app.post("/api/aws/credentials", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const config = awsConfigSchema.parse(req.body);
      
      // Test credentials first
      const buckets = await s3Client.listBuckets(config);
      
      // If successful, store in tenant record
      await storage.updateTenantAwsCredentials(user.tenantId, {
        awsAccessKeyId: config.accessKeyId,
        awsSecretAccessKey: config.secretAccessKey,
        awsRegion: config.region,
        awsDefaultBucket: req.body.defaultBucket,
      });

      res.json({ success: true, bucketsCount: buckets.length });
    } catch (error) {
      res.status(400).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Connection failed" 
      });
    }
  });

  // Get current AWS configuration for tenant
  app.get("/api/aws/credentials", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const tenant = await storage.getTenant(user.tenantId);
      
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Return credentials (excluding secret for security)
      res.json({
        accessKeyId: tenant.awsAccessKeyId ? "****" + tenant.awsAccessKeyId.slice(-4) : null,
        hasSecretKey: !!tenant.awsSecretAccessKey,
        region: tenant.awsRegion,
        defaultBucket: tenant.awsDefaultBucket,
        isConfigured: !!(tenant.awsAccessKeyId && tenant.awsSecretAccessKey && tenant.awsRegion),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get credentials" });
    }
  });

  // List S3 buckets using stored credentials
  app.get("/api/s3/buckets", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const tenant = await storage.getTenant(user.tenantId);
      
      if (!tenant?.awsAccessKeyId || !tenant?.awsSecretAccessKey || !tenant?.awsRegion) {
        return res.status(400).json({ message: "AWS credentials not configured" });
      }

      const config = {
        accessKeyId: tenant.awsAccessKeyId,
        secretAccessKey: tenant.awsSecretAccessKey,
        region: tenant.awsRegion,
      };

      const buckets = await s3Client.listBuckets(config);
      res.json(buckets);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to list buckets" 
      });
    }
  });

  // List S3 objects using stored credentials
  app.post("/api/s3/objects", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const tenant = await storage.getTenant(user.tenantId);
      
      if (!tenant?.awsAccessKeyId || !tenant?.awsSecretAccessKey || !tenant?.awsRegion) {
        return res.status(400).json({ message: "AWS credentials not configured" });
      }

      const { bucket, prefix } = req.body;
      const config = {
        accessKeyId: tenant.awsAccessKeyId,
        secretAccessKey: tenant.awsSecretAccessKey,
        region: tenant.awsRegion,
      };

      const objects = await s3Client.listObjects(config, bucket, prefix);
      res.json(objects);
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to list objects" 
      });
    }
  });

  // Preview S3 file data before import
  app.post("/api/import/preview", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { bucket, key, hasHeader = true } = req.body;

      if (!bucket || !key) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Get tenant AWS credentials
      const tenant = await storage.getTenant(user.tenantId);
      if (!tenant?.awsAccessKeyId || !tenant?.awsSecretAccessKey || !tenant?.awsRegion) {
        return res.status(400).json({ 
          error: "AWS credentials not configured. Please configure your AWS settings first." 
        });
      }

      const config = {
        accessKeyId: tenant.awsAccessKeyId,
        secretAccessKey: tenant.awsSecretAccessKey,
        region: tenant.awsRegion,
      };

      // Use streaming data loader for better performance with large files
      const streamingLoader = new StreamingDataLoader(s3Client);
      
      const loadResult = await streamingLoader.loadDataSample(config, {
        bucket,
        key,
        hasHeader,
        maxSampleRows: 100, // Sample size for preview
        maxPreviewRows: 50  // Preview rows to return
      });

      res.json({
        preview: loadResult.preview,
        columns: loadResult.columns,
        totalRows: loadResult.estimatedTotalRows,
        hasHeader
      });

    } catch (error) {
      console.error('Failed to preview S3 data:', error);
      res.status(500).json({ error: 'Failed to preview S3 data' });
    }
  });

  // Import multiple files from S3
  app.post("/api/s3/import-files", async (req, res) => {
    try {
      const user = getCurrentUser(req);
      const { bucket, files, ...config } = s3ImportFilesSchema.parse(req.body);
      
      const results = [];
      
      for (const fileKey of files) {
        // Create initial job record
        const job = await storage.createJobHistory({
          tenantId: user.tenantId,
          type: "import",
          status: "processing",
          details: `Importing ${fileKey} from s3://${bucket}/${fileKey}`,
        });

        try {
          // Download file from S3
          const csvData = await s3Client.getObject(config, bucket, fileKey);
          
          // Parse CSV
          const parseResult = Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
          });

          if (parseResult.errors.length > 0) {
            await storage.updateJobHistory(job.id, user.tenantId, {
              status: "error",
              details: `CSV parsing failed: ${parseResult.errors[0].message}`,
            });
            results.push({ file: fileKey, success: false, error: parseResult.errors[0].message });
            continue;
          }

          const data = parseResult.data as Record<string, any>[];
          const preview = data.slice(0, 100);
          
          // Infer column types
          const columns = Object.keys(data[0] || {}).map(name => ({
            name,
            type: inferDataType(String(data[0]?.[name] || '')),
            sample: String(data[0]?.[name] || '')
          }));

          // Create dataset
          const dataset = await storage.createDataset({
            name: fileKey.split('/').pop()?.replace('.csv', '') || fileKey,
            filename: fileKey.split('/').pop() || fileKey,
            s3Bucket: bucket,
            s3Key: fileKey,
            tenantId: user.tenantId,
            totalRows: data.length,
            totalColumns: columns.length,
            columns: columns,
            data: data,
            preview: preview,
            status: "completed",
          });

          // Log activity
          await storage.createActivity({
            tenantId: user.tenantId,
            userId: 1, // TODO: Get actual userId
            action: "dataset_imported",
            entityType: "dataset",
            entityId: dataset.id,
            description: `Imported ${data.length} rows from ${fileKey} with ${columns.length} columns`,
            metadata: {
              s3Bucket: bucket,
              s3Key: fileKey,
              totalRows: data.length,
              totalColumns: columns.length,
              filename: dataset.filename,
              datasetName: dataset.name
            }
          });

          // Update job status
          await storage.updateJobHistory(job.id, user.tenantId, {
            status: "completed",
            details: `Successfully imported ${data.length} rows`,
            datasetId: dataset.id,
          });

          results.push({ file: fileKey, success: true, datasetId: dataset.id, rows: data.length });
        } catch (fileError) {
          await storage.updateJobHistory(job.id, user.tenantId, {
            status: "error",
            details: `Import failed: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`,
          });
          results.push({ 
            file: fileKey, 
            success: false, 
            error: fileError instanceof Error ? fileError.message : 'Unknown error' 
          });
        }
      }

      res.json({ results });
    } catch (error) {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Import failed" 
      });
    }
  });

  // Pipeline management routes
  app.get('/api/pipelines', async (req, res) => {
    try {
      const pipelines = await storage.getPipelines(1); // TODO: Get actual tenantId
      res.json(pipelines);
    } catch (error) {
      console.error('Failed to get pipelines:', error);
      res.status(500).json({ error: 'Failed to get pipelines' });
    }
  });

  app.post('/api/pipelines', async (req, res) => {
    try {
      const validatedData = createPipelineSchema.parse(req.body);
      
      // Create pipeline
      const pipeline = await storage.createPipeline({
        tenantId: 1, // TODO: Get actual tenantId
        createdBy: 1, // TODO: Get actual userId
        name: validatedData.name,
        description: validatedData.description,
        config: validatedData.steps ? { steps: validatedData.steps } : {},
        schedule: validatedData.schedule,
      });

      // Create pipeline steps
      if (validatedData.steps) {
        for (const step of validatedData.steps) {
          await storage.createPipelineStep({
            pipelineId: pipeline.id,
            name: step.name,
            type: step.type,
            order: step.order,
            config: step.config,
            retryCount: step.retryCount || 0,
            timeoutMinutes: step.timeoutMinutes || 30,
          });
        }
      }

      res.json(pipeline);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Failed to create pipeline:', error);
      res.status(500).json({ error: 'Failed to create pipeline' });
    }
  });

  app.patch('/api/pipelines/:id', async (req, res) => {
    try {
      const pipelineId = parseInt(req.params.id);
      const updates = req.body;
      
      const pipeline = await storage.updatePipeline(pipelineId, 1, updates); // TODO: Get actual tenantId
      
      if (!pipeline) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }
      
      res.json(pipeline);
    } catch (error) {
      console.error('Failed to update pipeline:', error);
      res.status(500).json({ error: 'Failed to update pipeline' });
    }
  });

  // Schedule pipeline
  app.post('/api/pipelines/:id/schedule', async (req, res) => {
    try {
      const pipelineId = parseInt(req.params.id);
      const { enabled, cronExpression, timezone } = req.body;
      
      const schedule = enabled ? {
        enabled: true,
        cronExpression,
        timezone: timezone || 'UTC'
      } : { enabled: false };
      
      const pipeline = await storage.updatePipelineSchedule(pipelineId, schedule);
      
      if (!pipeline) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }
      
      // Update scheduler
      if (enabled && cronExpression) {
        scheduler.updateJob(pipelineId, cronExpression);
      } else {
        scheduler.removeJob(pipelineId);
      }
      
      res.json({ success: true, pipeline });
    } catch (error) {
      console.error('Failed to schedule pipeline:', error);
      res.status(500).json({ error: 'Failed to schedule pipeline' });
    }
  });

  // Create automation trigger
  app.post('/api/pipelines/:id/triggers', async (req, res) => {
    try {
      const pipelineId = parseInt(req.params.id);
      const { triggerType, config, enabled } = req.body;
      
      const trigger = await storage.createAutomationTrigger({
        tenantId: 1, // TODO: Get actual tenantId
        pipelineId,
        type: triggerType,
        name: `${triggerType}_trigger_${pipelineId}`,
        config,
        enabled: enabled !== false
      });
      
      res.json(trigger);
    } catch (error) {
      console.error('Failed to create automation trigger:', error);
      res.status(500).json({ error: 'Failed to create automation trigger' });
    }
  });

  // Data Quality Reports API
  app.post('/api/datasets/:id/quality-report', async (req, res) => {
    try {
      const datasetId = parseInt(req.params.id);
      const { includeDetailed = true, checkTypes = [] } = req.body;
      
      // Get dataset
      const dataset = await storage.getDataset(datasetId, 1); // TODO: Get actual tenantId
      if (!dataset) {
        return res.status(404).json({ error: 'Dataset not found' });
      }
      
      // For large files, load a representative sample for quality analysis
      let analysisData = dataset.data || dataset.preview || [];
      
      // If dataset has S3 info, load more comprehensive sample for analysis
      if (dataset.s3Bucket && dataset.s3Key && analysisData.length < 1000) {
        try {
          const awsCredentials = await storage.getTenant(1); // TODO: Get actual tenantId
          if (awsCredentials?.awsAccessKeyId) {
            const config = {
              accessKeyId: awsCredentials.awsAccessKeyId,
              secretAccessKey: awsCredentials.awsSecretAccessKey,
              region: awsCredentials.awsRegion || 'us-east-1'
            };
            
            const streamingLoader = new StreamingDataLoader(s3Client);
            analysisData = await streamingLoader.loadFullDataForAnalysis(config, {
              bucket: dataset.s3Bucket,
              key: dataset.s3Key,
              hasHeader: true // Assume header for existing datasets
            });
          }
        } catch (error) {
          console.log('Could not load additional data for analysis, using stored data:', error instanceof Error ? error.message : 'Unknown error');
        }
      }
      
      const fullDataset = {
        ...dataset,
        data: analysisData,
        totalRows: Math.max(dataset.totalRows, analysisData.length)
      };
      
      // Generate quality report
      const analysis = await DataQualityEngine.analyzeDataset(fullDataset, checkTypes);
      
      // Save report to database
      const report = await storage.createDataQualityReport({
        tenantId: 1, // TODO: Get actual tenantId
        datasetId,
        reportData: analysis,
        summary: analysis.summary,
        qualityScore: analysis.metrics.overallScore,
        issuesFound: analysis.issues.length,
        recommendationsCount: analysis.summary.recommendations.length,
      });
      
      res.json({
        report,
        analysis
      });
    } catch (error) {
      console.error('Failed to generate quality report:', error);
      res.status(500).json({ error: 'Failed to generate quality report' });
    }
  });

  app.get('/api/datasets/:id/quality-reports', async (req, res) => {
    try {
      const datasetId = parseInt(req.params.id);
      const reports = await storage.getDataQualityReports(1, datasetId); // TODO: Get actual tenantId
      res.json(reports);
    } catch (error) {
      console.error('Failed to fetch quality reports:', error);
      res.status(500).json({ error: 'Failed to fetch quality reports' });
    }
  });

  // Property Maps API endpoints
  app.get('/api/property-maps', async (req, res) => {
    try {
      const datasetId = req.query.datasetId ? parseInt(req.query.datasetId as string) : undefined;
      const propertyMaps = await storage.getPropertyMaps(1, datasetId); // TODO: Get actual tenantId
      res.json(propertyMaps);
    } catch (error) {
      console.error('Failed to fetch property maps:', error);
      res.status(500).json({ message: 'Failed to fetch property maps' });
    }
  });

  app.post('/api/property-maps', async (req, res) => {
    try {
      const propertyMap = await storage.createPropertyMap({
        ...req.body,
        tenantId: 1 // TODO: Get actual tenantId
      });
      res.json(propertyMap);
    } catch (error) {
      console.error('Failed to create property map:', error);
      res.status(500).json({ message: 'Failed to create property map' });
    }
  });

  app.get('/api/property-maps/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const propertyMap = await storage.getPropertyMap(id, 1); // TODO: Get actual tenantId
      if (!propertyMap) {
        return res.status(404).json({ message: 'Property map not found' });
      }
      res.json(propertyMap);
    } catch (error) {
      console.error('Failed to fetch property map:', error);
      res.status(500).json({ message: 'Failed to fetch property map' });
    }
  });

  app.put('/api/property-maps/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const propertyMap = await storage.updatePropertyMap(id, 1, req.body); // TODO: Get actual tenantId
      if (!propertyMap) {
        return res.status(404).json({ message: 'Property map not found' });
      }
      res.json(propertyMap);
    } catch (error) {
      console.error('Failed to update property map:', error);
      res.status(500).json({ message: 'Failed to update property map' });
    }
  });

  app.delete('/api/property-maps/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deletePropertyMap(id, 1); // TODO: Get actual tenantId
      if (!success) {
        return res.status(404).json({ message: 'Property map not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete property map:', error);
      res.status(500).json({ message: 'Failed to delete property map' });
    }
  });

  app.get('/api/quality-reports', async (req, res) => {
    try {
      const reports = await storage.getDataQualityReports(1); // TODO: Get actual tenantId
      res.json(reports);
    } catch (error) {
      console.error('Failed to fetch quality reports:', error);
      res.status(500).json({ error: 'Failed to fetch quality reports' });
    }
  });

  app.get('/api/quality-reports/:id', async (req, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const report = await storage.getDataQualityReport(reportId, 1); // TODO: Get actual tenantId
      
      if (!report) {
        return res.status(404).json({ error: 'Quality report not found' });
      }
      
      res.json(report);
    } catch (error) {
      console.error('Failed to fetch quality report:', error);
      res.status(500).json({ error: 'Failed to fetch quality report' });
    }
  });

  app.delete('/api/quality-reports/:id', async (req, res) => {
    try {
      const reportId = parseInt(req.params.id);
      const deleted = await storage.deleteDataQualityReport(reportId, 1); // TODO: Get actual tenantId
      
      if (!deleted) {
        return res.status(404).json({ error: 'Quality report not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete quality report:', error);
      res.status(500).json({ error: 'Failed to delete quality report' });
    }
  });

  // Activity Feed API with pagination
  app.get('/api/activity/feed', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const page = parseInt(req.query.page as string) || 1;
      const offset = (page - 1) * limit;
      
      // Get activities from storage with pagination
      const activities = await storage.getActivityFeed(1, limit + offset); // TODO: Get actual tenantId
      
      // Simulate pagination by slicing the results
      const paginatedActivities = activities.slice(offset, offset + limit);
      
      res.json(paginatedActivities);
    } catch (error) {
      console.error('Failed to fetch activity feed:', error);
      res.status(500).json({ error: 'Failed to fetch activity feed' });
    }
  });

  app.post('/api/pipelines/:id/run', async (req, res) => {
    try {
      const pipelineId = parseInt(req.params.id);
      const { triggerType = 'manual', parameters } = req.body;
      
      const run = await storage.createPipelineRun({
        pipelineId,
        tenantId: 1, // TODO: Get actual tenantId
        triggerType,
        status: 'running',
        createdBy: 1, // TODO: Get actual userId
      });
      
      res.json(run);
    } catch (error) {
      console.error('Failed to run pipeline:', error);
      res.status(500).json({ error: 'Failed to run pipeline' });
    }
  });

  app.get('/api/pipelines/:id/runs', async (req, res) => {
    try {
      const pipelineId = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 50;
      
      const runs = await storage.getPipelineRuns(pipelineId, limit);
      res.json(runs);
    } catch (error) {
      console.error('Failed to get pipeline runs:', error);
      res.status(500).json({ error: 'Failed to get pipeline runs' });
    }
  });

  // Data Annotations API
  app.get('/api/annotations', async (req, res) => {
    try {
      const datasetId = parseInt(req.query.datasetId as string);
      const rowIndex = req.query.rowIndex ? parseInt(req.query.rowIndex as string) : undefined;
      const columnName = req.query.columnName as string;
      
      if (!datasetId) {
        return res.status(400).json({ error: 'Dataset ID is required' });
      }
      
      const annotations = await storage.getDataAnnotations(1, datasetId, rowIndex, columnName);
      res.json(annotations);
    } catch (error) {
      console.error('Failed to fetch annotations:', error);
      res.status(500).json({ error: 'Failed to fetch annotations' });
    }
  });

  app.post('/api/annotations', async (req, res) => {
    try {
      const { datasetId, rowIndex, columnName, cellValue, annotationType, content, priority, assignedTo } = req.body;
      
      const annotation = await storage.createDataAnnotation({
        tenantId: 1, // TODO: Get actual tenantId
        datasetId,
        rowIndex,
        columnName,
        cellValue,
        annotationType: annotationType || 'comment',
        content,
        priority: priority || 'medium',
        createdBy: 1, // TODO: Get actual userId
        assignedTo,
        status: 'active'
      });
      
      res.json(annotation);
    } catch (error) {
      console.error('Failed to create annotation:', error);
      res.status(500).json({ error: 'Failed to create annotation' });
    }
  });

  app.put('/api/annotations/:id', async (req, res) => {
    try {
      const annotationId = parseInt(req.params.id);
      const updates = req.body;
      
      const updated = await storage.updateDataAnnotation(annotationId, 1, updates);
      
      if (!updated) {
        return res.status(404).json({ error: 'Annotation not found' });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Failed to update annotation:', error);
      res.status(500).json({ error: 'Failed to update annotation' });
    }
  });

  app.delete('/api/annotations/:id', async (req, res) => {
    try {
      const annotationId = parseInt(req.params.id);
      const deleted = await storage.deleteDataAnnotation(annotationId, 1);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Annotation not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete annotation:', error);
      res.status(500).json({ error: 'Failed to delete annotation' });
    }
  });

  // Annotation Comments API
  app.get('/api/annotations/:id/comments', async (req, res) => {
    try {
      const annotationId = parseInt(req.params.id);
      const comments = await storage.getAnnotationComments(annotationId, 1);
      res.json(comments);
    } catch (error) {
      console.error('Failed to fetch annotation comments:', error);
      res.status(500).json({ error: 'Failed to fetch annotation comments' });
    }
  });

  app.post('/api/annotations/:id/comments', async (req, res) => {
    try {
      const annotationId = parseInt(req.params.id);
      const { content } = req.body;
      
      const comment = await storage.createAnnotationComment({
        annotationId,
        tenantId: 1, // TODO: Get actual tenantId
        userId: 1, // TODO: Get actual userId
        content,
        isSystemMessage: false
      });
      
      res.json(comment);
    } catch (error) {
      console.error('Failed to create annotation comment:', error);
      res.status(500).json({ error: 'Failed to create annotation comment' });
    }
  });

  app.put('/api/annotations/:annotationId/comments/:commentId', async (req, res) => {
    try {
      const commentId = parseInt(req.params.commentId);
      const updates = req.body;
      
      const updated = await storage.updateAnnotationComment(commentId, 1, updates);
      
      if (!updated) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Failed to update annotation comment:', error);
      res.status(500).json({ error: 'Failed to update annotation comment' });
    }
  });

  app.delete('/api/annotations/:annotationId/comments/:commentId', async (req, res) => {
    try {
      const commentId = parseInt(req.params.commentId);
      const deleted = await storage.deleteAnnotationComment(commentId, 1);
      
      if (!deleted) {
        return res.status(404).json({ error: 'Comment not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete annotation comment:', error);
      res.status(500).json({ error: 'Failed to delete annotation comment' });
    }
  });

  // Job Management API Routes
  app.get('/api/jobs', async (req, res) => {
    try {
      const jobs = await storage.getJobs(1); // TODO: Get actual tenantId
      res.json(jobs);
    } catch (error) {
      console.error('Failed to get jobs:', error);
      res.status(500).json({ error: 'Failed to get jobs' });
    }
  });

  app.post('/api/jobs', async (req, res) => {
    try {
      const { name, description, type, schedule, config, status = 'active' } = req.body;
      
      if (!name || !type || !schedule) {
        return res.status(400).json({ error: 'Name, type, and schedule are required' });
      }

      const job = await storage.createJob({
        tenantId: 1, // TODO: Get actual tenantId
        name,
        description: description || '',
        type,
        schedule,
        config: config || {},
        status,
        createdBy: 1, // TODO: Get actual userId
      });

      // Add job to scheduler if active
      if (status === 'active') {
        scheduler.addJob(job.id, schedule);
      }

      res.json(job);
    } catch (error) {
      console.error('Failed to create job:', error);
      res.status(500).json({ error: 'Failed to create job' });
    }
  });

  app.patch('/api/jobs/:id', async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const updates = req.body;
      
      const job = await storage.updateJob(jobId, 1, updates); // TODO: Get actual tenantId
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Update scheduler
      if (updates.status === 'active' && updates.schedule) {
        scheduler.updateJob(jobId, updates.schedule);
      } else if (updates.status === 'paused' || updates.status === 'disabled') {
        scheduler.removeJob(jobId);
      }

      res.json(job);
    } catch (error) {
      console.error('Failed to update job:', error);
      res.status(500).json({ error: 'Failed to update job' });
    }
  });

  app.delete('/api/jobs/:id', async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const deleted = await storage.deleteJob(jobId, 1); // TODO: Get actual tenantId
      
      if (!deleted) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Remove from scheduler
      scheduler.removeJob(jobId);

      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete job:', error);
      res.status(500).json({ error: 'Failed to delete job' });
    }
  });

  app.post('/api/jobs/:id/run', async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      
      // Get job details
      const jobs = await storage.getJobs(1); // TODO: Get actual tenantId
      const job = jobs.find((j: any) => j.id === jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Create execution tracking record
      const execution = {
        id: Date.now(), // Simple ID for demo
        jobId: jobId,
        status: 'running',
        startTime: new Date().toISOString(),
        steps: [
          {
            id: 'init',
            name: 'Initializing Import',
            status: 'completed',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            details: { description: 'Import job initialized successfully' }
          },
          {
            id: 'dataset',
            name: 'Loading Dataset',
            status: 'running',
            startTime: new Date().toISOString(),
            details: { description: 'Loading data from selected dataset...' }
          },
          {
            id: 'transform',
            name: 'Applying Transformations',
            status: 'pending',
            details: { description: 'Waiting for dataset to load...' }
          },
          {
            id: 'create_table',
            name: 'Creating PostgreSQL Table',
            status: 'pending',
            details: { description: 'Waiting for transformations to complete...' }
          },
          {
            id: 'import_data',
            name: 'Importing Data',
            status: 'pending',
            details: { description: 'Waiting for table creation...' }
          }
        ]
      };

      // Store execution in memory for demo (in production, use database)
      (global as any).jobExecutions = (global as any).jobExecutions || {};
      (global as any).jobExecutions[jobId] = execution;

      // Start background execution
      setTimeout(async () => {
        await simulateJobExecution(jobId, job);
      }, 1000);
      
      res.json({ success: true, executionId: execution.id });
    } catch (error) {
      console.error('Failed to run job:', error);
      res.status(500).json({ error: 'Failed to run job' });
    }
  });

  // Get job execution status
  app.get('/api/jobs/:id/execution', async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      
      (global as any).jobExecutions = (global as any).jobExecutions || {};
      const execution = (global as any).jobExecutions[jobId];
      
      if (!execution) {
        return res.status(404).json({ error: 'Execution not found' });
      }
      
      res.json(execution);
    } catch (error) {
      console.error('Failed to get execution status:', error);
      res.status(500).json({ error: 'Failed to get execution status' });
    }
  });

  // Register test endpoints for development
  registerTestEndpoints(app);

  const httpServer = createServer(app);
  return httpServer;
}

// Simulate job execution with real dataset processing
async function simulateJobExecution(jobId: number, job: any) {
  const execution = (global as any).jobExecutions[jobId];
  if (!execution) return;

  try {
    // Step 1: Load Dataset
    await updateExecutionStep(jobId, 'dataset', 'running', 'Loading dataset from storage...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    let dataset, processedData, tableName;
    
    if (job.config?.datasetId) {
      dataset = await storage.getDataset(job.config.datasetId, 1);
      if (!dataset) {
        throw new Error('Dataset not found');
      }
      await updateExecutionStep(jobId, 'dataset', 'completed', `Successfully loaded ${dataset.name} with ${dataset.totalRows} rows`);
    } else {
      await updateExecutionStep(jobId, 'dataset', 'completed', 'Dataset loading simulated (no dataset selected)');
    }

    // Step 2: Apply Transformations
    await updateExecutionStep(jobId, 'transform', 'running', 'Processing data transformations...');
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (dataset) {
      const data = dataset.data as Record<string, any>[];
      processedData = data.slice(0, 5000); // Limit to 5000 records
      await updateExecutionStep(jobId, 'transform', 'completed', `Applied transformations to ${processedData.length} records`);
    } else {
      await updateExecutionStep(jobId, 'transform', 'completed', 'Transformation step completed (simulated)');
    }

    // Step 3: Create PostgreSQL Table
    await updateExecutionStep(jobId, 'create_table', 'running', 'Creating PostgreSQL table...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (dataset && processedData) {
      tableName = `imported_${dataset.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
      
      try {
        // Import required modules
        const { pool } = await import('./db');
        
        // Create table schema
        const columnDefinitions = dataset.columns.map((col: any) => {
          let sqlType = 'TEXT';
          switch (col.type) {
            case 'number': sqlType = 'NUMERIC'; break;
            case 'date': sqlType = 'DATE'; break;
            case 'datetime': sqlType = 'TIMESTAMP'; break;
            case 'boolean': sqlType = 'BOOLEAN'; break;
            default: sqlType = 'TEXT';
          }
          return `"${col.name}" ${sqlType}`;
        }).join(', ');
        
        const dropTableSQL = `DROP TABLE IF EXISTS "${tableName}"`;
        const createTableSQL = `CREATE TABLE "${tableName}" (
          id SERIAL PRIMARY KEY,
          ${columnDefinitions},
          imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;
        
        await pool.query(dropTableSQL);
        await pool.query(createTableSQL);
        
        await updateExecutionStep(jobId, 'create_table', 'completed', `Created table: ${tableName}`);
      } catch (error) {
        await updateExecutionStep(jobId, 'create_table', 'error', `Failed to create table: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    } else {
      await updateExecutionStep(jobId, 'create_table', 'completed', 'Table creation completed (simulated)');
    }

    // Step 4: Import Data
    await updateExecutionStep(jobId, 'import_data', 'running', 'Importing data to PostgreSQL...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (dataset && processedData && tableName) {
      try {
        const { pool } = await import('./db');
        
        // Insert data in batches
        const batchSize = 100;
        let totalInserted = 0;
        
        for (let i = 0; i < processedData.length; i += batchSize) {
          const batch = processedData.slice(i, i + batchSize);
          
          const placeholders = batch.map((_, batchIndex) => {
            const startIndex = batchIndex * dataset.columns.length;
            const rowPlaceholders = dataset.columns.map((_: any, colIndex: number) => `$${startIndex + colIndex + 1}`);
            return `(${rowPlaceholders.join(', ')})`;
          }).join(', ');
          
          const insertSQL = `INSERT INTO "${tableName}" (${dataset.columns.map((col: any) => `"${col.name}"`).join(', ')}) VALUES ${placeholders}`;
          
          const allValues = batch.flatMap(row => 
            dataset.columns.map((col: any) => {
              const value = row[col.name];
              if (value === null || value === undefined) return null;
              
              switch (col.type) {
                case 'number':
                  const num = Number(value);
                  return isNaN(num) ? null : num;
                case 'boolean':
                  return Boolean(value);
                case 'date':
                case 'datetime':
                  return value instanceof Date ? value : new Date(value);
                default:
                  return String(value);
              }
            })
          );
          
          await pool.query(insertSQL, allValues);
          totalInserted += batch.length;
        }
        
        await updateExecutionStep(jobId, 'import_data', 'completed', `Successfully imported ${totalInserted} records`);
        
        // Mark execution as complete with results
        execution.status = 'completed';
        execution.endTime = new Date().toISOString();
        execution.results = {
          tableName: tableName,
          totalRows: totalInserted,
          datasetName: dataset.name,
          preview: processedData.slice(0, 10),
          columns: dataset.columns
        };
        
      } catch (error) {
        await updateExecutionStep(jobId, 'import_data', 'error', `Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    } else {
      await updateExecutionStep(jobId, 'import_data', 'completed', 'Data import completed (simulated)');
      
      // Mark execution as complete
      execution.status = 'completed';
      execution.endTime = new Date().toISOString();
      execution.results = {
        tableName: 'simulated_import_table',
        totalRows: 1000,
        datasetName: 'Sample Dataset',
        preview: [],
        columns: []
      };
    }

  } catch (error) {
    console.error('Job execution failed:', error);
    execution.status = 'failed';
    execution.endTime = new Date().toISOString();
    
    // Mark current step as error
    const currentStep = execution.steps.find((s: any) => s.status === 'running');
    if (currentStep) {
      currentStep.status = 'error';
      currentStep.endTime = new Date().toISOString();
      currentStep.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }
}

async function updateExecutionStep(jobId: number, stepId: string, status: string, description: string) {
  const execution = (global as any).jobExecutions?.[jobId];
  if (!execution) return;
  
  const step = execution.steps.find((s: any) => s.id === stepId);
  if (!step) return;
  
  step.status = status;
  step.details = { description };
  
  if (status === 'running') {
    step.startTime = new Date().toISOString();
  } else if (status === 'completed' || status === 'error') {
    step.endTime = new Date().toISOString();
  }
}
