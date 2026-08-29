ALTER TABLE "rfqs" ADD COLUMN "vin" varchar(40);--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "reference" varchar(80);--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "condition" varchar(30);--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "location" varchar(120);--> statement-breakpoint
ALTER TABLE "rfqs" ADD COLUMN "preferred_brand" varchar(80);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "business_name" varchar(160);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "business_email" varchar(160);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verified" boolean DEFAULT false NOT NULL;