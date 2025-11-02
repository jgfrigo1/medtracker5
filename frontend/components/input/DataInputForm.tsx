
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext.tsx';
import { TIME_SLOTS } from '../../constants.ts';
import type { DailyData, TimeSlotData } from '../../types.ts';
import { Save, ClipboardPaste } from 'lucide-react';

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

export default function DataInputForm({ selectedDate }: DataInputFormProps) {
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
                    // Combine existing meds with pattern, avoiding duplicates
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
                        {/* FIX: Use a block to create a typed variable for the time slot data, resolving 'unknown' type errors on its properties. */}
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