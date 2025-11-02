
import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext.tsx';
import { Plus, Edit, Trash2, Check } from 'lucide-react';

export default function MedicationManager() {
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