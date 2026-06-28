import { useState } from 'react';
import { AlertTriangle, Send, MapPin } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useI18n } from '@/lib/i18n';

export interface AddressData {
  addressStreet: string;
  addressApartment?: string;
  addressCity: string;
  addressZip?: string;
  addressCountry?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { photographerNote?: string; address?: AddressData }) => void;
  clientName: string;
  hasAddress: boolean;
  orderName: string;
  isSending: boolean;
}

export const SendToSupplierModal = ({
  open,
  onClose,
  onConfirm,
  clientName,
  hasAddress,
  orderName,
  isSending,
}: Props) => {
  const { t } = useI18n();

  const [note, setNote] = useState('');
  const [street, setStreet] = useState('');
  const [apartment, setApartment] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('ישראל');

  const addressRequired = !hasAddress;
  const addressValid = !addressRequired || (street.trim() !== '' && city.trim() !== '');

  const handleConfirm = () => {
    if (!addressValid) return;

    const address: AddressData | undefined = addressRequired
      ? {
          addressStreet: street.trim(),
          ...(apartment.trim() ? { addressApartment: apartment.trim() } : {}),
          addressCity: city.trim(),
          ...(zip.trim() ? { addressZip: zip.trim() } : {}),
          ...(country.trim() ? { addressCountry: country.trim() } : {}),
        }
      : undefined;

    onConfirm({
      ...(note.trim() ? { photographerNote: note.trim() } : {}),
      ...(address ? { address } : {}),
    });
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/40';

  return (
    <Modal isOpen={open} onClose={isSending ? undefined : onClose} maxWidth='max-w-md'>
      <div className='space-y-4'>
        {/* Header */}
        <div>
          <h3 className='text-base font-semibold text-charcoal'>
            {t('orders.action.send_to_supplier')}
          </h3>
          <p className='text-xs text-warm-gray mt-0.5'>{orderName}</p>
        </div>

        {/* Missing address warning + form */}
        {addressRequired && (
          <div className='space-y-3'>
            <div className='flex items-start gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5'>
              <AlertTriangle size={14} className='text-amber-600 shrink-0 mt-0.5' />
              <p className='text-xs text-amber-800'>
                {t('admin.supplier_modal.no_address_warning_prefix')}{' '}
                <span className='font-medium'>&ldquo;{clientName}&rdquo;</span>{' '}
                {t('admin.supplier_modal.no_address_warning_suffix')}
              </p>
            </div>

            <div className='space-y-2.5'>
              <p className='text-xs font-medium text-warm-gray flex items-center gap-1.5'>
                <MapPin size={11} />
                {t('admin.client.address_section')}
              </p>

              <div>
                <label className='block text-xs text-warm-gray mb-1'>
                  {t('admin.client.address_street')} *
                </label>
                <input
                  type='text'
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  disabled={isSending}
                  className={inputClass}
                />
              </div>

              <div className='grid grid-cols-2 gap-2.5'>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>
                    {t('admin.client.address_apartment')}
                  </label>
                  <input
                    type='text'
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    disabled={isSending}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>
                    {t('admin.client.address_city')} *
                  </label>
                  <input
                    type='text'
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={isSending}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>
                    {t('admin.client.address_zip')}
                  </label>
                  <input
                    type='text'
                    value={zip}
                    onChange={(e) => setZip(e.target.value)}
                    disabled={isSending}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className='block text-xs text-warm-gray mb-1'>
                    {t('admin.client.address_country')}
                  </label>
                  <input
                    type='text'
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    disabled={isSending}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Photographer notes */}
        <div>
          <label className='block text-xs text-warm-gray mb-1'>
            {t('orders.note.photographer')}{' '}
            <span className='text-warm-gray/60'>({t('admin.common.optional')})</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isSending}
            rows={3}
            className='w-full px-3 py-2 rounded-lg border border-beige bg-ivory text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-blush/40 resize-none'
          />
        </div>

        {/* Actions */}
        <div className='flex items-center gap-2 pt-1'>
          <button
            type='button'
            onClick={handleConfirm}
            disabled={isSending || !addressValid}
            className='flex items-center gap-1.5 bg-blush text-charcoal px-4 py-2 rounded-xl text-sm font-medium hover:bg-blush/80 transition-colors disabled:opacity-60'
          >
            <Send size={13} />
            {isSending ? t('admin.common.saving') : t('orders.action.send_to_supplier')}
          </button>
          <button
            type='button'
            onClick={onClose}
            disabled={isSending}
            className='px-4 py-2 rounded-xl text-sm text-warm-gray border border-beige hover:bg-ivory transition-colors disabled:opacity-60'
          >
            {t('admin.common.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  );
};
