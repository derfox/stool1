import { z } from "zod";
import { db } from "../../helpers/db";
import { schema, OutputType } from "./delete_POST.schema";
import superjson from 'superjson';
import { startOfDay } from 'date-fns';
import { getServerUserSession } from "../../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    console.log(`Deleting entry with ID: ${validatedInput.id} for date: ${validatedInput.entryDate}`);

    const result = await db.deleteFrom('stoolEntries')
      .where('id', '=', validatedInput.id)
      .where('userId', '=', user.id)
      .executeTakeFirst();

    if (result.numDeletedRows === 0n) {
      return new Response(superjson.stringify({ error: 'No entry found with this ID to delete or unauthorized access.' }), { status: 404 });
    }

    return new Response(superjson.stringify({ success: true } satisfies OutputType), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error deleting stool entry:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    const status = error?.constructor?.name === 'NotAuthenticatedError' ? 401 : (error instanceof z.ZodError ? 400 : 500);
    return new Response(superjson.stringify({ error: `Failed to delete stool entry: ${errorMessage}` }), { status });
  }
}