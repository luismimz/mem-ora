// pnpm simulate → simulación de 30 días con los cuatro alumnos sintéticos.
import { resolveConfig } from '@memora/core';
import { languageCourse, programmingCourse } from './courses';
import { formatReport } from './report';
import { simulate } from './simulate';
import { PROFILES } from './student';

const config = resolveConfig();
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const days = daysArg ? Math.max(1, Number(daysArg.split('=')[1]) || 30) : 30;
const runs = [
  { profile: PROFILES.languageLearner, course: 'idioma', catalog: languageCourse() },
  { profile: PROFILES.programmingLearner, course: 'programación', catalog: programmingCourse() },
  { profile: PROFILES.forgetful, course: 'idioma', catalog: languageCourse() },
  { profile: PROFILES.absent, course: 'idioma', catalog: languageCourse() },
];

console.log(`# Simulación de ${days} días · topes: ${config.load.newCap} nuevas, ${config.load.reviewCap} repasos, ${config.load.totalCap} en total por día\n`);
for (const run of runs) console.log(`${formatReport(simulate(run.profile, run.catalog, config, days), run.course)}\n`);
