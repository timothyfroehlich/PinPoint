-- PinPoint Issues Seeding
-- Sample issues for testing and development
-- Universal PostgreSQL - works in any PostgreSQL environment

-- =============================================================================
-- ISSUES: Create issues using SEED_TEST_IDS from minimal-issues.ts
-- =============================================================================
INSERT INTO issues (id, title, description, organization_id, machine_id, priority_id, status_id, created_by_id, created_at, updated_at) VALUES
  -- Issues using exact SEED_TEST_IDS constants
  ('issue-kaiju-figures-001', 'Kaiju figures on left ramp are not responding', 'Kaiju figures on left ramp are not responding', 'test-org-pinpoint', 'machine-mm-001', 'priority-low-primary-001', 'status-new-primary-001', '10000000-0000-4000-8000-000000000002', '2025-06-21 13:40:02+00', '2025-07-01 19:09:30+00'),
  ('issue-loud-buzzing-002', 'Loud buzzing noise then crashes', 'Loud buzzing noise then crashes', 'test-org-pinpoint', 'machine-xenon-001', 'priority-critical-primary-001', 'status-needs-expert-primary-001', '10000000-0000-4000-8000-000000000003', '2025-06-27 19:05:40+00', '2025-07-06 10:27:36+00'),
  ('issue-left-rollover-003', 'Left top rollover target not responding', 'Left top rollover target not responding', 'test-org-pinpoint', 'machine-cleopatra-001', 'priority-low-primary-001', 'status-new-primary-001', '10000000-0000-4000-8000-000000000002', '2025-06-27 20:12:44+00', '2025-07-01 19:10:53+00'),
  ('issue-right-gun-opto-004', 'Right gun opto is flakey - auto fires', 'Right gun opto is flakey - auto fires (current workaround -> power cycle)', 'test-org-pinpoint', 'machine-cc-001', 'priority-high-primary-001', 'status-in-progress-primary-001', '10000000-0000-4000-8000-000000000003', '2025-07-05 15:07:02+00', '2025-07-06 10:32:27+00'),
  ('issue-b-top-rollover-005', 'b top roll over does not register', 'b top roll over does not register', 'test-org-pinpoint', 'machine-cc-001', 'priority-low-primary-001', 'status-fixed-primary-001', '10000000-0000-4000-8000-000000000002', '2025-06-16 22:00:40+00', '2025-06-16 22:00:40+00'),
  ('issue-gun-calibration-006', 'Gun calibration was off - left side hits poor', 'Gun calibration was off - left side hits poor', 'test-org-pinpoint', 'machine-rfm-001', 'priority-low-primary-001', 'status-not-to-be-fixed-primary-001', '10000000-0000-4000-8000-000000000003', '2025-06-28 12:59:21+00', '2025-07-04 23:34:55+00'),
  ('issue-center-pop-bumper-007', 'Center pop bumper is out', 'Center pop bumper is out', 'test-org-pinpoint', 'machine-cleopatra-001', 'priority-low-primary-001', 'status-new-primary-001', '10000000-0000-4000-8000-000000000003', '2025-06-27 20:13:27+00', '2025-07-01 19:10:58+00'),
  ('issue-train-wreck-008', 'Train Wreck multiball drains too fast', 'Train Wreck multiball drains too fast - outlanes need adjustment', 'test-org-pinpoint', 'machine-cc-001', 'priority-high-primary-001', 'status-new-primary-001', '10000000-0000-4000-8000-000000000001', '2025-07-08 14:22:15+00', '2025-07-08 14:22:15+00'),
  ('issue-magna-save-009', 'Magna save not responding consistently', 'Magna save button on the right side is intermittent', 'test-org-pinpoint', 'machine-rfm-001', 'priority-low-primary-001', 'status-new-primary-001', '10000000-0000-4000-8000-000000000002', '2025-07-09 10:15:30+00', '2025-07-09 10:15:30+00'),
  ('issue-castle-gate-010', 'Castle gate mechanism sticking', 'Castle gate mechanism sticking during Battle for the Kingdom mode', 'test-org-pinpoint', 'machine-mm-001', 'priority-high-primary-001', 'status-in-progress-primary-001', '10000000-0000-4000-8000-000000000001', '2025-07-10 16:45:00+00', '2025-07-10 16:45:00+00')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  organization_id = EXCLUDED.organization_id,
  machine_id = EXCLUDED.machine_id,
  priority_id = EXCLUDED.priority_id,
  status_id = EXCLUDED.status_id,
  created_by_id = EXCLUDED.created_by_id,
  updated_at = EXCLUDED.updated_at;