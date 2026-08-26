<div align="center">

  <img src="public/icon.png" alt="Buvora Clinic Logo" width="110" height="110" />

  # Buvora™ Clinic Management Suite
  **Next-Generation Offline Desktop Suite for Modern Medical Practices & Clinical Workflows**

  <p align="center">
    <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows-0A84FF?style=for-the-badge&logo=apple&logoColor=white" alt="Platform" />
    <img src="https://img.shields.io/badge/Architecture-Offline--First%20SQLite%20WAL-34C759?style=for-the-badge&logo=sqlite&logoColor=white" alt="Architecture" />
    <img src="https://img.shields.io/badge/Sync-LAN%20Multi--Station%20RPC-FF9500?style=for-the-badge" alt="LAN Sync" />
    <img src="https://img.shields.io/badge/Automation-WhatsApp%20Integration-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" alt="WhatsApp Automation" />
    <img src="https://img.shields.io/badge/Security-Hardware--Bound%20Licensing-AF52DE?style=for-the-badge" alt="Security" />
  </p>

</div>

---

## 🏥 Executive Summary

**Buvora** is an enterprise-grade clinical management desktop solution engineered specifically for outpatient clinics, polyclinics, and independent healthcare practitioners. 

Operating **100% offline**, Buvora eliminates dependence on third-party cloud servers and vulnerable internet connections, ensuring that sensitive patient medical records and clinic financial data remain strictly on-premises. From instant patient registration and atomic bill generation to clinical prescription writing, WhatsApp automation, and multi-chamber local area network (LAN) synchronization, Buvora transforms everyday clinical workflows into a fluid, unified experience.

---

## 🌟 Core System Capabilities

```
                       ┌─────────────────────────────────────────────────────────┐
                       │               Buvora Clinical Platform                  │
                       └────────────────────────────┬────────────────────────────┘
                                                    │
         ┌───────────────────┬──────────────────────┼─────────────────────┬───────────────────┐
         ▼                   ▼                      ▼                     ▼                   ▼
  🩺 Doctor Chamber   🧾 Reception Desk     🤖 WhatsApp Bot       🖨️ Universal Print   🌐 LAN Sync Mesh
  • E-Prescriptions   • Atomic Billing      • Auto Booking        • Thermal 58/80mm   • Real-Time Host
  • Diagnosis / Rx    • UPI Dynamic QR      • Receipt Sharing     • A4/A5/A6/Letter   • Remote Clients
  • Patient History   • Token Counter       • Follow-up Reminders • Custom Letterhead • Token Auth
```

---

### 🩺 1. Dedicated Doctor Workstation
- **Clinical Consultation Interface**: Streamlined workspace designed for rapid data entry during active patient consultations.
- **Intelligent Prescription Generator**: Build structured prescriptions with dosage, frequency, course duration, and custom dietary/lifestyle instructions.
- **Diagnosis & Symptom Logging**: Record structured clinical diagnoses and ICD-aligned complaint logs.
- **Integrated Follow-up Scheduler**: Schedule clinical revisit dates directly from prescription workflows with automated reminder queuing.
- **Patient History Lookup**: Instant access to chronological visit records, prior prescriptions, and treatment timelines.

---

### 🧾 2. Precision Billing & Receipt Engine
- **Atomic Transaction Numbering**: Collision-proof receipt sequence counters (`1001`, `1002`, `F1001` for waivers) operating inside ACID transactions.
- **Flexible Payment Modes**: Support for **Cash**, **UPI / Online**, and **Free / Charitable** consultations with comprehensive revenue separation.
- **Dynamic UPI Payment QR Codes**: Generate on-the-fly QR codes embedded with clinic UPI IDs for touchless digital payments on receipts.
- **Itemized Service Catalog**: Configurable treatments, consultation types, and laboratory procedures with customizable default pricing.

---

### 🖨️ 3. Universal Printing Engine
- **Multi-Format Paper Profiles**:
  - **Thermal Formats**: 58mm and 80mm POS thermal roll receipt formats.
  - **Standard Paper**: A4, A5, A6, and US Letter sizes.
- **Letterhead Alignment Controls**: Doctor-specific top and bottom margin offsets to print seamlessly on pre-printed doctor letterheads without header overlap.
- **Clean Print Isolation**: Zero UI artifacts or browser chrome during printing via isolated `@media print` layout engines.

---

### 🤖 4. Integrated WhatsApp Clinical Automation
- **Automated Appointment Ingestion**: Embedded multi-device engine parses incoming patient WhatsApp queries and queues appointments directly into the clinic roster.
- **Digital Receipt Delivery**: Instantly share itemized receipt summaries directly to the patient's WhatsApp mobile number.
- **Automated Follow-up Reminders**: Formatted follow-up alerts dispatched with customized clinic instructions to reduce no-show rates.
- **Configurable Practice Schedule**: Broadcast clinic consultation days, timing windows, and doctor availability automatically.

---

### 🌐 5. Local Area Network (LAN) Multi-Chamber Sync
- **Zero-Cloud LAN Synchronization**: Run the clinic across multiple computers (e.g., 1 Receptionist Desk + 3 Doctor Chambers) on the local Wi-Fi or Ethernet network.
- **Host / Client Architecture**:
  - **Host Mode**: Serves as the central SQLite authority with an authenticated local RPC engine.
  - **Client Mode**: Seamlessly queries and writes to the Host database in real time with automated reconnect resilience.
- **Authenticated Network Boundary**: Requests authenticated via cryptographic token validation and per-IP rate limiting.

---

### 👥 6. Role-Based Access Control (RBAC) & Security
- **Role Isolation**:
  - **Reception Role**: Front-desk operations, billing, appointments, revenue analytics, and service setup.
  - **Doctor Role**: Filtered workstation displaying only assigned patients, consultation queues, and clinical notes.
  - **Admin Role**: Clinic configuration, doctor profile margins, network synchronization, and database management.
- **Cryptographic User Authentication**: User passwords protected with isolated salted hashing per clinic instance.
- **Hardware-Bound Offline Licensing**: Cryptographically verified machine-ID authorization ensuring valid operational deployment without telemetry tracking.

---

### 📊 7. Financial Analytics & Data Sovereignty
- **Real-Time Revenue Analytics**: Live tracking of gross collections, patient volumes, and average ticket values.
- **Automated Safeguard Backups**: Full database JSON snapshots created automatically before data imports to prevent operational data loss.
- **Accounting Export**: One-click CSV and structured tabular export for external accounting, audits, and compliance records.

---

## 🔒 Privacy, Reliability & Offline Architecture

| Dimension | Specification |
| :--- | :--- |
| **Data Residency** | 100% On-Premises Local SQLite (`WAL` mode with instantaneous write-ahead journaling) |
| **Network Reliance** | **Zero Internet Required** for clinical functions, billing, or multi-station LAN sync |
| **Crash Protection** | Multi-layer React error boundaries & isolated native process recovery |
| **Hardware Compatibility** | Optimized for macOS (Apple Silicon & Intel) and Windows 10/11 |

---

<div align="center">
  <p>© 2026 Buvora Clinic Suite. All rights reserved. Proprietary Healthcare Software.</p>
</div>
