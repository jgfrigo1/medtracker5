
import React, { useState, useRef, useEffect, createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    ChevronLeft, ChevronRight, Plus, Edit, Trash2, Check, Save, ClipboardPaste, Pill, MessageSquare, 
    Calendar as CalendarIcon, List as ListIcon, ClipboardList as ClipboardListIcon, BarChart2 as BarChart2Icon, 
    Edit as EditIcon, Power as PowerIcon, User as UserIcon 
} from 'lucide-react';

// =================================================================================
// TYPES (from types.ts)
// =================================================================================

interface TimeSlotData {
    value: number | null;
    medications: string[];
    comments: string;
}

type DailyData = Record<string, TimeSlotData>;

type HealthData = Record<string, DailyData>;

type StandardPattern = Record<string, string[]>;

interface User {
    username: string; // User's name from Google Profile
    email: string;
    picture?: string;
}

interface UserDataBundle {
    healthData: HealthData;
    medications: string[];
    standardPattern: StandardPattern;
}


interface AppContextType {
    currentUser: User | null;
    login: () => void;
    logout: () => void;
    healthData: HealthData;
    medications: string[];
    standardPattern: StandardPattern;
    isLoading: boolean;
    updateHealthData: (date: string, data: DailyData) => Promise<void>;
    addMedication: (med: string) => Promise<void>;
    editMedication: (oldMed: string, newMed: string) => Promise<void>;
    deleteMedication: (med: string) => Promise<void>;
    updateStandardPattern: (pattern: StandardPattern) => Promise<void>;
}


// =================================================================================
// CONSTANTS (from constants.ts)
// =================================================================================

const TIME_SLOTS: string[] = [];
for (let h = 8; h < 24; h++) {
    TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:00`);
    if (h < 23) {
      TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:30`);
    }
}


// =================================================================================
// GOOGLE DRIVE SERVICE (from services/googleDriveService.ts)
// =================================================================================

namespace GoogleDriveService {
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID; 
    const API_KEY = process.env.API_KEY;

    const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
    const SCOPES = 'https://www.googleapis.com/auth/drive.file';
    const DATA_FILE_NAME = 'health_monitor_data.json';

    let gapi = (window as any).gapi;
    let google = (window as any).google;
    let tokenClient: any = null;
    let onAuthChangeCallback: (isSignedIn: boolean) => void;

