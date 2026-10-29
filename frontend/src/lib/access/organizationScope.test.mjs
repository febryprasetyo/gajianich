import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreGroupSelection,organizationCacheKey,OrganizationRequestRuntime} from './organizationScope.ts';
const groups=[{id:1,code:'CMC',name:'CMC'},{id:2,code:'MGM',name:'MGM'}];
test('single group auto-selects and revoked selection is never restored',()=>{
  assert.equal(restoreGroupSelection([groups[0]],'2'),1);
  assert.equal(restoreGroupSelection(groups,'2'),2);
  assert.equal(restoreGroupSelection(groups,'999'),null);
  assert.equal(restoreGroupSelection([],'1'),null);
  assert.notEqual(organizationCacheKey('employees',1),organizationCacheKey('employees',2));
});
test('switch/logout cancels old requests and rejects responses even when transport ignores cancellation',()=>{
  const runtime=new OrganizationRequestRuntime();runtime.change(1);
  const old=runtime.begin();runtime.change(2);
  assert.equal(old.signal.aborted,true);assert.throws(old.assertCurrent,{name:'AbortError'});
  const current=runtime.begin();assert.equal(current.groupId,2);current.assertCurrent();
  runtime.change(null,true);assert.throws(current.assertCurrent,{name:'AbortError'});old.finish();current.finish();
});
test('external abort is preserved and completed requests are not retained',()=>{
  const runtime=new OrganizationRequestRuntime(),cancel=new AbortController();
  const pending=runtime.begin(cancel.signal);cancel.abort();assert.throws(pending.assertCurrent,{name:'AbortError'});
  pending.finish();const done=runtime.begin();done.finish();runtime.change(1);assert.equal(done.signal.aborted,false);
});
