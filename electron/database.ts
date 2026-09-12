import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

let db: any;

export const database = {
  init: (Database: any, userId?: string) => {
    const DATA_DIR = path.join(app.getPath('userData'), 'ClinicData');
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const legacyDbPath = path.join(DATA_DIR, 'medflow.db');
    const buvoraDbPath = path.join(DATA_DIR, 'buvora.db');

    if (fs.existsSync(legacyDbPath) && !fs.existsSync(buvoraDbPath)) {
      try {
        fs.renameSync(legacyDbPath, buvoraDbPath);
        console.log('[DB] Renamed legacy medflow.db to buvora.db');
      } catch (e) {
        console.warn('[DB] Could not rename legacy medflow.db:', e);
      }
    }

    const DB_PATH = fs.existsSync(buvoraDbPath) ? buvoraDbPath : (fs.existsSync(legacyDbPath) ? legacyDbPath : buvoraDbPath);

    if (db) {
      try {
        db.close();
        console.log('Closed previous database connection.');
      } catch (err) {
        console.error('Failed to close previous database connection:', err);
      }
    }

    db = new Database(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
    db.exec('PRAGMA cache_size = -64000;');

    // Initialize Tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL DEFAULT 'reception',
        doctorId TEXT,
        password TEXT,
        allowedTabs TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS doctors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        specialization TEXT,
        qualifications TEXT,
        phone TEXT,
        address TEXT,
        printHeader INTEGER DEFAULT 1,
        customTopMargin INTEGER DEFAULT 0,
        customBottomMargin INTEGER DEFAULT 0,
        upiId TEXT,
        qrCodeText TEXT,
        showQrCodeOnReceipt INTEGER DEFAULT 0,
        chamber TEXT
      );

      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT DEFAULT 'General',
        unit TEXT DEFAULT 'Units',
        serviceType TEXT DEFAULT 'OPD'
      );

      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        receiptNumber TEXT NOT NULL,
        date TEXT NOT NULL,
        patientId TEXT,
        patientName TEXT NOT NULL,
        patientAge TEXT,
        patientGender TEXT,
        patientPhone TEXT,
        doctorId TEXT NOT NULL,
        doctorName TEXT NOT NULL,
        items TEXT,
        total REAL NOT NULL,
        paymentMethod TEXT DEFAULT 'CASH',
        appointmentId TEXT,
        showQrCode INTEGER DEFAULT 0,
        qrCodeText TEXT,
        billType TEXT DEFAULT 'OPD',
        roomNumber TEXT,
        admissionDate TEXT,
        dischargeDate TEXT,
        advancePaid REAL DEFAULT 0,
        discount REAL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS receipt_items (
        id TEXT PRIMARY KEY,
        receiptId TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        FOREIGN KEY (receiptId) REFERENCES receipts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prescriptions (
        id TEXT PRIMARY KEY,
        receiptId TEXT,
        patientId TEXT,
        date TEXT NOT NULL,
        patientName TEXT NOT NULL,
        patientAge TEXT,
        patientGender TEXT,
        patientPhone TEXT,
        doctorId TEXT NOT NULL,
        doctorName TEXT NOT NULL,
        symptoms TEXT,
        diagnosis TEXT,
        medicines TEXT,
        notes TEXT,
        followUpDate TEXT,
        followUpNotes TEXT,
        labInvestigations TEXT
      );

      CREATE TABLE IF NOT EXISTS follow_ups (
        id TEXT PRIMARY KEY,
        prescriptionId TEXT,
        receiptId TEXT,
        patientId TEXT,
        patientName TEXT NOT NULL,
        patientPhone TEXT,
        patientAge TEXT,
        patientGender TEXT,
        doctorId TEXT NOT NULL,
        doctorName TEXT NOT NULL,
        scheduledDate TEXT NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'PENDING',
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        patientId TEXT,
        patientName TEXT NOT NULL,
        patientPhone TEXT NOT NULL,
        patientAge TEXT,
        patientGender TEXT,
        doctorId TEXT NOT NULL,
        doctorName TEXT NOT NULL,
        appointmentDate TEXT NOT NULL,
        appointmentTime TEXT NOT NULL,
        date TEXT,
        timeSlot TEXT,
        notes TEXT,
        rejectionReason TEXT,
        source TEXT DEFAULT 'WHATSAPP',
        status TEXT DEFAULT 'PENDING',
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        paidAmount REAL DEFAULT 0,
        date TEXT NOT NULL,
        dueDate TEXT,
        paymentMode TEXT NOT NULL DEFAULT 'CASH',
        paidTo TEXT,
        vendorPhone TEXT,
        billNumber TEXT,
        isRecurring INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'PAID',
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
      CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
      CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
      CREATE INDEX IF NOT EXISTS idx_receipts_patientPhone ON receipts(patientPhone);
      CREATE INDEX IF NOT EXISTS idx_receipts_receiptNumber ON receipts(receiptNumber);
      CREATE INDEX IF NOT EXISTS idx_receipt_items_receiptId ON receipt_items(receiptId);

      -- Hospital Pharmacy Tables
      CREATE TABLE IF NOT EXISTS medicines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        genericName TEXT,
        category TEXT DEFAULT 'Tablet',
        manufacturer TEXT,
        unit TEXT DEFAULT 'Strip',
        hsnCode TEXT,
        minStockAlert INTEGER DEFAULT 10,
        locationRack TEXT,
        notes TEXT,
        createdAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS medicine_batches (
        id TEXT PRIMARY KEY,
        medicineId TEXT NOT NULL,
        batchNumber TEXT NOT NULL,
        expiryDate TEXT NOT NULL,
        purchaseRate REAL DEFAULT 0,
        salePrice REAL NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (medicineId) REFERENCES medicines(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS pharmacy_sales (
        id TEXT PRIMARY KEY,
        saleNumber TEXT NOT NULL,
        patientId TEXT,
        patientName TEXT NOT NULL,
        patientPhone TEXT,
        prescriptionId TEXT,
        date TEXT NOT NULL,
        items TEXT NOT NULL,
        subtotal REAL NOT NULL,
        discount REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        total REAL NOT NULL,
        paymentMethod TEXT DEFAULT 'CASH',
        dispensedBy TEXT,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
      CREATE INDEX IF NOT EXISTS idx_batches_medicineId ON medicine_batches(medicineId);
      CREATE INDEX IF NOT EXISTS idx_batches_expiry ON medicine_batches(expiryDate);
      CREATE INDEX IF NOT EXISTS idx_pharmacy_sales_date ON pharmacy_sales(date);
      CREATE INDEX IF NOT EXISTS idx_pharmacy_sales_patientId ON pharmacy_sales(patientId);

      -- Hospital IPD (Inpatient Department) Wards & Beds
      CREATE TABLE IF NOT EXISTS wards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        floor TEXT DEFAULT 'Ground Floor',
        dailyRate REAL NOT NULL DEFAULT 0,
        nursingRate REAL DEFAULT 0,
        totalBeds INTEGER DEFAULT 0,
        description TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS beds (
        id TEXT PRIMARY KEY,
        wardId TEXT NOT NULL,
        bedNumber TEXT NOT NULL,
        bedType TEXT DEFAULT 'Standard',
        dailyRate REAL NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'available',
        currentAdmissionId TEXT,
        notes TEXT,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (wardId) REFERENCES wards(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS bed_admissions (
        id TEXT PRIMARY KEY,
        admissionNumber TEXT NOT NULL,
        patientId TEXT,
        patientUhid TEXT,
        patientName TEXT NOT NULL,
        patientPhone TEXT,
        patientGender TEXT,
        patientAge TEXT,
        wardId TEXT NOT NULL,
        wardName TEXT NOT NULL,
        bedId TEXT NOT NULL,
        bedNumber TEXT NOT NULL,
        doctorId TEXT NOT NULL,
        doctorName TEXT NOT NULL,
        admittedAt TEXT NOT NULL,
        dischargedAt TEXT,
        expectedDischargeAt TEXT,
        diagnosis TEXT,
        initialVitals TEXT,
        vitalsLog TEXT,
        wardChargesLog TEXT,
        emarOrdersLog TEXT,
        emarAdminLog TEXT,
        fluidIoLog TEXT,
        nursingNotesLog TEXT,
        advancePaid REAL DEFAULT 0,
        paymentMode TEXT DEFAULT 'CASH',
        status TEXT DEFAULT 'admitted',
        billingStatus TEXT DEFAULT 'NONE',
        dischargeSummary TEXT,
        totalBillId TEXT,
        notes TEXT,
        transfersLog TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lab_tests (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        category TEXT NOT NULL,
        rate REAL NOT NULL DEFAULT 0,
        sampleType TEXT DEFAULT 'Blood (EDTA)',
        turnaroundTime TEXT DEFAULT '2-4 Hours',
        parameters TEXT NOT NULL,
        description TEXT,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lab_orders (
        id TEXT PRIMARY KEY,
        orderNumber TEXT NOT NULL,
        patientId TEXT,
        patientName TEXT NOT NULL,
        patientPhone TEXT,
        patientGender TEXT,
        patientAge TEXT,
        doctorId TEXT,
        doctorName TEXT,
        prescriptionId TEXT,
        tests TEXT NOT NULL,
        totalAmount REAL NOT NULL DEFAULT 0,
        discount REAL DEFAULT 0,
        paidAmount REAL DEFAULT 0,
        paymentMode TEXT DEFAULT 'CASH',
        status TEXT DEFAULT 'ORDERED',
        sampleCollectedAt TEXT,
        sampleCollectedBy TEXT,
        completedAt TEXT,
        technicianNotes TEXT,
        pathologistRemarks TEXT,
        orderDate TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tpa_providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        contactEmail TEXT,
        contactPhone TEXT,
        portalUrl TEXT,
        defaultCopayPercent REAL DEFAULT 0,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS insurance_claims (
        id TEXT PRIMARY KEY,
        claimNumber TEXT NOT NULL,
        admissionId TEXT,
        patientId TEXT,
        patientUhid TEXT,
        patientName TEXT NOT NULL,
        patientPhone TEXT,
        tpaProviderId TEXT NOT NULL,
        tpaProviderName TEXT NOT NULL,
        insurerName TEXT NOT NULL,
        policyNumber TEXT NOT NULL,
        cardId TEXT,
        corporateName TEXT,
        sumInsured REAL DEFAULT 0,
        initialPreAuthAmount REAL DEFAULT 0,
        approvedAmount REAL DEFAULT 0,
        finalSettledAmount REAL DEFAULT 0,
        copayPercent REAL DEFAULT 0,
        nonPayableDeductions REAL DEFAULT 0,
        status TEXT DEFAULT 'PREAUTH_DRAFT',
        queriesLog TEXT,
        preAuthLetterRef TEXT,
        settlementDate TEXT,
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      -- Operation Theatres & Surgical Suites
      CREATE TABLE IF NOT EXISTS operation_theatres (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        theatreType TEXT DEFAULT 'MAJOR',
        floor TEXT DEFAULT '1st Floor',
        dailyRate REAL DEFAULT 0,
        status TEXT DEFAULT 'AVAILABLE',
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS surgical_cases (
        id TEXT PRIMARY KEY,
        caseNumber TEXT NOT NULL,
        patientId TEXT,
        patientUhid TEXT,
        patientName TEXT NOT NULL,
        patientPhone TEXT,
        patientAge TEXT,
        patientGender TEXT,
        admissionId TEXT,
        theatreId TEXT NOT NULL,
        theatreName TEXT NOT NULL,
        surgeryName TEXT NOT NULL,
        surgeryCategory TEXT DEFAULT 'GENERAL',
        urgency TEXT DEFAULT 'ELECTIVE',
        primarySurgeonId TEXT NOT NULL,
        primarySurgeonName TEXT NOT NULL,
        assistantSurgeonName TEXT,
        anesthetistName TEXT,
        scrubNurseName TEXT,
        circulatingNurseName TEXT,
        scheduledDate TEXT NOT NULL,
        startTime TEXT NOT NULL,
        endTime TEXT,
        status TEXT DEFAULT 'SCHEDULED',
        pacData TEXT,
        whoChecklistData TEXT,
        intraOpNotes TEXT,
        pacuData TEXT,
        chargesLogged TEXT,
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      -- Emergency Department, Casualty & Triage
      CREATE TABLE IF NOT EXISTS emergency_visits (
        id TEXT PRIMARY KEY,
        emergencyNumber TEXT NOT NULL,
        patientId TEXT,
        patientUhid TEXT,
        patientName TEXT NOT NULL,
        patientPhone TEXT,
        patientAge TEXT,
        patientGender TEXT,
        triageLevel INTEGER NOT NULL DEFAULT 3,
        triageCategory TEXT NOT NULL DEFAULT 'YELLOW',
        chiefComplaint TEXT NOT NULL,
        triageVitals TEXT,
        triageNurseName TEXT,
        attendingDoctorId TEXT,
        attendingDoctorName TEXT,
        arrivedAt TEXT NOT NULL,
        disposition TEXT DEFAULT 'UNDER_TREATMENT',
        dispositionNotes TEXT,
        dischargedAt TEXT,
        admittedBedId TEXT,
        admittedAdmissionId TEXT,
        isMlc INTEGER DEFAULT 0,
        mlcNumber TEXT,
        mlcData TEXT,
        notes TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      -- Medico-Legal Cases (MLC) Registry
      CREATE TABLE IF NOT EXISTS mlc_records (
        id TEXT PRIMARY KEY,
        mlcNumber TEXT NOT NULL,
        emergencyVisitId TEXT,
        patientId TEXT,
        patientName TEXT NOT NULL,
        patientAge TEXT,
        patientGender TEXT,
        policeStation TEXT NOT NULL,
        policeOfficerName TEXT,
        policeBadgeNumber TEXT,
        incidentDate TEXT NOT NULL,
        incidentPlace TEXT,
        incidentType TEXT NOT NULL DEFAULT 'RTA',
        broughtByName TEXT NOT NULL,
        broughtByPhone TEXT,
        broughtByRelation TEXT,
        injuryDescription TEXT NOT NULL,
        injuryType TEXT DEFAULT 'SIMPLE',
        weaponType TEXT,
        alcoholSmellDetected INTEGER DEFAULT 0,
        dyingDeclarationRequired INTEGER DEFAULT 0,
        intimationSentAt TEXT,
        certificateIssuedAt TEXT,
        doctorSignatureName TEXT NOT NULL,
        status TEXT DEFAULT 'REGISTERED',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_beds_wardId ON beds(wardId);
      CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);
      CREATE INDEX IF NOT EXISTS idx_admissions_patientId ON bed_admissions(patientId);
      CREATE INDEX IF NOT EXISTS idx_admissions_status ON bed_admissions(status);
      CREATE INDEX IF NOT EXISTS idx_admissions_bedId ON bed_admissions(bedId);
      CREATE INDEX IF NOT EXISTS idx_prescriptions_receiptId ON prescriptions(receiptId);
      CREATE INDEX IF NOT EXISTS idx_lab_tests_category ON lab_tests(category);
      CREATE INDEX IF NOT EXISTS idx_lab_orders_patientId ON lab_orders(patientId);
      CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status);
      CREATE INDEX IF NOT EXISTS idx_lab_orders_orderDate ON lab_orders(orderDate);
      CREATE INDEX IF NOT EXISTS idx_claims_patientId ON insurance_claims(patientId);
      CREATE INDEX IF NOT EXISTS idx_claims_admissionId ON insurance_claims(admissionId);
      CREATE INDEX IF NOT EXISTS idx_claims_status ON insurance_claims(status);
      CREATE INDEX IF NOT EXISTS idx_claims_tpaProviderId ON insurance_claims(tpaProviderId);
      CREATE INDEX IF NOT EXISTS idx_surgical_theatreId ON surgical_cases(theatreId);
      CREATE INDEX IF NOT EXISTS idx_surgical_scheduledDate ON surgical_cases(scheduledDate);
      CREATE INDEX IF NOT EXISTS idx_surgical_status ON surgical_cases(status);
      CREATE INDEX IF NOT EXISTS idx_surgical_admissionId ON surgical_cases(admissionId);
      CREATE INDEX IF NOT EXISTS idx_emergency_triageCategory ON emergency_visits(triageCategory);
      CREATE INDEX IF NOT EXISTS idx_emergency_disposition ON emergency_visits(disposition);
      CREATE INDEX IF NOT EXISTS idx_emergency_arrivedAt ON emergency_visits(arrivedAt);
      CREATE INDEX IF NOT EXISTS idx_mlc_mlcNumber ON mlc_records(mlcNumber);
      CREATE INDEX IF NOT EXISTS idx_mlc_policeStation ON mlc_records(policeStation);

      -- Module 3: Doctor Revenue Share & Payouts Engine
      CREATE TABLE IF NOT EXISTS doctor_commission_rules (
        id TEXT PRIMARY KEY,
        doctorId TEXT NOT NULL UNIQUE,
        doctorName TEXT NOT NULL,
        opdType TEXT DEFAULT 'PERCENT',
        opdValue REAL DEFAULT 70,
        ipdVisitRate REAL DEFAULT 800,
        surgerySharePercent REAL DEFAULT 60,
        assistantSurgeonPercent REAL DEFAULT 15,
        anesthetistPercent REAL DEFAULT 25,
        labReferralPercent REAL DEFAULT 10,
        pharmacyReferralPercent REAL DEFAULT 0,
        tdsPercent REAL DEFAULT 10,
        hospitalFacilityRetentionPercent REAL DEFAULT 0,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS doctor_payout_transactions (
        id TEXT PRIMARY KEY,
        payoutNumber TEXT NOT NULL UNIQUE,
        doctorId TEXT NOT NULL,
        doctorName TEXT NOT NULL,
        periodStart TEXT NOT NULL,
        periodEnd TEXT NOT NULL,
        opdConsultationEarnings REAL DEFAULT 0,
        ipdVisitsEarnings REAL DEFAULT 0,
        surgeryEarnings REAL DEFAULT 0,
        labReferralEarnings REAL DEFAULT 0,
        grossEarnings REAL DEFAULT 0,
        tdsDeduction REAL DEFAULT 0,
        hospitalFacilityDeduction REAL DEFAULT 0,
        otherDeductions REAL DEFAULT 0,
        netPayoutAmount REAL DEFAULT 0,
        paymentMode TEXT DEFAULT 'BANK_TRANSFER',
        paymentReference TEXT,
        status TEXT DEFAULT 'PAID',
        notes TEXT,
        payoutDate TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      -- Module 3: Hospital Ward & OT to Pharmacy Stock Indenting
      CREATE TABLE IF NOT EXISTS hospital_indents (
        id TEXT PRIMARY KEY,
        indentNumber TEXT NOT NULL UNIQUE,
        departmentType TEXT NOT NULL,
        sourceLocation TEXT NOT NULL,
        targetDepartment TEXT DEFAULT 'PHARMACY',
        requestedBy TEXT NOT NULL,
        priority TEXT DEFAULT 'ROUTINE',
        status TEXT DEFAULT 'PENDING',
        notes TEXT,
        requestedAt TEXT NOT NULL,
        fulfilledAt TEXT,
        fulfilledBy TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS hospital_indent_items (
        id TEXT PRIMARY KEY,
        indentId TEXT NOT NULL,
        medicineId TEXT,
        itemName TEXT NOT NULL,
        itemCategory TEXT,
        requestedQuantity INTEGER NOT NULL,
        issuedQuantity INTEGER DEFAULT 0,
        batchNumber TEXT,
        notes TEXT,
        FOREIGN KEY (indentId) REFERENCES hospital_indents(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_commission_rules_doctorId ON doctor_commission_rules(doctorId);
      CREATE INDEX IF NOT EXISTS idx_payouts_doctorId ON doctor_payout_transactions(doctorId);
      CREATE INDEX IF NOT EXISTS idx_payouts_date ON doctor_payout_transactions(payoutDate);
      CREATE INDEX IF NOT EXISTS idx_indents_status ON hospital_indents(status);
      CREATE INDEX IF NOT EXISTS idx_indents_date ON hospital_indents(requestedAt);
      CREATE INDEX IF NOT EXISTS idx_indent_items_indentId ON hospital_indent_items(indentId);
    `);

    // Clean up any previously seeded default medicines so no hardcoded data remains
    try {
      db.prepare("DELETE FROM medicines WHERE notes = 'Default hospital formulary'").run();
    } catch (_) {}

    // Seed default hospital wards and beds if empty
    try {
      const wardCount = db.prepare('SELECT COUNT(*) as cnt FROM wards').get() as { cnt: number };
      if (wardCount && wardCount.cnt === 0) {
        const seedNow = new Date().toISOString();
        const defaultWards = [
          {
            id: 'WARD-ICU',
            name: 'Intensive Care Unit (ICU)',
            code: 'ICU',
            floor: '1st Floor - Wing A',
            dailyRate: 3500,
            nursingRate: 800,
            beds: [
              { num: 'ICU-01', type: 'ICU Electric Multi-Para' },
              { num: 'ICU-02', type: 'ICU Electric Multi-Para' },
              { num: 'ICU-03', type: 'ICU Electric Multi-Para' },
              { num: 'ICU-04', type: 'ICU Electric Multi-Para' }
            ]
          },
          {
            id: 'WARD-GW-M',
            name: 'General Ward (Male)',
            code: 'GW-M',
            floor: 'Ground Floor',
            dailyRate: 600,
            nursingRate: 150,
            beds: [
              { num: 'GW-M01', type: 'Standard Fowler' },
              { num: 'GW-M02', type: 'Standard Fowler' },
              { num: 'GW-M03', type: 'Standard Fowler' },
              { num: 'GW-M04', type: 'Standard Fowler' },
              { num: 'GW-M05', type: 'Standard Fowler' },
              { num: 'GW-M06', type: 'Standard Fowler' }
            ]
          },
          {
            id: 'WARD-GW-F',
            name: 'General Ward (Female)',
            code: 'GW-F',
            floor: 'Ground Floor',
            dailyRate: 600,
            nursingRate: 150,
            beds: [
              { num: 'GW-F01', type: 'Standard Fowler' },
              { num: 'GW-F02', type: 'Standard Fowler' },
              { num: 'GW-F03', type: 'Standard Fowler' },
              { num: 'GW-F04', type: 'Standard Fowler' },
              { num: 'GW-F05', type: 'Standard Fowler' },
              { num: 'GW-F06', type: 'Standard Fowler' }
            ]
          },
          {
            id: 'WARD-SP',
            name: 'Semi-Private Room',
            code: 'SP',
            floor: '2nd Floor - Wing B',
            dailyRate: 1200,
            nursingRate: 300,
            beds: [
              { num: 'SP-101', type: 'Semi-Fowler' },
              { num: 'SP-102', type: 'Semi-Fowler' },
              { num: 'SP-103', type: 'Semi-Fowler' },
              { num: 'SP-104', type: 'Semi-Fowler' }
            ]
          },
          {
            id: 'WARD-PVT',
            name: 'Deluxe Private Suite',
            code: 'PVT',
            floor: '2nd Floor - Wing A',
            dailyRate: 2500,
            nursingRate: 500,
            beds: [
              { num: 'PVT-201', type: 'Motorized Deluxe Suite' },
              { num: 'PVT-202', type: 'Motorized Deluxe Suite' },
              { num: 'PVT-203', type: 'Motorized Deluxe Suite' }
            ]
          },
          {
            id: 'WARD-DC',
            name: 'Daycare & Observation',
            code: 'DC',
            floor: 'Ground Floor - Emergency',
            dailyRate: 400,
            nursingRate: 100,
            beds: [
              { num: 'DC-01', type: 'Daycare Recliner Bed' },
              { num: 'DC-02', type: 'Daycare Recliner Bed' },
              { num: 'DC-03', type: 'Daycare Recliner Bed' }
            ]
          }
        ];

        const insertWard = db.prepare(`
          INSERT INTO wards (id, name, code, floor, dailyRate, nursingRate, totalBeds, description, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `);
        const insertBed = db.prepare(`
          INSERT INTO beds (id, wardId, bedNumber, bedType, dailyRate, status, notes, updatedAt)
          VALUES (?, ?, ?, ?, ?, 'available', '', ?)
        `);

        for (const w of defaultWards) {
          insertWard.run(w.id, w.name, w.code, w.floor, w.dailyRate, w.nursingRate, w.beds.length, `${w.name} - Floor: ${w.floor}`, seedNow, seedNow);
          for (const b of w.beds) {
            insertBed.run(`BED-${b.num}`, w.id, b.num, b.type, w.dailyRate, seedNow);
          }
        }
        console.log('[DB] Pre-seeded 6 hospital wards with 26 inpatient beds');
      }
    } catch (e) {
      console.warn('[DB] Seeding wards and beds failed or skipped:', e);
    }

    // Seed default standard clinical laboratory tests if empty
    try {
      const testCount = db.prepare('SELECT COUNT(*) as cnt FROM lab_tests').get() as { cnt: number };
      if (testCount && testCount.cnt === 0) {
        const seedNow = new Date().toISOString();
        const defaultLabTests = [
          {
            id: 'LAB-CBC',
            name: 'Complete Blood Count (CBC) with ESR',
            code: 'CBC',
            category: 'Hematology',
            rate: 350,
            sampleType: 'Blood (EDTA)',
            turnaroundTime: '2-4 Hours',
            description: 'Automated 12-parameter blood count for anemia, infection, and platelet assessment',
            parameters: [
              { id: 'hb', name: 'Hemoglobin (Hb)', unit: 'g/dL', maleRange: '13.5 - 17.5', femaleRange: '12.0 - 15.5', defaultRange: '12.0 - 17.5' },
              { id: 'rbc', name: 'Total RBC Count', unit: 'mill/cu.mm', maleRange: '4.5 - 5.9', femaleRange: '4.0 - 5.2', defaultRange: '4.5 - 5.5' },
              { id: 'tlc', name: 'Total Leucocyte Count (TLC)', unit: '/cu.mm', maleRange: '4,000 - 11,000', femaleRange: '4,000 - 11,000', defaultRange: '4,000 - 11,000' },
              { id: 'neutrophils', name: 'Neutrophils', unit: '%', maleRange: '40 - 70', femaleRange: '40 - 70', defaultRange: '40 - 70' },
              { id: 'lymphocytes', name: 'Lymphocytes', unit: '%', maleRange: '20 - 45', femaleRange: '20 - 45', defaultRange: '20 - 45' },
              { id: 'eosinophils', name: 'Eosinophils', unit: '%', maleRange: '1 - 6', femaleRange: '1 - 6', defaultRange: '1 - 6' },
              { id: 'monocytes', name: 'Monocytes', unit: '%', maleRange: '2 - 8', femaleRange: '2 - 8', defaultRange: '2 - 8' },
              { id: 'basophils', name: 'Basophils', unit: '%', maleRange: '0 - 1', femaleRange: '0 - 1', defaultRange: '0 - 1' },
              { id: 'platelets', name: 'Platelet Count', unit: 'lakhs/cu.mm', maleRange: '1.5 - 4.5', femaleRange: '1.5 - 4.5', defaultRange: '1.5 - 4.5' },
              { id: 'pcv', name: 'Packed Cell Volume (PCV)', unit: '%', maleRange: '40 - 50', femaleRange: '36 - 46', defaultRange: '36 - 50' },
              { id: 'mcv', name: 'Mean Corpuscular Volume (MCV)', unit: 'fL', maleRange: '80 - 100', femaleRange: '80 - 100', defaultRange: '80 - 100' },
              { id: 'esr', name: 'ESR (Westergren Method)', unit: 'mm/1st hr', maleRange: '0 - 15', femaleRange: '0 - 20', defaultRange: '0 - 20' }
            ]
          },
          {
            id: 'LAB-LFT',
            name: 'Liver Function Test (LFT Profile)',
            code: 'LFT',
            category: 'Biochemistry',
            rate: 650,
            sampleType: 'Blood (Serum)',
            turnaroundTime: '4-6 Hours',
            description: 'Comprehensive liver enzymes, bilirubin fractions, total protein, and albumin',
            parameters: [
              { id: 'bili_tot', name: 'Bilirubin Total', unit: 'mg/dL', maleRange: '0.2 - 1.2', femaleRange: '0.2 - 1.2', defaultRange: '0.2 - 1.2' },
              { id: 'bili_dir', name: 'Bilirubin Direct', unit: 'mg/dL', maleRange: '0.0 - 0.3', femaleRange: '0.0 - 0.3', defaultRange: '0.0 - 0.3' },
              { id: 'bili_ind', name: 'Bilirubin Indirect', unit: 'mg/dL', maleRange: '0.2 - 0.9', femaleRange: '0.2 - 0.9', defaultRange: '0.2 - 0.9' },
              { id: 'sgot', name: 'SGOT / AST', unit: 'U/L', maleRange: '5 - 40', femaleRange: '5 - 35', defaultRange: '5 - 40' },
              { id: 'sgpt', name: 'SGPT / ALT', unit: 'U/L', maleRange: '7 - 56', femaleRange: '7 - 45', defaultRange: '7 - 56' },
              { id: 'alp', name: 'Alkaline Phosphatase (ALP)', unit: 'U/L', maleRange: '44 - 147', femaleRange: '44 - 147', defaultRange: '44 - 147' },
              { id: 'tot_prot', name: 'Total Protein', unit: 'g/dL', maleRange: '6.0 - 8.3', femaleRange: '6.0 - 8.3', defaultRange: '6.0 - 8.3' },
              { id: 'albumin', name: 'Serum Albumin', unit: 'g/dL', maleRange: '3.5 - 5.0', femaleRange: '3.5 - 5.0', defaultRange: '3.5 - 5.0' },
              { id: 'globulin', name: 'Serum Globulin', unit: 'g/dL', maleRange: '2.0 - 3.5', femaleRange: '2.0 - 3.5', defaultRange: '2.0 - 3.5' },
              { id: 'ag_ratio', name: 'A/G Ratio', unit: 'ratio', maleRange: '1.2 - 2.2', femaleRange: '1.2 - 2.2', defaultRange: '1.2 - 2.2' }
            ]
          },
          {
            id: 'LAB-KFT',
            name: 'Kidney Function Test (KFT / RFT with Electrolytes)',
            code: 'KFT',
            category: 'Biochemistry',
            rate: 600,
            sampleType: 'Blood (Serum)',
            turnaroundTime: '4-6 Hours',
            description: 'Renal panel including Serum Creatinine, Urea, Uric Acid, Calcium, and Electrolytes',
            parameters: [
              { id: 'urea', name: 'Blood Urea', unit: 'mg/dL', maleRange: '15 - 45', femaleRange: '15 - 45', defaultRange: '15 - 45' },
              { id: 'creatinine', name: 'Serum Creatinine', unit: 'mg/dL', maleRange: '0.7 - 1.3', femaleRange: '0.6 - 1.1', defaultRange: '0.6 - 1.3' },
              { id: 'bun', name: 'Blood Urea Nitrogen (BUN)', unit: 'mg/dL', maleRange: '7 - 20', femaleRange: '7 - 20', defaultRange: '7 - 20' },
              { id: 'uric_acid', name: 'Serum Uric Acid', unit: 'mg/dL', maleRange: '3.5 - 7.2', femaleRange: '2.6 - 6.0', defaultRange: '2.6 - 7.2' },
              { id: 'calcium', name: 'Serum Calcium', unit: 'mg/dL', maleRange: '8.5 - 10.5', femaleRange: '8.5 - 10.5', defaultRange: '8.5 - 10.5' },
              { id: 'sodium', name: 'Serum Sodium (Na+)', unit: 'mEq/L', maleRange: '135 - 145', femaleRange: '135 - 145', defaultRange: '135 - 145' },
              { id: 'potassium', name: 'Serum Potassium (K+)', unit: 'mEq/L', maleRange: '3.5 - 5.1', femaleRange: '3.5 - 5.1', defaultRange: '3.5 - 5.1' }
            ]
          },
          {
            id: 'LAB-LIPID',
            name: 'Lipid Profile (Fasting)',
            code: 'LIPID',
            category: 'Biochemistry',
            rate: 550,
            sampleType: 'Blood (Serum - 12h Fasting)',
            turnaroundTime: '4-6 Hours',
            description: 'Cardiovascular risk assessment including Total Cholesterol, HDL, LDL, VLDL, and Triglycerides',
            parameters: [
              { id: 'chol_tot', name: 'Total Cholesterol', unit: 'mg/dL', maleRange: '< 200', femaleRange: '< 200', defaultRange: '< 200 (Desirable)' },
              { id: 'triglycerides', name: 'Serum Triglycerides', unit: 'mg/dL', maleRange: '< 150', femaleRange: '< 150', defaultRange: '< 150 (Normal)' },
              { id: 'hdl', name: 'HDL Cholesterol (Good)', unit: 'mg/dL', maleRange: '> 40', femaleRange: '> 50', defaultRange: '> 40 (Optimal)' },
              { id: 'ldl', name: 'LDL Cholesterol (Bad)', unit: 'mg/dL', maleRange: '< 100', femaleRange: '< 100', defaultRange: '< 100 (Optimal)' },
              { id: 'vldl', name: 'VLDL Cholesterol', unit: 'mg/dL', maleRange: '5 - 30', femaleRange: '5 - 30', defaultRange: '5 - 30' },
              { id: 'chol_hdl_ratio', name: 'Total Chol / HDL Ratio', unit: 'ratio', maleRange: '3.3 - 4.4', femaleRange: '3.3 - 4.4', defaultRange: '3.3 - 4.4' }
            ]
          },
          {
            id: 'LAB-SUGAR',
            name: 'Blood Glucose (Fasting & PPBS)',
            code: 'BSF-PP',
            category: 'Biochemistry',
            rate: 150,
            sampleType: 'Blood (Fluoride)',
            turnaroundTime: '1-2 Hours',
            description: 'Fasting and 2-Hour Post-Prandial Plasma Glucose with urine sugar analysis',
            parameters: [
              { id: 'fbs', name: 'Fasting Blood Sugar (FBS)', unit: 'mg/dL', maleRange: '70 - 100', femaleRange: '70 - 100', defaultRange: '70 - 100 (Normal)' },
              { id: 'ppbs', name: 'Post-Prandial Blood Sugar (PPBS)', unit: 'mg/dL', maleRange: '< 140', femaleRange: '< 140', defaultRange: '< 140 (Normal)' },
              { id: 'urine_sugar', name: 'Urine Glucose (Qualitative)', unit: 'qualitative', maleRange: 'Nil', femaleRange: 'Nil', defaultRange: 'Nil' }
            ]
          },
          {
            id: 'LAB-HBA1C',
            name: 'HbA1c (Glycosylated Hemoglobin)',
            code: 'HBA1C',
            category: 'Biochemistry',
            rate: 450,
            sampleType: 'Blood (EDTA)',
            turnaroundTime: '2-4 Hours',
            description: 'Gold standard 3-month average glycemic control marker with estimated average glucose',
            parameters: [
              { id: 'hba1c_pct', name: 'HbA1c Percentage', unit: '%', maleRange: '< 5.7', femaleRange: '< 5.7', defaultRange: '< 5.7 (Normal), 5.7-6.4 (Prediabetes), >= 6.5 (Diabetes)' },
              { id: 'eag', name: 'Estimated Average Glucose (eAG)', unit: 'mg/dL', maleRange: '90 - 120', femaleRange: '90 - 120', defaultRange: '90 - 120' }
            ]
          },
          {
            id: 'LAB-THYROID',
            name: 'Thyroid Profile (Total T3, T4, TSH)',
            code: 'THYROID',
            category: 'Serology',
            rate: 500,
            sampleType: 'Blood (Serum)',
            turnaroundTime: '6-8 Hours',
            description: 'Evaluation of hyperthyroidism, hypothyroidism, and pituitary-thyroid axis regulation',
            parameters: [
              { id: 't3', name: 'Total Triiodothyronine (T3)', unit: 'ng/dL', maleRange: '80 - 200', femaleRange: '80 - 200', defaultRange: '80 - 200' },
              { id: 't4', name: 'Total Thyroxine (T4)', unit: 'µg/dL', maleRange: '4.5 - 12.0', femaleRange: '4.5 - 12.0', defaultRange: '4.5 - 12.0' },
              { id: 'tsh', name: 'Thyroid Stimulating Hormone (TSH)', unit: 'µIU/mL', maleRange: '0.35 - 4.94', femaleRange: '0.35 - 4.94', defaultRange: '0.35 - 4.94' }
            ]
          },
          {
            id: 'LAB-URINE',
            name: 'Urine Routine & Microscopic (Urine R/M)',
            code: 'URINE-RM',
            category: 'Clinical Pathology',
            rate: 150,
            sampleType: 'Urine (Clean Catch Midstream)',
            turnaroundTime: '1-2 Hours',
            description: 'Physical, chemical, and microscopic examination for renal health, infection, and calculi',
            parameters: [
              { id: 'u_color', name: 'Color & Appearance', unit: 'visual', maleRange: 'Pale Yellow, Clear', femaleRange: 'Pale Yellow, Clear', defaultRange: 'Pale Yellow, Clear' },
              { id: 'u_ph', name: 'pH (Reaction)', unit: 'pH', maleRange: '4.5 - 8.0', femaleRange: '4.5 - 8.0', defaultRange: '4.5 - 8.0' },
              { id: 'u_spgr', name: 'Specific Gravity', unit: 'sp.gr.', maleRange: '1.005 - 1.030', femaleRange: '1.005 - 1.030', defaultRange: '1.005 - 1.030' },
              { id: 'u_protein', name: 'Urine Protein / Albumin', unit: 'semi-quant', maleRange: 'Nil', femaleRange: 'Nil', defaultRange: 'Nil' },
              { id: 'u_sugar', name: 'Urine Sugar', unit: 'semi-quant', maleRange: 'Nil', femaleRange: 'Nil', defaultRange: 'Nil' },
              { id: 'u_ketones', name: 'Ketone Bodies', unit: 'semi-quant', maleRange: 'Negative', femaleRange: 'Negative', defaultRange: 'Negative' },
              { id: 'u_pus', name: 'Pus Cells (WBC)', unit: '/HPF', maleRange: '0 - 5', femaleRange: '0 - 5', defaultRange: '0 - 5' },
              { id: 'u_epi', name: 'Epithelial Cells', unit: '/HPF', maleRange: '0 - 4', femaleRange: '0 - 4', defaultRange: '0 - 4' },
              { id: 'u_rbc', name: 'Red Blood Cells (RBC)', unit: '/HPF', maleRange: 'Nil / Occasional', femaleRange: 'Nil / Occasional', defaultRange: 'Nil / Occasional' },
              { id: 'u_casts', name: 'Casts & Crystals', unit: 'microscopic', maleRange: 'Not Seen', femaleRange: 'Not Seen', defaultRange: 'Not Seen' }
            ]
          },
          {
            id: 'LAB-DENGUE',
            name: 'Dengue Serology (NS1 Ag + IgG / IgM Ab)',
            code: 'DENGUE',
            category: 'Serology',
            rate: 750,
            sampleType: 'Blood (Serum)',
            turnaroundTime: '1-2 Hours',
            description: 'Rapid immuno-chromatographic detection of Dengue NS1 antigen and IgG/IgM antibodies',
            parameters: [
              { id: 'dengue_ns1', name: 'Dengue NS1 Antigen', unit: 'rapid test', maleRange: 'Negative', femaleRange: 'Negative', defaultRange: 'Negative' },
              { id: 'dengue_igm', name: 'Dengue IgM Antibody', unit: 'rapid test', maleRange: 'Negative', femaleRange: 'Negative', defaultRange: 'Negative' },
              { id: 'dengue_igg', name: 'Dengue IgG Antibody', unit: 'rapid test', maleRange: 'Negative', femaleRange: 'Negative', defaultRange: 'Negative' }
            ]
          },
          {
            id: 'LAB-WIDAL',
            name: 'Widal Slide Agglutination (Typhoid Test)',
            code: 'WIDAL',
            category: 'Serology',
            rate: 200,
            sampleType: 'Blood (Serum)',
            turnaroundTime: '1-2 Hours',
            description: 'Serological test for enteric fever (Salmonella enterica serotypes Typhi and Paratyphi)',
            parameters: [
              { id: 'widal_to', name: 'Salmonella Typhi "O" Antigen', unit: 'titer', maleRange: '< 1:80 (Negative)', femaleRange: '< 1:80 (Negative)', defaultRange: '< 1:80 (Negative)' },
              { id: 'widal_th', name: 'Salmonella Typhi "H" Antigen', unit: 'titer', maleRange: '< 1:80 (Negative)', femaleRange: '< 1:80 (Negative)', defaultRange: '< 1:80 (Negative)' },
              { id: 'widal_ah', name: 'Salmonella Paratyphi "AH" Antigen', unit: 'titer', maleRange: '< 1:80 (Negative)', femaleRange: '< 1:80 (Negative)', defaultRange: '< 1:80 (Negative)' },
              { id: 'widal_bh', name: 'Salmonella Paratyphi "BH" Antigen', unit: 'titer', maleRange: '< 1:80 (Negative)', femaleRange: '< 1:80 (Negative)', defaultRange: '< 1:80 (Negative)' }
            ]
          }
        ];

        const insertTest = db.prepare(`
          INSERT INTO lab_tests (id, name, code, category, rate, sampleType, turnaroundTime, parameters, description, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `);

        for (const t of defaultLabTests) {
          insertTest.run(t.id, t.name, t.code, t.category, t.rate, t.sampleType, t.turnaroundTime, JSON.stringify(t.parameters), t.description, seedNow, seedNow);
        }
        console.log('[DB] Pre-seeded 10 standard diagnostic laboratory test profiles');
      }
    } catch (e) {
      console.warn('[DB] Seeding lab tests failed or skipped:', e);
    }

    // Seed default standard TPA / Health Insurance Providers if empty
    try {
      const tpaCount = db.prepare('SELECT COUNT(*) as cnt FROM tpa_providers').get() as { cnt: number };
      if (tpaCount && tpaCount.cnt === 0) {
        const seedNow = new Date().toISOString();
        const defaultTpas = [
          { id: 'TPA-STAR', name: 'Star Health & Allied Insurance', code: 'STAR-HEALTH', email: 'cashless@starhealth.in', phone: '1800-425-2255', portal: 'https://www.starhealth.in', copay: 0 },
          { id: 'TPA-MEDI', name: 'Medi Assist Insurance TPA', code: 'MEDI-ASSIST', email: 'claims@mediassist.in', phone: '1800-425-9449', portal: 'https://mediassisttpa.in', copay: 0 },
          { id: 'TPA-VIDAL', name: 'Vidal Health Insurance TPA', code: 'VIDAL-TPA', email: 'cashless@vidalhealthtpa.com', phone: '1800-102-4488', portal: 'https://vidalhealthtpa.com', copay: 10 },
          { id: 'TPA-HDFC', name: 'HDFC ERGO General Insurance', code: 'HDFC-ERGO', email: 'care@hdfcergo.com', phone: '022-6234-6234', portal: 'https://hdfcergo.com', copay: 0 },
          { id: 'TPA-ICICI', name: 'ICICI Lombard General Insurance', code: 'ICICI-LOMB', email: 'cashless@icicilombard.com', phone: '1800-2666', portal: 'https://icicilombard.com', copay: 0 },
          { id: 'TPA-PARAMOUNT', name: 'Paramount Health Services TPA', code: 'PARAMOUNT-TPA', email: 'claims@paramounttpa.com', phone: '022-6662-0808', portal: 'https://paramounttpa.com', copay: 10 },
          { id: 'TPA-MDINDIA', name: 'MDIndia Health Insurance TPA', code: 'MD-INDIA', email: 'customercare@mdindia.com', phone: '1800-233-1166', portal: 'https://mdindiaonline.com', copay: 0 },
          { id: 'TPA-CARE', name: 'Care Health Insurance', code: 'CARE-HEALTH', email: 'customerfirst@careinsurance.com', phone: '1800-102-4455', portal: 'https://careinsurance.com', copay: 0 }
        ];

        const insertTpa = db.prepare(`
          INSERT INTO tpa_providers (id, name, code, contactEmail, contactPhone, portalUrl, defaultCopayPercent, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        `);

        for (const t of defaultTpas) {
          insertTpa.run(t.id, t.name, t.code, t.email, t.phone, t.portal, t.copay, seedNow, seedNow);
        }
        console.log('[DB] Pre-seeded 8 standard TPA / Health Insurance Providers');
      }
    } catch (e) {
      console.warn('[DB] Seeding TPA providers failed or skipped:', e);
    }

    try {
      const otCount = db.prepare('SELECT COUNT(*) as cnt FROM operation_theatres').get() as { cnt: number };
      if (otCount && otCount.cnt === 0) {
        const seedNow = new Date().toISOString();
        const defaultOts = [
          { id: 'OT-MAIN-01', name: 'Main Major OT 1 (General & Laparoscopy)', code: 'OT-1', theatreType: 'MAJOR', floor: '1st Floor - Surgical Wing', dailyRate: 5000 },
          { id: 'OT-MOD-02', name: 'Modular OT 2 (Ortho & Joint Replacement)', code: 'OT-2', theatreType: 'MODULAR', floor: '1st Floor - Surgical Wing', dailyRate: 7500 },
          { id: 'OT-MIN-03', name: 'Minor OT & Daycare Endoscopy Suite', code: 'OT-3', theatreType: 'MINOR', floor: 'Ground Floor - Daycare', dailyRate: 2500 },
          { id: 'OT-CATH-04', name: 'Cath Lab & Interventional Suite', code: 'OT-4', theatreType: 'CATH_LAB', floor: 'Basement - Cath Wing', dailyRate: 8000 }
        ];

        const insertOt = db.prepare(`
          INSERT INTO operation_theatres (id, name, code, theatreType, floor, dailyRate, status, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, 'AVAILABLE', 1, ?, ?)
        `);

        for (const ot of defaultOts) {
          insertOt.run(ot.id, ot.name, ot.code, ot.theatreType, ot.floor, ot.dailyRate, seedNow, seedNow);
        }
        console.log('[DB] Pre-seeded 4 standard Operating Theatres');
      }
    } catch (e) {
      console.warn('[DB] Seeding operating theatres failed or skipped:', e);
    }


    // Migrations
    try {
      db.exec('ALTER TABLE doctors ADD COLUMN printHeader INTEGER DEFAULT 1;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE doctors ADD COLUMN customTopMargin INTEGER DEFAULT 0;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE doctors ADD COLUMN customBottomMargin INTEGER DEFAULT 0;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE doctors ADD COLUMN upiId TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE doctors ADD COLUMN qrCodeText TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE doctors ADD COLUMN showQrCodeOnReceipt INTEGER DEFAULT 0;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE doctors ADD COLUMN chamber TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE receipts ADD COLUMN showQrCode INTEGER DEFAULT 0;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE receipts ADD COLUMN qrCodeText TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE receipts ADD COLUMN items TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE prescriptions ADD COLUMN followUpDate TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE prescriptions ADD COLUMN followUpNotes TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE prescriptions ADD COLUMN receiptNumber TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE prescriptions ADD COLUMN labInvestigations TEXT;');
    } catch (e) {}

    // Follow-ups Migrations
    const followUpCols = [
      'prescriptionId TEXT',
      'receiptId TEXT',
      'patientName TEXT NOT NULL DEFAULT ""',
      'patientPhone TEXT DEFAULT ""',
      'patientAge TEXT',
      'patientGender TEXT',
      'doctorId TEXT NOT NULL DEFAULT ""',
      'doctorName TEXT NOT NULL DEFAULT ""',
      'scheduledDate TEXT NOT NULL DEFAULT ""',
      'notes TEXT',
      'status TEXT DEFAULT "PENDING"',
      'createdAt TEXT'
    ];
    for (const col of followUpCols) {
      try {
        db.exec(`ALTER TABLE follow_ups ADD COLUMN ${col};`);
      } catch (e) {}
    }

    // Appointments Migrations
    const aptCols = [
      'patientName TEXT NOT NULL DEFAULT ""',
      'patientPhone TEXT NOT NULL DEFAULT ""',
      'patientAge TEXT',
      'patientGender TEXT',
      'doctorId TEXT NOT NULL DEFAULT ""',
      'doctorName TEXT NOT NULL DEFAULT ""',
      'appointmentDate TEXT NOT NULL DEFAULT ""',
      'appointmentTime TEXT NOT NULL DEFAULT ""',
      'date TEXT',
      'timeSlot TEXT',
      'notes TEXT',
      'rejectionReason TEXT',
      'source TEXT DEFAULT "WHATSAPP"',
      'status TEXT DEFAULT "PENDING"',
      'createdAt TEXT'
    ];
    for (const col of aptCols) {
      try {
        db.exec(`ALTER TABLE appointments ADD COLUMN ${col};`);
      } catch (e) {}
    }

    // Expenses Migrations
    const expenseCols = [
      'paidAmount REAL DEFAULT 0',
      'dueDate TEXT',
      'vendorPhone TEXT',
      'isRecurring INTEGER DEFAULT 0'
    ];
    for (const col of expenseCols) {
      try {
        db.exec(`ALTER TABLE expenses ADD COLUMN ${col};`);
      } catch (e) {}
    }

    // Patient ID Migrations
    try {
      db.exec('ALTER TABLE receipts ADD COLUMN patientId TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE prescriptions ADD COLUMN patientId TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE follow_ups ADD COLUMN patientId TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE appointments ADD COLUMN patientId TEXT;');
    } catch (e) {}

    // Facility & Inpatient Billing Migrations
    const facilityCols = [
      "billType TEXT DEFAULT 'OPD'",
      "roomNumber TEXT",
      "admissionDate TEXT",
      "dischargeDate TEXT",
      "advancePaid REAL DEFAULT 0",
      "discount REAL DEFAULT 0"
    ];
    for (const col of facilityCols) {
      try {
        db.exec(`ALTER TABLE receipts ADD COLUMN ${col};`);
      } catch (e) {}
    }

    // Services table enhancement for Facility & Inpatient items
    const serviceCols = [
      "category TEXT DEFAULT 'General'",
      "unit TEXT DEFAULT 'Units'",
      "serviceType TEXT DEFAULT 'OPD'"
    ];
    for (const col of serviceCols) {
      try {
        db.exec(`ALTER TABLE services ADD COLUMN ${col};`);
      } catch (e) {}
    }

    try {
      db.exec('ALTER TABLE bed_admissions ADD COLUMN wardChargesLog TEXT;');
    } catch (e) {}
    try {
      db.exec("ALTER TABLE bed_admissions ADD COLUMN billingStatus TEXT DEFAULT 'NONE';");
    } catch (e) {}
    try {
      db.exec('ALTER TABLE bed_admissions ADD COLUMN emarOrdersLog TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE bed_admissions ADD COLUMN emarAdminLog TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE bed_admissions ADD COLUMN fluidIoLog TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE bed_admissions ADD COLUMN nursingNotesLog TEXT;');
    } catch (e) {}
    try {
      db.exec('ALTER TABLE bed_admissions ADD COLUMN insuranceClaimId TEXT;');
    } catch (e) {}

    // Seed default facility items if none exist
    try {
      const facCount = (db.prepare("SELECT count(*) as count FROM services WHERE serviceType = 'FACILITY'").get() as any)?.count || 0;
      if (facCount === 0) {
        const seedStmt = db.prepare(`
          INSERT INTO services (id, name, amount, category, unit, serviceType)
          VALUES (@id, @name, @amount, @category, @unit, 'FACILITY')
        `);
        const defaultFacilityItems = [
          { id: 'fac_s_1', name: 'General Ward Bed', amount: 800, category: 'Room Rent', unit: 'Days' },
          { id: 'fac_s_2', name: 'Semi-Private Room', amount: 1500, category: 'Room Rent', unit: 'Days' },
          { id: 'fac_s_3', name: 'Deluxe Private Room', amount: 2500, category: 'Room Rent', unit: 'Days' },
          { id: 'fac_s_4', name: 'ICU / Critical Care Bed', amount: 4500, category: 'Room Rent', unit: 'Days' },
          { id: 'fac_s_5', name: 'Daycare Observation Bed', amount: 600, category: 'Room Rent', unit: 'Hours' },
          { id: 'fac_s_6', name: 'Medical Oxygen (Hourly)', amount: 150, category: 'Oxygen', unit: 'Hours' },
          { id: 'fac_s_7', name: 'Medical Oxygen (24h Flow)', amount: 1200, category: 'Oxygen', unit: 'Days' },
          { id: 'fac_s_8', name: 'Oxygen Cylinder Refill', amount: 650, category: 'Oxygen', unit: 'Cylinders' },
          { id: 'fac_s_9', name: 'Oxygen Concentrator Usage', amount: 400, category: 'Oxygen', unit: 'Days' },
          { id: 'fac_s_10', name: 'General Nursing Care (24h)', amount: 500, category: 'Nursing', unit: 'Days' },
          { id: 'fac_s_11', name: 'Specialized ICU Nursing', amount: 1000, category: 'Nursing', unit: 'Days' },
          { id: 'fac_s_12', name: 'Attendant / DDA Support', amount: 300, category: 'Nursing', unit: 'Days' },
          { id: 'fac_s_13', name: 'In-Patient Doctor Daily Round', amount: 600, category: 'Doctor Rounds', unit: 'Visits' },
          { id: 'fac_s_14', name: 'Specialist Consultant Visit', amount: 1000, category: 'Doctor Rounds', unit: 'Visits' },
          { id: 'fac_s_15', name: 'Emergency RMO Call', amount: 400, category: 'Doctor Rounds', unit: 'Visits' },
          { id: 'fac_s_16', name: 'Multipara Vital Monitor', amount: 500, category: 'Equipment', unit: 'Days' },
          { id: 'fac_s_17', name: 'Pulse Oximeter & BP Monitor', amount: 200, category: 'Equipment', unit: 'Days' },
          { id: 'fac_s_18', name: 'Syringe / Infusion Pump', amount: 350, category: 'Equipment', unit: 'Days' },
          { id: 'fac_s_19', name: 'Nebulizer Therapy Session', amount: 150, category: 'Equipment', unit: 'Sessions' },
          { id: 'fac_s_20', name: 'IV Cannulation & Infusion Setup', amount: 250, category: 'Procedures', unit: 'Procedures' },
          { id: 'fac_s_21', name: 'Surgical Wound Dressing', amount: 300, category: 'Procedures', unit: 'Procedures' },
          { id: 'fac_s_22', name: 'Foley Catheterization', amount: 400, category: 'Procedures', unit: 'Procedures' },
          { id: 'fac_s_23', name: 'Ryle Tube Insertion', amount: 450, category: 'Procedures', unit: 'Procedures' },
          { id: 'fac_s_24', name: 'ECG Recording & Interpretation', amount: 300, category: 'Procedures', unit: 'Tests' }
        ];
        const seedTxn = db.transaction(() => {
          for (const item of defaultFacilityItems) {
            seedStmt.run(item);
          }
        });
        seedTxn();
      }
    } catch (e) {
      console.error('[DB] Failed to seed facility services:', e);
    }

    // Backfill Patient IDs for existing records without one
    try {
      const receiptsWithoutPid = db.prepare("SELECT id, patientName, patientPhone FROM receipts WHERE patientId IS NULL OR patientId = ''").all() as any[];
      if (receiptsWithoutPid.length > 0) {
        const metaRow = db.prepare("SELECT value FROM metadata WHERE key = 'last_patient_id'").get() as { value?: string } | undefined;
        let nextPidNum = metaRow?.value ? (parseInt(metaRow.value.replace(/\D/g, '')) || 1000) : 1000;

        // Build mapping of known patients by phone or name
        const existingWithPid = db.prepare("SELECT patientId, patientName, patientPhone FROM receipts WHERE patientId IS NOT NULL AND patientId != ''").all() as any[];
        const patientMap = new Map<string, string>();
        for (const r of existingWithPid) {
          const key = (r.patientPhone && r.patientPhone.trim()) || (r.patientName && r.patientName.trim().toLowerCase());
          if (key && !patientMap.has(key)) {
            patientMap.set(key, r.patientId);
          }
        }

        const updateReceiptPid = db.prepare("UPDATE receipts SET patientId = ? WHERE id = ?");
        const updatePrescriptionPid = db.prepare("UPDATE prescriptions SET patientId = ? WHERE receiptId = ?");

        const backfillTxn = db.transaction(() => {
          for (const r of receiptsWithoutPid) {
            const key = (r.patientPhone && r.patientPhone.trim()) || (r.patientName && r.patientName.trim().toLowerCase());
            let pid = key ? patientMap.get(key) : undefined;
            if (!pid) {
              nextPidNum++;
              pid = `PID-${nextPidNum}`;
              if (key) patientMap.set(key, pid);
            }
            updateReceiptPid.run(pid, r.id);
            updatePrescriptionPid.run(pid, r.id);
          }
          db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('last_patient_id', ?)").run(`PID-${nextPidNum}`);
        });
        backfillTxn();
      }
    } catch (err) {
      console.error('[DB] Failed to backfill patient IDs:', err);
    }

    // Performance indexes (CREATE IF NOT EXISTS is idempotent)
    try {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date);
        CREATE INDEX IF NOT EXISTS idx_receipts_doctorId ON receipts(doctorId);
        CREATE INDEX IF NOT EXISTS idx_receipts_patientId ON receipts(patientId);
        CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointmentDate);
        CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
        CREATE INDEX IF NOT EXISTS idx_appointments_patientId ON appointments(patientId);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_doctorId ON prescriptions(doctorId);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_date ON prescriptions(date);
        CREATE INDEX IF NOT EXISTS idx_prescriptions_patientId ON prescriptions(patientId);
        CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups(scheduledDate);
        CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);
        CREATE INDEX IF NOT EXISTS idx_follow_ups_doctorId ON follow_ups(doctorId);
        CREATE INDEX IF NOT EXISTS idx_follow_ups_patientId ON follow_ups(patientId);
      `);
    } catch (e) {
      console.error('[DB] Failed to create indexes:', e);
    }

    try {
      db.prepare("UPDATE emergency_visits SET id = ('ER-' || hex(randomblob(8))) WHERE id IS NULL OR id = ''").run();
      db.prepare("UPDATE mlc_records SET id = ('MLC-' || hex(randomblob(8))) WHERE id IS NULL OR id = ''").run();
    } catch (_) {}
  },

  getDbPath: () => {
    const DATA_DIR = path.join(app.getPath('userData'), 'ClinicData');
    const buvoraDb = path.join(DATA_DIR, 'buvora.db');
    const legacyDb = path.join(DATA_DIR, 'medflow.db');
    return fs.existsSync(buvoraDb) ? buvoraDb : (fs.existsSync(legacyDb) ? legacyDb : buvoraDb);
  },

  // Doctors
  getDoctors: () => {
    const docs = db.prepare('SELECT * FROM doctors').all() as any[];
    return docs.map(d => ({
      ...d,
      chamber: d.chamber || '',
      printHeader: d.printHeader === 1 || d.printHeader === null || d.printHeader === undefined ? true : false,
      showQrCodeOnReceipt: d.showQrCodeOnReceipt === 1 ? true : false,
      upiId: d.upiId || '',
      qrCodeText: d.qrCodeText || '',
    }));
  },
  saveDoctor: (doctor: any) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO doctors (id, name, specialization, qualifications, phone, address, printHeader, customTopMargin, customBottomMargin, upiId, qrCodeText, showQrCodeOnReceipt, chamber)
      VALUES (@id, @name, @specialization, @qualifications, @phone, @address, @printHeader, @customTopMargin, @customBottomMargin, @upiId, @qrCodeText, @showQrCodeOnReceipt, @chamber)
    `);
    return stmt.run({
      ...doctor,
      chamber: doctor.chamber || '',
      printHeader: doctor.printHeader !== false ? 1 : 0,
      customTopMargin: doctor.customTopMargin || 0,
      customBottomMargin: doctor.customBottomMargin || 0,
      upiId: doctor.upiId || '',
      qrCodeText: doctor.qrCodeText || '',
      showQrCodeOnReceipt: doctor.showQrCodeOnReceipt ? 1 : 0
    });
  },
  deleteDoctor: (id: string) => db.prepare('DELETE FROM doctors WHERE id = ?').run(id),

  // Services
  getServices: () => db.prepare('SELECT * FROM services').all(),
  saveService: (service: any) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO services (id, name, amount, category, unit, serviceType)
      VALUES (@id, @name, @amount, @category, @unit, @serviceType)
    `);
    return stmt.run({
      id: service.id || crypto.randomUUID(),
      name: service.name,
      amount: typeof service.amount === 'number' ? service.amount : parseFloat(service.amount) || 0,
      category: service.category || 'General',
      unit: service.unit || 'Units',
      serviceType: service.serviceType || 'OPD'
    });
  },
  deleteService: (id: string) => db.prepare('DELETE FROM services WHERE id = ?').run(id),

  // Receipts
  getReceipts: (options?: { limit?: number; offset?: number; search?: string; startDate?: string; endDate?: string }) => {
    let query = 'SELECT * FROM receipts';
    const params: any = {};
    const conditions: string[] = [];

    if (options?.startDate) {
      conditions.push("date(date) >= date(@startDate)");
      params.startDate = options.startDate;
    }
    if (options?.endDate) {
      conditions.push("date(date) <= date(@endDate)");
      params.endDate = options.endDate;
    }
    if (options?.search) {
      conditions.push("(patientName LIKE @search OR patientPhone LIKE @search OR receiptNumber LIKE @search OR patientId LIKE @search)");
      params.search = `%${options.search}%`;
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY date DESC';

    if (options?.limit) {
      query += ' LIMIT @limit OFFSET @offset';
      params.limit = options.limit;
      params.offset = options.offset || 0;
    }

    const receipts = db.prepare(query).all(params) as any[];
    return receipts.map(r => {
      try {
        return {
          ...r,
          showQrCode: r.showQrCode === 1 ? true : false,
          qrCodeText: r.qrCodeText || '',
          items: JSON.parse(r.items || '[]')
        };
      } catch (e) {
        console.error('Failed to parse receipt items:', r.id, e);
        return {
          ...r,
          showQrCode: r.showQrCode === 1 ? true : false,
          qrCodeText: r.qrCodeText || '',
          items: []
        };
      }
    });
  },
  getReceiptById: (id: string) => {
    try {
      const r = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id) as any;
      if (!r) return null;
      return {
        ...r,
        showQrCode: r.showQrCode === 1 ? true : false,
        qrCodeText: r.qrCodeText || '',
        items: JSON.parse(r.items || '[]')
      };
    } catch (e) {
      return null;
    }
  },
  getDashboardMetrics: () => {
    const totalReceiptsRow = db.prepare("SELECT COUNT(*) as count FROM receipts").get() as { count: number };
    const totalRevenueRow = db.prepare("SELECT SUM(total) as sum FROM receipts WHERE paymentMethod != 'FREE'").get() as { sum: number };
    
    const count = totalReceiptsRow?.count || 0;
    const revenue = totalRevenueRow?.sum || 0;
    
    return {
      totalReceipts: count,
      totalRevenue: revenue,
      avgPerReceipt: count > 0 ? revenue / count : 0
    };
  },
  saveReceipt: (receipt: any) => {
    if (!receipt.id || !receipt.receiptNumber || !receipt.date || !receipt.patientName) {
      throw new Error('Receipt missing required fields: id, receiptNumber, date, patientName');
    }
    if (typeof receipt.total !== 'number' || receipt.total < 0) throw new Error('Total must be a non-negative number');
    if (receipt.items && Array.isArray(receipt.items)) {
      for (const item of receipt.items) {
        if (typeof item.amount !== 'number' || item.amount < 0) throw new Error('Item amount must be non-negative');
      }
    }
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO receipts (
        id, receiptNumber, date, patientId, patientName, patientAge, patientGender, patientPhone,
        doctorId, doctorName, items, total, paymentMethod, showQrCode, qrCodeText,
        billType, roomNumber, admissionDate, dischargeDate, advancePaid, discount
      )
      VALUES (
        @id, @receiptNumber, @date, @patientId, @patientName, @patientAge, @patientGender, @patientPhone,
        @doctorId, @doctorName, @items, @total, @paymentMethod, @showQrCode, @qrCodeText,
        @billType, @roomNumber, @admissionDate, @dischargeDate, @advancePaid, @discount
      )
    `);
    return stmt.run({
      patientAge: '',
      patientGender: 'Male',
      patientPhone: '',
      doctorId: '',
      doctorName: '',
      paymentMethod: 'CASH',
      ...receipt,
      patientId: receipt.patientId || '',
      patientName: String(receipt.patientName).substring(0, 500),
      items: JSON.stringify(receipt.items || []),
      showQrCode: receipt.showQrCode ? 1 : 0,
      qrCodeText: receipt.qrCodeText || '',
      billType: receipt.billType || 'OPD',
      roomNumber: receipt.roomNumber || '',
      admissionDate: receipt.admissionDate || '',
      dischargeDate: receipt.dischargeDate || '',
      advancePaid: typeof receipt.advancePaid === 'number' ? receipt.advancePaid : 0,
      discount: typeof receipt.discount === 'number' ? receipt.discount : 0
    });
  },
  updateReceipt: (receipt: any) => {
    if (!receipt.id) throw new Error('Missing receipt ID for update');
    if (typeof receipt.total !== 'number' || receipt.total < 0) throw new Error('Total must be a non-negative number');
    if (receipt.items && Array.isArray(receipt.items)) {
      for (const item of receipt.items) {
        if (typeof item.amount !== 'number' || item.amount < 0) throw new Error('Item amount must be non-negative');
      }
    }
    const stmt = db.prepare(`
      UPDATE receipts SET 
        receiptNumber = @receiptNumber,
        date = @date,
        patientId = @patientId,
        patientName = @patientName,
        patientAge = @patientAge,
        patientGender = @patientGender,
        patientPhone = @patientPhone,
        doctorId = @doctorId,
        doctorName = @doctorName,
        items = @items,
        total = @total,
        paymentMethod = @paymentMethod,
        showQrCode = @showQrCode,
        qrCodeText = @qrCodeText,
        billType = @billType,
        roomNumber = @roomNumber,
        admissionDate = @admissionDate,
        dischargeDate = @dischargeDate,
        advancePaid = @advancePaid,
        discount = @discount
      WHERE id = @id
    `);
    return stmt.run({
      patientAge: '',
      patientGender: 'Male',
      patientPhone: '',
      doctorId: '',
      doctorName: '',
      paymentMethod: 'CASH',
      ...receipt,
      patientId: receipt.patientId || '',
      items: JSON.stringify(receipt.items || []),
      showQrCode: receipt.showQrCode ? 1 : 0,
      qrCodeText: receipt.qrCodeText || '',
      billType: receipt.billType || 'OPD',
      roomNumber: receipt.roomNumber || '',
      admissionDate: receipt.admissionDate || '',
      dischargeDate: receipt.dischargeDate || '',
      advancePaid: typeof receipt.advancePaid === 'number' ? receipt.advancePaid : 0,
      discount: typeof receipt.discount === 'number' ? receipt.discount : 0
    });
  },
  deleteReceipt: (id: string) => db.prepare('DELETE FROM receipts WHERE id = ?').run(id),

  // Metadata (for receipt numbers, etc)
  getMetadata: (key: string) => db.prepare('SELECT value FROM metadata WHERE key = ?').get(key),
  setMetadata: (key: string, value: string) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)');
    return stmt.run(key, value);
  },

  // Atomic receipt save + number increment in a single transaction
  saveReceiptAtomic: (receipt: any, metaKey: string, nextNum: string) => {
    const saveStmt = db.prepare(`
      INSERT OR REPLACE INTO receipts (
        id, receiptNumber, date, patientId, patientName, patientAge, patientGender, patientPhone,
        doctorId, doctorName, items, total, paymentMethod,
        billType, roomNumber, admissionDate, dischargeDate, advancePaid, discount
      )
      VALUES (
        @id, @receiptNumber, @date, @patientId, @patientName, @patientAge, @patientGender, @patientPhone,
        @doctorId, @doctorName, @items, @total, @paymentMethod,
        @billType, @roomNumber, @admissionDate, @dischargeDate, @advancePaid, @discount
      )
    `);
    const metaStmt = db.prepare('INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)');
    const txn = db.transaction(() => {
      saveStmt.run({
        patientAge: '',
        patientGender: 'Male',
        patientPhone: '',
        doctorId: '',
        doctorName: '',
        paymentMethod: 'CASH',
        ...receipt,
        patientId: receipt.patientId || '',
        patientName: String(receipt.patientName).substring(0, 500),
        items: JSON.stringify(receipt.items || []),
        billType: receipt.billType || 'OPD',
        roomNumber: receipt.roomNumber || '',
        admissionDate: receipt.admissionDate || '',
        dischargeDate: receipt.dischargeDate || '',
        advancePaid: typeof receipt.advancePaid === 'number' ? receipt.advancePaid : 0,
        discount: typeof receipt.discount === 'number' ? receipt.discount : 0
      });
      metaStmt.run(metaKey, nextNum);
    });
    return txn();
  },

  // Batch import for doctors
  batchImportDoctors: (doctors: any[]) => {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO doctors (id, name, specialization, qualifications, phone, address, printHeader, customTopMargin, customBottomMargin)
      VALUES (@id, @name, @specialization, @qualifications, @phone, @address, @printHeader, @customTopMargin, @customBottomMargin)
    `);
    const transaction = db.transaction((docs: any[]) => {
      for (const doc of docs) {
        insert.run({
          ...doc,
          printHeader: doc.printHeader !== false ? 1 : 0,
          customTopMargin: doc.customTopMargin || 0,
          customBottomMargin: doc.customBottomMargin || 0
        });
      }
    });
    transaction(doctors);
  },

  // Users & Profiles Persistence
  getUsers: () => {
    try {
      const rows = db.prepare('SELECT * FROM users ORDER BY createdAt ASC, id ASC').all() as any[];
      return rows.map(r => ({
        id: r.id,
        role: r.role || 'reception',
        doctorId: r.doctorId || undefined,
        password: r.password || undefined,
        allowedTabs: r.allowedTabs ? JSON.parse(r.allowedTabs) : undefined,
        createdAt: r.createdAt
      }));
    } catch (e) {
      console.error('[DB] getUsers error:', e);
      return [];
    }
  },
  saveUser: (user: { id: string; role: string; doctorId?: string; password?: string; allowedTabs?: string[]; createdAt?: string }) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO users (id, role, doctorId, password, allowedTabs, createdAt)
        VALUES (@id, @role, @doctorId, @password, @allowedTabs, @createdAt)
        ON CONFLICT(id) DO UPDATE SET
          role = excluded.role,
          doctorId = COALESCE(excluded.doctorId, users.doctorId),
          password = COALESCE(excluded.password, users.password),
          allowedTabs = COALESCE(excluded.allowedTabs, users.allowedTabs)
      `);
      return stmt.run({
        id: user.id.toLowerCase().trim(),
        role: user.role || 'reception',
        doctorId: user.doctorId || null,
        password: user.password || null,
        allowedTabs: user.allowedTabs ? JSON.stringify(user.allowedTabs) : null,
        createdAt: user.createdAt || new Date().toISOString()
      });
    } catch (e) {
      console.error('[DB] saveUser error:', e);
      throw e;
    }
  },
  deleteUser: (id: string) => {
    try {
      const stmt = db.prepare('DELETE FROM users WHERE id = ?');
      return stmt.run(id.toLowerCase().trim());
    } catch (e) {
      console.error('[DB] deleteUser error:', e);
      throw e;
    }
  },
  setUserPassword: (id: string, passwordHash: string) => {
    try {
      const stmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');
      return stmt.run(passwordHash || null, id.toLowerCase().trim());
    } catch (e) {
      console.error('[DB] setUserPassword error:', e);
      throw e;
    }
  },
  updateUserTabs: (id: string, allowedTabs: string[]) => {
    try {
      const stmt = db.prepare('UPDATE users SET allowedTabs = ? WHERE id = ?');
      return stmt.run(allowedTabs ? JSON.stringify(allowedTabs) : null, id.toLowerCase().trim());
    } catch (e) {
      console.error('[DB] updateUserTabs error:', e);
      throw e;
    }
  },

  // Prescriptions
  getPrescriptions: () => {
    const prescriptions = db.prepare(`
      SELECT p.*, COALESCE(p.receiptNumber, r.receiptNumber, '') AS receiptNumber 
      FROM prescriptions p 
      LEFT JOIN receipts r ON p.receiptId = r.id 
      ORDER BY p.date DESC
    `).all() as any[];
    return prescriptions.map(p => {
      let medicines = [];
      try {
        medicines = JSON.parse(p.medicines || '[]');
      } catch (e) {
        console.error('Failed to parse prescription medicines:', p.id, e);
        medicines = [];
      }
      let labInvestigations = [];
      try {
        labInvestigations = JSON.parse(p.labInvestigations || '[]');
      } catch (e) {
        labInvestigations = [];
      }
      return {
        ...p,
        pid: p.receiptNumber || '',
        medicines,
        labInvestigations
      };
    });
  },
  savePrescription: (prescription: any) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO prescriptions (id, receiptId, patientId, date, patientName, patientAge, patientGender, patientPhone, doctorId, doctorName, symptoms, diagnosis, medicines, notes, followUpDate, followUpNotes, labInvestigations)
      VALUES (@id, @receiptId, @patientId, @date, @patientName, @patientAge, @patientGender, @patientPhone, @doctorId, @doctorName, @symptoms, @diagnosis, @medicines, @notes, @followUpDate, @followUpNotes, @labInvestigations)
    `);
    return stmt.run({
      receiptId: '',
      receiptNumber: prescription.receiptNumber || prescription.pid || '',
      patientAge: '',
      patientGender: 'Male',
      patientPhone: '',
      doctorId: '',
      doctorName: '',
      symptoms: '',
      diagnosis: '',
      notes: '',
      followUpDate: '',
      followUpNotes: '',
      ...prescription,
      patientId: prescription.patientId || '',
      medicines: JSON.stringify(prescription.medicines || []),
      labInvestigations: JSON.stringify(prescription.labInvestigations || prescription.labTests || [])
    });
  },
  deletePrescription: (id: string) => db.prepare('DELETE FROM prescriptions WHERE id = ?').run(id),

  // Follow-Ups
  getFollowUps: (options?: { limit?: number; offset?: number; search?: string; startDate?: string; endDate?: string; doctorId?: string; status?: string }) => {
    try {
      let query = `
        SELECT * FROM follow_ups
        WHERE 1=1
      `;
      const params: any = {};
      if (options?.doctorId && options.doctorId !== 'ALL') {
        query += ' AND doctorId = @doctorId';
        params.doctorId = options.doctorId;
      }
      if (options?.status && options.status !== 'ALL') {
        query += ' AND status = @status';
        params.status = options.status;
      }
      if (options?.startDate) {
        query += ' AND date(scheduledDate) >= date(@startDate)';
        params.startDate = options.startDate;
      }
      if (options?.endDate) {
        query += ' AND date(scheduledDate) <= date(@endDate)';
        params.endDate = options.endDate;
      }
      if (options?.search) {
        query += ' AND (patientName LIKE @search OR patientPhone LIKE @search OR notes LIKE @search OR patientId LIKE @search)';
        params.search = `%${options.search}%`;
      }
      query += `
        ORDER BY 
          CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END,
          scheduledDate ASC,
          createdAt DESC
      `;
      if (options?.limit) {
        query += ' LIMIT @limit';
        params.limit = options.limit;
        if (options?.offset) {
          query += ' OFFSET @offset';
          params.offset = options.offset;
        }
      }
      return db.prepare(query).all(params);
    } catch (e) {
      console.error('[Database] Error fetching follow-ups:', e);
      return [];
    }
  },
  saveFollowUp: (followUp: any) => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO follow_ups (
        id, prescriptionId, receiptId, patientId, patientName, patientPhone, patientAge, patientGender,
        doctorId, doctorName, scheduledDate, notes, status, createdAt
      ) VALUES (
        @id, @prescriptionId, @receiptId, @patientId, @patientName, @patientPhone, @patientAge, @patientGender,
        @doctorId, @doctorName, @scheduledDate, @notes, @status, @createdAt
      )
    `);
    const id = followUp.id || ('FU-' + Date.now() + '-' + Math.floor(100 + Math.random() * 900));
    return stmt.run({
      id,
      prescriptionId: followUp.prescriptionId || '',
      receiptId: followUp.receiptId || '',
      patientId: followUp.patientId || '',
      patientName: followUp.patientName || 'Unknown Patient',
      patientPhone: followUp.patientPhone || '',
      patientAge: followUp.patientAge || '',
      patientGender: followUp.patientGender || 'Male',
      doctorId: followUp.doctorId || '',
      doctorName: followUp.doctorName || '',
      scheduledDate: followUp.scheduledDate || new Date().toISOString().split('T')[0],
      notes: followUp.notes || '',
      status: followUp.status || 'PENDING',
      createdAt: followUp.createdAt || new Date().toISOString()
    });
  },
  updateFollowUpStatus: (id: string, status: string) => {
    return db.prepare('UPDATE follow_ups SET status = ? WHERE id = ?').run(status, id);
  },
  deleteFollowUp: (id: string) => db.prepare('DELETE FROM follow_ups WHERE id = ?').run(id),

  // Appointments
  getAppointments: () => {
    try {
      const rows = db.prepare(`
        SELECT * FROM appointments 
        ORDER BY 
          CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END,
          appointmentDate ASC, 
          appointmentTime ASC
      `).all() as any[];

      return rows.map((r) => ({
        ...r,
        appointmentDate: r.appointmentDate || r.date || '',
        appointmentTime: r.appointmentTime || r.timeSlot || '',
        date: r.appointmentDate || r.date || '',
        timeSlot: r.appointmentTime || r.timeSlot || ''
      }));
    } catch (e) {
      console.error('[Database] Error fetching appointments:', e);
      return [];
    }
  },
  saveAppointment: (appointment: any) => {
    const aptDate = appointment.appointmentDate || appointment.date || new Date().toISOString().split('T')[0];
    const aptTime = appointment.appointmentTime || appointment.timeSlot || 'Standard Slot';
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO appointments (id, patientId, patientName, patientPhone, patientAge, patientGender, doctorId, doctorName, appointmentDate, appointmentTime, date, timeSlot, notes, rejectionReason, source, status, createdAt)
      VALUES (@id, @patientId, @patientName, @patientPhone, @patientAge, @patientGender, @doctorId, @doctorName, @appointmentDate, @appointmentTime, @date, @timeSlot, @notes, @rejectionReason, @source, @status, @createdAt)
    `);
    return stmt.run({
      id: appointment.id || ('APT-' + Math.floor(100000 + Math.random() * 900000)),
      patientId: appointment.patientId || '',
      patientName: appointment.patientName || 'Unknown Patient',
      patientPhone: appointment.patientPhone || '',
      patientAge: appointment.patientAge || '30',
      patientGender: appointment.patientGender || 'Male',
      doctorId: appointment.doctorId || 'default_doc',
      doctorName: appointment.doctorName || 'Consulting Doctor',
      appointmentDate: aptDate,
      appointmentTime: aptTime,
      date: aptDate,
      timeSlot: aptTime,
      notes: appointment.notes || '',
      rejectionReason: appointment.rejectionReason || '',
      source: appointment.source || 'WHATSAPP',
      status: appointment.status || 'PENDING',
      createdAt: appointment.createdAt || new Date().toISOString()
    });
  },
  updateAppointmentStatus: (id: string, status: string, rejectionReason?: string) => {
    if (rejectionReason !== undefined) {
      return db.prepare('UPDATE appointments SET status = ?, rejectionReason = ? WHERE id = ?').run(status, rejectionReason, id);
    }
    return db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, id);
  },
  deleteAppointment: (id: string) => db.prepare('DELETE FROM appointments WHERE id = ?').run(id),

  // Expenses & Clinic Bills
  getExpenses: (options?: { limit?: number; offset?: number; search?: string; category?: string; startDate?: string; endDate?: string }) => {
    try {
      let query = 'SELECT * FROM expenses WHERE 1=1';
      const params: any[] = [];

      if (options?.search) {
        query += ' AND (title LIKE ? OR paidTo LIKE ? OR billNumber LIKE ? OR notes LIKE ?)';
        const term = `%${options.search}%`;
        params.push(term, term, term, term);
      }

      if (options?.category && options.category !== 'ALL') {
        query += ' AND category = ?';
        params.push(options.category);
      }

      if (options?.startDate) {
        query += ' AND date >= ?';
        params.push(options.startDate);
      }

      if (options?.endDate) {
        query += ' AND date <= ?';
        params.push(options.endDate);
      }

      query += ' ORDER BY date DESC, createdAt DESC';

      if (options?.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);
        if (options?.offset) {
          query += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      return db.prepare(query).all(...params);
    } catch (e) {
      console.error('[Database] Error fetching expenses:', e);
      return [];
    }
  },

  saveExpense: (expense: any) => {
    const id = expense.id || ('EXP-' + Math.floor(1000 + Math.random() * 9000));
    const now = new Date().toISOString();
    const amount = Number(expense.amount) || 0;
    const paidAmount = expense.paidAmount !== undefined && expense.paidAmount !== '' ? Number(expense.paidAmount) : amount;
    const status = expense.status || (paidAmount >= amount ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING'));
    const paymentMode = expense.paymentMode || 'CASH';
    const billNumber = expense.billNumber || id;
    const isRecurring = expense.isRecurring ? 1 : 0;
    const date = expense.date || now.split('T')[0];
    const dueDate = expense.dueDate || date;

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO expenses (id, title, category, amount, paidAmount, date, dueDate, paymentMode, paidTo, vendorPhone, billNumber, isRecurring, status, notes, createdAt, updatedAt)
      VALUES (@id, @title, @category, @amount, @paidAmount, @date, @dueDate, @paymentMode, @paidTo, @vendorPhone, @billNumber, @isRecurring, @status, @notes, @createdAt, @updatedAt)
    `);
    stmt.run({
      id,
      title: expense.title || 'Untitled Expense',
      category: expense.category || 'Utilities & Power',
      amount,
      paidAmount,
      date,
      dueDate,
      paymentMode,
      paidTo: expense.paidTo || '',
      vendorPhone: expense.vendorPhone || '',
      billNumber,
      isRecurring,
      status,
      notes: expense.notes || '',
      createdAt: expense.createdAt || now,
      updatedAt: now
    });
    return {
      id,
      ...expense,
      amount,
      paidAmount,
      date,
      dueDate,
      status,
      paymentMode,
      billNumber,
      isRecurring,
      updatedAt: now
    };
  },

  deleteExpense: (id: string) => db.prepare('DELETE FROM expenses WHERE id = ?').run(id),

  // Pharmacy & Medicine Methods
  getMedicines: (search?: string, category?: string) => {
    try {
      let query = `
        SELECT m.*, 
               COALESCE(SUM(b.quantity), 0) as currentStock,
               MIN(CASE WHEN b.quantity > 0 THEN b.salePrice ELSE NULL END) as minPrice,
               MAX(CASE WHEN b.quantity > 0 THEN b.salePrice ELSE NULL END) as maxPrice
        FROM medicines m
        LEFT JOIN medicine_batches b ON m.id = b.medicineId
      `;
      const where: string[] = [];
      const params: any[] = [];
      if (search && search.trim()) {
        where.push('(m.name LIKE ? OR m.genericName LIKE ? OR m.manufacturer LIKE ? OR m.locationRack LIKE ?)');
        const s = `%${search.trim()}%`;
        params.push(s, s, s, s);
      }
      if (category && category !== 'All') {
        where.push('m.category = ?');
        params.push(category);
      }
      if (where.length > 0) {
        query += ' WHERE ' + where.join(' AND ');
      }
      query += ' GROUP BY m.id ORDER BY m.name ASC';
      return db.prepare(query).all(...params);
    } catch (e) {
      console.error('[Database] getMedicines error:', e);
      return [];
    }
  },

  saveMedicine: (medicine: any) => {
    try {
      const id = medicine.id || ('MED-' + Math.floor(1000 + Math.random() * 9000));
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO medicines (id, name, genericName, category, manufacturer, unit, hsnCode, minStockAlert, locationRack, notes, createdAt)
        VALUES (@id, @name, @genericName, @category, @manufacturer, @unit, @hsnCode, @minStockAlert, @locationRack, @notes, @createdAt)
      `);
      stmt.run({
        id,
        name: medicine.name || 'Unnamed Medicine',
        genericName: medicine.genericName || '',
        category: medicine.category || 'Tablet',
        manufacturer: medicine.manufacturer || '',
        unit: medicine.unit || 'Strip',
        hsnCode: medicine.hsnCode || '',
        minStockAlert: Number(medicine.minStockAlert) || 10,
        locationRack: medicine.locationRack || '',
        notes: medicine.notes || '',
        createdAt: medicine.createdAt || now
      });
      return { id, ...medicine, createdAt: medicine.createdAt || now };
    } catch (e) {
      console.error('[Database] saveMedicine error:', e);
      throw e;
    }
  },

  deleteMedicine: (id: string) => {
    try {
      db.prepare('DELETE FROM medicine_batches WHERE medicineId = ?').run(id);
      return db.prepare('DELETE FROM medicines WHERE id = ?').run(id);
    } catch (e) {
      console.error('[Database] deleteMedicine error:', e);
      throw e;
    }
  },

  getMedicineBatches: (medicineId?: string) => {
    try {
      let query = `
        SELECT b.*, m.name as medicineName, m.genericName, m.category, m.unit, m.minStockAlert
        FROM medicine_batches b
        JOIN medicines m ON b.medicineId = m.id
      `;
      const params: any[] = [];
      if (medicineId) {
        query += ' WHERE b.medicineId = ?';
        params.push(medicineId);
      }
      query += ' ORDER BY b.expiryDate ASC';
      return db.prepare(query).all(...params);
    } catch (e) {
      console.error('[Database] getMedicineBatches error:', e);
      return [];
    }
  },

  saveMedicineBatch: (batch: any) => {
    try {
      const id = batch.id || ('BATCH-' + Math.floor(1000 + Math.random() * 9000));
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO medicine_batches (id, medicineId, batchNumber, expiryDate, purchaseRate, salePrice, quantity, createdAt)
        VALUES (@id, @medicineId, @batchNumber, @expiryDate, @purchaseRate, @salePrice, @quantity, @createdAt)
      `);
      stmt.run({
        id,
        medicineId: batch.medicineId,
        batchNumber: (batch.batchNumber || '').toUpperCase(),
        expiryDate: batch.expiryDate,
        purchaseRate: Number(batch.purchaseRate) || 0,
        salePrice: Number(batch.salePrice) || 0,
        quantity: Number(batch.quantity) || 0,
        createdAt: batch.createdAt || now
      });
      return { id, ...batch, createdAt: batch.createdAt || now };
    } catch (e) {
      console.error('[Database] saveMedicineBatch error:', e);
      throw e;
    }
  },

  deleteMedicineBatch: (id: string) => {
    return db.prepare('DELETE FROM medicine_batches WHERE id = ?').run(id);
  },

  adjustMedicineStock: (batchId: string, quantityDiff: number) => {
    return db.prepare('UPDATE medicine_batches SET quantity = MAX(0, quantity + ?) WHERE id = ?').run(quantityDiff, batchId);
  },

  getPharmacySales: (options?: any) => {
    try {
      let query = 'SELECT * FROM pharmacy_sales';
      const where: string[] = [];
      const params: any[] = [];
      if (options?.search) {
        where.push('(saleNumber LIKE ? OR patientName LIKE ? OR patientPhone LIKE ? OR patientId LIKE ?)');
        const s = `%${options.search.trim()}%`;
        params.push(s, s, s, s);
      }
      if (options?.startDate) {
        where.push('date >= ?');
        params.push(options.startDate);
      }
      if (options?.endDate) {
        where.push('date <= ?');
        params.push(options.endDate + ' 23:59:59');
      }
      if (where.length > 0) {
        query += ' WHERE ' + where.join(' AND ');
      }
      query += ' ORDER BY date DESC';
      if (options?.limit) {
        query += ` LIMIT ${Number(options.limit)}`;
        if (options?.offset) {
          query += ` OFFSET ${Number(options.offset)}`;
        }
      }
      const rows = db.prepare(query).all(...params);
      return rows.map((r: any) => ({
        ...r,
        items: typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || [])
      }));
    } catch (e) {
      console.error('[Database] getPharmacySales error:', e);
      return [];
    }
  },

  savePharmacySale: (sale: any) => {
    try {
      const now = new Date().toISOString();
      const transaction = db.transaction(() => {
        let saleNumber = sale.saleNumber;
        if (!saleNumber) {
          const meta = db.prepare("SELECT value FROM metadata WHERE key = 'last_pharmacy_sale_num'").get() as { value?: string } | undefined;
          let nextNum = 1001;
          if (meta && meta.value) {
            const parsed = parseInt(meta.value, 10);
            if (!isNaN(parsed)) nextNum = parsed + 1;
          }
          db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('last_pharmacy_sale_num', ?)").run(nextNum.toString());
          saleNumber = `PH-${nextNum}`;
        }
        const id = sale.id || ('PSALE-' + Math.floor(1000 + Math.random() * 9000));
        const items = typeof sale.items === 'string' ? sale.items : JSON.stringify(sale.items || []);
        const parsedItems = Array.isArray(sale.items) ? sale.items : (typeof sale.items === 'string' ? JSON.parse(sale.items) : []);

        // Deduct batch stocks
        const updateBatchStmt = db.prepare('UPDATE medicine_batches SET quantity = MAX(0, quantity - ?) WHERE id = ?');
        for (const item of parsedItems) {
          const qty = Number(item.quantity) || 0;
          if (item.batchId && qty > 0) {
            updateBatchStmt.run(qty, item.batchId);
          } else if (item.medicineId && qty > 0) {
            const batches = db.prepare('SELECT id, quantity FROM medicine_batches WHERE medicineId = ? AND quantity > 0 ORDER BY expiryDate ASC').all(item.medicineId) as any[];
            let remaining = qty;
            for (const b of batches) {
              if (remaining <= 0) break;
              const deduct = Math.min(b.quantity, remaining);
              updateBatchStmt.run(deduct, b.id);
              remaining -= deduct;
            }
          }
        }

        const stmt = db.prepare(`
          INSERT OR REPLACE INTO pharmacy_sales (id, saleNumber, patientId, patientName, patientPhone, prescriptionId, date, items, subtotal, discount, tax, total, paymentMethod, dispensedBy, notes)
          VALUES (@id, @saleNumber, @patientId, @patientName, @patientPhone, @prescriptionId, @date, @items, @subtotal, @discount, @tax, @total, @paymentMethod, @dispensedBy, @notes)
        `);
        stmt.run({
          id,
          saleNumber,
          patientId: sale.patientId || '',
          patientName: sale.patientName || 'Walk-in Customer',
          patientPhone: sale.patientPhone || '',
          prescriptionId: sale.prescriptionId || '',
          date: sale.date || now,
          items,
          subtotal: Number(sale.subtotal) || 0,
          discount: Number(sale.discount) || 0,
          tax: Number(sale.tax) || 0,
          total: Number(sale.total) || 0,
          paymentMethod: sale.paymentMethod || 'CASH',
          dispensedBy: sale.dispensedBy || '',
          notes: sale.notes || ''
        });

        return {
          ...sale,
          id,
          saleNumber,
          items: parsedItems
        };
      });

      return transaction();
    } catch (e) {
      console.error('[Database] savePharmacySale error:', e);
      throw e;
    }
  },

  deletePharmacySale: (id: string) => db.prepare('DELETE FROM pharmacy_sales WHERE id = ?').run(id),

  getPharmacyDashboardMetrics: () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const next60Days = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().split('T')[0];

      const valRow = db.prepare(`
        SELECT COALESCE(SUM(quantity * salePrice), 0) as totalValue,
               COALESCE(SUM(quantity * purchaseRate), 0) as totalCost,
               COALESCE(SUM(quantity), 0) as totalUnits
        FROM medicine_batches
      `).get() as any;

      const formRow = db.prepare('SELECT COUNT(*) as count FROM medicines').get() as any;

      const lowStockRow = db.prepare(`
        SELECT COUNT(*) as count FROM (
          SELECT m.id, m.minStockAlert, COALESCE(SUM(b.quantity), 0) as stock
          FROM medicines m
          LEFT JOIN medicine_batches b ON m.id = b.medicineId
          GROUP BY m.id
          HAVING stock <= m.minStockAlert
        )
      `).get() as any;

      const expiringRow = db.prepare(`
        SELECT COUNT(*) as count FROM medicine_batches
        WHERE expiryDate <= ? AND quantity > 0
      `).get(next60Days) as any;

      const salesRow = db.prepare(`
        SELECT COALESCE(SUM(total), 0) as todaySales,
               COUNT(*) as salesCount
        FROM pharmacy_sales
        WHERE date LIKE ?
      `).get(`${today}%`) as any;

      return {
        totalInventoryValue: valRow?.totalValue || 0,
        totalCostValue: valRow?.totalCost || 0,
        totalUnits: valRow?.totalUnits || 0,
        totalMedicines: formRow?.count || 0,
        lowStockCount: lowStockRow?.count || 0,
        expiringCount: expiringRow?.count || 0,
        todaySales: salesRow?.todaySales || 0,
        todaySalesCount: salesRow?.salesCount || 0
      };
    } catch (e) {
      console.error('[Database] getPharmacyDashboardMetrics error:', e);
      return {
        totalInventoryValue: 0,
        totalCostValue: 0,
        totalUnits: 0,
        totalMedicines: 0,
        lowStockCount: 0,
        expiringCount: 0,
        todaySales: 0,
        todaySalesCount: 0
      };
    }
  },

  // ==================== HOSPITAL IPD (WARDS, BEDS, ADMISSIONS) ====================
  getWards: () => {
    try {
      return db.prepare(`
        SELECT w.*,
               COUNT(b.id) as totalBedsCount,
               SUM(CASE WHEN b.status = 'occupied' THEN 1 ELSE 0 END) as occupiedBedsCount,
               SUM(CASE WHEN b.status = 'available' THEN 1 ELSE 0 END) as availableBedsCount
        FROM wards w
        LEFT JOIN beds b ON w.id = b.wardId
        GROUP BY w.id
        ORDER BY w.name ASC
      `).all();
    } catch (e) {
      console.error('[Database] getWards error:', e);
      return [];
    }
  },

  saveWard: (ward: any) => {
    const id = ward.id || `WARD-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO wards (id, name, code, floor, dailyRate, nursingRate, totalBeds, description, isActive, createdAt, updatedAt)
      VALUES (@id, @name, @code, @floor, @dailyRate, @nursingRate, @totalBeds, @description, @isActive, COALESCE(@createdAt, @now), @now)
    `);
    stmt.run({
      id,
      name: ward.name || 'General Ward',
      code: ward.code || 'GW',
      floor: ward.floor || 'Ground Floor',
      dailyRate: Number(ward.dailyRate) || 0,
      nursingRate: Number(ward.nursingRate) || 0,
      totalBeds: Number(ward.totalBeds) || 0,
      description: ward.description || '',
      isActive: ward.isActive !== undefined ? (ward.isActive ? 1 : 0) : 1,
      createdAt: ward.createdAt || now,
      now
    });
    return { id, ...ward };
  },

  deleteWard: (id: string) => db.prepare('DELETE FROM wards WHERE id = ?').run(id),

  getBeds: (wardId?: string) => {
    try {
      let query = `
        SELECT b.*,
               w.name as wardName,
               w.code as wardCode,
               w.floor as wardFloor,
               a.admissionNumber,
               a.patientId,
               a.patientUhid,
               a.patientName,
               a.patientPhone,
               a.patientGender,
               a.patientAge,
               a.doctorId,
               a.doctorName,
               a.admittedAt,
               a.diagnosis,
               a.advancePaid,
               a.initialVitals,
               a.vitalsLog
        FROM beds b
        JOIN wards w ON b.wardId = w.id
        LEFT JOIN bed_admissions a ON b.currentAdmissionId = a.id
      `;
      if (wardId) {
        query += ` WHERE b.wardId = ? ORDER BY b.bedNumber ASC`;
        return db.prepare(query).all(wardId);
      } else {
        query += ` ORDER BY w.name ASC, b.bedNumber ASC`;
        return db.prepare(query).all();
      }
    } catch (e) {
      console.error('[Database] getBeds error:', e);
      return [];
    }
  },

  saveBed: (bed: any) => {
    const id = bed.id || `BED-${bed.bedNumber || Date.now().toString(36).toUpperCase()}`;
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO beds (id, wardId, bedNumber, bedType, dailyRate, status, currentAdmissionId, notes, updatedAt)
      VALUES (@id, @wardId, @bedNumber, @bedType, @dailyRate, @status, @currentAdmissionId, @notes, @now)
    `);
    stmt.run({
      id,
      wardId: bed.wardId,
      bedNumber: bed.bedNumber,
      bedType: bed.bedType || 'Standard',
      dailyRate: Number(bed.dailyRate) || 0,
      status: bed.status || 'available',
      currentAdmissionId: bed.currentAdmissionId || null,
      notes: bed.notes || '',
      now
    });
    return { id, ...bed };
  },

  deleteBed: (id: string) => db.prepare('DELETE FROM beds WHERE id = ?').run(id),

  updateBedStatus: (bedId: string, status: string) => {
    const now = new Date().toISOString();
    if (status === 'available') {
      return db.prepare('UPDATE beds SET status = ?, currentAdmissionId = NULL, updatedAt = ? WHERE id = ?').run(status, now, bedId);
    }
    return db.prepare('UPDATE beds SET status = ?, updatedAt = ? WHERE id = ?').run(status, now, bedId);
  },

  getBedAdmissions: (options?: { status?: string; billingStatus?: string; patientId?: string; limit?: number }) => {
    try {
      let query = `SELECT * FROM bed_admissions WHERE 1=1`;
      const params: any[] = [];
      if (options?.status) {
        query += ` AND status = ?`;
        params.push(options.status);
      }
      if (options?.billingStatus) {
        query += ` AND billingStatus = ?`;
        params.push(options.billingStatus);
      }
      if (options?.patientId) {
        query += ` AND (patientId = ? OR patientUhid = ?)`;
        params.push(options.patientId, options.patientId);
      }
      query += ` ORDER BY admittedAt DESC`;
      if (options?.limit) {
        query += ` LIMIT ?`;
        params.push(options.limit);
      }
      return db.prepare(query).all(...params);
    } catch (e) {
      console.error('[Database] getBedAdmissions error:', e);
      return [];
    }
  },

  admitPatientToBed: (data: any) => {
    try {
      const transaction = db.transaction(() => {
        // Get next admission number atomically
        const metaRow = db.prepare("SELECT value FROM metadata WHERE key = 'last_admission_num'").get() as any;
        let nextNum = 1001;
        if (metaRow && metaRow.value) {
          nextNum = parseInt(metaRow.value, 10) + 1;
        }
        db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('last_admission_num', ?)").run(nextNum.toString());

        const admissionId = `ADM-${nextNum}`;
        const now = new Date().toISOString();
        const admittedAt = data.admittedAt || now;

        const wardRow = db.prepare('SELECT name FROM wards WHERE id = ?').get(data.wardId) as any;
        const bedRow = db.prepare('SELECT bedNumber FROM beds WHERE id = ?').get(data.bedId) as any;

        const wardName = data.wardName || (wardRow ? wardRow.name : '');
        const bedNumber = data.bedNumber || (bedRow ? bedRow.bedNumber : '');

        const initialVitals = typeof data.initialVitals === 'object' ? JSON.stringify(data.initialVitals) : (data.initialVitals || '{}');
        const vitalsLog = typeof data.vitalsLog === 'object' ? JSON.stringify(data.vitalsLog) : (data.vitalsLog || '[]');
        const wardChargesLog = typeof data.wardChargesLog === 'object' ? JSON.stringify(data.wardChargesLog) : (data.wardChargesLog || '[]');

        const stmt = db.prepare(`
          INSERT INTO bed_admissions (
            id, admissionNumber, patientId, patientUhid, patientName, patientPhone, patientGender, patientAge,
            wardId, wardName, bedId, bedNumber, doctorId, doctorName, admittedAt, expectedDischargeAt,
            diagnosis, initialVitals, vitalsLog, wardChargesLog, advancePaid, paymentMode, status, notes, transfersLog, createdAt, updatedAt
          ) VALUES (
            @id, @admissionNumber, @patientId, @patientUhid, @patientName, @patientPhone, @patientGender, @patientAge,
            @wardId, @wardName, @bedId, @bedNumber, @doctorId, @doctorName, @admittedAt, @expectedDischargeAt,
            @diagnosis, @initialVitals, @vitalsLog, @wardChargesLog, @advancePaid, @paymentMode, 'admitted', @notes, '[]', @now, @now
          )
        `);

        stmt.run({
          id: admissionId,
          admissionNumber: admissionId,
          patientId: data.patientId || '',
          patientUhid: data.patientUhid || data.patientId || '',
          patientName: data.patientName || '',
          patientPhone: data.patientPhone || '',
          patientGender: data.patientGender || '',
          patientAge: data.patientAge || '',
          wardId: data.wardId,
          wardName,
          bedId: data.bedId,
          bedNumber,
          doctorId: data.doctorId || '',
          doctorName: data.doctorName || '',
          admittedAt,
          expectedDischargeAt: data.expectedDischargeAt || '',
          diagnosis: data.diagnosis || '',
          initialVitals,
          vitalsLog,
          wardChargesLog,
          advancePaid: Number(data.advancePaid) || 0,
          paymentMode: data.paymentMode || 'CASH',
          notes: data.notes || '',
          now
        });

        // Mark bed as occupied
        db.prepare('UPDATE beds SET status = ?, currentAdmissionId = ?, updatedAt = ? WHERE id = ?')
          .run('occupied', admissionId, now, data.bedId);

        return {
          id: admissionId,
          admissionNumber: admissionId,
          ...data,
          wardName,
          bedNumber,
          status: 'admitted',
          createdAt: now
        };
      });

      return transaction();
    } catch (e) {
      console.error('[Database] admitPatientToBed error:', e);
      throw e;
    }
  },

  transferPatientBed: (admissionId: string, newBedId: string, reason?: string) => {
    try {
      const transaction = db.transaction(() => {
        const admission = db.prepare('SELECT * FROM bed_admissions WHERE id = ?').get(admissionId) as any;
        if (!admission) throw new Error(`Admission ${admissionId} not found`);

        const oldBedId = admission.bedId;
        const newBed = db.prepare('SELECT b.*, w.name as wardName FROM beds b JOIN wards w ON b.wardId = w.id WHERE b.id = ?').get(newBedId) as any;
        if (!newBed) throw new Error(`Destination bed ${newBedId} not found`);
        if (newBed.status === 'occupied') throw new Error(`Destination bed ${newBed.bedNumber} is currently occupied`);

        const now = new Date().toISOString();

        // 1. Mark previous bed as cleaning and clear currentAdmissionId
        db.prepare('UPDATE beds SET status = ?, currentAdmissionId = NULL, updatedAt = ? WHERE id = ?')
          .run('cleaning', now, oldBedId);

        // 2. Mark new bed as occupied with current admission
        db.prepare('UPDATE beds SET status = ?, currentAdmissionId = ?, updatedAt = ? WHERE id = ?')
          .run('occupied', admissionId, now, newBedId);

        // 3. Update admission transfers log
        let existingTransfers: any[] = [];
        try {
          existingTransfers = JSON.parse(admission.transfersLog || '[]');
        } catch (_) {}

        existingTransfers.push({
          fromBedId: oldBedId,
          fromBedNumber: admission.bedNumber,
          fromWardName: admission.wardName,
          toBedId: newBedId,
          toBedNumber: newBed.bedNumber,
          toWardName: newBed.wardName,
          transferredAt: now,
          reason: reason || 'Bed transfer request'
        });

        db.prepare(`
          UPDATE bed_admissions
          SET bedId = ?, bedNumber = ?, wardId = ?, wardName = ?, transfersLog = ?, updatedAt = ?
          WHERE id = ?
        `).run(newBedId, newBed.bedNumber, newBed.wardId, newBed.wardName, JSON.stringify(existingTransfers), now, admissionId);

        return { success: true, newBedNumber: newBed.bedNumber, wardName: newBed.wardName };
      });

      return transaction();
    } catch (e) {
      console.error('[Database] transferPatientBed error:', e);
      throw e;
    }
  },

  updateAdmissionBillingStatus: (admissionId: string, billingStatus: string, dischargeSummary?: string) => {
    try {
      const now = new Date().toISOString();
      if (dischargeSummary !== undefined && dischargeSummary.trim() !== '') {
        db.prepare('UPDATE bed_admissions SET billingStatus = ?, dischargeSummary = ?, updatedAt = ? WHERE id = ?')
          .run(billingStatus, dischargeSummary, now, admissionId);
      } else {
        db.prepare('UPDATE bed_admissions SET billingStatus = ?, updatedAt = ? WHERE id = ?')
          .run(billingStatus, now, admissionId);
      }
      return { success: true };
    } catch (e) {
      console.error('[Database] updateAdmissionBillingStatus error:', e);
      throw e;
    }
  },

  dischargePatientAdmission: (admissionId: string, data?: { dischargeSummary?: string; receiptId?: string; makeBedCleaning?: boolean; billingStatus?: string }) => {
    try {
      const transaction = db.transaction(() => {
        const admission = db.prepare('SELECT * FROM bed_admissions WHERE id = ?').get(admissionId) as any;
        if (!admission) throw new Error(`Admission ${admissionId} not found`);

        const now = new Date().toISOString();
        const dischargeSummary = data?.dischargeSummary || admission.dischargeSummary || 'Discharged';
        const totalBillId = data?.receiptId || admission.totalBillId || null;
        const billingStatus = data?.billingStatus || (totalBillId ? 'BILLED' : (admission.billingStatus || 'NONE'));

        // 1. Update admission status
        db.prepare(`
          UPDATE bed_admissions
          SET status = 'discharged', billingStatus = ?, dischargedAt = ?, dischargeSummary = ?, totalBillId = ?, updatedAt = ?
          WHERE id = ?
        `).run(billingStatus, now, dischargeSummary, totalBillId, now, admissionId);

        // 2. Release bed to 'cleaning' status (ready for sanitization)
        const nextBedStatus = data?.makeBedCleaning !== false ? 'cleaning' : 'available';
        db.prepare('UPDATE beds SET status = ?, currentAdmissionId = NULL, updatedAt = ? WHERE id = ?')
          .run(nextBedStatus, now, admission.bedId);

        return { success: true, dischargedAt: now };
      });

      return transaction();
    } catch (e) {
      console.error('[Database] dischargePatientAdmission error:', e);
      throw e;
    }
  },

  addAdmissionVital: (admissionId: string, vital: any) => {
    try {
      const admission = db.prepare('SELECT vitalsLog FROM bed_admissions WHERE id = ?').get(admissionId) as any;
      if (!admission) throw new Error(`Admission ${admissionId} not found`);

      let log: any[] = [];
      try {
        log = JSON.parse(admission.vitalsLog || '[]');
      } catch (_) {}

      const recordedVital = {
        id: `VIT-${Date.now()}`,
        recordedAt: new Date().toISOString(),
        ...vital
      };

      log.unshift(recordedVital); // latest first
      db.prepare('UPDATE bed_admissions SET vitalsLog = ?, updatedAt = ? WHERE id = ?')
        .run(JSON.stringify(log), new Date().toISOString(), admissionId);

      return { success: true, vital: recordedVital };
    } catch (e) {
      console.error('[Database] addAdmissionVital error:', e);
      throw e;
    }
  },

  addAdmissionCharge: (admissionId: string, charge: any) => {
    try {
      const admission = db.prepare('SELECT wardChargesLog FROM bed_admissions WHERE id = ?').get(admissionId) as any;
      if (!admission) throw new Error(`Admission ${admissionId} not found`);

      let log: any[] = [];
      try {
        log = JSON.parse(admission.wardChargesLog || '[]');
      } catch (_) {}

      const recordedCharge = {
        id: `CHG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        recordedAt: new Date().toISOString(),
        ...charge
      };

      log.unshift(recordedCharge);
      db.prepare('UPDATE bed_admissions SET wardChargesLog = ?, updatedAt = ? WHERE id = ?')
        .run(JSON.stringify(log), new Date().toISOString(), admissionId);

      return { success: true, charge: recordedCharge };
    } catch (e) {
      console.error('[Database] addAdmissionCharge error:', e);
      throw e;
    }
  },

  deleteAdmissionCharge: (admissionId: string, chargeId: string) => {
    try {
      const admission = db.prepare('SELECT wardChargesLog FROM bed_admissions WHERE id = ?').get(admissionId) as any;
      if (!admission) throw new Error(`Admission ${admissionId} not found`);

      let log: any[] = [];
      try {
        log = JSON.parse(admission.wardChargesLog || '[]');
      } catch (_) {}

      log = log.filter((c: any) => c.id !== chargeId);
      db.prepare('UPDATE bed_admissions SET wardChargesLog = ?, updatedAt = ? WHERE id = ?')
        .run(JSON.stringify(log), new Date().toISOString(), admissionId);

      return { success: true };
    } catch (e) {
      console.error('[Database] deleteAdmissionCharge error:', e);
      throw e;
    }
  },

  addEmarOrder: (admissionId: string, order: any) => {
    try {
      const admission = db.prepare('SELECT emarOrdersLog FROM bed_admissions WHERE id = ?').get(admissionId) as any;
      if (!admission) throw new Error(`Admission ${admissionId} not found`);

      let log: any[] = [];
      try {
        log = JSON.parse(admission.emarOrdersLog || '[]');
      } catch (_) {}

      const newOrder = {
        id: `EMAR-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        scheduleTimes: order.scheduleTimes || ['08:00', '20:00'],
        startDate: order.startDate || new Date().toISOString().split('T')[0],
        ...order
      };

      log.unshift(newOrder);
      db.prepare('UPDATE bed_admissions SET emarOrdersLog = ?, updatedAt = ? WHERE id = ?')
        .run(JSON.stringify(log), new Date().toISOString(), admissionId);

      return { success: true, order: newOrder };
    } catch (e) {
      console.error('[Database] addEmarOrder error:', e);
      throw e;
    }
  },

  updateEmarOrderStatus: (admissionId: string, orderId: string, status: string) => {
    try {
      const admission = db.prepare('SELECT emarOrdersLog FROM bed_admissions WHERE id = ?').get(admissionId) as any;
      if (!admission) throw new Error(`Admission ${admissionId} not found`);

      let log: any[] = [];
      try {
        log = JSON.parse(admission.emarOrdersLog || '[]');
      } catch (_) {}

      log = log.map((o: any) => o.id === orderId ? { ...o, status } : o);
      db.prepare('UPDATE bed_admissions SET emarOrdersLog = ?, updatedAt = ? WHERE id = ?')
        .run(JSON.stringify(log), new Date().toISOString(), admissionId);

      return { success: true };
    } catch (e) {
      console.error('[Database] updateEmarOrderStatus error:', e);
      throw e;
    }
  },

  recordEmarAdministration: (admissionId: string, record: any) => {
    try {
      const admission = db.prepare('SELECT emarAdminLog FROM bed_admissions WHERE id = ?').get(admissionId) as any;
      if (!admission) throw new Error(`Admission ${admissionId} not found`);

      let log: any[] = [];
      try {
        log = JSON.parse(admission.emarAdminLog || '[]');
      } catch (_) {}

      const newAdminRecord = {
        id: `ADM-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        administeredAt: new Date().toISOString(),
        ...record
      };

      log.unshift(newAdminRecord);
      db.prepare('UPDATE bed_admissions SET emarAdminLog = ?, updatedAt = ? WHERE id = ?')
        .run(JSON.stringify(log), new Date().toISOString(), admissionId);

      return { success: true, adminRecord: newAdminRecord };
    } catch (e) {
      console.error('[Database] recordEmarAdministration error:', e);
      throw e;
    }
  },

  addFluidIoEntry: (admissionId: string, entry: any) => {
    try {
      const admission = db.prepare('SELECT fluidIoLog FROM bed_admissions WHERE id = ?').get(admissionId) as any;
      if (!admission) throw new Error(`Admission ${admissionId} not found`);

      let log: any[] = [];
      try {
        log = JSON.parse(admission.fluidIoLog || '[]');
      } catch (_) {}

      const newEntry = {
        id: `FIO-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        recordedAt: new Date().toISOString(),
        ...entry
      };

      log.unshift(newEntry);
      db.prepare('UPDATE bed_admissions SET fluidIoLog = ?, updatedAt = ? WHERE id = ?')
        .run(JSON.stringify(log), new Date().toISOString(), admissionId);

      return { success: true, entry: newEntry };
    } catch (e) {
      console.error('[Database] addFluidIoEntry error:', e);
      throw e;
    }
  },

  deleteFluidIoEntry: (admissionId: string, entryId: string) => {
    try {
      const admission = db.prepare('SELECT fluidIoLog FROM bed_admissions WHERE id = ?').get(admissionId) as any;
      if (!admission) throw new Error(`Admission ${admissionId} not found`);

      let log: any[] = [];
      try {
        log = JSON.parse(admission.fluidIoLog || '[]');
      } catch (_) {}

      log = log.filter((e: any) => e.id !== entryId);
      db.prepare('UPDATE bed_admissions SET fluidIoLog = ?, updatedAt = ? WHERE id = ?')
        .run(JSON.stringify(log), new Date().toISOString(), admissionId);

      return { success: true };
    } catch (e) {
      console.error('[Database] deleteFluidIoEntry error:', e);
      throw e;
    }
  },

  addNursingShiftNote: (admissionId: string, note: any) => {
    try {
      const admission = db.prepare('SELECT nursingNotesLog FROM bed_admissions WHERE id = ?').get(admissionId) as any;
      if (!admission) throw new Error(`Admission ${admissionId} not found`);

      let log: any[] = [];
      try {
        log = JSON.parse(admission.nursingNotesLog || '[]');
      } catch (_) {}

      const newNote = {
        id: `NOTE-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        recordedAt: new Date().toISOString(),
        ...note
      };

      log.unshift(newNote);
      db.prepare('UPDATE bed_admissions SET nursingNotesLog = ?, updatedAt = ? WHERE id = ?')
        .run(JSON.stringify(log), new Date().toISOString(), admissionId);

      return { success: true, note: newNote };
    } catch (e) {
      console.error('[Database] addNursingShiftNote error:', e);
      throw e;
    }
  },

  deleteNursingShiftNote: (admissionId: string, noteId: string) => {
    try {
      const admission = db.prepare('SELECT nursingNotesLog FROM bed_admissions WHERE id = ?').get(admissionId) as any;
      if (!admission) throw new Error(`Admission ${admissionId} not found`);

      let log: any[] = [];
      try {
        log = JSON.parse(admission.nursingNotesLog || '[]');
      } catch (_) {}

      log = log.filter((n: any) => n.id !== noteId);
      db.prepare('UPDATE bed_admissions SET nursingNotesLog = ?, updatedAt = ? WHERE id = ?')
        .run(JSON.stringify(log), new Date().toISOString(), admissionId);

      return { success: true };
    } catch (e) {
      console.error('[Database] deleteNursingShiftNote error:', e);
      throw e;
    }
  },

  getIpdDashboardMetrics: () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const bedStats = db.prepare(`
        SELECT
          COUNT(*) as totalBeds,
          SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupiedBeds,
          SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as availableBeds,
          SUM(CASE WHEN status = 'cleaning' THEN 1 ELSE 0 END) as cleaningBeds,
          SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenanceBeds
        FROM beds
      `).get() as any;

      const totalBeds = bedStats?.totalBeds || 0;
      const occupiedBeds = bedStats?.occupiedBeds || 0;
      const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

      const admTodayRow = db.prepare('SELECT COUNT(*) as count FROM bed_admissions WHERE admittedAt LIKE ?').get(`${today}%`) as any;
      const disTodayRow = db.prepare('SELECT COUNT(*) as count FROM bed_admissions WHERE dischargedAt LIKE ?').get(`${today}%`) as any;

      return {
        totalBeds,
        occupiedBeds,
        availableBeds: bedStats?.availableBeds || 0,
        cleaningBeds: bedStats?.cleaningBeds || 0,
        maintenanceBeds: bedStats?.maintenanceBeds || 0,
        occupancyRate,
        admissionsTodayCount: admTodayRow?.count || 0,
        dischargesTodayCount: disTodayRow?.count || 0
      };
    } catch (e) {
      console.error('[Database] getIpdDashboardMetrics error:', e);
      return {
        totalBeds: 0,
        occupiedBeds: 0,
        availableBeds: 0,
        cleaningBeds: 0,
        maintenanceBeds: 0,
        occupancyRate: 0,
        admissionsTodayCount: 0,
        dischargesTodayCount: 0
      };
    }
  },

  // ==========================================
  // LABORATORY & DIAGNOSTICS MODULE
  // ==========================================
  getLabTests: (category?: string) => {
    try {
      let query = 'SELECT * FROM lab_tests WHERE isActive = 1';
      const params: any[] = [];
      if (category && category !== 'ALL') {
        query += ' AND category = ?';
        params.push(category);
      }
      query += ' ORDER BY name ASC';
      const rows = db.prepare(query).all(...params) as any[];
      return rows.map(r => ({
        ...r,
        parameters: typeof r.parameters === 'string' ? JSON.parse(r.parameters || '[]') : (r.parameters || [])
      }));
    } catch (e) {
      console.error('[Database] getLabTests error:', e);
      return [];
    }
  },

  saveLabTest: (test: any) => {
    try {
      const now = new Date().toISOString();
      const id = test.id || `TEST-${Date.now()}`;
      const paramsJson = JSON.stringify(test.parameters || []);

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO lab_tests
        (id, name, code, category, rate, sampleType, turnaroundTime, parameters, description, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM lab_tests WHERE id = ?), ?), ?)
      `);

      stmt.run(
        id,
        test.name,
        test.code || id,
        test.category || 'General',
        Number(test.rate) || 0,
        test.sampleType || 'Blood (EDTA)',
        test.turnaroundTime || '2-4 Hours',
        paramsJson,
        test.description || '',
        test.isActive !== false ? 1 : 0,
        id,
        now,
        now
      );

      return { success: true, id };
    } catch (e) {
      console.error('[Database] saveLabTest error:', e);
      throw e;
    }
  },

  deleteLabTest: (id: string) => {
    try {
      db.prepare('UPDATE lab_tests SET isActive = 0, updatedAt = ? WHERE id = ?')
        .run(new Date().toISOString(), id);
      return { success: true };
    } catch (e) {
      console.error('[Database] deleteLabTest error:', e);
      throw e;
    }
  },

  getNextLabOrderNumber: () => {
    try {
      const metaRow = db.prepare("SELECT value FROM metadata WHERE key = 'last_lab_order_num'").get() as any;
      let nextNum = 1001;
      if (metaRow && metaRow.value) {
        const parsed = parseInt(metaRow.value, 10);
        if (!isNaN(parsed)) nextNum = parsed + 1;
      }
      return `LAB-${nextNum}`;
    } catch (e) {
      console.error('[Database] getNextLabOrderNumber error:', e);
      return `LAB-${Date.now().toString().slice(-4)}`;
    }
  },

  getLabOrders: () => {
    try {
      const rows = db.prepare('SELECT * FROM lab_orders ORDER BY createdAt DESC').all() as any[];
      return rows.map(r => ({
        ...r,
        tests: typeof r.tests === 'string' ? JSON.parse(r.tests || '[]') : (r.tests || [])
      }));
    } catch (e) {
      console.error('[Database] getLabOrders error:', e);
      return [];
    }
  },

  getLabOrderById: (id: string) => {
    try {
      const row = db.prepare('SELECT * FROM lab_orders WHERE id = ?').get(id) as any;
      if (!row) return null;
      return {
        ...row,
        tests: typeof row.tests === 'string' ? JSON.parse(row.tests || '[]') : (row.tests || [])
      };
    } catch (e) {
      console.error('[Database] getLabOrderById error:', e);
      return null;
    }
  },

  saveLabOrder: (order: any) => {
    try {
      const now = new Date().toISOString();
      const id = order.id || `LABORD-${Date.now()}`;
      let orderNumber = order.orderNumber;

      if (!orderNumber) {
        const metaRow = db.prepare("SELECT value FROM metadata WHERE key = 'last_lab_order_num'").get() as any;
        let nextNum = 1001;
        if (metaRow && metaRow.value) {
          const parsed = parseInt(metaRow.value, 10);
          if (!isNaN(parsed)) nextNum = parsed + 1;
        }
        db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('last_lab_order_num', ?)").run(nextNum.toString());
        orderNumber = `LAB-${nextNum}`;
      }

      const testsJson = JSON.stringify(order.tests || []);

      const stmt = db.prepare(`
        INSERT OR REPLACE INTO lab_orders (
          id, orderNumber, patientId, patientName, patientPhone, patientGender, patientAge,
          doctorId, doctorName, prescriptionId, tests, totalAmount, discount, paidAmount,
          paymentMode, status, sampleCollectedAt, sampleCollectedBy, completedAt,
          technicianNotes, pathologistRemarks, orderDate, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM lab_orders WHERE id = ?), ?), ?)
      `);

      stmt.run(
        id,
        orderNumber,
        order.patientId || '',
        order.patientName,
        order.patientPhone || '',
        order.patientGender || '',
        order.patientAge || '',
        order.doctorId || '',
        order.doctorName || 'Self / Walk-in',
        order.prescriptionId || '',
        testsJson,
        Number(order.totalAmount) || 0,
        Number(order.discount) || 0,
        Number(order.paidAmount) || 0,
        order.paymentMode || 'CASH',
        order.status || 'ORDERED',
        order.sampleCollectedAt || null,
        order.sampleCollectedBy || '',
        order.completedAt || null,
        order.technicianNotes || '',
        order.pathologistRemarks || '',
        order.orderDate || now.split('T')[0],
        id,
        now,
        now
      );

      return { success: true, id, orderNumber };
    } catch (e) {
      console.error('[Database] saveLabOrder error:', e);
      throw e;
    }
  },

  updateLabOrderStatus: (id: string, status: string, details?: any) => {
    try {
      const now = new Date().toISOString();
      const current = db.prepare('SELECT * FROM lab_orders WHERE id = ?').get(id) as any;
      if (!current) throw new Error(`Lab order ${id} not found`);

      let sampleCollectedAt = current.sampleCollectedAt;
      let sampleCollectedBy = current.sampleCollectedBy;
      let completedAt = current.completedAt;
      const technicianNotes = details?.technicianNotes !== undefined ? details.technicianNotes : current.technicianNotes;
      const pathologistRemarks = details?.pathologistRemarks !== undefined ? details.pathologistRemarks : current.pathologistRemarks;

      if (status === 'SAMPLE_COLLECTED' && !sampleCollectedAt) {
        sampleCollectedAt = details?.sampleCollectedAt || now;
        sampleCollectedBy = details?.sampleCollectedBy || 'Laboratory Desk';
      }
      if (status === 'COMPLETED' && !completedAt) {
        completedAt = now;
      }

      db.prepare(`
        UPDATE lab_orders SET
          status = ?,
          sampleCollectedAt = ?,
          sampleCollectedBy = ?,
          completedAt = ?,
          technicianNotes = ?,
          pathologistRemarks = ?,
          updatedAt = ?
        WHERE id = ?
      `).run(
        status,
        sampleCollectedAt,
        sampleCollectedBy,
        completedAt,
        technicianNotes,
        pathologistRemarks,
        now,
        id
      );

      return { success: true };
    } catch (e) {
      console.error('[Database] updateLabOrderStatus error:', e);
      throw e;
    }
  },

  saveLabOrderResults: (id: string, testsWithResults: any[], pathologistRemarks?: string) => {
    try {
      const now = new Date().toISOString();
      const testsJson = JSON.stringify(testsWithResults || []);
      const allDone = testsWithResults.every((t: any) => t.results && t.results.length > 0 && t.results.some((r: any) => r.value !== undefined && r.value !== ''));
      const status = allDone ? 'COMPLETED' : 'IN_ANALYSIS';

      db.prepare(`
        UPDATE lab_orders SET
          tests = ?,
          pathologistRemarks = COALESCE(?, pathologistRemarks),
          status = ?,
          completedAt = CASE WHEN ? = 'COMPLETED' THEN ? ELSE completedAt END,
          updatedAt = ?
        WHERE id = ?
      `).run(
        testsJson,
        pathologistRemarks || null,
        status,
        status,
        now,
        now,
        id
      );

      return { success: true, status };
    } catch (e) {
      console.error('[Database] saveLabOrderResults error:', e);
      throw e;
    }
  },

  deleteLabOrder: (id: string) => {
    try {
      db.prepare('DELETE FROM lab_orders WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      console.error('[Database] deleteLabOrder error:', e);
      throw e;
    }
  },

  getLabDashboardMetrics: () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const ordersToday = db.prepare('SELECT COUNT(*) as cnt FROM lab_orders WHERE orderDate LIKE ?').get(`${today}%`) as any;
      const samplesPending = db.prepare("SELECT COUNT(*) as cnt FROM lab_orders WHERE status = 'ORDERED'").get() as any;
      const inAnalysis = db.prepare("SELECT COUNT(*) as cnt FROM lab_orders WHERE status IN ('SAMPLE_COLLECTED', 'IN_ANALYSIS')").get() as any;
      const completedToday = db.prepare("SELECT COUNT(*) as cnt FROM lab_orders WHERE status = 'COMPLETED' AND completedAt LIKE ?").get(`${today}%`) as any;

      return {
        ordersTodayCount: ordersToday?.cnt || 0,
        samplesPendingCount: samplesPending?.cnt || 0,
        inAnalysisCount: inAnalysis?.cnt || 0,
        completedTodayCount: completedToday?.cnt || 0
      };
    } catch (e) {
      console.error('[Database] getLabDashboardMetrics error:', e);
      return {
        ordersTodayCount: 0,
        samplesPendingCount: 0,
        inAnalysisCount: 0,
        completedTodayCount: 0
      };
    }
  },

  // TPA & Health Insurance Methods
  getTpaProviders: () => {
    try {
      return db.prepare('SELECT * FROM tpa_providers WHERE isActive = 1 ORDER BY name ASC').all();
    } catch (e) {
      console.error('[Database] getTpaProviders error:', e);
      return [];
    }
  },

  saveTpaProvider: (provider: any) => {
    try {
      const now = new Date().toISOString();
      const id = provider.id || `TPA-${Date.now()}`;
      const name = provider.name || 'Insurance Provider';
      const code = provider.code || name.substring(0, 4).toUpperCase();
      const contactEmail = provider.contactEmail || '';
      const contactPhone = provider.contactPhone || '';
      const portalUrl = provider.portalUrl || '';
      const defaultCopayPercent = Number(provider.defaultCopayPercent) || 0;
      const isActive = provider.isActive !== undefined ? (provider.isActive ? 1 : 0) : 1;

      const existing = db.prepare('SELECT id FROM tpa_providers WHERE id = ?').get(id);
      if (existing) {
        db.prepare(`
          UPDATE tpa_providers SET
            name = ?, code = ?, contactEmail = ?, contactPhone = ?, portalUrl = ?,
            defaultCopayPercent = ?, isActive = ?, updatedAt = ?
          WHERE id = ?
        `).run(name, code, contactEmail, contactPhone, portalUrl, defaultCopayPercent, isActive, now, id);
      } else {
        db.prepare(`
          INSERT INTO tpa_providers (id, name, code, contactEmail, contactPhone, portalUrl, defaultCopayPercent, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, name, code, contactEmail, contactPhone, portalUrl, defaultCopayPercent, isActive, now, now);
      }
      return { success: true, id };
    } catch (e) {
      console.error('[Database] saveTpaProvider error:', e);
      throw e;
    }
  },

  deleteTpaProvider: (id: string) => {
    try {
      db.prepare('DELETE FROM tpa_providers WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      console.error('[Database] deleteTpaProvider error:', e);
      throw e;
    }
  },

  getInsuranceClaims: (options?: { status?: string; admissionId?: string }) => {
    try {
      let query = 'SELECT * FROM insurance_claims WHERE 1=1';
      const params: any[] = [];
      if (options?.status) {
        query += ' AND status = ?';
        params.push(options.status);
      }
      if (options?.admissionId) {
        query += ' AND admissionId = ?';
        params.push(options.admissionId);
      }
      query += ' ORDER BY createdAt DESC';
      return db.prepare(query).all(...params);
    } catch (e) {
      console.error('[Database] getInsuranceClaims error:', e);
      return [];
    }
  },

  getInsuranceClaimById: (id: string) => {
    try {
      return db.prepare('SELECT * FROM insurance_claims WHERE id = ?').get(id) || null;
    } catch (e) {
      console.error('[Database] getInsuranceClaimById error:', e);
      return null;
    }
  },

  saveInsuranceClaim: (claim: any) => {
    try {
      const now = new Date().toISOString();
      const id = claim.id || `CLM-${Date.now()}`;
      const claimNumber = claim.claimNumber || `CLM-${Math.floor(100000 + Math.random() * 900000)}`;
      const admissionId = claim.admissionId || null;
      const patientId = claim.patientId || null;
      const patientUhid = claim.patientUhid || null;
      const patientName = claim.patientName || 'Patient';
      const patientPhone = claim.patientPhone || '';
      const tpaProviderId = claim.tpaProviderId || '';
      const tpaProviderName = claim.tpaProviderName || '';
      const insurerName = claim.insurerName || '';
      const policyNumber = claim.policyNumber || '';
      const cardId = claim.cardId || '';
      const corporateName = claim.corporateName || '';
      const sumInsured = Number(claim.sumInsured) || 0;
      const initialPreAuthAmount = Number(claim.initialPreAuthAmount) || 0;
      const approvedAmount = Number(claim.approvedAmount) || 0;
      const finalSettledAmount = Number(claim.finalSettledAmount) || 0;
      const copayPercent = Number(claim.copayPercent) || 0;
      const nonPayableDeductions = Number(claim.nonPayableDeductions) || 0;
      const status = claim.status || 'PREAUTH_DRAFT';
      const queriesLog = typeof claim.queriesLog === 'string' ? claim.queriesLog : JSON.stringify(claim.queriesLog || []);
      const preAuthLetterRef = claim.preAuthLetterRef || '';
      const settlementDate = claim.settlementDate || null;
      const notes = claim.notes || '';

      const existing = db.prepare('SELECT id FROM insurance_claims WHERE id = ?').get(id);
      if (existing) {
        db.prepare(`
          UPDATE insurance_claims SET
            claimNumber = ?, admissionId = ?, patientId = ?, patientUhid = ?, patientName = ?,
            patientPhone = ?, tpaProviderId = ?, tpaProviderName = ?, insurerName = ?,
            policyNumber = ?, cardId = ?, corporateName = ?, sumInsured = ?,
            initialPreAuthAmount = ?, approvedAmount = ?, finalSettledAmount = ?,
            copayPercent = ?, nonPayableDeductions = ?, status = ?, queriesLog = ?,
            preAuthLetterRef = ?, settlementDate = ?, notes = ?, updatedAt = ?
          WHERE id = ?
        `).run(
          claimNumber, admissionId, patientId, patientUhid, patientName,
          patientPhone, tpaProviderId, tpaProviderName, insurerName,
          policyNumber, cardId, corporateName, sumInsured,
          initialPreAuthAmount, approvedAmount, finalSettledAmount,
          copayPercent, nonPayableDeductions, status, queriesLog,
          preAuthLetterRef, settlementDate, notes, now, id
        );
      } else {
        db.prepare(`
          INSERT INTO insurance_claims (
            id, claimNumber, admissionId, patientId, patientUhid, patientName,
            patientPhone, tpaProviderId, tpaProviderName, insurerName,
            policyNumber, cardId, corporateName, sumInsured,
            initialPreAuthAmount, approvedAmount, finalSettledAmount,
            copayPercent, nonPayableDeductions, status, queriesLog,
            preAuthLetterRef, settlementDate, notes, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, claimNumber, admissionId, patientId, patientUhid, patientName,
          patientPhone, tpaProviderId, tpaProviderName, insurerName,
          policyNumber, cardId, corporateName, sumInsured,
          initialPreAuthAmount, approvedAmount, finalSettledAmount,
          copayPercent, nonPayableDeductions, status, queriesLog,
          preAuthLetterRef, settlementDate, notes, now, now
        );
      }

      // Link to admission if present
      if (admissionId) {
        try {
          db.prepare('UPDATE bed_admissions SET insuranceClaimId = ?, updatedAt = ? WHERE id = ?').run(id, now, admissionId);
        } catch (_) {}
      }

      return { success: true, id, claimNumber };
    } catch (e) {
      console.error('[Database] saveInsuranceClaim error:', e);
      throw e;
    }
  },

  updateClaimStatus: (id: string, status: string, notes?: string) => {
    try {
      const now = new Date().toISOString();
      const settlementDate = status === 'SETTLED' ? now.split('T')[0] : null;
      db.prepare(`
        UPDATE insurance_claims SET
          status = ?,
          notes = CASE WHEN ? IS NOT NULL THEN ? ELSE notes END,
          settlementDate = CASE WHEN ? IS NOT NULL THEN ? ELSE settlementDate END,
          updatedAt = ?
        WHERE id = ?
      `).run(status, notes || null, notes || null, settlementDate, settlementDate, now, id);
      return { success: true };
    } catch (e) {
      console.error('[Database] updateClaimStatus error:', e);
      throw e;
    }
  },

  addClaimQuery: (claimId: string, query: any) => {
    try {
      const now = new Date().toISOString();
      const claim = db.prepare('SELECT queriesLog FROM insurance_claims WHERE id = ?').get(claimId) as any;
      if (!claim) throw new Error('Claim not found');
      let queries: any[] = [];
      try {
        queries = claim.queriesLog ? JSON.parse(claim.queriesLog) : [];
      } catch (_) {}
      const newQuery = {
        id: `QRY-${Date.now()}`,
        queryReceivedAt: query.queryReceivedAt || now,
        queryDetails: query.queryDetails || '',
        replySentAt: query.replySentAt,
        replyDetails: query.replyDetails,
        repliedBy: query.repliedBy
      };
      queries.push(newQuery);
      db.prepare(`
        UPDATE insurance_claims SET
          queriesLog = ?,
          status = 'QUERY_RAISED',
          updatedAt = ?
        WHERE id = ?
      `).run(JSON.stringify(queries), now, claimId);
      return { success: true };
    } catch (e) {
      console.error('[Database] addClaimQuery error:', e);
      throw e;
    }
  },

  getInsuranceDashboardMetrics: () => {
    try {
      const totalRow = db.prepare('SELECT COUNT(*) as total FROM insurance_claims').get() as any;
      const activeRow = db.prepare("SELECT COUNT(*) as active FROM insurance_claims WHERE status NOT IN ('REJECTED', 'SETTLED')").get() as any;
      const pendingRow = db.prepare("SELECT COUNT(*) as pending FROM insurance_claims WHERE status IN ('PREAUTH_DRAFT', 'SUBMITTED', 'QUERY_RAISED', 'ENHANCEMENT_REQUESTED')").get() as any;
      const approvedRow = db.prepare("SELECT SUM(approvedAmount) as sumApproved FROM insurance_claims WHERE status NOT IN ('REJECTED')").get() as any;
      const settledRow = db.prepare("SELECT SUM(finalSettledAmount) as sumSettled FROM insurance_claims WHERE status = 'SETTLED'").get() as any;

      return {
        totalClaims: totalRow?.total || 0,
        activeClaims: activeRow?.active || 0,
        pendingApprovals: pendingRow?.pending || 0,
        approvedTotalAmount: approvedRow?.sumApproved || 0,
        settledTotalAmount: settledRow?.sumSettled || 0
      };
    } catch (e) {
      console.error('[Database] getInsuranceDashboardMetrics error:', e);
      return {
        totalClaims: 0,
        activeClaims: 0,
        pendingApprovals: 0,
        approvedTotalAmount: 0,
        settledTotalAmount: 0
      };
    }
  },

  // Discharge Summary Methods
  saveDischargeSummary: (admissionId: string, summary: any) => {
    try {
      const now = new Date().toISOString();
      const summaryJson = typeof summary === 'string' ? summary : JSON.stringify(summary);
      db.prepare(`
        UPDATE bed_admissions SET
          dischargeSummary = ?,
          updatedAt = ?
        WHERE id = ?
      `).run(summaryJson, now, admissionId);
      return { success: true };
    } catch (e) {
      console.error('[Database] saveDischargeSummary error:', e);
      throw e;
    }
  },

  getDischargeSummary: (admissionId: string) => {
    try {
      const row = db.prepare('SELECT dischargeSummary FROM bed_admissions WHERE id = ?').get(admissionId) as any;
      if (!row || !row.dischargeSummary) return null;
      try {
        return JSON.parse(row.dischargeSummary);
      } catch (_) {
        return row.dischargeSummary;
      }
    } catch (e) {
      console.error('[Database] getDischargeSummary error:', e);
      return null;
    }
  },

  // ── Operation Theatre (OT) Methods ──────────────────────────────────────────
  getOperationTheatres: () => {
    try {
      return db.prepare('SELECT * FROM operation_theatres ORDER BY name ASC').all().map((r: any) => ({
        ...r,
        isActive: Boolean(r.isActive)
      }));
    } catch (e) {
      console.error('[Database] getOperationTheatres error:', e);
      return [];
    }
  },

  saveOperationTheatre: (ot: any) => {
    try {
      const now = new Date().toISOString();
      const existing = db.prepare('SELECT id FROM operation_theatres WHERE id = ?').get(ot.id);
      if (existing) {
        db.prepare(`
          UPDATE operation_theatres SET
            name = ?, code = ?, theatreType = ?, floor = ?, dailyRate = ?, status = ?, isActive = ?, updatedAt = ?
          WHERE id = ?
        `).run(ot.name, ot.code, ot.theatreType || 'MAJOR', ot.floor || '', ot.dailyRate || 0, ot.status || 'AVAILABLE', ot.isActive !== false ? 1 : 0, now, ot.id);
      } else {
        db.prepare(`
          INSERT INTO operation_theatres (id, name, code, theatreType, floor, dailyRate, status, isActive, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(ot.id, ot.name, ot.code, ot.theatreType || 'MAJOR', ot.floor || '', ot.dailyRate || 0, ot.status || 'AVAILABLE', ot.isActive !== false ? 1 : 0, now, now);
      }
      return { success: true, id: ot.id };
    } catch (e) {
      console.error('[Database] saveOperationTheatre error:', e);
      throw e;
    }
  },

  deleteOperationTheatre: (id: string) => {
    try {
      db.prepare('DELETE FROM operation_theatres WHERE id = ?').run(id);
      return { success: true };
    } catch (e) {
      console.error('[Database] deleteOperationTheatre error:', e);
      throw e;
    }
  },

  // ── Surgical Cases Methods ──────────────────────────────────────────────────
  getSurgicalCases: (options?: { date?: string; status?: string; theatreId?: string }) => {
    try {
      let query = 'SELECT * FROM surgical_cases WHERE 1=1';
      const params: any[] = [];
      if (options?.date) {
        query += ' AND scheduledDate = ?';
        params.push(options.date);
      }
      if (options?.status && options.status !== 'ALL') {
        query += ' AND status = ?';
        params.push(options.status);
      }
      if (options?.theatreId && options.theatreId !== 'ALL') {
        query += ' AND theatreId = ?';
        params.push(options.theatreId);
      }
      query += ' ORDER BY scheduledDate DESC, startTime ASC';
      return db.prepare(query).all(...params).map((r: any) => ({
        ...r,
        pacData: r.pacData ? JSON.parse(r.pacData) : null,
        whoChecklistData: r.whoChecklistData ? JSON.parse(r.whoChecklistData) : null,
        intraOpNotes: r.intraOpNotes ? JSON.parse(r.intraOpNotes) : null,
        pacuData: r.pacuData ? JSON.parse(r.pacuData) : null,
        chargesLogged: r.chargesLogged ? JSON.parse(r.chargesLogged) : []
      }));
    } catch (e) {
      console.error('[Database] getSurgicalCases error:', e);
      return [];
    }
  },

  getSurgicalCaseById: (id: string) => {
    try {
      const r = db.prepare('SELECT * FROM surgical_cases WHERE id = ?').get(id) as any;
      if (!r) return null;
      return {
        ...r,
        pacData: r.pacData ? JSON.parse(r.pacData) : null,
        whoChecklistData: r.whoChecklistData ? JSON.parse(r.whoChecklistData) : null,
        intraOpNotes: r.intraOpNotes ? JSON.parse(r.intraOpNotes) : null,
        pacuData: r.pacuData ? JSON.parse(r.pacuData) : null,
        chargesLogged: r.chargesLogged ? JSON.parse(r.chargesLogged) : []
      };
    } catch (e) {
      console.error('[Database] getSurgicalCaseById error:', e);
      return null;
    }
  },

  saveSurgicalCase: (sc: any) => {
    try {
      const now = new Date().toISOString();
      const existing = db.prepare('SELECT id, caseNumber FROM surgical_cases WHERE id = ?').get(sc.id) as any;
      let caseNumber = sc.caseNumber;
      if (!caseNumber && !existing) {
        const year = new Date().getFullYear();
        const countRow = db.prepare("SELECT COUNT(*) as cnt FROM surgical_cases WHERE caseNumber LIKE ?").get(`OT-${year}-%`) as any;
        const nextNum = (countRow?.cnt || 0) + 1;
        caseNumber = `OT-${year}-${String(nextNum).padStart(4, '0')}`;
      } else if (existing) {
        caseNumber = existing.caseNumber;
      }

      const pacDataStr = sc.pacData ? JSON.stringify(sc.pacData) : null;
      const whoChecklistDataStr = sc.whoChecklistData ? JSON.stringify(sc.whoChecklistData) : null;
      const intraOpNotesStr = sc.intraOpNotes ? JSON.stringify(sc.intraOpNotes) : null;
      const pacuDataStr = sc.pacuData ? JSON.stringify(sc.pacuData) : null;
      const chargesLoggedStr = sc.chargesLogged ? JSON.stringify(sc.chargesLogged) : null;

      if (existing) {
        db.prepare(`
          UPDATE surgical_cases SET
            patientId = ?, patientUhid = ?, patientName = ?, patientPhone = ?, patientAge = ?, patientGender = ?,
            admissionId = ?, theatreId = ?, theatreName = ?, surgeryName = ?, surgeryCategory = ?, urgency = ?,
            primarySurgeonId = ?, primarySurgeonName = ?, assistantSurgeonName = ?, anesthetistName = ?,
            scrubNurseName = ?, circulatingNurseName = ?, scheduledDate = ?, startTime = ?, endTime = ?,
            status = ?, pacData = ?, whoChecklistData = ?, intraOpNotes = ?, pacuData = ?, chargesLogged = ?, notes = ?, updatedAt = ?
          WHERE id = ?
        `).run(
          sc.patientId || null, sc.patientUhid || null, sc.patientName, sc.patientPhone || null, sc.patientAge || null, sc.patientGender || null,
          sc.admissionId || null, sc.theatreId, sc.theatreName, sc.surgeryName, sc.surgeryCategory || 'GENERAL', sc.urgency || 'ELECTIVE',
          sc.primarySurgeonId, sc.primarySurgeonName, sc.assistantSurgeonName || null, sc.anesthetistName || null,
          sc.scrubNurseName || null, sc.circulatingNurseName || null, sc.scheduledDate, sc.startTime, sc.endTime || null,
          sc.status || 'SCHEDULED', pacDataStr, whoChecklistDataStr, intraOpNotesStr, pacuDataStr, chargesLoggedStr, sc.notes || null, now, sc.id
        );
      } else {
        db.prepare(`
          INSERT INTO surgical_cases (
            id, caseNumber, patientId, patientUhid, patientName, patientPhone, patientAge, patientGender,
            admissionId, theatreId, theatreName, surgeryName, surgeryCategory, urgency,
            primarySurgeonId, primarySurgeonName, assistantSurgeonName, anesthetistName,
            scrubNurseName, circulatingNurseName, scheduledDate, startTime, endTime,
            status, pacData, whoChecklistData, intraOpNotes, pacuData, chargesLogged, notes, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          sc.id, caseNumber, sc.patientId || null, sc.patientUhid || null, sc.patientName, sc.patientPhone || null, sc.patientAge || null, sc.patientGender || null,
          sc.admissionId || null, sc.theatreId, sc.theatreName, sc.surgeryName, sc.surgeryCategory || 'GENERAL', sc.urgency || 'ELECTIVE',
          sc.primarySurgeonId, sc.primarySurgeonName, sc.assistantSurgeonName || null, sc.anesthetistName || null,
          sc.scrubNurseName || null, sc.circulatingNurseName || null, sc.scheduledDate, sc.startTime, sc.endTime || null,
          sc.status || 'SCHEDULED', pacDataStr, whoChecklistDataStr, intraOpNotesStr, pacuDataStr, chargesLoggedStr, sc.notes || null, now, now
        );
      }
      return { success: true, id: sc.id, caseNumber };
    } catch (e) {
      console.error('[Database] saveSurgicalCase error:', e);
      throw e;
    }
  },

  updateSurgicalCaseStatus: (id: string, status: string, notes?: string) => {
    try {
      const now = new Date().toISOString();
      if (notes) {
        db.prepare('UPDATE surgical_cases SET status = ?, notes = ?, updatedAt = ? WHERE id = ?').run(status, notes, now, id);
      } else {
        db.prepare('UPDATE surgical_cases SET status = ?, updatedAt = ? WHERE id = ?').run(status, now, id);
      }
      return { success: true };
    } catch (e) {
      console.error('[Database] updateSurgicalCaseStatus error:', e);
      throw e;
    }
  },

  getOtDashboardMetrics: () => {
    try {
      const totalTheatres = db.prepare('SELECT COUNT(*) as c FROM operation_theatres WHERE isActive = 1').get() as any;
      const today = new Date().toISOString().split('T')[0];
      const todayCases = db.prepare('SELECT COUNT(*) as c FROM surgical_cases WHERE scheduledDate = ?').get(today) as any;
      const inSurgery = db.prepare("SELECT COUNT(*) as c FROM surgical_cases WHERE status = 'IN_THEATRE'").get() as any;
      const pacuCases = db.prepare("SELECT COUNT(*) as c FROM surgical_cases WHERE status = 'RECOVERY_PACU'").get() as any;
      const completedMonth = db.prepare("SELECT COUNT(*) as c FROM surgical_cases WHERE status = 'COMPLETED'").get() as any;
      return {
        totalTheatres: totalTheatres?.c || 0,
        todayCases: todayCases?.c || 0,
        inSurgery: inSurgery?.c || 0,
        inPacu: pacuCases?.c || 0,
        completedSurgeries: completedMonth?.c || 0
      };
    } catch (e) {
      console.error('[Database] getOtDashboardMetrics error:', e);
      return { totalTheatres: 0, todayCases: 0, inSurgery: 0, inPacu: 0, completedSurgeries: 0 };
    }
  },

  // ── Emergency & Triage Methods ──────────────────────────────────────────────
  getEmergencyVisits: (options?: { status?: string; isMlc?: boolean; date?: string }) => {
    try {
      let query = 'SELECT * FROM emergency_visits WHERE 1=1';
      const params: any[] = [];
      if (options?.status && options.status !== 'ALL') {
        query += ' AND disposition = ?';
        params.push(options.status);
      }
      if (options?.isMlc !== undefined) {
        query += ' AND isMlc = ?';
        params.push(options.isMlc ? 1 : 0);
      }
      if (options?.date) {
        query += ' AND arrivedAt LIKE ?';
        params.push(`${options.date}%`);
      }
      query += ' ORDER BY triageLevel ASC, arrivedAt DESC';
      return db.prepare(query).all(...params).map((r: any) => ({
        ...r,
        isMlc: Boolean(r.isMlc),
        triageVitals: r.triageVitals ? JSON.parse(r.triageVitals) : null,
        mlcData: r.mlcData ? JSON.parse(r.mlcData) : null
      }));
    } catch (e) {
      console.error('[Database] getEmergencyVisits error:', e);
      return [];
    }
  },

  getEmergencyVisitById: (id: string) => {
    try {
      const r = db.prepare('SELECT * FROM emergency_visits WHERE id = ?').get(id) as any;
      if (!r) return null;
      return {
        ...r,
        isMlc: Boolean(r.isMlc),
        triageVitals: r.triageVitals ? JSON.parse(r.triageVitals) : null,
        mlcData: r.mlcData ? JSON.parse(r.mlcData) : null
      };
    } catch (e) {
      console.error('[Database] getEmergencyVisitById error:', e);
      return null;
    }
  },

  saveEmergencyVisit: (ev: any) => {
    try {
      const now = new Date().toISOString();
      const id = ev.id || ('ER-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7));
      const existing = db.prepare('SELECT id, emergencyNumber FROM emergency_visits WHERE id = ?').get(id) as any;
      let emergencyNumber = ev.emergencyNumber;
      if (!emergencyNumber && !existing) {
        const year = new Date().getFullYear();
        const countRow = db.prepare("SELECT COUNT(*) as cnt FROM emergency_visits WHERE emergencyNumber LIKE ?").get(`ER-${year}-%`) as any;
        const nextNum = (countRow?.cnt || 0) + 1;
        emergencyNumber = `ER-${year}-${String(nextNum).padStart(4, '0')}`;
      } else if (existing) {
        emergencyNumber = existing.emergencyNumber;
      }

      const triageVitalsStr = ev.triageVitals ? JSON.stringify(ev.triageVitals) : null;
      const mlcDataStr = ev.mlcData ? JSON.stringify(ev.mlcData) : null;

      if (existing) {
        db.prepare(`
          UPDATE emergency_visits SET
            patientId = ?, patientUhid = ?, patientName = ?, patientPhone = ?, patientAge = ?, patientGender = ?,
            triageLevel = ?, triageCategory = ?, chiefComplaint = ?, triageVitals = ?, triageNurseName = ?,
            attendingDoctorId = ?, attendingDoctorName = ?, arrivedAt = ?, disposition = ?, dispositionNotes = ?,
            dischargedAt = ?, admittedBedId = ?, admittedAdmissionId = ?, isMlc = ?, mlcNumber = ?, mlcData = ?, notes = ?, updatedAt = ?
          WHERE id = ?
        `).run(
          ev.patientId || null, ev.patientUhid || null, ev.patientName, ev.patientPhone || null, ev.patientAge || null, ev.patientGender || null,
          ev.triageLevel || 3, ev.triageCategory || 'YELLOW', ev.chiefComplaint, triageVitalsStr, ev.triageNurseName || null,
          ev.attendingDoctorId || null, ev.attendingDoctorName || null, ev.arrivedAt || now, ev.disposition || 'UNDER_TREATMENT',
          ev.dispositionNotes || null, ev.dischargedAt || null, ev.admittedBedId || null, ev.admittedAdmissionId || null,
          ev.isMlc ? 1 : 0, ev.mlcNumber || null, mlcDataStr, ev.notes || null, now, id
        );
      } else {
        db.prepare(`
          INSERT INTO emergency_visits (
            id, emergencyNumber, patientId, patientUhid, patientName, patientPhone, patientAge, patientGender,
            triageLevel, triageCategory, chiefComplaint, triageVitals, triageNurseName, attendingDoctorId,
            attendingDoctorName, arrivedAt, disposition, dispositionNotes, dischargedAt, admittedBedId,
            admittedAdmissionId, isMlc, mlcNumber, mlcData, notes, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, emergencyNumber, ev.patientId || null, ev.patientUhid || null, ev.patientName, ev.patientPhone || null, ev.patientAge || null, ev.patientGender || null,
          ev.triageLevel || 3, ev.triageCategory || 'YELLOW', ev.chiefComplaint, triageVitalsStr, ev.triageNurseName || null,
          ev.attendingDoctorId || null, ev.attendingDoctorName || null, ev.arrivedAt || now, ev.disposition || 'UNDER_TREATMENT',
          ev.dispositionNotes || null, ev.dischargedAt || null, ev.admittedBedId || null, ev.admittedAdmissionId || null,
          ev.isMlc ? 1 : 0, ev.mlcNumber || null, mlcDataStr, ev.notes || null, now, now
        );
      }
      return { success: true, id, emergencyNumber };
    } catch (e) {
      console.error('[Database] saveEmergencyVisit error:', e);
      throw e;
    }
  },

  updateEmergencyDisposition: (id: string, disposition: string, details?: any) => {
    try {
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE emergency_visits SET
          disposition = ?,
          dispositionNotes = ?,
          admittedBedId = ?,
          admittedAdmissionId = ?,
          dischargedAt = ?,
          updatedAt = ?
        WHERE id = ? OR emergencyNumber = ?
      `).run(
        disposition,
        details?.notes || null,
        details?.admittedBedId || null,
        details?.admittedAdmissionId || null,
        disposition === 'DISCHARGED' || disposition === 'LAMA' ? now : null,
        now,
        id,
        id
      );
      return { success: true };
    } catch (e) {
      console.error('[Database] updateEmergencyDisposition error:', e);
      throw e;
    }
  },

  // ── Medico-Legal Cases (MLC) Registry Methods ───────────────────────────────
  getMlcRecords: () => {
    try {
      return db.prepare('SELECT * FROM mlc_records ORDER BY createdAt DESC').all().map((r: any) => ({
        ...r,
        alcoholSmellDetected: Boolean(r.alcoholSmellDetected),
        dyingDeclarationRequired: Boolean(r.dyingDeclarationRequired)
      }));
    } catch (e) {
      console.error('[Database] getMlcRecords error:', e);
      return [];
    }
  },

  getMlcRecordById: (id: string) => {
    try {
      const r = db.prepare('SELECT * FROM mlc_records WHERE id = ?').get(id) as any;
      if (!r) return null;
      return {
        ...r,
        alcoholSmellDetected: Boolean(r.alcoholSmellDetected),
        dyingDeclarationRequired: Boolean(r.dyingDeclarationRequired)
      };
    } catch (e) {
      console.error('[Database] getMlcRecordById error:', e);
      return null;
    }
  },

  saveMlcRecord: (mlc: any) => {
    try {
      const now = new Date().toISOString();
      const id = mlc.id || ('MLC-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7));
      const existing = db.prepare('SELECT id, mlcNumber FROM mlc_records WHERE id = ?').get(id) as any;
      let mlcNumber = mlc.mlcNumber;
      if (!mlcNumber && !existing) {
        const year = new Date().getFullYear();
        const countRow = db.prepare("SELECT COUNT(*) as cnt FROM mlc_records WHERE mlcNumber LIKE ?").get(`MLC-${year}-%`) as any;
        const nextNum = (countRow?.cnt || 0) + 1;
        mlcNumber = `MLC-${year}-${String(nextNum).padStart(4, '0')}`;
      } else if (existing) {
        mlcNumber = existing.mlcNumber;
      }

      if (existing) {
        db.prepare(`
          UPDATE mlc_records SET
            emergencyVisitId = ?, patientId = ?, patientName = ?, patientAge = ?, patientGender = ?,
            policeStation = ?, policeOfficerName = ?, policeBadgeNumber = ?, incidentDate = ?,
            incidentPlace = ?, incidentType = ?, broughtByName = ?, broughtByPhone = ?, broughtByRelation = ?,
            injuryDescription = ?, injuryType = ?, weaponType = ?, alcoholSmellDetected = ?,
            dyingDeclarationRequired = ?, intimationSentAt = ?, certificateIssuedAt = ?,
            doctorSignatureName = ?, status = ?, updatedAt = ?
          WHERE id = ?
        `).run(
          mlc.emergencyVisitId || null, mlc.patientId || null, mlc.patientName, mlc.patientAge || null, mlc.patientGender || null,
          mlc.policeStation, mlc.policeOfficerName || null, mlc.policeBadgeNumber || null, mlc.incidentDate,
          mlc.incidentPlace || null, mlc.incidentType || 'RTA', mlc.broughtByName, mlc.broughtByPhone || null, mlc.broughtByRelation || null,
          mlc.injuryDescription, mlc.injuryType || 'SIMPLE', mlc.weaponType || null, mlc.alcoholSmellDetected ? 1 : 0,
          mlc.dyingDeclarationRequired ? 1 : 0, mlc.intimationSentAt || null, mlc.certificateIssuedAt || null,
          mlc.doctorSignatureName, mlc.status || 'REGISTERED', now, id
        );
      } else {
        db.prepare(`
          INSERT INTO mlc_records (
            id, mlcNumber, emergencyVisitId, patientId, patientName, patientAge, patientGender,
            policeStation, policeOfficerName, policeBadgeNumber, incidentDate, incidentPlace, incidentType,
            broughtByName, broughtByPhone, broughtByRelation, injuryDescription, injuryType, weaponType,
            alcoholSmellDetected, dyingDeclarationRequired, intimationSentAt, certificateIssuedAt,
            doctorSignatureName, status, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, mlcNumber, mlc.emergencyVisitId || null, mlc.patientId || null, mlc.patientName, mlc.patientAge || null, mlc.patientGender || null,
          mlc.policeStation, mlc.policeOfficerName || null, mlc.policeBadgeNumber || null, mlc.incidentDate, mlc.incidentPlace || null, mlc.incidentType || 'RTA',
          mlc.broughtByName, mlc.broughtByPhone || null, mlc.broughtByRelation || null, mlc.injuryDescription, mlc.injuryType || 'SIMPLE', mlc.weaponType || null,
          mlc.alcoholSmellDetected ? 1 : 0, mlc.dyingDeclarationRequired ? 1 : 0, mlc.intimationSentAt || null, mlc.certificateIssuedAt || null,
          mlc.doctorSignatureName, mlc.status || 'REGISTERED', now, now
        );
      }

      if (mlc.emergencyVisitId) {
        db.prepare('UPDATE emergency_visits SET isMlc = 1, mlcNumber = ?, updatedAt = ? WHERE id = ?').run(mlcNumber, now, mlc.emergencyVisitId);
      }

      return { success: true, id: mlc.id, mlcNumber };
    } catch (e) {
      console.error('[Database] saveMlcRecord error:', e);
      throw e;
    }
  },

  getEmergencyDashboardMetrics: () => {
    try {
      const activeVisits = db.prepare("SELECT COUNT(*) as c FROM emergency_visits WHERE disposition = 'UNDER_TREATMENT'").get() as any;
      const redCases = db.prepare("SELECT COUNT(*) as c FROM emergency_visits WHERE disposition = 'UNDER_TREATMENT' AND triageLevel = 1").get() as any;
      const orangeCases = db.prepare("SELECT COUNT(*) as c FROM emergency_visits WHERE disposition = 'UNDER_TREATMENT' AND triageLevel = 2").get() as any;
      const yellowCases = db.prepare("SELECT COUNT(*) as c FROM emergency_visits WHERE disposition = 'UNDER_TREATMENT' AND triageLevel = 3").get() as any;
      const greenBlueCases = db.prepare("SELECT COUNT(*) as c FROM emergency_visits WHERE disposition = 'UNDER_TREATMENT' AND triageLevel >= 4").get() as any;
      const totalMlc = db.prepare("SELECT COUNT(*) as c FROM mlc_records").get() as any;
      return {
        activeVisits: activeVisits?.c || 0,
        redResuscitation: redCases?.c || 0,
        orangeEmergent: orangeCases?.c || 0,
        yellowUrgent: yellowCases?.c || 0,
        greenNonUrgent: greenBlueCases?.c || 0,
        totalMlcCases: totalMlc?.c || 0
      };
    } catch (e) {
      console.error('[Database] getEmergencyDashboardMetrics error:', e);
      return { activeVisits: 0, redResuscitation: 0, orangeEmergent: 0, yellowUrgent: 0, greenNonUrgent: 0, totalMlcCases: 0 };
    }
  },

  // ── Module 3: Doctor Revenue Share & Payouts Engine ────────────────────────
  getDoctorCommissionRules: () => {
    try {
      return db.prepare('SELECT * FROM doctor_commission_rules ORDER BY doctorName ASC').all();
    } catch (e) {
      console.error('[Database] getDoctorCommissionRules error:', e);
      return [];
    }
  },

  getDoctorCommissionRuleByDoctorId: (doctorId: string) => {
    try {
      return db.prepare('SELECT * FROM doctor_commission_rules WHERE doctorId = ?').get(doctorId) || null;
    } catch (e) {
      console.error('[Database] getDoctorCommissionRuleByDoctorId error:', e);
      return null;
    }
  },

  saveDoctorCommissionRule: (rule: any) => {
    try {
      const now = new Date().toISOString();
      const existing = db.prepare('SELECT id FROM doctor_commission_rules WHERE doctorId = ?').get(rule.doctorId) as any;
      if (existing) {
        db.prepare(`
          UPDATE doctor_commission_rules
          SET doctorName = ?, opdType = ?, opdValue = ?, ipdVisitRate = ?, surgerySharePercent = ?,
              assistantSurgeonPercent = ?, anesthetistPercent = ?, labReferralPercent = ?,
              pharmacyReferralPercent = ?, tdsPercent = ?, hospitalFacilityRetentionPercent = ?,
              isActive = ?, updatedAt = ?
          WHERE doctorId = ?
        `).run(
          rule.doctorName, rule.opdType || 'PERCENT', rule.opdValue ?? 70, rule.ipdVisitRate ?? 800,
          rule.surgerySharePercent ?? 60, rule.assistantSurgeonPercent ?? 15, rule.anesthetistPercent ?? 25,
          rule.labReferralPercent ?? 10, rule.pharmacyReferralPercent ?? 0, rule.tdsPercent ?? 10,
          rule.hospitalFacilityRetentionPercent ?? 0, rule.isActive ?? 1, now, rule.doctorId
        );
        return { success: true, id: existing.id };
      } else {
        const id = rule.id || `COMM-${Date.now()}`;
        db.prepare(`
          INSERT INTO doctor_commission_rules (
            id, doctorId, doctorName, opdType, opdValue, ipdVisitRate, surgerySharePercent,
            assistantSurgeonPercent, anesthetistPercent, labReferralPercent, pharmacyReferralPercent,
            tdsPercent, hospitalFacilityRetentionPercent, isActive, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, rule.doctorId, rule.doctorName, rule.opdType || 'PERCENT', rule.opdValue ?? 70,
          rule.ipdVisitRate ?? 800, rule.surgerySharePercent ?? 60, rule.assistantSurgeonPercent ?? 15,
          rule.anesthetistPercent ?? 25, rule.labReferralPercent ?? 10, rule.pharmacyReferralPercent ?? 0,
          rule.tdsPercent ?? 10, rule.hospitalFacilityRetentionPercent ?? 0, rule.isActive ?? 1, now, now
        );
        return { success: true, id };
      }
    } catch (e) {
      console.error('[Database] saveDoctorCommissionRule error:', e);
      throw e;
    }
  },

  calculateDoctorAccruedEarnings: (doctorId: string, startDate?: string, endDate?: string) => {
    try {
      const doc = db.prepare('SELECT * FROM doctors WHERE id = ?').get(doctorId) as any;
      if (!doc) return null;

      const rule = (db.prepare('SELECT * FROM doctor_commission_rules WHERE doctorId = ?').get(doctorId) || {
        opdType: 'PERCENT',
        opdValue: 70,
        ipdVisitRate: 800,
        surgerySharePercent: 60,
        assistantSurgeonPercent: 15,
        anesthetistPercent: 25,
        labReferralPercent: 10,
        tdsPercent: 10,
        hospitalFacilityRetentionPercent: 0
      }) as any;

      // 1. OPD Receipts
      let opdQuery = 'SELECT total FROM receipts WHERE doctorId = ?';
      const opdParams: any[] = [doctorId];
      if (startDate) { opdQuery += ' AND date >= ?'; opdParams.push(startDate); }
      if (endDate) { opdQuery += ' AND date <= ?'; opdParams.push(endDate); }
      const opdReceipts = db.prepare(opdQuery).all(...opdParams) as any[];
      const opdRevenue = opdReceipts.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
      const opdEarnings = rule.opdType === 'FLAT'
        ? opdReceipts.length * (Number(rule.opdValue) || 0)
        : (opdRevenue * ((Number(rule.opdValue) || 70) / 100));

      // 2. IPD Bed Rounds
      const ipdQuery = 'SELECT admittedAt, dischargedAt, wardChargesLog FROM bed_admissions WHERE doctorId = ?';
      const ipdParams: any[] = [doctorId];
      const ipdAdmissions = db.prepare(ipdQuery).all(...ipdParams) as any[];
      let ipdVisitsCount = 0;
      ipdAdmissions.forEach(adm => {
        try {
          const admDate = adm.admittedAt ? adm.admittedAt.split('T')[0] : '';
          if (startDate && admDate < startDate) return;
          if (endDate && admDate > endDate) return;
          ipdVisitsCount += 1;
        } catch (_) {}
      });
      const ipdEarnings = ipdVisitsCount * (Number(rule.ipdVisitRate) || 0);

      // 3. Surgical Cases (OT)
      let surgQuery = "SELECT chargesLogged, primarySurgeonId, assistantSurgeonName, anesthetistName FROM surgical_cases WHERE status IN ('COMPLETED', 'IN_THEATRE')";
      const surgParams: any[] = [];
      if (startDate) { surgQuery += ' AND scheduledDate >= ?'; surgParams.push(startDate); }
      if (endDate) { surgQuery += ' AND scheduledDate <= ?'; surgParams.push(endDate); }
      const surgicalCases = db.prepare(surgQuery).all(...surgParams) as any[];
      let surgeryEarnings = 0;
      let surgeryCount = 0;
      surgicalCases.forEach(sc => {
        let fee = 0;
        try {
          if (sc.chargesLogged) {
            const parsed = typeof sc.chargesLogged === 'string' ? JSON.parse(sc.chargesLogged) : sc.chargesLogged;
            if (Array.isArray(parsed)) {
              fee = parsed.reduce((sum: number, c: any) => sum + (Number(c.amount) || (Number(c.rate) * Number(c.quantity || 1)) || 0), 0);
            }
          }
        } catch (_) {}
        if (sc.primarySurgeonId === doctorId) {
          surgeryEarnings += fee * ((Number(rule.surgerySharePercent) || 60) / 100);
          surgeryCount += 1;
        } else if (sc.assistantSurgeonName === doc.name) {
          surgeryEarnings += fee * ((Number(rule.assistantSurgeonPercent) || 15) / 100);
          surgeryCount += 1;
        } else if (sc.anesthetistName === doc.name) {
          surgeryEarnings += fee * ((Number(rule.anesthetistPercent) || 25) / 100);
          surgeryCount += 1;
        }
      });

      // 4. Diagnostic Lab Referral Orders
      let labQuery = "SELECT totalAmount FROM lab_orders WHERE doctorId = ? AND status = 'COMPLETED'";
      const labParams: any[] = [doctorId];
      if (startDate) { labQuery += ' AND orderDate >= ?'; labParams.push(startDate); }
      if (endDate) { labQuery += ' AND orderDate <= ?'; labParams.push(endDate); }
      const labOrders = db.prepare(labQuery).all(...labParams) as any[];
      const labRevenue = labOrders.reduce((sum, l) => sum + (Number(l.totalAmount) || 0), 0);
      const labEarnings = labRevenue * ((Number(rule.labReferralPercent) || 10) / 100);

      // 5. Total Gross & Deductions
      const grossEarnings = Number((opdEarnings + ipdEarnings + surgeryEarnings + labEarnings).toFixed(2));
      const tdsDeduction = Number((grossEarnings * ((Number(rule.tdsPercent) || 10) / 100)).toFixed(2));
      const hospitalFacilityDeduction = Number((grossEarnings * ((Number(rule.hospitalFacilityRetentionPercent) || 0) / 100)).toFixed(2));
      const netPayable = Math.max(0, Number((grossEarnings - tdsDeduction - hospitalFacilityDeduction).toFixed(2)));

      // 6. Existing Payouts for this Doctor
      const paidTx = db.prepare("SELECT SUM(netPayoutAmount) as totalPaid FROM doctor_payout_transactions WHERE doctorId = ? AND status = 'PAID'").get(doctorId) as any;
      const totalPaidAlready = Number(paidTx?.totalPaid) || 0;

      return {
        doctorId,
        doctorName: doc.name,
        periodStart: startDate || 'All Time',
        periodEnd: endDate || 'Present',
        opdReceiptsCount: opdReceipts.length,
        opdRevenue,
        opdEarnings: Number(opdEarnings.toFixed(2)),
        ipdVisitsCount,
        ipdEarnings: Number(ipdEarnings.toFixed(2)),
        surgeryCount,
        surgeryEarnings: Number(surgeryEarnings.toFixed(2)),
        labOrdersCount: labOrders.length,
        labRevenue,
        labEarnings: Number(labEarnings.toFixed(2)),
        grossEarnings,
        tdsDeduction,
        hospitalFacilityDeduction,
        netPayable,
        totalPaidAlready,
        balanceOutstanding: Math.max(0, Number((netPayable - totalPaidAlready).toFixed(2))),
        rule
      };
    } catch (e) {
      console.error('[Database] calculateDoctorAccruedEarnings error:', e);
      return null;
    }
  },

  getDoctorPayoutTransactions: (doctorId?: string) => {
    try {
      if (doctorId) {
        return db.prepare('SELECT * FROM doctor_payout_transactions WHERE doctorId = ? ORDER BY payoutDate DESC, createdAt DESC').all(doctorId);
      }
      return db.prepare('SELECT * FROM doctor_payout_transactions ORDER BY payoutDate DESC, createdAt DESC').all();
    } catch (e) {
      console.error('[Database] getDoctorPayoutTransactions error:', e);
      return [];
    }
  },

  saveDoctorPayoutTransaction: (payout: any) => {
    try {
      const now = new Date().toISOString();
      const count = (db.prepare('SELECT COUNT(*) as c FROM doctor_payout_transactions').get() as any).c + 1;
      const payoutNumber = payout.payoutNumber || `PAY-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
      const id = payout.id || `PAYOUT-${Date.now()}`;

      db.prepare(`
        INSERT INTO doctor_payout_transactions (
          id, payoutNumber, doctorId, doctorName, periodStart, periodEnd,
          opdConsultationEarnings, ipdVisitsEarnings, surgeryEarnings, labReferralEarnings,
          grossEarnings, tdsDeduction, hospitalFacilityDeduction, otherDeductions,
          netPayoutAmount, paymentMode, paymentReference, status, notes, payoutDate,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, payoutNumber, payout.doctorId, payout.doctorName, payout.periodStart, payout.periodEnd,
        payout.opdConsultationEarnings || 0, payout.ipdVisitsEarnings || 0, payout.surgeryEarnings || 0,
        payout.labReferralEarnings || 0, payout.grossEarnings || 0, payout.tdsDeduction || 0,
        payout.hospitalFacilityDeduction || 0, payout.otherDeductions || 0, payout.netPayoutAmount || 0,
        payout.paymentMode || 'BANK_TRANSFER', payout.paymentReference || null, payout.status || 'PAID',
        payout.notes || null, payout.payoutDate || now.split('T')[0], now, now
      );

      return { success: true, id, payoutNumber };
    } catch (e) {
      console.error('[Database] saveDoctorPayoutTransaction error:', e);
      throw e;
    }
  },

  // ── Module 3: Hospital Ward & OT to Pharmacy Stock Indenting ───────────────
  getHospitalIndents: (filter?: any) => {
    try {
      let query = 'SELECT * FROM hospital_indents WHERE 1=1';
      const params: any[] = [];
      if (filter?.status && filter.status !== 'ALL') {
        query += ' AND status = ?';
        params.push(filter.status);
      }
      if (filter?.departmentType && filter.departmentType !== 'ALL') {
        query += ' AND departmentType = ?';
        params.push(filter.departmentType);
      }
      if (filter?.priority && filter.priority !== 'ALL') {
        query += ' AND priority = ?';
        params.push(filter.priority);
      }
      query += ' ORDER BY requestedAt DESC';
      const indents = db.prepare(query).all(...params) as any[];

      const getItemStmt = db.prepare('SELECT * FROM hospital_indent_items WHERE indentId = ?');
      return indents.map(ind => ({
        ...ind,
        items: getItemStmt.all(ind.id)
      }));
    } catch (e) {
      console.error('[Database] getHospitalIndents error:', e);
      return [];
    }
  },

  getHospitalIndentById: (id: string) => {
    try {
      const indent = db.prepare('SELECT * FROM hospital_indents WHERE id = ?').get(id) as any;
      if (!indent) return null;
      const items = db.prepare('SELECT * FROM hospital_indent_items WHERE indentId = ?').all(id);
      return { ...indent, items };
    } catch (e) {
      console.error('[Database] getHospitalIndentById error:', e);
      return null;
    }
  },

  saveHospitalIndent: (indent: any, items: any[]) => {
    try {
      const now = new Date().toISOString();
      const count = (db.prepare('SELECT COUNT(*) as c FROM hospital_indents').get() as any).c + 1;
      const indentNumber = indent.indentNumber || `IND-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
      const indentId = indent.id || `IND-${Date.now()}`;

      const insertIndent = db.transaction(() => {
        db.prepare(`
          INSERT INTO hospital_indents (
            id, indentNumber, departmentType, sourceLocation, targetDepartment,
            requestedBy, priority, status, notes, requestedAt, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          indentId, indentNumber, indent.departmentType || 'WARD', indent.sourceLocation || 'General Ward',
          indent.targetDepartment || 'PHARMACY', indent.requestedBy || 'Staff Nurse',
          indent.priority || 'ROUTINE', 'PENDING', indent.notes || null, now, now, now
        );

        const insertItem = db.prepare(`
          INSERT INTO hospital_indent_items (
            id, indentId, medicineId, itemName, itemCategory, requestedQuantity, issuedQuantity, batchNumber, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        if (Array.isArray(items)) {
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            insertItem.run(
              it.id || `ITEM-${Date.now()}-${i}`,
              indentId,
              it.medicineId || null,
              it.itemName,
              it.itemCategory || 'Medicine',
              Number(it.requestedQuantity) || 1,
              0,
              null,
              it.notes || null
            );
          }
        }
      });

      insertIndent();
      return { success: true, id: indentId, indentNumber };
    } catch (e) {
      console.error('[Database] saveHospitalIndent error:', e);
      throw e;
    }
  },

  issueHospitalIndent: (indentId: string, itemsIssued: any[], fulfilledBy: string) => {
    try {
      const now = new Date().toISOString();
      const executeIssue = db.transaction(() => {
        const updateItemStmt = db.prepare(`
          UPDATE hospital_indent_items
          SET issuedQuantity = ?, batchNumber = ?
          WHERE id = ?
        `);

        // Atomic decrement from pharmacy batches if batchNumber is provided
        const decrementBatchStmt = db.prepare(`
          UPDATE medicine_batches
          SET quantity = MAX(0, quantity - ?)
          WHERE batchNumber = ? AND medicineId = ?
        `);

        const decrementMasterStmt = db.prepare(`
          UPDATE medicines
          SET minStockAlert = minStockAlert
          WHERE id = ?
        `);

        for (const it of itemsIssued) {
          updateItemStmt.run(Number(it.issuedQuantity) || 0, it.batchNumber || null, it.itemId);

          if (it.medicineId && it.batchNumber && Number(it.issuedQuantity) > 0) {
            decrementBatchStmt.run(Number(it.issuedQuantity), it.batchNumber, it.medicineId);
            decrementMasterStmt.run(it.medicineId);
          }
        }

        // Determine if all items are fully issued or partially issued
        const allItems = db.prepare('SELECT requestedQuantity, issuedQuantity FROM hospital_indent_items WHERE indentId = ?').all(indentId) as any[];
        const totalReq = allItems.reduce((s, i) => s + (Number(i.requestedQuantity) || 0), 0);
        const totalIss = allItems.reduce((s, i) => s + (Number(i.issuedQuantity) || 0), 0);

        const newStatus = totalIss >= totalReq ? 'COMPLETED' : totalIss > 0 ? 'PARTIALLY_ISSUED' : 'PENDING';

        db.prepare(`
          UPDATE hospital_indents
          SET status = ?, fulfilledAt = ?, fulfilledBy = ?, updatedAt = ?
          WHERE id = ?
        `).run(newStatus, now, fulfilledBy || 'Pharmacist In-Charge', now, indentId);
      });

      executeIssue();
      return { success: true, id: indentId };
    } catch (e) {
      console.error('[Database] issueHospitalIndent error:', e);
      throw e;
    }
  },

  completeHospitalIndent: (indentId: string, fulfilledBy?: string) => {
    try {
      const now = new Date().toISOString();
      const execute = db.transaction(() => {
        // Mark all items as issued with full requested quantity
        db.prepare(`
          UPDATE hospital_indent_items
          SET issuedQuantity = requestedQuantity,
              batchNumber = COALESCE(batchNumber, 'DIRECT-DISPATCH')
          WHERE indentId = ?
        `).run(indentId);

        // Update indent status to COMPLETED
        db.prepare(`
          UPDATE hospital_indents
          SET status = 'COMPLETED', fulfilledAt = ?, fulfilledBy = ?, updatedAt = ?
          WHERE id = ?
        `).run(now, fulfilledBy || 'Pharmacist In-Charge', now, indentId);
      });
      execute();
      return { success: true, id: indentId };
    } catch (e) {
      console.error('[Database] completeHospitalIndent error:', e);
      throw e;
    }
  },

  cancelHospitalIndent: (indentId: string, reason?: string) => {
    try {
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE hospital_indents
        SET status = 'CANCELLED', notes = COALESCE(notes || ' - ' || ?, ?), updatedAt = ?
        WHERE id = ?
      `).run(reason || 'Cancelled by staff', reason || 'Cancelled by staff', now, indentId);
      return { success: true, id: indentId };
    } catch (e) {
      console.error('[Database] cancelHospitalIndent error:', e);
      throw e;
    }
  },

  getHospitalTier3Metrics: () => {
    try {
      const totalPayouts = db.prepare("SELECT SUM(netPayoutAmount) as total, COUNT(*) as count FROM doctor_payout_transactions WHERE status = 'PAID'").get() as any;
      const pendingIndents = db.prepare("SELECT COUNT(*) as count FROM hospital_indents WHERE status = 'PENDING'").get() as any;
      const completedIndents = db.prepare("SELECT COUNT(*) as count FROM hospital_indents WHERE status = 'COMPLETED'").get() as any;
      const activeDoctorsWithRules = db.prepare('SELECT COUNT(*) as count FROM doctor_commission_rules WHERE isActive = 1').get() as any;

      return {
        totalDoctorPayoutsAmount: Number(totalPayouts?.total) || 0,
        totalDoctorPayoutsCount: Number(totalPayouts?.count) || 0,
        pendingIndentsCount: Number(pendingIndents?.count) || 0,
        completedIndentsCount: Number(completedIndents?.count) || 0,
        activeDoctorsConfigured: Number(activeDoctorsWithRules?.count) || 0
      };
    } catch (e) {
      console.error('[Database] getHospitalTier3Metrics error:', e);
      return {
        totalDoctorPayoutsAmount: 0,
        totalDoctorPayoutsCount: 0,
        pendingIndentsCount: 0,
        completedIndentsCount: 0,
        activeDoctorsConfigured: 0
      };
    }
  },

  // ── Unified Global Patient Lookup & Smart Prefill Across All Departments ────
  searchGlobalPatients: (query: string) => {
    try {
      if (!query || !query.trim()) return [];
      const q = `%${query.trim()}%`;
      const patientsMap = new Map<string, any>();

      // 1. Search in receipts
      const receiptRows = db.prepare(`
        SELECT patientId, patientName, patientPhone, patientAge, patientGender, doctorName, date as lastVisitDate
        FROM receipts
        WHERE patientName LIKE ? OR patientPhone LIKE ? OR patientId LIKE ?
        ORDER BY date DESC, rowid DESC
        LIMIT 25
      `).all(q, q, q) as any[];

      receiptRows.forEach(r => {
        const key = (r.patientPhone?.trim() || r.patientId?.trim() || r.patientName.trim()).toLowerCase();
        if (!patientsMap.has(key)) {
          patientsMap.set(key, {
            patientId: r.patientId || '',
            patientUhid: r.patientId || '',
            patientName: r.patientName,
            patientPhone: r.patientPhone || '',
            patientAge: r.patientAge || '',
            patientGender: r.patientGender || '',
            lastVisitDate: r.lastVisitDate,
            previousDoctorName: r.doctorName || '',
            source: 'OPD'
          });
        }
      });

      // 2. Search in bed admissions
      const admissionRows = db.prepare(`
        SELECT patientId, patientUhid, patientName, patientPhone, patientAge, patientGender, doctorName, admittedAt as lastVisitDate, diagnosis
        FROM bed_admissions
        WHERE patientName LIKE ? OR patientPhone LIKE ? OR patientUhid LIKE ? OR patientId LIKE ?
        ORDER BY admittedAt DESC, createdAt DESC
        LIMIT 25
      `).all(q, q, q, q) as any[];

      admissionRows.forEach(a => {
        const key = (a.patientPhone?.trim() || a.patientUhid?.trim() || a.patientId?.trim() || a.patientName.trim()).toLowerCase();
        if (!patientsMap.has(key)) {
          patientsMap.set(key, {
            patientId: a.patientId || a.patientUhid || '',
            patientUhid: a.patientUhid || a.patientId || '',
            patientName: a.patientName,
            patientPhone: a.patientPhone || '',
            patientAge: a.patientAge || '',
            patientGender: a.patientGender || '',
            lastVisitDate: a.lastVisitDate ? a.lastVisitDate.split('T')[0] : '',
            previousDoctorName: a.doctorName || '',
            recentDiagnosis: a.diagnosis || '',
            source: 'IPD'
          });
        }
      });

      // 3. Search in emergency visits
      const emergencyRows = db.prepare(`
        SELECT patientId, patientUhid, patientName, patientPhone, patientAge, patientGender, attendingDoctorName as doctorName, arrivedAt as lastVisitDate, chiefComplaint
        FROM emergency_visits
        WHERE patientName LIKE ? OR patientPhone LIKE ? OR patientUhid LIKE ?
        ORDER BY arrivedAt DESC, createdAt DESC
        LIMIT 25
      `).all(q, q, q) as any[];

      emergencyRows.forEach(e => {
        const key = (e.patientPhone?.trim() || e.patientUhid?.trim() || e.patientName.trim()).toLowerCase();
        if (!patientsMap.has(key)) {
          patientsMap.set(key, {
            patientId: e.patientId || e.patientUhid || '',
            patientUhid: e.patientUhid || e.patientId || '',
            patientName: e.patientName,
            patientPhone: e.patientPhone || '',
            patientAge: e.patientAge || '',
            patientGender: e.patientGender || '',
            lastVisitDate: e.lastVisitDate ? e.lastVisitDate.split('T')[0] : '',
            previousDoctorName: e.doctorName || '',
            recentDiagnosis: e.chiefComplaint || '',
            source: 'EMERGENCY'
          });
        }
      });

      // 4. Search in appointments
      const appointmentRows = db.prepare(`
        SELECT patientName, patientPhone, patientAge, patientGender, doctorName, appointmentDate as lastVisitDate
        FROM appointments
        WHERE patientName LIKE ? OR patientPhone LIKE ?
        ORDER BY appointmentDate DESC
        LIMIT 25
      `).all(q, q) as any[];

      appointmentRows.forEach(apt => {
        const key = (apt.patientPhone?.trim() || apt.patientName.trim()).toLowerCase();
        if (!patientsMap.has(key)) {
          patientsMap.set(key, {
            patientId: '',
            patientUhid: '',
            patientName: apt.patientName,
            patientPhone: apt.patientPhone || '',
            patientAge: apt.patientAge || '',
            patientGender: apt.patientGender || '',
            lastVisitDate: apt.lastVisitDate,
            previousDoctorName: apt.doctorName || '',
            source: 'APPOINTMENT'
          });
        }
      });

      return Array.from(patientsMap.values()).slice(0, 20);
    } catch (e) {
      console.error('[Database] searchGlobalPatients error:', e);
      return [];
    }
  }
};
