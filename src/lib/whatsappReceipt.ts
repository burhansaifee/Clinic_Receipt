import { format } from 'date-fns';
import type { Receipt } from './storage';

/**
 * Normalizes phone numbers to international format (defaulting to 91 for 10-digit Indian numbers)
 */
export function cleanPhoneNumber(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
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
  window.open(waUrl, '_blank');

  return {
    success: true,
    method: 'web',
    message: `WhatsApp Web opened for +${phone}. Click "Send" in WhatsApp to dispatch the receipt.`,
  };
}
