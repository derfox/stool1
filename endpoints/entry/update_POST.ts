import { z } from "zod";
import { db } from "../../helpers/db";
import { schema, OutputType } from "./update_POST.schema";
import superjson from 'superjson';
import { startOfDay } from 'date-fns';
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    const entryDate = startOfDay(new Date(validatedInput.entryDate));

    const updatedEntry = await db.updateTable('stoolEntries')
      .set({
        entryDate: entryDate,
        bristolScale: validatedInput.bristolScale,
        frequency: validatedInput.frequency,
        notes: validatedInput.notes,
        updatedAt: new Date(),
      })
      .where('id', '=', validatedInput.id)
      .where('userId', '=', user.id)
      .returningAll()
      .executeTakeFirst();

    if (!updatedEntry) {
      return new Response(superjson.stringify({ error: 'No entry found for this ID to update or unauthorized access.' }), { status: 404 });
    }

    return new Response(superjson.stringify(updatedEntry satisfies OutputType), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error updating stool entry:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    const status = error?.constructor?.name === 'NotAuthenticatedError' ? 401 : (error instanceof z.ZodError ? 400 : 500);
    return new Response(superjson.stringify({ error: `Failed to update stool entry: ${errorMessage}` }), { status });
  }
}