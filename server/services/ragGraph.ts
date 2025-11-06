import 'dotenv/config';
import { ragAdapter } from './ragAdapter';
import { db } from '../db';
import { containers } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export interface DiagnoseRequest {
  containerId?: string;
  alarmCode?: string;
  unitModel?: string;
  query?: string;
}

export interface DiagnoseResult {
  summary: string;
  steps: string[];
  parts?: string[];
  sources: Array<{ manual_id: string; manual_name: string; page: number }>;
  confidence: 'high' | 'medium' | 'low';
}

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';

function extractSteps(answer: string): string[] {
  const lines = answer.split(/\n+/).map(l => l.trim());
  const steps: string[] = [];
  for (const l of lines) {
    if (/^(\d+\.|-)/.test(l)) steps.push(l.replace(/^\d+\.|^-\s*/, '').trim());
  }
  return steps.slice(0, 12);
}

function scoreConfidence(len: number): 'high' | 'medium' | 'low' {
  if (len >= 6) return 'high';
  if (len >= 3) return 'medium';
  return 'low';
}

export async function runDiagnosis(req: DiagnoseRequest): Promise<DiagnoseResult> {
  // 1) Resolve container model if missing
  let unitModel = req.unitModel;
  if (!unitModel && req.containerId) {
    const [c] = await db.select().from(containers).where(eq(containers.id, req.containerId));
    unitModel = (c as any)?.model || undefined;
  }

  // 2) Build retrieval query
  const userQuery = req.query || (req.alarmCode ? `Troubleshoot alarm ${req.alarmCode}${unitModel ? ' on ' + unitModel : ''}` : 'Troubleshoot current reefer issue');

  // 3) Use ragAdapter to get comprehensive response (this uses cloudQdrantStore internally)
  const ragResponse = await ragAdapter.query({
    user_id: 'system', // System-generated query
    unit_id: req.containerId,
    unit_model: unitModel,
    alarm_code: req.alarmCode,
    query: userQuery,
    context: { source: 'diagnosis_api' }
  });

  // 4) Convert ragAdapter response to DiagnoseResult format
  return {
    summary: ragResponse.answer,
    steps: ragResponse.steps,
    parts: ragResponse.suggested_spare_parts,
    sources: ragResponse.sources,
    confidence: ragResponse.confidence
  };
}




