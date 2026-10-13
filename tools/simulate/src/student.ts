// Alumno sintético: un modelo de memoria sencillo y determinista (semilla) para ejercitar el núcleo.
// NO pretende ser realista; solo produce comportamientos distinguibles (aprende, olvida, se ausenta).
import { DAY, type ExerciseFormat, type HintLevel, type SkillKind } from '@memora/core';

export interface Profile {
  name: string;
  /** Estabilidad inicial tras la primera presentación: días hasta que el recuerdo baja al 90 %. */
  initialStability: number;
  /** Cuánto crece la estabilidad con una recuperación correcta. */
  gain: number;
  /** Días (0-index) sin estudiar. */
  absentDays: number[];
  seed: number;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Memory {
  stability: number;
  lastAt: number;
}

export function formatFor(kind: SkillKind, hint: HintLevel): ExerciseFormat {
  switch (kind) {
    case 'recognize':
      return 'recognition_choice';
    case 'listen':
      return 'recognition_listening';
    case 'recall':
      return hint > 0 ? 'recall_cued' : 'recall_unaided';
    case 'produce':
    case 'speak':
      return 'production';
    case 'apply':
      return 'application';
  }
}

export class SyntheticStudent {
  private readonly memory = new Map<string, Memory>();
  private readonly random: () => number;

  constructor(readonly profile: Profile) {
    this.random = rng(profile.seed);
  }

  expose(skillId: string, at: number): void {
    const m = this.memory.get(skillId);
    if (m) m.lastAt = at;
    else this.memory.set(skillId, { stability: this.profile.initialStability, lastAt: at });
  }

  /** Probabilidad de acertar según el tiempo transcurrido, el formato y la pista. */
  probability(skillId: string, at: number, format: ExerciseFormat, hint: HintLevel): number {
    const m = this.memory.get(skillId);
    if (!m) return format === 'recognition_choice' ? 0.25 : 0.02;
    // Convenio habitual: con t = estabilidad, la probabilidad de recordar es 0,9.
    const p = 0.9 ** (Math.max(0, at - m.lastAt) / DAY / m.stability);
    switch (format) {
      case 'recognition_choice':
        return 0.25 + 0.75 * Math.sqrt(p);
      case 'recognition_listening':
        return 0.2 + 0.8 * p ** 0.7;
      case 'recall_cued':
        return p + (1 - p) * hint * 0.18;
      case 'recall_unaided':
        return p;
      case 'production':
        return p ** 1.3;
      case 'application':
        return p ** 1.5;
    }
  }

  /** Responde y actualiza su memoria. Devuelve acierto y tiempo de respuesta. */
  answer(skillId: string, at: number, format: ExerciseFormat, hint: HintLevel): { correct: boolean; timeMs: number } {
    const p = this.probability(skillId, at, format, hint);
    const correct = this.random() < p;
    const m = this.memory.get(skillId) ?? { stability: this.profile.initialStability, lastAt: at };
    const elapsed = Math.max(0, at - m.lastAt) / DAY;
    const retrieval = format !== 'recognition_choice' && format !== 'recognition_listening';
    if (correct && retrieval) m.stability *= 1 + this.profile.gain * Math.min(2, Math.max(0.2, elapsed / m.stability + 0.2)) * (1 - hint * 0.15);
    else if (correct) m.stability *= 1 + 0.15 * this.profile.gain;
    else m.stability = Math.max(0.15, m.stability * 0.5);
    m.lastAt = at;
    this.memory.set(skillId, m);
    const timeMs = Math.round(2_500 + (1 - p) * 8_000 + this.random() * 1_500);
    return { correct, timeMs };
  }
}

export const PROFILES = {
  languageLearner: { name: 'idioma', initialStability: 0.6, gain: 1.4, absentDays: [], seed: 11 },
  programmingLearner: { name: 'programación', initialStability: 0.5, gain: 1.3, absentDays: [], seed: 22 },
  forgetful: { name: 'olvidadizo', initialStability: 0.15, gain: 0.6, absentDays: [], seed: 33 },
  absent: { name: 'ausente 5 días', initialStability: 0.6, gain: 1.4, absentDays: [10, 11, 12, 13, 14], seed: 44 },
} satisfies Record<string, Profile>;
