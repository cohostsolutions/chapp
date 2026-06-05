import { TrainingSessionRecord } from './types';
import { devWarn } from '../logger';

const STORAGE_KEY = 'aiTrainingSessions';

export function saveSession(record: TrainingSessionRecord) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: TrainingSessionRecord[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(r => r.id === record.id);
    if (idx >= 0) list[idx] = record; else list.push(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    devWarn('Failed to save training session', e);
  }
}

export function listSessions(): TrainingSessionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getSession(id: string): TrainingSessionRecord | null {
  return listSessions().find(r => r.id === id) || null;
}
