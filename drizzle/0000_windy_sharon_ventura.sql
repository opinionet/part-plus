CREATE TABLE "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid NOT NULL,
	"supplier_id" uuid,
	"supplier_name" varchar(160) NOT NULL,
	"brand" varchar(80),
	"price" integer NOT NULL,
	"eta_minutes" integer DEFAULT 30 NOT NULL,
	"boosted" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfqs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" uuid,
	"buyer_name" varchar(120),
	"raw_input_text" text NOT NULL,
	"vehicle" jsonb NOT NULL,
	"part" jsonb NOT NULL,
	"budget_min" integer NOT NULL,
	"budget_max" integer NOT NULL,
	"ai_confidence" real DEFAULT 0.9 NOT NULL,
	"status" varchar(20) DEFAULT 'OPEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"business_name" varchar(160) NOT NULL,
	"brands" text[] DEFAULT '{}' NOT NULL,
	"categories" text[] DEFAULT '{}' NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"location" varchar(120),
	"rating" real DEFAULT 0 NOT NULL,
	"response_hours" real DEFAULT 0 NOT NULL,
	"plan" varchar(20) DEFAULT 'FREE' NOT NULL,
	"stripe_customer_id" varchar(120),
	"stripe_subscription_id" varchar(120),
	"subscription_status" varchar(40) DEFAULT 'inactive' NOT NULL,
	"boost_credits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(40) NOT NULL,
	"country_code" varchar(8) DEFAULT '+971' NOT NULL,
	"role" varchar(16) DEFAULT 'BUYER' NOT NULL,
	"name" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfqs" ADD CONSTRAINT "rfqs_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;