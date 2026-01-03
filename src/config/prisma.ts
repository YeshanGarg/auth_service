import { PrismaClient } from "../generated/prisma/client.js";

import { PrismaPg } from '@prisma/adapter-pg';
 
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

// Use a global variable to maintain a single instance across hot reloads
export const prisma = globalForPrisma.prisma || new PrismaClient({adapter});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}