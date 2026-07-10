// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ElderCare database...');

  // ── Admin ──────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { phone: '+919000000001' },
    update: {},
    create: {
      phone: '+919000000001',
      name: 'Platform Admin',
      role: 'ADMIN',
      email: 'admin@eldercare.in',
    },
  });
  console.log('✓ Admin:', admin.name);

  // ── Caregivers ─────────────────────────────────────────────────────────
  const cgData = [
    {
      phone: '+919111111101', name: 'Priya Sharma', city: 'Bangalore',
      bio: 'Certified nurse with 6+ years in senior care. Specialised in dementia and post-surgical care.',
      hourlyRate: 480, languages: ['English', 'Hindi', 'Kannada'],
      certifications: ['BSc Nursing', 'First Aid & CPR', 'Dementia Care'],
      serviceTypes: ['PERSONAL_CARE', 'MEDICATION_MANAGEMENT', 'MEDICAL_MONITORING'],
      yearsOfExperience: 6, averageRating: 4.9, totalReviews: 142, completedBookings: 230,
    },
    {
      phone: '+919111111102', name: 'Ramesh Nair', city: 'Bangalore',
      bio: 'Experienced home care aide with expertise in mobility assistance and physiotherapy support.',
      hourlyRate: 380, languages: ['English', 'Malayalam', 'Hindi'],
      certifications: ['First Aid', 'Geriatric Care Certification'],
      serviceTypes: ['MOBILITY_ASSISTANCE', 'COMPANIONSHIP', 'PERSONAL_CARE', 'HOUSEKEEPING'],
      yearsOfExperience: 4, averageRating: 4.7, totalReviews: 87, completedBookings: 154,
    },
    {
      phone: '+919111111103', name: 'Sunita Patel', city: 'Mumbai',
      bio: 'Compassionate caregiver specialising in medication management and chronic illness care.',
      hourlyRate: 550, languages: ['Hindi', 'Gujarati', 'English'],
      certifications: ['Nursing Assistant', 'Medication Management', 'First Aid'],
      serviceTypes: ['MEDICATION_MANAGEMENT', 'PERSONAL_CARE', 'MEAL_PREPARATION', 'MEDICAL_MONITORING'],
      yearsOfExperience: 8, averageRating: 4.8, totalReviews: 203, completedBookings: 312,
    },
  ];

  for (const cg of cgData) {
    const user = await prisma.user.upsert({
      where: { phone: cg.phone },
      update: {},
      create: { phone: cg.phone, name: cg.name, role: 'CAREGIVER' },
    });
    await prisma.caregiverProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        city: cg.city, bio: cg.bio,
        hourlyRate: cg.hourlyRate,
        languages: cg.languages,
        certifications: cg.certifications,
        serviceTypes: cg.serviceTypes,
        yearsOfExperience: cg.yearsOfExperience,
        verificationStatus: 'VERIFIED',
        isOnline: true,
        averageRating: cg.averageRating,
        totalReviews: cg.totalReviews,
        completedBookings: cg.completedBookings,
        totalEarnings: cg.completedBookings * cg.hourlyRate * 2.5,
        availability: {
          create: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => ({
            dayOfWeek: day,
            startTime: '09:00',
            endTime: day === 'Saturday' ? '15:00' : '18:00',
          })),
        },
      },
    });
    console.log('✓ Caregiver:', cg.name);
  }

  // ── Customers ──────────────────────────────────────────────────────────
  const customerData = [
    {
      phone: '+919222222201', name: 'Rajesh Kumar', city: 'Bangalore', email: 'rajesh@example.com',
      emergencyContact: '+919333333301', subscriptionPlan: 'FAMILY_BASIC',
      elders: [
        { name: 'Kamala Kumar', age: 74, relationship: 'Mother', gender: 'Female', medicalConditions: ['Arthritis', 'Hypertension'], medications: ['Amlodipine 5mg', 'Pantoprazole'], allergies: ['Penicillin'], specialNeeds: 'Needs assistance with daily activities and medication reminders' },
        { name: 'Suresh Kumar', age: 76, relationship: 'Father', gender: 'Male', medicalConditions: ['Diabetes Type 2', 'Heart Disease'], medications: ['Metformin', 'Aspirin 75mg'], allergies: [], specialNeeds: 'Diabetic diet required, low-salt meals' },
      ],
    },
    {
      phone: '+919222222202', name: 'Ananya Singh', city: 'Mumbai', email: 'ananya@example.com',
      emergencyContact: '+919333333302', subscriptionPlan: 'FAMILY_PREMIUM',
      elders: [
        { name: 'Meera Singh', age: 82, relationship: 'Grandmother', gender: 'Female', medicalConditions: ['Dementia', 'Osteoporosis'], medications: ['Donepezil', 'Calcium+D3'], allergies: ['Sulfa drugs'], specialNeeds: 'Requires 24/7 supervision; gentle communication style needed' },
      ],
    },
  ];

  for (const cust of customerData) {
    const user = await prisma.user.upsert({
      where: { phone: cust.phone },
      update: {},
      create: { phone: cust.phone, name: cust.name, role: 'CUSTOMER', email: cust.email },
    });
    let profile = await prisma.customerProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      profile = await prisma.customerProfile.create({
        data: {
          userId: user.id,
          city: cust.city,
          emergencyContact: cust.emergencyContact,
          subscriptionPlan: cust.subscriptionPlan,
          subscriptionEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          elders: {
            create: cust.elders.map(e => ({
              name: e.name, age: e.age, relationship: e.relationship, gender: e.gender,
              medicalConditions: e.medicalConditions, medications: e.medications,
              allergies: e.allergies, specialNeeds: e.specialNeeds,
            })),
          },
        },
        include: { elders: true },
      });
    }
    console.log('✓ Customer:', cust.name);
  }

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📱 Test Credentials (OTP via console in dev):');
  console.log('   Admin:     +919000000001');
  console.log('   Customer:  +919222222201  (Family Basic)');
  console.log('   Customer:  +919222222202  (Family Premium)');
  console.log('   Caregiver: +919111111101  (Priya Sharma, Bangalore)');
  console.log('   Caregiver: +919111111102  (Ramesh Nair, Bangalore)');
  console.log('   Caregiver: +919111111103  (Sunita Patel, Mumbai)');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
