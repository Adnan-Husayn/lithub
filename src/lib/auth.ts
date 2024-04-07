import { db } from '@/lib/db'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { nanoid } from 'nanoid'
import { NextAuthOptions, getServerSession } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("Google client ID or secret is not set in the environment variables.")
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/sign-in',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async session({ token, session }) {
      // Assume token is always present for simplicity, check in real app
      session.user.id = token.id
      session.user.name = token.name
      session.user.email = token.email
      session.user.image = token.picture
      session.user.username = token.username
      return session
    },

    async jwt({ token, user }) {
      try {
        const email = token.email ?? user?.email
        if (!email) return token

        const dbUser = await db.user.findFirst({
          where: { email },
        })

        if (dbUser) {
          if (!dbUser.username) {
            await db.user.update({
              where: {
                id: dbUser.id,
              },
              data: {
                username: nanoid(10),
              },
            })
          }

          token.id = dbUser.id
          token.name = dbUser.name
          token.email = dbUser.email
          token.picture = dbUser.image
          token.username = dbUser.username
        }
        
        return token
      } catch (error) {
        console.error("JWT callback error:", error)
        return token
      }
    },
    async redirect() {
      // Ensure redirects are safe and not leading off-site
      return '/' 
    },
  },
}

export const getAuthSession = () => getServerSession(authOptions)
