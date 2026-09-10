import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Check, X, AlertCircle, Globe, Compass } from 'lucide-react';

interface LocationData {
  country?: string;
  governorate?: string;
  city?: string;
  street?: string;
  addressDetails?: string;
  lat?: number;
  lng?: number;
  gps_location?: string;
}

interface LocationMapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (data: LocationData) => void;
  initialData?: LocationData;
  isAr?: boolean;
}

const DEFAULT_LAT = 15.3694; // صنعاء كمركز افتراضي
const DEFAULT_LNG = 44.1910;

export default function LocationMapPickerModal({
  isOpen,
  onClose,
  onSelectLocation,
  initialData = {},
  isAr = true
}: LocationMapPickerModalProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [formData, setFormData] = useState<LocationData>({
    country: initialData.country || 'اليمن',
    governorate: initialData.governorate || '',
    city: initialData.city || '',
    street: initialData.street || '',
    addressDetails: initialData.addressDetails || '',
    lat: initialData.lat || DEFAULT_LAT,
    lng: initialData.lng || DEFAULT_LNG,
    gps_location: initialData.gps_location || ''
  });

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData({
        country: initialData.country || 'اليمن',
        governorate: initialData.governorate || '',
        city: initialData.city || '',
        street: initialData.street || '',
        addressDetails: initialData.addressDetails || '',
        lat: initialData.lat || DEFAULT_LAT,
        lng: initialData.lng || DEFAULT_LNG,
        gps_location: initialData.gps_location || ''
      });
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const lat = formData.lat || DEFAULT_LAT;
    const lng = formData.lng || DEFAULT_LNG;

    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: formData.lat ? 15 : 12,
          zoomControl: false,
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
          maxZoom: 19,
        }).addTo(map);

        const goldIcon = L.divIcon({
          className: 'custom-gold-marker',
          html: `
            <div style="
              width: 32px;
              height: 32px;
              background: radial-gradient(circle, #f59e0b 0%, #d4af37 100%);
              border: 2px solid #ffffff;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              box-shadow: 0 4px 14px rgba(212, 175, 55, 0.6);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="width: 10px; height: 10px; background: #000; border-radius: 50%;"></div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });

        const marker = L.marker([lat, lng], {
          icon: goldIcon,
          draggable: true,
        }).addTo(map);

        markerRef.current = marker;
        mapInstanceRef.current = map;

        map.on('click', (e: L.LeafletMouseEvent) => {
          const newLat = parseFloat(e.latlng.lat.toFixed(6));
          const newLng = parseFloat(e.latlng.lng.toFixed(6));
          marker.setLatLng([newLat, newLng]);
          setFormData(prev => ({
            ...prev,
            lat: newLat,
            lng: newLng,
            gps_location: `https://maps.google.com/?q=${newLat},${newLng}`
          }));
        });

        marker.on('dragend', () => {
          const position = marker.getLatLng();
          const newLat = parseFloat(position.lat.toFixed(6));
          const newLng = parseFloat(position.lng.toFixed(6));
          setFormData(prev => ({
            ...prev,
            lat: newLat,
            lng: newLng,
            gps_location: `https://maps.google.com/?q=${newLat},${newLng}`
          }));
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map);
      } else {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError(isAr ? 'خاصية تحديد الموقع غير مدعومة في متصفحك' : 'Geolocation not supported');
      return;
    }

    setGeoLoading(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLat = parseFloat(position.coords.latitude.toFixed(6));
        const newLng = parseFloat(position.coords.longitude.toFixed(6));

        setGeoLoading(false);
        setFormData(prev => ({
          ...prev,
          lat: newLat,
          lng: newLng,
          gps_location: `https://maps.google.com/?q=${newLat},${newLng}`
        }));

        if (mapInstanceRef.current && markerRef.current) {
          const latLng = new L.LatLng(newLat, newLng);
          markerRef.current.setLatLng(latLng);
          mapInstanceRef.current.setView(latLng, 16);
        }
      },
      (err) => {
        setGeoLoading(false);
        setGeoError(isAr ? 'تعذر جلب موقعك الحالي، يرجى تفعيل الـ GPS والتأكد من إذن الموقع' : 'Failed to retrieve location');
        console.warn('Geolocation error:', err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleConfirm = () => {
    const finalGps = formData.gps_location || (formData.lat && formData.lng ? `https://maps.google.com/?q=${formData.lat},${formData.lng}` : '');
    onSelectLocation({
      ...formData,
      gps_location: finalGps
    });
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000000] isolate flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 select-none" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex w-full max-w-4xl max-h-[92vh] flex-col overflow-hidden rounded-3xl border border-[#d4af37]/30 bg-[#0f0f12] shadow-2xl">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-850 bg-black/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#d4af37]">
              <Compass className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-white text-sm">
                {isAr ? 'خريطة اختيار وتثبيت الموقع الجغرافي (GPS)' : 'Interactive Location Map Picker'}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold">
                {isAr ? 'اضغط على الخريطة أو اسحب المؤشر لتحديد موقع العميل بدقة' : 'Click map or drag marker to select exact coordinates'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 border border-slate-800 p-2 text-slate-400 transition hover:text-white hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-start">
          {/* Address details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-wider">{isAr ? 'الدولة' : 'Country'}</label>
              <input
                type="text"
                value={formData.country || ''}
                onChange={e => setFormData({ ...formData, country: e.target.value })}
                placeholder={isAr ? 'اليمن، السعودية...' : 'Country'}
                className="w-full rounded-xl border border-slate-800 bg-black/50 p-2.5 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-wider">{isAr ? 'المحافظة / المنطقة' : 'State / Region'}</label>
              <input
                type="text"
                value={formData.governorate || ''}
                onChange={e => setFormData({ ...formData, governorate: e.target.value })}
                placeholder={isAr ? 'صنعاء، عدن، الرياض...' : 'Governorate'}
                className="w-full rounded-xl border border-slate-800 bg-black/50 p-2.5 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-wider">{isAr ? 'المدينة' : 'City'}</label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={e => setFormData({ ...formData, city: e.target.value })}
                placeholder={isAr ? 'المدينة...' : 'City'}
                className="w-full rounded-xl border border-slate-800 bg-black/50 p-2.5 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-wider">{isAr ? 'الشارع / الحي' : 'Street / District'}</label>
              <input
                type="text"
                value={formData.street || ''}
                onChange={e => setFormData({ ...formData, street: e.target.value })}
                placeholder={isAr ? 'اسم الشارع أو الحي...' : 'Street'}
                className="w-full rounded-xl border border-slate-800 bg-black/50 p-2.5 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-wider">{isAr ? 'تفاصيل ومعالم العنوان التفصيلية' : 'Landmarks & Address Details'}</label>
            <input
              type="text"
              value={formData.addressDetails || ''}
              onChange={e => setFormData({ ...formData, addressDetails: e.target.value })}
              placeholder={isAr ? 'بجوار مسجد... عمارة رقم... الشقة...' : 'Landmarks...'}
              className="w-full rounded-xl border border-slate-800 bg-black/50 p-2.5 text-xs font-bold text-white outline-none focus:border-[#d4af37]/60"
            />
          </div>

          {/* Interactive Map */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-[#d4af37] flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {isAr ? 'تثبيت الإحداثيات على الخريطة (GPS Pin)' : 'Pin Coordinates on Map'}
              </span>

              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={geoLoading}
                className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[#d4af37] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Navigation className={`w-3.5 h-3.5 ${geoLoading ? 'animate-spin' : ''}`} />
                {geoLoading ? (isAr ? 'جاري التحديد...' : 'Locating...') : (isAr ? 'موقعي الحالي (GPS)' : 'Current GPS Location')}
              </button>
            </div>

            {geoError && (
              <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{geoError}</span>
              </div>
            )}

            <div className="relative w-full h-[320px] rounded-2xl overflow-hidden border border-[#d4af37]/40 shadow-inner">
              <div ref={mapContainerRef} className="w-full h-full" />

              {/* Coordinates Badge */}
              <div className="absolute top-3 right-3 z-[1000] bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#d4af37]/40 text-[11px] font-mono font-bold text-slate-200 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#d4af37]" />
                {formData.lat && formData.lng ? (
                  <span>{formData.lat}, {formData.lng}</span>
                ) : (
                  <span className="text-slate-400">{isAr ? 'اضغط على الخريطة لتثبيت الدبوس' : 'Click map to set pin'}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-850 bg-black/60 px-5 py-3">
          <span className="text-[11px] font-mono text-slate-400 truncate max-w-md">
            {formData.gps_location || (formData.lat && formData.lng ? `https://maps.google.com/?q=${formData.lat},${formData.lng}` : '')}
          </span>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-5 py-2 text-xs font-bold text-slate-400 transition hover:bg-slate-800"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="rounded-xl bg-gradient-to-r from-[#d4af37] to-yellow-600 px-6 py-2 text-xs font-black text-black transition hover:from-yellow-600 hover:to-[#d4af37] shadow-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {isAr ? 'اعتماد وتثبيت الموقع' : 'Confirm Location'}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
