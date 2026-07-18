import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { APG2_PROFILE, GlassBadge, GlassButton, GlassCard, GlassInput, GlassPanel, GlassSection } from '../components/Apg2ProfileGlass.jsx';
import { userAction } from '../userApi.js';
import { logError } from '../errorLogger.js';
import { buildBookingProfile, buildBookingSlots, formatBookingDateKey, getUpcomingBookingDates } from '../../server-shared/booking.js';
import { getMainLocation, getProfileLocations, locationBookingPayload, locationToProvider } from '../../server-shared/locations.js';

function formatDate(date) {
  return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatFullDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });
}

export function canOpenBookingFlow(profile, type) {
  return buildBookingProfile(profile || {}, type).enabled;
}

export function BookingFlow({ open, provider, providerType = 'partner', user, onClose, onCreated, onOpenDialog }) {
  const locations = useMemo(() => providerType === 'partner' ? getProfileLocations(provider || {}) : [], [provider, providerType]);
  const mainLocation = useMemo(() => getMainLocation(provider || {}), [provider]);
  const initialLocationId = String(provider?.locationId || mainLocation?.id || locations[0]?.id || '');
  const [selectedLocationId, setSelectedLocationId] = useState(() => initialLocationId);
  const selectedLocation = locations.find(item => item.id === selectedLocationId) || mainLocation || locations[0] || null;
  const effectiveProvider = useMemo(() => locationToProvider(provider || {}, selectedLocation), [provider, selectedLocation]);
  const bookingProfile = useMemo(() => buildBookingProfile(effectiveProvider || {}, providerType), [effectiveProvider, providerType]);
  const [selectedServiceId, setSelectedServiceId] = useState(() => bookingProfile.services[0]?.id || '');
  const [selectedSpecialistId, setSelectedSpecialistId] = useState(() => bookingProfile.specialists[0]?.id || '');
  const [selectedDateKey, setSelectedDateKey] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const service = bookingProfile.services.find(item => item.id === selectedServiceId) || bookingProfile.services[0] || null;
  const specialists = bookingProfile.specialists.filter(item => !service?.id || item.serviceIds.includes(service.id));
  const specialist = specialists.find(item => item.id === selectedSpecialistId) || specialists[0] || null;
  const dates = useMemo(() => getUpcomingBookingDates(14).slice(0, 10), []);
  const activeDate = dates.find(date => formatBookingDateKey(date) === selectedDateKey) || null;
  const slots = activeDate ? buildBookingSlots({ date: activeDate, service, specialist, profile: effectiveProvider }) : [];
  const slot = slots.find(item => item.id === selectedSlotId) || null;
  const locationStepNeeded = providerType === 'partner' && locations.length > 1;
  const serviceStepNeeded = bookingProfile.services.length > 1;
  const specialistStepNeeded = specialists.length > 1;
  const specialistIdsKey = specialists.map(item => item.id).join('|');

  useEffect(() => {
    if (!open) return;
    setSelectedLocationId(initialLocationId);
    setSelectedServiceId(bookingProfile.services[0]?.id || '');
    setSelectedSpecialistId(bookingProfile.specialists[0]?.id || '');
    setSelectedDateKey('');
    setSelectedSlotId('');
    setComment('');
    setError('');
  }, [bookingProfile.providerId, bookingProfile.providerType, initialLocationId, locations.length, open]);

  useEffect(() => {
    if (!open) return;
    if (specialists.some(item => item.id === selectedSpecialistId)) return;
    setSelectedSpecialistId(specialists[0]?.id || '');
    setSelectedSlotId('');
  }, [open, selectedSpecialistId, selectedLocationId, selectedServiceId, specialistIdsKey]);

  if (!open || !provider || !bookingProfile.enabled) return null;

  const createBooking = async () => {
    if (!service || !slot || saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await userAction('booking:create', {
        providerType: bookingProfile.providerType,
        providerId: bookingProfile.providerId,
        service,
        specialist,
        slot,
        location: locationBookingPayload(selectedLocation),
        locationId: selectedLocation?.id || '',
        locationTitle: selectedLocation?.title || '',
        comment,
        userId: String(user?.id || ''),
      });
      onCreated?.(result.booking);
      if (result.dialogId) onOpenDialog?.(result.dialogId);
      onClose?.();
    } catch (e) {
      logError(e, 'BookingFlow.createBooking');
      setError(e?.message || 'Не удалось создать запись.');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 15000, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', overflowY: 'auto' }} onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <GlassPanel style={{ minHeight: '100svh', maxWidth: 560, margin: '0 auto', background: 'transparent', paddingBottom: 'calc(36px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <GlassButton onClick={onClose} style={{ width: 42, minHeight: 42, borderRadius: 17, padding: 0 }}>‹</GlassButton>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 22, lineHeight: '27px', fontWeight: 930 }}>Онлайн-запись</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 13, lineHeight: '18px', marginTop: 2 }}>{bookingProfile.title}</div>
          </div>
        </div>

        <GlassCard style={{ borderRadius: 32, display: 'flex', gap: 13, alignItems: 'center', marginBottom: 14 }}>
          {bookingProfile.image ? <img src={bookingProfile.image} alt="" style={{ width: 58, height: 58, borderRadius: 22, objectFit: 'cover', flexShrink: 0 }} /> : <div style={{ width: 58, height: 58, borderRadius: 22, background: APG2_PROFILE.goldSoft, display: 'grid', placeItems: 'center', color: APG2_PROFILE.gold, fontSize: 24, flexShrink: 0 }}>📅</div>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 16, lineHeight: '21px', fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookingProfile.title}</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12.5, lineHeight: '18px', marginTop: 4 }}>{selectedLocation?.title && locationStepNeeded ? `${selectedLocation.title} · ${selectedLocation.address || 'локация выбрана'}` : bookingProfile.subtitle || bookingProfile.address || 'Выберите услугу и свободное время'}</div>
          </div>
          <GlassBadge tone="gold">АПГ</GlassBadge>
        </GlassCard>

        {locationStepNeeded && (
          <GlassSection title="Локация">
            <div style={{ display: 'grid', gap: 9 }}>
              {locations.map(item => {
                const active = item.id === selectedLocation?.id;
                return (
                  <GlassCard key={item.id} onClick={() => { setSelectedLocationId(item.id); setSelectedDateKey(''); setSelectedSlotId(''); }} tone={active ? 'gold' : 'glass'} style={{ borderRadius: 24, padding: 13, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', color: active ? '#17120a' : APG2_PROFILE.text, fontSize: 14.5, lineHeight: '19px', fontWeight: 850 }}>{item.title || 'Локация'}</span>
                      {item.address && <span style={{ display: 'block', color: active ? 'rgba(23,18,10,0.62)' : APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '16px', marginTop: 2 }}>{item.address}</span>}
                      {(item.workingHours || item.phone) && <span style={{ display: 'block', color: active ? 'rgba(23,18,10,0.52)' : APG2_PROFILE.textMuted, fontSize: 11.5, lineHeight: '15px', marginTop: 2 }}>{[item.workingHours, item.phone].filter(Boolean).join(' · ')}</span>}
                    </span>
                    <span style={{ color: active ? '#17120a' : APG2_PROFILE.gold }}>{active ? '✓' : '›'}</span>
                  </GlassCard>
                );
              })}
            </div>
          </GlassSection>
        )}

        {serviceStepNeeded && (
          <GlassSection title="Услуга">
            <div style={{ display: 'grid', gap: 9 }}>
              {bookingProfile.services.map(item => {
                const active = item.id === service?.id;
                return (
                  <GlassCard key={item.id} onClick={() => { setSelectedServiceId(item.id); setSelectedSlotId(''); }} tone={active ? 'gold' : 'glass'} style={{ borderRadius: 24, padding: 13, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center' }}>
                    <span>
                      <span style={{ display: 'block', color: active ? '#17120a' : APG2_PROFILE.text, fontSize: 14.5, lineHeight: '19px', fontWeight: 850 }}>{item.title}</span>
                      <span style={{ display: 'block', color: active ? 'rgba(23,18,10,0.62)' : APG2_PROFILE.textMuted, fontSize: 12, lineHeight: '16px', marginTop: 2 }}>{item.durationMinutes} мин{item.price ? ` · ${item.price}` : ''}</span>
                    </span>
                    <span style={{ color: active ? '#17120a' : APG2_PROFILE.gold }}>{active ? '✓' : '›'}</span>
                  </GlassCard>
                );
              })}
            </div>
          </GlassSection>
        )}

        {specialistStepNeeded && (
          <GlassSection title="Специалист">
            <div style={{ display: 'grid', gap: 9 }}>
              {specialists.map(item => {
                const active = item.id === specialist?.id;
                return (
                  <GlassCard key={item.id} onClick={() => { setSelectedSpecialistId(item.id); setSelectedSlotId(''); }} tone={active ? 'gold' : 'glass'} style={{ borderRadius: 24, padding: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
                    {item.photo ? <img src={item.photo} alt="" style={{ width: 38, height: 38, borderRadius: 15, objectFit: 'cover' }} /> : <span style={{ width: 38, height: 38, borderRadius: 15, background: active ? 'rgba(23,18,10,0.12)' : APG2_PROFILE.goldSoft, display: 'grid', placeItems: 'center' }}>✦</span>}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', color: active ? '#17120a' : APG2_PROFILE.text, fontSize: 14, fontWeight: 850 }}>{item.name}</span>
                      {item.description && <span style={{ display: 'block', color: active ? 'rgba(23,18,10,0.62)' : APG2_PROFILE.textMuted, fontSize: 12, marginTop: 2 }}>{item.description}</span>}
                    </span>
                  </GlassCard>
                );
              })}
            </div>
          </GlassSection>
        )}

        <GlassSection title="Дата">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {dates.map(date => {
              const key = formatBookingDateKey(date);
              const active = key === selectedDateKey;
              return <GlassButton key={key} tone={active ? 'gold' : 'glass'} onClick={() => { setSelectedDateKey(key); setSelectedSlotId(''); }} style={{ minHeight: 50, borderRadius: 20, color: active ? '#17120a' : APG2_PROFILE.text }}>{formatDate(date)}</GlassButton>;
            })}
          </div>
        </GlassSection>

        {activeDate && (
          <GlassSection title="Время">
            {slots.length ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                {slots.map(item => {
                  const active = item.id === selectedSlotId;
                  return <GlassButton key={item.id} tone={active ? 'gold' : 'glass'} onClick={() => setSelectedSlotId(item.id)} style={{ minHeight: 44, borderRadius: 18, color: active ? '#17120a' : APG2_PROFILE.text }}>{item.time}</GlassButton>;
                })}
              </div>
            ) : <GlassCard style={{ borderRadius: 24, color: APG2_PROFILE.textMuted, textAlign: 'center' }}>На эту дату свободных окон нет.</GlassCard>}
          </GlassSection>
        )}

        <GlassSection title="Подтверждение">
          <GlassCard style={{ borderRadius: 28, display: 'grid', gap: 9 }}>
            <div style={{ color: APG2_PROFILE.text, fontSize: 16, fontWeight: 880 }}>{service?.title || 'Услуга'}</div>
            <div style={{ color: APG2_PROFILE.textSoft, fontSize: 13, lineHeight: '19px' }}>{specialist?.name || 'Специалист'}{selectedLocation?.title && locationStepNeeded ? ` · ${selectedLocation.title}` : ''}{slot ? ` · ${formatFullDate(slot.startAt)} · ${slot.time}` : ''}</div>
            <div style={{ color: APG2_PROFILE.textMuted, fontSize: 12.5, lineHeight: '18px' }}>{service?.durationMinutes || 60} мин{service?.price ? ` · ${service.price}` : ''}</div>
            <GlassInput value={comment} onChange={e => setComment(e.target.value)} placeholder="Комментарий к записи" style={{ minHeight: 46, borderRadius: 18, fontSize: 14 }} />
            {error && <div style={{ color: '#ff9aa8', fontSize: 12.5, lineHeight: '18px' }}>{error}</div>}
            <GlassButton tone="gold" onClick={createBooking} disabled={!slot || saving} style={{ width: '100%', color: '#17120a', opacity: !slot || saving ? 0.55 : 1 }}>{saving ? 'Создаем запись...' : 'Подтвердить запись'}</GlassButton>
          </GlassCard>
        </GlassSection>
      </GlassPanel>
    </div>,
    document.body,
  );
}
