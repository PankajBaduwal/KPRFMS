import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  BookOpen,
  UserCheck,
  AlertTriangle,
  User,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
} from 'lucide-react';
import type { TimetableSlot, ActiveSubstitutionOverlay, DayOfWeek } from '../types/timetable';
import { DAYS_OF_WEEK, STANDARD_PERIOD_TIMES } from '../types/timetable';
import { EmptyState } from './EmptyState';

interface TimetableGridProps {
  slots: TimetableSlot[];
  activeSubstitutions?: ActiveSubstitutionOverlay[];
  canEdit?: boolean;
  onAddSlot?: (day: DayOfWeek, period: number) => void;
  onEditSlot?: (slot: TimetableSlot) => void;
  onDeleteSlot?: (slot: TimetableSlot) => void;
  onRequestSubstitution?: (slot: TimetableSlot) => void;
  emptyPlaceholderMessage?: string;
  /** Shown when there are no slots at all: what is empty. */
  emptyTitle?: string;
  /** Shown when there are no slots at all: why it might be empty. */
  emptyReason?: string;
  /** Guidance shown when the viewer cannot add slots. */
  emptyNextStep?: string;
}

export const TimetableGrid: React.FC<TimetableGridProps> = ({
  slots,
  activeSubstitutions = [],
  canEdit = false,
  onAddSlot,
  onEditSlot,
  onDeleteSlot,
  onRequestSubstitution,
  emptyPlaceholderMessage = 'No classes scheduled for this slot',
  emptyTitle = 'No classes scheduled for this timetable',
  emptyReason = 'No class slots have been configured for this academic year yet.',
  emptyNextStep = 'Class slots added by your HOD or the academic office will appear here.',
}) => {
  // Mobile day tab selector
  const [activeMobileDay, setActiveMobileDay] = useState<DayOfWeek>('MONDAY');

  if (slots.length === 0) {
    const canAdd = canEdit && !!onAddSlot;
    return (
      <EmptyState
        compact
        icon="bi-calendar-week"
        title={emptyTitle}
        reason={emptyReason}
        nextStep={canAdd ? undefined : emptyNextStep}
        action={
          canAdd ? (
            <button
              type="button"
              onClick={() => onAddSlot('MONDAY', 1)}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1.5 rounded-md flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Class Slot
            </button>
          ) : undefined
        }
      />
    );
  }

  // Build grid map: [day][period] -> TimetableSlot[]
  const gridMap: Record<string, Record<number, TimetableSlot[]>> = {};
  DAYS_OF_WEEK.forEach((day) => {
    gridMap[day] = {};
    for (let p = 1; p <= 8; p++) {
      gridMap[day][p] = [];
    }
  });

  slots.forEach((s) => {
    if (gridMap[s.day] && gridMap[s.day][s.period]) {
      gridMap[s.day][s.period].push(s);
    }
  });

  // Helper to find substitution for slot or faculty on selected date
  const getSubstitutionsForSlot = (_day: string, period: number, slot?: TimetableSlot) => {
    if (!activeSubstitutions || activeSubstitutions.length === 0) return [];
    return activeSubstitutions.filter((sub) => {
      if (sub.period !== period) return false;
      if (slot && sub.timetableSlotId && sub.timetableSlotId === slot._id) return true;
      if (slot) {
        const slotFacId = typeof slot.facultyId === 'object' ? slot.facultyId._id : slot.facultyId;
        const origId = typeof sub.originalFacultyId === 'object' ? sub.originalFacultyId._id : sub.originalFacultyId;
        const subId = typeof sub.substituteFacultyId === 'object' ? sub.substituteFacultyId._id : sub.substituteFacultyId;
        return (origId === slotFacId || subId === slotFacId) && sub.subjectCode === slot.subjectCode;
      }
      return false;
    });
  };

  return (
    <div className="w-full">
      {/* Mobile Day Selector Bar (visible on < md) */}
      <div className="flex md:hidden overflow-x-auto gap-2 pb-3 mb-3 border-b border-gray-200">
        {DAYS_OF_WEEK.map((day) => {
          const count = Object.values(gridMap[day] || {}).reduce((acc, arr) => acc + arr.length, 0);
          const isActive = activeMobileDay === day;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setActiveMobileDay(day)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>{day.slice(0, 3)}</span>
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-blue-800 text-blue-100' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Desktop & Tablet Table Matrix */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-gray-50/90 border-b border-gray-200 text-gray-600">
              <th className="py-3 px-3 w-28 font-bold uppercase tracking-wider text-gray-500 border-r border-gray-200 bg-gray-100/70">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Day / Period</span>
                </div>
              </th>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                <th
                  key={p}
                  className="py-2.5 px-2 font-semibold text-center border-r border-gray-200 min-w-[130px]"
                >
                  <div className="font-bold text-gray-800">Period {p}</div>
                  <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                    {STANDARD_PERIOD_TIMES[p]}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {DAYS_OF_WEEK.map((day) => (
              <tr key={day} className="hover:bg-gray-50/40 transition-colors">
                <td className="py-3 px-3 font-bold text-gray-700 bg-gray-50/70 border-r border-gray-200">
                  <span className="text-xs uppercase tracking-wide">{day}</span>
                </td>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((period) => {
                  const cellSlots = gridMap[day][period] || [];
                  const hasSlots = cellSlots.length > 0;

                  return (
                    <td
                      key={period}
                      className="py-1.5 px-1.5 border-r border-gray-200 align-top h-28 relative group/cell"
                    >
                      {hasSlots ? (
                        <div className="space-y-1.5 h-full">
                          {cellSlots.map((slot) => {
                            const subs = getSubstitutionsForSlot(day, period, slot);
                            const hasCovering = subs.some((s) => s.isCovering);
                            const hasSubstitutedOut = subs.some((s) => s.isSubstitutedOut);

                            return (
                              <div
                                key={slot._id}
                                className={`p-2 rounded-lg border text-left transition-all relative ${
                                  hasCovering
                                    ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-400'
                                    : hasSubstitutedOut
                                    ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-300'
                                    : 'bg-blue-50/70 border-blue-200 hover:border-blue-400 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <span className="font-bold text-blue-900 text-[11px] leading-tight flex items-center gap-1">
                                    <BookOpen className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                    <span>{slot.subjectCode}</span>
                                  </span>
                                  <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-blue-100 text-blue-800">
                                    Sec {slot.section}
                                  </span>
                                </div>

                                <div className="text-[10px] text-gray-700 font-medium truncate mt-0.5" title={slot.subjectName}>
                                  {slot.subjectName}
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1 pt-1 border-t border-gray-200/60">
                                  <span className="flex items-center gap-1 font-medium text-gray-600">
                                    <MapPin className="w-2.5 h-2.5 text-rose-500" />
                                    {slot.room}
                                  </span>
                                  <span className="flex items-center gap-1 truncate max-w-[70px] text-gray-600" title={slot.facultyName}>
                                    <User className="w-2.5 h-2.5 text-gray-400" />
                                    {slot.facultyName.split(' ')[0]}
                                  </span>
                                </div>

                                {/* Substitution Pill */}
                                {hasCovering && (
                                  <div className="mt-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-semibold flex items-center gap-1">
                                    <UserCheck className="w-2.5 h-2.5" />
                                    <span>Covering</span>
                                  </div>
                                )}
                                {hasSubstitutedOut && (
                                  <div className="mt-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 text-[9px] font-semibold flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    <span>Substituted Out</span>
                                  </div>
                                )}

                                {/* Hover action buttons */}
                                <div className="absolute top-1 right-1 hidden group-hover/cell:flex items-center gap-0.5 bg-white/95 backdrop-blur-xs rounded shadow px-1 py-0.5 border border-gray-200">
                                  {onRequestSubstitution && (
                                    <button
                                      type="button"
                                      onClick={() => onRequestSubstitution(slot)}
                                      className="p-1 text-amber-600 hover:text-amber-800 rounded hover:bg-amber-50"
                                      title="Assign Substitute Faculty"
                                    >
                                      <RefreshCw className="w-3 h-3" />
                                    </button>
                                  )}
                                  {canEdit && onEditSlot && (
                                    <button
                                      type="button"
                                      onClick={() => onEditSlot(slot)}
                                      className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50"
                                      title="Edit Slot"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  )}
                                  {canEdit && onDeleteSlot && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteSlot(slot)}
                                      className="p-1 text-rose-600 hover:text-rose-800 rounded hover:bg-rose-50"
                                      title="Delete Slot"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300">
                          {canEdit && onAddSlot ? (
                            <button
                              type="button"
                              onClick={() => onAddSlot(day, period)}
                              className="opacity-0 group-hover/cell:opacity-100 flex items-center gap-1 text-[11px] text-blue-600 font-medium px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 transition-opacity"
                            >
                              <Plus className="w-3 h-3" /> Add
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-300 select-none">—</span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Day-by-Day View (visible on < md) */}
      <div className="block md:hidden space-y-2.5">
        <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
          <div className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>{activeMobileDay} Schedule</span>
          </div>
          {canEdit && onAddSlot && (
            <button
              type="button"
              onClick={() => onAddSlot(activeMobileDay, 1)}
              className="text-xs bg-blue-600 text-white font-medium px-2.5 py-1 rounded-md flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add Class
            </button>
          )}
        </div>

        {[1, 2, 3, 4, 5, 6, 7, 8].map((period) => {
          const cellSlots = gridMap[activeMobileDay][period] || [];
          const hasSlots = cellSlots.length > 0;

          return (
            <div
              key={period}
              className={`p-3 rounded-lg border transition-all ${
                hasSlots ? 'bg-white border-gray-200 shadow-xs' : 'bg-gray-50/60 border-dashed border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span className="font-bold text-gray-700">Period {period}</span>
                <span className="flex items-center gap-1 text-gray-400">
                  <Clock className="w-3 h-3" />
                  {STANDARD_PERIOD_TIMES[period]}
                </span>
              </div>

              {hasSlots ? (
                <div className="space-y-2">
                  {cellSlots.map((slot) => {
                    const subs = getSubstitutionsForSlot(activeMobileDay, period, slot);
                    const hasCovering = subs.some((s) => s.isCovering);
                    const hasSubstitutedOut = subs.some((s) => s.isSubstitutedOut);

                    return (
                      <div
                        key={slot._id}
                        className={`p-2.5 rounded-lg border text-left ${
                          hasCovering
                            ? 'bg-amber-50 border-amber-300'
                            : hasSubstitutedOut
                            ? 'bg-orange-50 border-orange-300'
                            : 'bg-blue-50/50 border-blue-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-blue-900 text-xs">{slot.subjectCode}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                            Section {slot.section}
                          </span>
                        </div>
                        <div className="text-xs text-gray-800 font-medium mb-1.5">{slot.subjectName}</div>
                        <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-200">
                          <span className="flex items-center gap-1 font-medium">
                            <MapPin className="w-3 h-3 text-rose-500" /> Room {slot.room}
                          </span>
                          <span className="flex items-center gap-1 text-gray-600">
                            <User className="w-3 h-3" /> {slot.facultyName}
                          </span>
                        </div>

                        {hasCovering && (
                          <div className="mt-2 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            <span>Substitute covering class</span>
                          </div>
                        )}
                        {hasSubstitutedOut && (
                          <div className="mt-2 px-2 py-0.5 rounded bg-orange-100 text-orange-800 text-[10px] font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Substituted out by another faculty</span>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 mt-2 pt-1 border-t border-gray-200">
                          {onRequestSubstitution && (
                            <button
                              type="button"
                              onClick={() => onRequestSubstitution(slot)}
                              className="text-xs text-amber-700 hover:text-amber-800 font-medium flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" /> Substitute
                            </button>
                          )}
                          {canEdit && onEditSlot && (
                            <button
                              type="button"
                              onClick={() => onEditSlot(slot)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3" /> Edit
                            </button>
                          )}
                          {canEdit && onDeleteSlot && (
                            <button
                              type="button"
                              onClick={() => onDeleteSlot(slot)}
                              className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-2 text-xs text-gray-400">
                  {emptyPlaceholderMessage}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
