#!/bin/bash
set -e

echo "Running clean install..."
pnpm install --frozen-lockfile

echo "Resetting Supabase database..."
supabase db reset

echo "Applying database schema via migrations..."
pnpm run db:migrate

echo "Generating test schema..."
pnpm run test:_generate-schema

echo "Seeding database..."
pnpm run db:_seed

echo "Seeding users..."
pnpm run db:_seed-users

echo "Done."
