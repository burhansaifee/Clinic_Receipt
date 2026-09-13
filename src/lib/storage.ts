import { format } from 'date-fns';

export interface Doctor {
  id: string;
  name: string;
  specialization: string;
  qualifications: string;
  phone: string;
  address: string;
  printHeader?: boolean;
  customTopMargin?: number;
  customBottomMargin?: number;
  upiId?: string;
  qrCodeText?: string;
  showQrCodeOnReceipt?: boolean;
  chamber?: string;
  receiptPrefix?: string;
  availableDays?: string[];
  timeSlots?: string[];
  consultationTimings?: string;
}

export const getDoctorReceiptPrefix = (doctor?: Partial<Doctor> | null, doctorNameFallback?: string): string => {
  if (doctor?.receiptPrefix && doctor.receiptPrefix.trim()) {
    return doctor.receiptPrefix.trim().toUpperCase();
  }
  const rawName = (doctor?.name || doctorNameFallback || '').trim();
  if (!rawName) return 'DOC';
  const clean = rawName.replace(/^(dr\.?|prof\.?|doctor|mr\.?|mrs\.?|ms\.?)\s+/i, '').trim();
  if (!clean) return 'DOC';
  const parts = clean.split(/[\s\-_\.]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0].toUpperCase()}${parts[parts.length - 1][0].toUpperCase()}`;
  } else if (parts.length === 1) {
    const word = parts[0].toUpperCase();
    return word.length >= 2 ? word.slice(0, 2) : `${word}D`;
  }
  return 'DOC';
};

export interface ReceiptItem {
  id: string;
  description: string;
  amount: number;
  category?: string;
  rate?: number;
  quantity?: number;
  unit?: string;
}

export interface Service {
  id: string;
  name: string;
  amount: number;
  category?: string;
  unit?: string;
  serviceType?: 'OPD' | 'FACILITY' | 'ALL';
}

export interface FacilityPreset {
  category: 'Room Rent' | 'Oxygen' | 'Nursing' | 'Doctor Rounds' | 'Equipment' | 'Procedures' | 'Consumables';
  name: string;
  defaultRate: number;
  defaultUnit: string;
}

export const FACILITY_PRESETS: FacilityPreset[] = [
  // Room / Bed
  { category: 'Room Rent', name: 'General Ward Bed', defaultRate: 800, defaultUnit: 'Days' },
  { category: 'Room Rent', name: 'Semi-Private Room', defaultRate: 1500, defaultUnit: 'Days' },
  { category: 'Room Rent', name: 'Deluxe Private Room', defaultRate: 2500, defaultUnit: 'Days' },
  { category: 'Room Rent', name: 'ICU / Critical Care Bed', defaultRate: 4500, defaultUnit: 'Days' },
  { category: 'Room Rent', name: 'Daycare Observation Bed', defaultRate: 600, defaultUnit: 'Hours' },

  // Oxygen
  { category: 'Oxygen', name: 'Medical Oxygen (Hourly)', defaultRate: 150, defaultUnit: 'Hours' },
  { category: 'Oxygen', name: 'Medical Oxygen (24h Flow)', defaultRate: 1200, defaultUnit: 'Days' },
  { category: 'Oxygen', name: 'Oxygen Cylinder Refill', defaultRate: 650, defaultUnit: 'Cylinders' },
  { category: 'Oxygen', name: 'Oxygen Concentrator Usage', defaultRate: 400, defaultUnit: 'Days' },

  // Nursing & Attendant
  { category: 'Nursing', name: 'General Nursing Care (24h)', defaultRate: 500, defaultUnit: 'Days' },
  { category: 'Nursing', name: 'Specialized ICU Nursing', defaultRate: 1000, defaultUnit: 'Days' },
  { category: 'Nursing', name: 'Attendant / DDA Support', defaultRate: 300, defaultUnit: 'Days' },

  // Doctor Rounds
  { category: 'Doctor Rounds', name: 'In-Patient Doctor Daily Round', defaultRate: 600, defaultUnit: 'Visits' },
  { category: 'Doctor Rounds', name: 'Specialist Consultant Visit', defaultRate: 1000, defaultUnit: 'Visits' },
  { category: 'Doctor Rounds', name: 'Emergency RMO Call', defaultRate: 400, defaultUnit: 'Visits' },

  // Equipment & Monitoring
  { category: 'Equipment', name: 'Multipara Vital Monitor', defaultRate: 500, defaultUnit: 'Days' },
  { category: 'Equipment', name: 'Pulse Oximeter & BP Monitor', defaultRate: 200, defaultUnit: 'Days' },
  { category: 'Equipment', name: 'Syringe / Infusion Pump', defaultRate: 350, defaultUnit: 'Days' },
  { category: 'Equipment', name: 'Nebulizer Therapy Session', defaultRate: 150, defaultUnit: 'Sessions' },

  // Procedures & Care
  { category: 'Procedures', name: 'IV Cannulation & Infusion Setup', defaultRate: 250, defaultUnit: 'Procedures' },
  { category: 'Procedures', name: 'Surgical Wound Dressing', defaultRate: 300, defaultUnit: 'Procedures' },
  { category: 'Procedures', name: 'Foley Catheterization', defaultRate: 400, defaultUnit: 'Procedures' },
  { category: 'Procedures', name: 'Ryle Tube Insertion', defaultRate: 450, defaultUnit: 'Procedures' },
  { category: 'Procedures', name: 'ECG Recording & Interpretation', defaultRate: 300, defaultUnit: 'Tests' },
];

export interface Receipt {
  id: string;
  receiptNumber: string;
  date: string;
  patientId?: string;
  patientName: string;
  patientAge: string;
  patientGender: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  items: ReceiptItem[];
  total: number;
  paymentMethod: 'CASH' | 'ONLINE' | 'FREE';
  appointmentId?: string;
  showQrCode?: boolean;
  qrCodeText?: string;
  billType?: 'OPD' | 'FACILITY';
  roomNumber?: string;
  admissionDate?: string;
  dischargeDate?: string;
  advancePaid?: number;
  discount?: number;
}

export const isAdvanceDepositReceipt = (receipt?: Partial<Receipt> | null): boolean => {
  if (!receipt) return false;
  if (receipt.billType !== 'FACILITY') return false;
  const items = receipt.items || [];
  return items.some(i => {
    const desc = (i.description || '').toLowerCase();
    const unit = (i.unit || '').toLowerCase();
    return unit === 'deposit' || desc.includes('advance deposit') || desc.includes('ipd advance');
  });
};

export interface PrescribedMedicine {
  name: string;
  dosage: string;
  duration: string;
  instructions: string;
}

export interface Prescription {
  id: string;
  receiptId?: string;
  patientId?: string;
  receiptNumber?: string;
  pid?: string;
  date: string;
  patientName: string;
  patientAge: string;
  patientGender: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  symptoms: string;
  diagnosis: string;
  medicines: PrescribedMedicine[];
  labInvestigations?: string[];
  notes: string;
  followUpDate?: string;
  followUpNotes?: string;
}

export type FollowUpStatus = 'PENDING' | 'ATTENDED' | 'MISSED' | 'CANCELLED';

export interface FollowUp {
  id: string;
  prescriptionId?: string;
  receiptId?: string;
  patientId?: string;
  patientName: string;
  patientPhone?: string;
  patientAge?: string;
  patientGender?: string;
  doctorId: string;
  doctorName: string;
  scheduledDate: string; // YYYY-MM-DD
  notes?: string;
  status: FollowUpStatus;
  createdAt: string;
}

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface Appointment {
  id: string;
  patientId?: string;
  patientName: string;
  patientPhone: string;
  patientAge?: string;
  patientGender?: string;
  doctorId: string;
  doctorName: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // e.g. 10:30 AM
  notes?: string;
  rejectionReason?: string;
  source?: 'WHATSAPP' | 'MANUAL';
  status: AppointmentStatus;
  createdAt: string;
}

export interface PatientHistorySummary {
  receipts: Receipt[];
  prescriptions: Prescription[];
  appointments: Appointment[];
  followUps: FollowUp[];
  totalVisits: number;
  totalSpent: number;
  opdCount: number;
  facilityCount: number;
  prescriptionCount: number;
}

export type ExpenseCategory =
  | 'Utilities & Power'
  | 'Medical Supplies'
  | 'Rent & Premises'
  | 'Equipment'
  | 'Marketing & Software'
  | 'Taxes & Licenses'
  | 'Miscellaneous';

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory | string;
  amount: number;
  paidAmount?: number;
  date: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD
  paymentMode?: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD';
  paidTo?: string;
  vendorPhone?: string;
  billNumber?: string;
  isRecurring?: boolean | number;
  status?: 'PAID' | 'PARTIAL' | 'PENDING';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  category: 'Tablet' | 'Capsule' | 'Syrup' | 'Injection' | 'IV Fluid' | 'Ointment' | 'Drops' | 'Inhaler' | 'Surgical' | string;
  manufacturer?: string;
  unit: string;
  hsnCode?: string;
  minStockAlert: number;
  locationRack?: string;
  notes?: string;
  createdAt?: string;
  currentStock?: number;
  minPrice?: number;
  maxPrice?: number;
}

export interface MedicineBatch {
  id: string;
  medicineId: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM
  purchaseRate: number;
  salePrice: number;
  quantity: number;
  createdAt?: string;
  medicineName?: string;
  genericName?: string;
  category?: string;
  unit?: string;
  minStockAlert?: number;
}

export interface PharmacySaleItem {
  medicineId: string;
  batchId?: string;
  batchNumber?: string;
  name: string;
  genericName?: string;
  quantity: number;
  salePrice: number;
  amount: number;
}

export interface PharmacySale {
  id: string;
  saleNumber: string;
  patientId?: string;
  patientName: string;
  patientPhone?: string;
  prescriptionId?: string;
  date: string;
  items: PharmacySaleItem[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  paymentMethod: 'CASH' | 'ONLINE' | 'FREE';
  dispensedBy?: string;
  notes?: string;
}

export interface PharmacyDashboardMetrics {
  totalInventoryValue: number;
  totalCostValue: number;
  totalUnits: number;
  totalMedicines: number;
  lowStockCount: number;
  expiringCount: number;
  todaySales: number;
  todaySalesCount: number;
}

export interface Ward {
  id: string;
  name: string;
  code: string;
  floor: string;
  dailyRate: number;
  nursingRate: number;
  totalBeds: number;
  description?: string;
  isActive?: boolean | number;
  createdAt?: string;
  updatedAt?: string;
  totalBedsCount?: number;
  occupiedBedsCount?: number;
  availableBedsCount?: number;
}

export interface HospitalBed {
  id: string;
  wardId: string;
  bedNumber: string;
  bedType: string;
  dailyRate: number;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance';
  currentAdmissionId?: string | null;
  notes?: string;
  updatedAt?: string;
  wardName?: string;
  wardCode?: string;
  wardFloor?: string;
  // Attached admission particulars if occupied
  admissionNumber?: string;
  patientId?: string;
  patientUhid?: string;
  patientName?: string;
  patientPhone?: string;
  patientGender?: string;
  patientAge?: string;
  doctorId?: string;
  doctorName?: string;
  admittedAt?: string;
  diagnosis?: string;
  advancePaid?: number;
  initialVitals?: string;
  vitalsLog?: string;
  wardChargesLog?: string;
}

export interface AdmissionVital {
  id?: string;
  recordedAt?: string;
  bpSystolic?: string | number;
  bpDiastolic?: string | number;
  pulse?: string | number;
  temp?: string | number;
  spo2?: string | number;
  onOxygen?: boolean;
  oxygenFlowRate?: string | number;
  respiratoryRate?: string | number;
  avpu?: 'Alert' | 'Voice' | 'Pain' | 'Unresponsive';
  painScale?: number;
  news2Score?: number;
  news2Risk?: 'LOW' | 'MEDIUM' | 'HIGH';
  bloodSugar?: string | number;
  urineOutput?: string | number;
  fluidIntake?: string | number;
  recordedBy?: string;
  notes?: string;
}

export interface EmarMedicationOrder {
  id: string;
  drugName: string;
  genericName?: string;
  dosage: string;
  route: 'IV' | 'Oral' | 'SC' | 'IM' | 'Topical' | 'Inhalation' | 'Rectal' | 'Sublingual' | 'Other';
  frequency: 'STAT' | 'OD' | 'BD' | 'TDS' | 'QID' | 'Q4H' | 'Q6H' | 'Q8H' | 'Q12H' | 'PRN' | 'Continuous Infusion';
  scheduleTimes: string[];
  startDate: string;
  endDate?: string;
  prescribedBy?: string;
  isHighAlert?: boolean;
  isLasa?: boolean;
  specialInstructions?: string;
  status: 'ACTIVE' | 'DISCONTINUED' | 'COMPLETED';
  createdAt: string;
}

export type EmarOrder = EmarMedicationOrder;

export interface EmarAdministrationRecord {
  id: string;
  orderId: string;
  drugName: string;
  dosageGiven: string;
  routeGiven: string;
  scheduledTime: string;
  administeredAt: string;
  status: 'GIVEN' | 'HELD' | 'REFUSED' | 'MISSED';
  administeredBy: string;
  dualSignOffBy?: string;
  preVitalCheck?: {
    bp?: string;
    pulse?: string;
    sugar?: string;
    spo2?: string;
  };
  reasonOrNotes?: string;
}

export interface FluidIoRecord {
  id: string;
  recordedAt: string;
  type: 'INTAKE' | 'OUTPUT';
  category: 'IV_CRYSTALLOID' | 'IV_COLLOID_BLOOD' | 'ORAL_ENTERAL' | 'URINE' | 'DRAIN' | 'NG_ASPIRATE' | 'VOMITUS' | 'STOOL' | 'OTHER';
  label: string;
  volumeMl: number;
  recordedBy?: string;
  notes?: string;
}

export interface NursingShiftNote {
  id: string;
  recordedAt: string;
  shift: 'MORNING' | 'EVENING' | 'NIGHT';
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  nurseName: string;
  vitalsSummary?: string;
}

export interface AdmissionCharge {
  id: string;
  recordedAt: string;
  category: 'Nursing' | 'Consumable' | 'Procedure' | 'Doctor Round' | 'Equipment / Oxygen' | 'Other';
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  recordedBy?: string;
  notes?: string;
}

export interface BedTransferRecord {
  fromBedId: string;
  fromBedNumber: string;
  fromWardName: string;
  toBedId: string;
  toBedNumber: string;
  toWardName: string;
  transferredAt: string;
  reason?: string;
}

export interface DischargeMedication {
  id: string;
  name: string;
  dosage: string;
  route: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface DischargeSummaryData {
  id?: string;
  admissionId: string;
  primaryDiagnosis: string;
  icd10Code?: string;
  secondaryDiagnosis?: string;
  admissionReason?: string;
  presentingComplaints?: string;
  clinicalHistory?: string;
  examinationOnAdmission?: string;
  hospitalCourse?: string;
  surgicalProcedures?: string;
  dischargeCondition: 'STABLE' | 'IMPROVED' | 'RELIEVED' | 'LAMA' | 'TRANSFERRED' | 'DECEASED';
  dischargeVitals?: {
    bp?: string;
    pulse?: string;
    temp?: string;
    spo2?: string;
    respRate?: string;
  };
  dischargeMedications: DischargeMedication[];
  followUpDate?: string;
  followUpInstructions?: string;
  emergencyRedFlags?: string;
  dietaryInstructions?: string;
  consultantDoctorName?: string;
  rmoName?: string;
  generatedAt?: string;
}

export interface TpaProvider {
  id: string;
  name: string;
  code: string;
  contactEmail?: string;
  contactPhone?: string;
  portalUrl?: string;
  defaultCopayPercent?: number;
  isActive?: boolean | number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InsuranceClaimQuery {
  id: string;
  queryReceivedAt: string;
  queryDetails: string;
  replySentAt?: string;
  replyDetails?: string;
  repliedBy?: string;
}

export type ClaimStatus =
  | 'PREAUTH_DRAFT'
  | 'SUBMITTED'
  | 'QUERY_RAISED'
  | 'INITIAL_APPROVED'
  | 'ENHANCEMENT_REQUESTED'
  | 'FINAL_APPROVED'
  | 'REJECTED'
  | 'SETTLED';

export interface InsuranceClaim {
  id: string;
  claimNumber: string;
  admissionId?: string;
  patientId?: string;
  patientUhid?: string;
  patientName: string;
  patientPhone?: string;
  tpaProviderId: string;
  tpaProviderName: string;
  insurerName: string;
  policyNumber: string;
  cardId?: string;
  corporateName?: string;
  sumInsured?: number;
  initialPreAuthAmount: number;
  approvedAmount: number;
  finalSettledAmount?: number;
  copayPercent: number;
  nonPayableDeductions?: number;
  status: ClaimStatus;
  queriesLog?: string;
  preAuthLetterRef?: string;
  settlementDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InsuranceDashboardMetrics {
  totalClaims: number;
  activeClaims: number;
  pendingApprovals: number;
  approvedTotalAmount: number;
  settledTotalAmount: number;
}

// ── Module 2: Operation Theatre (OT) & Surgical Management Types ─────────────
export type OtTheatreType = 'MAJOR' | 'MINOR' | 'MODULAR' | 'CATH_LAB' | 'DAYCARE';
export type OtStatus = 'AVAILABLE' | 'IN_SURGERY' | 'CLEANING' | 'MAINTENANCE';

export interface OperationTheatre {
  id: string;
  name: string;
  code: string;
  theatreType: OtTheatreType;
  floor?: string;
  dailyRate?: number;
  status: OtStatus;
  isActive: boolean | number;
  createdAt: string;
  updatedAt: string;
}

export type AsaGrade = 'ASA_I' | 'ASA_II' | 'ASA_III' | 'ASA_IV' | 'ASA_V' | 'ASA_E';
export type MallampatiClass = 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IV';

export interface PreAnesthesiaCheckup {
  asaGrade: AsaGrade;
  mallampatiClass: MallampatiClass;
  npoHours: number;
  preOpDiagnosis: string;
  airwayNotes?: string;
  comorbidities?: string;
  preMedications?: string;
  clearanceStatus: 'FIT_FOR_SURGERY' | 'HIGH_RISK' | 'TEMPORARILY_UNFIT';
  pacNotes?: string;
  clearedAt?: string;
  clearedBy?: string;
}

export interface WhoSafetyChecklist {
  signInDone: boolean;
  signIn?: {
    confirmedIdentity?: boolean;
    siteMarked?: boolean;
    anesthesiaSafetyCheck?: boolean;
    pulseOximeter?: boolean;
    allergyRisk?: boolean;
    difficultAirwayRisk?: boolean;
    bloodLossRisk?: boolean;
  };
  timeOutDone: boolean;
  timeOut?: {
    teamIntroduced?: boolean;
    patientNameProcedureConfirmed?: boolean;
    criticalStepsReviewed?: boolean;
    antibioticProphylaxisGiven?: boolean;
    imagingDisplayed?: boolean;
  };
  signOutDone: boolean;
  signOut?: {
    procedureNameRecorded?: boolean;
    countCorrect?: boolean;
    specimenLabeled?: boolean;
    equipmentIssues?: boolean;
    recoveryConcerns?: boolean;
  };
  verifiedBy?: string;
  completedAt?: string;
}

export interface IntraOpRecord {
  anesthesiaType: 'GENERAL' | 'SPINAL' | 'EPIDURAL' | 'REGIONAL_BLOCK' | 'MAC_SEDATION' | 'LOCAL';
  surgicalTechnique?: string;
  findings?: string;
  implantsUsed?: Array<{ name: string; serialNumber?: string; manufacturer?: string; cost?: number }>;
  bloodLossMl?: number;
  fluidsInfusedMl?: number;
  urineOutputMl?: number;
  specimenSent?: boolean;
  specimenDetails?: string;
  complications?: string;
  surgeonNotes?: string;
}

export interface PacuRecord {
  aldreteScore: number;
  activity: number;
  respiration: number;
  circulation: number;
  consciousness: number;
  o2Saturation: number;
  vitalsAtEntry?: { bp: string; pulse: number; spo2: number };
  vitalsAtDischarge?: { bp: string; pulse: number; spo2: number };
  transferredTo?: 'ICU' | 'WARD' | 'DAYCARE_DISCHARGE';
  dischargeReady: boolean;
  pacuNurseNotes?: string;
  admittedToPacuAt?: string;
  dischargedFromPacuAt?: string;
}

export type SurgicalUrgency = 'ELECTIVE' | 'URGENT' | 'EMERGENCY';
export type SurgicalCaseStatus = 'SCHEDULED' | 'PREOP_PAC' | 'IN_THEATRE' | 'RECOVERY_PACU' | 'COMPLETED' | 'CANCELLED';

export interface SurgicalCase {
  id: string;
  caseNumber: string;
  patientId?: string;
  patientUhid?: string;
  patientName: string;
  patientPhone?: string;
  patientAge?: string;
  patientGender?: string;
  admissionId?: string;
  theatreId: string;
  theatreName: string;
  surgeryName: string;
  surgeryCategory?: string;
  urgency: SurgicalUrgency;
  primarySurgeonId: string;
  primarySurgeonName: string;
  assistantSurgeonName?: string;
  anesthetistName?: string;
  scrubNurseName?: string;
  circulatingNurseName?: string;
  scheduledDate: string;
  startTime: string;
  endTime?: string;
  status: SurgicalCaseStatus;
  pacData?: PreAnesthesiaCheckup;
  whoChecklistData?: WhoSafetyChecklist;
  intraOpNotes?: IntraOpRecord;
  pacuData?: PacuRecord;
  chargesLogged?: Array<{ id: string; name: string; rate: number; quantity: number; amount: number }>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OtDashboardMetrics {
  totalTheatres: number;
  todayCases: number;
  inSurgery: number;
  inPacu: number;
  completedSurgeries: number;
}

// ── Module 2: Emergency Department & Casualty Triage Types ───────────────────
export type TriageLevel = 1 | 2 | 3 | 4 | 5;
export type TriageCategory = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'BLUE';
export type EmergencyDisposition = 'UNDER_TREATMENT' | 'ADMITTED_IPD' | 'TRANSFERRED_OT' | 'DISCHARGED' | 'LAMA' | 'REFERRED' | 'BROUGHT_DEAD';

export interface TriageVitals {
  bpSystolic?: number;
  bpDiastolic?: number;
  heartRate?: number;
  respRate?: number;
  spo2?: number;
  temperature?: number;
  gcsEye?: number;
  gcsVerbal?: number;
  gcsMotor?: number;
  gcsTotal?: number;
  shockIndex?: number;
}

export interface EmergencyVisit {
  id: string;
  emergencyNumber: string;
  patientId?: string;
  patientUhid?: string;
  patientName: string;
  patientPhone?: string;
  patientAge?: string;
  patientGender?: string;
  triageLevel: TriageLevel;
  triageCategory: TriageCategory;
  chiefComplaint: string;
  triageVitals?: TriageVitals;
  triageNurseName?: string;
  attendingDoctorId?: string;
  attendingDoctorName?: string;
  arrivedAt: string;
  disposition: EmergencyDisposition;
  dispositionNotes?: string;
  dischargedAt?: string;
  admittedBedId?: string;
  admittedAdmissionId?: string;
  isMlc: boolean;
  mlcNumber?: string;
  mlcData?: any;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type MlcIncidentType = 'RTA' | 'ASSAULT' | 'BURN' | 'POISONING' | 'FALL' | 'INDUSTRIAL' | 'OTHER';
export type MlcInjuryType = 'SIMPLE' | 'GRIEVOUS' | 'DANGEROUS';

export interface MlcRecord {
  id: string;
  mlcNumber: string;
  emergencyVisitId?: string;
  patientId?: string;
  patientName: string;
  patientAge?: string;
  patientGender?: string;
  policeStation: string;
  policeOfficerName?: string;
  policeBadgeNumber?: string;
  incidentDate: string;
  incidentPlace?: string;
  incidentType: MlcIncidentType;
  broughtByName: string;
  broughtByPhone?: string;
  broughtByRelation?: string;
  injuryDescription: string;
  injuryType: MlcInjuryType;
  weaponType?: string;
  alcoholSmellDetected: boolean;
  dyingDeclarationRequired: boolean;
  intimationSentAt?: string;
  certificateIssuedAt?: string;
  doctorSignatureName: string;
  status: 'REGISTERED' | 'POLICE_NOTIFIED' | 'CERTIFICATE_ISSUED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyDashboardMetrics {
  activeVisits: number;
  redResuscitation: number;
  orangeEmergent: number;
  yellowUrgent: number;
  greenNonUrgent: number;
  totalMlcCases: number;
}

// ── Module 3: Enterprise Doctor Payouts & Departmental Indents ──────────────
export interface DoctorCommissionRule {
  id: string;
  doctorId: string;
  doctorName: string;
  opdType: 'PERCENT' | 'FLAT';
  opdValue: number;
  ipdVisitRate: number;
  surgerySharePercent: number;
  assistantSurgeonPercent: number;
  anesthetistPercent: number;
  labReferralPercent: number;
  pharmacyReferralPercent: number;
  tdsPercent: number;
  hospitalFacilityRetentionPercent: number;
  isActive: number | boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorPayoutTransaction {
  id: string;
  payoutNumber: string;
  doctorId: string;
  doctorName: string;
  periodStart?: string;
  periodEnd?: string;
  opdConsultationEarnings: number;
  ipdVisitsEarnings: number;
  surgeryEarnings: number;
  labReferralEarnings: number;
  grossEarnings: number;
  tdsDeduction: number;
  hospitalFacilityDeduction: number;
  otherDeductions: number;
  netPayoutAmount: number;
  paymentMode: 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'UPI';
  paymentReference?: string;
  status: 'PAID' | 'DRAFT' | 'CANCELLED';
  notes?: string;
  payoutDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorAccruedEarnings {
  doctorId: string;
  doctorName: string;
  periodStart: string;
  periodEnd: string;
  opdReceiptsCount: number;
  opdRevenue: number;
  opdEarnings: number;
  ipdVisitsCount: number;
  ipdEarnings: number;
  surgeryCount: number;
  surgeryEarnings: number;
  labOrdersCount: number;
  labRevenue: number;
  labEarnings: number;
  grossEarnings: number;
  tdsDeduction: number;
  hospitalFacilityDeduction: number;
  netPayable: number;
  totalPaidAlready: number;
  balanceOutstanding: number;
  rule: DoctorCommissionRule;
}

export type HospitalIndentDepartment = 'WARD' | 'OT' | 'ICU' | 'EMERGENCY' | 'LAB' | 'DIALYSIS';
export type HospitalIndentPriority = 'ROUTINE' | 'URGENT' | 'STAT_EMERGENCY';
export type HospitalIndentStatus = 'PENDING' | 'PARTIALLY_ISSUED' | 'COMPLETED' | 'CANCELLED';

export interface HospitalIndentItem {
  id: string;
  indentId: string;
  medicineId?: string;
  itemName: string;
  itemCategory?: string;
  requestedQuantity: number;
  issuedQuantity: number;
  batchNumber?: string;
  notes?: string;
}

export interface HospitalIndent {
  id: string;
  indentNumber: string;
  departmentType: HospitalIndentDepartment;
  sourceLocation: string;
  targetDepartment: string;
  requestedBy: string;
  priority: HospitalIndentPriority;
  status: HospitalIndentStatus;
  notes?: string;
  requestedAt: string;
  fulfilledAt?: string;
  fulfilledBy?: string;
  createdAt: string;
  updatedAt: string;
  items?: HospitalIndentItem[];
}

export interface HospitalTier3Metrics {
  totalDoctorPayoutsAmount: number;
  totalDoctorPayoutsCount: number;
  pendingIndentsCount: number;
  completedIndentsCount: number;
  activeDoctorsConfigured: number;
}

export interface GlobalPatientProfile {
  lastDoctorId?: string;
  patientId: string;
  patientUhid: string;
  patientName: string;
  patientPhone: string;
  patientAge?: string;
  patientGender?: string;
  address?: string;
  bloodGroup?: string;
  lastVisitDate?: string;
  previousDoctorName?: string;
  recentDiagnosis?: string;
  source?: string;
}


export interface BedAdmission {
  id: string;
  admissionNumber: string;
  patientId?: string;
  patientUhid?: string;
  patientName: string;
  patientPhone?: string;
  patientGender?: string;
  patientAge?: string;
  wardId: string;
  wardName: string;
  bedId: string;
  bedNumber: string;
  doctorId: string;
  doctorName: string;
  admittedAt: string;
  dischargedAt?: string;
  expectedDischargeAt?: string;
  diagnosis?: string;
  initialVitals?: string;
  vitalsLog?: string;
  wardChargesLog?: string;
  emarOrdersLog?: string;
  emarAdminLog?: string;
  fluidIoLog?: string;
  nursingNotesLog?: string;
  insuranceClaimId?: string;
  advancePaid: number;
  paymentMode?: 'CASH' | 'ONLINE' | 'UPI' | 'CARD';
  status: 'admitted' | 'discharged' | 'transferred';
  billingStatus?: 'NONE' | 'QUEUED' | 'BILLED';
  dischargeSummary?: string;
  totalBillId?: string;
  notes?: string;
  transfersLog?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IpdDashboardMetrics {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  cleaningBeds: number;
  maintenanceBeds: number;
  occupancyRate: number;
  admissionsTodayCount: number;
  dischargesTodayCount: number;
}

export interface LabTestParameter {
  id: string;
  name: string;
  unit: string;
  maleRange?: string;
  femaleRange?: string;
  defaultRange: string;
}

export interface LabTest {
  id: string;
  name: string;
  code: string;
  category: 'Hematology' | 'Biochemistry' | 'Serology' | 'Clinical Pathology' | 'Microbiology' | 'Radiology / Imaging' | string;
  rate: number;
  sampleType: string;
  turnaroundTime: string;
  parameters: LabTestParameter[];
  description?: string;
  isActive?: boolean | number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LabParameterResult {
  parameterId: string;
  parameterName: string;
  value: string | number;
  unit: string;
  referenceRange: string;
  isAbnormal?: boolean;
  flag?: 'NORMAL' | 'HIGH' | 'LOW' | 'CRITICAL' | string;
  notes?: string;
}

export interface LabOrderItem {
  testId: string;
  testName: string;
  category?: string;
  sampleType?: string;
  rate: number;
  status?: 'PENDING' | 'COLLECTED' | 'IN_ANALYSIS' | 'COMPLETED';
  results?: LabParameterResult[];
}

export interface LabOrder {
  id: string;
  orderNumber: string;
  patientId?: string;
  patientName: string;
  patientPhone?: string;
  patientGender?: string;
  patientAge?: string;
  doctorId?: string;
  doctorName?: string;
  prescriptionId?: string;
  tests: LabOrderItem[];
  totalAmount: number;
  discount?: number;
  paidAmount?: number;
  paymentMode?: 'CASH' | 'UPI' | 'CARD' | 'FREE' | string;
  status: 'ORDERED' | 'SAMPLE_COLLECTED' | 'IN_ANALYSIS' | 'COMPLETED' | 'CANCELLED';
  sampleCollectedAt?: string;
  sampleCollectedBy?: string;
  completedAt?: string;
  technicianNotes?: string;
  pathologistRemarks?: string;
  orderDate: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LabDashboardMetrics {
  ordersTodayCount: number;
  samplesPendingCount: number;
  inAnalysisCount: number;
  completedTodayCount: number;
}

export type ReceiptPaperType = 'A5' | 'A4' | 'A6' | 'Letter' | 'Thermal80' | 'Thermal58';
export type PrescriptionPaperType = 'A4' | 'A5' | 'Letter' | 'A6';

export interface PrintPaperSettings {
  receiptPaper: ReceiptPaperType;
  prescriptionPaper: PrescriptionPaperType;
}

export interface ClinicProfile {
  clinicName: string;
  clinicPhone?: string;
  clinicAddress?: string;
  clinicUpiId?: string;
  clinicQrText?: string;
  showFacilityQr?: boolean;
}

export function calculateNews2(vital: Partial<AdmissionVital>): {
  score: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  color: string;
  guidance: string;
  breakdown: Record<string, number>;
} {
  let score = 0;
  let hasSingle3 = false;
  const breakdown: Record<string, number> = {};

  const rr = Number(vital.respiratoryRate);
  if (!isNaN(rr) && rr > 0) {
    let pts = 0;
    if (rr <= 8) pts = 3;
    else if (rr >= 9 && rr <= 11) pts = 1;
    else if (rr >= 12 && rr <= 20) pts = 0;
    else if (rr >= 21 && rr <= 24) pts = 2;
    else if (rr >= 25) pts = 3;
    breakdown['Respiratory Rate'] = pts;
    score += pts;
    if (pts === 3) hasSingle3 = true;
  }

  const spo2 = Number(vital.spo2);
  if (!isNaN(spo2) && spo2 > 0) {
    let pts = 0;
    if (spo2 <= 91) pts = 3;
    else if (spo2 >= 92 && spo2 <= 93) pts = 2;
    else if (spo2 >= 94 && spo2 <= 95) pts = 1;
    else if (spo2 >= 96) pts = 0;
    breakdown['SpO2'] = pts;
    score += pts;
    if (pts === 3) hasSingle3 = true;
  }

  const oxyPts = vital.onOxygen ? 2 : 0;
  breakdown['Air / O2'] = oxyPts;
  score += oxyPts;

  const sbp = Number(vital.bpSystolic);
  if (!isNaN(sbp) && sbp > 0) {
    let pts = 0;
    if (sbp <= 90) pts = 3;
    else if (sbp >= 91 && sbp <= 100) pts = 2;
    else if (sbp >= 101 && sbp <= 110) pts = 1;
    else if (sbp >= 111 && sbp <= 219) pts = 0;
    else if (sbp >= 220) pts = 3;
    breakdown['Systolic BP'] = pts;
    score += pts;
    if (pts === 3) hasSingle3 = true;
  }

  const pulse = Number(vital.pulse);
  if (!isNaN(pulse) && pulse > 0) {
    let pts = 0;
    if (pulse <= 40) pts = 3;
    else if (pulse >= 41 && pulse <= 50) pts = 1;
    else if (pulse >= 51 && pulse <= 90) pts = 0;
    else if (pulse >= 91 && pulse <= 110) pts = 1;
    else if (pulse >= 111 && pulse <= 130) pts = 2;
    else if (pulse >= 131) pts = 3;
    breakdown['Pulse'] = pts;
    score += pts;
    if (pts === 3) hasSingle3 = true;
  }

  let avpuPts = 0;
  if (vital.avpu && vital.avpu !== 'Alert') {
    avpuPts = 3;
    hasSingle3 = true;
  }
  breakdown['Consciousness (AVPU)'] = avpuPts;
  score += avpuPts;

  const tempVal = Number(vital.temp);
  if (!isNaN(tempVal) && tempVal > 0) {
    const tempC = tempVal > 50 ? ((tempVal - 32) * 5) / 9 : tempVal;
    let pts = 0;
    if (tempC <= 35.0) pts = 3;
    else if (tempC >= 35.1 && tempC <= 36.0) pts = 1;
    else if (tempC >= 36.1 && tempC <= 38.0) pts = 0;
    else if (tempC >= 38.1 && tempC <= 39.0) pts = 1;
    else if (tempC >= 39.1) pts = 2;
    breakdown['Temperature'] = pts;
    score += pts;
    if (pts === 3) hasSingle3 = true;
  }

  let risk: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  let color = '#10b981';
  let guidance = 'Low clinical risk: Routine nursing observation (minimum 4-6 hourly monitoring).';

  if (score >= 7) {
    risk = 'HIGH';
    color = '#ef4444';
    guidance = 'HIGH CLINICAL RISK / EMERGENCY: Immediate emergency review by senior clinician/RMO & Critical Care escalation.';
  } else if (score >= 5 || hasSingle3) {
    risk = 'MEDIUM';
    color = '#f59e0b';
    guidance = 'MEDIUM CLINICAL RISK: Urgent review by ward doctor/RMO. Escalate monitoring frequency to minimum 1 hour.';
  }

  return { score, risk, color, guidance, breakdown };
}

const STORAGE_KEYS = {
  DOCTORS: 'clinic_doctors',
  SERVICES: 'clinic_services',
  RECEIPTS: 'clinic_receipts',
  LAST_RECEIPT_NUM: 'clinic_last_receipt_num',
  LAST_FREE_RECEIPT_NUM: 'clinic_last_free_receipt_num',
  SQLITE_MIGRATED: 'clinic_sqlite_migrated',
  RECEIPT_PAPER: 'clinic_receipt_paper_type',
  PRESCRIPTION_PAPER: 'clinic_prescription_paper_type',
  CLINIC_NAME: 'clinic_profile_name',
  CLINIC_PHONE: 'clinic_profile_phone',
  CLINIC_ADDRESS: 'clinic_profile_address',
  CLINIC_UPI_ID: 'clinic_profile_upi_id',
  CLINIC_QR_TEXT: 'clinic_profile_qr_text',
  CLINIC_FACILITY_SHOW_QR: 'clinic_facility_show_qr',
};

export const storage = {
  // Migration logic
  migrateToSQLite: async () => {
    if (localStorage.getItem(STORAGE_KEYS.SQLITE_MIGRATED) === 'true') {
      console.log('Already migrated to SQLite');
      return;
    }

    console.log('Starting Migration to SQLite...');
    
    try {
      // Get data from localStorage
      const doctorsStr = localStorage.getItem(STORAGE_KEYS.DOCTORS);
      const servicesStr = localStorage.getItem(STORAGE_KEYS.SERVICES);
      const receiptsStr = localStorage.getItem(STORAGE_KEYS.RECEIPTS);
      const lastNum = localStorage.getItem(STORAGE_KEYS.LAST_RECEIPT_NUM);
      const lastFreeNum = localStorage.getItem(STORAGE_KEYS.LAST_FREE_RECEIPT_NUM);

      // Save to SQLite via bridge
      if (doctorsStr) {
        const doctors = JSON.parse(doctorsStr);
        console.log(`Migrating ${doctors.length} doctors...`);
            await window.database.batchImportDoctors(doctors);
      }
      
      if (servicesStr) {
        const services = JSON.parse(servicesStr);
        console.log(`Migrating ${services.length} services...`);
        for (const s of services) {
                await window.database.saveService(s);
        }
      }

      if (receiptsStr) {
        const receipts = JSON.parse(receiptsStr);
        console.log(`Migrating ${receipts.length} receipts...`);
        for (const r of receipts) {
                await window.database.saveReceipt(r);
        }
      }

      if (lastNum) {
            await window.database.setMetadata('last_receipt_num', lastNum);
      }

      if (lastFreeNum) {
            await window.database.setMetadata('last_free_receipt_num', lastFreeNum);
      }

      localStorage.setItem(STORAGE_KEYS.SQLITE_MIGRATED, 'true');
      console.log('Migration successfully completed!');
    } catch (error) {
      console.error('Migration failed:', error);
      // We don't set the flag so it tries again next time
    }
  },

  getDoctors: async (): Promise<Doctor[]> => {
    return window.database.getDoctors();
  },
  
  saveDoctor: async (doctor: Doctor) => {
    await window.database.saveDoctor(doctor);
    notifyDataChanged('doctors');
  },

  deleteDoctor: async (id: string) => {
    await window.database.deleteDoctor(id);
    notifyDataChanged('doctors');
  },

  getServices: async (type?: 'OPD' | 'FACILITY' | 'ALL'): Promise<Service[]> => {
    const all: Service[] = (await window.database.getServices()) || [];
    if (!type || type === 'ALL') return all;
    const facilityCategories = ['Room Rent', 'Oxygen', 'Nursing', 'Doctor Rounds', 'Equipment'];
    if (type === 'OPD') {
      return all.filter(s =>
        s.serviceType !== 'FACILITY' &&
        (!s.category || !facilityCategories.includes(s.category)) &&
        !s.id?.startsWith('fac_')
      );
    }
    if (type === 'FACILITY') {
      return all.filter(s =>
        s.serviceType === 'FACILITY' ||
        (s.category && facilityCategories.includes(s.category)) ||
        s.id?.startsWith('fac_')
      );
    }
    return all;
  },

  saveService: async (service: Service) => {
    await window.database.saveService(service);
    notifyDataChanged('services');
  },

  deleteService: async (id: string) => {
    await window.database.deleteService(id);
    notifyDataChanged('services');
  },

  getReceipts: async (options?: { limit?: number; offset?: number; search?: string; startDate?: string; endDate?: string }) => {
    return window.database?.getReceipts(options) || [];
  },
  getDashboardMetrics: async () => {
    return window.database?.getDashboardMetrics() || { totalReceipts: 0, totalRevenue: 0, avgPerReceipt: 0 };
  },

  getDoctorReceiptCount: async (doctorId: string): Promise<number> => {
    try {
      if (window.database?.getDoctorReceiptCount) {
        return await window.database.getDoctorReceiptCount(doctorId);
      }
      const allReceipts = await storage.getReceipts();
      return allReceipts.filter(r => r.doctorId === doctorId).length;
    } catch {
      return 0;
    }
  },

  saveReceipt: async (receipt: Receipt) => {
    // Increment correct receipt number atomically
    const isFree = receipt.paymentMethod === 'FREE';
    const doctorId = receipt.doctorId;
    const key = doctorId 
      ? (isFree ? `doctor_free_receipt_num_${doctorId}` : `doctor_receipt_num_${doctorId}`)
      : (isFree ? 'last_free_receipt_num' : 'last_receipt_num');

    // Parse the prefix and digits from the receipt number
    const match = receipt.receiptNumber.match(/^(.*?)(\d+)$/);
    let nextNum = '';
    if (match) {
      const pfx = match[1];
      const digits = parseInt(match[2], 10);
      nextNum = `${pfx}${digits + 1}`;
    } else {
      const digitsOnly = receipt.receiptNumber.replace(/\D/g, '');
      const nextNumValue = (parseInt(digitsOnly, 10) || 1000) + 1;
      nextNum = (isFree ? 'F' : '') + nextNumValue.toString();
    }
    
    if (window.database?.saveReceiptAtomic) {
      await window.database.saveReceiptAtomic(receipt, key, nextNum);
    } else {
      // Fallback for older host
      await window.database.saveReceipt(receipt);
      await window.database.setMetadata(key, nextNum);
    }

    // Also sync the global counter so fallback callers stay current
    if (doctorId) {
      try {
        const numOnly = parseInt(receipt.receiptNumber.replace(/\D/g, ''), 10) || 0;
        if (numOnly > 0) {
          const globalKey = isFree ? 'last_free_receipt_num' : 'last_receipt_num';
          const currentGlobal = await window.database?.getMetadata(globalKey);
          const currentGlobalVal = currentGlobal ? (parseInt(currentGlobal.value.replace(/\D/g, ''), 10) || 0) : 0;
          if (numOnly >= currentGlobalVal) {
            const nextGlobal = (isFree ? 'F' : '') + (numOnly + 1).toString();
            await window.database?.setMetadata(globalKey, nextGlobal);
          }
        }
      } catch (e) {
        console.warn('Could not sync global receipt counter:', e);
      }
    }

    // Update last_patient_id metadata if a new PID number is higher
    if (receipt.patientId) {
      try {
        const num = parseInt(receipt.patientId.replace(/\D/g, '')) || 0;
        if (num > 0) {
          const meta = await window.database?.getMetadata('last_patient_id');
          const currentMax = meta?.value ? (parseInt(meta.value.replace(/\D/g, '')) || 0) : 0;
          if (num > currentMax) {
            await window.database?.setMetadata('last_patient_id', `PID-${num}`);
          }
        }
      } catch (err) {
        console.warn('Failed to update last_patient_id', err);
      }
    }
    notifyDataChanged('receipts');
  },

  deleteReceipt: async (id: string) => {
    await window.database.deleteReceipt(id);
    notifyDataChanged('receipts');
  },

  updateReceipt: async (receipt: Receipt) => {
    await window.database.updateReceipt(receipt);
    notifyDataChanged('receipts');
    return true;
  },

  getNextReceiptNumber: async (isFree: boolean = false, doctorId?: string): Promise<string> => {
    if (doctorId) {
      try {
        const doctors = await storage.getDoctors();
        const doctor = doctors.find(d => String(d.id) === String(doctorId));
        const prefix = getDoctorReceiptPrefix(doctor);
        const key = isFree ? `doctor_free_receipt_num_${doctorId}` : `doctor_receipt_num_${doctorId}`;

        const meta = await window.database?.getMetadata(key);
        if (meta && meta.value) {
          return meta.value;
        }

        // If no metadata stored yet, calculate from count of existing receipts for this doctor
        const count = await storage.getDoctorReceiptCount(doctorId);
        const nextNumVal = 1000 + count + 1;
        return isFree ? `F-${prefix}-${nextNumVal}` : `${prefix}-${nextNumVal}`;
      } catch (err) {
        console.warn('Failed to get doctor receipt number, falling back:', err);
      }
    }

    const key = isFree ? 'last_free_receipt_num' : 'last_receipt_num';
    const meta = await window.database.getMetadata(key);
    if (meta) return meta.value;
    return isFree ? 'F1001' : '1001';
  },

  getNextPatientId: async (): Promise<string> => {
    try {
      const meta = await window.database?.getMetadata('last_patient_id');
      if (meta && meta.value) {
        const num = parseInt(meta.value.replace(/\D/g, '')) || 1000;
        return `PID-${num + 1}`;
      }
      const receipts = await storage.getReceipts({ limit: 50 });
      let maxNum = 1000;
      for (const r of receipts) {
        if (r.patientId) {
          const num = parseInt(r.patientId.replace(/\D/g, '')) || 0;
          if (num > maxNum) maxNum = num;
        }
      }
      return `PID-${maxNum + 1}`;
    } catch {
      return 'PID-1001';
    }
  },

  findPatientByPhoneOrId: async (query: string): Promise<Receipt | null> => {
    if (!query || !query.trim()) return null;
    const q = query.trim().toLowerCase();
    const receipts = await storage.getReceipts({ search: q, limit: 10 });
    const exactMatch = receipts.find(r => 
      (r.patientId && r.patientId.toLowerCase() === q) ||
      (r.patientPhone && r.patientPhone.trim() === q)
    );
    return exactMatch || receipts[0] || null;
  },

  getPatientCompleteHistory: async (patient: {
    patientId?: string;
    patientPhone?: string;
    patientName?: string;
  }): Promise<PatientHistorySummary> => {
    const pid = patient.patientId?.trim().toLowerCase();
    const phone = patient.patientPhone?.trim();
    const name = patient.patientName?.trim().toLowerCase();

    // 1. Fetch receipts (search broadly then match specifically)
    const searchTarget = pid || phone || name || '';
    const allReceipts = await storage.getReceipts({ search: searchTarget, limit: 200 });
    const matchedReceipts = allReceipts.filter(r => {
      const matchPid = Boolean(pid && r.patientId && r.patientId.trim().toLowerCase() === pid);
      const matchPhone = Boolean(phone && r.patientPhone && r.patientPhone.trim() === phone);
      const matchName = Boolean(name && r.patientName && r.patientName.trim().toLowerCase() === name);
      return matchPid || matchPhone || matchName;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 2. Fetch prescriptions
    let allPrescriptions: Prescription[] = [];
    try {
      allPrescriptions = await storage.getPrescriptions();
    } catch (e) {
      console.warn('Failed to load prescriptions for patient history', e);
    }
    const matchedPrescriptions = allPrescriptions.filter(p => {
      const matchPid = Boolean(pid && p.patientId && p.patientId.trim().toLowerCase() === pid);
      const matchPhone = Boolean(phone && p.patientPhone && p.patientPhone.trim() === phone);
      const matchName = Boolean(name && p.patientName && p.patientName.trim().toLowerCase() === name);
      return matchPid || matchPhone || matchName;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 3. Fetch appointments
    let allAppointments: Appointment[] = [];
    try {
      allAppointments = await storage.getAppointments();
    } catch (e) {
      console.warn('Failed to load appointments for patient history', e);
    }
    const matchedAppointments = allAppointments.filter(a => {
      const matchPid = Boolean(pid && a.patientId && a.patientId.trim().toLowerCase() === pid);
      const matchPhone = Boolean(phone && a.patientPhone && a.patientPhone.trim() === phone);
      const matchName = Boolean(name && a.patientName && a.patientName.trim().toLowerCase() === name);
      return matchPid || matchPhone || matchName;
    }).sort((a, b) => new Date(b.appointmentDate).getTime() - new Date(a.appointmentDate).getTime());

    // 4. Fetch follow-ups
    let allFollowUps: FollowUp[] = [];
    try {
      allFollowUps = await storage.getFollowUps();
    } catch (e) {
      console.warn('Failed to load follow-ups for patient history', e);
    }
    const matchedFollowUps = allFollowUps.filter(f => {
      const matchPid = Boolean(pid && f.patientId && f.patientId.trim().toLowerCase() === pid);
      const matchPhone = Boolean(phone && f.patientPhone && f.patientPhone.trim() === phone);
      const matchName = Boolean(name && f.patientName && f.patientName.trim().toLowerCase() === name);
      return matchPid || matchPhone || matchName;
    }).sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());

    const totalSpent = matchedReceipts.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

    return {
      receipts: matchedReceipts,
      prescriptions: matchedPrescriptions,
      appointments: matchedAppointments,
      followUps: matchedFollowUps,
      totalVisits: matchedReceipts.length,
      totalSpent,
      opdCount: matchedReceipts.filter(r => r.billType !== 'FACILITY').length,
      facilityCount: matchedReceipts.filter(r => r.billType === 'FACILITY').length,
      prescriptionCount: matchedPrescriptions.length
    };
  },

  exportData: async () => {
    const data = {
      doctors: await storage.getDoctors(),
      services: await storage.getServices(),
      receipts: await storage.getReceipts(),
      lastReceiptNum: await storage.getNextReceiptNumber(false)
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buvora_backup_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importData: async (jsonData: string): Promise<boolean> => {
    try {
      // Auto-backup before import (H5)
      try {
        await storage.exportData();
      } catch (err) {
        console.warn('Pre-import backup failed', err);
      }

      const data = JSON.parse(jsonData);
      if (data.doctors) {
            await window.database.batchImportDoctors(data.doctors);
      }
      if (data.services) {
        for (const s of data.services) {
                await window.database.saveService(s);
        }
      }
      if (data.receipts) {
        for (const r of data.receipts) {
                await window.database.saveReceipt(r);
        }
      }
      if (data.lastReceiptNum) {
            await window.database.setMetadata('last_receipt_num', data.lastReceiptNum);
      }
      return true;
    } catch (e) {
      console.error('Failed to import data:', e);
      return false;
    }
  },

  exportToExcel: async () => {
    const receipts = await storage.getReceipts();
    if (receipts.length === 0) {
      alert('No receipts found to export.');
      return;
    }

    const paidReceipts = receipts.filter(r => r.paymentMethod !== 'FREE');
    const freeReceipts = receipts.filter(r => r.paymentMethod === 'FREE');

    const headers = ['Date', 'Receipt #', 'Patient ID', 'Patient Name', 'Phone No.', 'Doctor Name', 'Services', 'Total Amount (₹)', 'Payment Method'];
    
    const formatRow = (r: any) => [
      r.date,
      `#${r.receiptNumber}`,
      r.patientId || 'N/A',
      r.patientName,
      r.patientPhone || 'N/A',
      r.doctorName,
      (r.items || []).map((item: any) => item.description).join('; '),
      (Number(r.total) || 0).toFixed(2),
      r.paymentMethod || 'CASH'
    ].map(cell => `"${cell}"`).join(',');

    let csvContent = "PAID PATIENT RECORDS\n" + headers.join(',') + '\n';
    csvContent += paidReceipts.map(formatRow).join('\n');
    
    csvContent += "\n\nFREE PATIENT RECORDS\n" + headers.join(',') + '\n';
    csvContent += freeReceipts.map(formatRow).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinic_report_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  batchImportDoctors: async (syncKey: string): Promise<boolean> => {
    try {
      const jsonStr = atob(syncKey);
      const newDoctors = JSON.parse(jsonStr);
      if (Array.isArray(newDoctors)) {
            await window.database.batchImportDoctors(newDoctors);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to batch import doctors:', e);
      return false;
    }
  },

  getPrescriptions: async (): Promise<Prescription[]> => {
    return window.database.getPrescriptions();
  },

  savePrescription: async (prescription: Prescription) => {
    await window.database.savePrescription(prescription);
    notifyDataChanged('prescriptions');
    notifyDataChanged('receipts');
  },

  deletePrescription: async (id: string) => {
    await window.database.deletePrescription(id);
    notifyDataChanged('prescriptions');
    notifyDataChanged('receipts');
  },

  getAppointments: async (): Promise<Appointment[]> => {
    if (window.database?.getAppointments) {
        return window.database.getAppointments();
    }
    return [];
  },

  saveAppointment: async (appointment: Appointment) => {
    if (window.database?.saveAppointment) {
        await window.database.saveAppointment(appointment);
    }
    notifyDataChanged('appointments');
  },

  updateAppointmentStatus: async (id: string, status: AppointmentStatus, rejectionReason?: string) => {
    if (window.database?.updateAppointmentStatus) {
        await window.database.updateAppointmentStatus(id, status, rejectionReason);
    }
    notifyDataChanged('appointments');
  },

  deleteAppointment: async (id: string) => {
    if (window.database?.deleteAppointment) {
        await window.database.deleteAppointment(id);
    }
    notifyDataChanged('appointments');
  },

  getFollowUps: async (options?: { limit?: number; offset?: number; search?: string; startDate?: string; endDate?: string; doctorId?: string; status?: string }): Promise<FollowUp[]> => {
    if (window.database?.getFollowUps) {
      return window.database.getFollowUps(options);
    }
    return [];
  },

  saveFollowUp: async (followUp: FollowUp): Promise<void> => {
    if (window.database?.saveFollowUp) {
      await window.database.saveFollowUp(followUp);
    }
    notifyDataChanged('followups');
  },

  updateFollowUpStatus: async (id: string, status: FollowUpStatus): Promise<void> => {
    if (window.database?.updateFollowUpStatus) {
      await window.database.updateFollowUpStatus(id, status);
    }
    notifyDataChanged('followups');
  },

  deleteFollowUp: async (id: string): Promise<void> => {
    if (window.database?.deleteFollowUp) {
      await window.database.deleteFollowUp(id);
    }
    notifyDataChanged('followups');
  },

  getPrintPaperSettings: async (): Promise<PrintPaperSettings> => {
    let receiptPaper: ReceiptPaperType = (localStorage.getItem(STORAGE_KEYS.RECEIPT_PAPER) as ReceiptPaperType) || 'A5';
    let prescriptionPaper: PrescriptionPaperType = (localStorage.getItem(STORAGE_KEYS.PRESCRIPTION_PAPER) as PrescriptionPaperType) || 'A4';

    if (window.database?.getMetadata) {
      try {
        const [rMeta, pMeta] = await Promise.all([
          window.database.getMetadata('receipt_paper_type'),
          window.database.getMetadata('prescription_paper_type')
        ]);
        if (rMeta?.value) {
          receiptPaper = rMeta.value as ReceiptPaperType;
          localStorage.setItem(STORAGE_KEYS.RECEIPT_PAPER, receiptPaper);
        }
        if (pMeta?.value) {
          prescriptionPaper = pMeta.value as PrescriptionPaperType;
          localStorage.setItem(STORAGE_KEYS.PRESCRIPTION_PAPER, prescriptionPaper);
        }
      } catch (err) {
        console.warn('Failed to fetch print paper metadata:', err);
      }
    }

    return { receiptPaper, prescriptionPaper };
  },

  savePrintPaperSettings: async (settings: Partial<PrintPaperSettings>): Promise<void> => {
    if (settings.receiptPaper) {
      localStorage.setItem(STORAGE_KEYS.RECEIPT_PAPER, settings.receiptPaper);
      if (window.database?.setMetadata) {
        try {
          await window.database.setMetadata('receipt_paper_type', settings.receiptPaper);
        } catch (err) {
          console.warn('Failed to save receipt paper metadata:', err);
        }
      }
    }
    if (settings.prescriptionPaper) {
      localStorage.setItem(STORAGE_KEYS.PRESCRIPTION_PAPER, settings.prescriptionPaper);
      if (window.database?.setMetadata) {
        try {
          await window.database.setMetadata('prescription_paper_type', settings.prescriptionPaper);
        } catch (err) {
          console.warn('Failed to save prescription paper metadata:', err);
        }
      }
    }
  },

  getClinicProfile: async (): Promise<ClinicProfile> => {
    let clinicName = localStorage.getItem(STORAGE_KEYS.CLINIC_NAME) || 'Buvora Clinic';
    let clinicPhone = localStorage.getItem(STORAGE_KEYS.CLINIC_PHONE) || '';
    let clinicAddress = localStorage.getItem(STORAGE_KEYS.CLINIC_ADDRESS) || '';
    let clinicUpiId = localStorage.getItem(STORAGE_KEYS.CLINIC_UPI_ID) || '';
    let clinicQrText = localStorage.getItem(STORAGE_KEYS.CLINIC_QR_TEXT) || '';
    let showFacilityQr = localStorage.getItem(STORAGE_KEYS.CLINIC_FACILITY_SHOW_QR) !== 'false';

    if (window.database?.getMetadata) {
      try {
        const [nameMeta, phoneMeta, addrMeta, upiMeta, qrMeta, showQrMeta] = await Promise.all([
          window.database.getMetadata('clinic_name'),
          window.database.getMetadata('clinic_phone'),
          window.database.getMetadata('clinic_address'),
          window.database.getMetadata('clinic_upi_id'),
          window.database.getMetadata('clinic_qr_text'),
          window.database.getMetadata('clinic_facility_show_qr'),
        ]);
        if (nameMeta?.value) {
          clinicName = nameMeta.value;
          localStorage.setItem(STORAGE_KEYS.CLINIC_NAME, clinicName);
        }
        if (phoneMeta?.value) {
          clinicPhone = phoneMeta.value;
          localStorage.setItem(STORAGE_KEYS.CLINIC_PHONE, clinicPhone);
        }
        if (addrMeta?.value) {
          clinicAddress = addrMeta.value;
          localStorage.setItem(STORAGE_KEYS.CLINIC_ADDRESS, clinicAddress);
        }
        if (upiMeta?.value) {
          clinicUpiId = upiMeta.value;
          localStorage.setItem(STORAGE_KEYS.CLINIC_UPI_ID, clinicUpiId);
        }
        if (qrMeta?.value) {
          clinicQrText = qrMeta.value;
          localStorage.setItem(STORAGE_KEYS.CLINIC_QR_TEXT, clinicQrText);
        }
        if (showQrMeta?.value !== undefined && showQrMeta?.value !== null) {
          showFacilityQr = showQrMeta.value === 'true';
          localStorage.setItem(STORAGE_KEYS.CLINIC_FACILITY_SHOW_QR, String(showFacilityQr));
        }
      } catch (err) {
        console.warn('Failed to fetch clinic profile metadata:', err);
      }
    }

    return {
      clinicName,
      clinicPhone,
      clinicAddress,
      clinicUpiId,
      clinicQrText,
      showFacilityQr
    };
  },

  saveClinicProfile: async (profile: Partial<ClinicProfile>): Promise<void> => {
    if (profile.clinicName !== undefined) {
      localStorage.setItem(STORAGE_KEYS.CLINIC_NAME, profile.clinicName);
      if (window.database?.setMetadata) {
        try { await window.database.setMetadata('clinic_name', profile.clinicName); } catch (e) { console.warn(e); }
      }
    }
    if (profile.clinicPhone !== undefined) {
      localStorage.setItem(STORAGE_KEYS.CLINIC_PHONE, profile.clinicPhone);
      if (window.database?.setMetadata) {
        try { await window.database.setMetadata('clinic_phone', profile.clinicPhone); } catch (e) { console.warn(e); }
      }
    }
    if (profile.clinicAddress !== undefined) {
      localStorage.setItem(STORAGE_KEYS.CLINIC_ADDRESS, profile.clinicAddress);
      if (window.database?.setMetadata) {
        try { await window.database.setMetadata('clinic_address', profile.clinicAddress); } catch (e) { console.warn(e); }
      }
    }
    if (profile.clinicUpiId !== undefined) {
      localStorage.setItem(STORAGE_KEYS.CLINIC_UPI_ID, profile.clinicUpiId);
      if (window.database?.setMetadata) {
        try { await window.database.setMetadata('clinic_upi_id', profile.clinicUpiId); } catch (e) { console.warn(e); }
      }
    }
    if (profile.clinicQrText !== undefined) {
      localStorage.setItem(STORAGE_KEYS.CLINIC_QR_TEXT, profile.clinicQrText);
      if (window.database?.setMetadata) {
        try { await window.database.setMetadata('clinic_qr_text', profile.clinicQrText); } catch (e) { console.warn(e); }
      }
    }
    if (profile.showFacilityQr !== undefined) {
      localStorage.setItem(STORAGE_KEYS.CLINIC_FACILITY_SHOW_QR, String(profile.showFacilityQr));
      if (window.database?.setMetadata) {
        try { await window.database.setMetadata('clinic_facility_show_qr', String(profile.showFacilityQr)); } catch (e) { console.warn(e); }
      }
    }
  },

  getMetadata: async (key: string): Promise<string | null> => {
    if (window.database?.getMetadata) {
      try {
        const meta = await window.database.getMetadata(key);
        return meta ? meta.value : null;
      } catch (_) {}
    }
    return localStorage.getItem(`meta_${key}`);
  },

  setMetadata: async (key: string, value: string): Promise<void> => {
    localStorage.setItem(`meta_${key}`, value);
    if (window.database?.setMetadata) {
      try {
        await window.database.setMetadata(key, value);
      } catch (_) {}
    }
  },

  getExpenses: async (options?: { limit?: number; offset?: number; search?: string; category?: string; startDate?: string; endDate?: string }): Promise<Expense[]> => {
    if (window.database?.getExpenses) {
      try {
        return await window.database.getExpenses(options);
      } catch (err) {
        console.warn('Failed to fetch expenses from SQLite, falling back to localStorage:', err);
      }
    }
    const raw = localStorage.getItem('clinic_expenses');
    let list: Expense[] = raw ? JSON.parse(raw) : [];
    if (options?.category && options.category !== 'ALL') {
      list = list.filter(e => e.category === options.category);
    }
    if (options?.search) {
      const q = options.search.toLowerCase();
      list = list.filter(e => e.title.toLowerCase().includes(q) || (e.paidTo && e.paidTo.toLowerCase().includes(q)));
    }
    return list;
  },

  saveExpense: async (expense: Expense): Promise<Expense> => {
    let item: Expense;
    if (window.database?.saveExpense) {
      try {
        item = await window.database.saveExpense(expense);
        notifyDataChanged('expenses');
        return item;
      } catch (err) {
        console.warn('Failed to save expense in SQLite, fallback to localStorage:', err);
      }
    }
    const raw = localStorage.getItem('clinic_expenses');
    const list: Expense[] = raw ? JSON.parse(raw) : [];
    const id = expense.id || ('EXP-' + Date.now());
    item = { ...expense, id, updatedAt: new Date().toISOString() };
    const idx = list.findIndex(e => e.id === id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    localStorage.setItem('clinic_expenses', JSON.stringify(list));
    notifyDataChanged('expenses');
    return item;
  },

  deleteExpense: async (id: string): Promise<void> => {
    if (window.database?.deleteExpense) {
      try {
        await window.database.deleteExpense(id);
        notifyDataChanged('expenses');
        return;
      } catch (err) {
        console.warn('Failed to delete expense in SQLite, fallback to localStorage:', err);
      }
    }
    const raw = localStorage.getItem('clinic_expenses');
    if (raw) {
      const list: Expense[] = JSON.parse(raw);
      localStorage.setItem('clinic_expenses', JSON.stringify(list.filter(e => e.id !== id)));
    }
    notifyDataChanged('expenses');
  },

  exportExpensesToCSV: (expenses: Expense[]) => {
    const headers = ['ID', 'Date', 'Title / Description', 'Category', 'Amount (INR)', 'Payment Mode', 'Paid To / Vendor', 'Bill / Invoice No', 'Status', 'Notes'];
    const rows = expenses.map(e => [
      `"${e.id}"`,
      `"${e.date}"`,
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${e.category}"`,
      e.amount,
      `"${e.paymentMode}"`,
      `"${(e.paidTo || '').replace(/"/g, '""')}"`,
      `"${(e.billNumber || '').replace(/"/g, '""')}"`,
      `"${e.status || 'PAID'}"`,
      `"${(e.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `clinic_expenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // ── Hospital Pharmacy Methods ─────────────────────────────────────────────
  getMedicines: async (search?: string, category?: string): Promise<Medicine[]> => {
    if (window.database?.getMedicines) {
      try {
        return await window.database.getMedicines(search, category);
      } catch (err) {
        console.warn('Failed to fetch medicines from SQLite:', err);
      }
    }
    const raw = localStorage.getItem('hospital_medicines');
    let list: Medicine[] = raw ? JSON.parse(raw) : [];
    if (search && search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(s) || m.genericName?.toLowerCase().includes(s));
    }
    if (category && category !== 'All') {
      list = list.filter(m => m.category === category);
    }
    return list;
  },

  saveMedicine: async (medicine: Medicine): Promise<Medicine> => {
    let item: Medicine;
    if (window.database?.saveMedicine) {
      try {
        item = await window.database.saveMedicine(medicine);
        notifyDataChanged('medicines');
        return item;
      } catch (err) {
        console.warn('Failed to save medicine in SQLite:', err);
      }
    }
    const raw = localStorage.getItem('hospital_medicines');
    const list: Medicine[] = raw ? JSON.parse(raw) : [];
    const id = medicine.id || ('MED-' + Date.now());
    item = { ...medicine, id };
    const idx = list.findIndex(m => m.id === id);
    if (idx >= 0) list[idx] = item; else list.unshift(item);
    localStorage.setItem('hospital_medicines', JSON.stringify(list));
    notifyDataChanged('medicines');
    return item;
  },

  deleteMedicine: async (id: string): Promise<void> => {
    if (window.database?.deleteMedicine) {
      try {
        await window.database.deleteMedicine(id);
        notifyDataChanged('medicines');
        return;
      } catch (err) {
        console.warn('Failed to delete medicine in SQLite:', err);
      }
    }
    const raw = localStorage.getItem('hospital_medicines');
    if (raw) {
      const list: Medicine[] = JSON.parse(raw);
      localStorage.setItem('hospital_medicines', JSON.stringify(list.filter(m => m.id !== id)));
    }
    notifyDataChanged('medicines');
  },

  getMedicineBatches: async (medicineId?: string): Promise<MedicineBatch[]> => {
    if (window.database?.getMedicineBatches) {
      try {
        return await window.database.getMedicineBatches(medicineId);
      } catch (err) {
        console.warn('Failed to fetch batches from SQLite:', err);
      }
    }
    const raw = localStorage.getItem('hospital_medicine_batches');
    const list: MedicineBatch[] = raw ? JSON.parse(raw) : [];
    return medicineId ? list.filter(b => b.medicineId === medicineId) : list;
  },

  saveMedicineBatch: async (batch: MedicineBatch): Promise<MedicineBatch> => {
    let item: MedicineBatch;
    if (window.database?.saveMedicineBatch) {
      try {
        item = await window.database.saveMedicineBatch(batch);
        notifyDataChanged('medicines');
        return item;
      } catch (err) {
        console.warn('Failed to save batch in SQLite:', err);
      }
    }
    const raw = localStorage.getItem('hospital_medicine_batches');
    const list: MedicineBatch[] = raw ? JSON.parse(raw) : [];
    const id = batch.id || ('BATCH-' + Date.now());
    item = { ...batch, id };
    const idx = list.findIndex(b => b.id === id);
    if (idx >= 0) list[idx] = item; else list.unshift(item);
    localStorage.setItem('hospital_medicine_batches', JSON.stringify(list));
    notifyDataChanged('medicines');
    return item;
  },

  deleteMedicineBatch: async (id: string): Promise<void> => {
    if (window.database?.deleteMedicineBatch) {
      try {
        await window.database.deleteMedicineBatch(id);
        notifyDataChanged('medicines');
        return;
      } catch (err) {
        console.warn('Failed to delete batch in SQLite:', err);
      }
    }
    const raw = localStorage.getItem('hospital_medicine_batches');
    if (raw) {
      const list: MedicineBatch[] = JSON.parse(raw);
      localStorage.setItem('hospital_medicine_batches', JSON.stringify(list.filter(b => b.id !== id)));
    }
    notifyDataChanged('medicines');
  },

  adjustMedicineStock: async (batchId: string, quantityDiff: number): Promise<void> => {
    if (window.database?.adjustMedicineStock) {
      try {
        await window.database.adjustMedicineStock(batchId, quantityDiff);
        notifyDataChanged('medicines');
        return;
      } catch (err) {
        console.warn('Failed to adjust stock in SQLite:', err);
      }
    }
  },

  getPharmacySales: async (options?: any): Promise<PharmacySale[]> => {
    if (window.database?.getPharmacySales) {
      try {
        return await window.database.getPharmacySales(options);
      } catch (err) {
        console.warn('Failed to fetch pharmacy sales from SQLite:', err);
      }
    }
    const raw = localStorage.getItem('hospital_pharmacy_sales');
    return raw ? JSON.parse(raw) : [];
  },

  savePharmacySale: async (sale: PharmacySale): Promise<PharmacySale> => {
    let item: PharmacySale;
    if (window.database?.savePharmacySale) {
      try {
        item = await window.database.savePharmacySale(sale);
        notifyDataChanged('medicines');
        notifyDataChanged('sales');
        return item;
      } catch (err) {
        console.warn('Failed to save pharmacy sale in SQLite:', err);
      }
    }
    const raw = localStorage.getItem('hospital_pharmacy_sales');
    const list: PharmacySale[] = raw ? JSON.parse(raw) : [];
    const id = sale.id || ('PSALE-' + Date.now());
    const saleNumber = sale.saleNumber || ('PH-' + (1001 + list.length));
    item = { ...sale, id, saleNumber };
    list.unshift(item);
    localStorage.setItem('hospital_pharmacy_sales', JSON.stringify(list));
    notifyDataChanged('medicines');
    notifyDataChanged('sales');
    return item;
  },

  deletePharmacySale: async (id: string): Promise<void> => {
    if (window.database?.deletePharmacySale) {
      try {
        await window.database.deletePharmacySale(id);
        notifyDataChanged('medicines');
        notifyDataChanged('sales');
        return;
      } catch (err) {
        console.warn('Failed to delete pharmacy sale in SQLite:', err);
      }
    }
    const raw = localStorage.getItem('hospital_pharmacy_sales');
    if (raw) {
      const list: PharmacySale[] = JSON.parse(raw);
      localStorage.setItem('hospital_pharmacy_sales', JSON.stringify(list.filter(s => s.id !== id)));
    }
    notifyDataChanged('medicines');
    notifyDataChanged('sales');
  },

  getPharmacyMetrics: async (): Promise<PharmacyDashboardMetrics> => {
    if (window.database?.getPharmacyMetrics) {
      try {
        return await window.database.getPharmacyMetrics();
      } catch (err) {
        console.warn('Failed to fetch pharmacy metrics from SQLite:', err);
      }
    }
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
  },

  exportPharmacyToCSV: (medicines: Medicine[]) => {
    const headers = ['ID', 'Medicine Name', 'Generic Formulation', 'Category', 'Manufacturer', 'Unit', 'Location / Rack', 'Min Stock Alert', 'Current Stock'];
    const rows = medicines.map(m => [
      `"${m.id}"`,
      `"${(m.name || '').replace(/"/g, '""')}"`,
      `"${(m.genericName || '').replace(/"/g, '""')}"`,
      `"${m.category}"`,
      `"${(m.manufacturer || '').replace(/"/g, '""')}"`,
      `"${m.unit}"`,
      `"${m.locationRack || 'General'}"`,
      m.minStockAlert,
      m.currentStock || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pharmacy_inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  // ==================== HOSPITAL IPD (WARDS & BEDS) ====================
  getWards: async (): Promise<Ward[]> => {
    if (window.database?.getWards) {
      return window.database.getWards();
    }
    const raw = localStorage.getItem('hospital_wards');
    return raw ? JSON.parse(raw) : [];
  },

  saveWard: async (ward: Partial<Ward>): Promise<Ward> => {
    if (window.database?.saveWard) {
      return window.database.saveWard(ward);
    }
    const wards = await storage.getWards();
    const id = ward.id || `WARD-${Date.now().toString(36).toUpperCase()}`;
    const newWard: Ward = {
      id,
      name: ward.name || 'General Ward',
      code: ward.code || 'GW',
      floor: ward.floor || 'Ground Floor',
      dailyRate: ward.dailyRate || 0,
      nursingRate: ward.nursingRate || 0,
      totalBeds: ward.totalBeds || 0,
      description: ward.description || '',
      isActive: ward.isActive !== undefined ? ward.isActive : 1,
      createdAt: ward.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const index = wards.findIndex(w => w.id === id);
    if (index !== -1) wards[index] = newWard;
    else wards.push(newWard);
    localStorage.setItem('hospital_wards', JSON.stringify(wards));
    return newWard;
  },

  deleteWard: async (id: string): Promise<void> => {
    if (window.database?.deleteWard) {
      return window.database.deleteWard(id);
    }
    const wards = (await storage.getWards()).filter(w => w.id !== id);
    localStorage.setItem('hospital_wards', JSON.stringify(wards));
  },

  getBeds: async (wardId?: string): Promise<HospitalBed[]> => {
    if (window.database?.getBeds) {
      return window.database.getBeds(wardId);
    }
    const raw = localStorage.getItem('hospital_beds');
    const beds: HospitalBed[] = raw ? JSON.parse(raw) : [];
    if (wardId) return beds.filter(b => b.wardId === wardId);
    return beds;
  },

  saveBed: async (bed: Partial<HospitalBed>): Promise<HospitalBed> => {
    if (window.database?.saveBed) {
      return window.database.saveBed(bed);
    }
    const beds = await storage.getBeds();
    const id = bed.id || `BED-${bed.bedNumber || Date.now().toString(36).toUpperCase()}`;
    const newBed: HospitalBed = {
      id,
      wardId: bed.wardId || '',
      bedNumber: bed.bedNumber || '',
      bedType: bed.bedType || 'Standard',
      dailyRate: bed.dailyRate || 0,
      status: bed.status || 'available',
      currentAdmissionId: bed.currentAdmissionId || null,
      notes: bed.notes || '',
      updatedAt: new Date().toISOString()
    };
    const index = beds.findIndex(b => b.id === id);
    if (index !== -1) beds[index] = newBed;
    else beds.push(newBed);
    localStorage.setItem('hospital_beds', JSON.stringify(beds));
    return newBed;
  },

  deleteBed: async (id: string): Promise<void> => {
    if (window.database?.deleteBed) {
      return window.database.deleteBed(id);
    }
    const beds = (await storage.getBeds()).filter(b => b.id !== id);
    localStorage.setItem('hospital_beds', JSON.stringify(beds));
  },

  updateBedStatus: async (bedId: string, status: 'available' | 'occupied' | 'cleaning' | 'maintenance'): Promise<void> => {
    if (window.database?.updateBedStatus) {
      return window.database.updateBedStatus(bedId, status);
    }
    const beds = await storage.getBeds();
    const bed = beds.find(b => b.id === bedId);
    if (bed) {
      bed.status = status;
      if (status === 'available') bed.currentAdmissionId = null;
      bed.updatedAt = new Date().toISOString();
      localStorage.setItem('hospital_beds', JSON.stringify(beds));
    }
  },

  getBedAdmissions: async (options?: { status?: string; billingStatus?: string; patientId?: string; limit?: number }): Promise<BedAdmission[]> => {
    if (window.database?.getBedAdmissions) {
      return window.database.getBedAdmissions(options);
    }
    const raw = localStorage.getItem('hospital_admissions');
    let admissions: BedAdmission[] = raw ? JSON.parse(raw) : [];
    if (options?.status) admissions = admissions.filter(a => a.status === options.status);
    if (options?.billingStatus) admissions = admissions.filter(a => a.billingStatus === options.billingStatus);
    if (options?.patientId) admissions = admissions.filter(a => a.patientId === options.patientId || a.patientUhid === options.patientId);
    return admissions;
  },

  admitPatientToBed: async (data: any): Promise<BedAdmission> => {
    let result: BedAdmission;
    if (window.database?.admitPatientToBed) {
      result = await window.database.admitPatientToBed(data);
    } else {
      const admissions = await storage.getBedAdmissions();
      const nextNum = 1000 + admissions.length + 1;
      const admissionId = `ADM-${nextNum}`;
      const newAdmission: BedAdmission = {
        id: admissionId,
        admissionNumber: admissionId,
        patientId: data.patientId || '',
        patientUhid: data.patientUhid || data.patientId || '',
        patientName: data.patientName || '',
        patientPhone: data.patientPhone || '',
        patientGender: data.patientGender || '',
        patientAge: data.patientAge || '',
        wardId: data.wardId || '',
        wardName: data.wardName || '',
        bedId: data.bedId || '',
        bedNumber: data.bedNumber || '',
        doctorId: data.doctorId || '',
        doctorName: data.doctorName || '',
        admittedAt: data.admittedAt || new Date().toISOString(),
        expectedDischargeAt: data.expectedDischargeAt || '',
        diagnosis: data.diagnosis || '',
        initialVitals: typeof data.initialVitals === 'object' ? JSON.stringify(data.initialVitals) : (data.initialVitals || '{}'),
        vitalsLog: typeof data.vitalsLog === 'object' ? JSON.stringify(data.vitalsLog) : (data.vitalsLog || '[]'),
        wardChargesLog: typeof data.wardChargesLog === 'object' ? JSON.stringify(data.wardChargesLog) : (data.wardChargesLog || '[]'),
        advancePaid: Number(data.advancePaid) || 0,
        paymentMode: data.paymentMode || 'CASH',
        status: 'admitted',
        notes: data.notes || '',
        transfersLog: '[]',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      admissions.unshift(newAdmission);
      localStorage.setItem('hospital_admissions', JSON.stringify(admissions));
      await storage.updateBedStatus(data.bedId, 'occupied');
      result = newAdmission;
    }
    notifyDataChanged('beds');
    return result;
  },

  transferPatientBed: async (admissionId: string, newBedId: string, reason?: string): Promise<any> => {
    let result: any;
    if (window.database?.transferPatientBed) {
      result = await window.database.transferPatientBed(admissionId, newBedId, reason);
    } else {
      result = { success: true };
    }
    notifyDataChanged('beds');
    return result;
  },

  updateAdmissionBillingStatus: async (admissionId: string, billingStatus: string, notes?: string): Promise<any> => {
    let result: any;
    if (window.database?.updateAdmissionBillingStatus) {
      result = await window.database.updateAdmissionBillingStatus(admissionId, billingStatus, notes);
    } else {
      const admissions = JSON.parse(localStorage.getItem('hospital_admissions') || '[]');
      const idx = admissions.findIndex((a: any) => a.id === admissionId);
      if (idx !== -1) {
        admissions[idx].billingStatus = billingStatus;
        if (notes) admissions[idx].dischargeSummary = notes;
        admissions[idx].updatedAt = new Date().toISOString();
        localStorage.setItem('hospital_admissions', JSON.stringify(admissions));
      }
      result = { success: true };
    }
    notifyDataChanged('beds');
    return result;
  },

  dischargePatientAdmission: async (admissionId: string, data?: any): Promise<any> => {
    let result: any;
    if (window.database?.dischargePatientAdmission) {
      result = await window.database.dischargePatientAdmission(admissionId, data);
    } else {
      const admissions = JSON.parse(localStorage.getItem('hospital_admissions') || '[]');
      const idx = admissions.findIndex((a: any) => a.id === admissionId);
      if (idx !== -1) {
        admissions[idx].status = 'discharged';
        admissions[idx].billingStatus = data?.billingStatus || (data?.receiptId ? 'BILLED' : 'NONE');
        admissions[idx].dischargedAt = new Date().toISOString();
        if (data?.dischargeSummary) admissions[idx].dischargeSummary = data.dischargeSummary;
        if (data?.receiptId) admissions[idx].totalBillId = data.receiptId;
        admissions[idx].updatedAt = new Date().toISOString();
        localStorage.setItem('hospital_admissions', JSON.stringify(admissions));
      }
      result = { success: true };
    }
    notifyDataChanged('beds');
    return result;
  },

  addAdmissionVital: async (admissionId: string, vital: any): Promise<any> => {
    if (window.database?.addAdmissionVital) {
      return window.database.addAdmissionVital(admissionId, vital);
    }
    const admissions = JSON.parse(localStorage.getItem('hospital_admissions') || '[]');
    const idx = admissions.findIndex((a: any) => a.id === admissionId);
    if (idx !== -1) {
      let log: any[] = [];
      try {
        log = JSON.parse(admissions[idx].vitalsLog || '[]');
      } catch (_) {}
      const recordedVital = {
        id: `VIT-${Date.now()}`,
        recordedAt: new Date().toISOString(),
        ...vital
      };
      log.unshift(recordedVital);
      admissions[idx].vitalsLog = JSON.stringify(log);
      admissions[idx].updatedAt = new Date().toISOString();
      localStorage.setItem('hospital_admissions', JSON.stringify(admissions));
      return { success: true, vital: recordedVital };
    }
    return { success: true };
  },

  addEmarOrder: async (admissionId: string, order: Partial<EmarMedicationOrder>): Promise<any> => {
    if (window.database?.addEmarOrder) {
      return window.database.addEmarOrder(admissionId, order);
    }
    const admissions = JSON.parse(localStorage.getItem('hospital_admissions') || '[]');
    const idx = admissions.findIndex((a: any) => a.id === admissionId);
    if (idx !== -1) {
      let log: any[] = [];
      try {
        log = JSON.parse(admissions[idx].emarOrdersLog || '[]');
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
      admissions[idx].emarOrdersLog = JSON.stringify(log);
      admissions[idx].updatedAt = new Date().toISOString();
      localStorage.setItem('hospital_admissions', JSON.stringify(admissions));
      return { success: true, order: newOrder };
    }
    return { success: true };
  },

  updateEmarOrderStatus: async (admissionId: string, orderId: string, status: string): Promise<any> => {
    if (window.database?.updateEmarOrderStatus) {
      return window.database.updateEmarOrderStatus(admissionId, orderId, status);
    }
    const admissions = JSON.parse(localStorage.getItem('hospital_admissions') || '[]');
    const idx = admissions.findIndex((a: any) => a.id === admissionId);
    if (idx !== -1) {
      let log: any[] = [];
      try {
        log = JSON.parse(admissions[idx].emarOrdersLog || '[]');
      } catch (_) {}
      log = log.map((o: any) => o.id === orderId ? { ...o, status } : o);
      admissions[idx].emarOrdersLog = JSON.stringify(log);
      admissions[idx].updatedAt = new Date().toISOString();
      localStorage.setItem('hospital_admissions', JSON.stringify(admissions));
      return { success: true };
    }
    return { success: true };
  },

  recordEmarAdministration: async (admissionId: string, record: Partial<EmarAdministrationRecord>): Promise<any> => {
    if (window.database?.recordEmarAdministration) {
      return window.database.recordEmarAdministration(admissionId, record);
    }
    const admissions = JSON.parse(localStorage.getItem('hospital_admissions') || '[]');
    const idx = admissions.findIndex((a: any) => a.id === admissionId);
    if (idx !== -1) {
      let log: any[] = [];
      try {
        log = JSON.parse(admissions[idx].emarAdminLog || '[]');
      } catch (_) {}
      const newAdminRecord = {
        id: `ADM-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        administeredAt: new Date().toISOString(),
        ...record
      };
      log.unshift(newAdminRecord);
      admissions[idx].emarAdminLog = JSON.stringify(log);
      admissions[idx].updatedAt = new Date().toISOString();
      localStorage.setItem('hospital_admissions', JSON.stringify(admissions));
      return { success: true, adminRecord: newAdminRecord };
    }
    return { success: true };
  },

  addFluidIoEntry: async (admissionId: string, entry: Partial<FluidIoRecord>): Promise<any> => {
    if (window.database?.addFluidIoEntry) {
      return window.database.addFluidIoEntry(admissionId, entry);
    }
    const admissions = JSON.parse(localStorage.getItem('hospital_admissions') || '[]');
    const idx = admissions.findIndex((a: any) => a.id === admissionId);
    if (idx !== -1) {
      let log: any[] = [];
      try {
        log = JSON.parse(admissions[idx].fluidIoLog || '[]');
      } catch (_) {}
      const newEntry = {
        id: `FIO-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        recordedAt: new Date().toISOString(),
        ...entry
      };
      log.unshift(newEntry);
      admissions[idx].fluidIoLog = JSON.stringify(log);
      admissions[idx].updatedAt = new Date().toISOString();
      localStorage.setItem('hospital_admissions', JSON.stringify(admissions));
      return { success: true, entry: newEntry };
    }
    return { success: true };
  },

  deleteFluidIoEntry: async (admissionId: string, entryId: string): Promise<any> => {
    if (window.database?.deleteFluidIoEntry) {
      return window.database.deleteFluidIoEntry(admissionId, entryId);
    }
    const admissions = JSON.parse(localStorage.getItem('hospital_admissions') || '[]');
    const idx = admissions.findIndex((a: any) => a.id === admissionId);
    if (idx !== -1) {
      let log: any[] = [];
      try {
        log = JSON.parse(admissions[idx].fluidIoLog || '[]');
      } catch (_) {}
      log = log.filter((e: any) => e.id !== entryId);
      admissions[idx].fluidIoLog = JSON.stringify(log);
      admissions[idx].updatedAt = new Date().toISOString();
      localStorage.setItem('hospital_admissions', JSON.stringify(admissions));
      return { success: true };
    }
    return { success: true };
  },

  addNursingShiftNote: async (admissionId: string, note: Partial<NursingShiftNote>): Promise<any> => {
    if (window.database?.addNursingShiftNote) {
      return window.database.addNursingShiftNote(admissionId, note);
    }
    const admissions = JSON.parse(localStorage.getItem('hospital_admissions') || '[]');
    const idx = admissions.findIndex((a: any) => a.id === admissionId);
    if (idx !== -1) {
      let log: any[] = [];
      try {
        log = JSON.parse(admissions[idx].nursingNotesLog || '[]');
      } catch (_) {}
      const newNote = {
        id: `NOTE-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        recordedAt: new Date().toISOString(),
        ...note
      };
      log.unshift(newNote);
      admissions[idx].nursingNotesLog = JSON.stringify(log);
      admissions[idx].updatedAt = new Date().toISOString();
      localStorage.setItem('hospital_admissions', JSON.stringify(admissions));
      return { success: true, note: newNote };
    }
    return { success: true };
  },

  deleteNursingShiftNote: async (admissionId: string, noteId: string): Promise<any> => {
    if (window.database?.deleteNursingShiftNote) {
      return window.database.deleteNursingShiftNote(admissionId, noteId);
    }
    const admissions = JSON.parse(localStorage.getItem('hospital_admissions') || '[]');
    const idx = admissions.findIndex((a: any) => a.id === admissionId);
    if (idx !== -1) {
      let log: any[] = [];
      try {
        log = JSON.parse(admissions[idx].nursingNotesLog || '[]');
      } catch (_) {}
      log = log.filter((n: any) => n.id !== noteId);
      admissions[idx].nursingNotesLog = JSON.stringify(log);
      admissions[idx].updatedAt = new Date().toISOString();
      localStorage.setItem('hospital_admissions', JSON.stringify(admissions));
      return { success: true };
    }
    return { success: true };
  },

  addAdmissionCharge: async (admissionId: string, charge: any): Promise<any> => {
    if (window.database?.addAdmissionCharge) {
      return window.database.addAdmissionCharge(admissionId, charge);
    }
    const admissions = JSON.parse(localStorage.getItem('hospital_admissions') || '[]');
    const idx = admissions.findIndex((a: any) => a.id === admissionId);
    if (idx !== -1) {
      let log: any[] = [];
      try {
        log = JSON.parse(admissions[idx].wardChargesLog || '[]');
      } catch (_) {}
      const newCharge = {
        id: `CHG-${Date.now()}`,
        recordedAt: new Date().toISOString(),
        ...charge
      };
      log.unshift(newCharge);
      admissions[idx].wardChargesLog = JSON.stringify(log);
      localStorage.setItem('hospital_admissions', JSON.stringify(admissions));
      return { success: true, charge: newCharge };
    }
    return { success: true };
  },

  deleteAdmissionCharge: async (admissionId: string, chargeId: string): Promise<any> => {
    if (window.database?.deleteAdmissionCharge) {
      return window.database.deleteAdmissionCharge(admissionId, chargeId);
    }
    const admissions = JSON.parse(localStorage.getItem('hospital_admissions') || '[]');
    const idx = admissions.findIndex((a: any) => a.id === admissionId);
    if (idx !== -1) {
      let log: any[] = [];
      try {
        log = JSON.parse(admissions[idx].wardChargesLog || '[]');
      } catch (_) {}
      log = log.filter(c => c.id !== chargeId);
      admissions[idx].wardChargesLog = JSON.stringify(log);
      localStorage.setItem('hospital_admissions', JSON.stringify(admissions));
      return { success: true };
    }
    return { success: true };
  },

  getIpdDashboardMetrics: async (): Promise<IpdDashboardMetrics> => {
    if (window.database?.getIpdDashboardMetrics) {
      return window.database.getIpdDashboardMetrics();
    }
    const beds = await storage.getBeds();
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter(b => b.status === 'occupied').length;
    const availableBeds = beds.filter(b => b.status === 'available').length;
    const cleaningBeds = beds.filter(b => b.status === 'cleaning').length;
    const maintenanceBeds = beds.filter(b => b.status === 'maintenance').length;
    return {
      totalBeds,
      occupiedBeds,
      availableBeds,
      cleaningBeds,
      maintenanceBeds,
      occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      admissionsTodayCount: 0,
      dischargesTodayCount: 0
    };
  },

  // ==========================================
  // LABORATORY & DIAGNOSTICS MODULE
  // ==========================================
  getLabTests: async (category?: string): Promise<LabTest[]> => {
    if (window.database?.getLabTests) {
      return window.database.getLabTests(category);
    }
    const raw = localStorage.getItem('clinic_lab_tests');
    const tests: LabTest[] = raw ? JSON.parse(raw) : [];
    if (category && category !== 'ALL') {
      return tests.filter(t => t.category === category && (t.isActive !== false && t.isActive !== 0));
    }
    return tests.filter(t => t.isActive !== false && t.isActive !== 0);
  },

  saveLabTest: async (test: Partial<LabTest>): Promise<any> => {
    if (window.database?.saveLabTest) {
      return window.database.saveLabTest(test);
    }
    const tests = await storage.getLabTests();
    const id = test.id || `TEST-${Date.now()}`;
    const newTest: LabTest = {
      id,
      name: test.name || 'Unnamed Test',
      code: test.code || id,
      category: test.category || 'General',
      rate: Number(test.rate) || 0,
      sampleType: test.sampleType || 'Blood (EDTA)',
      turnaroundTime: test.turnaroundTime || '2-4 Hours',
      parameters: test.parameters || [],
      description: test.description || '',
      isActive: test.isActive !== false ? 1 : 0,
      createdAt: test.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const idx = tests.findIndex(t => t.id === id);
    if (idx >= 0) tests[idx] = newTest;
    else tests.push(newTest);
    localStorage.setItem('clinic_lab_tests', JSON.stringify(tests));
    return { success: true, id };
  },

  deleteLabTest: async (id: string): Promise<any> => {
    if (window.database?.deleteLabTest) {
      return window.database.deleteLabTest(id);
    }
    const tests = (await storage.getLabTests()).filter(t => t.id !== id);
    localStorage.setItem('clinic_lab_tests', JSON.stringify(tests));
    return { success: true };
  },

  getNextLabOrderNumber: async (): Promise<string> => {
    if (window.database?.getNextLabOrderNumber) {
      return window.database.getNextLabOrderNumber();
    }
    const raw = localStorage.getItem('last_lab_order_num') || '1000';
    const next = parseInt(raw, 10) + 1;
    localStorage.setItem('last_lab_order_num', next.toString());
    return `LAB-${next}`;
  },

  getLabOrders: async (): Promise<LabOrder[]> => {
    if (window.database?.getLabOrders) {
      return window.database.getLabOrders();
    }
    const raw = localStorage.getItem('clinic_lab_orders');
    return raw ? JSON.parse(raw) : [];
  },

  getLabOrderById: async (id: string): Promise<LabOrder | null> => {
    if (window.database?.getLabOrderById) {
      return window.database.getLabOrderById(id);
    }
    const orders = await storage.getLabOrders();
    return orders.find(o => o.id === id) || null;
  },

  saveLabOrder: async (order: Partial<LabOrder>): Promise<any> => {
    let result: any;
    if (window.database?.saveLabOrder) {
      result = await window.database.saveLabOrder(order);
      notifyDataChanged('lab');
      return result;
    }
    const orders = await storage.getLabOrders();
    const id = order.id || `LABORD-${Date.now()}`;
    const orderNumber = order.orderNumber || (await storage.getNextLabOrderNumber());
    const newOrder: LabOrder = {
      id,
      orderNumber,
      patientId: order.patientId || '',
      patientName: order.patientName || 'Patient',
      patientPhone: order.patientPhone || '',
      patientGender: order.patientGender || '',
      patientAge: order.patientAge || '',
      doctorId: order.doctorId || '',
      doctorName: order.doctorName || 'Self / Walk-in',
      prescriptionId: order.prescriptionId || '',
      tests: order.tests || [],
      totalAmount: Number(order.totalAmount) || 0,
      discount: Number(order.discount) || 0,
      paidAmount: Number(order.paidAmount) || 0,
      paymentMode: order.paymentMode || 'CASH',
      status: order.status || 'ORDERED',
      sampleCollectedAt: order.sampleCollectedAt,
      sampleCollectedBy: order.sampleCollectedBy,
      completedAt: order.completedAt,
      technicianNotes: order.technicianNotes || '',
      pathologistRemarks: order.pathologistRemarks || '',
      orderDate: order.orderDate || new Date().toISOString().split('T')[0],
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const idx = orders.findIndex(o => o.id === id);
    if (idx >= 0) orders[idx] = newOrder;
    else orders.unshift(newOrder);
    localStorage.setItem('clinic_lab_orders', JSON.stringify(orders));
    notifyDataChanged('lab');
    return { success: true, id, orderNumber };
  },

  updateLabOrderStatus: async (id: string, status: string, details?: any): Promise<any> => {
    let result: any;
    if (window.database?.updateLabOrderStatus) {
      result = await window.database.updateLabOrderStatus(id, status, details);
      notifyDataChanged('lab');
      return result;
    }
    const orders = await storage.getLabOrders();
    const order = orders.find(o => o.id === id);
    if (order) {
      order.status = status as any;
      if (status === 'SAMPLE_COLLECTED') {
        order.sampleCollectedAt = details?.sampleCollectedAt || new Date().toISOString();
        order.sampleCollectedBy = details?.sampleCollectedBy || 'Lab Desk';
      }
      if (status === 'COMPLETED') {
        order.completedAt = new Date().toISOString();
      }
      order.updatedAt = new Date().toISOString();
      localStorage.setItem('clinic_lab_orders', JSON.stringify(orders));
    }
    notifyDataChanged('lab');
    return { success: true };
  },

  saveLabOrderResults: async (id: string, testsWithResults: any[], pathologistRemarks?: string): Promise<any> => {
    let result: any;
    if (window.database?.saveLabOrderResults) {
      result = await window.database.saveLabOrderResults(id, testsWithResults, pathologistRemarks);
      notifyDataChanged('lab');
      return result;
    }
    const orders = await storage.getLabOrders();
    const order = orders.find(o => o.id === id);
    if (order) {
      order.tests = testsWithResults;
      if (pathologistRemarks !== undefined) order.pathologistRemarks = pathologistRemarks;
      const allDone = testsWithResults.every((t: any) => t.results && t.results.length > 0 && t.results.some((r: any) => r.value !== undefined && r.value !== ''));
      order.status = allDone ? 'COMPLETED' : 'IN_ANALYSIS';
      if (order.status === 'COMPLETED') order.completedAt = new Date().toISOString();
      order.updatedAt = new Date().toISOString();
      localStorage.setItem('clinic_lab_orders', JSON.stringify(orders));
    }
    notifyDataChanged('lab');
    return { success: true };
  },

  deleteLabOrder: async (id: string): Promise<any> => {
    if (window.database?.deleteLabOrder) {
      const res = await window.database.deleteLabOrder(id);
      notifyDataChanged('lab');
      return res;
    }
    const orders = (await storage.getLabOrders()).filter(o => o.id !== id);
    localStorage.setItem('clinic_lab_orders', JSON.stringify(orders));
    notifyDataChanged('lab');
    return { success: true };
  },

  getLabDashboardMetrics: async (): Promise<LabDashboardMetrics> => {
    if (window.database?.getLabDashboardMetrics) {
      return window.database.getLabDashboardMetrics();
    }
    const orders = await storage.getLabOrders();
    const today = new Date().toISOString().split('T')[0];
    return {
      ordersTodayCount: orders.filter(o => o.orderDate?.startsWith(today)).length,
      samplesPendingCount: orders.filter(o => o.status === 'ORDERED').length,
      inAnalysisCount: orders.filter(o => o.status === 'SAMPLE_COLLECTED' || o.status === 'IN_ANALYSIS').length,
      completedTodayCount: orders.filter(o => o.status === 'COMPLETED' && o.completedAt?.startsWith(today)).length
    };
  },

  // TPA & Health Insurance Methods
  getTpaProviders: async (): Promise<TpaProvider[]> => {
    if (window.database?.getTpaProviders) {
      return window.database.getTpaProviders();
    }
    const data = localStorage.getItem('clinic_tpa_providers');
    if (!data) {
      const defaultTpas: TpaProvider[] = [
        { id: 'TPA-STAR', name: 'Star Health & Allied Insurance', code: 'STAR-HEALTH', contactEmail: 'cashless@starhealth.in', contactPhone: '1800-425-2255', portalUrl: 'https://www.starhealth.in', defaultCopayPercent: 0, isActive: true },
        { id: 'TPA-MEDI', name: 'Medi Assist Insurance TPA', code: 'MEDI-ASSIST', contactEmail: 'claims@mediassist.in', contactPhone: '1800-425-9449', portalUrl: 'https://mediassisttpa.in', defaultCopayPercent: 0, isActive: true },
        { id: 'TPA-VIDAL', name: 'Vidal Health Insurance TPA', code: 'VIDAL-TPA', contactEmail: 'cashless@vidalhealthtpa.com', contactPhone: '1800-102-4488', portalUrl: 'https://vidalhealthtpa.com', defaultCopayPercent: 10, isActive: true },
        { id: 'TPA-HDFC', name: 'HDFC ERGO General Insurance', code: 'HDFC-ERGO', contactEmail: 'care@hdfcergo.com', contactPhone: '022-6234-6234', portalUrl: 'https://hdfcergo.com', defaultCopayPercent: 0, isActive: true },
        { id: 'TPA-ICICI', name: 'ICICI Lombard General Insurance', code: 'ICICI-LOMB', contactEmail: 'cashless@icicilombard.com', contactPhone: '1800-2666', portalUrl: 'https://icicilombard.com', defaultCopayPercent: 0, isActive: true },
        { id: 'TPA-PARAMOUNT', name: 'Paramount Health Services TPA', code: 'PARAMOUNT-TPA', contactEmail: 'claims@paramounttpa.com', contactPhone: '022-6662-0808', portalUrl: 'https://paramounttpa.com', defaultCopayPercent: 10, isActive: true },
        { id: 'TPA-MDINDIA', name: 'MDIndia Health Insurance TPA', code: 'MD-INDIA', contactEmail: 'customercare@mdindia.com', contactPhone: '1800-233-1166', portalUrl: 'https://mdindiaonline.com', defaultCopayPercent: 0, isActive: true },
        { id: 'TPA-CARE', name: 'Care Health Insurance', code: 'CARE-HEALTH', contactEmail: 'customerfirst@careinsurance.com', contactPhone: '1800-102-4455', portalUrl: 'https://careinsurance.com', defaultCopayPercent: 0, isActive: true }
      ];
      localStorage.setItem('clinic_tpa_providers', JSON.stringify(defaultTpas));
      return defaultTpas;
    }
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveTpaProvider: async (provider: Partial<TpaProvider>): Promise<any> => {
    if (window.database?.saveTpaProvider) {
      return window.database.saveTpaProvider(provider);
    }
    const list = await storage.getTpaProviders();
    const id = provider.id || `TPA-${Date.now()}`;
    const newProvider: TpaProvider = {
      id,
      name: provider.name || 'Insurance Provider',
      code: provider.code || 'TPA',
      contactEmail: provider.contactEmail || '',
      contactPhone: provider.contactPhone || '',
      portalUrl: provider.portalUrl || '',
      defaultCopayPercent: Number(provider.defaultCopayPercent) || 0,
      isActive: provider.isActive !== undefined ? provider.isActive : true,
      createdAt: provider.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const idx = list.findIndex(p => p.id === id);
    if (idx >= 0) list[idx] = newProvider;
    else list.push(newProvider);
    localStorage.setItem('clinic_tpa_providers', JSON.stringify(list));
    return { success: true, id };
  },

  deleteTpaProvider: async (id: string): Promise<any> => {
    if (window.database?.deleteTpaProvider) {
      return window.database.deleteTpaProvider(id);
    }
    const list = (await storage.getTpaProviders()).filter(p => p.id !== id);
    localStorage.setItem('clinic_tpa_providers', JSON.stringify(list));
    return { success: true };
  },

  getInsuranceClaims: async (options?: { status?: string; admissionId?: string }): Promise<InsuranceClaim[]> => {
    if (window.database?.getInsuranceClaims) {
      return window.database.getInsuranceClaims(options);
    }
    const data = localStorage.getItem('clinic_insurance_claims');
    let list: InsuranceClaim[] = [];
    try {
      list = data ? JSON.parse(data) : [];
    } catch {
      list = [];
    }
    if (options?.status) {
      list = list.filter(c => c.status === options.status);
    }
    if (options?.admissionId) {
      list = list.filter(c => c.admissionId === options.admissionId);
    }
    return list;
  },

  getInsuranceClaimById: async (id: string): Promise<InsuranceClaim | null> => {
    if (window.database?.getInsuranceClaimById) {
      return window.database.getInsuranceClaimById(id);
    }
    const list = await storage.getInsuranceClaims();
    return list.find(c => c.id === id) || null;
  },

  saveInsuranceClaim: async (claim: Partial<InsuranceClaim>): Promise<any> => {
    let result: any;
    if (window.database?.saveInsuranceClaim) {
      result = await window.database.saveInsuranceClaim(claim);
      notifyDataChanged('insurance');
      return result;
    }
    const list = await storage.getInsuranceClaims();
    const id = claim.id || `CLM-${Date.now()}`;
    const claimNumber = claim.claimNumber || `CLM-${Math.floor(100000 + Math.random() * 900000)}`;
    const newClaim: InsuranceClaim = {
      id,
      claimNumber,
      admissionId: claim.admissionId,
      patientId: claim.patientId,
      patientUhid: claim.patientUhid,
      patientName: claim.patientName || 'Patient',
      patientPhone: claim.patientPhone || '',
      tpaProviderId: claim.tpaProviderId || '',
      tpaProviderName: claim.tpaProviderName || '',
      insurerName: claim.insurerName || '',
      policyNumber: claim.policyNumber || '',
      cardId: claim.cardId || '',
      corporateName: claim.corporateName || '',
      sumInsured: Number(claim.sumInsured) || 0,
      initialPreAuthAmount: Number(claim.initialPreAuthAmount) || 0,
      approvedAmount: Number(claim.approvedAmount) || 0,
      finalSettledAmount: Number(claim.finalSettledAmount) || 0,
      copayPercent: Number(claim.copayPercent) || 0,
      nonPayableDeductions: Number(claim.nonPayableDeductions) || 0,
      status: claim.status || 'PREAUTH_DRAFT',
      queriesLog: typeof claim.queriesLog === 'string' ? claim.queriesLog : JSON.stringify(claim.queriesLog || []),
      preAuthLetterRef: claim.preAuthLetterRef || '',
      settlementDate: claim.settlementDate,
      notes: claim.notes || '',
      createdAt: claim.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const idx = list.findIndex(c => c.id === id);
    if (idx >= 0) list[idx] = newClaim;
    else list.unshift(newClaim);
    localStorage.setItem('clinic_insurance_claims', JSON.stringify(list));
    notifyDataChanged('insurance');
    return { success: true, id, claimNumber };
  },

  updateClaimStatus: async (id: string, status: string, notes?: string): Promise<any> => {
    let result: any;
    if (window.database?.updateClaimStatus) {
      result = await window.database.updateClaimStatus(id, status, notes);
      notifyDataChanged('insurance');
      return result;
    }
    const list = await storage.getInsuranceClaims();
    const claim = list.find(c => c.id === id);
    if (claim) {
      claim.status = status as any;
      if (notes) claim.notes = notes;
      if (status === 'SETTLED') claim.settlementDate = new Date().toISOString().split('T')[0];
      claim.updatedAt = new Date().toISOString();
      localStorage.setItem('clinic_insurance_claims', JSON.stringify(list));
    }
    notifyDataChanged('insurance');
    return { success: true };
  },

  addClaimQuery: async (claimId: string, query: any): Promise<any> => {
    let result: any;
    if (window.database?.addClaimQuery) {
      result = await window.database.addClaimQuery(claimId, query);
      notifyDataChanged('insurance');
      return result;
    }
    const list = await storage.getInsuranceClaims();
    const claim = list.find(c => c.id === claimId);
    if (claim) {
      let queries: any[] = [];
      try {
        queries = claim.queriesLog ? JSON.parse(claim.queriesLog) : [];
      } catch (_) {}
      queries.push({
        id: `QRY-${Date.now()}`,
        queryReceivedAt: query.queryReceivedAt || new Date().toISOString(),
        queryDetails: query.queryDetails || '',
        replySentAt: query.replySentAt,
        replyDetails: query.replyDetails,
        repliedBy: query.repliedBy
      });
      claim.queriesLog = JSON.stringify(queries);
      claim.status = 'QUERY_RAISED';
      claim.updatedAt = new Date().toISOString();
      localStorage.setItem('clinic_insurance_claims', JSON.stringify(list));
    }
    notifyDataChanged('insurance');
    return { success: true };
  },

  getInsuranceDashboardMetrics: async (): Promise<InsuranceDashboardMetrics> => {
    if (window.database?.getInsuranceDashboardMetrics) {
      return window.database.getInsuranceDashboardMetrics();
    }
    const claims = await storage.getInsuranceClaims();
    return {
      totalClaims: claims.length,
      activeClaims: claims.filter(c => c.status !== 'REJECTED' && c.status !== 'SETTLED').length,
      pendingApprovals: claims.filter(c => ['PREAUTH_DRAFT', 'SUBMITTED', 'QUERY_RAISED', 'ENHANCEMENT_REQUESTED'].includes(c.status)).length,
      approvedTotalAmount: claims.filter(c => c.status !== 'REJECTED').reduce((sum, c) => sum + (Number(c.approvedAmount) || 0), 0),
      settledTotalAmount: claims.filter(c => c.status === 'SETTLED').reduce((sum, c) => sum + (Number(c.finalSettledAmount) || 0), 0)
    };
  },

  // Discharge Summary Methods
  saveDischargeSummary: async (admissionId: string, summary: DischargeSummaryData): Promise<any> => {
    if (window.database?.saveDischargeSummary) {
      return window.database.saveDischargeSummary(admissionId, summary);
    }
    const admissions = await storage.getBedAdmissions();
    const adm = admissions.find(a => a.id === admissionId);
    if (adm) {
      adm.dischargeSummary = JSON.stringify(summary);
      adm.updatedAt = new Date().toISOString();
      localStorage.setItem('clinic_bed_admissions', JSON.stringify(admissions));
    }
    return { success: true };
  },

  getDischargeSummary: async (admissionId: string): Promise<DischargeSummaryData | null> => {
    if (window.database?.getDischargeSummary) {
      return window.database.getDischargeSummary(admissionId);
    }
    const admissions = await storage.getBedAdmissions();
    const adm = admissions.find(a => a.id === admissionId);
    if (!adm || !adm.dischargeSummary) return null;
    try {
      return JSON.parse(adm.dischargeSummary);
    } catch {
      return null;
    }
  },

  // ── Operation Theatre (OT) Methods ──────────────────────────────────────────
  getOperationTheatres: async (): Promise<OperationTheatre[]> => {
    if (window.database?.getOperationTheatres) {
      return window.database.getOperationTheatres();
    }
    const data = localStorage.getItem('clinic_operation_theatres');
    if (!data) {
      const defaults: OperationTheatre[] = [
        { id: 'OT-MAIN-01', name: 'Main Major OT 1 (General & Laparoscopy)', code: 'OT-1', theatreType: 'MAJOR', floor: '1st Floor - Surgical Wing', dailyRate: 5000, status: 'AVAILABLE', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'OT-MOD-02', name: 'Modular OT 2 (Ortho & Joint Replacement)', code: 'OT-2', theatreType: 'MODULAR', floor: '1st Floor - Surgical Wing', dailyRate: 7500, status: 'AVAILABLE', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'OT-MIN-03', name: 'Minor OT & Daycare Endoscopy Suite', code: 'OT-3', theatreType: 'MINOR', floor: 'Ground Floor - Daycare', dailyRate: 2500, status: 'AVAILABLE', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: 'OT-CATH-04', name: 'Cath Lab & Interventional Suite', code: 'OT-4', theatreType: 'CATH_LAB', floor: 'Basement - Cath Wing', dailyRate: 8000, status: 'AVAILABLE', isActive: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ];
      localStorage.setItem('clinic_operation_theatres', JSON.stringify(defaults));
      return defaults;
    }
    return JSON.parse(data);
  },

  saveOperationTheatre: async (ot: Partial<OperationTheatre>): Promise<{ success: boolean; id: string }> => {
    let result: { success: boolean; id: string };
    if (window.database?.saveOperationTheatre) {
      result = await window.database.saveOperationTheatre(ot);
    } else {
      const list = await storage.getOperationTheatres();
      const id = ot.id || 'OT-' + Date.now();
      const existingIdx = list.findIndex(o => o.id === id);
      const item: OperationTheatre = {
        id,
        name: ot.name || 'Operating Theatre',
        code: ot.code || 'OT',
        theatreType: ot.theatreType || 'MAJOR',
        floor: ot.floor || '',
        dailyRate: ot.dailyRate || 0,
        status: ot.status || 'AVAILABLE',
        isActive: ot.isActive !== false,
        createdAt: existingIdx >= 0 ? list[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        list[existingIdx] = item;
      } else {
        list.push(item);
      }
      localStorage.setItem('clinic_operation_theatres', JSON.stringify(list));
      result = { success: true, id };
    }
    notifyDataChanged('ot');
    return result;
  },

  deleteOperationTheatre: async (id: string): Promise<{ success: boolean }> => {
    let result: { success: boolean };
    if (window.database?.deleteOperationTheatre) {
      result = await window.database.deleteOperationTheatre(id);
    } else {
      const list = await storage.getOperationTheatres();
      const filtered = list.filter(o => o.id !== id);
      localStorage.setItem('clinic_operation_theatres', JSON.stringify(filtered));
      result = { success: true };
    }
    notifyDataChanged('ot');
    return result;
  },

  // ── Surgical Cases Methods ──────────────────────────────────────────────────
  getSurgicalCases: async (options?: { date?: string; status?: string; theatreId?: string }): Promise<SurgicalCase[]> => {
    if (window.database?.getSurgicalCases) {
      return window.database.getSurgicalCases(options);
    }
    const data = localStorage.getItem('clinic_surgical_cases');
    let list: SurgicalCase[] = data ? JSON.parse(data) : [];
    if (options?.date) {
      list = list.filter(c => c.scheduledDate === options.date);
    }
    if (options?.status && options.status !== 'ALL') {
      list = list.filter(c => c.status === options.status);
    }
    if (options?.theatreId && options.theatreId !== 'ALL') {
      list = list.filter(c => c.theatreId === options.theatreId);
    }
    return list;
  },

  getSurgicalCaseById: async (id: string): Promise<SurgicalCase | null> => {
    if (window.database?.getSurgicalCaseById) {
      return window.database.getSurgicalCaseById(id);
    }
    const list = await storage.getSurgicalCases();
    return list.find(c => c.id === id) || null;
  },

  saveSurgicalCase: async (sc: Partial<SurgicalCase>): Promise<{ success: boolean; id: string; caseNumber: string }> => {
    let result: { success: boolean; id: string; caseNumber: string };
    if (window.database?.saveSurgicalCase) {
      result = await window.database.saveSurgicalCase(sc);
    } else {
      const list = await storage.getSurgicalCases();
      const id = sc.id || 'SC-' + Date.now();
      const existingIdx = list.findIndex(c => c.id === id);
      const caseNumber = sc.caseNumber || (existingIdx >= 0 ? list[existingIdx].caseNumber : `OT-${new Date().getFullYear()}-${String(list.length + 1).padStart(4, '0')}`);
      const item: SurgicalCase = {
        id,
        caseNumber,
        patientId: sc.patientId,
        patientUhid: sc.patientUhid,
        patientName: sc.patientName || 'Patient',
        patientPhone: sc.patientPhone,
        patientAge: sc.patientAge,
        patientGender: sc.patientGender,
        admissionId: sc.admissionId,
        theatreId: sc.theatreId || '',
        theatreName: sc.theatreName || '',
        surgeryName: sc.surgeryName || 'Surgery',
        surgeryCategory: sc.surgeryCategory || 'GENERAL',
        urgency: sc.urgency || 'ELECTIVE',
        primarySurgeonId: sc.primarySurgeonId || '',
        primarySurgeonName: sc.primarySurgeonName || '',
        assistantSurgeonName: sc.assistantSurgeonName,
        anesthetistName: sc.anesthetistName,
        scrubNurseName: sc.scrubNurseName,
        circulatingNurseName: sc.circulatingNurseName,
        scheduledDate: sc.scheduledDate || new Date().toISOString().split('T')[0],
        startTime: sc.startTime || '09:00',
        endTime: sc.endTime,
        status: sc.status || 'SCHEDULED',
        pacData: sc.pacData,
        whoChecklistData: sc.whoChecklistData,
        intraOpNotes: sc.intraOpNotes,
        pacuData: sc.pacuData,
        chargesLogged: sc.chargesLogged || [],
        notes: sc.notes,
        createdAt: existingIdx >= 0 ? list[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        list[existingIdx] = item;
      } else {
        list.push(item);
      }
      localStorage.setItem('clinic_surgical_cases', JSON.stringify(list));
      result = { success: true, id, caseNumber };
    }
    notifyDataChanged('ot');
    return result;
  },

  updateSurgicalCaseStatus: async (id: string, status: SurgicalCaseStatus, notes?: string): Promise<{ success: boolean }> => {
    let result: { success: boolean };
    if (window.database?.updateSurgicalCaseStatus) {
      result = await window.database.updateSurgicalCaseStatus(id, status, notes);
    } else {
      const list = await storage.getSurgicalCases();
      const item = list.find(c => c.id === id);
      if (item) {
        item.status = status;
        if (notes) item.notes = notes;
        item.updatedAt = new Date().toISOString();
        localStorage.setItem('clinic_surgical_cases', JSON.stringify(list));
      }
      result = { success: true };
    }
    notifyDataChanged('ot');
    return result;
  },

  getOtDashboardMetrics: async (): Promise<OtDashboardMetrics> => {
    if (window.database?.getOtDashboardMetrics) {
      return window.database.getOtDashboardMetrics();
    }
    const theatres = await storage.getOperationTheatres();
    const cases = await storage.getSurgicalCases();
    const today = new Date().toISOString().split('T')[0];
    return {
      totalTheatres: theatres.filter(t => t.isActive).length,
      todayCases: cases.filter(c => c.scheduledDate === today).length,
      inSurgery: cases.filter(c => c.status === 'IN_THEATRE').length,
      inPacu: cases.filter(c => c.status === 'RECOVERY_PACU').length,
      completedSurgeries: cases.filter(c => c.status === 'COMPLETED').length
    };
  },

  // ── Emergency Department & Casualty Triage Methods ──────────────────────────
  getEmergencyVisits: async (options?: { status?: string; isMlc?: boolean; date?: string }): Promise<EmergencyVisit[]> => {
    if (window.database?.getEmergencyVisits) {
      return window.database.getEmergencyVisits(options);
    }
    const data = localStorage.getItem('clinic_emergency_visits');
    let list: EmergencyVisit[] = data ? JSON.parse(data) : [];
    if (options?.status && options.status !== 'ALL') {
      list = list.filter(v => v.disposition === options.status);
    }
    if (options?.isMlc !== undefined) {
      list = list.filter(v => v.isMlc === options.isMlc);
    }
    if (options?.date) {
      list = list.filter(v => v.arrivedAt.startsWith(options.date!));
    }
    return list.sort((a, b) => a.triageLevel - b.triageLevel);
  },

  getEmergencyVisitById: async (id: string): Promise<EmergencyVisit | null> => {
    if (window.database?.getEmergencyVisitById) {
      return window.database.getEmergencyVisitById(id);
    }
    const list = await storage.getEmergencyVisits();
    return list.find(v => v.id === id) || null;
  },

  saveEmergencyVisit: async (ev: Partial<EmergencyVisit>): Promise<{ success: boolean; id: string; emergencyNumber: string }> => {
    let result: { success: boolean; id: string; emergencyNumber: string };
    if (window.database?.saveEmergencyVisit) {
      result = await window.database.saveEmergencyVisit(ev);
    } else {
      const list = await storage.getEmergencyVisits();
      const id = ev.id || 'ER-' + Date.now();
      const existingIdx = list.findIndex(v => v.id === id);
      const emergencyNumber = ev.emergencyNumber || (existingIdx >= 0 ? list[existingIdx].emergencyNumber : `ER-${new Date().getFullYear()}-${String(list.length + 1).padStart(4, '0')}`);
      const item: EmergencyVisit = {
        id,
        emergencyNumber,
        patientId: ev.patientId,
        patientUhid: ev.patientUhid,
        patientName: ev.patientName || 'Emergency Patient',
        patientPhone: ev.patientPhone,
        patientAge: ev.patientAge,
        patientGender: ev.patientGender,
        triageLevel: ev.triageLevel || 3,
        triageCategory: ev.triageCategory || 'YELLOW',
        chiefComplaint: ev.chiefComplaint || 'Emergency Assessment',
        triageVitals: ev.triageVitals,
        triageNurseName: ev.triageNurseName,
        attendingDoctorId: ev.attendingDoctorId,
        attendingDoctorName: ev.attendingDoctorName,
        arrivedAt: ev.arrivedAt || new Date().toISOString(),
        disposition: ev.disposition || 'UNDER_TREATMENT',
        dispositionNotes: ev.dispositionNotes,
        dischargedAt: ev.dischargedAt,
        admittedBedId: ev.admittedBedId,
        admittedAdmissionId: ev.admittedAdmissionId,
        isMlc: Boolean(ev.isMlc),
        mlcNumber: ev.mlcNumber,
        mlcData: ev.mlcData,
        notes: ev.notes,
        createdAt: existingIdx >= 0 ? list[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        list[existingIdx] = item;
      } else {
        list.push(item);
      }
      localStorage.setItem('clinic_emergency_visits', JSON.stringify(list));
      result = { success: true, id, emergencyNumber };
    }
    notifyDataChanged('emergency');
    return result;
  },

  updateEmergencyDisposition: async (id: string, disposition: EmergencyDisposition, details?: any): Promise<{ success: boolean }> => {
    let result: { success: boolean };
    if (window.database?.updateEmergencyDisposition) {
      result = await window.database.updateEmergencyDisposition(id, disposition, details);
    } else {
      const list = await storage.getEmergencyVisits();
      const item = list.find(v => v.id === id);
      if (item) {
        item.disposition = disposition;
        if (details?.notes) item.dispositionNotes = details.notes;
        if (details?.admittedBedId) item.admittedBedId = details.admittedBedId;
        if (details?.admittedAdmissionId) item.admittedAdmissionId = details.admittedAdmissionId;
        if (disposition === 'DISCHARGED' || disposition === 'LAMA') {
          item.dischargedAt = new Date().toISOString();
        }
        item.updatedAt = new Date().toISOString();
        localStorage.setItem('clinic_emergency_visits', JSON.stringify(list));
      }
      result = { success: true };
    }
    notifyDataChanged('emergency');
    if (details?.admittedBedId) {
      notifyDataChanged('beds');
    }
    return result;
  },

  // ── Medico-Legal Cases (MLC) Registry Methods ───────────────────────────────
  getMlcRecords: async (): Promise<MlcRecord[]> => {
    if (window.database?.getMlcRecords) {
      return window.database.getMlcRecords();
    }
    const data = localStorage.getItem('clinic_mlc_records');
    return data ? JSON.parse(data) : [];
  },

  getMlcRecordById: async (id: string): Promise<MlcRecord | null> => {
    if (window.database?.getMlcRecordById) {
      return window.database.getMlcRecordById(id);
    }
    const list = await storage.getMlcRecords();
    return list.find(m => m.id === id) || null;
  },

  saveMlcRecord: async (mlc: Partial<MlcRecord>): Promise<{ success: boolean; id: string; mlcNumber: string }> => {
    let result: { success: boolean; id: string; mlcNumber: string };
    if (window.database?.saveMlcRecord) {
      result = await window.database.saveMlcRecord(mlc);
    } else {
      const list = await storage.getMlcRecords();
      const id = mlc.id || 'MLC-' + Date.now();
      const existingIdx = list.findIndex(m => m.id === id);
      const mlcNumber = mlc.mlcNumber || (existingIdx >= 0 ? list[existingIdx].mlcNumber : `MLC-${new Date().getFullYear()}-${String(list.length + 1).padStart(4, '0')}`);
      const item: MlcRecord = {
        id,
        mlcNumber,
        emergencyVisitId: mlc.emergencyVisitId,
        patientId: mlc.patientId,
        patientName: mlc.patientName || 'MLC Patient',
        patientAge: mlc.patientAge,
        patientGender: mlc.patientGender,
        policeStation: mlc.policeStation || 'Local Police Station',
        policeOfficerName: mlc.policeOfficerName,
        policeBadgeNumber: mlc.policeBadgeNumber,
        incidentDate: mlc.incidentDate || new Date().toISOString(),
        incidentPlace: mlc.incidentPlace,
        incidentType: mlc.incidentType || 'RTA',
        broughtByName: mlc.broughtByName || 'Police / Ambulance',
        broughtByPhone: mlc.broughtByPhone,
        broughtByRelation: mlc.broughtByRelation,
        injuryDescription: mlc.injuryDescription || 'Injury recorded on casualty admission',
        injuryType: mlc.injuryType || 'SIMPLE',
        weaponType: mlc.weaponType,
        alcoholSmellDetected: Boolean(mlc.alcoholSmellDetected),
        dyingDeclarationRequired: Boolean(mlc.dyingDeclarationRequired),
        intimationSentAt: mlc.intimationSentAt,
        certificateIssuedAt: mlc.certificateIssuedAt,
        doctorSignatureName: mlc.doctorSignatureName || 'Casualty Medical Officer (CMO)',
        status: mlc.status || 'REGISTERED',
        createdAt: existingIdx >= 0 ? list[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        list[existingIdx] = item;
      } else {
        list.push(item);
      }
      localStorage.setItem('clinic_mlc_records', JSON.stringify(list));
      result = { success: true, id, mlcNumber };
    }
    notifyDataChanged('emergency');
    return result;
  },

  getEmergencyDashboardMetrics: async (): Promise<EmergencyDashboardMetrics> => {
    if (window.database?.getEmergencyDashboardMetrics) {
      return window.database.getEmergencyDashboardMetrics();
    }
    const visits = await storage.getEmergencyVisits();
    const active = visits.filter(v => v.disposition === 'UNDER_TREATMENT');
    const mlc = await storage.getMlcRecords();
    return {
      activeVisits: active.length,
      redResuscitation: active.filter(v => v.triageLevel === 1).length,
      orangeEmergent: active.filter(v => v.triageLevel === 2).length,
      yellowUrgent: active.filter(v => v.triageLevel === 3).length,
      greenNonUrgent: active.filter(v => v.triageLevel >= 4).length,
      totalMlcCases: mlc.length
    };
  },

  // ── Module 3: Doctor Revenue Share & Payouts Engine ────────────────────────
  getDoctorCommissionRules: async (): Promise<DoctorCommissionRule[]> => {
    if (window.database?.getDoctorCommissionRules) {
      return window.database.getDoctorCommissionRules();
    }
    const data = localStorage.getItem('clinic_doctor_commission_rules');
    return data ? JSON.parse(data) : [];
  },

  getDoctorCommissionRuleByDoctorId: async (doctorId: string): Promise<DoctorCommissionRule | null> => {
    if (window.database?.getDoctorCommissionRuleByDoctorId) {
      return window.database.getDoctorCommissionRuleByDoctorId(doctorId);
    }
    const rules = await storage.getDoctorCommissionRules();
    return rules.find(r => r.doctorId === doctorId) || null;
  },

  saveDoctorCommissionRule: async (rule: Partial<DoctorCommissionRule>): Promise<{ success: boolean; id: string }> => {
    if (window.database?.saveDoctorCommissionRule) {
      return window.database.saveDoctorCommissionRule(rule);
    }
    const rules = await storage.getDoctorCommissionRules();
    const existingIdx = rules.findIndex(r => r.doctorId === rule.doctorId);
    const id = rule.id || (existingIdx >= 0 ? rules[existingIdx].id : `COMM-${Date.now()}`);
    const item: DoctorCommissionRule = {
      id,
      doctorId: rule.doctorId || '',
      doctorName: rule.doctorName || 'Doctor',
      opdType: rule.opdType || 'PERCENT',
      opdValue: rule.opdValue ?? 70,
      ipdVisitRate: rule.ipdVisitRate ?? 800,
      surgerySharePercent: rule.surgerySharePercent ?? 60,
      assistantSurgeonPercent: rule.assistantSurgeonPercent ?? 15,
      anesthetistPercent: rule.anesthetistPercent ?? 25,
      labReferralPercent: rule.labReferralPercent ?? 10,
      pharmacyReferralPercent: rule.pharmacyReferralPercent ?? 0,
      tdsPercent: rule.tdsPercent ?? 10,
      hospitalFacilityRetentionPercent: rule.hospitalFacilityRetentionPercent ?? 0,
      isActive: rule.isActive ?? 1,
      createdAt: existingIdx >= 0 ? rules[existingIdx].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      rules[existingIdx] = item;
    } else {
      rules.push(item);
    }
    localStorage.setItem('clinic_doctor_commission_rules', JSON.stringify(rules));
    return { success: true, id };
  },

  calculateDoctorAccruedEarnings: async (doctorId: string, startDate?: string, endDate?: string): Promise<DoctorAccruedEarnings | null> => {
    if (window.database?.calculateDoctorAccruedEarnings) {
      return window.database.calculateDoctorAccruedEarnings(doctorId, startDate, endDate);
    }
    const docs = await storage.getDoctors();
    const doc = docs.find(d => d.id === doctorId);
    if (!doc) return null;
    const rule = await storage.getDoctorCommissionRuleByDoctorId(doctorId) || {
      id: 'default',
      doctorId,
      doctorName: doc.name,
      opdType: 'PERCENT' as const,
      opdValue: 70,
      ipdVisitRate: 800,
      surgerySharePercent: 60,
      assistantSurgeonPercent: 15,
      anesthetistPercent: 25,
      labReferralPercent: 10,
      pharmacyReferralPercent: 0,
      tdsPercent: 10,
      hospitalFacilityRetentionPercent: 0,
      isActive: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const receipts = (await storage.getReceipts()).filter(r => r.doctorId === doctorId);
    const opdRevenue = receipts.reduce((s, r) => s + (Number(r.total) || 0), 0);
    const opdEarnings = rule.opdType === 'FLAT' ? receipts.length * rule.opdValue : opdRevenue * (rule.opdValue / 100);
    const gross = opdEarnings;
    const tds = gross * (rule.tdsPercent / 100);
    const facility = gross * (rule.hospitalFacilityRetentionPercent / 100);
    const net = Math.max(0, gross - tds - facility);
    const paidTxs = (await storage.getDoctorPayoutTransactions(doctorId)).filter(t => t.status === 'PAID');
    const totalPaid = paidTxs.reduce((s, t) => s + (t.netPayoutAmount || 0), 0);
    return {
      doctorId,
      doctorName: doc.name,
      periodStart: startDate || 'All Time',
      periodEnd: endDate || 'Present',
      opdReceiptsCount: receipts.length,
      opdRevenue,
      opdEarnings,
      ipdVisitsCount: 0,
      ipdEarnings: 0,
      surgeryCount: 0,
      surgeryEarnings: 0,
      labOrdersCount: 0,
      labRevenue: 0,
      labEarnings: 0,
      grossEarnings: gross,
      tdsDeduction: tds,
      hospitalFacilityDeduction: facility,
      netPayable: net,
      totalPaidAlready: totalPaid,
      balanceOutstanding: Math.max(0, net - totalPaid),
      rule
    };
  },

  getDoctorPayoutTransactions: async (doctorId?: string): Promise<DoctorPayoutTransaction[]> => {
    if (window.database?.getDoctorPayoutTransactions) {
      return window.database.getDoctorPayoutTransactions(doctorId);
    }
    const data = localStorage.getItem('clinic_doctor_payouts');
    let list: DoctorPayoutTransaction[] = data ? JSON.parse(data) : [];
    if (doctorId) {
      list = list.filter(p => p.doctorId === doctorId);
    }
    return list.sort((a, b) => (b.payoutDate || '').localeCompare(a.payoutDate || ''));
  },

  saveDoctorPayoutTransaction: async (payout: Partial<DoctorPayoutTransaction>): Promise<{ success: boolean; id: string; payoutNumber: string }> => {
    if (window.database?.saveDoctorPayoutTransaction) {
      return window.database.saveDoctorPayoutTransaction(payout);
    }
    const list = await storage.getDoctorPayoutTransactions();
    const count = list.length + 1;
    const id = payout.id || `PAYOUT-${Date.now()}`;
    const payoutNumber = payout.payoutNumber || `PAY-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
    const item: DoctorPayoutTransaction = {
      id,
      payoutNumber,
      doctorId: payout.doctorId || '',
      doctorName: payout.doctorName || 'Doctor',
      periodStart: payout.periodStart,
      periodEnd: payout.periodEnd,
      opdConsultationEarnings: payout.opdConsultationEarnings || 0,
      ipdVisitsEarnings: payout.ipdVisitsEarnings || 0,
      surgeryEarnings: payout.surgeryEarnings || 0,
      labReferralEarnings: payout.labReferralEarnings || 0,
      grossEarnings: payout.grossEarnings || 0,
      tdsDeduction: payout.tdsDeduction || 0,
      hospitalFacilityDeduction: payout.hospitalFacilityDeduction || 0,
      otherDeductions: payout.otherDeductions || 0,
      netPayoutAmount: payout.netPayoutAmount || 0,
      paymentMode: payout.paymentMode || 'BANK_TRANSFER',
      paymentReference: payout.paymentReference,
      status: payout.status || 'PAID',
      notes: payout.notes,
      payoutDate: payout.payoutDate || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    list.unshift(item);
    localStorage.setItem('clinic_doctor_payouts', JSON.stringify(list));
    return { success: true, id, payoutNumber };
  },

  // ── Module 3: Hospital Ward & OT to Pharmacy Stock Indenting ───────────────
  getHospitalIndents: async (filter?: { status?: string; departmentType?: string; priority?: string }): Promise<HospitalIndent[]> => {
    if (window.database?.getHospitalIndents) {
      return window.database.getHospitalIndents(filter);
    }
    const data = localStorage.getItem('clinic_hospital_indents');
    let list: HospitalIndent[] = data ? JSON.parse(data) : [];
    if (filter?.status && filter.status !== 'ALL') {
      list = list.filter(i => i.status === filter.status);
    }
    if (filter?.departmentType && filter.departmentType !== 'ALL') {
      list = list.filter(i => i.departmentType === filter.departmentType);
    }
    if (filter?.priority && filter.priority !== 'ALL') {
      list = list.filter(i => i.priority === filter.priority);
    }
    return list.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  },

  getHospitalIndentById: async (id: string): Promise<HospitalIndent | null> => {
    if (window.database?.getHospitalIndentById) {
      return window.database.getHospitalIndentById(id);
    }
    const indents = await storage.getHospitalIndents();
    return indents.find(i => i.id === id) || null;
  },

  saveHospitalIndent: async (indent: Partial<HospitalIndent>, items: Partial<HospitalIndentItem>[]): Promise<{ success: boolean; id: string; indentNumber: string }> => {
    let result: { success: boolean; id: string; indentNumber: string };
    if (window.database?.saveHospitalIndent) {
      result = await window.database.saveHospitalIndent(indent, items);
    } else {
      const list = await storage.getHospitalIndents();
      const count = list.length + 1;
      const id = indent.id || `IND-${Date.now()}`;
      const indentNumber = indent.indentNumber || `IND-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
      const formattedItems: HospitalIndentItem[] = (items || []).map((it, idx) => ({
        id: it.id || `ITEM-${Date.now()}-${idx}`,
        indentId: id,
        medicineId: it.medicineId,
        itemName: it.itemName || 'Medicine / Consumable',
        itemCategory: it.itemCategory || 'Medicine',
        requestedQuantity: Number(it.requestedQuantity) || 1,
        issuedQuantity: Number(it.issuedQuantity) || 0,
        batchNumber: it.batchNumber,
        notes: it.notes
      }));
      const newIndent: HospitalIndent = {
        id,
        indentNumber,
        departmentType: indent.departmentType || 'WARD',
        sourceLocation: indent.sourceLocation || 'General Ward',
        targetDepartment: indent.targetDepartment || 'PHARMACY',
        requestedBy: indent.requestedBy || 'Staff Nurse',
        priority: indent.priority || 'ROUTINE',
        status: indent.status || 'PENDING',
        notes: indent.notes,
        requestedAt: indent.requestedAt || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: formattedItems
      };
      list.unshift(newIndent);
      localStorage.setItem('clinic_hospital_indents', JSON.stringify(list));
      result = { success: true, id, indentNumber };
    }
    notifyDataChanged('indents');
    return result;
  },

  issueHospitalIndent: async (indentId: string, itemsIssued: { itemId: string; medicineId?: string; issuedQuantity: number; batchNumber?: string }[], fulfilledBy: string): Promise<{ success: boolean; id: string }> => {
    let result: { success: boolean; id: string };
    if (window.database?.issueHospitalIndent) {
      result = await window.database.issueHospitalIndent(indentId, itemsIssued, fulfilledBy);
    } else {
      const list = await storage.getHospitalIndents();
      const indent = list.find(i => i.id === indentId);
      if (indent && indent.items) {
        for (const issued of itemsIssued) {
          const item = indent.items.find(it => it.id === issued.itemId);
          if (item) {
            item.issuedQuantity = issued.issuedQuantity;
            if (issued.batchNumber) item.batchNumber = issued.batchNumber;
          }
        }
        const totalReq = indent.items.reduce((s, i) => s + (i.requestedQuantity || 0), 0);
        const totalIss = indent.items.reduce((s, i) => s + (i.issuedQuantity || 0), 0);
        indent.status = totalIss >= totalReq ? 'COMPLETED' : totalIss > 0 ? 'PARTIALLY_ISSUED' : 'PENDING';
        indent.fulfilledAt = new Date().toISOString();
        indent.fulfilledBy = fulfilledBy;
        indent.updatedAt = new Date().toISOString();
        localStorage.setItem('clinic_hospital_indents', JSON.stringify(list));
      }
      result = { success: true, id: indentId };
    }
    notifyDataChanged('indents');
    return result;
  },

  completeHospitalIndent: async (indentId: string, fulfilledBy?: string): Promise<{ success: boolean; id: string }> => {
    let result: { success: boolean; id: string };
    if (window.database?.completeHospitalIndent) {
      result = await window.database.completeHospitalIndent(indentId, fulfilledBy);
    } else {
      const list = await storage.getHospitalIndents();
      const indent = list.find(i => i.id === indentId);
      if (indent && indent.items) {
        indent.items.forEach(it => {
          it.issuedQuantity = it.requestedQuantity;
          it.batchNumber = it.batchNumber || 'DIRECT-DISPATCH';
        });
        indent.status = 'COMPLETED';
        indent.fulfilledAt = new Date().toISOString();
        indent.fulfilledBy = fulfilledBy || 'Pharmacist In-Charge';
        indent.updatedAt = new Date().toISOString();
        localStorage.setItem('clinic_hospital_indents', JSON.stringify(list));
      }
      result = { success: true, id: indentId };
    }
    notifyDataChanged('indents');
    return result;
  },

  cancelHospitalIndent: async (indentId: string, reason?: string): Promise<{ success: boolean; id: string }> => {
    let result: { success: boolean; id: string };
    if (window.database?.cancelHospitalIndent) {
      result = await window.database.cancelHospitalIndent(indentId, reason);
    } else {
      const list = await storage.getHospitalIndents();
      const indent = list.find(i => i.id === indentId);
      if (indent) {
        indent.status = 'CANCELLED';
        indent.notes = `${indent.notes || ''} (Cancelled: ${reason || 'By Staff'})`.trim();
        indent.updatedAt = new Date().toISOString();
        localStorage.setItem('clinic_hospital_indents', JSON.stringify(list));
      }
      result = { success: true, id: indentId };
    }
    notifyDataChanged('indents');
    return result;
  },

  getHospitalTier3Metrics: async (): Promise<HospitalTier3Metrics> => {
    if (window.database?.getHospitalTier3Metrics) {
      return window.database.getHospitalTier3Metrics();
    }
    const payouts = await storage.getDoctorPayoutTransactions();
    const paid = payouts.filter(p => p.status === 'PAID');
    const indents = await storage.getHospitalIndents();
    const rules = await storage.getDoctorCommissionRules();
    return {
      totalDoctorPayoutsAmount: paid.reduce((s, p) => s + (p.netPayoutAmount || 0), 0),
      totalDoctorPayoutsCount: paid.length,
      pendingIndentsCount: indents.filter(i => i.status === 'PENDING').length,
      completedIndentsCount: indents.filter(i => i.status === 'COMPLETED').length,
      activeDoctorsConfigured: rules.filter(r => Boolean(r.isActive)).length
    };
  },

  // ── Unified Global Patient Lookup & Smart Prefill Across All Departments ────
  searchGlobalPatients: async (query: string): Promise<GlobalPatientProfile[]> => {
    if (window.database?.searchGlobalPatients) {
      return window.database.searchGlobalPatients(query);
    }
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const map = new Map<string, GlobalPatientProfile>();

    // 1. Receipts
    const receipts = await storage.getReceipts({ search: q, limit: 30 });
    receipts.forEach(r => {
      const key = (r.patientPhone?.trim() || r.patientId?.trim() || r.patientName.trim()).toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          patientId: r.patientId || '',
          patientUhid: r.patientId || '',
          patientName: r.patientName,
          patientPhone: r.patientPhone || '',
          patientAge: r.patientAge || '',
          patientGender: r.patientGender || '',
          lastVisitDate: r.date,
          previousDoctorName: r.doctorName || '',
          source: 'OPD'
        });
      }
    });

    // 2. Bed admissions
    const admissions = await storage.getBedAdmissions();
    admissions.filter(a =>
      a.patientName.toLowerCase().includes(q) ||
      (a.patientPhone && a.patientPhone.includes(q)) ||
      (a.patientUhid && a.patientUhid.toLowerCase().includes(q))
    ).forEach(a => {
      const key = (a.patientPhone?.trim() || a.patientUhid?.trim() || a.patientName.trim()).toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          patientId: a.patientId || a.patientUhid || '',
          patientUhid: a.patientUhid || a.patientId || '',
          patientName: a.patientName,
          patientPhone: a.patientPhone || '',
          patientAge: a.patientAge || '',
          patientGender: a.patientGender || '',
          lastVisitDate: a.admittedAt?.split('T')[0],
          previousDoctorName: a.doctorName || '',
          recentDiagnosis: a.diagnosis || '',
          source: 'IPD'
        });
      }
    });

    // 3. Emergency visits
    const emergencies = await storage.getEmergencyVisits();
    emergencies.filter(e =>
      e.patientName.toLowerCase().includes(q) ||
      (e.patientPhone && e.patientPhone.includes(q)) ||
      (e.patientUhid && e.patientUhid.toLowerCase().includes(q))
    ).forEach(e => {
      const key = (e.patientPhone?.trim() || e.patientUhid?.trim() || e.patientName.trim()).toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          patientId: e.patientId || e.patientUhid || '',
          patientUhid: e.patientUhid || e.patientId || '',
          patientName: e.patientName,
          patientPhone: e.patientPhone || '',
          patientAge: e.patientAge || '',
          patientGender: e.patientGender || '',
          lastVisitDate: e.arrivedAt?.split('T')[0],
          previousDoctorName: e.attendingDoctorName || '',
          recentDiagnosis: e.chiefComplaint || '',
          source: 'EMERGENCY'
        });
      }
    });

    // 4. Appointments
    const appointments = await storage.getAppointments();
    appointments.filter(a =>
      a.patientName.toLowerCase().includes(q) ||
      (a.patientPhone && a.patientPhone.includes(q))
    ).forEach(apt => {
      const key = (apt.patientPhone?.trim() || apt.patientName.trim()).toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          patientId: '',
          patientUhid: '',
          patientName: apt.patientName,
          patientPhone: apt.patientPhone || '',
          patientAge: apt.patientAge || '',
          patientGender: apt.patientGender || '',
          lastVisitDate: apt.appointmentDate || (apt as any).date,
          previousDoctorName: apt.doctorName || '',
          source: 'APPOINTMENT'
        });
      }
    });

    return Array.from(map.values()).slice(0, 20);
  }
};

// ── Multi-User Live Interconnectivity & Broadcast Bus ────────────────────────
export function notifyDataChanged(dataType?: string): void {
  try {
    if (typeof window !== 'undefined') {
      const payload = { type: dataType, dataType, timestamp: Date.now() };
      window.dispatchEvent(new CustomEvent('buvora-data-updated', { detail: payload }));
      if ('BroadcastChannel' in window) {
        const ch = new BroadcastChannel('buvora_live_sync');
        ch.postMessage(payload);
        setTimeout(() => {
          try { ch.close(); } catch (_) {}
        }, 50);
      }
    }
  } catch (_) {}
}

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    const rxChannel = new BroadcastChannel('buvora_live_sync');
    rxChannel.onmessage = (event) => {
      window.dispatchEvent(new CustomEvent('buvora-data-updated', { detail: event.data }));
    };
  } catch (_) {}
}

// ── Doctor Calling Next Patient Bus & Audio Chime ───────────────────────────
export interface DoctorNextCallEvent {
  callId: string;
  doctorId: string;
  doctorName: string;
  chamberName: string;
  token: string;
  patientName: string;
  timestamp: number;
}

export const playReceptionChime = (): void => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    // First bell tone (880Hz - A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Second chime tone (659.25Hz - E5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.18);
    gain2.gain.setValueAtTime(0.25, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.9);
  } catch (_) {}
};

export function broadcastDoctorCallNext(callData: DoctorNextCallEvent): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('buvora_latest_doctor_call', JSON.stringify(callData));
      window.dispatchEvent(new CustomEvent('buvora-doctor-called-next', { detail: callData }));
      if ('BroadcastChannel' in window) {
        const ch = new BroadcastChannel('buvora_doctor_calls');
        ch.postMessage(callData);
        setTimeout(() => {
          try { ch.close(); } catch (_) {}
        }, 50);
      }
      notifyDataChanged('queue');
    }
  } catch (_) {}
}

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    const docChannel = new BroadcastChannel('buvora_doctor_calls');
    docChannel.onmessage = (event) => {
      window.dispatchEvent(new CustomEvent('buvora-doctor-called-next', { detail: event.data }));
    };
  } catch (_) {}
}

export const cleanAgeString = (ageStr?: string): string => {
  if (!ageStr) return '';
  return ageStr
    .replace(/\b(male|female|other)\b/gi, '')
    .replace(/\//g, '')
    .trim();
};

export const formatAgeGender = (patientAge?: string, patientGender?: string): string => {
  const gender = patientGender?.trim() || 'Male';
  const cleanedAge = cleanAgeString(patientAge);

  if (!cleanedAge) {
    return `N/A / ${gender}`;
  }

  const hasUnit = /[0-9]+\s*[ymYM]\b/.test(cleanedAge) || /\b(years?|months?|yrs?|mths?)\b/i.test(cleanedAge);
  const formattedAge = (!hasUnit && /^\d+$/.test(cleanedAge)) ? `${cleanedAge}Y` : cleanedAge;

  return `${formattedAge} / ${gender}`;
};

