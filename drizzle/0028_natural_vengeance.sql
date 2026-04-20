CREATE TABLE "discord_integration_config" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"guild_id" text,
	"invite_link" text,
	"bot_token_vault_id" uuid,
	"bot_health_status" text DEFAULT 'unknown' NOT NULL,
	"last_bot_check_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "discord_integration_config_singleton" CHECK (id = 'singleton'),
	CONSTRAINT "discord_integration_config_health_check" CHECK (bot_health_status IN ('unknown', 'healthy', 'degraded'))
);
