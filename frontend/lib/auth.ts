import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '@/lib/mongodb';
import { UserModel } from '@/models/User';
import { FreelancerCategory, UserRole } from '@/types';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Email and Password',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'your@email.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter both email and password.');
        }

        await connectToDatabase();

        const user = await UserModel.findOne({
          email: credentials.email.toLowerCase().trim(),
        });

        if (!user) {
          throw new Error('No user found with this email. Please sign up.');
        }

        if (user.password) {
          const isMatch = await bcrypt.compare(credentials.password, user.password);
          if (!isMatch) {
            throw new Error('Invalid email or password.');
          }
        }

        const isProfileComplete = Boolean(
          user.isProfileComplete ||
          user.role === 'merchant' ||
          (
            user.title && String(user.title).trim().length > 0 &&
            user.bio && String(user.bio).trim().length > 0 &&
            user.hourlyRate && Number(user.hourlyRate) > 0 &&
            Array.isArray(user.skills) && user.skills.length > 0 &&
            user.yearsOfExperience !== undefined && user.yearsOfExperience !== null && Number(user.yearsOfExperience) >= 0 &&
            user.typicalDeliveryDays !== undefined && user.typicalDeliveryDays !== null && Number(user.typicalDeliveryDays) >= 1 &&
            user.location && String(user.location).trim().length > 0
          )
        );

        if (isProfileComplete && !user.isProfileComplete && user.role === 'freelancer') {
          await UserModel.updateOne({ _id: user._id }, { $set: { isProfileComplete: true } });
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          category: user.category,
          isProfileComplete,
        } as any;
      },
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // If relative path, keep it relative so browser stays on current domain (Vercel, custom domain, or localhost)
      if (url.startsWith('/')) {
        return url;
      }
      try {
        const parsed = new URL(url);
        // If pointing to localhost while deployed or in browser, strip to relative path
        if (parsed.hostname === 'localhost') {
          return `${parsed.pathname}${parsed.search}`;
        }
        // If baseUrl exists and has same origin, allow it
        if (baseUrl && parsed.origin === new URL(baseUrl).origin) {
          return url;
        }
      } catch {}
      return url.startsWith('/') ? url : '/login';
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.category = (user as any).category;
        token.isProfileComplete = (user as any).isProfileComplete;
      }
      if (trigger === 'update' && session) {
        if (session.isProfileComplete !== undefined) {
          token.isProfileComplete = Boolean(session.isProfileComplete);
        }
      } else if (token?.email && token?.role === 'freelancer' && !token?.isProfileComplete) {
        // Self-heal stale JWT if database already has profile completed
        try {
          await connectToDatabase();
          const dbUser = await UserModel.findOne({ email: (token.email as string).toLowerCase() })
            .select('isProfileComplete')
            .lean();
          if (dbUser?.isProfileComplete) {
            token.isProfileComplete = true;
          }
        } catch {}
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).category = token.category;
        (session.user as any).isProfileComplete = token.isProfileComplete;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET || 'gigsaw_secret_key_at_least_32_chars_long_1234567890',
};
