const { z } = require('zod');

const email = z.string().trim().toLowerCase().email('Please enter a valid email address').max(191);

const name = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be at most 100 characters');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a number');

const registerSchema = z.object({
  name,
  email,
  password,
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z
  .object({ name: name.optional(), email: email.optional() })
  .refine((data) => data.name !== undefined || data.email !== undefined, 'Nothing to update');

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });

module.exports = { registerSchema, loginSchema, updateProfileSchema, changePasswordSchema };
