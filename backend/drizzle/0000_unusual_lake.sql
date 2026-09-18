CREATE TABLE "products" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"regional_name" text,
	"short_description" text NOT NULL,
	"category" text NOT NULL,
	"category_label" text NOT NULL,
	"badge" text,
	"about" text NOT NULL,
	"ingredients" text[] NOT NULL,
	"how_to_use" text[] NOT NULL,
	"storage" text NOT NULL,
	"nutrition" jsonb NOT NULL,
	"spice_level" text NOT NULL,
	"image" text NOT NULL,
	"gallery" text[] DEFAULT '{}' NOT NULL,
	"rating" numeric(2, 1) DEFAULT '0' NOT NULL,
	"reviews_count" integer DEFAULT 0 NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"is_signature" boolean DEFAULT false NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"hsn_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recipes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text NOT NULL,
	"prep_time" text NOT NULL,
	"cook_time" text NOT NULL,
	"servings" text NOT NULL,
	"difficulty" text NOT NULL,
	"image" text NOT NULL,
	"description" text NOT NULL,
	"paired_product_slug" text,
	"ingredients" text[] NOT NULL,
	"instructions" text[] NOT NULL,
	"chef_tip" text NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reviews_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"product_id" bigint NOT NULL,
	"name" text NOT NULL,
	"location" text,
	"rating" integer NOT NULL,
	"comment" text NOT NULL,
	"product_purchased" text,
	"verified" boolean DEFAULT false NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK ("reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "variants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"product_id" bigint NOT NULL,
	"weight" text NOT NULL,
	"price_paise" bigint NOT NULL,
	"mrp_paise" bigint,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"sku" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "variants_stock_non_negative" CHECK ("variants"."stock_qty" >= 0),
	CONSTRAINT "variants_price_positive" CHECK ("variants"."price_paise" > 0)
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_published_featured_idx" ON "products" USING btree ("published","featured");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_slug_idx" ON "recipes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "reviews_product_approved_idx" ON "reviews" USING btree ("product_id","approved");--> statement-breakpoint
CREATE UNIQUE INDEX "variants_product_weight_idx" ON "variants" USING btree ("product_id","weight");--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "variants" USING btree ("product_id");