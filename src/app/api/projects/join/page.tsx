'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function JoinProjectPage({ params }: { params: { pr_id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function acceptInvitation() {
      if (!token) {
        setStatus('error');
        setMessage('Token manquant');
        return;
      }

      try {
        // Appel API pour accepter l'invitation
        const response = await fetch('/api/invitations/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage('Invitation acceptée ! Redirection...');
          
          // Redirection vers le projet après 2 secondes
          setTimeout(() => {
            router.push(`/projects/${params.pr_id}`);
          }, 2000);
        } else {
          setStatus('error');
          setMessage(data.error || 'Erreur lors de l\'acceptation');
        }
      } catch (error) {
        setStatus('error');
        setMessage('Erreur de connexion au serveur');
      }
    }

    acceptInvitation();
  }, [token, params.pr_id, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        {status === 'loading' && <p>Traitement de votre invitation...</p>}
        {status === 'success' && <p className="text-green-600">{message}</p>}
        {status === 'error' && <p className="text-red-600">{message}</p>}
      </div>
    </div>
  );
}