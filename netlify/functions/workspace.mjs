import {configuration} from '../../lib/config.mjs';
import {postgresStore} from '../../lib/store.mjs';
import {apiApplication, bodyJSON, securityHeaders} from '../../lib/api.mjs';

export const config = {path: ['/api/*', '/auth/*']};

// Factory is the test seam. Production cannot select a store from request input.
export function netlifyApplication(settings, store) {
  if (settings.mode !== 'private' || !settings.secure || !settings.databaseUrl || !settings.authConfigured) throw Error('Netlify requires HTTPS, database storage and the workspace password.');
  const api = apiApplication(store, settings);
  return async (request, context) => {
    const url = new URL(request.url);
    if (url.origin !== settings.origin) return Response.json({error: 'Use the configured Project Plannr origin.'}, {status: 403, headers: securityHeaders});
    const headers = Object.fromEntries(request.headers);
    const result = await api({path: url.pathname, query: url.searchParams, method: request.method, headers,
      body: max => bodyJSON(request.body, headers, max), ip: context?.ip});
    return Response.json(result.body, {status: result.status, headers: {...securityHeaders, ...result.headers}});
  };
}

let handle;
export default async (request, context) => {
  try {
    if (!handle) {
      const settings = configuration();
      // Reject local/demo configuration before creating any pool or touching data.
      if (settings.mode !== 'private' || !settings.secure || !settings.databaseUrl || !settings.authConfigured) throw Error('Hosted setup is incomplete.');
      handle = netlifyApplication(settings, postgresStore(settings.databaseUrl));
    }
    return await handle(request, context);
  } catch {
    return Response.json({error: 'Hosted workspace setup is incomplete or unavailable. Check its server-side environment settings.'}, {status: 503, headers: securityHeaders});
  }
};
