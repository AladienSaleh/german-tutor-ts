import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { config } from './config.js';

export interface Scenario {
  id: string;
  title: string;
  description: string;
  points: string[];
}

export function loadScenario(id: string): Scenario {
  const path = join(config.scenariosDir, `${id}.yaml`);
  const raw = yaml.load(readFileSync(path, 'utf-8')) as Record<string, unknown>;
  return {
    id: (raw.id as string) ?? id,
    title: (raw.title as string) ?? id,
    description: (raw.description as string) ?? '',
    points: (raw.points as string[]) ?? [],
  };
}

export function listScenarios(): Omit<Scenario, 'points'>[] {
  try {
    return readdirSync(config.scenariosDir)
      .filter(f => f.endsWith('.yaml'))
      .map(f => {
        const id = f.replace('.yaml', '');
        const s = loadScenario(id);
        return { id: s.id, title: s.title, description: s.description };
      });
  } catch {
    return [];
  }
}

export function scenarioPlanText(s: Scenario): string {
  return [
    `Topic: ${s.title}`,
    `Description: ${s.description}`,
    'Points to cover:',
    ...s.points.map((p, i) => `${i + 1}. ${p}`),
  ].join('\n');
}