    export async function initGoogleClient(authCallback: (isSignedIn: boolean) => void) {
        onAuthChangeCallback = authCallback;
        
        await new Promise<void>((resolve) => {
            const interval = setInterval(() => {
                if ((window as any).gapi) {
                    gapi = (window as any).gapi;
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });

        gapi.load('client', async () => {
            await gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: DISCOVERY_DOCS,
            });

            tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: (tokenResponse: any) => {
                     if (tokenResponse && tokenResponse.access_token) {
                        gapi.client.setToken(tokenResponse);
                        onAuthChangeCallback(true);
                    }
                },
            });
            
            if (gapi.client.getToken() !== null) {
                onAuthChangeCallback(true);
            } else {
                 onAuthChangeCallback(false);
            }
        });
    }

    export function signIn() {
        if (!tokenClient) {
            console.error("Token client not initialized.");
            return;
        }
        tokenClient.requestAccessToken({ prompt: 'consent' });
    }

    export function signOut() {
        const token = gapi.client.getToken();
        if (token !== null) {
            google.accounts.oauth2.revoke(token.access_token, () => {
                gapi.client.setToken('');
                onAuthChangeCallback(false);
            });
        }
    }
    
    // This is a placeholder as GSI doesn't provide a simple profile object like the old API.
    // In a real app, you would add 'profile' and 'email' scopes and use the People API
    // or decode the ID token. The AppContext will manage the actual user profile.
    export function getUserProfile() {
        return {
            getName: () => 'Usuario',
            getEmail: () => 'email@example.com',
            getImageUrl: () => '',
        };
    }

    async function findOrCreateDataFile(): Promise<string> {
        const response = await gapi.client.drive.files.list({
            q: `name='${DATA_FILE_NAME}'`,
            spaces: 'appDataFolder',
            fields: 'files(id, name)',
        });

        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id!;
        } else {
            const fileMetadata = {
                name: DATA_FILE_NAME,
                parents: ['appDataFolder'],
            };
            const createResponse = await gapi.client.drive.files.create({
                resource: fileMetadata,
                fields: 'id',
            });
            return createResponse.result.id!;
        }
    }

    export async function loadData(defaultData: UserDataBundle): Promise<UserDataBundle> {
        const fileId = await findOrCreateDataFile();
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        if (response.body && response.body.length > 0) {
            try {
                return JSON.parse(response.body);
            } catch (e) {
                console.error("Error parsing data from drive, returning default.", e);
                return defaultData;
            }
        }
        
        await saveData(defaultData);
        return defaultData;
    }

    export async function saveData(data: UserDataBundle): Promise<void> {
        const fileId = await findOrCreateDataFile();
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const contentType = 'application/json';
        const metadata = {
            name: DATA_FILE_NAME,
            mimeType: contentType,
        };

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: ' + contentType + '\r\n\r\n' +
            JSON.stringify(data) +
            close_delim;

        await gapi.client.request({
            path: `/upload/drive/v3/files/${fileId}`,
            method: 'PATCH',
            params: { uploadType: 'multipart' },
            headers: {
                'Content-Type': 'multipart/related; boundary="' + boundary + '"',
            },
            body: multipartRequestBody,
        });
    }
}


// =================================================================================
// APP CONTEXT (from context/AppContext.tsx)
// =================================================================================

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultUserData: UserDataBundle = {
    healthData: {},
    medications: ['Medicina A', 'Medicina B'],
    standardPattern: {}
};

