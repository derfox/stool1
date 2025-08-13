import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getEntries } from '../endpoints/entries_GET.schema';
import { getEntry } from '../endpoints/entry_GET.schema';
import { postEntry, type InputType as CreateInputType } from '../endpoints/entry_POST.schema';
import { postEntryUpdate, type InputType as UpdateInputType } from '../endpoints/entry/update_POST.schema';
import { postEntryDelete, type InputType as DeleteInputType } from '../endpoints/entry/delete_POST.schema';
import { formatISO, startOfDay, isValid, format } from 'date-fns';
import { useOnlineStatus } from './useOnlineStatus';
import { 
  getOfflineEntries, 
  getOfflineEntryByDate, 
  createOfflineEntry, 
  updateOfflineEntry, 
  deleteOfflineEntry,
  type OfflineStoolEntry 
} from './offlineStorage';
import { type Selectable } from 'kysely';
import { type StoolEntries } from './schema';
import { useAuth } from './useAuth';

const stoolEntriesQueryKey = ['stoolEntries'];
const stoolEntryQueryKey = (date: Date | string) => {
  const parsedDate = new Date(date);
  if (!isValid(parsedDate)) {
    return ['stoolEntry', 'invalid-date'];
  }
  return ['stoolEntry', formatISO(startOfDay(parsedDate), { representation: 'date' })];
};

/**
 * Fetches all stool entries.
 * When offline, returns cached data from localStorage.
 */
export const useStoolEntries = () => {
  const isOnline = useOnlineStatus();
  
  return useQuery({
    queryKey: stoolEntriesQueryKey,
    queryFn: async () => {
      if (!isOnline) {
        console.log('Fetching entries from offline storage');
        return getOfflineEntries();
      }
      return getEntries();
    },
    placeholderData: (previousData) => previousData,
  });
};

/**
 * Fetches stool entries for a specific date as an array.
 * When offline, checks localStorage first.
 * @param date The date for which to fetch the entries. Can be a Date object or an ISO string.
 * @param options Optional query options.
 */
export const useStoolEntry = (date: Date | string | null | undefined, { enabled = true } = {}) => {
  const isDateValid = !!date && isValid(new Date(date));
  const isOnline = useOnlineStatus();
  
  return useQuery({
    queryKey: isDateValid ? stoolEntryQueryKey(date!) : ['stoolEntry', 'invalid-date'],
    queryFn: async (): Promise<Selectable<StoolEntries>[]> => {
      if (!isDateValid) return [];
      
      if (!isOnline) {
        console.log('Fetching entry from offline storage for date:', date);
        const entry = getOfflineEntryByDate(new Date(date!));
        return entry ? [entry] : [];
      }
      
      const entries = await getEntry({ date: format(new Date(date!), 'yyyy-MM-dd') });
      return entries;
    },
    enabled: isDateValid && enabled,
    placeholderData: (previousData) => previousData,
  });
};

/**
 * Provides a mutation for creating a new stool entry.
 * When offline, creates entry in localStorage and queues for sync.
 * Uses optimistic updates for immediate UI feedback.
 */
