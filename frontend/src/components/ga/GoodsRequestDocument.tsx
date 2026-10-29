import type { DocumentProfileSnapshot } from '@/types/documentProfile';
import { capitalizeWords } from '@/lib/goodsRequests';
export const goodsIdentityRowClass =
  'grid min-h-11 grid-cols-[88px_12px_minmax(0,1fr)] items-center border-b border-slate-200 text-[11px] dark:border-slate-800';

export function GoodsDocumentHeading({ detail = false, title, headingColorClass = 'text-black', profile }: { profile?: DocumentProfileSnapshot | null; detail?: boolean; title?: string; headingColorClass?: string }) {
  const Heading = detail ? 'h2' : 'h1';
  return (
    <div className="flex border-b border-black">
      <div className="w-[85px] sm:w-[110px] flex-shrink-0 flex items-center justify-center border-r border-black p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {profile && <img
          src={profile?.identity.logoAssetKey}
          alt={profile?.identity.name || 'Identitas organisasi belum tersedia'}
          width={72}
          height={64}
          className="h-10 w-12 sm:h-12 sm:w-16 object-contain"
        />}
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-2 sm:py-3 text-center">
        <Heading className={`text-base sm:text-xl font-bold uppercase underline tracking-wider ${headingColorClass}`}>
          {profile?.labels.title || 'FORM PERMINTAAN BARANG'}
        </Heading>
        {profile && <p className="mt-1 text-xs font-semibold">{profile.identity.name}{profile.identity.address && <span className="block font-normal">{profile.identity.address}</span>}</p>}
        {title && (
          <p className="mt-1 text-xs font-semibold text-slate-700">
            {title}
          </p>
        )}
      </div>
    </div>
  );
}

export function GoodsDocumentSignatures({
  requesterName,
  approverName = '',
  profile,
}: {
  requesterName: string;
  profile?: DocumentProfileSnapshot | null;
  approverName?: string;
}) {
  const columns = profile?.signatories.length ? profile.signatories.map(s => ({label:s.label,name:s.key === 'applicant' ? capitalizeWords(requesterName) : s.name || ''})) : [
    { label: 'Diajukan', name: capitalizeWords(requesterName) },
    { label: 'Diketahui Oleh', name: '' },
    { label: 'Diperiksa', name: '' },
    { label: 'Disetujui', name: approverName },
    { label: 'Penjual', name: '' },
  ];

  return (
    <table
      aria-label="Pengesahan permintaan barang"
      className="w-full table-fixed border-collapse text-center text-[11px] text-black border-t border-black"
    >
      <thead>
        <tr className="border-b border-black font-semibold">
          {columns.map((col, idx) => (
            <th
              key={col.label}
              scope="col"
              className={`py-1.5 px-1 text-center font-semibold text-[11px] text-black ${
                idx < columns.length - 1 ? 'border-r border-black' : ''
              }`}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {columns.map((col, idx) => (
            <td
              key={idx}
              className={`h-16 sm:h-20 print:h-16 px-1 pb-1.5 sm:pb-2 text-center align-bottom text-[11px] text-black ${
                idx < columns.length - 1 ? 'border-r border-black' : ''
              }`}
            >
              <div className="flex w-full justify-center text-center font-medium overflow-hidden">
                {col.name ? (
                  <span className="truncate px-0.5 font-semibold">( {col.name} )</span>
                ) : (
                  <div className="w-[75%] mx-auto flex items-center justify-between text-[11px] text-black font-medium leading-none">
                    <span>(</span>
                    <span className="flex-1 overflow-hidden text-center tracking-tight mx-0.5">
                      ..............................
                    </span>
                    <span>)</span>
                  </div>
                )}
              </div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
