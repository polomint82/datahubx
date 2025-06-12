import { 
  users, 
  tenants, 
  datasets, 
  propertyMaps,
  transformations, 
  jobHistory,
  collaborationSessions,
  activityFeed,
  teamInvitations,
  dataPipelines,
  pipelineRuns,
  pipelineSteps,
  stepExecutions,
  automationTriggers,
  type User, 
  type Tenant, 
  type Dataset, 
  type PropertyMap,
  type Transformation, 
  type JobHistory,
  type CollaborationSession,
  type ActivityFeed,
  type TeamInvitation,
  type DataPipeline,
  type PipelineRun,
  type PipelineStep,
  type StepExecution,
  type AutomationTrigger,
  type InsertUser, 
  type InsertTenant, 
  type InsertDataset, 
  type InsertPropertyMap,
  type InsertTransformation, 
  type InsertJobHistory,
  type InsertCollaborationSession,
  type InsertActivityFeed,
  type InsertTeamInvitation,
  type InsertDataPipeline,
  type InsertPipelineRun,
  type InsertPipelineStep,
  type InsertStepExecution,
  type InsertAutomationTrigger,
  dataQualityReports,
  type DataQualityReport,
  type InsertDataQualityReport,
  dataAnnotations,
  annotationComments,
  annotationMentions,
  type DataAnnotation,
  type AnnotationComment,
  type AnnotationMention,
  type InsertDataAnnotation,
  type InsertAnnotationComment,
  type InsertAnnotationMention
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, gte } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Tenants
  getTenant(id: number): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenantAwsCredentials(tenantId: number, credentials: {
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsRegion?: string;
    awsDefaultBucket?: string;
  }): Promise<Tenant | undefined>;
  
  // Datasets
  getDatasets(tenantId: number): Promise<Dataset[]>;
  getDataset(id: number, tenantId: number): Promise<Dataset | undefined>;
  createDataset(dataset: InsertDataset): Promise<Dataset>;
  updateDataset(id: number, tenantId: number, updates: Partial<Dataset>): Promise<Dataset | undefined>;
  deleteDataset(id: number, tenantId: number): Promise<boolean>;
  
  // Property Maps
  getPropertyMaps(tenantId: number, datasetId?: number): Promise<PropertyMap[]>;
  getPropertyMap(id: number, tenantId: number): Promise<PropertyMap | undefined>;
  createPropertyMap(propertyMap: InsertPropertyMap): Promise<PropertyMap>;
  updatePropertyMap(id: number, tenantId: number, updates: Partial<PropertyMap>): Promise<PropertyMap | undefined>;
  deletePropertyMap(id: number, tenantId: number): Promise<boolean>;
  
  // Transformations
  getTransformations(tenantId: number, datasetId?: number, propertyMapId?: number): Promise<Transformation[]>;
  getTransformation(id: number, tenantId: number): Promise<Transformation | undefined>;
  createTransformation(transformation: InsertTransformation): Promise<Transformation>;
  updateTransformation(id: number, tenantId: number, updates: Partial<Transformation>): Promise<Transformation | undefined>;
  deleteTransformation(id: number, tenantId: number): Promise<boolean>;
  
  // Job History
  getJobHistory(tenantId: number, limit?: number): Promise<JobHistory[]>;
  createJobHistory(job: InsertJobHistory): Promise<JobHistory>;
  updateJobHistory(id: number, tenantId: number, updates: Partial<JobHistory>): Promise<JobHistory | undefined>;
  
  // Scheduled Jobs
  getJobs(tenantId: number): Promise<any[]>;
  createJob(job: any): Promise<any>;
  updateJob(id: number, tenantId: number, updates: any): Promise<any>;
  deleteJob(id: number, tenantId: number): Promise<boolean>;
  
  // Stats
  getStats(tenantId: number): Promise<{
    activeDatasets: number;
    transformations: number;
    processingJobs: number;
    totalRecords: number;
  }>;

  // Collaboration
  getActiveUsers(tenantId: number): Promise<User[]>;
  updateUserActivity(userId: number): Promise<void>;
  createCollaborationSession(session: InsertCollaborationSession): Promise<CollaborationSession>;
  updateCollaborationSession(sessionId: number, updates: Partial<CollaborationSession>): Promise<void>;
  getActiveSessions(tenantId: number, entityType?: string, entityId?: number): Promise<CollaborationSession[]>;
  endUserSessions(userId: number): Promise<void>;

  // Activity Feed
  createActivity(activity: InsertActivityFeed): Promise<ActivityFeed>;
  getActivityFeed(tenantId: number, limit?: number): Promise<ActivityFeed[]>;

  // Team Management
  getTeamMembers(tenantId: number): Promise<User[]>;
  inviteTeamMember(invitation: InsertTeamInvitation): Promise<TeamInvitation>;
  getTeamInvitations(tenantId: number): Promise<TeamInvitation[]>;
  acceptInvitation(token: string, userData: { username: string; password: string; fullName?: string }): Promise<User | null>;
  updateUserRole(userId: number, tenantId: number, role: string): Promise<User | undefined>;

  // Pipeline Management
  createPipeline(pipeline: InsertDataPipeline): Promise<DataPipeline>;
  getPipelines(tenantId: number): Promise<DataPipeline[]>;
  getPipeline(id: number, tenantId: number): Promise<DataPipeline | undefined>;
  updatePipeline(id: number, tenantId: number, updates: Partial<DataPipeline>): Promise<DataPipeline | undefined>;
  deletePipeline(id: number, tenantId: number): Promise<boolean>;
  
  // Pipeline Steps
  createPipelineStep(step: InsertPipelineStep): Promise<PipelineStep>;
  getPipelineSteps(pipelineId: number): Promise<PipelineStep[]>;
  updatePipelineStep(id: number, updates: Partial<PipelineStep>): Promise<PipelineStep | undefined>;
  deletePipelineStep(id: number): Promise<boolean>;
  
  // Pipeline Runs
  createPipelineRun(run: InsertPipelineRun): Promise<PipelineRun>;
  getPipelineRuns(pipelineId: number, limit?: number): Promise<PipelineRun[]>;
  getPipelineRun(id: number): Promise<PipelineRun | undefined>;
  updatePipelineRun(id: number, updates: Partial<PipelineRun>): Promise<PipelineRun | undefined>;
  
  // Step Executions
  createStepExecution(execution: InsertStepExecution): Promise<StepExecution>;
  getStepExecutions(runId: number): Promise<StepExecution[]>;
  updateStepExecution(id: number, updates: Partial<StepExecution>): Promise<StepExecution | undefined>;
  
  // Automation Triggers
  createAutomationTrigger(trigger: InsertAutomationTrigger): Promise<AutomationTrigger>;
  getAutomationTriggers(tenantId: number): Promise<AutomationTrigger[]>;
  updateAutomationTrigger(id: number, updates: Partial<AutomationTrigger>): Promise<AutomationTrigger | undefined>;
  deleteAutomationTrigger(id: number): Promise<boolean>;
  
  // Scheduling
  getScheduledPipelines(): Promise<DataPipeline[]>;
  updatePipelineSchedule(pipelineId: number, schedule: any): Promise<DataPipeline | undefined>;

  // Data Quality Reports
  createDataQualityReport(report: InsertDataQualityReport): Promise<DataQualityReport>;
  getDataQualityReports(tenantId: number, datasetId?: number): Promise<DataQualityReport[]>;
  getDataQualityReport(id: number, tenantId: number): Promise<DataQualityReport | undefined>;
  deleteDataQualityReport(id: number, tenantId: number): Promise<boolean>;

  // Data Annotations
  createDataAnnotation(annotation: InsertDataAnnotation): Promise<DataAnnotation>;
  getDataAnnotations(tenantId: number, datasetId: number, rowIndex?: number, columnName?: string): Promise<DataAnnotation[]>;
  getDataAnnotation(id: number, tenantId: number): Promise<DataAnnotation | undefined>;
  updateDataAnnotation(id: number, tenantId: number, updates: Partial<DataAnnotation>): Promise<DataAnnotation | undefined>;
  deleteDataAnnotation(id: number, tenantId: number): Promise<boolean>;
  
  // Annotation Comments
  createAnnotationComment(comment: InsertAnnotationComment): Promise<AnnotationComment>;
  getAnnotationComments(annotationId: number, tenantId: number): Promise<AnnotationComment[]>;
  updateAnnotationComment(id: number, tenantId: number, updates: Partial<AnnotationComment>): Promise<AnnotationComment | undefined>;
  deleteAnnotationComment(id: number, tenantId: number): Promise<boolean>;
  
  // Annotation Mentions
  createAnnotationMention(mention: InsertAnnotationMention): Promise<AnnotationMention>;
  getAnnotationMentions(userId: number): Promise<AnnotationMention[]>;
  markMentionAsRead(id: number, userId: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  constructor() {
    // Initialize with default tenant and user
    this.initializeDefaults();
  }

  private async initializeDefaults() {
    try {
      // Check if default tenant exists
      const existingTenant = await db.select().from(tenants).where(eq(tenants.slug, "acme-corp")).limit(1);
      
      if (existingTenant.length === 0) {
        // Create default tenant
        const [tenant] = await db.insert(tenants).values({
          name: "Acme Corp",
          slug: "acme-corp"
        }).returning();

        // Create default user
        await db.insert(users).values({
          username: "admin",
          password: "password",
          email: "admin@acme.com",
          tenantId: tenant.id
        });
      }
    } catch (error) {
      console.log("Database initialization skipped - tables may not exist yet");
    }
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Tenants
  async getTenant(id: number): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || undefined;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return tenant || undefined;
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const [tenant] = await db
      .insert(tenants)
      .values(insertTenant)
      .returning();
    return tenant;
  }

  async updateTenantAwsCredentials(tenantId: number, credentials: {
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsRegion?: string;
    awsDefaultBucket?: string;
  }): Promise<Tenant | undefined> {
    const [tenant] = await db
      .update(tenants)
      .set(credentials)
      .where(eq(tenants.id, tenantId))
      .returning();
    return tenant;
  }

  // Datasets
  async getDatasets(tenantId: number): Promise<Dataset[]> {
    return await db.select().from(datasets).where(eq(datasets.tenantId, tenantId));
  }

  async getDataset(id: number, tenantId: number): Promise<Dataset | undefined> {
    const [dataset] = await db.select().from(datasets).where(eq(datasets.id, id));
    return dataset?.tenantId === tenantId ? dataset : undefined;
  }

  async createDataset(insertDataset: InsertDataset): Promise<Dataset> {
    const [dataset] = await db
      .insert(datasets)
      .values([insertDataset])
      .returning();
    return dataset;
  }

  async updateDataset(id: number, tenantId: number, updates: Partial<Dataset>): Promise<Dataset | undefined> {
    const [dataset] = await db
      .update(datasets)
      .set(updates)
      .where(eq(datasets.id, id))
      .returning();
    
    return dataset?.tenantId === tenantId ? dataset : undefined;
  }

  async deleteDataset(id: number, tenantId: number): Promise<boolean> {
    const result = await db
      .delete(datasets)
      .where(eq(datasets.id, id))
      .returning();
    
    return result.length > 0 && result[0].tenantId === tenantId;
  }

  // Property Maps
  async getPropertyMaps(tenantId: number, datasetId?: number): Promise<PropertyMap[]> {
    if (datasetId) {
      return await db
        .select()
        .from(propertyMaps)
        .where(and(eq(propertyMaps.tenantId, tenantId), eq(propertyMaps.datasetId, datasetId)))
        .orderBy(desc(propertyMaps.createdAt));
    }
    
    return await db
      .select()
      .from(propertyMaps)
      .where(eq(propertyMaps.tenantId, tenantId))
      .orderBy(desc(propertyMaps.createdAt));
  }

  async getPropertyMap(id: number, tenantId: number): Promise<PropertyMap | undefined> {
    const [propertyMap] = await db
      .select()
      .from(propertyMaps)
      .where(and(eq(propertyMaps.id, id), eq(propertyMaps.tenantId, tenantId)));
    return propertyMap;
  }

  async createPropertyMap(insertPropertyMap: InsertPropertyMap): Promise<PropertyMap> {
    const [propertyMap] = await db
      .insert(propertyMaps)
      .values(insertPropertyMap)
      .returning();
    return propertyMap;
  }

  async updatePropertyMap(id: number, tenantId: number, updates: Partial<PropertyMap>): Promise<PropertyMap | undefined> {
    const [propertyMap] = await db
      .update(propertyMaps)
      .set({...updates, updatedAt: new Date()})
      .where(and(eq(propertyMaps.id, id), eq(propertyMaps.tenantId, tenantId)))
      .returning();
    return propertyMap;
  }

  async deletePropertyMap(id: number, tenantId: number): Promise<boolean> {
    const result = await db
      .delete(propertyMaps)
      .where(and(eq(propertyMaps.id, id), eq(propertyMaps.tenantId, tenantId)));
    
    return (result.rowCount || 0) > 0;
  }

  // Transformations
  async getTransformations(tenantId: number, datasetId?: number, propertyMapId?: number): Promise<Transformation[]> {
    let whereConditions = [eq(transformations.tenantId, tenantId)];
    
    if (datasetId) {
      whereConditions.push(eq(transformations.datasetId, datasetId));
    }
    
    if (propertyMapId) {
      whereConditions.push(eq(transformations.propertyMapId, propertyMapId));
    }
    
    return await db
      .select()
      .from(transformations)
      .where(and(...whereConditions))
      .orderBy(transformations.sequenceNumber);
  }

  async getTransformation(id: number, tenantId: number): Promise<Transformation | undefined> {
    const [transformation] = await db.select().from(transformations).where(eq(transformations.id, id));
    return transformation?.tenantId === tenantId ? transformation : undefined;
  }

  async createTransformation(insertTransformation: InsertTransformation): Promise<Transformation> {
    const [transformation] = await db
      .insert(transformations)
      .values([insertTransformation])
      .returning();
    return transformation;
  }

  async updateTransformation(id: number, tenantId: number, updates: Partial<Transformation>): Promise<Transformation | undefined> {
    const [transformation] = await db
      .update(transformations)
      .set(updates)
      .where(eq(transformations.id, id))
      .returning();
    
    return transformation?.tenantId === tenantId ? transformation : undefined;
  }

  async deleteTransformation(id: number, tenantId: number): Promise<boolean> {
    const result = await db
      .delete(transformations)
      .where(eq(transformations.id, id))
      .returning();
    
    return result.length > 0 && result[0].tenantId === tenantId;
  }

  // Job History
  async getJobHistory(tenantId: number, limit = 10): Promise<JobHistory[]> {
    return await db
      .select()
      .from(jobHistory)
      .where(eq(jobHistory.tenantId, tenantId))
      .orderBy(desc(jobHistory.createdAt))
      .limit(limit);
  }

  async createJobHistory(insertJob: InsertJobHistory): Promise<JobHistory> {
    const [job] = await db
      .insert(jobHistory)
      .values({
        ...insertJob,
        datasetId: insertJob.datasetId || null,
        transformationId: insertJob.transformationId || null,
      })
      .returning();
    return job;
  }

  async updateJobHistory(id: number, tenantId: number, updates: Partial<JobHistory>): Promise<JobHistory | undefined> {
    const [job] = await db
      .update(jobHistory)
      .set(updates)
      .where(eq(jobHistory.id, id))
      .returning();
    
    return job?.tenantId === tenantId ? job : undefined;
  }

  // Stats
  async getStats(tenantId: number): Promise<{
    activeDatasets: number;
    transformations: number;
    processingJobs: number;
    totalRecords: number;
  }> {
    const datasetsResult = await this.getDatasets(tenantId);
    const transformationsResult = await this.getTransformations(tenantId);
    const jobs = await this.getJobHistory(tenantId, 100);
    
    const processingJobs = jobs.filter(job => job.status === "processing").length;
    const totalRecords = datasetsResult.reduce((sum, dataset) => sum + dataset.totalRows, 0);
    
    return {
      activeDatasets: datasetsResult.length,
      transformations: transformationsResult.length,
      processingJobs,
      totalRecords,
    };
  }

  // Collaboration methods
  async getActiveUsers(tenantId: number): Promise<User[]> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return await db.select().from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.isActive, true),
        gte(users.lastActiveAt, fiveMinutesAgo)
      ));
  }

  async updateUserActivity(userId: number): Promise<void> {
    await db.update(users)
      .set({ lastActiveAt: new Date() })
      .where(eq(users.id, userId));
  }

  async createCollaborationSession(session: InsertCollaborationSession): Promise<CollaborationSession> {
    const [result] = await db
      .insert(collaborationSessions)
      .values([session])
      .returning();
    return result;
  }

  async updateCollaborationSession(sessionId: number, updates: Partial<CollaborationSession>): Promise<void> {
    await db.update(collaborationSessions)
      .set({ ...updates, lastActivity: new Date() })
      .where(eq(collaborationSessions.id, sessionId));
  }

  async getActiveSessions(tenantId: number, entityType?: string, entityId?: number): Promise<CollaborationSession[]> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    let query = db.select().from(collaborationSessions)
      .where(and(
        eq(collaborationSessions.tenantId, tenantId),
        eq(collaborationSessions.status, 'active'),
        gte(collaborationSessions.lastActivity, fiveMinutesAgo)
      ));

    return await query;
  }

  async endUserSessions(userId: number): Promise<void> {
    await db.update(collaborationSessions)
      .set({ status: 'disconnected' })
      .where(eq(collaborationSessions.userId, userId));
  }

  // Activity Feed methods
  async createActivity(activity: InsertActivityFeed): Promise<ActivityFeed> {
    const [result] = await db
      .insert(activityFeed)
      .values([activity])
      .returning();
    return result;
  }

  async getActivityFeed(tenantId: number, limit = 50): Promise<ActivityFeed[]> {
    return await db.select({
      id: activityFeed.id,
      userId: activityFeed.userId,
      tenantId: activityFeed.tenantId,
      entityType: activityFeed.entityType,
      entityId: activityFeed.entityId,
      action: activityFeed.action,
      description: activityFeed.description,
      metadata: activityFeed.metadata,
      createdAt: activityFeed.createdAt,
      userName: users.username,
      userEmail: users.email
    })
      .from(activityFeed)
      .leftJoin(users, eq(activityFeed.userId, users.id))
      .where(eq(activityFeed.tenantId, tenantId))
      .orderBy(desc(activityFeed.createdAt))
      .limit(limit);
  }

  // Team Management methods
  async getTeamMembers(tenantId: number): Promise<User[]> {
    return await db.select().from(users)
      .where(eq(users.tenantId, tenantId));
  }

  async inviteTeamMember(invitation: InsertTeamInvitation): Promise<TeamInvitation> {
    const [result] = await db
      .insert(teamInvitations)
      .values([invitation])
      .returning();
    return result;
  }

  async getTeamInvitations(tenantId: number): Promise<TeamInvitation[]> {
    return await db.select().from(teamInvitations)
      .where(eq(teamInvitations.tenantId, tenantId))
      .orderBy(desc(teamInvitations.createdAt));
  }

  async acceptInvitation(token: string, userData: { username: string; password: string; fullName?: string }): Promise<User | null> {
    const [invitation] = await db.select().from(teamInvitations)
      .where(and(
        eq(teamInvitations.token, token),
        eq(teamInvitations.status, 'pending')
      ));

    if (!invitation || invitation.expiresAt < new Date()) {
      return null;
    }

    // Create user
    const [user] = await db
      .insert(users)
      .values([{
        username: userData.username,
        password: userData.password,
        email: invitation.email,
        fullName: userData.fullName,
        tenantId: invitation.tenantId,
        role: invitation.role,
      }])
      .returning();

    // Mark invitation as accepted
    await db.update(teamInvitations)
      .set({ status: 'accepted' })
      .where(eq(teamInvitations.id, invitation.id));

    return user;
  }

  async updateUserRole(userId: number, tenantId: number, role: string): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ role })
      .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)))
      .returning();
    return user;
  }

  // Pipeline Management methods
  async createPipeline(pipeline: InsertDataPipeline): Promise<DataPipeline> {
    const [result] = await db
      .insert(dataPipelines)
      .values([pipeline])
      .returning();
    return result;
  }

  async getPipelines(tenantId: number): Promise<DataPipeline[]> {
    return await db.select().from(dataPipelines)
      .where(eq(dataPipelines.tenantId, tenantId))
      .orderBy(desc(dataPipelines.createdAt));
  }

  async getPipeline(id: number, tenantId: number): Promise<DataPipeline | undefined> {
    const [pipeline] = await db.select().from(dataPipelines)
      .where(and(eq(dataPipelines.id, id), eq(dataPipelines.tenantId, tenantId)));
    return pipeline;
  }

  async updatePipeline(id: number, tenantId: number, updates: Partial<DataPipeline>): Promise<DataPipeline | undefined> {
    const [pipeline] = await db.update(dataPipelines)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(dataPipelines.id, id), eq(dataPipelines.tenantId, tenantId)))
      .returning();
    return pipeline;
  }

  async deletePipeline(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(dataPipelines)
      .where(and(eq(dataPipelines.id, id), eq(dataPipelines.tenantId, tenantId)));
    return result.rowCount > 0;
  }

  // Pipeline Steps methods
  async createPipelineStep(step: InsertPipelineStep): Promise<PipelineStep> {
    const [result] = await db
      .insert(pipelineSteps)
      .values([step])
      .returning();
    return result;
  }

  async getPipelineSteps(pipelineId: number): Promise<PipelineStep[]> {
    return await db.select().from(pipelineSteps)
      .where(eq(pipelineSteps.pipelineId, pipelineId))
      .orderBy(pipelineSteps.order);
  }

  async updatePipelineStep(id: number, updates: Partial<PipelineStep>): Promise<PipelineStep | undefined> {
    const [step] = await db.update(pipelineSteps)
      .set(updates)
      .where(eq(pipelineSteps.id, id))
      .returning();
    return step;
  }

  async deletePipelineStep(id: number): Promise<boolean> {
    const result = await db.delete(pipelineSteps)
      .where(eq(pipelineSteps.id, id));
    return result.rowCount > 0;
  }

  // Pipeline Runs methods
  async createPipelineRun(run: InsertPipelineRun): Promise<PipelineRun> {
    const [result] = await db
      .insert(pipelineRuns)
      .values([run])
      .returning();
    return result;
  }

  async getPipelineRuns(pipelineId: number, limit = 50): Promise<PipelineRun[]> {
    return await db.select().from(pipelineRuns)
      .where(eq(pipelineRuns.pipelineId, pipelineId))
      .orderBy(desc(pipelineRuns.startedAt))
      .limit(limit);
  }

  async getPipelineRun(id: number): Promise<PipelineRun | undefined> {
    const [run] = await db.select().from(pipelineRuns)
      .where(eq(pipelineRuns.id, id));
    return run;
  }

  async updatePipelineRun(id: number, updates: Partial<PipelineRun>): Promise<PipelineRun | undefined> {
    const [run] = await db.update(pipelineRuns)
      .set(updates)
      .where(eq(pipelineRuns.id, id))
      .returning();
    return run;
  }

  // Step Executions methods
  async createStepExecution(execution: InsertStepExecution): Promise<StepExecution> {
    const [result] = await db
      .insert(stepExecutions)
      .values([execution])
      .returning();
    return result;
  }

  async getStepExecutions(runId: number): Promise<StepExecution[]> {
    return await db.select().from(stepExecutions)
      .where(eq(stepExecutions.runId, runId))
      .orderBy(stepExecutions.startedAt);
  }

  async updateStepExecution(id: number, updates: Partial<StepExecution>): Promise<StepExecution | undefined> {
    const [execution] = await db.update(stepExecutions)
      .set(updates)
      .where(eq(stepExecutions.id, id))
      .returning();
    return execution;
  }

  // Automation Triggers methods
  async createAutomationTrigger(trigger: InsertAutomationTrigger): Promise<AutomationTrigger> {
    const [result] = await db
      .insert(automationTriggers)
      .values([trigger])
      .returning();
    return result;
  }

  async getAutomationTriggers(tenantId: number): Promise<AutomationTrigger[]> {
    return await db.select().from(automationTriggers)
      .where(eq(automationTriggers.tenantId, tenantId))
      .orderBy(desc(automationTriggers.createdAt));
  }

  async updateAutomationTrigger(id: number, updates: Partial<AutomationTrigger>): Promise<AutomationTrigger | undefined> {
    const [trigger] = await db.update(automationTriggers)
      .set(updates)
      .where(eq(automationTriggers.id, id))
      .returning();
    return trigger;
  }

  async deleteAutomationTrigger(id: number): Promise<boolean> {
    const result = await db.delete(automationTriggers)
      .where(eq(automationTriggers.id, id));
    return result.rowCount > 0;
  }

  // Scheduling methods
  async getScheduledPipelines(): Promise<DataPipeline[]> {
    return await db.select().from(dataPipelines)
      .where(eq(dataPipelines.status, 'active'))
      .orderBy(dataPipelines.createdAt);
  }

  async updatePipelineSchedule(pipelineId: number, schedule: any): Promise<DataPipeline | undefined> {
    const [pipeline] = await db.update(dataPipelines)
      .set({ schedule, updatedAt: new Date() })
      .where(eq(dataPipelines.id, pipelineId))
      .returning();
    return pipeline;
  }

  // Data Quality Reports
  async createDataQualityReport(report: InsertDataQualityReport): Promise<DataQualityReport> {
    const [newReport] = await db.insert(dataQualityReports).values(report).returning();
    return newReport;
  }

  async getDataQualityReports(tenantId: number, datasetId?: number): Promise<DataQualityReport[]> {
    const conditions = [eq(dataQualityReports.tenantId, tenantId)];
    if (datasetId) {
      conditions.push(eq(dataQualityReports.datasetId, datasetId));
    }
    
    return await db.select()
      .from(dataQualityReports)
      .where(and(...conditions))
      .orderBy(desc(dataQualityReports.createdAt));
  }

  async getDataQualityReport(id: number, tenantId: number): Promise<DataQualityReport | undefined> {
    const [report] = await db.select()
      .from(dataQualityReports)
      .where(and(
        eq(dataQualityReports.id, id),
        eq(dataQualityReports.tenantId, tenantId)
      ));
    return report;
  }

  async deleteDataQualityReport(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(dataQualityReports)
      .where(and(
        eq(dataQualityReports.id, id),
        eq(dataQualityReports.tenantId, tenantId)
      ));
    return result.rowCount > 0;
  }

  // Data Annotations
  async createDataAnnotation(annotation: InsertDataAnnotation): Promise<DataAnnotation> {
    const [newAnnotation] = await db.insert(dataAnnotations).values(annotation).returning();
    return newAnnotation;
  }

  async getDataAnnotations(tenantId: number, datasetId: number, rowIndex?: number, columnName?: string): Promise<DataAnnotation[]> {
    const conditions = [
      eq(dataAnnotations.tenantId, tenantId),
      eq(dataAnnotations.datasetId, datasetId)
    ];
    
    if (rowIndex !== undefined) {
      conditions.push(eq(dataAnnotations.rowIndex, rowIndex));
    }
    
    if (columnName) {
      conditions.push(eq(dataAnnotations.columnName, columnName));
    }
    
    return await db.select()
      .from(dataAnnotations)
      .where(and(...conditions))
      .orderBy(desc(dataAnnotations.createdAt));
  }

  async getDataAnnotation(id: number, tenantId: number): Promise<DataAnnotation | undefined> {
    const [annotation] = await db.select()
      .from(dataAnnotations)
      .where(and(
        eq(dataAnnotations.id, id),
        eq(dataAnnotations.tenantId, tenantId)
      ));
    return annotation;
  }

  async updateDataAnnotation(id: number, tenantId: number, updates: Partial<DataAnnotation>): Promise<DataAnnotation | undefined> {
    const [updated] = await db.update(dataAnnotations)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(dataAnnotations.id, id),
        eq(dataAnnotations.tenantId, tenantId)
      ))
      .returning();
    return updated;
  }

  async deleteDataAnnotation(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(dataAnnotations)
      .where(and(
        eq(dataAnnotations.id, id),
        eq(dataAnnotations.tenantId, tenantId)
      ));
    return result.rowCount > 0;
  }

  // Annotation Comments
  async createAnnotationComment(comment: InsertAnnotationComment): Promise<AnnotationComment> {
    const [newComment] = await db.insert(annotationComments).values(comment).returning();
    return newComment;
  }

  async getAnnotationComments(annotationId: number, tenantId: number): Promise<AnnotationComment[]> {
    return await db.select()
      .from(annotationComments)
      .where(and(
        eq(annotationComments.annotationId, annotationId),
        eq(annotationComments.tenantId, tenantId)
      ))
      .orderBy(annotationComments.createdAt);
  }

  async updateAnnotationComment(id: number, tenantId: number, updates: Partial<AnnotationComment>): Promise<AnnotationComment | undefined> {
    const [updated] = await db.update(annotationComments)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(annotationComments.id, id),
        eq(annotationComments.tenantId, tenantId)
      ))
      .returning();
    return updated;
  }

  async deleteAnnotationComment(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(annotationComments)
      .where(and(
        eq(annotationComments.id, id),
        eq(annotationComments.tenantId, tenantId)
      ));
    return result.rowCount > 0;
  }

  // Annotation Mentions
  async createAnnotationMention(mention: InsertAnnotationMention): Promise<AnnotationMention> {
    const [newMention] = await db.insert(annotationMentions).values(mention).returning();
    return newMention;
  }

  async getAnnotationMentions(userId: number): Promise<AnnotationMention[]> {
    return await db.select()
      .from(annotationMentions)
      .where(eq(annotationMentions.mentionedUserId, userId))
      .orderBy(desc(annotationMentions.createdAt));
  }

  async markMentionAsRead(id: number, userId: number): Promise<boolean> {
    const result = await db.update(annotationMentions)
      .set({ isRead: true })
      .where(and(
        eq(annotationMentions.id, id),
        eq(annotationMentions.mentionedUserId, userId)
      ));
    return result.rowCount > 0;
  }

  // Scheduled Jobs Implementation
  async getJobs(tenantId: number): Promise<any[]> {
    // For now, return the existing job history as scheduled jobs
    // In a real implementation, you'd have a separate jobs table
    return await db.select()
      .from(jobHistory)
      .where(eq(jobHistory.tenantId, tenantId))
      .orderBy(desc(jobHistory.createdAt));
  }

  async createJob(job: any): Promise<any> {
    // Create a job entry in job history with scheduled status
    const [newJob] = await db.insert(jobHistory).values({
      tenantId: job.tenantId,
      type: job.type,
      status: 'scheduled',
      details: JSON.stringify({
        name: job.name,
        description: job.description,
        schedule: job.schedule,
        config: job.config
      }),
      createdBy: job.createdBy
    }).returning();
    
    return {
      ...newJob,
      name: job.name,
      description: job.description,
      schedule: job.schedule,
      config: job.config
    };
  }

  async updateJob(id: number, tenantId: number, updates: any): Promise<any> {
    // Get existing job
    const [existingJob] = await db.select()
      .from(jobHistory)
      .where(and(eq(jobHistory.id, id), eq(jobHistory.tenantId, tenantId)))
      .limit(1);
    
    if (!existingJob) return undefined;
    
    let existingDetails = {};
    
    // Safely parse existing job details JSON
    try {
      existingDetails = existingJob.details ? JSON.parse(existingJob.details) : {};
    } catch (error) {
      console.warn('Failed to parse existing job details JSON, using empty object:', error);
      existingDetails = {};
    }
    
    const newDetails = {
      ...existingDetails,
      ...updates
    };
    
    const [updatedJob] = await db.update(jobHistory)
      .set({
        status: updates.status || existingJob.status,
        details: JSON.stringify(newDetails)
      })
      .where(and(eq(jobHistory.id, id), eq(jobHistory.tenantId, tenantId)))
      .returning();
    
    return {
      ...updatedJob,
      ...newDetails
    };
  }

  async deleteJob(id: number, tenantId: number): Promise<boolean> {
    const result = await db.delete(jobHistory)
      .where(and(eq(jobHistory.id, id), eq(jobHistory.tenantId, tenantId)));
    return result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
