import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Activity, Database, FileText, Users, Upload, Zap, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface ActivityItem {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  entityType: 'dataset' | 'transformation' | 'import' | 'user';
  entityId?: number;
  action: string;
  description: string;
  metadata?: any;
  createdAt: string;
}

interface ActivityFeedProps {
  initialLimit?: number;
  showTitle?: boolean;
  compact?: boolean;
  enableInfiniteScroll?: boolean;
  maxHeight?: string;
}

export function ActivityFeed({ 
  initialLimit = 10, 
  showTitle = true, 
  compact = false, 
  enableInfiniteScroll = false,
  maxHeight = "400px"
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Initial data load
  const { data: initialData = [], isLoading } = useQuery({
    queryKey: ['/api/activity/feed', initialLimit],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/activity/feed?limit=${initialLimit}&page=1`);
      return await response.json();
    },
    refetchInterval: 10000,
  });

  // Set initial activities when data loads
  useEffect(() => {
    if (initialData.length > 0) {
      setActivities(initialData);
      setHasMore(initialData.length === initialLimit);
    }
  }, [initialData, initialLimit]);

  // Load more activities
  const loadMoreActivities = useCallback(async () => {
    if (!enableInfiniteScroll || isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    try {
      const response = await apiRequest('GET', `/api/activity/feed?limit=${initialLimit}&page=${page + 1}`);
      const newActivities = await response.json();
      
      if (newActivities.length > 0) {
        setActivities(prev => [...prev, ...newActivities]);
        setPage(prev => prev + 1);
        setHasMore(newActivities.length === initialLimit);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load more activities:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [enableInfiniteScroll, isLoadingMore, hasMore, page, initialLimit]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!enableInfiniteScroll || !loadMoreRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMoreActivities();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMoreActivities, hasMore, isLoadingMore, enableInfiniteScroll]);

  const getActivityIcon = (entityType: string, action: string) => {
    switch (entityType) {
      case 'dataset':
        return <Database className="h-4 w-4" />;
      case 'transformation':
        return <Zap className="h-4 w-4" />;
      case 'import':
        return <Upload className="h-4 w-4" />;
      case 'user':
        return <Users className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getActivityColor = (entityType: string) => {
    switch (entityType) {
      case 'dataset':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'transformation':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'import':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'user':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Card className={compact ? "border-0 shadow-none" : ""}>
        {showTitle && (
          <CardHeader className={compact ? "px-0 pb-3" : ""}>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Recent Activity</span>
            </CardTitle>
            <CardDescription>Live updates from your team</CardDescription>
          </CardHeader>
        )}
        <CardContent className={compact ? "px-0" : ""}>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start space-x-3 animate-pulse">
                <div className="h-8 w-8 bg-gray-300 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={compact ? "border-0 shadow-none" : ""}>
      {showTitle && (
        <CardHeader className={compact ? "px-0 pb-3" : ""}>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Recent Activity</span>
          </CardTitle>
          <CardDescription>Live updates from your team</CardDescription>
        </CardHeader>
      )}
      <CardContent className={compact ? "px-0" : ""}>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No recent activity
          </p>
        ) : (
          <div 
            ref={scrollRef}
            className={enableInfiniteScroll ? "overflow-y-auto pr-2" : ""}
            style={enableInfiniteScroll ? { maxHeight } : {}}
          >
            <div className="space-y-4">
              {activities.map((activity: ActivityItem) => (
                <div key={activity.id} className="flex items-start space-x-3 pb-3 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {(activity.userName || 'User').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {activity.userName || 'System User'}
                      </p>
                      <Badge 
                        className={`${getActivityColor(activity.entityType)} text-xs flex items-center space-x-1`}
                      >
                        {getActivityIcon(activity.entityType, activity.action)}
                        <span className="capitalize">{activity.entityType}</span>
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeAgo(activity.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              
              {/* Infinite scroll trigger */}
              {enableInfiniteScroll && hasMore && (
                <div ref={loadMoreRef} className="py-4 flex justify-center">
                  {isLoadingMore ? (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading more...</span>
                    </div>
                  ) : (
                    <div className="h-4" />
                  )}
                </div>
              )}
              
              {/* End of data indicator */}
              {enableInfiniteScroll && !hasMore && activities.length > initialLimit && (
                <div className="py-4 text-center">
                  <p className="text-xs text-muted-foreground">You've reached the end</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}