'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Zap, ArrowRight, Briefcase, FileText, Send } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading) return null;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Zap className="w-7 h-7 text-emerald-400" />
          <span className="text-xl font-bold tracking-tight">AutoApply</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-medium transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="inline-flex items-center gap-2 bg-emerald-950 text-emerald-400 text-sm px-4 py-1.5 rounded-full mb-6 font-medium">
          <Zap className="w-4 h-4" />
          AI-Powered Job Automation
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight max-w-3xl leading-tight mb-6">
          Find, Tailor &<br />
          <span className="text-emerald-400">Auto-Apply</span> to Jobs
        </h1>
        <p className="text-lg text-zinc-400 max-w-xl mb-10">
          Upload your resume, set your preferences, and let AI discover matching jobs,
          tailor your resume to each role, and apply automatically.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-xl text-base font-semibold transition-colors shadow-lg shadow-emerald-900/30"
        >
          Start Auto-Applying
          <ArrowRight className="w-5 h-5" />
        </Link>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 max-w-4xl w-full">
          {[
            {
              icon: <Briefcase className="w-6 h-6" />,
              title: 'Smart Discovery',
              desc: 'Scans LinkedIn, Indeed & Naukri for jobs matching your skills and preferences.',
            },
            {
              icon: <FileText className="w-6 h-6" />,
              title: 'AI Resume Tailoring',
              desc: 'Generates a tailored resume and cover letter for each job description.',
            },
            {
              icon: <Send className="w-6 h-6" />,
              title: 'One-Click Apply',
              desc: 'Auto-fills applications and submits them via Playwright browser automation.',
            },
          ].map((f) => (
            <div key={f.title} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-left">
              <div className="text-emerald-400 mb-3">{f.icon}</div>
              <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
              <p className="text-sm text-zinc-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-sm text-zinc-600 py-8">
        AutoApply &mdash; Built for software engineers who&apos;d rather write code than fill forms.
      </footer>
    </div>
  );
}
