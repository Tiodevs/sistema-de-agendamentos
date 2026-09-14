import { sweepE2eDatabase } from './helpers/db';

export default async function globalTeardown() {
  await sweepE2eDatabase('all');
}
