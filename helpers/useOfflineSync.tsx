import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOnlineStatus } from './useOnlineStatus';
import {
  getSyncQueue,
  saveSyncQueue,
  getOfflineEntries,
  saveOfflineEntries,
  type SyncOperation,
  type OfflineStoolEntry,
} from './offlineStorage';
import { useCreateStoolEntry, useUpdateStoolEntry, useDeleteStoolEntry } from './useStoolEntries';
import { getEntries } from '../endpoints/entries_GET.schema';
import { toast } from 'sonner';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export const useOfflineSync = () => {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const createMutation = useCreateStoolEntry();
  const updateMutation = useUpdateStoolEntry();
  const deleteMutation = useDeleteStoolEntry();

  const sync = useCallback(async () => {
    if (!isOnline || syncStatus === 'syncing') {
      return;
    }

    setSyncStatus('syncing');
    toast.info('Syncing data with server...');

    try {
      // Step 1: Fetch latest server state
      const serverEntries = await getEntries();
      const localEntries = getOfflineEntries();
      const queue = getSyncQueue();

      // Step 2: Process the sync queue
      const remainingOps: SyncOperation[] = [];
      for (const op of queue) {
        try {
          switch (op.type) {
            case 'CREATE':
              // Remove timeLogged field as it's not expected by the CREATE endpoint
              const { timeLogged, ...createPayload } = op.payload;
              await createMutation.mutateAsync(createPayload);
              break;
            case 'UPDATE':
              // UPDATE payload already includes the required id field
              await updateMutation.mutateAsync(op.payload);
              break;
            case 'DELETE':
              // DELETE payload already includes both id and entryDate
              await deleteMutation.mutateAsync(op.payload);
              break;
          }
        } catch (error) {
          console.error(`Failed to sync operation ${op.type} for ${op.clientId}:`, error);
          remainingOps.push(op); // Keep failed operations in the queue
        }
      }
      saveSyncQueue(remainingOps);

      // Step 3: Re-fetch server data after our mutations to get the final state
      const finalServerEntries = await getEntries();

      // Step 4: Reconcile local data with final server state
      // Server is the source of truth. We add a `clientId` to server entries
      // if they match any of our local entries to maintain local relationships.
      const reconciledEntries: OfflineStoolEntry[] = finalServerEntries.map(serverEntry => {
        const localMatch = localEntries.find(local => local.id === serverEntry.id);
        return {
          ...serverEntry,
          clientId: localMatch?.clientId || `server-${serverEntry.id}`,
        };
      });

      saveOfflineEntries(reconciledEntries);

      // Step 5: Invalidate queries to refresh UI
      await queryClient.invalidateQueries();

      setSyncStatus('success');
      setLastSync(new Date());
      if (remainingOps.length > 0) {
        toast.warning(`${remainingOps.length} operations failed to sync. They will be retried later.`);
      } else {
        toast.success('Data synced successfully!');
      }
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      toast.error(`Sync failed: ${errorMessage}`);
    }
  }, [isOnline, syncStatus, queryClient, createMutation, updateMutation, deleteMutation]);

  useEffect(() => {
    if (isOnline) {
      const queue = getSyncQueue();
      if (queue.length > 0) {
        console.log(`Online status detected with ${queue.length} items in sync queue. Starting sync.`);
        sync();
      }
    }
  }, [isOnline, sync]);

  return { sync, syncStatus, lastSync, pendingOperations: getSyncQueue().length };
};

