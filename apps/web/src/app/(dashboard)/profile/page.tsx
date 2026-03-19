'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Card, Button, Input, LoadingSpinner } from '@/components/ui';
import { Upload, FileText, Check, AlertCircle, User, Plus, Trash2, Briefcase, GraduationCap, Wrench } from 'lucide-react';

type ParsedExperience = {
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  bullets: string[];
};

type ParsedEducation = {
  institution: string;
  degree: string;
  field: string;
  graduationDate: string;
};

type ParsedProject = {
  name: string;
  techStack: string[];
  bullets: string[];
};

type ParsedResumeContent = {
  name: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  experience: ParsedExperience[];
  education: ParsedEducation[];
  projects: ParsedProject[];
};

const EMPTY_RESUME_CONTENT: ParsedResumeContent = {
  name: '',
  email: '',
  phone: '',
  location: '',
  skills: [],
  experience: [],
  education: [],
  projects: [],
};

function toCommaSeparated(value: string[]) {
  return value.join(', ');
}

function toList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function toTextArea(value: string[]) {
  return value.join('\n');
}

function fromTextArea(value: string) {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

function sanitizeResumeContent(content: any): ParsedResumeContent {
  return {
    name: content?.name || '',
    email: content?.email || '',
    phone: content?.phone || '',
    location: content?.location || '',
    skills: Array.isArray(content?.skills) ? content.skills.filter(Boolean) : [],
    experience: Array.isArray(content?.experience)
      ? content.experience.map((item: any) => ({
          company: item?.company || '',
          role: item?.role || item?.title || '',
          startDate: item?.startDate || '',
          endDate: item?.endDate || '',
          bullets: Array.isArray(item?.bullets) ? item.bullets.filter(Boolean) : [],
        }))
      : [],
    education: Array.isArray(content?.education)
      ? content.education.map((item: any) => ({
          institution: item?.institution || item?.school || '',
          degree: item?.degree || '',
          field: item?.field || '',
          graduationDate: item?.graduationDate || item?.year || '',
        }))
      : [],
    projects: Array.isArray(content?.projects)
      ? content.projects.map((item: any) => ({
          name: item?.name || '',
          techStack: Array.isArray(item?.techStack) ? item.techStack.filter(Boolean) : [],
          bullets: Array.isArray(item?.bullets) ? item.bullets.filter(Boolean) : [],
        }))
      : [],
  };
}

function inferDesiredRoles(experience: ParsedExperience[]) {
  return Array.from(new Set(experience.map((item) => item.role.trim()).filter(Boolean))).join(', ');
}

function inferExperienceLevel(experience: ParsedExperience[]) {
  if (experience.length >= 3) return 'senior';
  if (experience.length >= 2) return 'mid';
  if (experience.length >= 1) return 'entry';
  return '';
}

export default function ProfilePage() {
  const { user, token } = useAuth();
  const [, setProfile] = useState<Record<string, unknown> | null>(null);
  const [resume, setResume] = useState<any>(null);
  const [resumeContent, setResumeContent] = useState<ParsedResumeContent>(EMPTY_RESUME_CONTENT);
  const [uploadWarning, setUploadWarning] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Profile form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [desiredRoles, setDesiredRoles] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [workPreference, setWorkPreference] = useState('');

  function applyParsedResumeToState(resumeRecord: any, preserveExisting = false) {
    const parsed = sanitizeResumeContent(resumeRecord?.parsedContent);
    setResumeContent(parsed);

    const nextName = parsed.name || '';
    const nextPhone = parsed.phone || '';
    const nextLocation = parsed.location || '';
    const nextDesiredRoles = inferDesiredRoles(parsed.experience);
    const nextExperienceLevel = inferExperienceLevel(parsed.experience);

    setName((current) => (preserveExisting && current ? current : nextName || current));
    setPhone((current) => (preserveExisting && current ? current : nextPhone || current));
    setLocation((current) => (preserveExisting && current ? current : nextLocation || current));
    setDesiredRoles((current) => (preserveExisting && current ? current : nextDesiredRoles || current));
    setExperienceLevel((current) => (preserveExisting && current ? current : nextExperienceLevel || current));
  }

  useEffect(() => {
    if (!token) return;
    Promise.all([
      api.user.getProfile(token).catch(() => null),
      api.resume.getParsed(token).catch(() => null),
    ]).then(([p, r]) => {
      if (p) {
        setProfile(p);
        setName(p.name || '');
        setPhone(p.phone || '');
        setLocation(p.location || '');
        setDesiredRoles((p.desiredRoles || []).join(', '));
        setExperienceLevel(p.experienceLevel || '');
        setWorkPreference(p.workPreference || '');
      }
      if (r) {
        setResume(r);
        applyParsedResumeToState(r, true);
      }
      setLoading(false);
    });
  }, [token]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setUploading(true);
    setMessage('');
    setUploadWarning('');
    try {
      const result = await api.resume.upload(token, file);
      setResume(result);
      applyParsedResumeToState(result);
      if (result.warning) {
        setUploadWarning(result.warning);
        setMessage('Resume uploaded with limited parsing quality.');
      } else {
        setMessage('Resume uploaded and parsed successfully!');
      }
    } catch (err: any) {
      setMessage(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSaveProfile() {
    if (!token) return;
    setSaving(true);
    setMessage('');
    try {
      const roles = desiredRoles.split(',').map((r) => r.trim()).filter(Boolean);
      const contentToSave: ParsedResumeContent = {
        ...resumeContent,
        name,
        email: resumeContent.email || user?.email || '',
        phone,
        location,
        skills: resumeContent.skills,
      };

      await api.user.updateProfile(token, {
        name,
        phone: phone || undefined,
        location: location || undefined,
        desiredRoles: roles,
        experienceLevel: experienceLevel || undefined,
        workPreference: workPreference || undefined,
      });

      if (resume) {
        const updatedResume = await api.resume.updateParsed(token, contentToSave);
        setResume(updatedResume);
        setResumeContent(sanitizeResumeContent(updatedResume.parsedContent));
      }

      setMessage('Profile and resume updated successfully!');
    } catch (err: any) {
      setMessage(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  const parsedContent = resumeContent;

  function updateExperience(index: number, field: keyof ParsedExperience, value: string | string[]) {
    setResumeContent((current) => ({
      ...current,
      experience: current.experience.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function updateEducation(index: number, field: keyof ParsedEducation, value: string) {
    setResumeContent((current) => ({
      ...current,
      education: current.education.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function updateProject(index: number, field: keyof ParsedProject, value: string | string[]) {
    setResumeContent((current) => ({
      ...current,
      projects: current.projects.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Profile & Resume</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage your profile and upload your resume</p>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${message.includes('success') || message.includes('Success') ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {message.includes('success') || message.includes('Success')
            ? <Check className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />
          }
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Form */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-zinc-400" />
              Personal Info
            </h2>
            <div className="space-y-4">
              <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input label="Email" value={user?.email || ''} disabled />
              <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" />
              <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bangalore, India" />
              <Input
                label="Desired Roles (comma separated)"
                value={desiredRoles}
                onChange={(e) => setDesiredRoles(e.target.value)}
                placeholder="Full Stack Developer, Frontend Engineer"
              />
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Experience Level</label>
                <select
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="entry">Entry Level (0-2 yrs)</option>
                  <option value="mid">Mid Level (2-5 yrs)</option>
                  <option value="senior">Senior (5-10 yrs)</option>
                  <option value="lead">Lead / Staff (10+ yrs)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1.5">Work Preference</label>
                <select
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={workPreference}
                  onChange={(e) => setWorkPreference(e.target.value)}
                >
                  <option value="">Any</option>
                  <option value="remote">Remote</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">Onsite</option>
                </select>
              </div>
              <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
                {saving ? 'Saving…' : resume ? 'Save Profile & Resume' : 'Save Profile'}
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-zinc-400" />
              Skills
            </h2>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Skills (comma separated)</label>
            <textarea
              className="w-full min-h-28 px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={toCommaSeparated(parsedContent.skills)}
              onChange={(e) => setResumeContent((current) => ({ ...current, skills: toList(e.target.value) }))}
              placeholder="React, TypeScript, Node.js, PostgreSQL"
            />
          </Card>
        </div>

        {/* Resume Section */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-zinc-400" />
              Resume
            </h2>

            <div
              className="border-2 border-dashed border-zinc-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-zinc-700">
                {uploading ? 'Uploading & parsing…' : 'Click to upload your resume (PDF)'}
              </p>
              <p className="text-xs text-zinc-400 mt-1">PDF only, max 5MB</p>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onClick={(e) => {
                  e.currentTarget.value = '';
                }}
                onChange={handleUpload}
              />
            </div>

            {resume && (
              <div className={`mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${uploadWarning ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {uploadWarning ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                {uploadWarning || 'Resume uploaded and parsed'}
              </div>
            )}
          </Card>

          {resume && (
            <Card className="p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-lg font-semibold text-zinc-900">Resume Details</h2>
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Profile & Resume'}
                </Button>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-zinc-400" />
                      Work Experience
                    </h3>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setResumeContent((current) => ({
                        ...current,
                        experience: [...current.experience, { company: '', role: '', startDate: '', endDate: '', bullets: [] }],
                      }))}
                    >
                      <Plus className="w-4 h-4" />
                      Add Experience
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {parsedContent.experience.map((exp, index) => (
                      <div key={`experience-${index}`} className="border border-zinc-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-zinc-800">Experience {index + 1}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setResumeContent((current) => ({
                              ...current,
                              experience: current.experience.filter((_, itemIndex) => itemIndex !== index),
                            }))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input label="Role" value={exp.role} onChange={(e) => updateExperience(index, 'role', e.target.value)} />
                          <Input label="Company" value={exp.company} onChange={(e) => updateExperience(index, 'company', e.target.value)} />
                          <Input label="Start Date" value={exp.startDate} onChange={(e) => updateExperience(index, 'startDate', e.target.value)} placeholder="Jun 2025" />
                          <Input label="End Date" value={exp.endDate} onChange={(e) => updateExperience(index, 'endDate', e.target.value)} placeholder="Present" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Bullets (one per line)</label>
                          <textarea
                            className="w-full min-h-28 px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={toTextArea(exp.bullets)}
                            onChange={(e) => updateExperience(index, 'bullets', fromTextArea(e.target.value))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-zinc-400" />
                      Education
                    </h3>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setResumeContent((current) => ({
                        ...current,
                        education: [...current.education, { institution: '', degree: '', field: '', graduationDate: '' }],
                      }))}
                    >
                      <Plus className="w-4 h-4" />
                      Add Education
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {parsedContent.education.map((edu, index) => (
                      <div key={`education-${index}`} className="border border-zinc-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-zinc-800">Education {index + 1}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setResumeContent((current) => ({
                              ...current,
                              education: current.education.filter((_, itemIndex) => itemIndex !== index),
                            }))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Input label="Institution" value={edu.institution} onChange={(e) => updateEducation(index, 'institution', e.target.value)} />
                          <Input label="Degree" value={edu.degree} onChange={(e) => updateEducation(index, 'degree', e.target.value)} />
                          <Input label="Field" value={edu.field} onChange={(e) => updateEducation(index, 'field', e.target.value)} />
                          <Input label="Graduation / Dates" value={edu.graduationDate} onChange={(e) => updateEducation(index, 'graduationDate', e.target.value)} placeholder="Sep 2021 - Jun 2025" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-zinc-400" />
                      Projects
                    </h3>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setResumeContent((current) => ({
                        ...current,
                        projects: [...current.projects, { name: '', techStack: [], bullets: [] }],
                      }))}
                    >
                      <Plus className="w-4 h-4" />
                      Add Project
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {parsedContent.projects.map((project, index) => (
                      <div key={`project-${index}`} className="border border-zinc-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-zinc-800">Project {index + 1}</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setResumeContent((current) => ({
                              ...current,
                              projects: current.projects.filter((_, itemIndex) => itemIndex !== index),
                            }))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <Input label="Project Name" value={project.name} onChange={(e) => updateProject(index, 'name', e.target.value)} />
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Tech Stack (comma separated)</label>
                          <textarea
                            className="w-full min-h-20 px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={toCommaSeparated(project.techStack)}
                            onChange={(e) => updateProject(index, 'techStack', toList(e.target.value))}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-zinc-700 mb-1.5">Bullets (one per line)</label>
                          <textarea
                            className="w-full min-h-24 px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={toTextArea(project.bullets)}
                            onChange={(e) => updateProject(index, 'bullets', fromTextArea(e.target.value))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
