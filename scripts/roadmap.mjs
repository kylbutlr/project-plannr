import {resolve} from 'node:path';
import {planningRun} from '../lib/planning-client.mjs';

const args = process.argv.slice(2);
if (args[0] !== '--repo' || !args[1]) {
  console.error('Usage: npm run roadmap -- --repo /absolute/project [board|backlog|show|claim|renew|release|note|checklist-add|checklist-edit|checklist-check|checklist-uncheck|checklist-remove]');
  process.exitCode = 1;
} else {
  try {console.log(JSON.stringify(await planningRun(args.slice(2), resolve(args[1], '.plannr/agent.json')), null, 2));}
  catch (error) {
    console.error(error.message.startsWith('Planning request failed') ? error.message : 'Planning access unavailable. Check the command and the ignored owner-only .plannr/agent.json file. See docs/project-onboarding.md.');
    process.exitCode = 1;
  }
}
