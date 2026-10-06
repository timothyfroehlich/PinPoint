CREATE TABLE "apron_card_print_queue" (
	"user_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apron_card_print_queue_user_id_card_id_pk" PRIMARY KEY("user_id","card_id")
);
--> statement-breakpoint
ALTER TABLE "apron_card_print_queue" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "apron_card_print_queue" ADD CONSTRAINT "apron_card_print_queue_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apron_card_print_queue" ADD CONSTRAINT "apron_card_print_queue_card_id_machine_apron_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."machine_apron_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_apron_card_print_queue_card_id" ON "apron_card_print_queue" USING btree ("card_id");