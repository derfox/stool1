export const BRISTOL_SCALE_INFO = [
  { scale: 0, description: 'No activity' },
  { scale: 1, description: 'Separate hard lumps (very constipated)' },
  { scale: 2, description: 'Lumpy and sausage-like' },
  { scale: 3, description: 'Sausage with cracks' },
  { scale: 4, description: 'Smooth, soft snake (ideal)' },
  { scale: 5, description: 'Soft blobs with clear cut edges' },
  { scale: 6, description: 'Mushy stool with ragged edges' },
  { scale: 7, description: 'Entirely liquid (diarrhea)' },
];

export type BristolScale = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const getBristolScaleColorVar = (scale: BristolScale): string => {
  return `--bristol-${scale}`;
};