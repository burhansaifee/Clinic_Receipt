import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import Store from 'electron-store';
import { database } from './database';

const require = createRequire(import.meta.url);
const QRCode = require('qrcode');
const store = new Store();

// State management for WhatsApp Bot
export type WhatsAppStatus = 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED' | 'ERROR';

interface BotState {
  status: WhatsAppStatus;
  qrCodeDataUrl: string | null;
  phoneNumber: string | null;
  errorMessage: string | null;
  autoReplyEnabled: boolean;
}

let state: BotState = {
  status: 'DISCONNECTED',
  qrCodeDataUrl: null,
  phoneNumber: null,
  errorMessage: null,
  autoReplyEnabled: true,
};

let socket: any = null;
interface UserConversation {
  step: number;
  doctorId?: string;
  doctorName?: string;
  availableDates?: { label: string; dateStr: string; dayName: string }[];
  selectedDate?: string;
  selectedDateFormatted?: string;
  availableSlots?: string[];
  selectedTimeSlot?: string;
  name?: string;
  age?: string;
  gender?: string;
}

let conversationState: Record<string, UserConversation> = {};

function getWhatsAppScheduleFromStore() {
  const schedule = store.get('whatsapp_schedule') as any;
  if (schedule && Array.isArray(schedule.allowedDays) && Array.isArray(schedule.timeSlots)) {
    return schedule;
  }
  return {
    allowedDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    timeSlots: [
      '09:00 AM - 10:00 AM',
      '10:00 AM - 11:00 AM',
      '11:00 AM - 12:00 PM',
      '12:00 PM - 01:00 PM',
      '04:00 PM - 05:00 PM',
      '05:00 PM - 06:00 PM',
      '06:00 PM - 07:00 PM',
      '07:00 PM - 08:00 PM'
    ]
  };
}

const DAY_MAP = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_MAP = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function generateAvailableBookingDates(allowedDays: string[]) {
  const availableDates: { label: string; dateStr: string; dayName: string }[] = [];
  const today = new Date();

  for (let offset = 0; offset < 14; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);

    const dayName = DAY_MAP[d.getDay()];
    if (!allowedDays.includes(dayName)) {
      continue;
    }

    const dateNum = d.getDate();
    const monthName = MONTH_MAP[d.getMonth()];
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;

    let label = '';
    if (offset === 0) {
      label = `Today (${dayName}, ${dateNum} ${monthName})`;
    } else if (offset === 1) {
      label = `Tomorrow (${dayName}, ${dateNum} ${monthName})`;
    } else {
      label = `${dayName}, ${dateNum} ${monthName}`;
    }

    availableDates.push({
      label,
      dateStr,
      dayName
    });

    if (availableDates.length >= 6) {
      break;
    }
  }

  return availableDates;
}

let wasConnected = false;

