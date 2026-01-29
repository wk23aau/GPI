import { GoogleGenAI, Type } from "@google/genai";
import { ResumeData } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const tailorResume = async (
  currentResume: ResumeData, 
  jobDescription: string
): Promise<ResumeData> => {
  
  const systemInstruction = `
    You are an expert professional Resume Writer and Career Coach.
    Your task is to take an existing candidate's resume and a specific Job Description (JD).
    You must rewrite the resume to strictly target the JD, increasing the candidate's chances of getting an interview.

    Rules:
    1. FACTUAL ACCURACY: Do not invent new jobs, companies, or degrees. You can only reframe existing experience.
    2. KEYWORDS: Integrate keywords from the JD naturally into the Summary and Bullet Points.
    3. RELEVANCE: Reorder skills or bullet points to put the most relevant ones first. Remove irrelevant ones if necessary to save space, but keep the document substantial.
    4. SUMMARY: Rewrite the summary to be a powerful pitch connecting the candidate's background to this specific role.
    5. TONE: Professional, active voice, result-oriented.
    6. Output must be strictly valid JSON matching the schema.
  `;

  const prompt = `
    CURRENT RESUME (JSON):
    ${JSON.stringify(currentResume, null, 2)}

    TARGET JOB DESCRIPTION:
    ${jobDescription}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            personalInfo: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                title: { type: Type.STRING },
                address: { type: Type.STRING },
                phone: { type: Type.STRING },
                email: { type: Type.STRING }
              },
              required: ["name", "title", "address", "phone", "email"]
            },
            summary: { type: Type.STRING },
            skills: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  items: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["category", "items"]
              }
            },
            experience: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  company: { type: Type.STRING },
                  location: { type: Type.STRING },
                  role: { type: Type.STRING },
                  dates: { type: Type.STRING },
                  description: { type: Type.STRING },
                  bullets: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["company", "location", "role", "dates", "bullets"]
              }
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  degree: { type: Type.STRING },
                  institution: { type: Type.STRING },
                  location: { type: Type.STRING },
                  dates: { type: Type.STRING },
                  details: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["degree", "institution", "location", "dates", "details"]
              }
            },
            technicalSetup: { type: Type.ARRAY, items: { type: Type.STRING } },
            additionalInfo: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["personalInfo", "summary", "skills", "experience", "education"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as ResumeData;
    }
    throw new Error("No response text received from Gemini");

  } catch (error) {
    console.error("Error tailoring resume:", error);
    throw error;
  }
};