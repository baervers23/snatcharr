import NextAuth, { type DefaultSession } from "next-auth";

import Credentials from "next-auth/providers/credentials";

import { db } from "@/lib/db";

import { users } from "@/lib/db/schema";

import type { User } from "@/lib/db/schema";

import { eq } from "drizzle-orm";

import bcrypt from "bcryptjs";

import { z } from "zod";

import { getSetting } from "@/lib/db/settings";

import {
  authenticateExternal,
  authenticateExternalWithFallback,
  resolvesJellyfinUserId,
} from "@/lib/external-auth";

import { resolveEmailOnAuthImport } from "@/lib/email-sync";

import { trustedExternalEmailPatch } from "@/lib/email-verification";

import { logActionFail, logAudit, logEvent } from "@/lib/audit";



declare module "next-auth" {

  interface Session {

    user: {

      id: string;

      role: "admin" | "user";

      username: string;

    } & DefaultSession["user"];

  }



  interface User {

    id?: string;

    role: "admin" | "user";

    username: string;

  }

}



const loginSchema = z.object({

  username: z.string().min(1),

  password: z.string().min(1),

});



async function tryAdminLocalLogin(

  existing: User | undefined,

  password: string,

): Promise<typeof users.$inferSelect | null> {

  if (!existing?.isActive || existing.role !== "admin") return null;

  const valid = await bcrypt.compare(password, existing.passwordHash);

  if (!valid) return null;

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, existing.id));

  logEvent("auth.login", {

    username: existing.username,

    details: "admin local fallback",

    level: "info",

  });

  return existing;

}



async function tryLocalLogin(

  existing: User | undefined,

  password: string,

): Promise<typeof users.$inferSelect | null> {

  if (!existing?.isActive) return null;

  const valid = await bcrypt.compare(password, existing.passwordHash);

  if (!valid) return null;

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, existing.id));

  logEvent("auth.login", {

    username: existing.username,

    details: "local fallback",

    level: "info",

  });

  return existing;

}



function sessionUserFromRow(row: typeof users.$inferSelect) {

  return {

    id: row.id,

    name: row.username,

    email: row.email ?? undefined,

    username: row.username,

    role: row.role as "admin" | "user",

  };

}



