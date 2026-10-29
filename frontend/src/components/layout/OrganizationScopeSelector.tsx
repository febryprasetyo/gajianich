'use client';
import {useOrganizationScope} from '@/context/OrganizationScopeContext';
export default function OrganizationScopeSelector(){
  const {availableGroups,selectedGroupId,selectGroup,isLoading,isGlobalAdministrator}=useOrganizationScope();
  if(isLoading || !isGlobalAdministrator) return null;
  if(!availableGroups.length) return <span className="text-xs text-amber-800">Akses kelompok belum dialokasikan</span>;
  return <label className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-700">
    <span className="hidden sm:inline">Kelompok</span>
    <select aria-label="Kelompok aktif" value={selectedGroupId??'all'} onChange={event=>selectGroup(event.target.value==='all'?null:Number(event.target.value))}
      className="max-w-[132px] sm:max-w-[190px] rounded-xl border border-slate-500 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700">
      <option value="all">Semua kelompok / tinjau</option>
      {availableGroups.map(group=><option key={group.id} value={group.id}>{group.code}</option>)}
    </select>
  </label>;
}
