import { z } from "zod";
import superjson from 'superjson';

// This schema validates the structure of a single entry being imported.
// It's more lenient with types (e.g., dates as strings) to accommodate file parsing.
export const StoolEntryImportSchema = z.object({
  entryDate: z.string().datetime(),
  bristolScale: z.number().int().min(0).max(7),
  frequency: z.number().int().min(1).optional().default(1),
  notes: z.string().nullable().optional(),
  timeLogged: z.string().datetime().nullable().optional(),
}).strip(); // Use .strip() to remove extra fields from imported objects

// The frontend will send FormData, which we can't easily validate with Zod on the server side.
// We'll just define the expected structure for the client-side helper.
export const schema = z.object({
  file: z.instanceof(File, { message: "A file is required." })
    .refine(file => file.size > 0, "File cannot be empty.")
    .refine(
      file => ['text/csv', 'application/json'].includes(file.type) || file.name.endsWith('.csv') || file.name.endsWith('.json'),
      "Invalid file type. Please upload a CSV or JSON file."
    ),
});

export type InputType = z.infer<typeof schema>;

export type OutputType = {
  success: boolean;
  message: string;
  importedCount: number;
  skippedCount: number;
};

export const postImportData = async (body: FormData, init?: RequestInit): Promise<OutputType> => {
  // Frontend validation can be done before calling this, but the schema is here for reference.
  // We don't parse FormData with Zod here; we send it directly.
  
  const result = await fetch(`/_api/data/import`, {
    method: "POST",
    body: body,
    ...init,
    // Content-Type is set automatically by the browser for FormData
  });

  if (!result.ok) {
    const errorObject = superjson.parse(await result.text()) as { error?: string };
    throw new Error(errorObject.error || 'Unknown error during import.');
  }
  
  return superjson.parse<OutputType>(await result.text());
};