CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfq_id" uuid,
	"bid_id" varchar(120),
	"supplier_id" uuid,
	"supplier_name" varchar(160) NOT NULL,
	"brand" varchar(80),
	"price" integer NOT NULL,
	"fee" integer NOT NULL,
	"payout" integer NOT NULL,
	"status" varchar(40) DEFAULT 'PENDING_PAYMENT' NOT NULL,
	"stripe_payment_intent_id" varchar(120),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "verification_status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "trade_license" varchar(160);--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_rfq_id_rfqs_id_fk" FOREIGN KEY ("rfq_id") REFERENCES "public"."rfqs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;