import superjson from 'superjson';
import { type Selectable } from 'kysely';
import { type StoolEntries } from './schema';
import { startOfDay, isEqual } from 'date-fns';

const ENTRIES_KEY = 'stool_entries';
const SYNC_QUEUE_KEY = 'stool_sync_queue';

// --- ID Generation ---

const generateId = (): string => {
  // Use crypto.randomUUID() if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older browsers using Math.random()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export type OfflineStoolEntry = Selectable<StoolEntries> & {
  clientId: string; // Always present for local identification
};

export type SyncOperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncOperation {
  type: SyncOperationType;
  payload: any; // This will be InputType from the respective endpoint schemas
  clientId: string; // To track the operation
  timestamp: number;
}

// --- Local Storage Access ---

const safeLocalStorageGet = (key: string): string | null => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage.getItem(key);
};

const safeLocalStorageSet = (key: string, value: string) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(key, value);
  }
};

// --- Entry Management ---

export const getOfflineEntries = (): OfflineStoolEntry[] => {
  const stored = safeLocalStorageGet(ENTRIES_KEY);
  return stored ? (superjson.parse<OfflineStoolEntry[]>(stored) || []) : [];
};

export const saveOfflineEntries = (entries: OfflineStoolEntry[]) => {
  safeLocalStorageSet(ENTRIES_KEY, superjson.stringify(entries));
};

export const getOfflineEntryByDate = (date: Date): OfflineStoolEntry | undefined => {
  const entries = getOfflineEntries();
  const targetDate = startOfDay(date);
  return entries.find(entry => isEqual(startOfDay(new Date(entry.entryDate)), targetDate));
};

// --- Sync Queue Management ---

export const getSyncQueue = (): SyncOperation[] => {
  const stored = safeLocalStorageGet(SYNC_QUEUE_KEY);
  return stored ? (superjson.parse<SyncOperation[]>(stored) || []) : [];
};

export const saveSyncQueue = (queue: SyncOperation[]) => {
  safeLocalStorageSet(SYNC_QUEUE_KEY, superjson.stringify(queue));
};

// --- Server ID Management ---

export const updateOfflineEntryWithServerId = (clientId: string, serverId: number): void => {
  const entries = getOfflineEntries();
  const entryIndex = entries.findIndex(e => e.clientId === clientId);
  
  if (entryIndex === -1) {
    console.error('Entry not found for server ID update:', clientId);
    return;
  }

  entries[entryIndex].id = serverId;
  saveOfflineEntries(entries);
  console.log('Updated entry with server ID:', clientId, '->', serverId);
};

// --- Offline CRUD Operations ---

export const createOfflineEntry = (entryData: Omit<OfflineStoolEntry, 'id' | 'clientId' | 'createdAt' | 'updatedAt' | 'timeLogged'>): OfflineStoolEntry => {
  const entries = getOfflineEntries();
  const queue = getSyncQueue();

  const newEntry: OfflineStoolEntry = {
    ...entryData,
    id: -1, // Temporary ID for local use
    clientId: generateId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    timeLogged: new Date(),
  };

  const newEntries = [...entries, newEntry];
  saveOfflineEntries(newEntries);

  const operation: SyncOperation = {
    type: 'CREATE',
    payload: {
      entryDate: newEntry.entryDate.toISOString(),
      bristolScale: newEntry.bristolScale,
      frequency: newEntry.frequency,
      notes: newEntry.notes,
      timeLogged: newEntry.timeLogged!.toISOString(),
      userId: newEntry.userId,
    },
    clientId: newEntry.clientId,
    timestamp: Date.now(),
  };
  saveSyncQueue([...queue, operation]);

  console.log('Created offline entry:', newEntry);
  return newEntry;
};

export const updateOfflineEntry = (entryData: Omit<OfflineStoolEntry, 'createdAt' | 'updatedAt'>): OfflineStoolEntry | null => {
  const entries = getOfflineEntries();
  let queue = getSyncQueue();

  const entryIndex = entries.findIndex(e => e.clientId === entryData.clientId);
  if (entryIndex === -1) {
    console.error('Entry not found for update:', entryData.clientId);
    return null;
  }

  const updatedEntry = { ...entries[entryIndex], ...entryData, updatedAt: new Date() };
  entries[entryIndex] = updatedEntry;
  saveOfflineEntries(entries);

  // If a CREATE operation for this entry is still in the queue, update its payload
  const existingCreateOpIndex = queue.findIndex(op => op.type === 'CREATE' && op.clientId === updatedEntry.clientId);
  if (existingCreateOpIndex > -1) {
    const createPayload = {
      entryDate: updatedEntry.entryDate.toISOString(),
      bristolScale: updatedEntry.bristolScale,
      frequency: updatedEntry.frequency,
      notes: updatedEntry.notes,
      timeLogged: updatedEntry.timeLogged?.toISOString() || new Date().toISOString(),
      userId: updatedEntry.userId,
    };
    queue[existingCreateOpIndex].payload = createPayload;
  } else if (updatedEntry.id > 0) {
    // Only create UPDATE operation for entries that have server IDs
    queue = queue.filter(op => !(op.type === 'UPDATE' && op.clientId === updatedEntry.clientId));
    const updatePayload = {
      id: updatedEntry.id,
      entryDate: updatedEntry.entryDate.toISOString(),
      bristolScale: updatedEntry.bristolScale,
      frequency: updatedEntry.frequency,
      notes: updatedEntry.notes,
      userId: updatedEntry.userId,
    };
    const operation: SyncOperation = {
      type: 'UPDATE',
      payload: updatePayload,
      clientId: updatedEntry.clientId,
      timestamp: Date.now(),
    };
    queue.push(operation);
  } else {
    console.warn('Cannot create UPDATE operation for entry without server ID:', updatedEntry.clientId);
  }

  saveSyncQueue(queue);
  console.log('Updated offline entry:', updatedEntry);
  return updatedEntry;
};

export const deleteOfflineEntry = (clientId: string): void => {
  let entries = getOfflineEntries();
  let queue = getSyncQueue();

  const entryToDelete = entries.find(e => e.clientId === clientId);
  if (!entryToDelete) {
    console.error('Entry not found for deletion:', clientId);
    return;
  }

  // Remove from local entries
  saveOfflineEntries(entries.filter(e => e.clientId !== clientId));

  // If it was a pending CREATE, just remove the entry and the create op
  const createOpIndex = queue.findIndex(op => op.type === 'CREATE' && op.clientId === clientId);
  if (createOpIndex > -1) {
    saveSyncQueue(queue.filter((_, index) => index !== createOpIndex));
    console.log('Cancelled pending create for entry:', clientId);
    return;
  }

  // Only add DELETE operation for entries that have server IDs
  if (entryToDelete.id > 0) {
    // Remove any pending UPDATE ops for this entry first
    queue = queue.filter(op => !(op.type === 'UPDATE' && op.clientId === clientId));
    const operation: SyncOperation = {
      type: 'DELETE',
      payload: { 
        id: entryToDelete.id,
        entryDate: entryToDelete.entryDate.toISOString() 
      },
      clientId: clientId,
      timestamp: Date.now(),
    };
    saveSyncQueue([...queue, operation]);
    console.log('Deleted offline entry:', clientId);
  } else {
    console.warn('Cannot create DELETE operation for entry without server ID:', clientId);
  }
};