import { z } from "zod";
import superjson from 'superjson';
import { type Selectable } from 'kysely';
import { type StoolEntries } from '../helpers/schema';

// No input schema needed for fetching all entries
export const schema = z.object({});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<StoolEntries>[];

export const getEntries = async (init?: RequestInit): Promise<OutputType> => {
  const result = await fetch(`/_api/entries`, {
    method: "GET",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!result.ok) {
        const errorObject = superjson.parse(await result.text()) as any;
    throw new Error(errorObject.error || 'Unknown error');
  }
  return superjson.parse<OutputType>(await result.text());
};