export const whatsappBot = {
  getStatus: () => state,
  setOnAppointmentSavedCallback: (cb: () => void) => {
    appointmentSavedCallback = cb;
  },

  toggleAutoReply: (enabled: boolean) => {
    state.autoReplyEnabled = enabled;
    return state;
  },

  start: async (onStateChange?: (newState: BotState) => void) => {
    if (state.status === 'CONNECTED' || state.status === 'CONNECTING') {
      return state;
    }

    state.status = 'CONNECTING';
    state.qrCodeDataUrl = null;
    state.errorMessage = null;
    if (onStateChange) onStateChange({ ...state });

    try {
      const baileys = require('@whiskeysockets/baileys');
      const makeWASocket = baileys.default || baileys.makeWASocket;
      const { useMultiFileAuthState, DisconnectReason } = baileys;

      const authDir = path.join(app.getPath('userData'), 'whatsapp_auth');
      if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
      }

      const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);

      socket = makeWASocket({
        auth: authState,
        printQRInTerminal: false,
        browser: ['MedFlow Clinic', 'Chrome', '1.0.0'],
      });

      socket.ev.on('creds.update', saveCreds);

      socket.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            state.qrCodeDataUrl = await QRCode.toDataURL(qr);
            state.status = 'QR_READY';
            console.log('[WhatsApp Bot] New QR Code generated on user request');
            if (onStateChange) onStateChange({ ...state });
          } catch (err) {
            console.error('[WhatsApp Bot] Failed to render QR code:', err);
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          const previouslyConnected = wasConnected;
          
          console.log('[WhatsApp Bot] Connection closed. Status code:', statusCode, 'Previously connected:', previouslyConnected);
          
          state.status = 'DISCONNECTED';
          state.qrCodeDataUrl = null;

          if (!shouldReconnect) {
            wasConnected = false;
            try {
              const authDir = path.join(app.getPath('userData'), 'whatsapp_auth');
              if (fs.existsSync(authDir)) {
                fs.rmSync(authDir, { recursive: true, force: true });
                console.log('[WhatsApp Bot] Logged out or session revoked. Cleared auth credentials.');
              }
            } catch (err) {
              console.error('[WhatsApp Bot] Failed to clear auth directory on logout:', err);
            }
            if (onStateChange) onStateChange({ ...state });
          } else if (previouslyConnected) {
            // Only auto-reconnect if we were already authenticated & connected
            console.log('[WhatsApp Bot] Session lost while connected. Reconnecting existing session...');
            state.status = 'CONNECTING';
            if (onStateChange) onStateChange({ ...state });
            setTimeout(() => whatsappBot.start(onStateChange), 5000);
          } else {
            // Unauthenticated QR pairing phase ended/expired - stop and wait for user to click "Connect WhatsApp" again
            console.log('[WhatsApp Bot] QR pairing stopped/expired. Waiting for user to click Connect WhatsApp.');
            wasConnected = false;
            if (onStateChange) onStateChange({ ...state });
          }
        } else if (connection === 'open') {
          state.status = 'CONNECTED';
          state.qrCodeDataUrl = null;
          state.phoneNumber = socket.user?.id ? socket.user.id.split(':')[0] : 'Active';
          wasConnected = true;
          console.log('[WhatsApp Bot] Successfully connected to WhatsApp!');
          if (onStateChange) onStateChange({ ...state });
        }
      });

      // Handle Incoming Messages (Supports Concurrent Requests)
      socket.ev.on('messages.upsert', async (m: any) => {
        if (!state.autoReplyEnabled) return;
        if (!m.messages || !Array.isArray(m.messages)) return;

        for (const msg of m.messages) {
          if (!msg || msg.key.fromMe || !msg.message) continue;

          // Extract real phone number JID from remoteJidAlt if present (handles @lid masked numbers)
          const jid = msg.key.remoteJidAlt || msg.key.remoteJid;
          if (!jid) continue;

          const phone = jid.split('@')[0];

          const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.buttonsResponseMessage?.selectedButtonId ||
            '';

          if (!text) continue;

          console.log(`[WhatsApp Bot] Incoming message from ${phone}: "${text}"`);

          // Pass both the routing JID (for immediate replies) and the real phone to the booking flow concurrently
          handleIncomingBookingFlow(socket, msg.key.remoteJid, phone, text.trim()).catch((err) => {
            console.error(`[WhatsApp Bot] Error processing message for ${phone}:`, err);
          });
        }
      });
    } catch (err: any) {
      console.error('[WhatsApp Bot] Start error:', err);
      state.status = 'ERROR';
      state.errorMessage = err.message || 'Failed to initialize WhatsApp bot';
      if (onStateChange) onStateChange({ ...state });
    }

    return state;
  },

  stop: async () => {
    wasConnected = false;
    if (socket) {
      try {
        await socket.logout();
      } catch (e) {}
      try {
        socket.end(undefined);
      } catch (e) {}
      socket = null;
    }
    state.status = 'DISCONNECTED';
    state.qrCodeDataUrl = null;
    state.phoneNumber = null;

    try {
      const authDir = path.join(app.getPath('userData'), 'whatsapp_auth');
      if (fs.existsSync(authDir)) {
        fs.rmSync(authDir, { recursive: true, force: true });
        console.log('[WhatsApp Bot] Cleared WhatsApp credentials on logout/stop.');
      }
    } catch (err) {
      console.error('[WhatsApp Bot] Error clearing credentials folder:', err);
    }

    return state;
  },

  sendMessage: async (phone: string, message: string) => {
    console.log(`[WhatsApp Bot] Attempting to send message to ${phone}`);
    if (!socket || state.status !== 'CONNECTED') {
      console.error('[WhatsApp Bot] Cannot send message, bot is not connected. Current status:', state.status);
      throw new Error('WhatsApp bot is not connected');
    }
    const jid = phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
    console.log(`[WhatsApp Bot] Formatted JID: ${jid}`);
    try {
      await socket.sendMessage(jid, { text: message });
      console.log(`[WhatsApp Bot] Message sent successfully to ${jid}`);
    } catch (e) {
      console.error(`[WhatsApp Bot] Failed to send message to ${jid}:`, e);
      throw e;
    }
  },
};

