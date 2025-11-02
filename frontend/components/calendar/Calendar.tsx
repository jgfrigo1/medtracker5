import React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import type { TimeSlotData, DailyData } from '../../types';

interface CalendarProps {
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    selectedDate: Date | null;
    setSelectedDate: (date: Date) => void;
}

const WEEK_DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

export default function Calendar({ currentDate, setCurrentDate, selectedDate, setSelectedDate }: CalendarProps) {
    const { healthData } = useAppContext();
    const startDate = startOfMonth(currentDate);
    const endDate = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: startDate, end: endDate });

    const startingDayIndex = (getDay(startDate) + 6) % 7;

    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const today = () => {
        const now = new Date();
        setCurrentDate(now);
        setSelectedDate(now);
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <button onClick={prevMonth} className="p-2 rounded-full hover:bg-slate-100"><ChevronLeft size={20} /></button>
                <div className="text-center">
                    <h2 className="text-lg font-semibold text-slate-800 capitalize">{format(currentDate, 'MMMM yyyy', { locale: es })}</h2>
                    <button onClick={today} className="text-sm font-medium text-blue-600 hover:text-blue-800">Hoy</button>
                </div>
                <button onClick={nextMonth} className="p-2 rounded-full hover:bg-slate-100"><ChevronRight size={20} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium text-slate-500">
                {WEEK_DAYS.map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 mt-2">
                {Array.from({ length: startingDayIndex }).map((_, index) => <div key={`empty-${index}`} />)}
                {daysInMonth.map(day => {
                    const dayFormatted = format(day, 'yyyy-MM-dd');
                    const dayData = healthData[dayFormatted];
                    // FIX: Make data checks robust against partial or malformed data from the database.
                    // This prevents crashes when accessing properties like 'medications' on objects
                    // that may not have them.
                    const hasData = dayData && Object.values(dayData).some((d: Partial<TimeSlotData> | null) =>
                        d && (d.value != null || (Array.isArray(d.medications) && d.medications.length > 0) || !!d.comments)
                    );
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isCurrentToday = isToday(day);
                    
                    return (
                        <button
                            key={day.toString()}
                            onClick={() => setSelectedDate(day)}
                            className={`relative h-10 w-10 flex items-center justify-center rounded-full transition-colors duration-200 
                                ${isSelected ? 'bg-blue-600 text-white' : ''}
                                ${!isSelected && isCurrentToday ? 'bg-blue-100 text-blue-700' : ''}
                                ${!isSelected && !isCurrentToday ? 'hover:bg-slate-100 text-slate-700' : ''}
                            `}
                        >
                            <span>{format(day, 'd')}</span>
                            {hasData && <span className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`}></span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}