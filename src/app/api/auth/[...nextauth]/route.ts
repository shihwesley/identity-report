import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import GitHub from 'next-auth/providers/github';

const { handlers } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // After OAuth, user needs to complete mnemonic setup
      console.log('OAuth sign in:', user.email);
      return true;
    },
    async redirect({ baseUrl }) {
      // Redirect OAuth users to onboarding to set up mnemonic
      return `${baseUrl}/onboarding?email=true`;
    },
    async session({ session, token }) {
      // Add custom fields to session
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: '/signin',
    error: '/signin',
  },
});

export const { GET, POST } = handlers;
