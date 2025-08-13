import { db } from "../../helpers/db";
import { schema } from "./export_GET.schema";
import { Selectable } from "kysely";
import { StoolEntries } from "../../helpers/schema";
import { getServerUserSession } from "../../helpers/getServerUserSession";

function escapeCsvField(field: any): string {
  if (field === null || typeof field === 'undefined') {
    return '';
  }
  const str = String(field);
  // Quote the field if it contains a comma, double quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    // Escape double quotes by doubling them
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function convertToCsv(data: Selectable<StoolEntries>[]): string {
  if (data.length === 0) {
    return "";
  }
  const headers = [
    'id', 'entryDate', 'bristolScale', 'frequency', 'notes', 'timeLogged', 'createdAt', 'updatedAt'
  ];
  const headerRow = headers.join(',');
  
  const rows = data.map(entry => {
    return headers.map(header => {
        const key = header as keyof Selectable<StoolEntries>;
        return escapeCsvField(entry[key]);
    }).join(',');
  });

  return [headerRow, ...rows].join('\n');
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    
    const url = new URL(request.url);
    const { format } = schema.parse({ format: url.searchParams.get('format') });

    const entries = await db.selectFrom('stoolEntries')
      .selectAll()
      .where('userId', '=', user.id)
      .orderBy('entryDate', 'asc')
      .execute();

    let body: string;
    let contentType: string;
    let filename: string;

    if (format === 'json') {
      body = JSON.stringify(entries, null, 2);
      contentType = 'application/json';
      filename = 'stool-entries.json';
    } else { // csv
      body = convertToCsv(entries);
      contentType = 'text/csv';
      filename = 'stool-entries.csv';
    }

    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error("Error exporting data:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    const status = error?.constructor?.name === 'NotAuthenticatedError' ? 401 : 400;
    return new Response(JSON.stringify({ error: `Failed to export data: ${errorMessage}` }), { 
        status,
        headers: { 'Content-Type': 'application/json' }
    });
  }
}