export const { handlers, signIn, signOut, auth } = NextAuth({

  pages: {

    signIn: "/login",

    error: "/login",

  },

  session: {

    strategy: "jwt",

    maxAge: 60 * 60 * 24,

  },

  callbacks: {

    async jwt({ token, user }) {

      if (user) {

        token.id = user.id;

        token.role = user.role;

        token.username = user.username;

        token.email = user.email ?? null;

        return token;

      }



      if (token.id) {

        const dbUser = await db.query.users.findFirst({

          where: eq(users.id, token.id as string),

          columns: { role: true, username: true, email: true, isActive: true },

        });

        if (!dbUser || !dbUser.isActive) {

          return null;

        }

        token.role = dbUser.role;

        token.username = dbUser.username;

        token.email = dbUser.email ?? null;

      }



      return token;

    },

    async session({ session, token }) {

      if (token) {

        session.user.id = token.id as string;

        session.user.role = token.role as "admin" | "user";

        session.user.username = token.username as string;

        session.user.email =
          typeof token.email === "string" ? token.email : "";

      }

      return session;

    },

  },

  providers: [

    Credentials({

      name: "credentials",

      credentials: {

        username: { label: "Username", type: "text" },

        password: { label: "Password", type: "password" },

      },

      async authorize(credentials) {

        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) return null;



        const { username, password } = parsed.data;

        const authMethod = await getSetting("authMethod");
        const authFallbackMethod = await getSetting("authFallbackMethod");

        if (authMethod !== "local") {

          const ext = await authenticateExternalWithFallback(
            authMethod,
            authFallbackMethod,
            username,
            password,
          );

          const identityUsername = ext.username ?? username;

          const existing = await db.query.users.findFirst({

            where: eq(users.username, identityUsername),

          });



          if (!ext.ok) {

            if (authFallbackMethod === "local") {

              const localUser = await tryLocalLogin(existing, password);

              if (localUser) return sessionUserFromRow(localUser);

            }



            const admin =

              authMethod === "organizr-sso"

                ? null

                : await tryAdminLocalLogin(existing, password);

            if (admin) {

              return sessionUserFromRow(admin);

            }



            logEvent("auth.failed", {

              username: identityUsername,

              details: `via ${authMethod}: ${ext.error ?? "invalid credentials"}`,

              level: "warn",

            });

            return null;

          }



          const passwordHash = await bcrypt.hash(password, 10);



          if (!existing) {

            await logAudit("user.create", {

              username: identityUsername,

              details: `auto-created via ${ext.via ?? authMethod}${ext.email ? ` (${ext.email})` : ""}`,

            });

            logEvent("auth.import", {

              username: identityUsername,

              details: `from ${ext.via ?? authMethod}${ext.email ? ` — ${ext.email}` : ""}`,

            });



            const jellyfinUserId = resolvesJellyfinUserId(authMethod, ext.via)
              ? ext.externalId ?? null
              : null;

            const { email: syncedEmail, syncedFromApp } = await resolveEmailOnAuthImport({
              authMethod,
              via: ext.via ?? authMethod,
              username: identityUsername,
              snatcharrEmail: null,
              authEmail: ext.email,
              jellyfinUserId,
            });

            const emailTrustPatch = trustedExternalEmailPatch(syncedEmail, true);

            const [created] = await db

              .insert(users)

              .values({

                username: identityUsername,

                email: syncedEmail?.trim() || null,

                ...emailTrustPatch,

                avatarUrl: ext.avatarUrl ?? null,

                passwordHash,

                role: "user",

                jellyfinUserId,

                imported: true,

                canGrab: true,

                canDownload: true,

                isActive: true,

                lastLoginAt: new Date(),

              })

              .returning();



            logEvent("auth.login", { username, details: `via ${ext.via ?? authMethod}` });



            return {

              id: created.id,

              name: created.username,

              email: created.email ?? undefined,

              username: created.username,

              role: created.role as "admin" | "user",

            };

          }



          if (!existing.isActive) {
            logActionFail("AUTH", "login", "denied", {
              username: existing.username,
              details: "account disabled",
            });
            return null;
          }



          const jellyfinUserId =
            existing.jellyfinUserId ??
            (resolvesJellyfinUserId(authMethod, ext.via) ? ext.externalId ?? null : null);

          const { email: syncedEmail, syncedFromApp } = await resolveEmailOnAuthImport({
            authMethod,
            via: ext.via ?? authMethod,
            username: existing.username,
            snatcharrEmail: existing.email,
            authEmail: ext.email,
            jellyfinUserId,
          });

          const emailTrustPatch = trustedExternalEmailPatch(
            syncedEmail,
            syncedFromApp || !!ext.email?.trim(),
          );

          const loginPatch: Record<string, unknown> = {
            passwordHash,
            avatarUrl: existing.avatarUrl ?? ext.avatarUrl ?? null,
            jellyfinUserId,
            lastLoginAt: new Date(),
            ...emailTrustPatch,
          };
          if (syncedEmail?.trim()) {
            loginPatch.email = syncedEmail.trim();
          }

          await db

            .update(users)

            .set(loginPatch)

            .where(eq(users.id, existing.id));



          logEvent("auth.login", {

            username: existing.username,

            details: `via ${ext.via ?? authMethod}${syncedFromApp ? " (email synced)" : ""}`,

          });



          return {

            id: existing.id,

            name: existing.username,

            email: syncedEmail ?? existing.email ?? undefined,

            username: existing.username,

            role: existing.role as "admin" | "user",

          };

        }



        const existing = await db.query.users.findFirst({

          where: eq(users.username, username),

        });

        if (!existing || !existing.isActive) {

          logEvent("auth.failed", { username, details: "local: user not found", level: "warn" });

          return null;

        }



        const valid = await bcrypt.compare(password, existing.passwordHash);

        if (!valid) {

          if (authFallbackMethod !== "none" && authFallbackMethod !== "local") {

            const ext = await authenticateExternal(authFallbackMethod, username, password);

            if (ext.ok) {

              const passwordHash = await bcrypt.hash(password, 10);

              await db

                .update(users)

                .set({ passwordHash, lastLoginAt: new Date() })

                .where(eq(users.id, existing.id));

              logEvent("auth.login", {

                username: existing.username,

                details: `via fallback ${authFallbackMethod}`,

              });

              return sessionUserFromRow(existing);

            }

          }

          logEvent("auth.failed", { username, details: "local: wrong password", level: "warn" });

          return null;

        }



        await db

          .update(users)

          .set({ lastLoginAt: new Date() })

          .where(eq(users.id, existing.id));



        logEvent("auth.login", { username, details: "local" });



        return {

          id: existing.id,

          name: existing.username,

          email: existing.email ?? undefined,

          username: existing.username,

          role: existing.role as "admin" | "user",

        };

      },

    }),

  ],

});


