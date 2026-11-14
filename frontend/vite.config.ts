import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const sharedFacilityMap: Record<string, string[]> = {};
const sharedScheduleWeeks: Record<
  string,
  {
    monday: string;
    closed: boolean;
    rows: Array<{
      assignment: {
        id: string;
        staffId: string;
        date: string;
        shift: string;
        cancelled?: boolean;
      };
      published: boolean;
      fullName: string;
      facility: string;
      facilityId: string;
      departmentId: string;
    }>;
  }
> = {};

type SimpleReq = {
  method?: string;
  on?: (event: string, listener: (chunk?: unknown) => void) => void;
};

type SimpleRes = {
  statusCode?: number;
  setHeader: (name: string, value: string) => void;
  end: (data?: string) => void;
};

function readBody(req: SimpleReq): Promise<string> {
  return new Promise((resolve) => {
    if (!req.on) {
      resolve('');
      return;
    }
    let body = '';
    req.on('data', (chunk) => {
      body += String(chunk ?? '');
    });
    req.on('end', () => {
      resolve(body);
    });
  });
}

function departmentAndScheduleSyncPlugin(): Plugin {
  return {
    name: 'department-and-schedule-sync',
    configureServer(server) {
      server.middlewares.use('/api/department-facilities-map', (req, res, next) => {
        const sReq = req as unknown as SimpleReq;
        const sRes = res as unknown as SimpleRes;

        if (sReq.method === 'GET') {
          sRes.setHeader('Content-Type', 'application/json');
          sRes.end(JSON.stringify(sharedFacilityMap));
          return;
        }
        if (sReq.method === 'POST') {
          void readBody(sReq).then((body) => {
            try {
              const payload = JSON.parse(body || '{}') as {
                departmentId?: string;
                facilityIds?: string[];
              };
              if (payload.departmentId && Array.isArray(payload.facilityIds)) {
                sharedFacilityMap[payload.departmentId] = payload.facilityIds;
              }
              sRes.setHeader('Content-Type', 'application/json');
              sRes.end(JSON.stringify(sharedFacilityMap));
            } catch {
              sRes.statusCode = 400;
              sRes.end(JSON.stringify({ message: 'Invalid JSON' }));
            }
          });
          return;
        }
        next();
      });

      server.middlewares.use('/api/shared-schedule-cache', (req, res, next) => {
        const sReq = req as unknown as SimpleReq;
        const sRes = res as unknown as SimpleRes;

        if (sReq.method === 'GET') {
          sRes.setHeader('Content-Type', 'application/json');
          sRes.end(JSON.stringify(sharedScheduleWeeks));
          return;
        }
        if (sReq.method === 'POST') {
          void readBody(sReq).then((body) => {
            try {
              const payload = JSON.parse(body || '{}') as {
                monday?: string;
                closed?: boolean;
                rows?: Array<{
                  assignment: {
                    id: string;
                    staffId: string;
                    date: string;
                    shift: string;
                    cancelled?: boolean;
                  };
                  published: boolean;
                  fullName: string;
                  facility: string;
                  facilityId: string;
                  departmentId: string;
                }>;
              };
              if (payload.monday && Array.isArray(payload.rows)) {
                sharedScheduleWeeks[payload.monday] = {
                  monday: payload.monday,
                  closed: Boolean(payload.closed),
                  rows: payload.rows,
                };
              }
              sRes.setHeader('Content-Type', 'application/json');
              sRes.end(JSON.stringify({ ok: true }));
            } catch {
              sRes.statusCode = 400;
              sRes.end(JSON.stringify({ message: 'Invalid JSON' }));
            }
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), departmentAndScheduleSyncPlugin()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://localhost:5100',
          changeOrigin: true,
        },
      },
    },
    preview: { port: 5173, strictPort: true },
  };
});
