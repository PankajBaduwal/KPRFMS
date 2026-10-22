import React, { useState, useMemo } from 'react';
import type { LeaveApplicationRecord } from '../types/leave';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

interface LeaveCalendarViewProps {
  leaves: LeaveApplicationRecord[];
  onSelectLeave?: (leave: LeaveApplicationRecord) => void;
  departments?: Array<{ _id: string; name: string; code: string }>;
  selectedDepartmentId?: string;
  onDepartmentChange?: (deptId: string) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const LeaveCalendarView: React.FC<LeaveCalendarViewProps> = ({
  leaves,
  onSelectLeave,
  departments,
  selectedDepartmentId,
  onDepartmentChange,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING'>('ALL');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month padding days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
        dayNumber: daysInPrevMonth - i,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
        dayNumber: i,
      });
    }

    // Next month padding days to fill 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        dayNumber: i,
      });
    }

    return days;
  }, [year, month]);

  // Map leaves by date string (YYYY-MM-DD)
  const leavesByDate = useMemo(() => {
    const map = new Map<string, LeaveApplicationRecord[]>();

    const filtered = leaves.filter((l) => {
      if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
      return true;
    });

    filtered.forEach((leave) => {
      const s = new Date(leave.startDate);
      const e = new Date(leave.endDate);
      s.setUTCHours(0, 0, 0, 0);
      e.setUTCHours(0, 0, 0, 0);

      const cur = new Date(s);
      while (cur <= e) {
        const key = cur.toISOString().split('T')[0];
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(leave);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    });

    return map;
  }, [leaves, statusFilter]);

  const todayStr = new Date().toISOString().split('T')[0];

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const hasLeavesThisMonth = useMemo(
    () => Array.from(leavesByDate.keys()).some((k) => k.startsWith(monthKey)),
    [leavesByDate, monthKey]
  );

  const getLeaveTypeColor = (type: string) => {
    switch (type) {
      case 'CASUAL_LEAVE':
        return '#3b82f6';
      case 'EARNED_LEAVE':
        return '#10b981';
      case 'SICK_LEAVE':
        return '#ef4444';
      case 'ON_DUTY':
        return '#8b5cf6';
      case 'COMPENSATORY_OFF':
        return '#f97316';
      case 'MATERNITY_PATERNITY':
        return '#ec4899';
      default:
        return '#06b6d4';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Calendar Controls Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '14px 18px',
          backgroundColor: 'var(--color-bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={handlePrevMonth}
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNextMonth}
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, minWidth: '180px' }}>
            {MONTHS[month]} {year}
          </h2>

          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {departments && onDepartmentChange && (
            <select
              value={selectedDepartmentId || ''}
              onChange={(e) => onDepartmentChange(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontSize: '13px',
              }}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          )}

          {/* Status filter pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {(['ALL', 'APPROVED', 'PENDING'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: statusFilter === st ? 600 : 500,
                  backgroundColor: statusFilter === st ? 'var(--color-primary)' : 'transparent',
                  color: statusFilter === st ? '#fff' : 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasLeavesThisMonth && (
        <div
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            backgroundColor: 'var(--color-bg-secondary)',
          }}
        >
          <EmptyState
            icon="bi-calendar-x"
            title={
              statusFilter !== 'ALL'
                ? `No ${statusFilter.toLowerCase()} leave in ${MONTHS[month]} ${year}`
                : `No leave scheduled in ${MONTHS[month]} ${year}`
            }
            reason={
              statusFilter !== 'ALL'
                ? 'No leave in this month matches the selected status filter.'
                : 'No approved or pending leave falls within this month for the selected scope.'
            }
            nextStep={
              statusFilter === 'ALL' ? 'Use the arrows to browse other months.' : undefined
            }
            secondaryAction={
              statusFilter !== 'ALL' ? (
                <Button variant="outline" size="sm" onClick={() => setStatusFilter('ALL')}>
                  Clear filters
                </Button>
              ) : undefined
            }
            compact
          />
        </div>
      )}

      {/* Calendar Grid */}
      <div
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'var(--color-bg)',
        }}
      >
        {/* Days of Week Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            backgroundColor: 'var(--color-bg-secondary)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {DAYS.map((d, idx) => (
            <div
              key={d}
              style={{
                padding: '10px',
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: 700,
                color: idx === 0 ? '#ef4444' : 'var(--color-text-muted)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid Cells */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
          }}
        >
          {calendarDays.map((cd, idx) => {
            const dateStr = cd.date.toISOString().split('T')[0];
            const isToday = dateStr === todayStr;
            const dayLeaves = leavesByDate.get(dateStr) || [];
            const isSunday = cd.date.getDay() === 0;

            return (
              <div
                key={idx}
                style={{
                  minHeight: '105px',
                  padding: '8px',
                  borderRight: (idx + 1) % 7 === 0 ? 'none' : '1px solid var(--color-border)',
                  borderBottom: '1px solid var(--color-border)',
                  backgroundColor: !cd.isCurrentMonth
                    ? 'rgba(0, 0, 0, 0.15)'
                    : isToday
                    ? 'rgba(59, 130, 246, 0.04)'
                    : isSunday
                    ? 'rgba(255, 255, 255, 0.01)'
                    : 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                {/* Day Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: isToday ? 800 : cd.isCurrentMonth ? 600 : 400,
                      color: isToday
                        ? '#3b82f6'
                        : !cd.isCurrentMonth
                        ? 'var(--color-text-muted)'
                        : isSunday
                        ? '#ef4444'
                        : 'var(--color-text)',
                      width: isToday ? '22px' : 'auto',
                      height: isToday ? '22px' : 'auto',
                      borderRadius: isToday ? '50%' : 'none',
                      backgroundColor: isToday ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {cd.dayNumber}
                  </span>

                  {dayLeaves.length > 0 && cd.isCurrentMonth && (
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {dayLeaves.length} on leave
                    </span>
                  )}
                </div>

                {/* Leaves on this date */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '2px' }}>
                  {dayLeaves.slice(0, 3).map((leave) => {
                    const facName =
                      typeof leave.facultyId === 'object' ? leave.facultyId.name : 'Faculty';
                    const color = getLeaveTypeColor(leave.leaveType);
                    const isPending = leave.status === 'PENDING';

                    return (
                      <div
                        key={leave._id}
                        onClick={() => onSelectLeave && onSelectLeave(leave)}
                        title={`${facName} - ${leave.leaveType.replace(/_/g, ' ')} (${leave.status})`}
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: `${color}18`,
                          borderLeft: `3px solid ${color}`,
                          border: isPending ? `1px dashed ${color}` : undefined,
                          fontSize: '11px',
                          fontWeight: 600,
                          color,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          cursor: onSelectLeave ? 'pointer' : 'default',
                          transition: 'transform 0.1s ease',
                        }}
                      >
                        {facName}
                      </div>
                    );
                  })}

                  {dayLeaves.length > 3 && (
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      +{dayLeaves.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '14px',
          padding: '10px 14px',
          backgroundColor: 'var(--color-bg-secondary)',
          borderRadius: '6px',
          fontSize: '12px',
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>Legend:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#3b82f6' }} />
          <span>Casual Leave</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#10b981' }} />
          <span>Earned Leave</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#ef4444' }} />
          <span>Sick / Medical</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#8b5cf6' }} />
          <span>On Duty</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '2px', backgroundColor: '#f97316' }} />
          <span>Comp-Off</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', border: '1px dashed #f59e0b', borderRadius: '2px' }} />
          <span>Pending Review</span>
        </div>
      </div>
    </div>
  );
};
