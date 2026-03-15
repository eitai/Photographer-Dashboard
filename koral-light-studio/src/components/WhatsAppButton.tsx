import { MessageCircle } from "lucide-react";

interface WhatsAppButtonProps {
  phone?: string;
}

const toWhatsApp = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? '972' + digits.slice(1) : digits;
};

export const WhatsAppButton = ({ phone }: WhatsAppButtonProps = {}) => {
  const number = phone ? toWhatsApp(phone) : '972500000000';

  return (
    <a
      href={`https://wa.me/${number}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contact via WhatsApp"
      className="fixed bottom-5 end-4 sm:bottom-6 sm:end-6 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform duration-200"
    >
      <MessageCircle className="w-6 h-6 text-background" fill="currentColor" />
    </a>
  );
};
