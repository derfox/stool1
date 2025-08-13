import { z } from "zod";

export const schema = z.object({
  format: z.enum(['csv', 'json']),
});

export type InputType = z.infer<typeof schema>;

// Output is a file blob, not JSON, so no specific type is defined here.
// The client helper will handle the response as a blob.
export type OutputType = Blob;

export const getExportData = async (body: InputType, init?: RequestInit): Promise<OutputType> => {
  const validatedInput = schema.parse(body);
  const params = new URLSearchParams({ format: validatedInput.format });
  
  const result = await fetch(`/_api/data/export?${params.toString()}`, {
    method: "GET",
    ...init,
  });

  if (!result.ok) {
    // Try to parse error as JSON, but fall back to text
    try {
        const errorObject = await result.json();
        throw new Error(errorObject.error || 'Unknown error during export.');
    } catch (e) {
        throw new Error(await result.text());
    }
  }

  return result.blob();
};