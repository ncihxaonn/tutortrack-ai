import { GoogleGenAI } from '@google/genai';

// Vercel Edge-compatible serverless function. Keeps GEMINI_API_KEY server-side
// only — the previous client-bundle approach made the key trivially extractable.
//
// Expected request body:
//   { task: 'lesson_plan' | 'student_report', payload: {...} }

export const config = { runtime: 'edge' };

type LessonPlanInput = { topic: string; studentNames: string[]; duration: number };
type StudentReportInput = {
  studentName: string;
  parentName?: string;
  classTypes: string[];
  notes: string;
  sessions: Array<{ date: string; type: string; topic: string; status: string; notes: string }>;
};

const MODEL = 'gemini-3-flash-preview';

function buildLessonPlanPrompt(input: LessonPlanInput): string {
  return `
Create a simple, engaging English lesson plan for:
- Topic: ${input.topic}
- Students: ${input.studentNames.join(', ')}
- Duration: ${input.duration} minutes

Include:
1. Warm-up activity (5 min)
2. Main Concept (10 min)
3. Practice Activity (Interactive)
4. Cool down / Review

Format the output in clear Markdown.
`.trim();
}

function buildStudentReportPrompt(input: StudentReportInput): string {
  const sessionSummary = input.sessions.map(s =>
    `- Date: ${s.date}, Type: ${s.type}, Topic: ${s.topic}, Status: ${s.status}, Notes: ${s.notes}`
  ).join('\n');
  return `
You are a professional and encouraging English tutor assistant.
Write a short progress report email to the parent of ${input.studentName} (${input.parentName || 'Parent'}).

Student Details:
- Enrolled Programs: ${input.classTypes.join(', ')}
- Recent Performance Notes: ${input.notes}

Recent Sessions:
${sessionSummary}

The email should be professional, highlight strengths, identify one area for improvement, and encourage the student.
Keep it under 200 words.
`.trim();
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Verify the caller holds a valid Supabase session. Without this, the endpoint
// is an open proxy: anyone on the internet could POST here and burn the Gemini
// quota (a billing-DoS and free-LLM-relay risk). We validate the bearer token
// against Supabase's /auth/v1/user endpoint — a 200 means the JWT is genuine
// and unexpired.
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

async function isAuthenticated(req: Request): Promise<boolean> {
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${token}` }
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json(500, { error: 'Auth not configured on server' });
  }
  if (!(await isAuthenticated(req))) {
    return json(401, { error: 'Unauthorized' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json(500, { error: 'GEMINI_API_KEY not configured on server' });

  let body: { task?: string; payload?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  let prompt: string;
  if (body.task === 'lesson_plan') {
    const p = body.payload as LessonPlanInput | undefined;
    if (!p || !p.topic || !Array.isArray(p.studentNames)) {
      return json(400, { error: 'lesson_plan requires topic and studentNames' });
    }
    prompt = buildLessonPlanPrompt(p);
  } else if (body.task === 'student_report') {
    const p = body.payload as StudentReportInput | undefined;
    if (!p || !p.studentName || !Array.isArray(p.classTypes) || !Array.isArray(p.sessions)) {
      return json(400, { error: 'student_report requires studentName, classTypes[] and sessions[]' });
    }
    prompt = buildStudentReportPrompt(p);
  } else {
    return json(400, { error: 'Unknown task' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({ model: MODEL, contents: prompt });
    return json(200, { text: res.text ?? '' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json(502, { error: `Gemini error: ${msg}` });
  }
}
