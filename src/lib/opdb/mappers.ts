import { z } from "zod";

import {
  type OpdbMachineDetails,
  type OpdbMachineDetailsApi,
  type OpdbSearchApiEntry,
  type OpdbSearchResult,
} from "~/lib/opdb/types";

const opdbYearObjectSchema = z
  .object({
    value: z.unknown().optional(),
    year: z.unknown().optional(),
  })
  .passthrough();

const readYearFromObject = (value: unknown): number | null => {
  const parsed = opdbYearObjectSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  const nested = parsed.data.value ?? parsed.data.year;
  return coerceOpdbYear(nested);
};

export const coerceOpdbYear = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const match = /\d{4}/u.exec(value);
    if (!match) {
      return null;
    }

    const parsed = Number.parseInt(match[0], 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return readYearFromObject(value);
};

const firstNonEmpty = (...values: (string | undefined)[]): string | null => {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  return null;
};

export const formatOpdbModelLabel = ({
  title,
  manufacturer,
  year,
}: {
  title: string;
  manufacturer: string | null;
  year: number | null;
}): string => {
  const details: string[] = [];
  if (manufacturer) {
    details.push(manufacturer);
  }
  if (year !== null) {
    details.push(String(year));
  }

  if (details.length === 0) {
    return title;
  }

  return `${title} (${details.join(", ")})`;
};

export const mapOpdbSearchEntry = (
  entry: OpdbSearchApiEntry
): OpdbSearchResult => {
  const title =
    firstNonEmpty(entry.title, entry.name, entry.text) ?? "Unknown Model";
  const manufacturer =
    typeof entry.manufacturer === "string" && entry.manufacturer.trim().length
      ? entry.manufacturer.trim()
      : null;
  const year = coerceOpdbYear(entry.year);

  return {
    id: entry.id,
    title,
    manufacturer,
    year,
    label:
      firstNonEmpty(entry.text) ??
      formatOpdbModelLabel({ title, manufacturer, year }),
  };
};

const firstImageUrl = (machine: OpdbMachineDetailsApi): string | null => {
  const preferred = firstNonEmpty(
    machine.playfield_image ?? undefined,
    machine.backglass_image ?? undefined,
    machine.cabinet_image ?? undefined
  );

  if (preferred) {
    return preferred;
  }

  const firstImage = machine.images?.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0
  );

  return firstImage ?? null;
};

export const mapOpdbMachineDetails = (
  machine: OpdbMachineDetailsApi
): OpdbMachineDetails => {
  const title =
    firstNonEmpty(machine.title, machine.name, machine.text) ?? machine.id;
  const manufacturer =
    typeof machine.manufacturer === "string" &&
    machine.manufacturer.trim().length > 0
      ? machine.manufacturer.trim()
      : null;

  return {
    id: machine.id,
    title,
    manufacturer,
    year: coerceOpdbYear(machine.year),
    imageUrl: firstImageUrl(machine),
    machineType:
      firstNonEmpty(
        machine.machine_type ?? undefined,
        machine.type ?? undefined
      ) ?? null,
  };
};
