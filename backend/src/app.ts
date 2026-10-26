import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/authRoutes';
import masterRoutes from './routes/masterRoutes';
import employeeRoutes from './routes/employeeRoutes';
import assetRoutes from './routes/assetRoutes';
import assetCustodianRoutes from './routes/assetCustodianRoutes';
import ticketRoutes from './routes/ticketRoutes';
import helpdeskRoutes from './modules/ticket/routes';
import licenseRoutes from './routes/licenseRoutes';
import infrastructureRoutes from './routes/infrastructureRoutes';
import hardwareAuditRoutes from './routes/hardwareAuditRoutes';
import roleRoutes from './routes/roleRoutes';
import userRoutes from './routes/userRoutes';
import leaveRoutes from './routes/leaveRoutes';
import systemSettingRoutes from './routes/systemSettingRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import mobileAttendanceRoutes from './routes/mobileAttendanceRoutes';
import hrActivityRoutes from './routes/hrActivityRoutes';
import goodsRequestRoutes from './routes/goodsRequestRoutes';
import { checkDatabase } from './db';

import { loadEnv } from './config/env';

export interface AppOptions {
  databaseCheck?: () => Promise<void>;
  corsOptions?: cors.CorsOptions;
}

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();
  const dbCheck = options.databaseCheck || checkDatabase;

  let corsConfig = options.corsOptions;
  if (!corsConfig) {
    let allowedOrigins: string[] | undefined;
    try {
      const env = loadEnv();
      allowedOrigins = env.corsAllowedOrigins;
    } catch {
      // Fallback for isolated unit tests
    }

    corsConfig = {
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, same-origin Nginx reverse proxy)
        if (!origin) {
          return callback(null, true);
        }
        if (process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        if (allowedOrigins && allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS policy'));
      },
      credentials: true,
    };
  }

  app.use(helmet());
  app.use(cors(corsConfig));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Health and readiness endpoints
  app.get('/health/live', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/health/ready', async (_req, res) => {
    try {
      await dbCheck();
      res.status(200).json({ status: 'READY' });
    } catch {
      res.status(503).json({ status: 'NOT_READY' });
    }
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // REST API Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/master', masterRoutes);
  app.use('/api/v1/employees', employeeRoutes);
  app.use('/api/v1/assets', assetRoutes);
  app.use('/api/v1/asset-custodians', assetCustodianRoutes);
  app.use('/api/v1/tickets', ticketRoutes);
  app.use('/api/v1/helpdesk', helpdeskRoutes);
  app.use('/api/v1/licenses', licenseRoutes);
  app.use('/api/v1/infrastructure', infrastructureRoutes);
  app.use('/api/v1/hardware-audits', hardwareAuditRoutes);
  app.use('/api/v1/roles', roleRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/leaves', leaveRoutes);
  app.use('/api/leaves', leaveRoutes);
  app.use('/api/v1/system/settings', systemSettingRoutes);
  app.use('/api/v1/settings', systemSettingRoutes);
  app.use('/api/v1/attendance/mobile', mobileAttendanceRoutes);
  app.use('/api/attendance/mobile', mobileAttendanceRoutes);
  app.use('/api/v1/attendance', attendanceRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/v1/hr/activities', hrActivityRoutes);
  app.use('/api/v1/ga/requests', goodsRequestRoutes);
  app.use('/api/hr/activities', hrActivityRoutes);

  return app;
}

export default createApp;
