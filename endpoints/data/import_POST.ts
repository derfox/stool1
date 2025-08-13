import { db } from "../../helpers/db";
import { schema, StoolEntryImportSchema, OutputType } from "./import_POST.schema";
import superjson from 'superjson';
import { z } from "zod";
import { parse as parseCsv, CastingContext } from 'csv-parse/sync';
import { getServerUserSession } from "../../helpers/getServerUserSession";

async function parseFileContent(file: File): Promise<z.infer<typeof StoolEntryImportSchema>[]> {
    const content = await file.text();
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
        try {
            const data = JSON.parse(content);
            // Ensure data is an array before parsing
            if (!Array.isArray(data)) {
                throw new Error("JSON content is not an array.");
            }
            return z.array(StoolEntryImportSchema).parse(data);
        } catch (e) {
            throw new Error(`Invalid JSON file: ${e instanceof Error ? e.message : 'Unknown parsing error'}`);
        }
    } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        try {
            const records = parseCsv(content, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                cast: (value: string, context: CastingContext) => {
                    // Auto-casting for numbers and booleans can be tricky.
                    // We'll let Zod handle the type coercion from strings.
                    if (context.column === 'bristolScale' || context.column === 'frequency') {
                        const num = Number(value);
                        return isNaN(num) ? value : num;
                    }
                    return value;
                }
            });
            return z.array(StoolEntryImportSchema).parse(records);
        } catch (e) {
            throw new Error(`Invalid CSV file: ${e instanceof Error ? e.message : 'Unknown parsing error'}`);
        }
    } else {
        throw new Error("Unsupported file type. Please upload a .json or .csv file.");
    }
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      throw new Error("No file uploaded or invalid form data.");
    }

    const parsedEntries = await parseFileContent(file);

    if (parsedEntries.length === 0) {
        return new Response(superjson.stringify({
            success: true,
            message: "File was empty or contained no valid entries.",
            importedCount: 0,
            skippedCount: 0,
        } satisfies OutputType));
    }

    let importedCount = 0;
    let skippedCount = 0;

    // Use a transaction to ensure all or nothing is inserted
    await db.transaction().execute(async (trx) => {
        for (const entry of parsedEntries) {
            // Gracefully handle duplicates by checking for an existing entry
            // on the same date for this user. This is a simple check; a more robust solution
            // might check for more fields or use an ID if provided.
            const existingEntry = await trx.selectFrom('stoolEntries')
                .select('id')
                .where('entryDate', '=', new Date(entry.entryDate))
                .where('userId', '=', user.id)
                .executeTakeFirst();

            if (existingEntry) {
                skippedCount++;
                continue;
            }

            await trx.insertInto('stoolEntries').values({
                ...entry,
                entryDate: new Date(entry.entryDate),
                timeLogged: entry.timeLogged ? new Date(entry.timeLogged) : null,
                userId: user.id,
            }).execute();
            importedCount++;
        }
    });

    const response: OutputType = {
        success: true,
        message: `Import successful. Imported ${importedCount} new entries and skipped ${skippedCount} duplicates.`,
        importedCount,
        skippedCount,
    };

    return new Response(superjson.stringify(response));

  } catch (error) {
    console.error("Error importing data:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    const status = error?.constructor?.name === 'NotAuthenticatedError' ? 401 : 400;
    return new Response(superjson.stringify({ error: `Failed to import data: ${errorMessage}` }), { 
        status,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}