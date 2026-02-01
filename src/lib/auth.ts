import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    AppleProvider({
      clientId: process.env.APPLE_ID || "",
      clientSecret: process.env.APPLE_SECRET || "",
    }),
    // Microsoft/Azure AD provider
    {
      id: "azure-ad",
      name: "Microsoft",
      type: "oauth",
      wellKnown: "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
      authorization: { params: { scope: "openid profile email" } },
      clientId: process.env.AZURE_AD_CLIENT_ID || "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || "",
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        }
      },
    },
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Log sign in attempt
      console.log('[AUTH] Sign in attempt:', {
        userId: user.id,
        email: user.email,
        provider: account?.provider
      });

      // Ensure user exists with proper defaults
      if (user.email) {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email }
          });

          if (!existingUser) {
            console.log('[AUTH] Creating new user with defaults');
          } else {
            console.log('[AUTH] User exists:', {
              id: existingUser.id,
              plan: existingUser.plan,
              credits: existingUser.monthlyCredits,
              used: existingUser.creditsUsed
            });
          }
        } catch (error) {
          console.error('[AUTH] Error checking user:', error);
        }
      }

      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            plan: true,
            monthlyCredits: true,
            creditsUsed: true,
            stripeCustomerId: true,
            stripeSubscriptionId: true,
            stripeCurrentPeriodEnd: true,
          },
        });

        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.plan = dbUser.plan;
          session.user.monthlyCredits = dbUser.monthlyCredits;
          session.user.creditsUsed = dbUser.creditsUsed;
          session.user.stripeCustomerId = dbUser.stripeCustomerId;
          session.user.stripeSubscriptionId = dbUser.stripeSubscriptionId;
          session.user.stripeCurrentPeriodEnd = dbUser.stripeCurrentPeriodEnd;
        } else {
          console.warn('[AUTH] User not found in database:', user.id);
        }
      }
      return session
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  session: {
    strategy: "database",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  events: {
    async createUser({ user }) {
      console.log('[AUTH] New user created:', {
        id: user.id,
        email: user.email,
      });

      // Verify user was created with default credits
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            email: true,
            plan: true,
            monthlyCredits: true,
            creditsUsed: true,
          }
        });
        console.log('[AUTH] User created in DB:', dbUser);
      } catch (error) {
        console.error('[AUTH] Error verifying new user:', error);
      }
    },
    async signIn({ user, account }) {
      console.log('[AUTH] User signed in:', {
        userId: user.id,
        email: user.email,
        provider: account?.provider
      });
    }
  }
}
