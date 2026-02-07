#!/bin/bash

# This script automates the setup process for the Financial-Advisor-AI project.
# It installs all necessary dependencies and sets up the database.

echo "Starting the setup process..."

# --- Check for Docker ---
if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Please start Docker Desktop and run this script again."
  exit 1
fi

# --- Python Dependencies ---
echo "Step 1: Installing uv..."
pip install uv

echo "Step 2: Syncing Python dependencies..."
uv sync

# --- Node.js Dependencies ---
echo "Step 3: Installing Node.js dependencies..."
npm install

# --- Database Setup ---
echo "Step 4: Resetting the database..."
docker-compose down -v

echo "Step 5: Starting the database..."
docker-compose up -d

echo "Step 6: Applying the database schema..."
npm run db:push

echo "Step 7: Seeding the database..."
npx tsx scripts/seed.ts

echo "----------------------------------------"
echo "Setup complete!"
echo "You can now run 'npm start' to start the application."
echo "----------------------------------------"
echo "Note: If you encounter issues with the iOS simulator, please ensure Xcode is updated and try the following:"
echo "1. Open Xcode and go to Window > Devices and Simulators to manage your simulators."
echo "2. You can try to run the app on a different simulator by pressing 's' in the terminal when Expo starts."