#!/bin/bash
set -e

echo "Running clean install..."
npm ci

echo "Resetting Supabase database..."
supabase db reset

echo "Applying database schema..."
npm run db:push

echo "Seeding database..."
npm run db:seed

echo "Seeding users..."
npm run db:seed-users

echo "Done."