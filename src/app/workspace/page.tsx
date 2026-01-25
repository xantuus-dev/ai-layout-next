'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Settings,
  Share2,
  FolderPlus,
  CheckSquare,
  Loader2,
} from 'lucide-react';
import Image from 'next/image';

interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  projectId?: string;
  project?: Project;
  createdAt: string;
}

export default function WorkspacePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedAgent, setSelectedAgent] = useState('xantuus-core-0.5');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      fetchTasks();
      fetchProjects();
    } else if (status === 'unauthenticated') {
      setLoading(false);
    }
  }, [session, status]);

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/workspace/tasks');
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      } else if (response.status === 401) {
        console.error('Authentication failed - redirecting to login');
        router.push('/');
      } else {
        console.error('Failed to fetch tasks:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/workspace/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      } else if (response.status === 401) {
        console.error('Authentication failed for projects');
      } else {
        console.error('Failed to fetch projects:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null; // Will redirect via useEffect
  }

  if (loading && status === 'authenticated') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Main Panel */}
      <div className="flex-1 flex flex-col p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Workspace</h1>
          <p className="text-muted-foreground">
            Manage your projects, tasks, and AI workflows
          </p>
        </div>

        {/* Agent Selection */}
        <div className="mb-6">
          <label className="text-sm font-medium mb-2 block">
            Select AI Agent
          </label>
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Choose an AI agent" />
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

        {/* Main Content Area */}
        <div className="flex-1 border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Tasks</h2>
            <Button size="sm" variant="outline">
              View All
            </Button>
          </div>

          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckSquare className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No tasks yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first task to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.slice(0, 10).map((task) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className="flex-1">
                    <h3 className="font-medium mb-1">{task.title}</h3>
                    {task.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          task.status === 'completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : task.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {task.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {task.priority}
                      </span>
                      {task.project && (
                        <span className="text-xs text-muted-foreground">
                          • {task.project.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 border-l bg-card p-6 overflow-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">X</span>
            </div>
            <span className="font-semibold">Xantuus</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/settings')}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>

        {/* Create Task Button */}
        <Button className="w-full mb-4" onClick={() => router.push('/workspace/tasks/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Task
        </Button>

        {/* Search Projects */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Create Project Button */}
        <Button variant="outline" className="w-full mb-4" onClick={() => router.push('/workspace/projects/new')}>
          <FolderPlus className="h-4 w-4 mr-2" />
          Create New Project
        </Button>

        {/* Projects List */}
        <div className="flex-1 mb-4">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase">
            Projects
          </h3>
          <div className="space-y-2">
            {filteredProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                {searchQuery ? 'No projects found' : 'No projects yet'}
              </p>
            ) : (
              filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => router.push(`/workspace/projects/${project.id}`)}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: project.color || '#6366f1' }}
                  />
                  <span className="text-sm flex-1 truncate">{project.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {tasks.filter((t) => t.projectId === project.id).length}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Referral Section */}
        <div className="mt-auto pt-4 border-t">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="bg-primary rounded-full p-2">
                <Share2 className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold mb-1">
                  Share & Earn Credits
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Invite a friend and you both get 500 credits!
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => router.push('/workspace/referrals')}
                >
                  Get Referral Link
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
