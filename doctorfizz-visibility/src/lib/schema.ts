import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
export const visitors = pgTable("visitors", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const leads = pgTable("leads", {
  id: uuid("id").primaryKey(),
  visitorId: uuid("visitor_id")
    .notNull()
    .references(() => visitors.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  consentAt: timestamp("consent_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
