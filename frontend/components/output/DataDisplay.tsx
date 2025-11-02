
import React, { useMemo } from 'react';
import { useAppContext } from '../../context/AppContext.tsx';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceDot } from 'recharts';
import { Pill, MessageSquare } from 'lucide-react';
import type { DailyData, TimeSlotData } from '../../types.ts';

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


export default function DataDisplay({ selectedDate }: DataDisplayProps) {
    const { healthData } = useAppContext();
    const dailyData = healthData[selectedDate];

    // FIX: Normalize dailyData to prevent runtime errors from partial data objects.
    // This ensures every time slot object has the complete TimeSlotData structure.
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

    // If there is data, but none of it is numeric for the chart, render a list view instead.
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

                    {/* Render custom dots for events */}
                    {chartData.map((point) => {
                        if (point.value === null) return null;

                        const hasMeds = point.medications.length > 0;
                        const hasComments = !!point.comments;
                        let color = '';

                        if (hasMeds && hasComments) color = '#8B5CF6'; // violet-500
                        else if (hasMeds) color = '#10B981'; // green-500
                        else if (hasComments) color = '#F97316'; // orange-500

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
            
            {/* Custom Legend */}
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