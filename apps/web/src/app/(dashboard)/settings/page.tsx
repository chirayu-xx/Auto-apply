'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, Button, Input, LoadingSpinner } from '@/components/ui';
import { Settings, Check, AlertCircle, Pause, Play } from 'lucide-react';

export default function SettingsPage() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [targetRoles, setTargetRoles] = useState('');
  const [targetLocations, setTargetLocations] = useState('');
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minSalary, setMinSalary] = useState('');
  const [autoApplyThreshold, setAutoApplyThreshold] = useState(75);
  const [blacklistedCompanies, setBlacklistedCompanies] = useState('');
  const [blacklistedKeywords, setBlacklistedKeywords] = useState('');
  const [scanFrequency, setScanFrequency] = useState('12h');
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.preferences.get(token).then((p) => {
      if (p) {
        setTargetRoles((p.targetRoles || []).join(', '));
        setTargetLocations((p.targetLocations || []).join(', '));
        setRemoteOnly(p.remoteOnly || false);
        setMinSalary(p.minSalary?.toString() || '');
        setAutoApplyThreshold(p.autoApplyThreshold ?? 75);
        setBlacklistedCompanies((p.blacklistedCompanies || []).join(', '));
        setBlacklistedKeywords((p.blacklistedKeywords || []).join(', '));
        setScanFrequency(p.scanFrequency || '12h');
        setIsPaused(p.isPaused || false);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    setMessage('');
    try {
      const toArr = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
      await api.preferences.update(token, {
        targetRoles: toArr(targetRoles),
        targetLocations: toArr(targetLocations),
        remoteOnly,
        minSalary: minSalary ? parseInt(minSalary, 10) : null,
        autoApplyThreshold,
        blacklistedCompanies: toArr(blacklistedCompanies),
        blacklistedKeywords: toArr(blacklistedKeywords),
        scanFrequency,
        isPaused,
      });
      setMessage('Preferences saved successfully!');
    } catch (err: any) {
      setMessage(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
          <p className="text-zinc-500 text-sm mt-1">Configure job preferences and automation</p>
        </div>
        <Button
          variant={isPaused ? 'primary' : 'danger'}
          onClick={() => setIsPaused(!isPaused)}
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          {isPaused ? 'Resume Automation' : 'Pause Automation'}
        </Button>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${message.includes('success') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {message.includes('success') ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job Search Preferences */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-zinc-400" />
            Job Search Preferences
          </h2>
          <div className="space-y-4">
            <Input
              label="Target Roles (comma separated)"
              value={targetRoles}
              onChange={(e) => setTargetRoles(e.target.value)}
              placeholder="Full Stack Developer, Frontend Engineer, SDE"
            />
            <Input
              label="Target Locations (comma separated)"
              value={targetLocations}
              onChange={(e) => setTargetLocations(e.target.value)}
              placeholder="Bangalore, Mumbai, Remote"
            />
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="remoteOnly"
                checked={remoteOnly}
                onChange={(e) => setRemoteOnly(e.target.checked)}
                className="h-4 w-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-500"
              />
              <label htmlFor="remoteOnly" className="text-sm text-zinc-700">Remote only</label>
            </div>
            <Input
              label="Minimum Salary (annual, INR)"
              type="number"
              value={minSalary}
              onChange={(e) => setMinSalary(e.target.value)}
              placeholder="800000"
            />
          </div>
        </Card>

        {/* Automation Settings */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">Automation Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Auto-Apply Threshold ({autoApplyThreshold}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={autoApplyThreshold}
                onChange={(e) => setAutoApplyThreshold(parseInt(e.target.value))}
                className="w-full accent-emerald-600"
              />
              <p className="text-xs text-zinc-500 mt-1">
                Jobs with a match score above this threshold will be auto-applied.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">Scan Frequency</label>
              <select
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={scanFrequency}
                onChange={(e) => setScanFrequency(e.target.value)}
              >
                <option value="6h">Every 6 hours</option>
                <option value="12h">Every 12 hours</option>
                <option value="24h">Every 24 hours</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Blacklists */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">Blacklists</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Blacklisted Companies (comma separated)
              </label>
              <textarea
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                rows={3}
                value={blacklistedCompanies}
                onChange={(e) => setBlacklistedCompanies(e.target.value)}
                placeholder="Company A, Company B"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1.5">
                Blacklisted Keywords (comma separated)
              </label>
              <textarea
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                rows={3}
                value={blacklistedKeywords}
                onChange={(e) => setBlacklistedKeywords(e.target.value)}
                placeholder="unpaid, intern"
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? 'Saving…' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
