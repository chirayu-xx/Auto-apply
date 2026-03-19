'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, Button, Badge, EmptyState, LoadingSpinner } from '@/components/ui';
import {
  Briefcase,
  Search,
  RefreshCw,
  MapPin,
  Building2,
  ExternalLink,
  Send,
  SlidersHorizontal,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react';

interface ScanTask {
  id: string;
  source: string;
  status: string;
  jobsFound: number;
  jobsMatched: number;
  startedAt: string | null;
  completedAt: string | null;
}

export default function JobsPage() {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [scanTasks, setScanTasks] = useState<ScanTask[]>([]);
  const [showScanProgress, setShowScanProgress] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadJobs = useCallback((p = 1) => {
    if (!token) return;
    setLoading(true);
    const params: Record<string, string> = { page: String(p), limit: '20' };
    if (search) params.search = search;
    if (sourceFilter) params.source = sourceFilter;
    api.jobs.list(token, params).then((res) => {
      setJobs(res.jobs || []);
      setTotal(res.pagination?.total || 0);
      setPage(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token, search, sourceFilter]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (!token) return;
      try {
        const status = await api.jobs.scanStatus(token);
        setScanTasks(status.tasks);

        if (!status.isScanning) {
          // All tasks completed
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setScanning(false);

          const totalFound = status.summary.totalJobsFound;
          const totalMatched = status.summary.totalJobsMatched;
          const allFailed = status.tasks.every((t) => t.status === 'failed');

          if (allFailed) {
            setMessage({
              text: 'Scan completed but encountered errors. Some sources may be temporarily unavailable.',
              type: 'error',
            });
          } else {
            setMessage({
              text: `Scan complete! Found ${totalFound} new job${totalFound !== 1 ? 's' : ''} across ${status.tasks.filter(t => t.status === 'completed').length} sources.${totalMatched > 0 ? ` ${totalMatched} match your profile.` : ''}`,
              type: 'success',
            });
          }

          loadJobs(1);
        }
      } catch {
        // Silently handle polling errors
      }
    }, 2000);
  }, [token, loadJobs]);

  async function handleScan() {
    if (!token || scanning) return;
    setScanning(true);
    setShowScanProgress(true);
    setMessage(null);
    setScanTasks([
      { id: '1', source: 'linkedin', status: 'pending', jobsFound: 0, jobsMatched: 0, startedAt: null, completedAt: null },
      { id: '2', source: 'indeed', status: 'pending', jobsFound: 0, jobsMatched: 0, startedAt: null, completedAt: null },
      { id: '3', source: 'naukri', status: 'pending', jobsFound: 0, jobsMatched: 0, startedAt: null, completedAt: null },
    ]);

    try {
      await api.jobs.scan(token);
      // Start polling for status updates
      startPolling();
    } catch (err: any) {
      setScanning(false);
      setMessage({ text: err.message || 'Failed to start scan', type: 'error' });
    }
  }

  async function handleApply(jobId: string) {
    if (!token) return;
    setApplying(jobId);
    try {
      await api.applications.apply(token, jobId);
      setMessage({ text: 'Application queued successfully!', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Apply failed', type: 'error' });
    } finally {
      setApplying(null);
    }
  }

  function getSourceBadge(source: string) {
    const variants: Record<string, 'info' | 'success' | 'warning' | 'default'> = {
      linkedin: 'info',
      indeed: 'success',
      naukri: 'warning',
    };
    return <Badge variant={variants[source] || 'default'}>{source}</Badge>;
  }

  function getSourceIcon(source: string) {
    const colors: Record<string, string> = {
      linkedin: 'bg-blue-100 text-blue-700',
      indeed: 'bg-purple-100 text-purple-700',
      naukri: 'bg-orange-100 text-orange-700',
    };
    return (
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${colors[source] || 'bg-zinc-100 text-zinc-700'}`}>
        {source.charAt(0).toUpperCase()}
      </span>
    );
  }

  function getTaskStatusIcon(status: string) {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-400" />;
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Jobs</h1>
          <p className="text-zinc-500 text-sm mt-1">{total} jobs discovered</p>
        </div>
        <Button onClick={handleScan} disabled={scanning}>
          <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning…' : 'Scan for Jobs'}
        </Button>
      </div>

      {/* Message Banner */}
      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm flex items-center justify-between ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700' :
          message.type === 'error' ? 'bg-red-50 text-red-700' :
          'bg-blue-50 text-blue-700'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-4 opacity-60 hover:opacity-100">&times;</button>
        </div>
      )}

      {/* Scan Progress Panel */}
      {showScanProgress && (
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
              {scanning && <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />}
              {scanning ? 'Scanning Job Sources…' : 'Scan Results'}
            </h3>
            {!scanning && (
              <button
                onClick={() => setShowScanProgress(false)}
                className="text-zinc-400 hover:text-zinc-600 text-sm"
              >
                Dismiss
              </button>
            )}
          </div>
          <div className="space-y-3">
            {scanTasks.map((task) => (
              <div key={task.source} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg">
                {getSourceIcon(task.source)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-zinc-900 capitalize">{task.source}</span>
                    {getTaskStatusIcon(task.status)}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {task.status === 'pending' && 'Waiting to start…'}
                    {task.status === 'running' && 'Searching for jobs…'}
                    {task.status === 'completed' && `Found ${task.jobsFound} job${task.jobsFound !== 1 ? 's' : ''}${task.jobsMatched > 0 ? `, ${task.jobsMatched} matched` : ''}`}
                    {task.status === 'failed' && 'Source temporarily unavailable'}
                  </p>
                </div>
                {task.status === 'running' && (
                  <div className="w-24 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                )}
                {task.status === 'completed' && task.jobsFound > 0 && (
                  <span className="text-sm font-semibold text-emerald-600">+{task.jobsFound}</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Search by title or company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadJobs(1)}
            />
          </div>
          <select
            className="px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setTimeout(() => loadJobs(1), 0); }}
          >
            <option value="">All Sources</option>
            <option value="linkedin">LinkedIn</option>
            <option value="indeed">Indeed</option>
            <option value="naukri">Naukri</option>
          </select>
          <Button variant="secondary" onClick={() => loadJobs(1)}>
            <SlidersHorizontal className="w-4 h-4" />
            Filter
          </Button>
        </div>
      </Card>

      {/* Job List */}
      {loading ? (
        <LoadingSpinner />
      ) : jobs.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<Briefcase className="w-10 h-10" />}
            title="No jobs found"
            description="Trigger a scan to discover jobs matching your preferences, or adjust your search filters."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card key={job.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-semibold text-zinc-900 truncate">{job.title}</h3>
                    {getSourceBadge(job.source)}
                    {job.isEasyApply && <Badge variant="success">Easy Apply</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-zinc-500 mb-2">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />{job.company}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />{job.location || 'Remote'}
                    </span>
                    {job.jobType && <span>{job.jobType}</span>}
                    {job.salaryRange && <span>{job.salaryRange}</span>}
                  </div>
                  {job.description && (
                    <p className="text-sm text-zinc-600 line-clamp-2">{job.description}</p>
                  )}
                  {job.requiredSkills?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {job.requiredSkills.slice(0, 6).map((s: string) => (
                        <span key={s} className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded">
                          {s}
                        </span>
                      ))}
                      {job.requiredSkills.length > 6 && (
                        <span className="text-xs text-zinc-400">+{job.requiredSkills.length - 6} more</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {job.relevanceScore != null && (
                    <div className={`text-lg font-bold ${job.relevanceScore >= 75 ? 'text-emerald-600' : job.relevanceScore >= 50 ? 'text-amber-600' : 'text-zinc-400'}`}>
                      {job.relevanceScore}%
                    </div>
                  )}
                  <div className="flex gap-2">
                    {job.sourceUrl && (
                      <a
                        href={job.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-400 hover:text-zinc-600"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleApply(job.id)}
                      disabled={applying === job.id}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {applying === job.id ? 'Applying…' : 'Apply'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => loadJobs(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-zinc-500 px-3">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => loadJobs(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
