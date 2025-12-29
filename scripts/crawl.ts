#!/usr/bin/env tsx
/**
 * Manual crawl script for Austin Vet Finder
 * 
 * Usage:
 *   npm run crawl                  - Crawl all clinics with websites
 *   npm run crawl -- --clinic=ID   - Crawl single clinic by ID
 *   npm run crawl -- --limit=10    - Limit to N clinics
 */

import { PrismaClient } from '@prisma/client';
import { crawlClinic } from '../lib/crawler';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let clinicId: string | null = null;
  let limit: number | null = null;
  
  for (const arg of args) {
    if (arg.startsWith('--clinic=')) {
      clinicId = arg.replace('--clinic=', '');
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.replace('--limit=', ''), 10);
    }
  }
  
  console.log('🕷️  Austin Vet Finder - Web Crawler\n');
  
  if (clinicId) {
    // Crawl single clinic
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
    });
    
    if (!clinic) {
      console.error(`❌ Clinic not found: ${clinicId}`);
      process.exit(1);
    }
    
    if (!clinic.websiteUrl) {
      console.error(`❌ Clinic has no website: ${clinic.name}`);
      process.exit(1);
    }
    
    console.log(`📍 Crawling: ${clinic.name}`);
    console.log(`   URL: ${clinic.websiteUrl}\n`);
    
    await crawlClinic(clinic.id, clinic.websiteUrl);
    
    console.log('\n✅ Crawl complete!');
  } else {
    // Crawl all clinics (or limited set)
    const clinics = await prisma.clinic.findMany({
      where: { websiteUrl: { not: null } },
      select: { id: true, name: true, websiteUrl: true },
      orderBy: { name: 'asc' },
      take: limit || undefined,
    });
    
    if (clinics.length === 0) {
      console.log('⚠️  No clinics with websites found.');
      console.log('   Run "npm run db:seed" to add sample clinics.\n');
      process.exit(0);
    }
    
    console.log(`📋 Found ${clinics.length} clinics to crawl`);
    if (limit) {
      console.log(`   (limited to ${limit})`);
    }
    console.log('');
    
    let success = 0;
    let failed = 0;
    
    for (let i = 0; i < clinics.length; i++) {
      const clinic = clinics[i];
      console.log(`\n[${i + 1}/${clinics.length}] ${clinic.name}`);
      console.log(`   URL: ${clinic.websiteUrl}`);
      
      try {
        await crawlClinic(clinic.id, clinic.websiteUrl!);
        success++;
        console.log('   ✅ Success');
      } catch (error) {
        failed++;
        console.log(`   ❌ Failed: ${error}`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Crawl Summary:`);
    console.log(`   ✅ Success: ${success}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📈 Rate: ${Math.round((success / clinics.length) * 100)}%`);
    console.log('='.repeat(50) + '\n');
  }
}

main()
  .catch((e) => {
    console.error('❌ Crawl script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
