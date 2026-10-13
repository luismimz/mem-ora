import type { SimulationResult } from './simulate';

const pad = (value: string | number, width: number) => String(value).padStart(width);

export function formatReport(result: SimulationResult, course: string): string {
  const lines = [
    `## Alumno «${result.profile.name}» · curso ${course}`,
    '',
    ' día  estudia nuevas repasos aciertos vencidas fuera  nuevo-bloq | aprend consol consolid debil | asoc: queda forma pierde revisar',
  ];
  for (const r of result.rows) {
    const acc = r.attempts ? `${r.correct}/${r.attempts}` : '-';
    lines.push(
      [
        pad(r.day, 4),
        pad(r.studied ? 'sí' : 'no', 8),
        pad(r.newItems, 6),
        pad(r.reviews, 8),
        pad(acc, 8),
        pad(r.due, 8),
        pad(r.backlog, 6),
        pad(r.newSuppressed ? 'sí' : '', 11),
        ' |',
        pad(r.statuses.learning + r.statuses.presented, 6),
        pad(r.statuses.consolidating, 6),
        pad(r.statuses.consolidated, 8),
        pad(r.statuses.weakened, 5),
        ' |',
        pad(r.associations.holding, 11),
        pad(r.associations.forming, 6),
        pad(r.associations.losing, 7),
        pad(r.associations.reviewNeeded, 8),
      ].join(' '),
    );
  }
  const last = result.rows.at(-1);
  if (last) {
    const total = Object.values(last.statuses).reduce((a, b) => a + b, 0);
    lines.push('', `Final: ${last.statuses.consolidated}/${total} habilidades consolidadas, ${last.statuses.weakened} debilitadas, ${last.statuses.new} sin empezar.`);
  }
  return lines.join('\n');
}
