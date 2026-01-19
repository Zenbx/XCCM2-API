'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ErrorContent() {
    const searchParams = useSearchParams();
    const error = searchParams.get('error');

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] font-sans p-4">
            <div className="max-w-[420px] w-full">
                <div className="text-center mb-10">
                    <img
                        src="/logo-pro.png"
                        alt="XCCM2 Logo"
                        className="h-16 mx-auto object-contain"
                    />
                </div>

                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 p-8 md:p-10 text-center">
                    <div className="mb-8">
                        <div className="w-16 h-16 mx-auto bg-red-50 rounded-full flex items-center justify-center border border-red-100 mb-6">
                            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                            Échec de la connexion
                        </h1>
                        <p className="text-slate-500 mt-2 text-sm">
                            Un problème est survenu lors de l'authentification.
                        </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-8 overflow-hidden">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1.5">Code d'erreur système</p>
                        <p className="text-sm font-mono text-slate-700 bg-white/50 py-1 rounded border border-slate-100 truncate">
                            {error || 'ERR_UNKNOWN_AUTH'}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Nous vous prions de nous excuser pour ce désagrément. Veuillez réessayer ou contacter votre administrateur si le problème persiste.
                        </p>

                        <div className="flex flex-col gap-3 pt-4">
                            <a
                                href="http://localhost:3000/login"
                                className="w-full h-12 rounded-xl bg-[#99334C] text-white font-bold hover:bg-[#7a283d] transition-all flex items-center justify-center gap-2 shadow-sm active:scale-[0.98]"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                Retour à l'application
                            </a>
                            <a
                                href="/api/auth/signin"
                                className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-wider"
                            >
                                Réessayer maintenant
                            </a>
                        </div>
                    </div>
                </div>

                <p className="mt-10 text-center text-slate-400 text-xs">
                    Besoin d'aide ? Consultez notre <a href="#" className="underline">centre d'assistance</a>.
                </p>
            </div>
        </div>
    );
}

export default function AuthErrorPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <div className="w-10 h-10 border-[3px] border-red-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <ErrorContent />
        </Suspense>
    );
}
