// Enhanced demo data generation with comprehensive test scenarios
const { v4: uuidv4 } = require('uuid');
// Removed bcrypt dependency for demo mode

// Test User Accounts
const TEST_USERS = [
  {
    id: 'demo-admin-001',
    email: 'admin@demo.hospital.com',
    password: 'Admin123!', // Plain text for documentation
    passwordHash: 'demo-hash-admin', // Demo mode - no real hashing
    first_name: 'Sarah',
    last_name: 'Johnson',
    name: 'Sarah Johnson',
    title: 'Scheduling Administrator',
    role: 'admin',
    department_code: 'Admin',
    department_name: 'Administration',
    phone: '555-0101',
    employee_id: 'EMP001',
    hire_date: '2019-01-15',
    certifications: ['BLS', 'ACLS'],
    shift_preference: 'day',
    max_hours_per_week: 40,
    notes: 'System administrator with full access'
  },
  {
    id: 'demo-supervisor-001',
    email: 'supervisor@demo.hospital.com',
    password: 'Super123!',
    first_name: 'Michael',
    last_name: 'Chen',
    name: 'Michael Chen',
    title: 'ED Supervisor',
    role: 'supervisor',
    department_code: 'ED',
    department_name: 'Emergency Department',
    phone: '555-0102',
    employee_id: 'EMP002',
    hire_date: '2020-03-20',
    certifications: ['BLS', 'ACLS', 'PALS', 'TNCC'],
    shift_preference: 'rotating',
    max_hours_per_week: 45,
    notes: 'Emergency Department supervisor'
  },
  {
    id: 'demo-nurse-001',
    email: 'nurse1@demo.hospital.com',
    password: 'Nurse123!',
    first_name: 'Emily',
    last_name: 'Rodriguez',
    name: 'Emily Rodriguez',
    title: 'RN',
    role: 'nurse',
    department_code: 'ED',
    department_name: 'Emergency Department',
    phone: '555-0103',
    employee_id: 'EMP003',
    hire_date: '2021-06-01',
    certifications: ['BLS', 'ACLS', 'PALS'],
    shift_preference: 'night',
    max_hours_per_week: 36,
    notes: 'Night shift preference, critical care certified'
  },
  {
    id: 'demo-nurse-002',
    email: 'nurse2@demo.hospital.com',
    password: 'Nurse123!',
    first_name: 'James',
    last_name: 'Wilson',
    name: 'James Wilson',
    title: 'RN',
    role: 'nurse',
    department_code: 'ICU',
    department_name: 'Intensive Care Unit',
    phone: '555-0104',
    employee_id: 'EMP004',
    hire_date: '2020-09-15',
    certifications: ['BLS', 'ACLS', 'CCRN'],
    shift_preference: 'day',
    max_hours_per_week: 40,
    notes: 'ICU specialist, preceptor'
  },
  {
    id: 'demo-tech-001',
    email: 'tech1@demo.hospital.com',
    password: 'Tech123!',
    first_name: 'Lisa',
    last_name: 'Martinez',
    name: 'Lisa Martinez',
    title: 'Rad Tech',
    role: 'technician',
    department_code: 'XRay',
    department_name: 'X-Ray',
    phone: '555-0105',
    employee_id: 'EMP005',
    hire_date: '2022-01-10',
    certifications: ['BLS', 'ARRT'],
    shift_preference: 'evening',
    max_hours_per_week: 40,
    notes: 'Cross-trained in CT'
  },
  {
    id: 'demo-tech-002',
    email: 'tech2@demo.hospital.com',
    password: 'Tech123!',
    first_name: 'David',
    last_name: 'Kim',
    name: 'David Kim',
    title: 'CT Tech',
    role: 'technician',
    department_code: 'CT',
    department_name: 'CT Scan',
    phone: '555-0106',
    employee_id: 'EMP006',
    hire_date: '2021-11-05',
    certifications: ['BLS', 'ARRT-CT'],
    shift_preference: 'rotating',
    max_hours_per_week: 40,
    notes: 'Available for on-call'
  },
  {
    id: 'demo-parttime-001',
    email: 'parttime@demo.hospital.com',
    password: 'Part123!',
    first_name: 'Amanda',
    last_name: 'Thompson',
    name: 'Amanda Thompson',
    title: 'RN - Part Time',
    role: 'nurse',
    department_code: 'MedSurg',
    department_name: 'Medical Surgical',
    phone: '555-0107',
    employee_id: 'EMP007',
    hire_date: '2022-04-20',
    certifications: ['BLS', 'ACLS'],
    shift_preference: 'weekend',
    max_hours_per_week: 24,
    notes: 'Weekend only, part-time'
  },
  {
    id: 'demo-float-001',
    email: 'float@demo.hospital.com',
    password: 'Float123!',
    first_name: 'Robert',
    last_name: 'Davis',
    name: 'Robert Davis',
    title: 'Float Pool RN',
    role: 'nurse',
    department_code: 'Float',
    department_name: 'Float Pool',
    phone: '555-0108',
    employee_id: 'EMP008',
    hire_date: '2019-07-30',
    certifications: ['BLS', 'ACLS', 'PALS', 'NIH Stroke Scale'],
    shift_preference: 'any',
    max_hours_per_week: 40,
    notes: 'Float pool, can work any department'
  }
];

