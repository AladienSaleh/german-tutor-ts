import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { config } from './config.js';
export function loadScenario(id) {
    const path = join(config.scenariosDir, `${id}.yaml`);
    const raw = yaml.load(readFileSync(path, 'utf-8'));
    return {
        id: raw.id ?? id,
        title: raw.title ?? id,
        description: raw.description ?? '',
        points: raw.points ?? [],
    };
}
export function listScenarios() {
    try {
        return readdirSync(config.scenariosDir)
            .filter(f => f.endsWith('.yaml'))
            .map(f => {
            const id = f.replace('.yaml', '');
            const s = loadScenario(id);
            return { id: s.id, title: s.title, description: s.description };
        });
    }
    catch {
        return [];
    }
}
export function scenarioPlanText(s) {
    return [
        `Topic: ${s.title}`,
        `Description: ${s.description}`,
        'Points to cover:',
        ...s.points.map((p, i) => `${i + 1}. ${p}`),
    ].join('\n');
}
//# sourceMappingURL=scenarios.js.map