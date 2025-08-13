import { db } from "../helpers/db";
import { OutputType } from "./entries_GET.schema";
import superjson from 'superjson';
import { getServerUserSession } from "../helpers/getServerUserSession";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);

    const entries = await db.selectFrom('stoolEntries')
      .selectAll()
      .where('userId', '=', user.id)
      .orderBy('entryDate', 'desc')
      .execute();

    return new Response(superjson.stringify(entries satisfies OutputType), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Error fetching stool entries:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    const status = error?.constructor?.name === 'NotAuthenticatedError' ? 401 : 500;
    return new Response(superjson.stringify({ error: `Failed to fetch stool entries: ${errorMessage}` }), { status });
  }
}