// Network-aware database helper functions
async function getDoctorsFromDb() {
  try {
    const workstationMode = store.get('workstation_mode') as string || 'standalone';

    if (workstationMode === 'client') {
      const hostIp = store.get('host_ip') as string || '127.0.0.1';
      const hostPort = store.get('host_port') as number || 49152;
      const url = `http://${hostIp}:${hostPort}/api/rpc`;
      console.log(`[WhatsApp Bot] Client Mode: Fetching doctors from host server at ${url}...`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-MedFlow-Auth': store.get('network_secret') as string
        },
        body: JSON.stringify({ method: 'db-get-doctors', args: [] }),
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const data = await res.json() as any;
        if (data.result) return data.result;
      }
    }
  } catch (err) {
    console.error(`[WhatsApp Bot] Failed to fetch doctors from Host, using local fallback:`, err);
  }
  return database.getDoctors();
}

let appointmentSavedCallback: (() => void) | null = null;

export function setOnAppointmentSavedCallback(cb: () => void) {
  appointmentSavedCallback = cb;
}

async function saveAppointmentToDb(appointment: any) {
  try {
    const workstationMode = store.get('workstation_mode') as string || 'standalone';

    if (workstationMode === 'client') {
      const hostIp = store.get('host_ip') as string || '127.0.0.1';
      const hostPort = store.get('host_port') as number || 49152;
      const url = `http://${hostIp}:${hostPort}/api/rpc`;
      console.log(`[WhatsApp Bot] Client Mode: Forwarding appointment to host server at ${url}...`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-MedFlow-Auth': store.get('network_secret') as string
        },
        body: JSON.stringify({ method: 'db-save-appointment', args: [appointment] }),
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) throw new Error(`Host responded with status ${res.status}`);
      console.log(`[WhatsApp Bot] Client Mode: Appointment successfully saved on host.`);
    } else {
      console.log(`[WhatsApp Bot] Local Mode: Saving appointment to local SQLite...`);
      database.saveAppointment(appointment);
    }
  } catch (err) {
    console.error(`[WhatsApp Bot] Error saving appointment, writing locally as fallback:`, err);
    try {
      database.saveAppointment(appointment);
    } catch (localErr) {
      console.error(`[WhatsApp Bot] Local SQLite fallback write failed:`, localErr);
    }
  } finally {
    if (appointmentSavedCallback) {
      try { appointmentSavedCallback(); } catch(e) {}
    }
  }
}

