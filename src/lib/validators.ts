import { z } from 'zod';

export const signupSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  type: z.enum(['REGULAR', 'BRAND']).optional(),
  brandFullName: z.string().optional(),
  cacNumber: z.string().optional(),
  tin: z.string().optional(),
  ceoNin: z.string().optional(),
  companyLocation: z.string().optional(),
});

export type SignupFormValues = z.infer<typeof signupSchema>;
