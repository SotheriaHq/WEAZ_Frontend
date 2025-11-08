import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AccessApi from '@/api/AccessApi';
import { FrostedButton } from '@/components/ui/FrostedButton';
import { toast } from 'react-toastify';

const AcceptInvite: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'accepting' | 'success' | 'error'>(
    'idle',
  );
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    if (!token) {
      setMessage('No invite token found in URL.');
      setStatus('error');
      return;
    }
    const run = async () => {
      setStatus('accepting');
      try {
        const res = await AccessApi.acceptInvite(token);
        if (res?.success) {
          setStatus('success');
          setMessage('Invite accepted. You now have access to the collection.');
          toast.success('Invite accepted');
        } else {
          setStatus('error');
          setMessage('Could not accept invite.');
        }
      } catch (e: any) {
        setStatus('error');
        setMessage(
          e?.response?.data?.message ?? 'Could not accept invite. Please try again.',
        );
        toast.error('Invite acceptance failed');
      }
    };
    void run();
  }, [location.search]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-12">
      <div className="glass-panel border border-white/20 bg-white/10 px-6 py-8 backdrop-blur-xl text-white">
        <h1 className="text-xl font-bold mb-2">Accept Collection Invite</h1>
        {status === 'accepting' ? (
          <p className="text-white/80">Accepting invite…</p>
        ) : (
          <p className="text-white/80">{message}</p>
        )}
        <div className="mt-4 flex gap-3">
          <FrostedButton variant="primary" onClick={() => navigate(-1)}>
            Go Back
          </FrostedButton>
          <FrostedButton variant="ghost" onClick={() => navigate('/')}>Home</FrostedButton>
        </div>
      </div>
    </div>
  );
};

export default AcceptInvite;

