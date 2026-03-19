'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, StatCard, Badge, Button, EmptyState, LoadingSpinner } from '@/components/ui';
import {
  Send,
  Briefcase,
  CheckCircle,
  Clock,
  Search,
  FileText,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  queued: { label: 'Queued', variant: 'default' },
  applying: { label: 'Applying', variant: 'info' },
  applied: { label: 'Applied', variant: 'success' },
  viewed: { label: 'Viewed', variant: 'info' },
  interview: { label: 'Interview', variant: 'warning' },
  offer: { label: 'Offer', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
  failed: { label: 'Failed', variant: 'error' },
};

export default function DashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number> } | null>(null);
  const [recentApps, setRecentApps] = useState<any[]>([]);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.applications.stats(token).catch(() => ({ total: 0, byStatus: {} })),
      api.applications.list(token, { limit: '5' }).catch(() => ({ applications: [] })),
      api.jobs.list(token, { limit: '5' }).catch(() => ({ jobs: [] })),
    ]).then(([s, a, j]) => {
      setStats(s);
      setRecentApps(a.applications || []);
      setRecentJobs(j.jobs || []);
      setLoading(false);
    });
  }, [token]);

  if (loading) return <LoadingSpinner />;

  const applied = stats?.byStatus?.applied || 0;
  const interviews = stats?.byStatus?.interview || 0;
  const queued = stats?.byStatus?.queued || 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="text-zinc-500 text-sm mt-1">Overview of your job search activity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Applications"
          value={stats?.total || 0}
          icon={<Send className="w-5 h-5" />}
          color="emerald"
        />
        <StatCard
          label="Applied"
          value={applied}
          icon={<CheckCircle className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Interviews"
          value={interviews}
          icon={<Briefcase className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          label="In Queue"
          value={queued}
          icon={<Clock className="w-5 h-5" />}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Applications */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-900">Recent Applications</h2>
            <Link href="/applications" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {recentApps.length === 0 ? (
            <EmptyState
              icon={<Send className="w-10 h-10" />}
              title="No applications yet"
              description="Start by discovering jobs and applying to them."
            />
          ) : (
            <div className="space-y-3">
              {recentApps.map((app: any) => (
                <div key={app.id} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{app.job?.title || 'Unknown'}</p>
                    <p className="text-xs text-zinc-500">{app.job?.company || ''}</p>
                  </div>
                  <Badge variant={STATUS_BADGES[app.status]?.variant || 'default'}>
                    {STATUS_BADGES[app.status]?.label || app.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Jobs */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-900">Recent Jobs Found</h2>
            <Link href="/jobs" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {recentJobs.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="w-10 h-10" />}
              title="No jobs discovered yet"
              description="Trigger a scan to discover matching jobs."
            />
          ) : (
            <div className="space-y-3">
              {recentJobs.map((job: any) => (
                <div key={job.id} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{job.title}</p>
                    <p className="text-xs text-zinc-500">{job.company} • {job.location || 'Remote'}</p>
                  </div>
                  {job.relevanceScore != null && (
                    <Badge variant={job.relevanceScore >= 75 ? 'success' : job.relevanceScore >= 50 ? 'warning' : 'default'}>
                      {job.relevanceScore}% match
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="p-6 mt-6">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/profile">
            <Button variant="secondary">
              <FileText className="w-4 h-4" />
              Upload Resume
            </Button>
          </Link>
          <Link href="/jobs">
            <Button variant="secondary">
              <Search className="w-4 h-4" />
              Discover Jobs
            </Button>
          </Link>
          <Link href="/settings">
            <Button variant="secondary">
              <Clock className="w-4 h-4" />
              Configure Preferences
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
