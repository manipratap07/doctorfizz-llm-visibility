import { z } from "zod";
export const brandSchema = z.object({
  name: z.string().trim().min(2).max(100),
  aliases: z.array(z.string().trim().min(2).max(80)).max(10).default([]),
  domain: z.string().max(253),
});
export const profileSchema = z.object({
  category: z.string().trim().min(2).max(100),
  subCategory: z.string().max(100),
  primaryOffering: z.string().max(150),
  targetAudience: z.string().trim().min(2).max(100),
  isLocalBusiness: z.boolean(),
  location: z.string().max(100),
  language: z.string().max(40),
  confidence: z.number().min(0).max(1),
});
export const analyzeSchema = z.object({
  url: z.string().trim().min(3).max(2048),
  name: z.string().trim().min(2).max(100),
  aliases: z.array(z.string().max(80)).max(10).default([]),
  location: z.string().max(100).default(""),
  category: z.string().max(100).default(""),
});
export const checkSchema = z.object({
  profileId: z.uuid(),
  promptId: z.uuid(),
  providers: z.array(z.string()).min(1).max(12),
  turnstileToken: z.string().max(2048),
  idempotencyKey: z.uuid(),
});
export const leadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  phone: z.string().max(40).default(""),
  consent: z.literal(true),
});
export const entitySchema = z.object({
  entities: z
    .array(
      z.object({
        name: z.string().max(100),
        position: z.number().int().positive().nullable(),
        snippet: z.string().min(1).max(1500),
        sentiment: z.enum(["positive", "neutral", "negative"]),
      }),
    )
    .max(40),
});
