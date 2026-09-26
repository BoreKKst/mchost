import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSession,
  deleteSessionByToken,
  findSessionByToken
} from "../lib/session.js";

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(100)
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(100)
});

function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS
  });
}

function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/register", async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_input", details: parsed.error.flatten() });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return reply.code(409).send({ error: "email_taken" });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const now = Math.floor(Date.now() / 1000);
    const userId = randomUUID();

    const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const role = adminEmails.includes(email) ? "admin" : "user";

    await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      role,
      createdAt: now
    });

    const { token } = await createSession(userId, req.headers["user-agent"] ?? null, req.ip);
    setSessionCookie(reply, token);

    return reply.code(201).send({
      user: { id: userId, email, role }
    });
  });

  app.post("/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_input", details: parsed.error.flatten() });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    if (!user) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const { token } = await createSession(user.id, req.headers["user-agent"] ?? null, req.ip);
    setSessionCookie(reply, token);

    return reply.code(200).send({
      user: { id: user.id, email: user.email, role: user.role }
    });
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) {
      await deleteSessionByToken(token);
    }
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get("/auth/me", async (req: FastifyRequest, reply: FastifyReply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (!token) {
      return reply.code(401).send({ error: "not_authenticated" });
    }

    const found = await findSessionByToken(token);
    if (!found) {
      clearSessionCookie(reply);
      return reply.code(401).send({ error: "session_expired" });
    }

    return reply.code(200).send({
      user: { id: found.user.id, email: found.user.email, role: found.user.role }
    });
  });
}
