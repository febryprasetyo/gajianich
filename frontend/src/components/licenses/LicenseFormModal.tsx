'use client';

import React, { useState, useEffect } from 'react';
import ModalShell from '@/components/ui/ModalShell';
import { api } from '@/lib/api';
import { Key, Loader2, AlertCircle } from 'lucide-react';
import { SoftwareLicense, Vendor, LocationItem } from '@/lib/licenses/types';

export interface LicenseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialLicense?: SoftwareLicense | null;
  vendors: Vendor[];
  locations: LocationItem[];
}

export default function LicenseFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialLicense = null,
  vendors,
  locations,
}: LicenseFormModalProps) {
  const [name, setName] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseType, setLicenseType] = useState('Perpetual');
  const [vendorId, setVendorId] = useState<number | ''>('');
  const [locationId, setLocationId] = useState<number | ''>('');
  const [totalSeats, setTotalSeats] = useState<number>(1);
  const [purchaseDate, setPurchaseDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [cost, setCost] = useState('');
  const [status, setStatus] = useState('Active');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (initialLicense) {
        setName(initialLicense.name || '');
        setLicenseKey(initialLicense.licenseKey || '');
        setLicenseType(initialLicense.licenseType || 'Perpetual');
        setVendorId(initialLicense.vendorId || '');
        setLocationId(initialLicense.locationId || '');
        setTotalSeats(initialLicense.totalSeats || 1);
        setPurchaseDate(
          initialLicense.purchaseDate
            ? new Date(initialLicense.purchaseDate).toISOString().split('T')[0]
            : ''
        );
        setExpirationDate(
          initialLicense.expirationDate
            ? new Date(initialLicense.expirationDate).toISOString().split('T')[0]
            : ''
        );
        setCost(
          initialLicense.cost !== undefined && initialLicense.cost !== null
            ? String(initialLicense.cost)
            : ''
        );
        setStatus(initialLicense.status || 'Active');
        setNotes(initialLicense.notes || '');
      } else {
        setName('');
        setLicenseKey('');
        setLicenseType('Perpetual');
        setVendorId('');
        setLocationId('');
        setTotalSeats(1);
        setPurchaseDate('');
        setExpirationDate('');
        setCost('');
        setStatus('Active');
        setNotes('');
      }
    }
  }, [isOpen, initialLicense]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Software name is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        name: name.trim(),
        licenseKey: licenseKey.trim() || null,
        licenseType: licenseType || null,
        vendorId: vendorId !== '' ? Number(vendorId) : null,
        locationId: locationId !== '' ? Number(locationId) : null,
        totalSeats: Number(totalSeats) || 1,
        purchaseDate: purchaseDate || null,
        expirationDate: expirationDate || null,
        cost: cost ? cost : null,
        status,
        notes: notes.trim() || null,
      };

      if (initialLicense) {
        await api.put(`/licenses/${initialLicense.id}`, payload);
      } else {
        await api.post('/licenses', payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save software license');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      isLoading={submitting}
      title={initialLicense ? 'Edit Software License' : 'Add Software License'}
      subtitle={
        initialLicense
          ? `Update details for ${initialLicense.name}`
          : 'Register a new software license into the inventory'
      }
      icon={<Key className="w-5 h-5 text-emerald-600" />}
      maxWidthClass="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Software Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Microsoft 365 Business, Adobe Photoshop"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              License Key / Serial / Product Code
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">License Type</label>
            <select
              value={licenseType}
              onChange={(e) => setLicenseType(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            >
              <option value="Perpetual">Perpetual</option>
              <option value="Subscription">Subscription</option>
              <option value="OEM Bundled">OEM Bundled</option>
              <option value="CD / Dongle">CD / Dongle</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            >
              <option value="Active">Active</option>
              <option value="Expired">Expired</option>
              <option value="Deactivated">Deactivated</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor / Publisher</label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            >
              <option value="">-- Select Vendor --</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            >
              <option value="">-- Select Location --</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Total Seats / Capacity <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              required
              value={totalSeats}
              onChange={(e) => setTotalSeats(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Cost / Price</label>
            <input
              type="text"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="e.g. 1500000"
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Date</label>
            <input
              type="date"
              onClick={(e) => { try { (e.currentTarget as HTMLInputElement).showPicker?.(); } catch {} }}
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Expiration Date</label>
            <input
              type="date"
              onClick={(e) => { try { (e.currentTarget as HTMLInputElement).showPicker?.(); } catch {} }}
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Description</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional license notes, contract terms, or renewal details..."
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{initialLicense ? 'Save Changes' : 'Create License'}</span>
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
