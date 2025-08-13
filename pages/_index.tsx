import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { format, startOfMonth, addMonths, subMonths, isSameDay, parseISO } from 'date-fns';
import { useStoolEntries } from '../helpers/useStoolEntries';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { ImportExportControls } from '../components/ImportExportControls';
import { getBristolScaleColorVar, type BristolScale } from '../helpers/bristolScale';
import styles from './_index.module.css';

type StoolEntryMap = { [key: string]: Array<{ bristolScale: number; frequency: number; id: number }> };

const DayWithDot = ({ date, displayMonth }: { date: Date; displayMonth: Date }) => {
  const dateKey = format(date, 'yyyy-MM-dd');
  const entriesByDate = React.useContext(EntriesByDateContext);
  const entries = entriesByDate[dateKey];
  const isOutside = date.getMonth() !== displayMonth.getMonth();
  const navigate = useNavigate();

  const handleDayClick = (day: Date) => {
    navigate(`/log/${format(day, 'yyyy-MM-dd')}`);
  };

  // Calculate meaningful aggregate data for multiple entries
  const entryCount = entries?.length || 0;
  const hasMultipleEntries = entryCount > 1;
  
  let displayColor = '';
  let ariaLabel = `Log for ${format(date, 'MMMM do')}`;
  
  if (entries && entries.length > 0) {
    // Use average Bristol scale for color when multiple entries
    const avgBristolScale = Math.round(
      entries.reduce((sum, entry) => sum + entry.bristolScale, 0) / entries.length
    );
    displayColor = `var(${getBristolScaleColorVar(avgBristolScale as BristolScale)})`;
    
    if (hasMultipleEntries) {
      ariaLabel = `${entryCount} entries for ${format(date, 'MMMM do')}`;
    } else {
      ariaLabel = `1 entry for ${format(date, 'MMMM do')}`;
    }
  }

  return (
    <button
      className={`${styles.dayCell} ${isOutside ? styles.outsideDay : ''} ${hasMultipleEntries ? styles.multipleEntries : ''}`}
      onClick={() => handleDayClick(date)}
      aria-label={ariaLabel}
    >
      <span className={styles.dayNumber}>{format(date, 'd')}</span>
      {entries && entries.length > 0 && (
        <div className={styles.entryIndicator}>
          <span
            className={`${styles.dayDot} ${hasMultipleEntries ? styles.multipleDot : ''}`}
            style={{ backgroundColor: displayColor }}
          />
          {hasMultipleEntries && (
            <span className={styles.entryCount}>{entryCount}</span>
          )}
        </div>
      )}
    </button>
  );
};

const CalendarSkeleton = () => (
  <div className={styles.calendarGrid}>
    <div className={styles.skeletonHeader}>
      {[...Array(7)].map((_, i) => <Skeleton key={i} style={{ height: '1rem', width: '2rem' }} />)}
    </div>
    <div className={styles.skeletonBody}>
      {[...Array(35)].map((_, i) => <Skeleton key={i} className={styles.skeletonCell} />)}
    </div>
  </div>
);

const EntriesByDateContext = React.createContext<StoolEntryMap>({});

export default function IndexPage() {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const { data: entries, isFetching, error } = useStoolEntries();

  const entriesByDate = useMemo(() => {
    if (!entries) return {};
    return entries.reduce((acc: StoolEntryMap, entry) => {
      const dateKey = format(entry.entryDate, 'yyyy-MM-dd');
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push({ 
        bristolScale: entry.bristolScale, 
        frequency: entry.frequency,
        id: entry.id 
      });
      return acc;
    }, {});
  }, [entries]);

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const startDate = new Date(monthStart);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday of the first week

    const weeks = [];
    for (let i = 0; i < 6; i++) {
      const days = [];
      for (let j = 0; j < 7; j++) {
        const day = new Date(startDate);
        days.push(
          <td key={day.toISOString()} className={isSameDay(day, new Date()) ? styles.today : ''}>
            <DayWithDot date={day} displayMonth={currentMonth} />
          </td>
        );
        startDate.setDate(startDate.getDate() + 1);
      }
      weeks.push(<tr key={i}>{days}</tr>);
      if (startDate.getMonth() !== currentMonth.getMonth() && i >= 3) {
        break;
      }
    }

    return (
      <table className={styles.calendarGrid}>
        <thead>
          <tr>
            <th>Sun</th>
            <th>Mon</th>
            <th>Tue</th>
            <th>Wed</th>
            <th>Thu</th>
            <th>Fri</th>
            <th>Sat</th>
          </tr>
        </thead>
        <tbody>{weeks}</tbody>
      </table>
    );
  };

  return (
    <EntriesByDateContext.Provider value={entriesByDate}>
      <Helmet>
        <title>Stool Log Calendar | Stool Tracker</title>
      </Helmet>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <CalendarIcon size={24} />
          <h1>Stool Log</h1>
        </div>
        <div className={styles.navigation}>
          <Button variant="ghost" size="icon-md" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Previous month">
            <ChevronLeft />
          </Button>
          <span className={styles.monthDisplay}>{format(currentMonth, 'MMMM yyyy')}</span>
          <Button variant="ghost" size="icon-md" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Next month">
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className={styles.importExportSection}>
        <ImportExportControls />
      </div>
      <div className={styles.calendarContainer}>
        {isFetching ? (
          <CalendarSkeleton />
        ) : error ? (
          <div className={styles.error}>Error loading entries. Please try again later.</div>
        ) : (
          renderCalendar()
        )}
      </div>
      <div className={styles.legend}>
        <div className={styles.legendItem}><span className={styles.legendDot} style={{backgroundColor: 'var(--bristol-1)'}}></span> Constipated</div>
        <div className={styles.legendItem}><span className={styles.legendDot} style={{backgroundColor: 'var(--bristol-4)'}}></span> Normal</div>
        <div className={styles.legendItem}><span className={styles.legendDot} style={{backgroundColor: 'var(--bristol-6)'}}></span> Loose</div>
        <div className={styles.legendItem}><span className={styles.legendDot} style={{backgroundColor: 'var(--bristol-0)'}}></span> No Activity</div>
      </div>
    </EntriesByDateContext.Provider>
  );
}