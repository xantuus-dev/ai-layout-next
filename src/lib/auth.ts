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
}
