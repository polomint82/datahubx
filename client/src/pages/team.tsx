import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, Mail, Crown, Edit, Eye, Shield, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TeamMember {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  role: 'admin' | 'editor' | 'viewer';
  isActive: boolean;
  lastActiveAt?: string;
  createdAt: string;
}

interface TeamInvitation {
  id: number;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'expired';
  invitedBy: number;
  createdAt: string;
  expiresAt: string;
}

interface ActiveUser {
  id: number;
  username: string;
  fullName?: string;
  lastActiveAt: string;
}

export default function Team() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const { toast } = useToast();

  // Fetch team members
  const { data: teamMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['/api/team/members'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/team/members');
      return await response.json();
    },
  });

  // Fetch team invitations
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery({
    queryKey: ['/api/team/invitations'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/team/invitations');
      return await response.json();
    },
  });

  // Fetch active users
  const { data: activeUsers = [] } = useQuery({
    queryKey: ['/api/team/active'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/team/active');
      return await response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Invite team member mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const response = await apiRequest('POST', '/api/team/invite', data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation sent",
        description: "Team member invitation has been sent successfully.",
      });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole('editor');
      queryClient.invalidateQueries({ queryKey: ['/api/team/invitations'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send invitation",
        description: error.message || "Could not send team invitation.",
        variant: "destructive",
      });
    },
  });

  // Update member role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async (data: { userId: number; role: string }) => {
      const response = await apiRequest('PATCH', `/api/team/members/${data.userId}/role`, { role: data.role });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Role updated",
        description: "Team member role has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/team/members'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update role",
        description: error.message || "Could not update team member role.",
        variant: "destructive",
      });
    },
  });

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    
    inviteMutation.mutate({
      email: inviteEmail.trim(),
      role: inviteRole,
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Crown className="h-4 w-4" />;
      case 'editor': return <Edit className="h-4 w-4" />;
      case 'viewer': return <Eye className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'editor': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'viewer': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const formatLastActive = (lastActive?: string) => {
    if (!lastActive) return 'Never';
    const date = new Date(lastActive);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const isUserActive = (lastActive?: string) => {
    if (!lastActive) return false;
    const date = new Date(lastActive);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    return diffMinutes < 5;
  };

  return (
    <div className="w-full max-w-none py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Team Management</h1>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an invitation to join your team workspace.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                    <SelectItem value="editor">Editor - Can edit and create</SelectItem>
                    <SelectItem value="admin">Admin - Full access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Active Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Active Now</span>
            </CardTitle>
            <CardDescription>Users active in the last 5 minutes</CardDescription>
          </CardHeader>
          <CardContent>
            {activeUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active users</p>
            ) : (
              <div className="space-y-3">
                {activeUsers.map((user: ActiveUser) => (
                  <div key={user.id} className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {(user.fullName || user.username).substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.fullName || user.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatLastActive(user.lastActiveAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Manage your team and their permissions</CardDescription>
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-3 animate-pulse">
                    <div className="h-10 w-10 bg-gray-300 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-300 rounded w-1/4"></div>
                      <div className="h-3 bg-gray-300 rounded w-1/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {teamMembers.map((member: TeamMember) => (
                  <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar>
                          <AvatarFallback>
                            {(member.fullName || member.username).substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {isUserActive(member.lastActiveAt) && (
                          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{member.fullName || member.username}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Last active: {formatLastActive(member.lastActiveAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getRoleColor(member.role)}>
                        {getRoleIcon(member.role)}
                        <span className="ml-1 capitalize">{member.role}</span>
                      </Badge>
                      <Select
                        value={member.role}
                        onValueChange={(value) => updateRoleMutation.mutate({ userId: member.id, role: value })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mail className="h-5 w-5" />
              <span>Pending Invitations</span>
            </CardTitle>
            <CardDescription>Invitations waiting to be accepted</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations.map((invitation: TeamInvitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Invited {new Date(invitation.createdAt).toLocaleDateString()} • 
                      Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getRoleColor(invitation.role)}>
                      {getRoleIcon(invitation.role)}
                      <span className="ml-1 capitalize">{invitation.role}</span>
                    </Badge>
                    <Badge variant="outline" className="text-yellow-600">
                      {invitation.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}