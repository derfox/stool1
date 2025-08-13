import { z } from "zod";
import { db } from "../helpers/db";
import { schema, OutputType } from "./entry_GET.schema";
import superjson from 'superjson';
import { startOfDay } from 'date-fns';
import { getServerUserSession } from "../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    const url = new URL(request.url);
    const dateString = url.searchParams.get('date');
    
    const validatedInput = schema.parse({ date: dateString });
    
    const entryDate = startOfDay(new Date(validatedInput.date));

    const entries = await db.selectFrom('stoolEntries')
      .selectAll()
      .where('entryDate', '=', entryDate)
      .where('userId', '=', user.id)
      .orderBy('timeLogged', 'desc')
      .execute();

    return new Response(superjson.stringify(entries satisfies OutputType), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error fetching stool entry:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    const status = error?.constructor?.name === 'NotAuthenticatedError' ? 401 : (error instanceof z.ZodError ? 400 : 500);
    return new Response(superjson.stringify({ error: `Failed to fetch stool entry: ${errorMessage}` }), { status });
  }
}