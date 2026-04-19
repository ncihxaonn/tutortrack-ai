import { GoogleGenAI } from "@google/genai";
import { Student, Session } from "../types";

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("API Key not found in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateStudentReport = async (student: Student, recentSessions: Session[]): Promise<string> => {
  const ai = getAIClient();
  if (!ai) return "API Key missing. Cannot generate report.";

  const sessionSummary = recentSessions.map(s => 
    `- Date: ${new Date(s.date).toLocaleDateString()}, Type: ${s.type}, Topic: ${s.topic}, Status: ${s.status}, Notes: ${s.notes}`
  ).join('\n');

  const prompt = `
    You are a professional and encouraging English tutor assistant.
    Write a short progress report email to the parent of ${student.name} (${student.parentName || 'Parent'}).
    
    Student Details:
    - Enrolled Programs: ${student.classTypes.join(', ')}
    - Recent Performance Notes: ${student.notes}
    
    Recent Sessions:
    ${sessionSummary}

    The email should be professional, highlight strengths, identify one area for improvement, and encourage the student.
    Keep it under 200 words.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Could not generate report.";
  } catch (error) {
    console.error("Error generating report:", error);
    return "Error contacting AI service. Please try again later.";
  }
};

export const generateLessonPlan = async (topic: string, studentNames: string[], duration: number): Promise<string> => {
  const ai = getAIClient();
  if (!ai) return "API Key missing.";

  const prompt = `
    Create a simple, engaging English lesson plan for:
    - Topic: ${topic}
    - Students: ${studentNames.join(', ')}
    - Duration: ${duration} minutes
    
    Include:
    1. Warm-up activity (5 min)
    2. Main Concept (10 min)
    3. Practice Activity (Interactive)
    4. Cool down / Review
    
    Format the output in clear Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Could not generate lesson plan.";
  } catch (error) {
    console.error("Error generating lesson plan:", error);
    return "Error contacting AI service.";
  }
};