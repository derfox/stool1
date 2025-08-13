import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from '../components/Form';
import { z } from 'zod';
import { format, parse, isValid } from 'date-fns';
import { useStoolEntry, useCreateStoolEntry, useUpdateStoolEntry, useDeleteStoolEntry } from '../helpers/useStoolEntries';
import { Form, FormItem, FormLabel, FormControl, FormMessage } from '../components/Form';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { BristolScaleSelector } from '../components/BristolScaleSelector';
import { type BristolScale, getBristolScaleColorVar } from '../helpers/bristolScale';
import { ArrowLeft, Trash2, Edit2, Plus } from 'lucide-react';
import { type Selectable } from 'kysely';
import { type StoolEntries } from '../helpers/schema';
import styles from './log.$date.module.css';

const formSchema = z.object({
  bristolScale: z.number().int().min(0).max(7),
  frequency: z.coerce.number().int().min(1, "Frequency must be at least 1."),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type EditMode = 'add' | { type: 'edit'; entryId: number };

const PageSkeleton = () => (
  <div className={styles.container}>
    <Skeleton style={{ height: '2rem', width: '12rem', marginBottom: 'var(--spacing-8)' }} />
    <div className={styles.entriesList}>
      <Skeleton style={{ height: '8rem', width: '100%', marginBottom: 'var(--spacing-4)' }} />
      <Skeleton style={{ height: '8rem', width: '100%', marginBottom: 'var(--spacing-4)' }} />
    </div>
  </div>
);

const EntryCard = ({ 
  entry, 
  onEdit, 
  onDelete, 
  isDeleting 
}: { 
  entry: Selectable<StoolEntries>; 
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) => (
  <div className={styles.entryCard}>
    <div className={styles.entryHeader}>
      <div className={styles.entryTime}>
        {entry.timeLogged ? format(new Date(entry.timeLogged), 'h:mm a') : 'Unknown time'}
      </div>
      <div className={styles.entryActions}>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label="Edit entry"
        >
          <Edit2 size={14} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label="Delete entry"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
    <div className={styles.entryContent}>
      <div className={styles.entryScale}>
        <div 
          className={styles.scaleIndicator}
          style={{ backgroundColor: `var(${getBristolScaleColorVar(entry.bristolScale as BristolScale)})` }}
        >
          {entry.bristolScale}
        </div>
        <div className={styles.entryFrequency}>
          {entry.frequency} time{entry.frequency !== 1 ? 's' : ''}
        </div>
      </div>
      {entry.notes && (
        <div className={styles.entryNotes}>
          {entry.notes}
        </div>
      )}
    </div>
  </div>
);

export default function LogDatePage() {
  const { date: dateString } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState<EditMode>('add');
  const [showForm, setShowForm] = useState(false);
  
  // Validate date parameter early
  if (!dateString) {
    return <div className={styles.error}>Date parameter is required. Please use YYYY-MM-DD format.</div>;
  }
  
  const entryDate = parse(dateString, 'yyyy-MM-dd', new Date());
  const isValidDate = isValid(entryDate);

  const { data: entries = [], isFetching, error: fetchError } = useStoolEntry(entryDate, { enabled: isValidDate });
  const createMutation = useCreateStoolEntry();
  const updateMutation = useUpdateStoolEntry();
  const deleteMutation = useDeleteStoolEntry();

  const isMutating = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const form = useForm({
    schema: formSchema,
    defaultValues: {
      bristolScale: 4,
      frequency: 1,
      notes: '',
    },
  });

  const currentEntry = editMode !== 'add' 
    ? entries.find(entry => entry.id === editMode.entryId)
    : null;

  useEffect(() => {
    if (currentEntry && editMode !== 'add') {
      form.setValues({
        bristolScale: currentEntry.bristolScale,
        frequency: currentEntry.frequency,
        notes: currentEntry.notes || '',
      });
    } else {
      form.setValues({
        bristolScale: 4,
        frequency: 1,
        notes: '',
      });
    }
  }, [currentEntry, editMode, form.setValues]);

  if (!isValidDate) {
    return <div className={styles.error}>Invalid date format. Please use YYYY-MM-DD.</div>;
  }

  const handleAddNew = () => {
    setEditMode('add');
    setShowForm(true);
    form.setValues({
      bristolScale: 4,
      frequency: 1,
      notes: '',
    });
  };

  const handleEdit = (entry: Selectable<StoolEntries>) => {
    setEditMode({ type: 'edit', entryId: entry.id });
    setShowForm(true);
    form.setValues({
      bristolScale: entry.bristolScale,
      frequency: entry.frequency,
      notes: entry.notes || '',
    });
  };

  const handleDelete = (entry: Selectable<StoolEntries>) => {
    deleteMutation.mutate({ 
      id: entry.id,
      entryDate: format(entryDate, 'yyyy-MM-dd') 
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditMode('add');
    form.setValues({
      bristolScale: 4,
      frequency: 1,
      notes: '',
    });
  };

  const onSubmit = (values: FormValues) => {
    if (editMode !== 'add') {
      const updatePayload = {
        ...values,
        id: editMode.entryId,
        entryDate: format(entryDate, 'yyyy-MM-dd'),
      };
      updateMutation.mutate(updatePayload, { 
        onSuccess: () => {
          setShowForm(false);
          setEditMode('add');
        }
      });
    } else {
      const createPayload = {
        ...values,
        entryDate: format(entryDate, 'yyyy-MM-dd'),
      };
      createMutation.mutate(createPayload, { 
        onSuccess: () => {
          setShowForm(false);
          setEditMode('add');
        }
      });
    }
  };

  if (isFetching) {
    return <PageSkeleton />;
  }

  if (fetchError) {
    return <div className={styles.error}>Error loading entries: {fetchError.message}</div>;
  }

  const hasEntries = entries.length > 0;

  return (
    <>
      <Helmet>
        <title>Log for {format(entryDate, 'MMMM d, yyyy')} | Stool Tracker</title>
      </Helmet>
      <div className={styles.container}>
        <Link to="/" className={styles.backLink}>
          <ArrowLeft size={16} />
          Back to Calendar
        </Link>
        <h1 className={styles.title}>Log for {format(entryDate, 'MMMM d, yyyy')}</h1>

        {hasEntries && (
          <div className={styles.entriesList}>
            <h2 className={styles.entriesTitle}>Today's Entries</h2>
            {entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onEdit={() => handleEdit(entry)}
                onDelete={() => handleDelete(entry)}
                isDeleting={deleteMutation.isPending}
              />
            ))}
          </div>
        )}

        {!hasEntries && !showForm && (
          <div className={styles.noEntries}>
            <p>No entries recorded for this day yet.</p>
          </div>
        )}

        {!showForm && (
          <div className={styles.addButtonContainer}>
            <Button onClick={handleAddNew} style={{ width: '100%' }}>
              <Plus size={16} />
              Add New Entry
            </Button>
          </div>
        )}

        {showForm && (
          <div className={styles.formContainer}>
            <h2 className={styles.formTitle}>
              {editMode === 'add' ? 'Add New Entry' : 'Edit Entry'}
            </h2>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className={styles.form}>
                <FormItem name="bristolScale">
                  <FormLabel>Bristol Scale</FormLabel>
                  <FormControl>
                    <BristolScaleSelector
                      value={form.values.bristolScale}
                      onChange={(value) => form.setValues((prev) => ({ ...prev, bristolScale: value }))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="frequency">
                  <FormLabel>Frequency</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      value={form.values.frequency}
                      onChange={(e) => form.setValues((prev) => ({ ...prev, frequency: parseInt(e.target.value) || 1 }))}
                      placeholder="e.g., 1"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="notes">
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      value={form.values.notes || ''}
                      onChange={(e) => form.setValues((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Any additional details..."
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <div className={styles.formActions}>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleCancel}
                    disabled={isMutating}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isMutating} style={{ flex: 1 }}>
                    {isMutating ? 'Saving...' : (editMode === 'add' ? 'Save Entry' : 'Update Entry')}
                  </Button>
                </div>
                {(createMutation.error || updateMutation.error || deleteMutation.error) && (
                  <p className={styles.mutationError}>
                    {createMutation.error?.message || updateMutation.error?.message || deleteMutation.error?.message}
                  </p>
                )}
              </form>
            </Form>
          </div>
        )}
      </div>
    </>
  );
}