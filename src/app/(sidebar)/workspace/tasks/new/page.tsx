'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Plus } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  color?: string;
}

export default function NewTaskPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    projectId: '',
    status: 'pending',
    priority: 'medium',
    agentModel: 'xantuus-core-0.5',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchProjects();
    }
  }, [session]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/workspace/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/workspace/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          projectId: formData.projectId || undefined,
        }),
      });

      if (response.ok) {
        router.push('/workspace');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create task');
      }
    } catch (error) {
      console.error('Failed to create task:', error);
      alert('Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Button
        variant="ghost"
        onClick={() => router.push('/workspace')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Workspace
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Create New Task</CardTitle>
          <CardDescription>
            Add a new task to your workspace with AI agent configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                placeholder="Enter task title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this task should accomplish"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    setFormData({ ...formData, priority: value })
                  }
                >
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="project">Project (Optional)</Label>
              <Select
                value={formData.projectId}
                onValueChange={(value) =>
                  setFormData({ ...formData, projectId: value })
                }
              >
                <SelectTrigger id="project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: project.color || '#6366f1' }}
                        />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agentModel">AI Agent</Label>
              <Select
                value={formData.agentModel}
                onValueChange={(value) =>
                  setFormData({ ...formData, agentModel: value })
                }
              >
                <SelectTrigger id="agentModel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="xantuus-mini-0.5">
                    Xantuus Mini 0.5
                  </SelectItem>
                  <SelectItem value="xantuus-core-0.5">
                    Xantuus Core 0.5
                  </SelectItem>
                  <SelectItem value="xantuus-ultra-0.5">
                    Xantuus Ultra 0.5
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.push('/workspace')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Task
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