const AppProvider = ({ children }: { children: ReactNode }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserDataBundle>(defaultUserData);
    const [isLoading, setIsLoading] = useState(true);
    const [isGapiLoaded, setIsGapiLoaded] = useState(false);

    const saveDataToDrive = useCallback(async (data: UserDataBundle) => {
        try {
            await GoogleDriveService.saveData(data);
        } catch (error) {
            console.error("Failed to save data to drive", error);
        }
    }, []);

    const updateAndSaveUserData = (updater: (prev: UserDataBundle) => UserDataBundle) => {
        setUserData(prev => {
            const newState = updater(prev);
            saveDataToDrive(newState);
            return newState;
        });
    };

    const handleAuthChange = useCallback(async (isSignedIn: boolean) => {
        if (isSignedIn) {
            const profile = GoogleDriveService.getUserProfile();
            if (profile) {
                // In a real app with proper scopes, you'd get this from the token or People API
                setCurrentUser({
                    username: profile.getName(),
                    email: profile.getEmail(),
                    picture: profile.getImageUrl(),
                });
                try {
                    const data = await GoogleDriveService.loadData(defaultUserData);
                    setUserData(data);
                } catch (error) {
                    console.error("Failed to load data from drive", error);
                    setUserData(defaultUserData);
                }
            }
        } else {
            setCurrentUser(null);
            setUserData(defaultUserData);
        }
        setIsLoading(false);
    }, []);
    
    useEffect(() => {
        const initGoogleClient = async () => {
            await GoogleDriveService.initGoogleClient(handleAuthChange);
            setIsGapiLoaded(true);
        };
        if (!(window as any).gapiInitialized) {
            (window as any).gapiInitialized = true;
            initGoogleClient();
        }
    }, [handleAuthChange]);


    const login = () => {
        GoogleDriveService.signIn();
    };

    const logout = () => {
        GoogleDriveService.signOut();
    };

    const updateHealthData = async (date: string, data: DailyData) => {
        updateAndSaveUserData(prev => ({
            ...prev,
            healthData: { ...prev.healthData, [date]: data }
        }));
    };

    const addMedication = async (med: string) => {
        if (!userData.medications.includes(med)) {
            updateAndSaveUserData(prev => ({
                ...prev,
                medications: [...prev.medications, med].sort()
            }));
        }
    };

    const editMedication = async (oldMed: string, newMed: string) => {
        updateAndSaveUserData(prev => {
            const newHealthData: HealthData = {};
            for (const date in prev.healthData) {
                newHealthData[date] = {};
                for (const time in prev.healthData[date]) {
                    newHealthData[date][time] = {
                        ...prev.healthData[date][time],
                        medications: prev.healthData[date][time].medications.map(m => (m === oldMed ? newMed : m))
                    };
                }
            }

            const newStandardPattern: StandardPattern = {};
            for (const time in prev.standardPattern) {
                newStandardPattern[time] = prev.standardPattern[time].map(m => (m === oldMed ? newMed : m));
            }
            
            return {
                ...prev,
                medications: prev.medications.map(m => (m === oldMed ? newMed : m)).sort(),
                healthData: newHealthData,
                standardPattern: newStandardPattern
            };
        });
    };

    const deleteMedication = async (medToDelete: string) => {
         updateAndSaveUserData(prev => {
            const newHealthData: HealthData = {};
            for (const date in prev.healthData) {
                newHealthData[date] = {};
                for (const time in prev.healthData[date]) {
                    newHealthData[date][time] = {
                        ...prev.healthData[date][time],
                        medications: prev.healthData[date][time].medications.filter(m => m !== medToDelete)
                    };
                }
            }
            
            const newStandardPattern: StandardPattern = {};
            for (const time in prev.standardPattern) {
                const filteredMeds = prev.standardPattern[time].filter(m => m !== medToDelete);
                if (filteredMeds.length > 0) {
                    newStandardPattern[time] = filteredMeds;
                }
            }
            
            return {
                ...prev,
                medications: prev.medications.filter(m => m !== medToDelete),
                healthData: newHealthData,
                standardPattern: newStandardPattern
            };
        });
    };
    
    const updateStandardPattern = async (pattern: StandardPattern) => {
        updateAndSaveUserData(prev => ({
            ...prev,
            standardPattern: pattern
        }));
    };
    
    const value: AppContextType = {
        currentUser,
        login,
        logout,
        healthData: userData.healthData,
        medications: userData.medications,
        standardPattern: userData.standardPattern,
        isLoading: isLoading || !isGapiLoaded,
        updateHealthData,
        addMedication,
        editMedication,
        deleteMedication,
        updateStandardPattern,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};


// =================================================================================
// COMPONENT: LoginScreen (from components/auth/LoginScreen.tsx)
// =================================================================================

function LoginScreen() {
    const { login } = useAppContext();

    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100">
            <div className="w-full max-w-sm p-8 space-y-8 bg-white rounded-xl shadow-lg text-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Monitor de Salud</h1>
                    <p className="mt-2 text-slate-500">
                        Inicie sesión con su cuenta de Google para guardar y sincronizar sus datos de forma segura en Google Drive.
                    </p>
                </div>
                <div className="pt-4">
                    <button
                        onClick={login}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-300"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.42-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                            <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                        Acceder con Google
                    </button>
                </div>
                 <p className="text-xs text-slate-400 pt-4">
                    Al continuar, permite que esta aplicación cree y administre sus propios ficheros en su Google Drive.
                </p>
            </div>
        </div>
    );
}


// =================================================================================
// COMPONENT: Calendar (from components/calendar/Calendar.tsx)
// =================================================================================

interface CalendarProps {
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    selectedDate: Date | null;
    setSelectedDate: (date: Date) => void;
}

const WEEK_DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

