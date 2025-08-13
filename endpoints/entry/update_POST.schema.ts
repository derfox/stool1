import { z } from "zod";
import superjson from 'superjson';
import { type Selectable } from 'kysely';
import { type StoolEntries } from '../../helpers/schema';

// Update schema requires ID as the primary identifier
export const schema = z.object({
  id: z.number().int().positive(),
  entryDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date string",
  }),
  bristolScale: z.number().int().min(0).max(7),
  frequency: z.number().int().min(1),
  notes: z.string().nullable().optional(),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<StoolEntries>;

export const postEntryUpdate = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const result = await fetch(`/_api/entry/update`, {
    method: "POST",
    body: superjson.stringify(validatedInput),
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