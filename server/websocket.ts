import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { storage } from './storage';

interface CollaborationMessage {
  type: 'presence' | 'activity' | 'cursor' | 'edit' | 'notification' | 'annotation';
  userId: number;
  tenantId: number;
  data: any;
  timestamp: Date;
}

interface ConnectedUser {
  ws: WebSocket;
  userId: number;
  tenantId: number;
  sessionId: number;
  entityType?: string;
  entityId?: number;
  lastActivity: Date;
}

export class CollaborationServer {
  private wss: WebSocketServer;
  private connections = new Map<string, ConnectedUser>();
  private tenantConnections = new Map<number, Set<string>>();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/collaboration' });
    this.setupWebSocketHandlers();
    this.startHeartbeat();
  }

  private setupWebSocketHandlers() {
    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const userId = parseInt(url.searchParams.get('userId') || '0');
      const tenantId = parseInt(url.searchParams.get('tenantId') || '0');
      const sessionType = url.searchParams.get('sessionType') || 'dataset_view';
      const entityId = url.searchParams.get('entityId') ? parseInt(url.searchParams.get('entityId')!) : undefined;

      if (!userId || !tenantId) {
        ws.close(1008, 'Missing required parameters');
        return;
      }

      const connectionId = `${userId}-${Date.now()}`;
      
      // Create collaboration session
      this.createSession(userId, tenantId, sessionType, entityId).then(sessionId => {
        const connection: ConnectedUser = {
          ws,
          userId,
          tenantId,
          sessionId,
          entityType: sessionType,
          entityId,
          lastActivity: new Date()
        };

        this.connections.set(connectionId, connection);
        
        if (!this.tenantConnections.has(tenantId)) {
          this.tenantConnections.set(tenantId, new Set());
        }
        this.tenantConnections.get(tenantId)!.add(connectionId);

        // Update user activity
        storage.updateUserActivity(userId);

        // Notify tenant about new user presence
        this.broadcastToTenant(tenantId, {
          type: 'presence',
          userId,
          tenantId,
          data: { status: 'joined', entityType: sessionType, entityId },
          timestamp: new Date()
        }, connectionId);

        // Send current active users to new connection
        this.sendActiveUsers(connection);

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString()) as CollaborationMessage;
            this.handleMessage(connectionId, message);
          } catch (error) {
            console.error('Invalid message format:', error);
          }
        });

        ws.on('close', () => {
          this.handleDisconnection(connectionId);
        });

        ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          this.handleDisconnection(connectionId);
        });
      });
    });
  }

  private async createSession(userId: number, tenantId: number, sessionType: string, entityId?: number) {
    const session = await storage.createCollaborationSession({
      userId,
      tenantId,
      datasetId: sessionType === 'dataset_view' ? entityId : undefined,
      transformationId: sessionType === 'transformation_edit' ? entityId : undefined,
      sessionType: sessionType as any,
      metadata: { entityId }
    });
    return session.id;
  }

  private handleMessage(connectionId: string, message: CollaborationMessage) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.lastActivity = new Date();

    switch (message.type) {
      case 'activity':
        this.handleActivityMessage(connection, message);
        break;
      case 'cursor':
        this.handleCursorMessage(connection, message);
        break;
      case 'edit':
        this.handleEditMessage(connection, message);
        break;
      case 'notification':
        this.handleNotificationMessage(connection, message);
        break;
      case 'annotation':
        this.handleAnnotationMessage(connection, message);
        break;
    }
  }

  private async handleActivityMessage(connection: ConnectedUser, message: CollaborationMessage) {
    // Create activity feed entry
    await storage.createActivity({
      userId: connection.userId,
      tenantId: connection.tenantId,
      entityType: message.data.entityType,
      entityId: message.data.entityId,
      action: message.data.action,
      description: message.data.description,
      metadata: message.data.metadata
    });

    // Broadcast to tenant
    this.broadcastToTenant(connection.tenantId, {
      ...message,
      userId: connection.userId,
      tenantId: connection.tenantId,
      timestamp: new Date()
    });
  }

  private handleCursorMessage(connection: ConnectedUser, message: CollaborationMessage) {
    // Broadcast cursor position to other users in same entity
    this.broadcastToEntity(
      connection.tenantId,
      {
        ...message,
        userId: connection.userId,
        timestamp: new Date()
      },
      connection.entityType,
      connection.entityId,
      connection.userId
    );
  }

  private handleEditMessage(connection: ConnectedUser, message: CollaborationMessage) {
    // Broadcast edit operations to collaborators
    this.broadcastToEntity(
      connection.tenantId,
      {
        ...message,
        userId: connection.userId,
        timestamp: new Date()
      },
      connection.entityType,
      connection.entityId,
      connection.userId
    );
  }

  private handleNotificationMessage(connection: ConnectedUser, message: CollaborationMessage) {
    // Send targeted notifications
    if (message.data.targetUserId) {
      this.sendToUser(message.data.targetUserId, connection.tenantId, {
        ...message,
        userId: connection.userId,
        timestamp: new Date()
      });
    } else {
      this.broadcastToTenant(connection.tenantId, {
        ...message,
        userId: connection.userId,
        timestamp: new Date()
      });
    }
  }

  private handleAnnotationMessage(connection: ConnectedUser, message: CollaborationMessage) {
    // Broadcast annotation updates to all users viewing the same dataset
    this.broadcastToEntity(
      connection.tenantId,
      {
        ...message,
        userId: connection.userId,
        timestamp: new Date()
      },
      'dataset_view',
      message.data.datasetId,
      connection.userId
    );

    // Create activity feed entry for annotation
    if (message.data.action === 'created') {
      storage.createActivityFeedItem({
        userId: connection.userId,
        tenantId: connection.tenantId,
        entityType: 'annotation',
        entityId: message.data.annotationId,
        action: 'annotation_created',
        description: `Added annotation to ${message.data.columnName} in row ${message.data.rowIndex + 1}`,
        metadata: {
          datasetId: message.data.datasetId,
          rowIndex: message.data.rowIndex,
          columnName: message.data.columnName,
          annotationType: message.data.annotationType
        }
      });
    }
  }

  private handleDisconnection(connectionId: string) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Update session status
    storage.updateCollaborationSession(connection.sessionId, {
      status: 'disconnected',
      lastActivity: new Date()
    });

    // Remove from connections
    this.connections.delete(connectionId);
    this.tenantConnections.get(connection.tenantId)?.delete(connectionId);

    // Notify tenant about user leaving
    this.broadcastToTenant(connection.tenantId, {
      type: 'presence',
      userId: connection.userId,
      tenantId: connection.tenantId,
      data: { status: 'left', entityType: connection.entityType, entityId: connection.entityId },
      timestamp: new Date()
    }, connectionId);
  }

  private broadcastToTenant(tenantId: number, message: CollaborationMessage, excludeConnectionId?: string) {
    const tenantConnections = this.tenantConnections.get(tenantId);
    if (!tenantConnections) return;

    tenantConnections.forEach(connectionId => {
      if (connectionId === excludeConnectionId) return;
      
      const connection = this.connections.get(connectionId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(message));
      }
    });
  }

  private broadcastToEntity(tenantId: number, message: CollaborationMessage, entityType?: string, entityId?: number, excludeUserId?: number) {
    const tenantConnections = this.tenantConnections.get(tenantId);
    if (!tenantConnections) return;

    tenantConnections.forEach(connectionId => {
      const connection = this.connections.get(connectionId);
      if (
        connection && 
        connection.ws.readyState === WebSocket.OPEN &&
        connection.userId !== excludeUserId &&
        connection.entityType === entityType &&
        connection.entityId === entityId
      ) {
        connection.ws.send(JSON.stringify(message));
      }
    });
  }

  private sendToUser(userId: number, tenantId: number, message: CollaborationMessage) {
    const tenantConnections = this.tenantConnections.get(tenantId);
    if (!tenantConnections) return;

    tenantConnections.forEach(connectionId => {
      const connection = this.connections.get(connectionId);
      if (connection && connection.userId === userId && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(message));
      }
    });
  }

  private async sendActiveUsers(connection: ConnectedUser) {
    try {
      const activeUsers = await storage.getActiveUsers(connection.tenantId);
      const activeSessions = await storage.getActiveSessions(connection.tenantId);
      
      connection.ws.send(JSON.stringify({
        type: 'presence',
        userId: 0,
        tenantId: connection.tenantId,
        data: {
          activeUsers: activeUsers.map(user => ({
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            lastActiveAt: user.lastActiveAt
          })),
          activeSessions: activeSessions.map(session => ({
            userId: session.userId,
            sessionType: session.sessionType,
            datasetId: session.datasetId,
            transformationId: session.transformationId,
            lastActivity: session.lastActivity
          }))
        },
        timestamp: new Date()
      }));
    } catch (error) {
      console.error('Error sending active users:', error);
    }
  }

  private startHeartbeat() {
    setInterval(() => {
      this.connections.forEach((connection, connectionId) => {
        if (connection.ws.readyState === WebSocket.OPEN) {
          // Check for idle connections
          const timeSinceActivity = Date.now() - connection.lastActivity.getTime();
          if (timeSinceActivity > 300000) { // 5 minutes
            storage.updateCollaborationSession(connection.sessionId, {
              status: 'idle',
              lastActivity: new Date()
            });
          }
          
          // Send ping
          connection.ws.ping();
        } else {
          this.handleDisconnection(connectionId);
        }
      });
    }, 30000); // 30 seconds
  }

  getConnectionStats() {
    return {
      totalConnections: this.connections.size,
      tenantConnections: Array.from(this.tenantConnections.entries()).map(([tenantId, connections]) => ({
        tenantId,
        connectionCount: connections.size
      }))
    };
  }
}