export const useCreateStoolEntry = () => {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { authState } = useAuth();
  
  return useMutation({
    mutationFn: async (newEntry: CreateInputType) => {
      const userId = authState.type === 'authenticated' ? authState.user.id : null;
      
      if (!isOnline) {
        console.log('Creating entry offline');
        const offlineEntry = createOfflineEntry({
          entryDate: new Date(newEntry.entryDate),
          bristolScale: newEntry.bristolScale,
          frequency: newEntry.frequency,
          notes: newEntry.notes || null,
          userId: userId,
        });
        // Convert OfflineStoolEntry to match expected return type
        return offlineEntry as Selectable<StoolEntries>;
      }
      
      return postEntry(newEntry);
    },
    onMutate: async (newEntry) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: stoolEntriesQueryKey });
      const entryDateKey = stoolEntryQueryKey(newEntry.entryDate);
      await queryClient.cancelQueries({ queryKey: entryDateKey });

      // Snapshot previous values
      const previousEntries = queryClient.getQueryData(stoolEntriesQueryKey);
      const previousEntry = queryClient.getQueryData(entryDateKey);

      // Optimistically update cache
      const userId = authState.type === 'authenticated' ? authState.user.id : null;
      const optimisticEntry: Selectable<StoolEntries> = {
        id: -1, // Temporary ID
        entryDate: new Date(newEntry.entryDate),
        bristolScale: newEntry.bristolScale,
        frequency: newEntry.frequency,
        notes: newEntry.notes || null,
        timeLogged: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: userId,
      };

      // Append to existing entries for the date instead of replacing
      queryClient.setQueryData(entryDateKey, (prev: Selectable<StoolEntries>[] | undefined) => [
        ...(prev ?? []), 
        optimisticEntry
      ]);
      
      // Append to global entries cache instead of replacing
      if (Array.isArray(previousEntries)) {
        queryClient.setQueryData(stoolEntriesQueryKey, [
          ...(previousEntries ?? []), 
          optimisticEntry
        ]);
      }

      return { previousEntries, previousEntry, optimisticEntry };
    },
    onSuccess: (data, variables) => {
      const entryDateKey = stoolEntryQueryKey(variables.entryDate);
      // Replace the optimistic entry with the real one
      queryClient.setQueryData(entryDateKey, (prev: Selectable<StoolEntries>[] | undefined) => 
        (prev ?? []).map(entry => entry.id === -1 ? data : entry)
      );
      queryClient.invalidateQueries({ queryKey: stoolEntriesQueryKey });
    },
    onError: (err, variables, context) => {
      // Rollback optimistic updates on error
      if (context?.previousEntries) {
        queryClient.setQueryData(stoolEntriesQueryKey, context.previousEntries);
      }
      if (context?.previousEntry !== undefined) {
        const entryDateKey = stoolEntryQueryKey(variables.entryDate);
        queryClient.setQueryData(entryDateKey, context.previousEntry);
      }
    },
  });
};

/**
 * Provides a mutation for updating an existing stool entry.
 * When offline, updates entry in localStorage and queues for sync.
 * Uses optimistic updates for immediate UI feedback.
 */
export const useUpdateStoolEntry = () => {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { authState } = useAuth();
  
  return useMutation({
    mutationFn: async (updatedEntry: UpdateInputType) => {
      if (!isOnline) {
        console.log('Updating entry offline');
        const offlineEntry = getOfflineEntryByDate(new Date(updatedEntry.entryDate));
        if (!offlineEntry) {
          throw new Error('Entry not found for offline update');
        }
        
        const updated = updateOfflineEntry({
          ...offlineEntry,
          bristolScale: updatedEntry.bristolScale,
          frequency: updatedEntry.frequency,
          notes: updatedEntry.notes || null,
        });
        
        if (!updated) {
          throw new Error('Failed to update offline entry');
        }
        
        return updated as Selectable<StoolEntries>;
      }
      
      return postEntryUpdate(updatedEntry);
    },
    onMutate: async (updatedEntry) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: stoolEntriesQueryKey });
      const entryDateKey = stoolEntryQueryKey(updatedEntry.entryDate);
      await queryClient.cancelQueries({ queryKey: entryDateKey });

      // Snapshot previous values
      const previousEntries = queryClient.getQueryData(stoolEntriesQueryKey);
      const previousEntry = queryClient.getQueryData(entryDateKey);

      // Optimistically update cache by ID
      queryClient.setQueryData(entryDateKey, (prev: Selectable<StoolEntries>[] | undefined) => 
        (prev ?? []).map(entry => 
          entry.id === updatedEntry.id 
            ? {
                ...entry,
                bristolScale: updatedEntry.bristolScale,
                frequency: updatedEntry.frequency,
                notes: updatedEntry.notes || null,
                updatedAt: new Date(),
              }
            : entry
        )
      );
      
      // Update global entries cache by ID
      if (Array.isArray(previousEntries)) {
        queryClient.setQueryData(stoolEntriesQueryKey, (prev: Selectable<StoolEntries>[] | undefined) =>
          (prev ?? []).map(entry => 
            entry.id === updatedEntry.id 
              ? {
                  ...entry,
                  bristolScale: updatedEntry.bristolScale,
                  frequency: updatedEntry.frequency,
                  notes: updatedEntry.notes || null,
                  updatedAt: new Date(),
                }
              : entry
          )
        );
      }

      return { previousEntries, previousEntry };
    },
    onSuccess: (data, variables) => {
      const entryDateKey = stoolEntryQueryKey(variables.entryDate);
      // Update with real data by ID
      queryClient.setQueryData(entryDateKey, (prev: Selectable<StoolEntries>[] | undefined) =>
        (prev ?? []).map(entry => entry.id === variables.id ? data : entry)
      );
      queryClient.invalidateQueries({ queryKey: stoolEntriesQueryKey });
    },
    onError: (err, variables, context) => {
      // Rollback optimistic updates on error
      if (context?.previousEntries) {
        queryClient.setQueryData(stoolEntriesQueryKey, context.previousEntries);
      }
      if (context?.previousEntry !== undefined) {
        const entryDateKey = stoolEntryQueryKey(variables.entryDate);
        queryClient.setQueryData(entryDateKey, context.previousEntry);
      }
    },
  });
};

