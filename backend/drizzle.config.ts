import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for drizzle-kit commands.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/db/schema/!(*.test).ts', './src/modules/ticket/schema.ts'],
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
});
