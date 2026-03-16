import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ token }) => typeof token?.appUserId === "string" && token.appUserId.length > 0
  },
  pages: {
    signIn: "/login"
  },
  secret: process.env.AUTH_SECRET
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/tasks/:path*",
    "/api/events/:path*",
    "/api/routines/:path*",
    "/api/settings/:path*",
    "/api/agenda/:path*"
  ]
};
