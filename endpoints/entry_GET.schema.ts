import { z } from "zod";
import superjson from 'superjson';
import { type Selectable } from 'kysely';
import { type StoolEntries } from '../helpers/schema';

export const schema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date string",
  }),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = Selectable<StoolEntries>[];

export const getEntry = async (params: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(params);
  const searchParams = new URLSearchParams({ date: validatedInput.date });
  
  const result = await fetch(`/_api/entry?${searchParams.toString()}`, {
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