// Departments with realistic staffing needs
const DEPARTMENTS = [
  { code: 'ED', name: 'Emergency Department', min_staff: 5, max_staff: 12, critical: true },
  { code: 'ICU', name: 'Intensive Care Unit', min_staff: 4, max_staff: 8, critical: true },
  { code: 'MedSurg', name: 'Medical Surgical', min_staff: 3, max_staff: 8, critical: false },
  { code: 'OR', name: 'Operating Room', min_staff: 3, max_staff: 10, critical: true },
  { code: 'PACU', name: 'Post-Anesthesia Care', min_staff: 2, max_staff: 6, critical: true },
  { code: 'L&D', name: 'Labor & Delivery', min_staff: 3, max_staff: 8, critical: true },
  { code: 'NICU', name: 'Neonatal ICU', min_staff: 3, max_staff: 6, critical: true },
  { code: 'Peds', name: 'Pediatrics', min_staff: 2, max_staff: 5, critical: false },
  { code: 'XRay', name: 'X-Ray', min_staff: 1, max_staff: 3, critical: false },
  { code: 'CT', name: 'CT Scan', min_staff: 1, max_staff: 2, critical: false },
  { code: 'MRI', name: 'MRI', min_staff: 1, max_staff: 2, critical: false },
  { code: 'Lab', name: 'Laboratory', min_staff: 2, max_staff: 4, critical: true },
  { code: 'Pharmacy', name: 'Pharmacy', min_staff: 2, max_staff: 4, critical: true },
  { code: 'Float', name: 'Float Pool', min_staff: 0, max_staff: 5, critical: false }
];

// Shift patterns
const SHIFT_PATTERNS = [
  { name: 'Day', start: '07:00:00', end: '15:30:00', differential: 0 },
  { name: 'Evening', start: '15:00:00', end: '23:30:00', differential: 10 },
  { name: 'Night', start: '23:00:00', end: '07:30:00', differential: 15 },
  { name: 'Day 12hr', start: '07:00:00', end: '19:30:00', differential: 0 },
  { name: 'Night 12hr', start: '19:00:00', end: '07:30:00', differential: 15 },
  { name: 'Mid', start: '11:00:00', end: '19:30:00', differential: 5 }
];

// Vacation/PTO data
const VACATION_REQUESTS = [
  {
    id: 'vac-001',
    user_id: 'demo-nurse-001',
    user_name: 'Emily Rodriguez',
    start_date: '2024-12-23',
    end_date: '2024-12-27',
    type: 'vacation',
    status: 'approved',
    approved_by: 'demo-supervisor-001',
    notes: 'Christmas vacation'
  },
  {
    id: 'vac-002',
    user_id: 'demo-tech-001',
    user_name: 'Lisa Martinez',
    start_date: '2024-11-15',
    end_date: '2024-11-17',
    type: 'personal',
    status: 'approved',
    approved_by: 'demo-supervisor-001',
    notes: 'Personal time off'
  },
  {
    id: 'vac-003',
    user_id: 'demo-nurse-002',
    user_name: 'James Wilson',
    start_date: '2024-11-28',
    end_date: '2024-11-29',
    type: 'vacation',
    status: 'pending',
    notes: 'Thanksgiving holiday'
  },
  {
    id: 'vac-004',
    user_id: 'demo-float-001',
    user_name: 'Robert Davis',
    start_date: '2024-12-31',
    end_date: '2025-01-02',
    type: 'vacation',
    status: 'approved',
    approved_by: 'demo-admin-001',
    notes: 'New Year vacation'
  }
];

