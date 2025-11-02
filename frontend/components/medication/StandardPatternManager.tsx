
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext.tsx';
import { TIME_SLOTS } from '../../constants.ts';
import type { StandardPattern } from '../../types.ts';
import { Save } from 'lucide-react';

export default function StandardPatternManager() {
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
        // Clean up empty entries before saving
        // FIX: Explicitly type the parameters `time` and `meds` to resolve 'unknown' type errors.
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