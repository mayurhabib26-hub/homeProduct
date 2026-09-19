CREATE TABLE "abandoned_carts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "abandoned_carts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"phone" text NOT NULL,
	"items" jsonb NOT NULL,
	"value_paise" bigint DEFAULT 0 NOT NULL,
	"recovered_at" timestamp with time zone,
	"recovered_order_number" text,
	"reminded_at" timestamp with time zone,
	"skipped_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "abandoned_carts_phone_idx" ON "abandoned_carts" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "abandoned_carts_sweep_idx" ON "abandoned_carts" USING btree ("recovered_at","reminded_at","updated_at");