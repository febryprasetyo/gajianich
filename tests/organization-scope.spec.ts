import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const fixtureFile=process.env.SCOPE_E2E_FIXTURE;
test.skip(!fixtureFile,'Requires an explicitly configured disposable organization fixture');
const fixture=fixtureFile?JSON.parse(readFileSync(fixtureFile,'utf8')):null;

test('real authentication, two-tab isolation, scope reload and foreign deep-link protection',async({page,context})=>{
 test.setTimeout(120_000);
 await page.goto('/login');
 await page.getByPlaceholder('Masukkan username').fill(fixture.username);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await expect(page.getByPlaceholder('Masukkan username')).toHaveValue(fixture.username);
 await page.locator('input[type="password"]').fill(fixture.password);
 await page.getByRole('button',{name:'Masuk ke GAJIANICH'}).click();
 await expect(page).toHaveURL(/dashboard/);
 await page.goto('/dashboard/attendance/employees');
 const selector=page.getByRole('combobox',{name:'Kelompok aktif'});
 const cmc=fixture.groups.find((g:{code:string})=>g.code==='CMC').id;
 const mgm=fixture.groups.find((g:{code:string})=>g.code==='MGM').id;
 await selector.selectOption(String(cmc));
 await expect(page.getByText('SCOPE_CMC_VISIBLE',{exact:true})).toBeVisible();
 await expect(page.getByText('SCOPE_MGM_VISIBLE',{exact:true})).toHaveCount(0);
 const second=await context.newPage();
 await second.goto('/dashboard/attendance/employees');
 await second.getByRole('combobox',{name:'Kelompok aktif'}).selectOption(String(mgm));
 await expect(second.getByText('SCOPE_MGM_VISIBLE',{exact:true})).toBeVisible();
 await expect(second.getByText('SCOPE_CMC_VISIBLE',{exact:true})).toHaveCount(0);
 await page.reload();
 await expect(selector).toHaveValue(String(cmc));
 await expect(page.getByText('SCOPE_CMC_VISIBLE',{exact:true})).toBeVisible();
 const foreign=await page.evaluate(async({id,group})=>{
  const response=await fetch(`/api/v1/employees/${id}`,{headers:{Authorization:`Bearer ${localStorage.getItem('token')}`,'X-Organization-Group-Id':String(group)}});
  return response.status;
 },{id:fixture.employees.MGM,group:cmc});
 expect([403,404]).toContain(foreign);
 let delayed=false;
 await page.route('**/api/v1/attendance/workspace',async route=>{
  if(route.request().headers()['x-organization-group-id']===String(cmc)){
   delayed=true;const response=await route.fetch();await new Promise(resolve=>setTimeout(resolve,700));
   await route.fulfill({response}).catch(()=>{});
  }else await route.continue();
 });
 await selector.selectOption(String(mgm));
 await expect(page.getByText('SCOPE_MGM_VISIBLE',{exact:true})).toBeVisible();
 await selector.selectOption(String(cmc));
 await expect.poll(()=>delayed).toBe(true);
 await selector.selectOption(String(mgm));
 await expect(page.getByText('SCOPE_MGM_VISIBLE',{exact:true})).toBeVisible();
 await page.waitForTimeout(900);
 await expect(page.getByText('SCOPE_CMC_VISIBLE',{exact:true})).toHaveCount(0);
 await second.close();
});

test('organization selector remains usable on a phone without horizontal overflow',async({page})=>{
 test.setTimeout(120_000);
 await page.setViewportSize({width:390,height:844});
 const login=await page.request.post('/api/v1/auth/login',{data:{username:fixture.username,password:fixture.password}});
 expect(login.status()).toBe(200);
 const session=await login.json();
 await page.context().addCookies([{name:'token',value:session.token,url:new URL(login.url()).origin}]);
 await page.addInitScript(({token,user})=>{localStorage.setItem('token',token);localStorage.setItem('user',JSON.stringify(user));},session);
 await page.goto('/dashboard/attendance/employees');
 const selector=page.getByRole('combobox',{name:'Kelompok aktif'});
 await selector.selectOption(String(fixture.groups.find((g:{code:string})=>g.code==='CMC').id));
 await expect(page.getByText('SCOPE_CMC_VISIBLE',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await selector.focus();await expect(selector).toBeFocused();
 await page.screenshot({path:'/tmp/ams-scope-mobile-validation.png',fullPage:true});
});