function Calendar({ currentDate, setCurrentDate, selectedDate, setSelectedDate }: CalendarProps) {
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


// =================================================================================
// COMPONENT: DataInputForm (from components/input/DataInputForm.tsx)
// =================================================================================

interface DataInputFormProps {
    selectedDate: string;
}

const defaultTimeSlotData: TimeSlotData = { value: null, medications: [], comments: '' };

const createInitialData = (): DailyData => {
    return TIME_SLOTS.reduce((acc, time) => {
        acc[time] = { ...defaultTimeSlotData, medications: [] };
        return acc;
    }, {} as DailyData);
};

function DataInputForm({ selectedDate }: DataInputFormProps) {
    const { healthData, updateHealthData, medications, standardPattern } = useAppContext();
    const [dailyData, setDailyData] = useState<DailyData>(createInitialData());
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        const existingData = healthData[selectedDate];
        const fullData = createInitialData();
        if (existingData) {
            Object.keys(existingData).forEach(time => {
                if (fullData[time]) {
                    fullData[time] = { ...defaultTimeSlotData, ...existingData[time] };
                }
            });
        }
        setDailyData(fullData);
    }, [selectedDate, healthData]);

    const handleValueChange = <K extends keyof TimeSlotData>(time: string, field: K, value: TimeSlotData[K]) => {
        setDailyData(prevData => ({
            ...prevData,
            [time]: {
                ...prevData[time],
                [field]: value
            }
        }));
    };
    
    const handleMedicationChange = (time: string, selectedMeds: string[]) => {
       setDailyData(prevData => ({
            ...prevData,
            [time]: {
                ...prevData[time],
                medications: selectedMeds
            }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        await updateHealthData(selectedDate, dailyData);
        setIsSaving(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
    };

    const applyStandardPattern = () => {
        setDailyData(prevData => {
            const newData = { ...prevData };
            Object.keys(standardPattern).forEach(time => {
                if (newData[time]) {
                    const existingMeds = new Set(newData[time].medications);
                    standardPattern[time].forEach(med => existingMeds.add(med));
                    newData[time] = { ...newData[time], medications: Array.from(existingMeds) };
                }
            });
            return newData;
        });
    };

    return (
        <div className="space-y-4">
            <div className="max-h-[60vh] overflow-y-auto pr-2 -mr-2">
                <table className="w-full text-sm text-left">
                     <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-[1]">
                        <tr>
                            <th scope="col" className="px-3 py-3 w-1/6">Hora</th>
                            <th scope="col" className="px-3 py-3 w-1/6">Valor (0-10)</th>
                            <th scope="col" className="px-3 py-3 w-2/6">Medicación</th>
                            <th scope="col" className="px-3 py-3 w-2/6">Comentarios</th>
                        </tr>
                    </thead>
                    <tbody>
                        {TIME_SLOTS.map(time => {
                            const timeData = dailyData[time];
                            return (
                                <tr key={time} className="bg-white border-b border-slate-200 hover:bg-slate-50">
                                    <td className="px-3 py-2 font-medium text-slate-900">{time}</td>
                                    <td className="px-3 py-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="10"
                                            step="1"
                                            value={timeData.value ?? ''}
                                            onChange={(e) => handleValueChange(time, 'value', e.target.value === '' ? null : Number(e.target.value))}
                                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </td>
                                    <td className="px-3 py-2">
                                        <select
                                            multiple
                                            value={timeData.medications}
                                            onChange={(e) => handleMedicationChange(time, Array.from(e.target.selectedOptions, option => option.value))}
                                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 h-24"
                                        >
                                            {medications.map(med => <option key={med} value={med}>{med}</option>)}
                                        </select>
                                    </td>
                                    <td className="px-3 py-2">
                                        <textarea
                                            value={timeData.comments}
                                            onChange={(e) => handleValueChange(time, 'comments', e.target.value)}
                                            className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            rows={3}
                                        />
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                {showSuccess && <span className="text-sm text-green-600">¡Guardado con éxito!</span>}
                <button onClick={applyStandardPattern} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 flex items-center gap-2 transition-colors">
                    <ClipboardPaste size={16}/> Aplicar Patrón
                </button>
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                    <Save size={16}/> {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </div>
        </div>
    );
}


// =================================================================================
// COMPONENT: DataDisplay (from components/output/DataDisplay.tsx)
// =================================================================================

interface DataDisplayProps {
    selectedDate: string;
}

interface ChartDataPoint {
    time: string;
    value: number | null;
    medications: string[];
    comments: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const valueDisplay = data.value !== null ? `Valor: ${data.value}` : 'Valor: N/A';

        return (
            <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200">
                <p className="font-bold text-slate-800">{`Hora: ${label}`}</p>
                <p className="text-blue-600">{valueDisplay}</p>
                {data.medications.length > 0 && (
                    <div className="mt-2">
                        <p className="font-semibold text-slate-700">Medicación:</p>
                        <ul className="list-disc list-inside text-slate-600">
                            {data.medications.map((med: string) => <li key={med}>{med}</li>)}
                        </ul>
                    </div>
                )}
                {data.comments && <p className="mt-2 text-slate-600 italic">{`Comentario: "${data.comments}"`}</p>}
            </div>
        );
    }
    return null;
};


function DataDisplay({ selectedDate }: DataDisplayProps) {
    const { healthData } = useAppContext();
    const dailyData = healthData[selectedDate];

    const normalizedDailyData = useMemo(() => {
        if (!dailyData) return null;
        
        const defaultTimeSlotData: TimeSlotData = { value: null, medications: [], comments: '' };
        const normalized: DailyData = {};

        for (const time in dailyData) {
            if (Object.prototype.hasOwnProperty.call(dailyData, time)) {
                const slotData = dailyData[time] && typeof dailyData[time] === 'object' ? dailyData[time] : {};
                normalized[time] = { ...defaultTimeSlotData, ...slotData };
            }
        }
        return normalized;
    }, [dailyData]);


    const hasAnyData = normalizedDailyData && Object.values(normalizedDailyData).some((d: TimeSlotData) => d.value !== null || d.medications.length > 0 || !!d.comments);

    if (!hasAnyData) {
        return <div className="flex items-center justify-center h-96 text-slate-500">No hay datos registrados para este día.</div>;
    }
    
    const hasNumericData = Object.values(normalizedDailyData).some((d: TimeSlotData) => d.value !== null);

    if (!hasNumericData) {
        const entriesWithData = Object.entries(normalizedDailyData)
            .filter(([, data]) => data.medications.length > 0 || !!data.comments)
            .sort(([timeA], [timeB]) => timeA.localeCompare(timeB));

        return (
            <div className="p-4">
                 <div className="flex items-center justify-center text-center h-16 text-slate-500">No hay datos de valor numérico para mostrar en el gráfico, pero se encontraron los siguientes registros.</div>
                 <div className="max-h-[50vh] overflow-y-auto mt-4 space-y-3">
                     {entriesWithData.map(([time, data]) => {
                        return (
                         <div key={time} className="p-3 bg-slate-50 rounded-lg flex items-start gap-4">
                             <span className="font-bold text-slate-700 w-16 pt-0.5">{time}</span>
                             <div className="flex-1 space-y-2">
                                 {data.medications.length > 0 && (
                                     <div className="flex items-start gap-2 text-sm text-slate-800">
                                         <Pill size={16} className="text-green-500 mt-0.5 flex-shrink-0"/>
                                         <span>{data.medications.join(', ')}</span>
                                     </div>
                                 )}
                                 {data.comments && (
                                      <div className="flex items-start gap-2 text-sm text-slate-600">
                                         <MessageSquare size={16} className="text-orange-500 mt-0.5 flex-shrink-0"/>
                                         <span className="italic">"{data.comments}"</span>
                                     </div>
                                 )}
                             </div>
                         </div>
                        )
                     })}
                 </div>
            </div>
        )
    }

    const chartData: ChartDataPoint[] = Object.entries(normalizedDailyData)
        .map(([time, data]: [string, TimeSlotData]) => ({
            time,
            value: data.value,
            medications: data.medications,
            comments: data.comments,
        }))
        .sort((a, b) => a.time.localeCompare(b.time));

    return (
        <div className="h-[60vh] w-full flex flex-col">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                        dataKey="time" 
                        tickFormatter={(tick) => tick.endsWith(':00') ? tick : ''}
                        interval={0}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                    />
                    <YAxis domain={[0, 10]} allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }}/>
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="value" name="Valor" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} connectNulls dot={false}/>

                    {chartData.map((point) => {
                        if (point.value === null) return null;

                        const hasMeds = point.medications.length > 0;
                        const hasComments = !!point.comments;
                        let color = '';

                        if (hasMeds && hasComments) color = '#8B5CF6'; 
                        else if (hasMeds) color = '#10B981'; 
                        else if (hasComments) color = '#F97316';

                        if(color) {
                            return (
                                <ReferenceDot 
                                    key={`dot-${point.time}`} 
                                    x={point.time} 
                                    y={point.value} 
                                    r={6} 
                                    fill={color}
                                    stroke="#fff"
                                    strokeWidth={2}
                                />
                            );
                        }
                        return null;
                    })}
                </LineChart>
            </ResponsiveContainer>
            
            <div className="flex justify-center items-center gap-6 mt-4 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10B981' }}></span>
                    <span>Medicación</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F97316' }}></span>
                    <span>Comentario</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8B5CF6' }}></span>
                    <span>Ambos</span>
                </div>
            </div>
        </div>
    );
}


// =================================================================================
// COMPONENT: MedicationManager (from components/medication/MedicationManager.tsx)
// =================================================================================

function MedicationManager() {
    const { medications, addMedication, editMedication, deleteMedication, isLoading } = useAppContext();
    const [newMed, setNewMed] = useState('');
    const [editingMed, setEditingMed] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleAdd = async () => {
        if (newMed.trim() && !medications.includes(newMed.trim())) {
            setIsSaving(true);
            await addMedication(newMed.trim());
            setNewMed('');
            setIsSaving(false);
        }
    };

    const handleEdit = async (med: string) => {
        if (editText.trim() && editText.trim() !== med) {
            setIsSaving(true);
            await editMedication(med, editText.trim());
            setIsSaving(false);
        }
        setEditingMed(null);
        setEditText('');
    };
    
    const handleDelete = async (med: string) => {
        setIsSaving(true);
        await deleteMedication(med);
        setIsSaving(false);
    }

    const startEditing = (med: string) => {
        setEditingMed(med);
        setEditText(med);
    }
    
    if (isLoading) {
        return <div className="text-center p-8">Cargando medicamentos...</div>
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-slate-700 mb-4">Gestionar Lista de Medicamentos</h2>
            
            <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={newMed}
                    onChange={(e) => setNewMed(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    placeholder="Añadir nuevo medicamento"
                    className="flex-grow p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    disabled={isSaving}
                />
                <button onClick={handleAdd} disabled={isSaving || !newMed.trim()} className="px-4 py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:bg-blue-400">
                    <Plus size={16}/> Añadir
                </button>
            </div>

            <div className="space-y-3">
                {medications.length > 0 ? medications.map(med => (
                    <div key={med} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg min-h-[52px]">
                        {editingMed === med ? (
                             <input
                                type="text"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleEdit(med)}
                                autoFocus
                                onBlur={() => handleEdit(med)}
                                className="flex-grow p-1 border-b-2 border-blue-500 focus:outline-none bg-transparent"
                                disabled={isSaving}
                            />
                        ) : (
                            <span className="text-slate-800">{med}</span>
                        )}
                        <div className="flex gap-2">
                             {editingMed === med ? (
                                <button onClick={() => handleEdit(med)} disabled={isSaving} className="p-2 text-slate-500 hover:text-green-600 hover:bg-slate-200 rounded-full"><Check size={16}/></button>
                             ) : (
                                <>
                                <button onClick={() => startEditing(med)} disabled={isSaving} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-200 rounded-full"><Edit size={16}/></button>
                                <button onClick={() => handleDelete(med)} disabled={isSaving} className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-200 rounded-full"><Trash2 size={16}/></button>
                                </>
                             )}
                        </div>
                    </div>
                )) : (
                    <p className="text-slate-500 text-center py-4">No hay medicamentos en la lista.</p>
                )}
            </div>
        </div>
    );
}


// =================================================================================
// COMPONENT: StandardPatternManager (from components/medication/StandardPatternManager.tsx)
// =================================================================================

function StandardPatternManager() {
    const { medications, standardPattern, updateStandardPattern, isLoading } = useAppContext();
    const [pattern, setPattern] = useState<StandardPattern>({});
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        setPattern(standardPattern);
    }, [standardPattern]);

    const handleMedicationChange = (time: string, selectedMeds: string[]) => {
        setPattern(prevPattern => ({
            ...prevPattern,
            [time]: selectedMeds
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const cleanedPattern = Object.entries(pattern).reduce((acc, [time, meds]: [string, string[]]) => {
            if (meds && meds.length > 0) {
                acc[time] = meds;
            }
            return acc;
        }, {} as StandardPattern);
        
        await updateStandardPattern(cleanedPattern);
        setIsSaving(false);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
    };

    if (isLoading) {
        return <div className="text-center p-8">Cargando patrón estándar...</div>
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-700">Patrón de Medicación Estándar</h2>
                 <div className="flex items-center gap-3">
                    {showSuccess && <span className="text-sm text-green-600">¡Patrón guardado!</span>}
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:bg-blue-400"
                    >
                        <Save size={16}/> {isSaving ? 'Guardando...' : 'Guardar Patrón'}
                    </button>
                </div>
            </div>
            <p className="text-sm text-slate-500 mb-6">
                Configure un patrón de medicación estándar. Puede aplicar este patrón en la pantalla de ingreso de datos para rellenar automáticamente la medicación de un día.
            </p>

            <div className="max-h-[60vh] overflow-y-auto pr-2 -mr-2 space-y-4">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-[1]">
                        <tr>
                            <th scope="col" className="px-3 py-3 w-1/4">Hora</th>
                            <th scope="col" className="px-3 py-3 w-3/4">Medicación</th>
                        </tr>
                    </thead>
                    <tbody>
                        {TIME_SLOTS.map(time => (
                            <tr key={time} className="bg-white border-b border-slate-200">
                                <td className="px-3 py-2 font-medium text-slate-900">{time}</td>
                                <td className="px-3 py-2">
                                     <select
                                        multiple
                                        value={pattern[time] || []}
                                        onChange={(e) => handleMedicationChange(time, Array.from(e.target.selectedOptions, option => option.value))}
                                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 h-24"
                                    >
                                        {medications.map(med => <option key={med} value={med}>{med}</option>)}
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


// =================================================================================
// COMPONENT: App (from App.tsx)
// =================================================================================

type View = 'tracker' | 'medications' | 'pattern';
type TrackerTab = 'input' | 'chart';

function App() {
    const { currentUser, logout, isLoading } = useAppContext();
    const [currentDate, setCurrentDate] = useState(new Date()); 
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [view, setView] = useState<View>('tracker');
    const [trackerTab, setTrackerTab] = useState<TrackerTab>('input');
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const calendarRef = useRef<HTMLDivElement>(null);

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

// =================================================================================
// APP INITIALIZATION (from index.tsx)
// =================================================================================

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <AppProvider>
            <App />
        </AppProvider>
    </React.StrictMode>
);
