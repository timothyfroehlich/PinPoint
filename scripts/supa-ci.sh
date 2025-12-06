#!/bin/bash
set -e

echo "Running clean install..."
npm ci

echo "Resetting Supabase database..."
supabase db reset

echo "Applying database schema via migrations..."
npm run db:migrate

echo "Generating test schema..."
npm run test:_generate-schema

echo "Seeding database..."
npm run db:_seed

echo "Seeding users..."
npm run db:_seed-users

echo "Done."
