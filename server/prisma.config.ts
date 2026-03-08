// @ts-nocheck
import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';

// Força a leitura do arquivo .env que está na raiz da pasta server
dotenv.config(); 

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});