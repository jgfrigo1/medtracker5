
import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from './context/AppContext';
import LoginScreen from './components/auth/LoginScreen';
import Calendar from './components/calendar/Calendar';
import DataInputForm from './components/input/DataInputForm';
import DataDisplay from './components/output/DataDisplay';
import MedicationManager from './components/medication/MedicationManager';
import StandardPatternManager from './components/medication/StandardPatternManager';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, List as ListIcon, ClipboardList as ClipboardListIcon, BarChart2 as BarChart2Icon, Edit as EditIcon, Power as PowerIcon, User as UserIcon } from 'lucide-react';

type View = 'tracker' | 'medications' | 'pattern';
type TrackerTab = 'input' | 'chart';

export default function App() {
    const { currentUser, logout, isLoading } = useAppContext();
    const [currentDate, setCurrentDate] = useState(new Date()); // For calendar month view
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [view, setView] = useState<View>('tracker');
    const [trackerTab, setTrackerTab] = useState<TrackerTab>('input');
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const calendarRef = useRef<HTMLDivElement>(null);

    // Close calendar when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
                setIsCalendarOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [calendarRef]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-100">
                <div className="text-slate-500">Cargando aplicación...</div>
            </div>
        );
    }

    if (!currentUser) {
        return <LoginScreen />;
    }

    const selectedDateString = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;

    const handleDateSelect = (date: Date) => {
        setSelectedDate(date);
        setIsCalendarOpen(false);
    }

    const renderView = () => {
        switch (view) {
            case 'medications':
                return <MedicationManager />;
            case 'pattern':
                return <StandardPatternManager />;
            case 'tracker':
            default:
                return (
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-slate-200 h-full flex flex-col">
                        <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                            <div className="relative">
                                <button 
                                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                                    className="flex items-center gap-3 text-left px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors w-full sm:w-auto"
                                >
                                    <CalendarIcon size={20} className="text-slate-500"/>
                                    <div>
                                        <span className="text-xs text-slate-500">Fecha seleccionada</span>
                                        <h2 className="text-lg font-bold text-slate-700 capitalize">
                                            {selectedDate ? format(selectedDate, "eeee, d 'de' MMMM", { locale: es }) : 'Seleccionar fecha'}
                                        </h2>
                                    </div>
                                </button>
                                {isCalendarOpen && (
                                     <div ref={calendarRef} className="absolute top-full mt-2 z-20 bg-white p-4 rounded-lg shadow-xl border border-slate-200">
                                        <Calendar
                                            currentDate={currentDate}
                                            setCurrentDate={setCurrentDate}
                                            selectedDate={selectedDate}
                                            setSelectedDate={handleDateSelect}
                                        />
                                    </div>
                                )}
                            </div>
                            
                            {selectedDate && (
                                <div className="flex items-center bg-slate-100 rounded-lg p-1">
                                    <button
                                        onClick={() => setTrackerTab('input')}
                                        className={`px-3 py-1.5 text-sm font-semibold rounded-md flex items-center gap-2 transition-colors ${trackerTab === 'input' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                                    >
                                        <EditIcon size={16} />
                                        <span>Ingresar Datos</span>
                                    </button>
                                    <button
                                        onClick={() => setTrackerTab('chart')}
                                        className={`px-3 py-1.5 text-sm font-semibold rounded-md flex items-center gap-2 transition-colors ${trackerTab === 'chart' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                                    >
                                        <BarChart2Icon size={16} />
                                        <span>Ver Gráfico</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex-grow overflow-y-auto min-h-[60vh]">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full text-slate-500"><p>Cargando datos...</p></div>
                            ) : selectedDateString ? (
                                <>
                                    {trackerTab === 'input' ? (
                                        <DataInputForm selectedDate={selectedDateString} />
                                    ) : (
                                        <DataDisplay selectedDate={selectedDateString} />
                                    )}
                                </>
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-500">
                                    <p>Seleccione un día para ver o ingresar datos.</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
        }
    };
    
    return (
        <div className="min-h-screen flex flex-col bg-slate-100">
            <header className="bg-white shadow-sm sticky top-0 z-10">
                <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-3">
                        <h1 className="text-2xl font-bold text-blue-600">Monitor de Salud</h1>
                        <div className="flex items-center gap-2">
                             <nav className="hidden sm:flex gap-1 sm:gap-2">
                                <button onClick={() => setView('tracker')} className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${view === 'tracker' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}>
                                    <CalendarIcon size={18}/> <span className="hidden sm:inline">Registro Diario</span>
                                </button>
                                <button onClick={() => setView('medications')} className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${view === 'medications' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}>
                                    <ListIcon size={18}/> <span className="hidden sm:inline">Medicamentos</span>
                                </button>
                                <button onClick={() => setView('pattern')} className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${view === 'pattern' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100'}`}>
                                    <ClipboardListIcon size={18}/> <span className="hidden sm:inline">Patrón Estándar</span>
                                </button>
                             </nav>
                             <div className="w-px h-6 bg-slate-200 mx-2 hidden sm:block"></div>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <UserIcon size={16} />
                                <span className="font-medium">{currentUser.username}</span>
                            </div>
                            <button onClick={logout} className="flex items-center gap-2 p-2 text-sm font-medium rounded-full text-red-600 hover:bg-red-50 transition-colors">
                                <PowerIcon size={18}/>
                            </button>
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-grow p-4 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto w-full">
                {renderView()}
            </main>
        </div>
    );
}