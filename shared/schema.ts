import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // AWS credentials stored securely per tenant
  awsAccessKeyId: text("aws_access_key_id"),
  awsSecretAccessKey: text("aws_secret_access_key"),
  awsRegion: text("aws_region"),
  awsDefaultBucket: text("aws_default_bucket"),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  tenantId: integer("tenant_id").notNull(),
  fullName: text("full_name"),
  role: text("role", { enum: ['admin', 'editor', 'viewer'] }).default('editor').notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const collaborationSessions = pgTable("collaboration_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  datasetId: integer("dataset_id").references(() => datasets.id),
  transformationId: integer("transformation_id").references(() => transformations.id),
  sessionType: text("session_type", { enum: ['dataset_view', 'transformation_edit', 'file_browser'] }).notNull(),
  status: text("status", { enum: ['active', 'idle', 'disconnected'] }).default('active').notNull(),
  metadata: jsonb("metadata"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
});

export const activityFeed = pgTable("activity_feed", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  entityType: text("entity_type", { enum: ['dataset', 'transformation', 'import', 'user'] }).notNull(),
  entityId: integer("entity_id"),
  action: text("action").notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const teamInvitations = pgTable("team_invitations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  invitedBy: integer("invited_by").notNull().references(() => users.id),
  email: text("email").notNull(),
  role: text("role", { enum: ['admin', 'editor', 'viewer'] }).default('editor').notNull(),
  token: text("token").notNull().unique(),
  status: text("status", { enum: ['pending', 'accepted', 'expired'] }).default('pending').notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const datasets = pgTable("datasets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  filename: text("filename").notNull(),
  s3Bucket: text("s3_bucket"),
  s3Key: text("s3_key"),
  tenantId: integer("tenant_id").notNull(),
  totalRows: integer("total_rows").notNull().default(0),
  totalColumns: integer("total_columns").notNull().default(0),
  columns: jsonb("columns").$type<Array<{name: string, type: string, sample?: string}>>().notNull(),
  data: jsonb("data").$type<Array<Record<string, any>>>().notNull(),
  preview: jsonb("preview").$type<Array<Record<string, any>>>().notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, error
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const propertyMaps = pgTable("property_maps", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  datasetId: integer("dataset_id").notNull().references(() => datasets.id),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  status: text("status", { enum: ['draft', 'active', 'archived'] }).default('draft').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const transformations = pgTable("transformations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  datasetId: integer("dataset_id").notNull(),
  tenantId: integer("tenant_id").notNull(),
  propertyMapId: integer("property_map_id").references(() => propertyMaps.id),
  sequenceNumber: integer("sequence_number").notNull().default(1),
  targetColumn: text("target_column").notNull(),
  expression: text("expression").notNull(),
  functionType: text("function_type").notNull(), // string, math, date
  status: text("status").notNull().default("draft"), // draft, applied
  preview: jsonb("preview").$type<Array<{before: string, after: string}>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const jobHistory = pgTable("job_history", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  type: text("type").notNull(), // import, transformation, pipeline
  status: text("status").notNull(), // pending, processing, completed, error
  details: text("details").notNull(),
  datasetId: integer("dataset_id"),
  transformationId: integer("transformation_id"),
  pipelineId: integer("pipeline_id"),
  scheduledRunId: integer("scheduled_run_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dataPipelines = pgTable("data_pipelines", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ['active', 'paused', 'archived'] }).default('active').notNull(),
  config: jsonb("config").notNull(), // Pipeline configuration
  schedule: jsonb("schedule"), // Cron expression and schedule settings
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  runCount: integer("run_count").default(0).notNull(),
  successCount: integer("success_count").default(0).notNull(),
  failureCount: integer("failure_count").default(0).notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pipelineRuns = pgTable("pipeline_runs", {
  id: serial("id").primaryKey(),
  pipelineId: integer("pipeline_id").notNull().references(() => dataPipelines.id),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  status: text("status", { enum: ['running', 'completed', 'failed', 'cancelled'] }).default('running').notNull(),
  triggerType: text("trigger_type", { enum: ['manual', 'scheduled', 'webhook', 'file_trigger'] }).notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // Duration in seconds
  logs: text("logs"),
  metrics: jsonb("metrics"), // Run metrics and statistics
  error: text("error"),
  createdBy: integer("created_by").references(() => users.id),
});

export const pipelineSteps = pgTable("pipeline_steps", {
  id: serial("id").primaryKey(),
  pipelineId: integer("pipeline_id").notNull().references(() => dataPipelines.id),
  name: text("name").notNull(),
  type: text("type", { enum: ['import', 'transform', 'export', 'validation', 'notification'] }).notNull(),
  order: integer("order").notNull(),
  config: jsonb("config").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  retryCount: integer("retry_count").default(0).notNull(),
  timeoutMinutes: integer("timeout_minutes").default(30).notNull(),
});

export const stepExecutions = pgTable("step_executions", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").notNull().references(() => pipelineRuns.id),
  stepId: integer("step_id").notNull().references(() => pipelineSteps.id),
  status: text("status", { enum: ['pending', 'running', 'completed', 'failed', 'skipped'] }).default('pending').notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"),
  logs: text("logs"),
  error: text("error"),
  retryAttempt: integer("retry_attempt").default(0).notNull(),
  outputData: jsonb("output_data"),
});

export const automationTriggers = pgTable("automation_triggers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  type: text("type", { enum: ['schedule', 'file_upload', 'data_change', 'webhook', 'manual'] }).notNull(),
  config: jsonb("config").notNull(),
  pipelineId: integer("pipeline_id").notNull().references(() => dataPipelines.id),
  enabled: boolean("enabled").default(true).notNull(),
  lastTriggeredAt: timestamp("last_triggered_at"),
  triggerCount: integer("trigger_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertDatasetSchema = createInsertSchema(datasets).omit({
  id: true,
  createdAt: true,
});

export const insertPropertyMapSchema = createInsertSchema(propertyMaps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransformationSchema = createInsertSchema(transformations).omit({
  id: true,
  createdAt: true,
});

export const insertJobHistorySchema = createInsertSchema(jobHistory).omit({
  id: true,
  createdAt: true,
});

export const insertCollaborationSessionSchema = createInsertSchema(collaborationSessions).omit({
  id: true,
  startedAt: true,
  lastActivity: true,
});

export const insertActivityFeedSchema = createInsertSchema(activityFeed).omit({
  id: true,
  createdAt: true,
});

export const insertTeamInvitationSchema = createInsertSchema(teamInvitations).omit({
  id: true,
  createdAt: true,
});

export const insertDataPipelineSchema = createInsertSchema(dataPipelines).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  runCount: true,
  successCount: true,
  failureCount: true,
});

export const insertPipelineRunSchema = createInsertSchema(pipelineRuns).omit({
  id: true,
  startedAt: true,
});

export const insertPipelineStepSchema = createInsertSchema(pipelineSteps).omit({
  id: true,
});

export const insertStepExecutionSchema = createInsertSchema(stepExecutions).omit({
  id: true,
});

export const insertAutomationTriggerSchema = createInsertSchema(automationTriggers).omit({
  id: true,
  createdAt: true,
  triggerCount: true,
});

// Types
export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Dataset = typeof datasets.$inferSelect;
export type PropertyMap = typeof propertyMaps.$inferSelect;
export type Transformation = typeof transformations.$inferSelect;
export type JobHistory = typeof jobHistory.$inferSelect;
export type CollaborationSession = typeof collaborationSessions.$inferSelect;
export type ActivityFeed = typeof activityFeed.$inferSelect;
export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type DataPipeline = typeof dataPipelines.$inferSelect;
export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type PipelineStep = typeof pipelineSteps.$inferSelect;
export type StepExecution = typeof stepExecutions.$inferSelect;
export type AutomationTrigger = typeof automationTriggers.$inferSelect;

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertDataset = z.infer<typeof insertDatasetSchema>;
export type InsertPropertyMap = z.infer<typeof insertPropertyMapSchema>;
export type InsertTransformation = z.infer<typeof insertTransformationSchema>;
export type InsertJobHistory = z.infer<typeof insertJobHistorySchema>;
export type InsertCollaborationSession = z.infer<typeof insertCollaborationSessionSchema>;
export type InsertActivityFeed = z.infer<typeof insertActivityFeedSchema>;
export type InsertTeamInvitation = z.infer<typeof insertTeamInvitationSchema>;
export type InsertDataPipeline = z.infer<typeof insertDataPipelineSchema>;
export type InsertPipelineRun = z.infer<typeof insertPipelineRunSchema>;
export type InsertPipelineStep = z.infer<typeof insertPipelineStepSchema>;
export type InsertStepExecution = z.infer<typeof insertStepExecutionSchema>;
export type InsertAutomationTrigger = z.infer<typeof insertAutomationTriggerSchema>;

// API request schemas
export const s3ImportSchema = z.object({
  bucket: z.string().min(1, "S3 bucket is required"),
  key: z.string().min(1, "S3 key is required"),
  name: z.string().min(1, "Dataset name is required"),
  hasHeader: z.boolean().default(true),
  autoDetectTypes: z.boolean().default(true),
});

export const transformationPreviewSchema = z.object({
  datasetId: z.number(),
  targetColumn: z.string().min(1, "Target column is required"),
  expression: z.string().min(1, "Expression is required"),
});

export const applyTransformationSchema = transformationPreviewSchema.extend({
  name: z.string().min(1, "Transformation name is required"),
});

export const createPipelineSchema = z.object({
  name: z.string().min(1, "Pipeline name is required"),
  description: z.string().optional(),
  steps: z.array(z.object({
    name: z.string().min(1, "Step name is required"),
    type: z.enum(['import', 'transform', 'export', 'validation', 'notification']),
    config: z.record(z.any()),
    order: z.number(),
    retryCount: z.number().default(0),
    timeoutMinutes: z.number().default(30),
  })),
  schedule: z.object({
    enabled: z.boolean().default(false),
    cronExpression: z.string().optional(),
    timezone: z.string().default('UTC'),
  }).optional(),
});

export const schedulePipelineSchema = z.object({
  cronExpression: z.string().min(1, "Cron expression is required"),
  timezone: z.string().default('UTC'),
  enabled: z.boolean().default(true),
});

export const triggerPipelineSchema = z.object({
  triggerType: z.enum(['manual', 'scheduled', 'webhook', 'file_trigger']),
  parameters: z.record(z.any()).optional(),
});

// Data Quality Report schema
export const dataQualityReports = pgTable("data_quality_reports", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  datasetId: integer("dataset_id").notNull().references(() => datasets.id),
  reportData: jsonb("report_data").notNull(),
  summary: jsonb("summary").notNull(),
  qualityScore: integer("quality_score").notNull(),
  issuesFound: integer("issues_found").notNull(),
  recommendationsCount: integer("recommendations_count").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dataAnnotations = pgTable("data_annotations", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  datasetId: integer("dataset_id").notNull().references(() => datasets.id),
  rowIndex: integer("row_index").notNull(),
  columnName: text("column_name").notNull(),
  cellValue: text("cell_value"),
  annotationType: text("annotation_type", { 
    enum: ['comment', 'flag', 'correction', 'validation', 'note'] 
  }).default('comment').notNull(),
  content: text("content").notNull(),
  status: text("status", { enum: ['active', 'resolved', 'archived'] }).default('active').notNull(),
  priority: text("priority", { enum: ['low', 'medium', 'high', 'critical'] }).default('medium').notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  assignedTo: integer("assigned_to").references(() => users.id),
  resolvedBy: integer("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const annotationComments = pgTable("annotation_comments", {
  id: serial("id").primaryKey(),
  annotationId: integer("annotation_id").notNull().references(() => dataAnnotations.id, { onDelete: 'cascade' }),
  tenantId: integer("tenant_id").notNull().references(() => tenants.id),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  isSystemMessage: boolean("is_system_message").default(false).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const annotationMentions = pgTable("annotation_mentions", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull().references(() => annotationComments.id, { onDelete: 'cascade' }),
  mentionedUserId: integer("mentioned_user_id").notNull().references(() => users.id),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDataQualityReportSchema = createInsertSchema(dataQualityReports);
export const insertDataAnnotationSchema = createInsertSchema(dataAnnotations);
export const insertAnnotationCommentSchema = createInsertSchema(annotationComments);
export const insertAnnotationMentionSchema = createInsertSchema(annotationMentions);

export type DataQualityReport = typeof dataQualityReports.$inferSelect;
export type InsertDataQualityReport = z.infer<typeof insertDataQualityReportSchema>;

export type DataAnnotation = typeof dataAnnotations.$inferSelect;
export type InsertDataAnnotation = z.infer<typeof insertDataAnnotationSchema>;

export type AnnotationComment = typeof annotationComments.$inferSelect;
export type InsertAnnotationComment = z.infer<typeof insertAnnotationCommentSchema>;

export type AnnotationMention = typeof annotationMentions.$inferSelect;
export type InsertAnnotationMention = z.infer<typeof insertAnnotationMentionSchema>;

export const dataQualityRequestSchema = z.object({
  datasetId: z.number(),
  includeDetailed: z.boolean().default(true),
  checkTypes: z.array(z.enum([
    'missing_values',
    'duplicates', 
    'data_types',
    'outliers',
    'patterns',
    'consistency',
    'completeness',
    'validity'
  ])).default([
    'missing_values',
    'duplicates', 
    'data_types',
    'outliers',
    'patterns',
    'consistency',
    'completeness',
    'validity'
  ]),
});

export type S3ImportRequest = z.infer<typeof s3ImportSchema>;
export type TransformationPreviewRequest = z.infer<typeof transformationPreviewSchema>;
export type ApplyTransformationRequest = z.infer<typeof applyTransformationSchema>;
export type CreatePipelineRequest = z.infer<typeof createPipelineSchema>;
export type SchedulePipelineRequest = z.infer<typeof schedulePipelineSchema>;
export type TriggerPipelineRequest = z.infer<typeof triggerPipelineSchema>;
export type DataQualityRequest = z.infer<typeof dataQualityRequestSchema>;
