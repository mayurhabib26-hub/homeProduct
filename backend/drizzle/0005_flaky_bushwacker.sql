CREATE TABLE "batches" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "batches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"variant_id" bigint NOT NULL,
	"batch_code" text NOT NULL,
	"mfg_month" integer NOT NULL,
	"mfg_year" integer NOT NULL,
	"best_before" timestamp with time zone NOT NULL,
	"quantity_made" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "batches_month_range" CHECK ("batches"."mfg_month" between 1 and 12)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"order_id" bigint NOT NULL,
	"invoice_number" text NOT NULL,
	"financial_year" text NOT NULL,
	"sequence" integer NOT NULL,
	"place_of_supply" text NOT NULL,
	"intra_state" boolean NOT NULL,
	"taxable_value_paise" bigint NOT NULL,
	"cgst_paise" bigint DEFAULT 0 NOT NULL,
	"sgst_paise" bigint DEFAULT 0 NOT NULL,
	"igst_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint NOT NULL,
	"lines" jsonb NOT NULL,
	"pdf_url" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_consent" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "marketing_consent_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"phone" text NOT NULL,
	"email" text,
	"granted" boolean NOT NULL,
	"source" text NOT NULL,
	"ip" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "gst_rate_percent" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "manufacturer_name" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "manufacturer_address" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "country_of_origin" text DEFAULT 'India' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "consumer_care_phone" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "consumer_care_email" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "shelf_life_months" integer;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "net_quantity_value" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "net_quantity_unit" text;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "batches_variant_code_idx" ON "batches" USING btree ("variant_id","batch_code");--> statement-breakpoint
CREATE INDEX "batches_variant_idx" ON "batches" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_order_idx" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_fy_sequence_idx" ON "invoices" USING btree ("financial_year","sequence");--> statement-breakpoint
CREATE INDEX "marketing_consent_phone_idx" ON "marketing_consent" USING btree ("phone");