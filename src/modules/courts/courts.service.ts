import { Prisma, type PrismaClient } from '@prisma/client';
import { conflict, notFound } from '../../lib/errors.js';
import type { CourtInput } from './courts.schema.js';


/* =========================================================
   COURT CODE
   ========================================================= */

function toCourtCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'COURT';
}


/* =========================================================
   GENERATE UNIQUE COURT CODE
   ========================================================= */

async function generateUniqueCourtCode(
  prisma: PrismaClient,
  name: string,
): Promise<string> {
  const baseCode = toCourtCode(name);

  const existing = await prisma.court.findMany({
    where: {
      code: {
        startsWith: baseCode,
      },
    },
    select: {
      code: true,
    },
  });

  // Use the base code if it doesn't exist yet
  if (!existing.some((entry) => entry.code === baseCode)) {
    return baseCode;
  }

  // Otherwise generate CODE-2, CODE-3, etc.
  let suffix = 2;
  let candidate = `${baseCode}-${suffix}`;

  while (existing.some((entry) => entry.code === candidate)) {
    suffix += 1;
    candidate = `${baseCode}-${suffix}`;
  }

  return candidate;
}


/* =========================================================
   LIST COURTS
   ========================================================= */

export async function listCourts(
  prisma: PrismaClient,
) {
  return prisma.court.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });
}


/* =========================================================
   CREATE COURT
   ========================================================= */

export async function createCourt(
  prisma: PrismaClient,
  input: CourtInput,
) {
  const trimmedName = input.name.trim();

  const duplicate = await prisma.court.findFirst({
    where: { name: { equals: trimmedName, mode: 'insensitive' } },
  });

  if (duplicate) {
    throw conflict(`A court named "${trimmedName}" already exists`);
  }

  const code = await generateUniqueCourtCode(prisma, trimmedName);

  return prisma.court.create({
    data: {
      name: trimmedName,
      code,
      isActive: input.isActive ?? true,
    },
  });
}


/* =========================================================
   UPDATE COURT
   ========================================================= */

export async function updateCourt(
  prisma: PrismaClient,
  id: string,
  input: Partial<CourtInput>,
) {
  // Check if the court exists
  const existing = await prisma.court.findUnique({
    where: {
      id,
    },
  });

  if (!existing) {
    throw notFound('Court not found');
  }

  /*
   * Prepare update data.
   */

  const updateData: {
    name?: string;
    code?: string;
    isActive?: boolean;
  } = {};


  /* ---------------------------------------------------------
     UPDATE NAME
     --------------------------------------------------------- */

  if (input.name !== undefined) {
    const trimmedName = input.name.trim();

    if (!trimmedName) {
      throw conflict('Court name cannot be empty.');
    }

    /*
     * Only regenerate the code when the name actually changes.
     */

    if (trimmedName !== existing.name) {
      const duplicate = await prisma.court.findFirst({
        where: {
          name: { equals: trimmedName, mode: 'insensitive' },
          NOT: { id },
        },
      });

      if (duplicate) {
        throw conflict(`A court named "${trimmedName}" already exists`);
      }

      updateData.name = trimmedName;

      updateData.code = await generateUniqueCourtCode(
        prisma,
        trimmedName,
      );
    }
  }


  /* ---------------------------------------------------------
     UPDATE ACTIVE STATUS
     --------------------------------------------------------- */

  if (input.isActive !== undefined) {
    updateData.isActive = input.isActive;
  }


  /* ---------------------------------------------------------
     SAVE CHANGES
     --------------------------------------------------------- */

  return prisma.court.update({
    where: {
      id,
    },

    data: updateData,
  });
}


/* =========================================================
   DELETE / REMOVE COURT
   ========================================================= */

export async function deleteCourt(
  prisma: PrismaClient,
  id: string,
) {
  // Check if the court exists
  const existing = await prisma.court.findUnique({
    where: {
      id,
    },
  });

  if (!existing) {
    throw notFound('Court not found');
  }


  try {
    /*
     * Permanently delete the court.
     */

    await prisma.court.delete({
      where: {
        id,
      },
    });

    return {
      message: 'Court removed successfully',
    };
  } catch (error) {

    /*
     * Prisma P2003 means the court is referenced
     * by another table, usually transactions.
     *
     * We don't delete the court because doing so could
     * break historical transaction records.
     */

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw conflict(
        'This court has existing transactions and cannot be deleted. Deactivate it instead.',
      );
    }

    throw error;
  }
}
