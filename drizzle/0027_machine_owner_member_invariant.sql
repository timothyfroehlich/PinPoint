-- Migration: machine_owner_member_invariant
--
-- Purpose: Enforce that a machine's owner (or invited owner) must always be a
-- member-or-above role. Two defensive layers:
--   1. Auto-promote any existing guest owners in the DB (one-time data fix).
--   2. Triggers that prevent (machine, guest-owner) from being created or restored
--      from either direction.
--
-- This migration contains no Drizzle schema changes — only raw SQL.
-- The snapshot for this entry is identical to 0026 (schema unchanged).

--> statement-breakpoint

-- Auto-promote any existing guest-owners to member (one-time data fix)
UPDATE user_profiles SET role = 'member'
  WHERE role = 'guest'
    AND id IN (SELECT owner_id FROM machines WHERE owner_id IS NOT NULL);

UPDATE invited_users SET role = 'member'
  WHERE role = 'guest'
    AND id IN (SELECT invited_owner_id FROM machines WHERE invited_owner_id IS NOT NULL);

--> statement-breakpoint

-- Trigger 1: prevent assigning a guest as machine owner (INSERT or UPDATE on machines)
CREATE OR REPLACE FUNCTION check_machine_owner_not_guest() RETURNS TRIGGER AS $$
DECLARE v_role text;
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    SELECT role INTO v_role FROM user_profiles WHERE id = NEW.owner_id;
    IF v_role = 'guest' THEN
      RAISE EXCEPTION 'Machine owner cannot be a guest (machine_id=%, owner_id=%)',
        NEW.id, NEW.owner_id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF NEW.invited_owner_id IS NOT NULL THEN
    SELECT role INTO v_role FROM invited_users WHERE id = NEW.invited_owner_id;
    IF v_role = 'guest' THEN
      RAISE EXCEPTION 'Machine invited owner cannot be a guest (machine_id=%, invited_owner_id=%)',
        NEW.id, NEW.invited_owner_id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER machines_owner_not_guest
  BEFORE INSERT OR UPDATE OF owner_id, invited_owner_id ON machines
  FOR EACH ROW EXECUTE FUNCTION check_machine_owner_not_guest();

--> statement-breakpoint

-- Trigger 2: prevent demoting a machine owner to guest (UPDATE on user_profiles)
CREATE OR REPLACE FUNCTION check_no_demotion_of_machine_owner() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role <> 'guest' AND NEW.role = 'guest' THEN
    IF EXISTS (SELECT 1 FROM machines WHERE owner_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot demote user to guest while they own machines (user_id=%)',
        NEW.id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_no_demote_owner
  BEFORE UPDATE OF role ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION check_no_demotion_of_machine_owner();

--> statement-breakpoint

-- Trigger 3: same for invited_users (covers invited→guest demotion)
CREATE OR REPLACE FUNCTION check_no_demotion_of_invited_owner() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role <> 'guest' AND NEW.role = 'guest' THEN
    IF EXISTS (SELECT 1 FROM machines WHERE invited_owner_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot demote invited user to guest while they own machines (invited_id=%)',
        NEW.id USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invited_users_no_demote_owner
  BEFORE UPDATE OF role ON invited_users
  FOR EACH ROW EXECUTE FUNCTION check_no_demotion_of_invited_owner();
