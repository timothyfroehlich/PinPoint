-- beads-cloud-repair-tables.sql — tables a fresh clone of the shared beads DB
-- is missing, because bd lists them in dolt_ignore: they exist only in each
-- machine's working set and no dolt commit ever carries them. bd 1.2.2 does NOT
-- lazily create them in an embedded clone, so a cloud routine's first write
-- fails with "Error 1146: table not found: events" (incident 2026-08-17,
-- PP-esqi). beads-cloud-init.sh applies this file after every clone/pull.
--
-- Idempotent (IF NOT EXISTS) and mirror-safe: dolt_ignore keeps these tables
-- untracked, so bd's autocommits and `bd dolt push` never include them
-- (verified: after creating them and writing an issue, `events` is still
-- absent from HEAD).
--
-- Schema dumped from the live server (SHOW CREATE TABLE) under bd 1.2.2.
-- It is bd-version-specific: when the BD_PINNED_VERSION chore bumps the pin,
-- re-dump and refresh this file if the new bd changed these tables.

CREATE TABLE IF NOT EXISTS `events` (
  `issue_id` varchar(255) NOT NULL,
  `event_type` varchar(32) NOT NULL,
  `actor` varchar(255) NOT NULL,
  `old_value` longtext,
  `new_value` longtext,
  `comment` text,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `id` char(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_events_created_at` (`created_at`),
  KEY `idx_events_issue` (`issue_id`),
  CONSTRAINT `fk_events_issue` FOREIGN KEY (`issue_id`) REFERENCES `issues` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS `bd_events_journal` (
  `seq` bigint NOT NULL,
  `ts` datetime NOT NULL,
  `op` varchar(32) NOT NULL,
  `issue_id` varchar(255) NOT NULL,
  `issue_json` longtext,
  `dep_json` longtext,
  `comment_json` longtext,
  PRIMARY KEY (`seq`),
  KEY `idx_bd_events_journal_issue` (`issue_id`),
  KEY `idx_bd_events_journal_ts` (`ts`)
);
CREATE TABLE IF NOT EXISTS `bd_events_seq` (
  `id` int NOT NULL,
  `next_seq` bigint NOT NULL,
  PRIMARY KEY (`id`)
);
CREATE TABLE IF NOT EXISTS `leases` (
  `issue_id` varchar(255) NOT NULL,
  `holder` varchar(255) NOT NULL,
  `granted_at` datetime NOT NULL,
  `lease_expires_at` datetime NOT NULL,
  `heartbeat_at` datetime NOT NULL,
  `granted_node` varchar(255) NOT NULL DEFAULT '',
  PRIMARY KEY (`issue_id`),
  KEY `idx_leases_expires` (`lease_expires_at`)
);
CREATE TABLE IF NOT EXISTS `wisps` (
  `id` varchar(255) NOT NULL,
  `content_hash` varchar(64),
  `title` varchar(500) NOT NULL,
  `description` longtext NOT NULL DEFAULT '',
  `design` longtext NOT NULL DEFAULT '',
  `acceptance_criteria` longtext NOT NULL DEFAULT '',
  `notes` longtext NOT NULL DEFAULT '',
  `status` varchar(32) NOT NULL DEFAULT 'open',
  `priority` int NOT NULL DEFAULT '2',
  `issue_type` varchar(32) NOT NULL DEFAULT 'task',
  `assignee` varchar(255),
  `estimated_minutes` int,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` varchar(255) DEFAULT '',
  `owner` varchar(255) DEFAULT '',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `closed_at` datetime,
  `closed_by_session` varchar(255) DEFAULT '',
  `external_ref` varchar(255),
  `spec_id` varchar(1024),
  `compaction_level` int DEFAULT '0',
  `compacted_at` datetime,
  `compacted_at_commit` varchar(64),
  `original_size` int,
  `sender` varchar(255) DEFAULT '',
  `ephemeral` tinyint(1) DEFAULT '0',
  `wisp_type` varchar(32) DEFAULT '',
  `pinned` tinyint(1) DEFAULT '0',
  `is_template` tinyint(1) DEFAULT '0',
  `mol_type` varchar(32) DEFAULT '',
  `work_type` varchar(32) DEFAULT 'mutex',
  `source_system` varchar(255) DEFAULT '',
  `metadata` json DEFAULT (json_object()),
  `source_repo` varchar(512) DEFAULT '',
  `close_reason` longtext DEFAULT '',
  `event_kind` varchar(32) DEFAULT '',
  `actor` varchar(255) DEFAULT '',
  `target` varchar(255) DEFAULT '',
  `payload` text DEFAULT '',
  `await_type` varchar(32) DEFAULT '',
  `await_id` varchar(255) DEFAULT '',
  `timeout_ns` bigint DEFAULT '0',
  `waiters` text DEFAULT '',
  `hook_bead` varchar(255) DEFAULT '',
  `role_bead` varchar(255) DEFAULT '',
  `agent_state` varchar(32) DEFAULT '',
  `last_activity` datetime,
  `role_type` varchar(32) DEFAULT '',
  `rig` varchar(255) DEFAULT '',
  `due_at` datetime,
  `defer_until` datetime,
  `no_history` tinyint(1) DEFAULT '0',
  `started_at` datetime,
  `is_blocked` tinyint(1) NOT NULL DEFAULT '0',
  `row_lock` bigint NOT NULL DEFAULT '0',
  `storage_class` varchar(16),
  PRIMARY KEY (`id`),
  KEY `idx_wisps_assignee` (`assignee`),
  KEY `idx_wisps_created_at` (`created_at`),
  KEY `idx_wisps_defer_until` (`defer_until`),
  KEY `idx_wisps_external_ref` (`external_ref`),
  KEY `idx_wisps_is_blocked` (`is_blocked`,`status`),
  KEY `idx_wisps_issue_type` (`issue_type`),
  KEY `idx_wisps_priority` (`priority`),
  KEY `idx_wisps_spec_id` (`spec_id`),
  KEY `idx_wisps_status` (`status`)
);
