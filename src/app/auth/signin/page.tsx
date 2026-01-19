'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

function SignInContent() {
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || 'http://localhost:3000/edit-home';
    const error = searchParams.get('error');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1200);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] font-sans text-[#1e293b]">
            <div className="max-w-[420px] w-full mx-4">
                <div className="text-center mb-10">
                    <img
                        src="/logo-pro.png"
                        alt="XCCM2 Logo"
                        className="h-16 mx-auto mb-2 object-contain"
                    />
                </div>

                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 p-8 md:p-10">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Se connecter
                        </h1>
                        <p className="text-slate-500 mt-2 text-sm">
                            Utilisez votre compte professionnel pour continuer
                        </p>
                    </div>

                    {loading ? (
                        <div className="py-10 flex flex-col items-center gap-4">
                            <div className="w-10 h-10 border-[3px] border-[#99334C] border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-sm font-medium text-slate-400">Préparation de la session...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {error && (
                                <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
                                    <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="text-sm text-red-800">
                                        <p className="font-semibold">Erreur d'authentification</p>
                                        <p className="opacity-80">Un problème est survenu : {error}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-4">
                                <button
                                    onClick={() => signIn('google', { callbackUrl })}
                                    className="w-full h-12 rounded-xl bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all flex items-center justify-center gap-3 shadow-sm active:scale-[0.98]"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    Continuer avec Google
                                </button>

                                <button
                                    onClick={() => signIn('azure-ad', { callbackUrl })}
                                    className="w-full h-12 rounded-xl bg-[#2f2f2f] border border-[#2f2f2f] text-white font-semibold hover:bg-black transition-all flex items-center justify-center gap-3 shadow-sm active:scale-[0.98]"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 23 23">
                                        <path fill="#f35325" d="M1 1h10v10H1z" />
                                        <path fill="#81bc06" d="M12 1h10v10H12z" />
                                        <path fill="#05a6f0" d="M1 12h10v10H1z" />
                                        <path fill="#ffba08" d="M12 12h10v10H12z" />
                                    </svg>
                                    Continuer avec Microsoft
                                </button>
                            </div>

                            <div className="relative py-4">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-100"></div>
                                </div>
                                <div className="relative flex justify-center">
                                    <span className="bg-white px-4 text-xs font-medium text-slate-400 uppercase tracking-widest">
                                        Assistance
                                    </span>
                                </div>
                            </div>

                            <a
                                href="http://localhost:3000/login"
                                className="block text-center text-sm font-medium text-[#99334C] hover:text-[#7a283d] transition-colors"
                            >
                                Retour à la connexion classique
                            </a>
                        </div>
                    )}
                </div>

                <div className="mt-8 text-center">
                    <p className="text-slate-400 text-xs">
                        &copy; {new Date().getFullYear()} XCCM Pro. Tous droits réservés.<br />
                        En continuant, vous acceptez nos <a href="#" className="underline hover:text-slate-600">Conditions</a>.
                    </p>
                </div>
            </div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-spin {
                    animation: spin 0.8s linear infinite;
                }
            `}</style>
        </div>
    );
}

export default function SignInPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
                <div className="w-10 h-10 border-[3px] border-[#99334C] border-t-transparent rounded-full animate-spin"></div>
            </div>
        }>
            <SignInContent />
        </Suspense>
    );
}
