#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'
import { env } from '../src/env'

const prisma = new PrismaClient()

/**
 * Database Reset Script with OPDB Integration
 *
 * This script performs a complete database reset for the OPDB integration:
 * 1. Drops existing database (via prisma migrate reset)
 * 2. Runs new migrations with OPDB schema
 * 3. Seeds with test data
 * 4. Seeds with OPDB-sourced GameTitles
 * 5. Creates test GameInstances
 */

interface OPDBTestGame {
  opdbId: string
  name: string
  manufacturer?: string
  releaseDate?: Date
  imageUrl?: string
  description?: string
}

// Test OPDB games for seeding
const testOPDBGames: OPDBTestGame[] = [
  {
    opdbId: "G43W4-MrRpw",
    name: "AC/DC (Premium)",
    manufacturer: "Stern",
    releaseDate: new Date("2012-03-01"),
    imageUrl: "https://opdb.org/images/games/acdc-premium.jpg",
    description: "AC/DC Premium pinball machine by Stern Pinball, featuring the legendary rock band's music and imagery."
  },
  {
    opdbId: "G5K2X-N8vQs",
    name: "Medieval Madness",
    manufacturer: "Williams",
    releaseDate: new Date("1997-06-01"),
    imageUrl: "https://opdb.org/images/games/medieval-madness.jpg",
    description: "Medieval Madness is a medieval themed pinball machine designed by Brian Eddy and manufactured by Williams."
  },
  {
    opdbId: "G7R9P-L3mYt",
    name: "The Addams Family",
    manufacturer: "Bally",
    releaseDate: new Date("1992-02-01"),
    imageUrl: "https://opdb.org/images/games/addams-family.jpg",
    description: "The Addams Family is a pinball machine based on the 1991 film of the same name."
  },
  {
    opdbId: "G2B8N-K6fLw",
    name: "Twilight Zone",
    manufacturer: "Bally",
    releaseDate: new Date("1993-05-01"),
    imageUrl: "https://opdb.org/images/games/twilight-zone.jpg",
    description: "Twilight Zone is a widebody pinball machine based on the TV series The Twilight Zone."
  },
  {
    opdbId: "G9M4Q-P1zXc",
    name: "Attack from Mars",
    manufacturer: "Bally",
    releaseDate: new Date("1995-12-01"),
    imageUrl: "https://opdb.org/images/games/attack-from-mars.jpg",
    description: "Attack from Mars is a 1995 pinball machine designed by Brian Eddy and manufactured by Bally."
  }
]

async function main() {
  console.log('🚀 Starting database reset with OPDB integration...')

  try {
    // Note: The actual database reset should be done via: npx prisma migrate reset
    // This script handles the seeding portion

    console.log('📋 Seeding test organizations...')

    // Create test organization
    const testOrg = await prisma.organization.create({
      data: {
        name: "Test Arcade",
        subdomain: "test-arcade",
      }
    })

    console.log(`✅ Created organization: ${testOrg.name}`)

    // Create test users
    console.log('👥 Seeding test users...')

    const testUser1 = await prisma.user.create({
      data: {
        name: "Test Admin",
        email: "admin@test.com",
        bio: "Test administrator user",
        profilePicture: "/images/default-avatars/default-avatar-1.webp",
      }
    })

    const testUser2 = await prisma.user.create({
      data: {
        name: "Test Member",
        email: "member@test.com",
        bio: "Test member user",
        profilePicture: "/images/default-avatars/default-avatar-2.webp",
      }
    })

    // Create memberships
    await prisma.membership.createMany({
      data: [
        {
          userId: testUser1.id,
          organizationId: testOrg.id,
          role: "admin"
        },
        {
          userId: testUser2.id,
          organizationId: testOrg.id,
          role: "member"
        }
      ]
    })

    console.log('✅ Created test users and memberships')

    // Create test issue statuses
    console.log('📊 Seeding issue statuses...')

    const issueStatuses = await prisma.issueStatus.createMany({
      data: [
        { name: "Open", order: 1, organizationId: testOrg.id },
        { name: "In Progress", order: 2, organizationId: testOrg.id },
        { name: "Resolved", order: 3, organizationId: testOrg.id },
        { name: "Closed", order: 4, organizationId: testOrg.id },
      ]
    })

    console.log('✅ Created issue statuses')

    // Create test locations
    console.log('📍 Seeding locations...')

    const mainFloor = await prisma.location.create({
      data: {
        name: "Main Floor",
        notes: "Primary gaming area",
        organizationId: testOrg.id,
      }
    })

    const backRoom = await prisma.location.create({
      data: {
        name: "Back Room",
        notes: "Secondary gaming area",
        organizationId: testOrg.id,
      }
    })

    console.log('✅ Created test locations')

    // Seed OPDB GameTitles
    console.log('🎮 Seeding OPDB GameTitles...')

    const gameTitles = []
    for (const game of testOPDBGames) {
      const gameTitle = await prisma.gameTitle.create({
        data: {
          name: game.name,
          opdbId: game.opdbId,
          manufacturer: game.manufacturer,
          releaseDate: game.releaseDate,
          imageUrl: game.imageUrl,
          description: game.description,
          lastSynced: new Date(),
          organizationId: testOrg.id,
        }
      })
      gameTitles.push(gameTitle)
      console.log(`  ✅ Created GameTitle: ${game.name} (${game.opdbId})`)
    }

    // Create test GameInstances
    console.log('🕹️ Seeding GameInstances...')

    // Create multiple instances of some games
    const gameInstances = [
      {
        name: "AC/DC Premium #1",
        gameTitleId: gameTitles[0]!.id,
        locationId: mainFloor.id,
        ownerId: testUser1.id,
      },
      {
        name: "AC/DC Premium #2",
        gameTitleId: gameTitles[0]!.id,
        locationId: backRoom.id,
        ownerId: testUser1.id,
      },
      {
        name: "Medieval Madness",
        gameTitleId: gameTitles[1]!.id,
        locationId: mainFloor.id,
        ownerId: testUser2.id,
      },
      {
        name: "The Addams Family",
        gameTitleId: gameTitles[2]!.id,
        locationId: mainFloor.id,
        ownerId: testUser1.id,
      },
      {
        name: "Twilight Zone",
        gameTitleId: gameTitles[3]!.id,
        locationId: backRoom.id,
        ownerId: testUser2.id,
      },
      {
        name: "Attack from Mars",
        gameTitleId: gameTitles[4]!.id,
        locationId: mainFloor.id,
        ownerId: testUser1.id,
      }
    ]

    await prisma.gameInstance.createMany({
      data: gameInstances
    })

    console.log('✅ Created test GameInstances')

    // Summary
    console.log('\n🎉 Database reset with OPDB integration completed successfully!')
    console.log(`📊 Summary:`)
    console.log(`   - Organizations: 1`)
    console.log(`   - Users: 2`)
    console.log(`   - Locations: 2`)
    console.log(`   - GameTitles (OPDB): ${testOPDBGames.length}`)
    console.log(`   - GameInstances: ${gameInstances.length}`)
    console.log(`   - Issue Statuses: 4`)

    console.log('\n📋 Next steps:')
    console.log('   1. Verify OPDB environment variables are set')
    console.log('   2. Test GameTitle creation with OPDB data')
    console.log('   3. Begin Phase 2: OPDB API integration')

  } catch (error) {
    console.error('❌ Database reset failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Execute the script
main()
  .catch((error) => {
    console.error('❌ Script execution failed:', error)
    process.exit(1)
  })