// Conversational State Machine for Patient Booking
async function handleIncomingBookingFlow(socket: any, jid: string, phone: string, text: string) {
  const doctors = await getDoctorsFromDb();
  const lowerText = text.toLowerCase();

  if (!doctors || doctors.length === 0) {
    await socket.sendMessage(jid, {
      text: ' *MedFlow Clinic*\n\nThank you for reaching out! Our clinic directory is currently being updated. Please call our reception directly.',
    });
    return;
  }

  let userState = conversationState[phone] || { step: 0 };

  // Reset trigger
  if (lowerText.includes('hi') || lowerText.includes('hello') || lowerText.includes('book') || lowerText.includes('appointment') || lowerText.includes('start') || lowerText.includes('reset')) {
    userState = { step: 1 };
  }

  switch (userState.step) {
    case 1: {
      // Step 1: Greeting & Doctor List
      let docListStr = doctors
        .map((d: any, idx: number) => `*${idx + 1}.* ${d.name} (${d.specialization || 'Consulting Physician'})`)
        .join('\n');

      const greetingMsg =
        ` *Welcome to MedFlow Clinic Appointment Booking!*\n\n` +
        `Please select a doctor by replying with their number:\n\n` +
        `${docListStr}\n\n` +
        `_Reply with the number (e.g. 1 or 2)_`;

      userState.step = 2;
      conversationState[phone] = userState;
      await socket.sendMessage(jid, { text: greetingMsg });
      break;
    }

    case 2: {
      // Step 2: Selected Doctor Choice -> Show Receptionist-Approved Days
      const choiceIndex = parseInt(text) - 1;
      if (!isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < doctors.length) {
        const selectedDoc = doctors[choiceIndex];
        userState.doctorId = selectedDoc.id;
        userState.doctorName = selectedDoc.name;

        const schedule = getWhatsAppScheduleFromStore();
        userState.availableDates = generateAvailableBookingDates(schedule.allowedDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

        let dateListStr = userState.availableDates
          .map((d, idx) => `*${idx + 1}.* ${d.label}`)
          .join('\n');

        const dateMsg =
          `✅ Selected Doctor: *${selectedDoc.name}*\n\n` +
          `📅 *Please select your preferred Booking Date:*\n\n` +
          `${dateListStr}\n\n` +
          `ℹ️ _Clinic Operating Days: ${(schedule.allowedDays || []).join(', ')}_\n` +
          `_Reply with the date option number (1-${userState.availableDates.length})_`;

        userState.step = 3;
        conversationState[phone] = userState;
        await socket.sendMessage(jid, { text: dateMsg });
      } else {
        await socket.sendMessage(jid, {
          text: `⚠️ Invalid selection. Please reply with a number between 1 and ${doctors.length}.`,
        });
      }
      break;
    }

    case 3: {
      // Step 3: Date Selected -> Show Receptionist-Approved Time Slots
      const choiceIndex = parseInt(text) - 1;
      let selectedDateObj: { label: string; dateStr: string; dayName: string } | null = null;

      if (userState.availableDates && !isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < userState.availableDates.length) {
        selectedDateObj = userState.availableDates[choiceIndex];
      }

      if (selectedDateObj) {
        userState.selectedDate = selectedDateObj.dateStr;
        userState.selectedDateFormatted = selectedDateObj.label;

        const schedule = getWhatsAppScheduleFromStore();
        userState.availableSlots = schedule.timeSlots || [
          '09:00 AM - 10:00 AM',
          '10:00 AM - 11:00 AM',
          '11:00 AM - 12:00 PM',
          '12:00 PM - 01:00 PM',
          '04:00 PM - 05:00 PM',
          '05:00 PM - 06:00 PM',
          '06:00 PM - 07:00 PM',
          '07:00 PM - 08:00 PM'
        ];

        const availableSlots = userState.availableSlots || [];
        let slotsListStr = availableSlots
          .map((slot, idx) => `*${idx + 1}.* ${slot}`)
          .join('\n');

        const slotMsg =
          `📅 Selected Date: *${userState.selectedDateFormatted}*\n\n` +
          `⏰ *Please select an available Time Slot for ${userState.doctorName}:*\n\n` +
          `${slotsListStr}\n\n` +
          `⚠️ _Bookings are strictly restricted to receptionist-approved clinic slots._\n` +
          `_Reply with the slot number (1-${availableSlots.length})_`;

        userState.step = 4;
        conversationState[phone] = userState;
        await socket.sendMessage(jid, { text: slotMsg });
      } else {
        const schedule = getWhatsAppScheduleFromStore();
        await socket.sendMessage(jid, {
          text: `⚠️ Invalid date selection. Please reply with a valid option number (1-${userState.availableDates?.length || 6}) for active operating days: ${(schedule.allowedDays || []).join(', ')}.`,
        });
      }
      break;
    }

    case 4: {
      // Step 4: Time Slot Selected -> Ask for Patient Details
      const choiceIndex = parseInt(text) - 1;
      let chosenSlot = '';

      if (userState.availableSlots && !isNaN(choiceIndex) && choiceIndex >= 0 && choiceIndex < userState.availableSlots.length) {
        chosenSlot = userState.availableSlots[choiceIndex];
      } else if (userState.availableSlots) {
        const match = userState.availableSlots.find(s => s.toLowerCase() === lowerText);
        if (match) chosenSlot = match;
      }

      if (chosenSlot) {
        userState.selectedTimeSlot = chosenSlot;
        userState.step = 5;
        conversationState[phone] = userState;

        const nameMsg =
          `🗓️ Date: *${userState.selectedDateFormatted || userState.selectedDate}*\n` +
          `⏰ Time Slot: *${userState.selectedTimeSlot}*\n\n` +
          `Please reply with the **Patient's Full Name, Age, and Gender**.\n` +
          `Example: *Rahul Sharma, 28, Male*`;

        await socket.sendMessage(jid, { text: nameMsg });
      } else {
        await socket.sendMessage(jid, {
          text: `⚠️ *Invalid Time Slot.* Bookings are strictly restricted to receptionist-approved clinic hours. Please reply with a valid slot number (1-${userState.availableSlots?.length || 8}).`,
        });
      }
      break;
    }

    case 5: {
      // Step 5: Patient Details Received -> Finalize Booking Request
      const parts = text.split(',').map((p) => p.trim());
      let patientName = parts[0] || text;
      let patientAge = parts[1] || '30';
      let patientGender = parts[2] || 'Male';

      if (/\b(male|female|other)\b/i.test(patientAge)) {
        const genderMatch = patientAge.match(/\b(male|female|other)\b/i);
        if (genderMatch && (!parts[2] || !parts[2].trim())) {
          patientGender = genderMatch[0].charAt(0).toUpperCase() + genderMatch[0].slice(1).toLowerCase();
        }
        patientAge = patientAge.replace(/\b(male|female|other)\b/gi, '').replace(/\//g, '').trim();
      }

      const appointmentId = 'APT-' + Math.floor(100000 + Math.random() * 900000);

      // Save to Database with status 'PENDING'
      await saveAppointmentToDb({
        id: appointmentId,
        patientName,
        patientPhone: phone,
        patientAge,
        patientGender,
        doctorId: userState.doctorId || 'default_doc',
        doctorName: userState.doctorName || 'Consulting Doctor',
        appointmentDate: userState.selectedDate || new Date().toISOString().split('T')[0],
        appointmentTime: userState.selectedTimeSlot || 'Standard Slot',
        notes: `WhatsApp Booking request via bot`,
        source: 'WHATSAPP',
        status: 'PENDING',
        createdAt: new Date().toISOString()
      });

      // Clear conversation state
      delete conversationState[phone];

      const confirmationMsg =
        `🎉 *APPOINTMENT BOOKING REQUEST SUBMITTED!*\n\n` +
        `📋 *Booking Details:*\n` +
        `• *Booking ID:* ${appointmentId}\n` +
        `• *Patient Name:* ${patientName} (${patientAge}, ${patientGender})\n` +
        `• *Doctor:* ${userState.doctorName}\n` +
        `• *Date:* ${userState.selectedDateFormatted || userState.selectedDate}\n` +
        `• *Time Slot:* ${userState.selectedTimeSlot}\n` +
        `• *Status:* ⏳ Pending Reception Approval\n\n` +
        `Our clinic reception will review and confirm your slot shortly. Thank you for choosing MedFlow Clinic!`;

      await socket.sendMessage(jid, { text: confirmationMsg });
      break;
    }

    default:
      userState.step = 1;
      conversationState[phone] = userState;
      await handleIncomingBookingFlow(socket, jid, phone, text);
  }
}

