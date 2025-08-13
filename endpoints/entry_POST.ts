import { z } from "zod";
import { db } from "../helpers/db";
import { schema, OutputType } from "./entry_POST.schema";
import superjson from 'superjson';
import { getServerUserSession } from "../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    const json = superjson.parse(await request.text());
    const validatedInput = schema.parse(json);

    const entryDate = new Date(validatedInput.entryDate);

    const newEntry = await db.insertInto('stoolEntries')
      .values({
        ...validatedInput,
        entryDate,
        userId: user.id,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return new Response(superjson.stringify(newEntry satisfies OutputType), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error creating stool entry:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    const status = error?.constructor?.name === 'NotAuthenticatedError' ? 401 : (error instanceof z.ZodError ? 400 : 500);
    return new Response(superjson.stringify({ error: `Failed to create stool entry: ${errorMessage}` }), { status });
  }
}