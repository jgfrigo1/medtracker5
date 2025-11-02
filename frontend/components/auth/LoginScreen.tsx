
import React from 'react';
import { useAppContext } from '../../context/AppContext.tsx';

export default function LoginScreen() {
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