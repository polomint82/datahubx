import { useState, useEffect, useRef, useCallback } from 'react';

interface CollaborationMessage {
  type: 'presence' | 'activity' | 'cursor' | 'edit' | 'notification';
  userId: number;
  tenantId: number;
  data: any;
  timestamp: Date;
}

interface ActiveUser {
  id: number;
  username: string;
  fullName?: string;
  lastActiveAt: Date;
}

interface ActiveSession {
  userId: number;
  sessionType: string;
  datasetId?: number;
  transformationId?: number;
  lastActivity: Date;
}

interface CollaborationState {
  isConnected: boolean;
  activeUsers: ActiveUser[];
  activeSessions: ActiveSession[];
  recentActivity: CollaborationMessage[];
  notifications: CollaborationMessage[];
}

export function useCollaboration(
  userId: number,
  tenantId: number,
  sessionType: string = 'dataset_view',
  entityId?: number
) {
  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    activeUsers: [],
    activeSessions: [],
    recentActivity: [],
    notifications: []
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/collaboration?userId=${userId}&tenantId=${tenantId}&sessionType=${sessionType}${entityId ? `&entityId=${entityId}` : ''}`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        setState(prev => ({ ...prev, isConnected: true }));
        reconnectAttempts.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: CollaborationMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          console.error('Failed to parse collaboration message:', error);
        }
      };

      wsRef.current.onclose = () => {
        setState(prev => ({ ...prev, isConnected: false }));
        attemptReconnect();
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      attemptReconnect();
    }
  }, [userId, tenantId, sessionType, entityId]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttempts.current >= 5) return;

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttempts.current++;
      connect();
    }, delay);
  }, [connect]);

  const handleMessage = useCallback((message: CollaborationMessage) => {
    switch (message.type) {
      case 'presence':
        if (message.data.activeUsers && message.data.activeSessions) {
          setState(prev => ({
            ...prev,
            activeUsers: message.data.activeUsers,
            activeSessions: message.data.activeSessions
          }));
        } else {
          setState(prev => ({
            ...prev,
            recentActivity: [message, ...prev.recentActivity.slice(0, 49)]
          }));
        }
        break;
      
      case 'activity':
        setState(prev => ({
          ...prev,
          recentActivity: [message, ...prev.recentActivity.slice(0, 49)]
        }));
        break;
      
      case 'notification':
        setState(prev => ({
          ...prev,
          notifications: [message, ...prev.notifications.slice(0, 9)]
        }));
        break;
    }
  }, []);

  const sendMessage = useCallback((type: CollaborationMessage['type'], data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: CollaborationMessage = {
        type,
        userId,
        tenantId,
        data,
        timestamp: new Date()
      };
      wsRef.current.send(JSON.stringify(message));
    }
  }, [userId, tenantId]);

  const sendActivity = useCallback((action: string, description: string, entityType: string, entityId?: number, metadata?: any) => {
    sendMessage('activity', {
      action,
      description,
      entityType,
      entityId,
      metadata
    });
  }, [sendMessage]);

  const sendNotification = useCallback((message: string, targetUserId?: number) => {
    sendMessage('notification', {
      message,
      targetUserId
    });
  }, [sendMessage]);

  const sendCursor = useCallback((position: { x: number; y: number; element?: string }) => {
    sendMessage('cursor', { position });
  }, [sendMessage]);

  const sendEdit = useCallback((operation: any) => {
    sendMessage('edit', { operation });
  }, [sendMessage]);

  const clearNotifications = useCallback(() => {
    setState(prev => ({ ...prev, notifications: [] }));
  }, []);

  useEffect(() => {
    if (userId && tenantId) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, userId, tenantId]);

  return {
    ...state,
    sendActivity,
    sendNotification,
    sendCursor,
    sendEdit,
    clearNotifications,
    reconnect: connect
  };
}