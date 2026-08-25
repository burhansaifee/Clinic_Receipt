import { format } from 'date-fns';
import type { Receipt } from './storage';

/**
 * Normalizes phone numbers to international format (defaulting to 91 for 10-digit Indian numbers)
 */
export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  let digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

/**
 * Formats a clean, readable medical invoice message for WhatsApp
 */
export function formatReceiptWhatsAppMessage(receipt: Receipt): string {
  const formattedDate = receipt.date ? receipt.date.split(' ')[0] : format(new Date(), 'yyyy-MM-dd');
  const itemsText = (receipt.items || [])
    .filter(item => item.description)
    .map(item => `  • *${item.description}*: ₹${Number(item.amount || 0).toFixed(2)}`)
    .join('\n');

  const totalNum = typeof receipt.total === 'number' ? receipt.total : parseFloat(receipt.total as any) || 0;

  let message = `🏥 *BUVORA CLINIC - MEDICAL INVOICE*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📄 *Receipt No:* #${receipt.receiptNumber}\n`;
  message += `📅 *Date:* ${formattedDate}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  message += `👤 *PATIENT INFORMATION:*\n`;
  message += `• *Name:* ${receipt.patientName}\n`;
  if (receipt.patientAge || receipt.patientGender) {
    message += `• *Age / Gender:* ${receipt.patientAge || 'N/A'} | ${receipt.patientGender || 'N/A'}\n`;
  }
  if (receipt.patientPhone) {
    message += `• *Contact:* ${receipt.patientPhone}\n`;
  }
  message += `• *Consulting Doctor:* Dr. ${receipt.doctorName || 'Consulting Physician'}\n\n`;

  message += `📋 *SERVICES & CHARGES:*\n`;
  if (itemsText) {
    message += `${itemsText}\n`;
  } else {
    message += `  • General Consultation: ₹${totalNum.toFixed(2)}\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💳 *Payment Mode:* ${receipt.paymentMethod || 'CASH'}\n`;
  message += `💰 *TOTAL AMOUNT:* *₹${totalNum.toFixed(2)}*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  message += `✨ _Thank you for visiting Buvora Clinic. Wishing you a swift recovery and good health!_\n`;
  message += `📞 _For assistance or follow-up appointments, please reach out to our reception._`;

  return message;
}

export interface SendWhatsAppReceiptResult {
  success: boolean;
  method: 'bot' | 'web';
  message?: string;
  error?: string;
}

/**
 * Sends a receipt to the patient via the built-in WhatsApp Bot if connected,
 * otherwise falls back to opening WhatsApp Web / App.
 */
export async function sendReceiptViaWhatsApp(
  receipt: Receipt,
  targetPhone?: string
): Promise<SendWhatsAppReceiptResult> {
  const phone = cleanPhoneNumber(targetPhone || receipt.patientPhone);
  if (!phone) {
    throw new Error('Patient phone number is missing. Please provide a valid phone number.');
  }

  const messageText = formatReceiptWhatsAppMessage(receipt);

  // Check if built-in bot is available and connected
  const bot = (window as any).whatsappBot;
  let isBotConnected = false;

  if (bot && typeof bot.getStatus === 'function') {
    try {
      const status = await bot.getStatus();
      isBotConnected = status && status.status === 'CONNECTED';
    } catch {
      isBotConnected = false;
    }
  }

  if (isBotConnected && typeof bot.sendMessage === 'function') {
    try {
      await bot.sendMessage(phone, messageText);
      return {
        success: true,
        method: 'bot',
        message: `Receipt #${receipt.receiptNumber} was sent successfully via WhatsApp bot to +${phone}.`,
      };
    } catch (err: any) {
      console.warn('Failed to send via WhatsApp bot, falling back to WhatsApp Web:', err);
      // Fall through to web fallback
    }
  }

  // Fallback to wa.me URL
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`;
  if ((window as any).system?.openExternal) {
    try {
      await (window as any).system.openExternal(waUrl);
    } catch {
      window.open(waUrl, '_blank');
    }
  } else {
    window.open(waUrl, '_blank');
  }

  return {
    success: true,
    method: 'web',
    message: `WhatsApp opened for +${phone}. Click "Send" in WhatsApp to dispatch the receipt.`,
  };
}

/**
 * Formats a friendly follow-up reminder message for WhatsApp
 */
export function formatFollowUpWhatsAppMessage(followUp: {
  patientName: string;
  doctorName: string;
  scheduledDate: string;
  notes?: string;
}): string {
  let formattedDate = followUp.scheduledDate;
  try {
    formattedDate = format(new Date(followUp.scheduledDate + 'T00:00:00'), 'EEEE, dd MMMM yyyy');
  } catch (e) {
    formattedDate = followUp.scheduledDate;
  }

  let message = `🏥 *BUVORA CLINIC - DOCTOR FOLLOW-UP REMINDER*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `Dear *${followUp.patientName}*,\n\n`;
  message += `This is a gentle reminder from *Buvora Clinic* regarding your upcoming follow-up consultation with *Dr. ${followUp.doctorName.replace(/^Dr\.?\s*/i, '')}*.\n\n`;
  message += `📅 *Scheduled Date:* ${formattedDate}\n`;
  if (followUp.notes && followUp.notes.trim()) {
    message += `📋 *Consultation Advice / Reason:* ${followUp.notes.trim()}\n`;
  }
  message += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `💡 *Important Notes for your visit:*\n`;
  message += `• Please bring your previous prescription & any latest lab test reports.\n`;
  message += `• Please arrive 10-15 minutes prior to your preferred time slot.\n\n`;
  message += `✨ _We look forward to seeing you and ensuring your continued recovery!_\n`;
  message += `📞 _To reschedule or for queries, feel free to reply to this message or contact clinic reception._`;

  return message;
}

/**
 * Sends a follow-up reminder to the patient via WhatsApp Bot if connected or WhatsApp Web.
 */
export async function sendFollowUpViaWhatsApp(
  followUp: {
    patientName: string;
    patientPhone?: string;
    doctorName: string;
    scheduledDate: string;
    notes?: string;
  },
  targetPhone?: string
): Promise<SendWhatsAppReceiptResult> {
  const phone = cleanPhoneNumber(targetPhone || followUp.patientPhone || '');
  if (!phone) {
    throw new Error('Patient phone number is missing. Please provide a valid phone number.');
  }

  const messageText = formatFollowUpWhatsAppMessage(followUp);

  const bot = (window as any).whatsappBot;
  let isBotConnected = false;

  if (bot && typeof bot.getStatus === 'function') {
    try {
      const status = await bot.getStatus();
      isBotConnected = status && status.status === 'CONNECTED';
    } catch {
      isBotConnected = false;
    }
  }

  if (isBotConnected && typeof bot.sendMessage === 'function') {
    try {
      await bot.sendMessage(phone, messageText);
      return {
        success: true,
        method: 'bot',
        message: `Follow-up reminder sent successfully via WhatsApp bot to +${phone}.`,
      };
    } catch (err: any) {
      console.warn('Failed to send via WhatsApp bot, falling back to WhatsApp Web:', err);
    }
  }

  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`;
  if ((window as any).system?.openExternal) {
    try {
      await (window as any).system.openExternal(waUrl);
    } catch {
      window.open(waUrl, '_blank');
    }
  } else {
    window.open(waUrl, '_blank');
  }

  return {
    success: true,
    method: 'web',
    message: `WhatsApp opened for +${phone}. Click "Send" in WhatsApp to dispatch the follow-up reminder.`,
  };
}
