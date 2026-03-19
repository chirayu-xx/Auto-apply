'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, Badge, Button, EmptyState, LoadingSpinner } from '@/components/ui';
import { Send, Building2, MapPin, ExternalLink, Calendar } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
  queued: { label: 'Queued', variant: 'default' },
  applying: { label: 'Applying', variant: 'info' },
  applied: { label: 'Applied', variant: 'success' },
  viewed: { label: 'Viewed', variant: 'info' },
  interview: { label: 'Interview', variant: 'warning' },
  offer: { label: 'Offer', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
  failed: { label: 'Failed', variant: 'error' },
};

const STATUS_OPTIONS = ['all', 'queued', 'applying', 'applied', 'viewed', 'interview', 'offer', 'rejected', 'failed'];

export default function ApplicationsPage() {
  const { token } = useAuth();
  const [apps, setApps] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number> } | null>(null);

  function loadApps(p = 1, status = statusFilter) {
    if (!token) return;
    setLoading(true);
    const params: Record<string, string> = { page: String(p), limit: '20' };
    if (status !== 'all') params.status = status;
    api.applications.list(token, params).then((res) => {
      setApps(res.applications || []);
      setTotal(res.pagination?.total || 0);
      setPage(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => {
    if (!token) return;
    api.applications.stats(token).then(setStats).catch(() => {});
    loadApps();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Applications</h1>
        <p className="text-zinc-500 text-sm mt-1">{total} total applications</p>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="flex flex-wrap gap-2 mb-6">
          {STATUS_OPTIONS.map((s) => {
            const count = s === 'all' ? stats.total : (stats.byStatus[s] || 0);
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); loadApps(1, s); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-emerald-600 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
              >
                {s === 'all' ? 'All' : STATUS_CONFIG[s]?.label || s} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Application List */}
      {loading ? (
        <LoadingSpinner />
      ) : apps.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<Send className="w-10 h-10" />}
            title="No applications yet"
            description="Apply to jobs from the Jobs page to see them tracked here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => (
            <Card key={app.id} className="p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-zinc-900 truncate">
                      {app.job?.title || 'Unknown Role'}
                    </h3>
                    <Badge variant={STATUS_CONFIG[app.status]?.variant || 'default'}>
                      {STATUS_CONFIG[app.status]?.label || app.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-zinc-500">
                    {app.job?.company && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />{app.job.company}
                      </span>
                    )}
                    {app.job?.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />{app.job.location}
                      </span>
                    )}
                    {app.appliedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(app.appliedAt).toLocaleDateString()}
                      </span>
                    )}
                    {app.job?.source && (
                      <Badge variant="default">{app.job.source}</Badge>
                    )}
                  </div>
                  {app.errorLog && (
                    <p className="text-xs text-rose-500 mt-1">Error: {app.errorLog}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {app.tailoredResume?.matchScore != null && (
                    <span className="text-sm font-medium text-zinc-500">
                      {app.tailoredResume.matchScore}% match
                    </span>
                  )}
                  {app.job?.sourceUrl && (
                    <a
                      href={app.job.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-400 hover:text-zinc-600"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => loadApps(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-zinc-500 px-3">Page {page} of {totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => loadApps(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
