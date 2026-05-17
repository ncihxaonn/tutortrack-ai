import { Student, Session } from '../types';
import { ENV } from '../lib/env';

// All AI requests go through the Vercel serverless function at /api/ai so the
// Gemini API key stays server-side. The previous in-bundle key was extractable
// by anyone with the JS file.

async function callProxy(task: 'lesson_plan' | 'student_report', payload: unknown): Promise<string> {
  const res = await fetch(ENV.GEMINI_PROXY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ task, payload })
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json() as { error?: string };
      detail = body.error || '';
    } catch { /* ignore */ }
    throw new Error(detail || `AI request failed (${res.status})`);
  }
  const body = await res.json() as { text?: string };
  return body.text || '';
}

export const generateStudentReport = async (student: Student, recentSessions: Session[]): Promise<string> => {
  try {
    return await callProxy('student_report', {
      studentName: student.name,
      parentName: student.parentName,
      classTypes: student.classTypes,
      notes: student.notes,
      sessions: recentSessions.map(s => ({
        date: new Date(s.date).toLocaleDateString(),
        type: s.type,
        topic: s.topic,
        status: s.status,
        notes: s.notes
      }))
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error contacting AI service: ${msg}`;
  }
};

export const generateLessonPlan = async (topic: string, studentNames: string[], duration: number): Promise<string> => {
  try {
    return await callProxy('lesson_plan', { topic, studentNames, duration });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Error contacting AI service: ${msg}`;
  }
};
