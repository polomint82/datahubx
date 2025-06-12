import { storage } from "./storage";
import { parse as parseCron } from "node-cron";

interface SchedulerJob {
  pipelineId: number;
  nextRun: Date;
  cronExpression: string;
}

export class PipelineScheduler {
  private jobs: Map<number, SchedulerJob> = new Map();
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initialize();
  }

  async initialize() {
    console.log("Initializing Pipeline Scheduler...");
    await this.loadScheduledPipelines();
    this.start();
  }

  async loadScheduledPipelines() {
    try {
      const pipelines = await storage.getScheduledPipelines();
      
      for (const pipeline of pipelines) {
        if (pipeline.schedule && pipeline.status === 'active') {
          const schedule = pipeline.schedule as any;
          if (schedule.enabled && schedule.cronExpression) {
            this.addJob(pipeline.id, schedule.cronExpression);
          }
        }
      }
      
      console.log(`Loaded ${this.jobs.size} scheduled pipelines`);
    } catch (error) {
      console.error("Error loading scheduled pipelines:", error);
    }
  }

  addJob(pipelineId: number, cronExpression: string) {
    try {
      const nextRun = this.getNextRunTime(cronExpression);
      this.jobs.set(pipelineId, {
        pipelineId,
        nextRun,
        cronExpression,
      });
      console.log(`Scheduled pipeline ${pipelineId} for next run: ${nextRun.toISOString()}`);
    } catch (error) {
      console.error(`Invalid cron expression for pipeline ${pipelineId}: ${cronExpression}`, error);
    }
  }

  removeJob(pipelineId: number) {
    this.jobs.delete(pipelineId);
    console.log(`Removed scheduled job for pipeline ${pipelineId}`);
  }

  updateJob(pipelineId: number, cronExpression: string) {
    this.removeJob(pipelineId);
    this.addJob(pipelineId, cronExpression);
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log("Starting Pipeline Scheduler...");
    
    // Check for scheduled jobs every minute
    this.checkInterval = setInterval(() => {
      this.checkScheduledJobs();
    }, 60000);
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log("Pipeline Scheduler stopped");
  }

  private async checkScheduledJobs() {
    const now = new Date();
    
    for (const [pipelineId, job] of this.jobs) {
      if (job.nextRun <= now) {
        console.log(`Triggering scheduled pipeline: ${pipelineId}`);
        
        try {
          await this.executePipeline(pipelineId);
          
          // Schedule next run
          const nextRun = this.getNextRunTime(job.cronExpression);
          job.nextRun = nextRun;
          
          // Update pipeline's next run time in database
          await storage.updatePipeline(pipelineId, 1, { // TODO: Get actual tenantId
            lastRunAt: now,
            nextRunAt: nextRun,
          });
          
        } catch (error) {
          console.error(`Error executing scheduled pipeline ${pipelineId}:`, error);
        }
      }
    }
  }

  private async executePipeline(pipelineId: number) {
    try {
      // Create a new pipeline run
      const run = await storage.createPipelineRun({
        pipelineId,
        tenantId: 1, // TODO: Get actual tenantId
        triggerType: 'scheduled',
        status: 'running',
      });

      console.log(`Started pipeline run ${run.id} for pipeline ${pipelineId}`);

      // Get pipeline steps
      const steps = await storage.getPipelineSteps(pipelineId);
      
      // Execute each step
      for (const step of steps) {
        if (!step.enabled) {
          console.log(`Skipping disabled step: ${step.name}`);
          continue;
        }

        const stepExecution = await storage.createStepExecution({
          runId: run.id,
          stepId: step.id,
          status: 'running',
          startedAt: new Date(),
        });

        try {
          await this.executeStep(step, stepExecution.id);
          
          await storage.updateStepExecution(stepExecution.id, {
            status: 'completed',
            completedAt: new Date(),
            duration: Math.floor((new Date().getTime() - stepExecution.startedAt!.getTime()) / 1000),
          });
          
        } catch (stepError) {
          console.error(`Step execution failed: ${step.name}`, stepError);
          
          await storage.updateStepExecution(stepExecution.id, {
            status: 'failed',
            completedAt: new Date(),
            error: stepError instanceof Error ? stepError.message : 'Unknown error',
          });

          // If step fails and no retry, fail the entire pipeline
          if (step.retryCount === 0) {
            throw stepError;
          }
        }
      }

      // Mark pipeline run as completed
      await storage.updatePipelineRun(run.id, {
        status: 'completed',
        completedAt: new Date(),
        duration: Math.floor((new Date().getTime() - run.startedAt.getTime()) / 1000),
      });

      // Update pipeline success count
      const pipeline = await storage.getPipeline(pipelineId, 1); // TODO: Get actual tenantId
      if (pipeline) {
        await storage.updatePipeline(pipelineId, 1, {
          runCount: pipeline.runCount + 1,
          successCount: pipeline.successCount + 1,
        });
      }

    } catch (error) {
      console.error(`Pipeline execution failed: ${pipelineId}`, error);
      
      // Mark pipeline run as failed
      const run = await storage.getPipelineRun(pipelineId);
      if (run) {
        await storage.updatePipelineRun(run.id, {
          status: 'failed',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Update pipeline failure count
      const pipeline = await storage.getPipeline(pipelineId, 1); // TODO: Get actual tenantId
      if (pipeline) {
        await storage.updatePipeline(pipelineId, 1, {
          runCount: pipeline.runCount + 1,
          failureCount: pipeline.failureCount + 1,
        });
      }
    }
  }

  private async executeStep(step: any, executionId: number) {
    const config = step.config as any;
    
    switch (step.type) {
      case 'import':
        await this.executeImportStep(config, executionId);
        break;
      case 'transform':
        await this.executeTransformStep(config, executionId);
        break;
      case 'export':
        await this.executeExportStep(config, executionId);
        break;
      case 'validation':
        await this.executeValidationStep(config, executionId);
        break;
      case 'notification':
        await this.executeNotificationStep(config, executionId);
        break;
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  private async executeImportStep(config: any, executionId: number) {
    console.log(`Executing import step with config:`, config);
    
    try {
      // Get the dataset if datasetId is provided
      if (config.datasetId) {
        const dataset = await storage.getDataset(config.datasetId, 1); // TODO: Get actual tenantId
        if (!dataset) {
          throw new Error(`Dataset with ID ${config.datasetId} not found`);
        }
        
        console.log(`Processing dataset: ${dataset.name} (${dataset.filename})`);
        
        // Get the dataset data (limit to first 5000 records for demo)
        const data = dataset.data as Record<string, any>[];
        const limitedData = data.slice(0, 5000);
        
        console.log(`Processing ${limitedData.length} records from dataset (limited from ${data.length} total)`);
        
        // Apply transformations if specified
        let processedData = limitedData;
        if (config.transformations && config.transformations.length > 0) {
          console.log(`Applying ${config.transformations.length} transformations`);
          processedData = await this.applyTransformations(limitedData, config.transformations);
        }
        
        // Create a table name based on the dataset name
        const tableName = `imported_${dataset.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
        
        // Create the table and insert data
        await this.createAndPopulateTable(tableName, processedData, dataset.columns);
        
        console.log(`Successfully imported ${processedData.length} records to table: ${tableName}`);
        
        return {
          filesImported: 1,
          totalRows: processedData.length,
          tableName: tableName,
          datasetName: dataset.name
        };
      } else {
        // Original S3 file mask logic for backward compatibility
        const expandedFileMask = this.expandFileMaskTemplate(config.fileMask || '*.csv');
        const files = [`${config.s3Bucket || 'default-bucket'}/${config.s3Path || 'data'}/${expandedFileMask}`];
        
        console.log(`Importing files with expanded mask: ${expandedFileMask}`);
        console.log(`Files to import: ${files.join(', ')}`);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return {
          filesImported: files.length,
          totalRows: Math.floor(Math.random() * 1000) + 100,
          files: files,
          expandedFileMask: expandedFileMask
        };
      }
    } catch (error) {
      console.error('Import step failed:', error);
      throw error;
    }
  }

  private async executeTransformStep(config: any, executionId: number) {
    console.log(`Executing transform step with config:`, config);
    // TODO: Implement transformation logic
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
  }

  private async executeExportStep(config: any, executionId: number) {
    console.log(`Executing export step with config:`, config);
    // TODO: Implement export logic
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
  }

  private async executeValidationStep(config: any, executionId: number) {
    console.log(`Executing validation step with config:`, config);
    // TODO: Implement validation logic
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate work
  }

  private async executeNotificationStep(config: any, executionId: number) {
    console.log(`Executing notification step with config:`, config);
    // TODO: Implement notification logic (email, webhook, etc.)
    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate work
  }

  private expandFileMaskTemplate(fileMask: string, date: Date = new Date()): string {
    let expanded = fileMask;
    
    // Template variable mappings
    const variables = {
      '{{YYYY}}': date.getFullYear().toString(),
      '{{YY}}': date.getFullYear().toString().slice(-2),
      '{{MM}}': (date.getMonth() + 1).toString().padStart(2, '0'),
      '{{DD}}': date.getDate().toString().padStart(2, '0'),
      '{{MM-DD-YYYY}}': `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}-${date.getFullYear()}`,
      '{{YYYY-MM-DD}}': `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`,
      '{{HH}}': date.getHours().toString().padStart(2, '0'),
      '{{mm}}': date.getMinutes().toString().padStart(2, '0'),
      '{{WEEK}}': this.getWeekNumber(date).toString().padStart(2, '0'),
      '{{QUARTER}}': `Q${Math.floor(date.getMonth() / 3) + 1}`
    };
    
    // Replace all template variables
    for (const [template, value] of Object.entries(variables)) {
      expanded = expanded.replace(new RegExp(template.replace(/[{}]/g, '\\$&'), 'g'), value);
    }
    
    return expanded;
  }

  private getWeekNumber(date: Date): number {
    const target = new Date(date.valueOf());
    const dayNumber = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNumber + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  }

  private getNextRunTime(cronExpression: string): Date {
    // Simple cron parsing - in production, use a proper cron library
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) {
      throw new Error('Invalid cron expression format');
    }

    // For demo purposes, schedule next run in 1 hour
    // In production, implement proper cron parsing
    const nextRun = new Date();
    nextRun.setHours(nextRun.getHours() + 1);
    return nextRun;
  }

  getJobStatus() {
    return Array.from(this.jobs.values()).map(job => ({
      pipelineId: job.pipelineId,
      nextRun: job.nextRun,
      cronExpression: job.cronExpression,
    }));
  }

  private async applyTransformations(data: Record<string, any>[], transformations: any[]): Promise<Record<string, any>[]> {
    let processedData = [...data];
    
    for (const transformation of transformations) {
      console.log(`Applying transformation: ${transformation.type}`);
      
      switch (transformation.type) {
        case 'filter':
          processedData = processedData.filter(row => {
            const { column, operator, value } = transformation.config;
            if (!row[column]) return false;
            
            switch (operator) {
              case 'equals': return row[column] === value;
              case 'not_equals': return row[column] !== value;
              case 'contains': return String(row[column]).includes(value);
              case 'greater_than': return Number(row[column]) > Number(value);
              case 'less_than': return Number(row[column]) < Number(value);
              default: return true;
            }
          });
          break;
          
        case 'transform_column':
          processedData = processedData.map(row => {
            const { column, expression } = transformation.config;
            if (row[column] !== undefined) {
              if (expression === 'UPPER') {
                row[column] = String(row[column]).toUpperCase();
              } else if (expression === 'LOWER') {
                row[column] = String(row[column]).toLowerCase();
              } else if (expression.startsWith('TRIM')) {
                row[column] = String(row[column]).trim();
              }
            }
            return row;
          });
          break;
          
        case 'add_column':
          processedData = processedData.map(row => {
            const { newColumn, expression } = transformation.config;
            row[newColumn] = expression || '';
            return row;
          });
          break;
      }
    }
    
    return processedData;
  }

  private async createAndPopulateTable(tableName: string, data: Record<string, any>[], columns: any[]) {
    if (data.length === 0) {
      console.log('No data to import, skipping table creation');
      return;
    }

    try {
      const { pool } = await import('./db');
      
      const columnDefinitions = columns.map(col => {
        let sqlType = 'TEXT';
        
        switch (col.type) {
          case 'number':
            sqlType = 'NUMERIC';
            break;
          case 'date':
            sqlType = 'DATE';
            break;
          case 'datetime':
            sqlType = 'TIMESTAMP';
            break;
          case 'boolean':
            sqlType = 'BOOLEAN';
            break;
          default:
            sqlType = 'TEXT';
        }
        
        return `"${col.name}" ${sqlType}`;
      }).join(', ');
      
      const dropTableSQL = `DROP TABLE IF EXISTS "${tableName}"`;
      const createTableSQL = `CREATE TABLE "${tableName}" (
        id SERIAL PRIMARY KEY,
        ${columnDefinitions},
        imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
      
      console.log(`Creating table: ${tableName}`);
      await pool.query(dropTableSQL);
      await pool.query(createTableSQL);
      
      const batchSize = 100;
      let totalInserted = 0;
      
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        
        const placeholders = batch.map((_, batchIndex) => {
          const startIndex = batchIndex * columns.length;
          const rowPlaceholders = columns.map((_, colIndex) => `$${startIndex + colIndex + 1}`);
          return `(${rowPlaceholders.join(', ')})`;
        }).join(', ');
        
        const insertSQL = `INSERT INTO "${tableName}" (${columns.map(col => `"${col.name}"`).join(', ')}) VALUES ${placeholders}`;
        
        const allValues = batch.flatMap(row => 
          columns.map(col => {
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
        
        console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records (total: ${totalInserted})`);
      }
      
      console.log(`Successfully created and populated table "${tableName}" with ${totalInserted} records`);
      
    } catch (error) {
      console.error(`Failed to create and populate table "${tableName}":`, error);
      throw error;
    }
  }
}

// Global scheduler instance
export const scheduler = new PipelineScheduler();