import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  MessageCircle, 
  Plus, 
  X, 
  Send, 
  Flag, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Edit,
  Trash2,
  MoreHorizontal
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import type { DataAnnotation, AnnotationComment } from "@shared/schema";

interface CellAnnotationProps {
  datasetId: number;
  rowIndex: number;
  columnName: string;
  cellValue: string;
  children?: React.ReactNode;
}

export function CellAnnotation({ datasetId, rowIndex, columnName, cellValue, children }: CellAnnotationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [newAnnotation, setNewAnnotation] = useState({
    content: "",
    annotationType: "comment" as const,
    priority: "medium" as const
  });

  const queryClient = useQueryClient();

  // Fetch annotations for this specific cell
  const { data: annotations = [], isLoading: annotationsLoading } = useQuery<DataAnnotation[]>({
    queryKey: [`/api/annotations`, { datasetId, rowIndex, columnName }],
    queryFn: async () => {
      const response = await fetch(`/api/annotations?datasetId=${datasetId}&rowIndex=${rowIndex}&columnName=${columnName}`, {
        credentials: "include"
      });
      if (!response.ok) throw new Error('Failed to fetch annotations');
      return response.json();
    },
    enabled: isOpen
  });

  // Fetch comments for active annotations
  const { data: allComments = {} } = useQuery<Record<number, AnnotationComment[]>>({
    queryKey: [`/api/annotation-comments`, { annotations: annotations.map((a: DataAnnotation) => a.id) }],
    queryFn: async () => {
      const commentPromises = annotations.map(async (annotation: DataAnnotation) => {
        const response = await fetch(`/api/annotations/${annotation.id}/comments`, {
          credentials: "include"
        });
        if (!response.ok) throw new Error('Failed to fetch comments');
        const comments = await response.json();
        return {
          annotationId: annotation.id,
          comments
        };
      });
      const results = await Promise.all(commentPromises);
      return results.reduce((acc: Record<number, AnnotationComment[]>, { annotationId, comments }) => {
        acc[annotationId] = comments;
        return acc;
      }, {} as Record<number, AnnotationComment[]>);
    },
    enabled: annotations.length > 0 && isOpen
  });

  // Create annotation mutation
  const createAnnotationMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/annotations', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/annotations`] });
      setNewAnnotation({ content: "", annotationType: "comment", priority: "medium" });
      setShowCommentForm(false);
    }
  });

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async ({ annotationId, content }: { annotationId: number; content: string }) => {
      const response = await apiRequest('POST', `/api/annotations/${annotationId}/comments`, { content });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/annotation-comments`] });
      setNewComment("");
    }
  });

  // Update annotation status mutation
  const updateAnnotationMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      const response = await apiRequest('PUT', `/api/annotations/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/annotations`] });
    }
  });

  const handleCreateAnnotation = () => {
    if (!newAnnotation.content.trim()) return;

    createAnnotationMutation.mutate({
      datasetId,
      rowIndex,
      columnName,
      cellValue,
      ...newAnnotation
    });
  };

  const handleAddComment = (annotationId: number) => {
    if (!newComment.trim()) return;

    createCommentMutation.mutate({
      annotationId,
      content: newComment
    });
  };

  const handleResolveAnnotation = (annotationId: number) => {
    updateAnnotationMutation.mutate({
      id: annotationId,
      updates: { status: 'resolved', resolvedAt: new Date().toISOString() }
    });
  };

  const getAnnotationIcon = (type: string) => {
    switch (type) {
      case 'flag': return <Flag className="h-3 w-3" />;
      case 'correction': return <Edit className="h-3 w-3" />;
      case 'validation': return <CheckCircle className="h-3 w-3" />;
      default: return <MessageCircle className="h-3 w-3" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    }
  };

  const activeAnnotations = (annotations as DataAnnotation[]).filter((a: DataAnnotation) => a.status === 'active');
  const hasAnnotations = activeAnnotations.length > 0;

  return (
    <div className="relative">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative group">
            {children}
            {hasAnnotations && (
              <div className="absolute -top-1 -right-1 flex items-center space-x-1">
                <div className="bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs font-medium">
                  {activeAnnotations.length}
                </div>
              </div>
            )}
            {!hasAnnotations && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute -top-1 -right-1 w-5 h-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(true);
                }}
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start">
          <Card className="border-0 shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <MessageCircle className="h-4 w-4" />
                  <span>Cell Annotations</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </CardTitle>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {columnName} • Row {rowIndex + 1}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cell Value Display */}
              <div className="bg-gray-50 dark:bg-gray-800 p-2 rounded text-xs">
                <div className="font-medium text-gray-600 dark:text-gray-400 mb-1">Current Value:</div>
                <div className="font-mono">{cellValue || '(empty)'}</div>
              </div>

              {/* Existing Annotations */}
              {annotationsLoading ? (
                <div className="text-center py-4 text-sm text-gray-500">Loading annotations...</div>
              ) : activeAnnotations.length > 0 ? (
                <div className="space-y-3">
                  {activeAnnotations.map((annotation: DataAnnotation) => (
                    <div key={annotation.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          {getAnnotationIcon(annotation.annotationType)}
                          <Badge variant="secondary" className={`text-xs ${getPriorityColor(annotation.priority)}`}>
                            {annotation.priority}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(annotation.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                            onClick={() => handleResolveAnnotation(annotation.id)}
                            title="Mark as resolved"
                          >
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="text-sm">{annotation.content}</div>

                      {/* Comments for this annotation */}
                      {allComments[annotation.id] && allComments[annotation.id].length > 0 && (
                        <div className="space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                          {allComments[annotation.id].map((comment: AnnotationComment) => (
                            <div key={comment.id} className="flex items-start space-x-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">U</AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <div className="text-xs text-gray-500 mb-1">
                                  User • {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                                </div>
                                <div className="text-sm">{comment.content}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add comment form */}
                      <div className="flex items-center space-x-2 pt-2">
                        <Input
                          placeholder="Add a comment..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="flex-1 h-8 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddComment(annotation.id);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => handleAddComment(annotation.id)}
                          disabled={!newComment.trim() || createCommentMutation.isPending}
                        >
                          <Send className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-gray-500">
                  No annotations for this cell
                </div>
              )}

              {/* New Annotation Form */}
              {showCommentForm ? (
                <div className="border rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">New Annotation</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setShowCommentForm(false)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Type</Label>
                      <Select value={newAnnotation.annotationType} onValueChange={(value: any) => 
                        setNewAnnotation(prev => ({ ...prev, annotationType: value }))
                      }>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="comment">Comment</SelectItem>
                          <SelectItem value="flag">Flag</SelectItem>
                          <SelectItem value="correction">Correction</SelectItem>
                          <SelectItem value="validation">Validation</SelectItem>
                          <SelectItem value="note">Note</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Priority</Label>
                      <Select value={newAnnotation.priority} onValueChange={(value: any) =>
                        setNewAnnotation(prev => ({ ...prev, priority: value }))
                      }>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Message</Label>
                    <Textarea
                      placeholder="Describe the issue or add your comment..."
                      value={newAnnotation.content}
                      onChange={(e) => setNewAnnotation(prev => ({ ...prev, content: e.target.value }))}
                      className="min-h-[60px] text-xs"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCommentForm(false)}
                      className="h-8 px-3 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleCreateAnnotation}
                      disabled={!newAnnotation.content.trim() || createAnnotationMutation.isPending}
                      className="h-8 px-3 text-xs"
                    >
                      Add Annotation
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCommentForm(true)}
                  className="w-full h-8 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Annotation
                </Button>
              )}
            </CardContent>
          </Card>
        </PopoverContent>
      </Popover>
    </div>
  );
}