/**
 * Provides a mutation for deleting an existing stool entry.
 * When offline, deletes entry from localStorage and queues for sync.
 * Uses optimistic updates for immediate UI feedback.
 */
export const useDeleteStoolEntry = () => {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const { authState } = useAuth();
  
  return useMutation({
    mutationFn: async (entryToDelete: DeleteInputType) => {
      if (!isOnline) {
        console.log('Deleting entry offline');
        const offlineEntry = getOfflineEntryByDate(new Date(entryToDelete.entryDate));
        if (!offlineEntry) {
          throw new Error('Entry not found for offline deletion');
        }
        
        deleteOfflineEntry(offlineEntry.clientId);
        return { success: true };
      }
      
      return postEntryDelete(entryToDelete);
    },
    onMutate: async (entryToDelete) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: stoolEntriesQueryKey });
      const entryDateKey = stoolEntryQueryKey(entryToDelete.entryDate);
      await queryClient.cancelQueries({ queryKey: entryDateKey });

      // Snapshot previous values
      const previousEntries = queryClient.getQueryData(stoolEntriesQueryKey);
      const previousEntry = queryClient.getQueryData(entryDateKey);

      // Optimistically update cache - delete only specific entry by ID
      queryClient.setQueryData(entryDateKey, (prev: Selectable<StoolEntries>[] | undefined) =>
        (prev ?? []).filter(entry => entry.id !== entryToDelete.id)
      );
      
      // Delete from global entries cache by ID
      if (Array.isArray(previousEntries)) {
        queryClient.setQueryData(stoolEntriesQueryKey, (prev: Selectable<StoolEntries>[] | undefined) =>
          (prev ?? []).filter(entry => entry.id !== entryToDelete.id)
        );
      }

      return { previousEntries, previousEntry };
    },
    onSuccess: (_, variables) => {
      const entryDateKey = stoolEntryQueryKey(variables.entryDate);
      // Confirm deletion by filtering out the entry by ID
      queryClient.setQueryData(entryDateKey, (prev: Selectable<StoolEntries>[] | undefined) =>
        (prev ?? []).filter(entry => entry.id !== variables.id)
      );
      queryClient.invalidateQueries({ queryKey: stoolEntriesQueryKey });
    },
    onError: (err, variables, context) => {
      // Rollback optimistic updates on error
      if (context?.previousEntries) {
        queryClient.setQueryData(stoolEntriesQueryKey, context.previousEntries);
      }
      if (context?.previousEntry !== undefined) {
        const entryDateKey = stoolEntryQueryKey(variables.entryDate);
        queryClient.setQueryData(entryDateKey, context.previousEntry);
      }
    },
  });
};

// Helper function to check if two dates match (same day)
const isDateMatch = (date1: Date | string, date2: Date | string): boolean => {
  const d1 = startOfDay(new Date(date1));
  const d2 = startOfDay(new Date(date2));
  return d1.getTime() === d2.getTime();
};