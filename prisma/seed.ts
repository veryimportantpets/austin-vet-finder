import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Sample Austin veterinary clinics for seeding
const sampleClinics = [
  {
    name: "Westgate Pet & Bird Hospital",
    address: "4534 Westgate Blvd",
    city: "Austin",
    state: "TX",
    zip: "78745",
    lat: 30.2266,
    lng: -97.7969,
    phone: "(512) 892-3731",
    websiteUrl: "https://www.westgatepethospital.com",
    source: "seed",
  },
  {
    name: "Austin Vet Care at Central Park",
    address: "8014 Mesa Dr",
    city: "Austin",
    state: "TX",
    zip: "78731",
    lat: 30.3633,
    lng: -97.7390,
    phone: "(512) 453-0066",
    websiteUrl: "https://www.austinvetcareatcentralpark.com",
    source: "seed",
  },
  {
    name: "Manchaca Road Animal Hospital",
    address: "11113 Manchaca Rd",
    city: "Austin",
    state: "TX",
    zip: "78748",
    lat: 30.1644,
    lng: -97.8148,
    phone: "(512) 282-8100",
    websiteUrl: "https://www.manchacaroadvet.com",
    source: "seed",
  },
  {
    name: "Heart of Texas Veterinary Specialty Center",
    address: "3901 S Lamar Blvd",
    city: "Austin",
    state: "TX",
    zip: "78704",
    lat: 30.2381,
    lng: -97.7859,
    phone: "(512) 912-8800",
    websiteUrl: "https://www.heartoftexasvet.com",
    source: "seed",
  },
  {
    name: "Austin Veterinary Emergency & Specialty",
    address: "7300 Ranch Rd 2222 Bldg 5",
    city: "Austin",
    state: "TX",
    zip: "78730",
    lat: 30.3696,
    lng: -97.8284,
    phone: "(512) 343-2837",
    websiteUrl: "https://www.austinvets.com",
    source: "seed",
  },
  {
    name: "Thrive Affordable Vet Care - South Austin",
    address: "1930 E Riverside Dr",
    city: "Austin",
    state: "TX",
    zip: "78741",
    lat: 30.2384,
    lng: -97.7227,
    phone: "(512) 379-3800",
    websiteUrl: "https://www.thrivevet.com/austin",
    source: "seed",
  },
  {
    name: "Emancipet - Austin Central",
    address: "7201 Lavender Loop",
    city: "Austin",
    state: "TX",
    zip: "78702",
    lat: 30.2792,
    lng: -97.6972,
    phone: "(512) 587-7729",
    websiteUrl: "https://emancipet.org",
    source: "seed",
  },
  {
    name: "Banfield Pet Hospital - Mueller",
    address: "1201 Barbara Jordan Blvd",
    city: "Austin",
    state: "TX",
    zip: "78723",
    lat: 30.2969,
    lng: -97.7006,
    phone: "(512) 538-0066",
    websiteUrl: "https://www.banfield.com",
    source: "seed",
  },
  {
    name: "VCA South Lamar Animal Hospital",
    address: "909 S Lamar Blvd",
    city: "Austin",
    state: "TX",
    zip: "78704",
    lat: 30.2563,
    lng: -97.7639,
    phone: "(512) 447-7387",
    websiteUrl: "https://vcahospitals.com/south-lamar",
    source: "seed",
  },
  {
    name: "Austin Animal Hospital",
    address: "8500 N Mo-Pac Expy",
    city: "Austin",
    state: "TX",
    zip: "78759",
    lat: 30.3905,
    lng: -97.7340,
    phone: "(512) 345-5626",
    websiteUrl: "https://www.austinanimalhospital.com",
    source: "seed",
  },
  {
    name: "Lake Travis Animal Hospital",
    address: "2105 Lohmans Crossing Rd",
    city: "Austin",
    state: "TX",
    zip: "78734",
    lat: 30.3789,
    lng: -97.9373,
    phone: "(512) 266-1006",
    websiteUrl: "https://www.laketravisvet.com",
    source: "seed",
  },
  {
    name: "Circle C Animal Hospital",
    address: "6911 W Slaughter Ln",
    city: "Austin",
    state: "TX",
    zip: "78749",
    lat: 30.1867,
    lng: -97.8561,
    phone: "(512) 282-3737",
    websiteUrl: "https://www.circlecanimalhospital.com",
    source: "seed",
  },
  {
    name: "South Congress Veterinary Clinic",
    address: "1701 S Congress Ave",
    city: "Austin",
    state: "TX",
    zip: "78704",
    lat: 30.2456,
    lng: -97.7495,
    phone: "(512) 444-1969",
    websiteUrl: "https://www.southcongressvet.com",
    source: "seed",
  },
  {
    name: "Pet Specialists of Austin",
    address: "4544 Mopac Expy S",
    city: "Austin",
    state: "TX",
    zip: "78735",
    lat: 30.2282,
    lng: -97.8246,
    phone: "(512) 288-1040",
    websiteUrl: "https://www.petspecialistsofaustin.com",
    source: "seed",
  },
  {
    name: "North Shoal Creek Vet Clinic",
    address: "8155 N Lamar Blvd",
    city: "Austin",
    state: "TX",
    zip: "78753",
    lat: 30.3607,
    lng: -97.6860,
    phone: "(512) 458-0888",
    websiteUrl: "https://www.nscvet.com",
    source: "seed",
  },
  // === NEW CLINICS FROM SCRATCHPAY DIRECTORY (Dec 2024) ===
  {
    name: "Austin Urban Vet Center",
    address: "710 West 5th Street",
    city: "Austin",
    state: "TX",
    zip: "78701",
    phone: "",
    websiteUrl: "",
    source: "scratchpay",
    financingTier: "B",
  },
  {
    name: "Modern Animal - South Lamar",
    address: "1100 South Lamar Boulevard",
    city: "Austin",
    state: "TX",
    zip: "78704",
    phone: "",
    websiteUrl: "https://www.modernanimal.com",
    source: "scratchpay",
    financingTier: "B",
  },
  {
    name: "Honnas Veterinary",
    address: "1615 South Lamar Boulevard",
    city: "Austin",
    state: "TX",
    zip: "78704",
    phone: "",
    websiteUrl: "",
    source: "scratchpay",
    financingTier: "B",
  },
  {
    name: "Paz Veterinary - East",
    address: "3300 East 7th Street Suite 101",
    city: "Austin",
    state: "TX",
    zip: "78702",
    phone: "",
    websiteUrl: "https://www.pazveterinary.com",
    source: "scratchpay",
    financingTier: "B",
  },
  {
    name: "Livewell Animal Hospital of Austin",
    address: "507 Pressler St Suite 700",
    city: "Austin",
    state: "TX",
    zip: "78703",
    phone: "",
    websiteUrl: "",
    source: "scratchpay",
    financingTier: "B",
  },
];

async function main() {
  console.log('🌱 Seeding Austin Vet Finder database...\n');
  
  let created = 0;
  let skipped = 0;
  
  for (const clinic of sampleClinics) {
    // Check if clinic already exists (by name + address)
    const existing = await prisma.clinic.findFirst({
      where: {
        name: clinic.name,
        address: clinic.address,
      },
    });
    
    if (existing) {
      console.log(`⏭️  Skipped (exists): ${clinic.name}`);
      skipped++;
      continue;
    }
    
    await prisma.clinic.create({
      data: clinic,
    });
    
    console.log(`✅ Created: ${clinic.name}`);
    created++;
  }
  
  console.log(`\n📊 Seed complete: ${created} created, ${skipped} skipped`);
  console.log('\n💡 Next steps:');
  console.log('   1. Run "npm run dev" to start the app');
  console.log('   2. Visit http://localhost:3000/admin to trigger crawls');
  console.log('   3. Or run "npm run crawl" to crawl all clinics\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
