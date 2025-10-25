import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/httpClient';

const verifySchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  code: z.string().min(6, { message: 'Code must be 6 characters' }),
});

type VerifyFormValues = z.infer<typeof verifySchema>;

const EmailVerifyPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
  formState: { errors },
  } = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
  });

  const onSubmit = async (data: VerifyFormValues) => {
    try {
      await apiClient.post('/auth/verify-email-code', data);
      toast.success('Email verified successfully!');
      navigate('/success');
    } catch (error: unknown) {
      let errorMessage = 'Verification failed.';
      if (isAxiosError(error) && error.response) {
        const data = (error.response.data as { message?: string } | undefined);
        if (data?.message) errorMessage = data.message;
      }
      toast.error(errorMessage);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#7C3AED] via-[#A78BFA] to-[#F3E8FF]">
      <div className="w-full max-w-md bg-white/90 rounded-3xl shadow-2xl p-10 flex flex-col items-center">
        <h1 className="text-2xl font-bold text-[#7C3AED] mb-4">Verify Your Email</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-5">
          <div>
            <input {...register('email')} placeholder="Email" className="w-full bg-gray-100 border border-gray-300 rounded-lg px-4 py-3" />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <input {...register('code')} placeholder="Verification Code" className="w-full bg-gray-100 border border-gray-300 rounded-lg px-4 py-3" />
            {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
          </div>
          <button type="submit" className="w-full bg-[#7C3AED] text-white font-bold py-3 rounded-lg">Verify</button>
        </form>
      </div>
    </div>
  );
};

export default EmailVerifyPage;
