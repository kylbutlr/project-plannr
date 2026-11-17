// Credentials come only from the environment, never command arguments or payload labels.
import {randomUUID} from 'node:crypto';
import {agentCommand, agentResult} from './lib/agent-command.mjs';
const origin = process.env.PLANNR_AGENT_ORIGIN || `http://127.0.0.1:${process.env.PROJECT_PLANNR_PORT || 4205}`;
const url = new URL(origin);
if (url.origin !== origin || url.username || url.password || url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw Error('Use HTTPS or a loopback origin.');
const token = process.env.PLANNR_AGENT_TOKEN;
if (!token && process.env.PLANNR_MODE !== 'demo') throw Error('Set PLANNR_AGENT_TOKEN locally, or explicitly set PLANNR_MODE=demo for the disposable trial. Never paste credentials into chat.');
const command=agentCommand(process.argv.slice(2)),{path,method,body}=command;
try {
  const response = await fetch(origin + path, {method, headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}),
    ...(method!=='GET'?{'Idempotency-Key':randomUUID()}: {})}, body: body && JSON.stringify(body), signal: AbortSignal.timeout(20000)});
  const result=await response.json();console.log(JSON.stringify(response.ok?agentResult(command,result):result,null,2));if(!response.ok)process.exitCode=1;
} catch {console.error('Could not reach the workspace. Check its origin and connection. Credentials are not logged.'); process.exitCode = 1;}
