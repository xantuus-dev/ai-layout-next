import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      plan?: string
      monthlyCredits?: number
      creditsUsed?: number
      stripeCustomerId?: string | null
      stripeSubscriptionId?: string | null
      stripeCurrentPeriodEnd?: Date | null
    }
  }
}
