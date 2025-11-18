const { query } = require('../src/config/database');

// Dummy data arrays
const firstNames = [
  'Mohammad', 'Ahmed', 'Ali', 'Hassan', 'Hussein', 'Omar', 'Yusuf', 'Ibrahim', 'Abdullah', 'Khalid',
  'Fatima', 'Aisha', 'Zainab', 'Maryam', 'Khadija', 'Sara', 'Layla', 'Amina', 'Hafsa', 'Ruqayyah',
  'Imran', 'Bilal', 'Usman', 'Salman', 'Hamza', 'Tariq', 'Noor', 'Zayd', 'Malik', 'Rayan',
  'Asma', 'Huda', 'Rania', 'Safiya', 'Yasmin', 'Nadia', 'Leena', 'Hana', 'Samira', 'Salma'
];

const lastNames = [
  'Khan', 'Ahmed', 'Ali', 'Hassan', 'Malik', 'Shah', 'Rahman', 'Siddiqui', 'Hussain', 'Ansari',
  'Qureshi', 'Haider', 'Abbas', 'Raza', 'Naqvi', 'Zaidi', 'Rizvi', 'Jafri', 'Askari', 'Bukhari'
];

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const genders = ['male', 'female'];

// Generate random RFID (8 digits)
const generateRFID = () => {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
};

// Generate random date of birth (age 10-18)
const generateDOB = () => {
  const year = 2007 + Math.floor(Math.random() * 8); // 2007-2014
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Generate random phone number
const generatePhone = () => {
  return '+92' + Math.floor(3000000000 + Math.random() * 999999999);
};

async function addDummyStudents(count = 60) {
  try {
    console.log(`🎯 Starting to add ${count} dummy students...`);

    // Get school_id (assuming first school)
    const schoolResult = await query('SELECT id FROM schools LIMIT 1');
    if (schoolResult.rows.length === 0) {
      console.error('❌ No school found in database!');
      return;
    }
    const schoolId = schoolResult.rows[0].id;
    console.log(`✅ Using school ID: ${schoolId}`);

    // Get classes
    const classesResult = await query('SELECT id, class_name FROM classes WHERE school_id = $1', [schoolId]);
    if (classesResult.rows.length === 0) {
      console.error('❌ No classes found!');
      return;
    }
    const classes = classesResult.rows;
    console.log(`✅ Found ${classes.length} classes`);

    // Get sections (join with classes to filter by school)
    const sectionsResult = await query(
      `SELECT s.id, s.section_name, s.class_id 
       FROM sections s 
       JOIN classes c ON s.class_id = c.id 
       WHERE c.school_id = $1`, 
      [schoolId]
    );
    const sections = sectionsResult.rows;
    console.log(`✅ Found ${sections.length} sections`);

    let addedCount = 0;
    let rollNumberCounter = {};

    for (let i = 0; i < count; i++) {
      // Random name
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const fullName = `${firstName} ${lastName}`;

      // Random class
      const randomClass = classes[Math.floor(Math.random() * classes.length)];
      const classId = randomClass.id;

      // Random section for this class
      const classSections = sections.filter(s => s.class_id === classId);
      const randomSection = classSections.length > 0 
        ? classSections[Math.floor(Math.random() * classSections.length)]
        : null;
      const sectionId = randomSection ? randomSection.id : null;

      // Generate unique roll number for this class-section combination
      const classSecKey = `${classId}-${sectionId}`;
      if (!rollNumberCounter[classSecKey]) {
        rollNumberCounter[classSecKey] = 1;
      }
      const rollNumber = String(rollNumberCounter[classSecKey]++);

      // Other random data
      const rfidCardId = generateRFID();
      const gender = genders[Math.floor(Math.random() * genders.length)];
      const dob = generateDOB();
      const bloodGroup = bloodGroups[Math.floor(Math.random() * bloodGroups.length)];
      const guardianName = `Guardian of ${firstName}`;
      const guardianPhone = generatePhone();

      try {
        const result = await query(
          `INSERT INTO students (
            school_id, full_name, rfid_card_id, class_id, section_id, 
            roll_number, gender, dob, blood_group, guardian_name, 
            guardian_phone, is_active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id`,
          [
            schoolId, fullName, rfidCardId, classId, sectionId,
            rollNumber, gender, dob, bloodGroup, guardianName,
            guardianPhone
          ]
        );

        addedCount++;
        console.log(`✅ Added ${addedCount}/${count}: ${fullName} (${randomClass.class_name}${randomSection ? '-' + randomSection.section_name : ''}) - Roll: ${rollNumber}`);
      } catch (err) {
        console.error(`❌ Failed to add ${fullName}:`, err.message);
      }
    }

    console.log(`\n🎉 Successfully added ${addedCount} out of ${count} dummy students!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Get count from command line argument or default to 60
const count = parseInt(process.argv[2]) || 60;
addDummyStudents(count);