// On-Call Schedule
const ON_CALL_SCHEDULE = {};

// Generate on-call schedule for next 30 days
function generateOnCallSchedule() {
  const today = new Date();
  const departments = ['ED', 'ICU', 'OR', 'Lab', 'Pharmacy'];
  const onCallStaff = TEST_USERS.filter(u => ['nurse', 'technician', 'supervisor'].includes(u.role));
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().slice(0, 10);
    
    ON_CALL_SCHEDULE[dateStr] = {};
    
    departments.forEach(dept => {
      const eligibleStaff = onCallStaff.filter(u => 
        u.department_code === dept || u.department_code === 'Float'
      );
      
      if (eligibleStaff.length > 0) {
        const staff = eligibleStaff[i % eligibleStaff.length];
        ON_CALL_SCHEDULE[dateStr][dept] = {
          primary: {
            userId: staff.id,
            userName: staff.name,
            phone: staff.phone,
            startTime: '17:00:00',
            endTime: '07:00:00'
          },
          backup: null // Could add backup on-call if needed
        };
      }
    });
  }
  
  return ON_CALL_SCHEDULE;
}

// Generate realistic shift data with assigned staff
function generateShiftsWithAssignments(days = 14) {
  const shifts = [];
  const today = new Date();
  
  for (let day = 0; day < days; day++) {
    const date = new Date(today);
    date.setDate(today.getDate() + day);
    const dateStr = date.toISOString().slice(0, 10);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    // Check for vacations on this date
    const staffOnVacation = VACATION_REQUESTS
      .filter(v => v.status === 'approved' && 
        dateStr >= v.start_date && 
        dateStr <= v.end_date)
      .map(v => v.user_id);
    
    DEPARTMENTS.forEach(dept => {
      // Adjust staffing for weekends
      const requiredStaff = isWeekend 
        ? Math.max(dept.min_staff, Math.floor(dept.max_staff * 0.7))
        : Math.floor(Math.random() * (dept.max_staff - dept.min_staff + 1)) + dept.min_staff;
      
      // Generate shifts for each pattern
      const patterns = dept.critical ? 
        SHIFT_PATTERNS.filter(p => p.name.includes('12hr') || p.name === 'Day' || p.name === 'Night') :
        SHIFT_PATTERNS.filter(p => !p.name.includes('Night') || isWeekend);
      
      patterns.forEach(pattern => {
        const shiftId = uuidv4();
        
        // Find available staff for this shift
        const availableStaff = TEST_USERS.filter(u => 
          (u.department_code === dept.code || u.department_code === 'Float') &&
          !staffOnVacation.includes(u.id) &&
          (u.shift_preference === 'any' || 
           u.shift_preference === 'rotating' ||
           (pattern.name.toLowerCase().includes(u.shift_preference)))
        );
        
        // Assign staff to shift
        const assignedStaff = [];
        const staffNeeded = Math.min(requiredStaff, availableStaff.length);
        
        for (let i = 0; i < staffNeeded; i++) {
          if (availableStaff[i]) {
            assignedStaff.push({
              user_id: availableStaff[i].id,
              user_name: availableStaff[i].name,
              title: availableStaff[i].title,
              assigned_at: new Date(date.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
            });
          }
        }
        
        shifts.push({
          id: shiftId,
          date: dateStr,
          department_id: dept.code,
          department_name: dept.name,
          shift_type: pattern.name,
          start_time: pattern.start,
          end_time: pattern.end,
          required_staff: requiredStaff,
          assigned_staff: assignedStaff,
          current_staff: assignedStaff.length,
          status: assignedStaff.length >= requiredStaff ? 'filled' : 
                  assignedStaff.length > 0 ? 'partial' : 'open',
          differential: pattern.differential,
          is_critical: dept.critical,
          notes: isWeekend ? 'Weekend shift' : '',
          created_by: 'demo-admin-001',
          created_at: new Date(date.getTime() - Math.random() * 14 * 24 * 60 * 60 * 1000).toISOString()
        });
      });
    });
  }
  
  return shifts;
}

// Fatigue tracking data
function generateFatigueData() {
  const fatigueData = [];
  
  TEST_USERS.forEach(user => {
    if (['nurse', 'technician'].includes(user.role)) {
      const consecutiveHours = Math.floor(Math.random() * 24) + 12;
      const hoursThisWeek = Math.floor(Math.random() * 20) + 30;
      const lastBreak = Math.floor(Math.random() * 12) + 1;
      
      fatigueData.push({
        user_id: user.id,
        user_name: user.name,
        consecutive_hours: consecutiveHours,
        hours_this_week: hoursThisWeek,
        hours_this_month: hoursThisWeek * 4,
        last_break_hours_ago: lastBreak,
        fatigue_score: calculateFatigueScore(consecutiveHours, hoursThisWeek, lastBreak),
        risk_level: consecutiveHours > 16 ? 'high' : consecutiveHours > 12 ? 'medium' : 'low',
        last_updated: new Date().toISOString()
      });
    }
  });
  
  return fatigueData;
}

function calculateFatigueScore(consecutive, weekly, lastBreak) {
  let score = 0;
  
  // Consecutive hours factor
  if (consecutive > 16) score += 40;
  else if (consecutive > 12) score += 25;
  else if (consecutive > 8) score += 10;
  
  // Weekly hours factor
  if (weekly > 60) score += 30;
  else if (weekly > 48) score += 20;
  else if (weekly > 40) score += 10;
  
  // Break factor
  if (lastBreak > 8) score += 20;
  else if (lastBreak > 6) score += 10;
  
  return Math.min(score, 100);
}

// Skills and certifications matrix
const SKILLS_MATRIX = {
  'demo-nurse-001': ['IV Therapy', 'Ventilator Management', 'Trauma Care', 'Pediatric Emergency'],
  'demo-nurse-002': ['Critical Care', 'ECMO', 'Dialysis', 'Cardiac Care'],
  'demo-tech-001': ['Fluoroscopy', 'Portable X-Ray', 'CT Basics'],
  'demo-tech-002': ['Contrast Administration', 'Advanced CT', 'MRI Cross-Training'],
  'demo-float-001': ['All Units', 'Charge Nurse', 'Preceptor', 'Emergency Response']
};

// Shift swap requests
const SWAP_REQUESTS = [
  {
    id: 'swap-001',
    requester_id: 'demo-nurse-001',
    requester_name: 'Emily Rodriguez',
    target_id: 'demo-nurse-002',
    target_name: 'James Wilson',
    shift_date: '2024-11-10',
    original_shift: 'Night 12hr',
    requested_shift: 'Day 12hr',
    status: 'pending',
    reason: 'Family commitment',
    created_at: new Date().toISOString()
  },
  {
    id: 'swap-002',
    requester_id: 'demo-tech-001',
    requester_name: 'Lisa Martinez',
    target_id: 'demo-tech-002',
    target_name: 'David Kim',
    shift_date: '2024-11-12',
    original_shift: 'Evening',
    requested_shift: 'Day',
    status: 'approved',
    approved_by: 'demo-supervisor-001',
    reason: 'Medical appointment',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Export all data generators
module.exports = {
  TEST_USERS,
  DEPARTMENTS,
  SHIFT_PATTERNS,
  VACATION_REQUESTS,
  SKILLS_MATRIX,
  SWAP_REQUESTS,
  generateOnCallSchedule,
  generateShiftsWithAssignments,
  generateFatigueData,
  
  // Initialize all demo data
  initializeDemoData: async function() {
    // Demo mode - use simple hash placeholder
    for (let user of TEST_USERS) {
      user.passwordHash = `demo-hash-${user.email}`;
    }
    
    return {
      users: TEST_USERS,
      departments: DEPARTMENTS,
      shifts: generateShiftsWithAssignments(14),
      onCallSchedule: generateOnCallSchedule(),
      vacations: VACATION_REQUESTS,
      fatigueData: generateFatigueData(),
      swapRequests: SWAP_REQUESTS,
      skillsMatrix: SKILLS_MATRIX
    };
  },
  
  // Get specific test user
  getTestUser: function(email) {
    return TEST_USERS.find(u => u.email === email);
  },
  
  // Check if user is on vacation
  isUserOnVacation: function(userId, date) {
    return VACATION_REQUESTS.some(v => 
      v.user_id === userId &&
      v.status === 'approved' &&
      date >= v.start_date &&
      date <= v.end_date
    );
  },
  
  // Get on-call staff for date and department
  getOnCallStaff: function(date, department) {
    if (!ON_CALL_SCHEDULE[date]) {
      generateOnCallSchedule();
    }
    return ON_CALL_SCHEDULE[date]?.[department] || null;
  }
};