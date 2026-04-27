import { readCurrentSprint, readLatestHandoff, readRunLog } from '../../memory/index.js';
import { latestSprint } from './sprint-service.js';

export async function getStatus(slug) {
  return {
    sprint: await latestSprint(slug),
    currentSprint: readCurrentSprint(slug),
    latestHandoff: readLatestHandoff(slug)
  };
}

export function getRunLog(slug) {
  return readRunLog(slug);
}
