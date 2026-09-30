import React from 'react';
import { Truck, Plus, Trash2, Power } from 'lucide-react';
import { SectionCard, FieldLabel, FieldInput } from './settingsHelpers';

export function LogisticsSettingsTab({
  isAr,
  settings,
  setSettings,
  shippingCompanies = [],
  showAddCarrierModal,
  setShowAddCarrierModal,
  carrierFormData,
  setCarrierFormData,
  handleAddShippingCarrier,
  handleToggleCarrierActive,
  handleDeleteShippingCarrier
}: any) {
  return (
    <div className="space-y-5 animate-fade-slide-in">
      <SectionCard title={isAr ? 'شركات الشحن والربط اللوجستي' : 'Shipping Carriers & Logistics'} icon={Truck}>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-slate-400">{isAr ? 'قائمة شركات الشحن المعتمدة' : 'Registered Carriers'}</span>
            <button type="button" onClick={() => setShowAddCarrierModal(true)} className="px-3 py-1.5 bg-[#d4af37] text-black font-black text-xs rounded-xl flex items-center gap-1">
              <Plus className="w-4 h-4" />
              {isAr ? 'إضافة شركة شحن' : 'Add Carrier'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shippingCompanies.map((c: any) => (
              <div key={c.id} className="p-3 bg-black/40 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-white block">{c.name}</span>
                  <span className="text-[10px] text-slate-500">{c.phone || c.contact_person || (isAr ? 'لا يوجد هاتف' : 'No Phone')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleToggleCarrierActive(c.id, c.active)} className="p-1.5 text-slate-400 hover:text-white">
                    <Power className={`w-4 h-4 ${c.active ? 'text-emerald-400' : 'text-slate-600'}`} />
                  </button>
                  <button type="button" onClick={() => handleDeleteShippingCarrier(c.id)} className="p-1.5 text-rose-400 hover:text-rose-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
