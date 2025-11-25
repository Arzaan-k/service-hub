import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Edit, Key, Mail, User, Users, Plus, Send } from 'lucide-react';
import { GlassCard } from '@/components/ui/animated-card';
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

interface User {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  whatsappVerified: boolean;
}

export default function AdminUserManagement() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isCredentialsDialogOpen, setIsCredentialsDialogOpen] = useState(false);
  const [filterRole, setFilterRole] = useState('all');
  const [credentialsForm, setCredentialsForm] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    role: 'client'
  });

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  const updateCredentialsMutation = useMutation({
    mutationFn: async (data: { userId: string; email?: string; password?: string }) => {
      const response = await fetch(`/api/admin/users/${data.userId}/credentials`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email || undefined,
          password: data.password || undefined
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update credentials');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User credentials updated successfully');
      setIsCredentialsDialogOpen(false);
      setCredentialsForm({ email: '', password: '', confirmPassword: '' });
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; phoneNumber: string; role: string }) => {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User created and credentials sent via email');
      setIsCreateUserDialogOpen(false);
      setCreateUserForm({ name: '', email: '', phoneNumber: '', role: 'client' });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const sendCredentialsMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}/send-credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send credentials');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('New credentials sent via email');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleUpdateCredentials = (user: User) => {
    setSelectedUser(user);
    setCredentialsForm({
      email: user.email || '',
      password: '',
      confirmPassword: ''
    });
    setIsCredentialsDialogOpen(true);
  };

  const handleSubmitCredentials = () => {
    if (!selectedUser) return;

    if (credentialsForm.password && credentialsForm.password !== credentialsForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!credentialsForm.email && !credentialsForm.password) {
      toast.error('Please provide either email or password');
      return;
    }

    updateCredentialsMutation.mutate({
      userId: selectedUser.id,
      email: credentialsForm.email !== selectedUser.email ? credentialsForm.email : undefined,
      password: credentialsForm.password || undefined,
    });
  };

  const handleCreateUser = () => {
    if (!createUserForm.name || !createUserForm.email || !createUserForm.phoneNumber) {
      toast.error('Please fill in all required fields');
      return;
    }
    createUserMutation.mutate(createUserForm);
  };

  const handleSendCredentials = (userId: string) => {
    sendCredentialsMutation.mutate(userId);
  };

  const filteredUsers = users?.filter((user: User) => {
    if (filterRole === 'all') return true;
    return user.role === filterRole;
  }) || [];

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin': return 'destructive';
      case 'admin': return 'default';
      case 'coordinator': return 'secondary';
      case 'technician': return 'outline';
      case 'client': return 'outline';
      default: return 'outline';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'text-red-600';
      case 'admin': return 'text-blue-600';
      case 'coordinator': return 'text-purple-600';
      case 'technician': return 'text-green-600';
      case 'client': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-2">Failed to load users</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="User Management" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-xl">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">User Management</h1>
                <p className="text-muted-foreground">Manage user accounts and credentials</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setIsCreateUserDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create User
              </Button>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-40 bg-black/20 border-white/10">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="coordinator">Coordinator</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map((user: User) => (
              <GlassCard key={user.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-500/10 rounded-lg">
                      <User className="h-4 w-4 text-gray-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{user.name}</h3>
                      <p className="text-sm text-muted-foreground">{user.phoneNumber}</p>
                    </div>
                  </div>
                  <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                    {user.role.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{user.email || 'No email set'}</span>
                    {user.emailVerified && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                        Verified
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm text-muted-foreground">
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleUpdateCredentials(user)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Manage
                  </Button>
                  <Button
                    onClick={() => handleSendCredentials(user.id)}
                    variant="outline"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white border-green-600"
                    size="sm"
                    disabled={sendCredentialsMutation.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Login
                  </Button>
                </div>
              </GlassCard>
            ))}
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No users found matching the selected filter</p>
            </div>
          )}

          <Dialog open={isCredentialsDialogOpen} onOpenChange={setIsCredentialsDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Update User Credentials</DialogTitle>
                <DialogDescription>
                  Update email and/or password for {selectedUser?.name}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={credentialsForm.email}
                    onChange={(e) => setCredentialsForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter new email address"
                    className="bg-black/20 border-white/10"
                  />
                </div>

                <div>
                  <Label htmlFor="password">New Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={credentialsForm.password}
                    onChange={(e) => setCredentialsForm(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter new password"
                    className="bg-black/20 border-white/10"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={credentialsForm.confirmPassword}
                    onChange={(e) => setCredentialsForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Confirm new password"
                    className="bg-black/20 border-white/10"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setIsCredentialsDialogOpen(false)}
                  className="bg-white/5 border-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitCredentials}
                  disabled={updateCredentialsMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {updateCredentialsMutation.isPending ? 'Updating...' : 'Update Credentials'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateUserDialogOpen} onOpenChange={setIsCreateUserDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Create a new user account with auto-generated credentials that will be sent via email.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={createUserForm.name}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter full name"
                    className="bg-black/20 border-white/10"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={createUserForm.email}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                    className="bg-black/20 border-white/10"
                  />
                </div>

                <div>
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    value={createUserForm.phoneNumber}
                    onChange={(e) => setCreateUserForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    placeholder="Enter phone number"
                    className="bg-black/20 border-white/10"
                  />
                </div>

                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={createUserForm.role} onValueChange={(value) => setCreateUserForm(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger className="bg-black/20 border-white/10">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="coordinator">Coordinator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateUserDialogOpen(false)}
                  className="bg-white/5 border-white/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={createUserMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {createUserMutation.isPending ? 'Creating...' : 'Create User & Send Credentials'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
