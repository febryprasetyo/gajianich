import { test, expect } from '@playwright/test';
test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] } });
for (const width of [360, 768, 1280]) {
  test(`mobile profile, map and correction at ${width}px`, async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    const user = { id: 12, username: 'mobile-test', email: 'mobile@example.test', fullName: 'Karyawan Pengujian', roleName: 'Employee', permissions: [] };
    const token = `test.${Buffer.from(JSON.stringify({ ...user, userId: 12 })).toString('base64url')}.test`;
    await context.addCookies([{ name: 'token', value: token, url: baseURL! }]);
    await page.addInitScript(({ user, token }) => { localStorage.setItem('token',token); localStorage.setItem('user',JSON.stringify(user)); }, { user, token });
    await context.grantPermissions(['geolocation']); await context.setGeolocation({ latitude: -8.65, longitude: 115.22 });
    const event = { id: 18, eventType: 'IN', scanDate: '2026-10-23', scanTime: '08:10', timeZoneLabel: 'WITA', approvalStatus: 'REJECTED', approvalNote: 'Periksa keterangan lokasi', latitude: '-8.65', longitude: '115.22', address: 'Jalan Pengujian, Denpasar, Bali', photoUrl: null, reviewHistory: [] };
    const summary = { employee: { id: 12, employeeCode: 'EMP-12', fullName: user.fullName, position: 'Staff', department: 'Office', workLocation: 'HQ', avatarInitial: 'KP', photoUrl: null }, shift: { id: 1, code: 'OFFICE', name: 'Office', scheduleIn: '08:00', scheduleOut: '17:00' }, attendance: { workDate: '2026-10-23', checkedIn: true, checkedOut: false, checkInTime: '08:10', checkOutTime: null, totalHours: '--:--', status: 'CHECKED_IN', approvalStatus: 'REJECTED', approvalNote: event.approvalNote, timeZone: 'Asia/Makassar', timeZoneLabel: 'WITA', txHash: 'TEST', events: [event] }, faceEnrollment: { isFaceEnrolled: false, faceId: null, changeStatus: null } };
    let correction: unknown;
    await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: { display_name: event.address, address: { road: 'Jalan Pengujian', city: 'Denpasar' } } }));
    await page.route('https://www.openstreetmap.org/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Peta uji</p>' }));
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/me')) return route.fulfill({ json: { user } });
      if (path.endsWith('/summary')) return route.fulfill({ json: { data: summary } });
      if (path.endsWith('/history')) return route.fulfill({ json: { data: { monthName: 'Oktober 2026', records: [{ id: 18, workDate: '2026-10-23', dayShort: 'Jum', dateStr: '23 Okt', clockIn: '08:10', clockOut: '--', workHours: '--', status: 'REJECTED', statusText: 'Ditolak', approvalStatus: 'REJECTED', approvalNote: event.approvalNote, schedule: '08:00 – 17:00 WITA', employeeName: user.fullName, serverRef: 'TEST', events: [event] }] } } });
      if (path.endsWith('/corrections')) { correction = route.request().postDataJSON(); return route.fulfill({ json: { success: true } }); }
      return route.fulfill({ json: { success: true } });
    });
    const errors: string[] = []; page.on('pageerror',error => errors.push(error.message));
    await page.goto('/m/profile');
    await expect(page.getByText('Belum terdaftar', { exact: true })).toBeVisible();
    await expect(page.getByRole('button',{name:'Daftarkan wajah'})).toBeVisible();
    await expect(page.getByText('Akses PWA Mandiri')).toHaveCount(0);
    await page.goto('/m/presensi');
    await expect(page.getByText(/Jalan Pengujian, Denpasar/)).toBeVisible();
    await page.getByRole('button').filter({ hasText: '23 Okt' }).click();
    await expect(page.getByRole('dialog').locator('iframe')).toHaveCount(1);
    await page.getByLabel('Keterangan koreksi').fill('Saya bekerja di lokasi cabang Bali.');
    await page.screenshot({ path: `/tmp/gajianich-mobile-approval-${width}.png`, fullPage: true });
    await page.getByRole('button',{name:'Kirim koreksi'}).click();
    await expect.poll(() => correction).toEqual({ logId: 18, note: 'Saya bekerja di lokasi cabang Bali.' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto('/m/beranda');
    await expect(page.getByText('GAJIANICH PWA — Akses presensi mandiri karyawan')).toHaveCount(0);
    await expect(page.getByText('Lokasi Kantor', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Absen Pulang dengan verifikasi wajah' }).click();
    await expect(page.getByRole('dialog').getByText('Wajah belum terdaftar.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ambil foto dan presensi' })).toBeDisabled();
    expect(errors).toEqual([]);
  });
}
for (const width of [360,1280]) {
  test(`custom reviewer can review attendance, photos and shift switches at ${width}px`, async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    const user = { id: 19, username: 'review-test', email: 'review@example.test', fullName: 'Reviewer Pengujian', roleName: 'Custom Reviewer', permissions: ['attendance.mobile.verify'] };
    const token = `test.${Buffer.from(JSON.stringify({ ...user, userId: 19 })).toString('base64url')}.test`;
    await context.addCookies([{ name:'token', value:token, url:baseURL! }]);
    await page.addInitScript(({ user, token }) => { localStorage.setItem('user',JSON.stringify(user)); localStorage.setItem('token',token); }, { user,token });
    const log = { id:23, employeeName:'Karyawan Pengujian', employeeCode:'EMP-23', eventType:'IN', workDate:'2026-10-23', scanDate:'2026-10-23', scanTime:'08:05', timeZoneLabel:'WIT', shiftCode:'OFFICE', latitude:'-2.53', longitude:'140.72', address:'Jayapura', approvalStatus:'PENDING', approvalNote:'Menunggu review', photoUrl:null, reviewHistory:[] };
    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const photo = { id:24, employeeName:'Karyawan Pengujian', employeeCode:'EMP-23', photoUrl:image, oldPhotoUrl:image, status:'PENDING', note:null };
    let decision: any; let shift: any; let photoDecision: any;
    await page.route('https://www.openstreetmap.org/**',route => route.fulfill({ contentType:'text/html', body:'<p>Peta uji</p>' }));
    await page.route('**/api/v1/**',async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/me')) return route.fulfill({ json:{user} });
      if (path.endsWith('/verifications')) return route.fulfill({ json:{data:[log]} });
      if (path.endsWith('/face-requests')) return route.fulfill({ json:{data:[photo]} });
      if (path.endsWith('/approval-settings')) return route.fulfill({ json:{data:[{id:9,name:'Office',code:'OFFICE',isActive:true,autoApproveIn:false,autoApproveOut:false}]} });
      if (path.endsWith('/verify')) { decision = route.request().postDataJSON(); log.approvalStatus = decision.status; }
      if (path.endsWith('/24/review')) { photoDecision = route.request().postDataJSON(); photo.status = photoDecision.status; }
      if (path.endsWith('/approval-settings/9')) shift = route.request().postDataJSON();
      return route.fulfill({ json:{success:true} });
    });
    const errors: string[] = []; page.on('pageerror',error => errors.push(error.message));
    await page.goto('/dashboard/attendance/approvals');
    await page.getByRole('button',{name:'Lihat detail'}).click();
    await expect(page.getByRole('dialog').locator('iframe')).toHaveCount(1);
    await expect(page.getByRole('dialog').getByRole('button',{name:'Tolak'})).toBeDisabled();
    await page.getByLabel('Catatan pemeriksaan', { exact:false }).fill('Keterangan lokasi perlu diperbaiki.');
    await page.getByRole('dialog').getByRole('button',{name:'Tolak'}).click();
    await expect.poll(() => decision?.status).toBe('REJECTED');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button',{name:'Perubahan foto',exact:true}).click();
    await page.getByRole('button',{name:'Lihat detail'}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Setujui',exact:true}).click();
    await expect.poll(() => photoDecision?.status).toBe('APPROVED');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button',{name:'Persetujuan otomatis',exact:true}).click();
    await expect(page.getByRole('switch',{name:'Masuk otomatis'})).not.toBeChecked();
    await page.getByRole('switch',{name:'Pulang otomatis'}).check();
    await page.getByRole('button',{name:'Simpan aturan OFFICE'}).click();
    await expect.poll(() => shift).toEqual({autoApproveIn:false,autoApproveOut:true});
    await page.screenshot({ path:`/tmp/gajianich-reviewer-${width}.png`,fullPage:true });
    const overflow = await page.evaluate(() => Array.from(document.querySelectorAll('*')).filter(el => el.getBoundingClientRect().right > window.innerWidth + 1).map(el => ({ tag: el.tagName, className: el.className, width: el.getBoundingClientRect().width, text: el.textContent?.slice(0,60) })).slice(0,8));
    expect(overflow).toEqual([]);
    expect(errors).toEqual([]);
  });
}
test.describe('camera mismatch feedback', () => {
  test('server mismatch keeps scanner open and permits another capture', async ({ page,context,baseURL }) => {
    const user = { id:31,username:'camera-test',email:'camera@example.test',fullName:'Camera Tester',roleName:'Employee',permissions:[] };
    const token = `test.${Buffer.from(JSON.stringify({...user,userId:31})).toString('base64url')}.test`;
    await context.addCookies([{name:'token',value:token,url:baseURL!}]);
    await context.grantPermissions(['camera','geolocation']); await context.setGeolocation({latitude:-8.65,longitude:115.22});
    await page.addInitScript(({user,token}) => {localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify(user));},{user,token});
    let attempts=0;
    await page.route('https://nominatim.openstreetmap.org/**',route => route.fulfill({json:{address:{road:'Jalan Pengujian',city:'Denpasar'},display_name:'Jalan Pengujian, Denpasar'}}));
    await page.route('**/api/v1/**',route => {
      const path=new URL(route.request().url()).pathname;
      if(path.endsWith('/auth/me')) return route.fulfill({json:{user}});
      if(path.endsWith('/summary')) return route.fulfill({json:{data:{employee:{id:31,fullName:user.fullName,employeeCode:'EMP-31',position:'Staff',department:'Office',avatarInitial:'CT'},shift:{name:'Office',scheduleIn:'08:00',scheduleOut:'17:00'},attendance:{checkedIn:false,checkedOut:false,workDate:'2026-10-23',approvalStatus:'APPROVED',timeZoneLabel:'WITA',events:[]},faceEnrollment:{isFaceEnrolled:true}}}});
      if(path.endsWith('/clock')) {attempts++;return route.fulfill({status:400,json:{error:'Wajah tidak cocok dengan foto terdaftar. Ulangi presensi menggunakan wajah Anda.'}});}
      return route.fulfill({json:{success:true}});
    });
    await page.goto('/m/beranda');
    await page.getByRole('button',{name:'Absen Masuk dengan verifikasi wajah'}).click();
    const capture=page.getByRole('button',{name:'Ambil foto dan presensi'});
    await expect(capture).toBeEnabled(); await capture.click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Wajah tidak cocok');
    await expect(capture).toBeEnabled(); await capture.click();
    await expect.poll(()=>attempts).toBe(2); await expect(capture).toBeEnabled();
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
test('first face photo becomes profile immediately and replacement shows pending HRD', async ({page,context,baseURL}) => {
  const user={id:41,username:'enroll-test',email:'enroll@example.test',fullName:'Enrollment Tester',roleName:'Employee',permissions:[]};
  const token=`test.${Buffer.from(JSON.stringify({...user,userId:41})).toString('base64url')}.test`;
  await context.addCookies([{name:'token',value:token,url:baseURL!}]);
  await page.addInitScript(({user,token})=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify(user));},{user,token});
  const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  let uploads=0;
  const summary={employee:{fullName:user.fullName,employeeCode:'EMP-41',department:'Office',position:'Staff',avatarInitial:'ET',photoUrl:null as string|null},faceEnrollment:{isFaceEnrolled:false,changeStatus:null as string|null}};
  await page.route('**/api/v1/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/auth/me')) return route.fulfill({json:{user}});
    if(path.endsWith('/summary')) return route.fulfill({json:{data:summary}});
    if(path.endsWith('/enroll-face')) {
      uploads++;
      summary.faceEnrollment.isFaceEnrolled=true;
      if(uploads===1) summary.employee.photoUrl=`data:image/png;base64,${png}`;
      else summary.faceEnrollment.changeStatus='PENDING';
      return route.fulfill({json:{success:true,isEnrolled:true,message:uploads===1?'Wajah berhasil didaftarkan.':'Perubahan foto menunggu persetujuan HRD.'}});
    }
    return route.fulfill({json:{success:true}});
  });
  await page.goto('/m/profile');
  for(const name of ['Daftarkan wajah','Ajukan perubahan wajah']) {
    const chooser=page.waitForEvent('filechooser'); await page.getByRole('button',{name,exact:true}).click();
    await (await chooser).setFiles({name:'camera.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
    await expect(page.getByText('Terdaftar',{exact:true})).toBeVisible();
    await expect(page.getByRole('img',{name:`Foto ${user.fullName}`})).toBeVisible();
  }
  await expect(page.getByText('Perubahan foto menunggu persetujuan HRD. Foto sebelumnya tetap digunakan.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Ajukan perubahan wajah'})).toBeDisabled();
});
