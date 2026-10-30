import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseReviewLogQuery,parseHistoryRequest} from './admsReview';
test('review dates and pagination are bounded and preserve external PIN text',()=>{
 const q=parseReviewLogQuery({pin:'00122',deviceId:'1',startDate:'2026-10-01',endDate:'2026-10-31'});
 assert.equal(q.pin,'00122');assert.equal(q.deviceId,1);
 for(const bad of [{startDate:'2026-02-30'},{page:'0'},{deviceId:'1 OR TRUE'},{endDate:'2026-10-01',startDate:'2026-10-30'},{pin:['1']}])assert.throws(()=>parseReviewLogQuery(bad),/Invalid/);
});
test('historical read only accepts a concrete range of at most31 days',()=>{
 assert.deepEqual(parseHistoryRequest({startDate:'2026-10-01',endDate:'2026-10-31'}),{startDate:'2026-10-01',endDate:'2026-10-31'});
 for(const bad of [{startDate:'2026-10-01',endDate:'2026-11-01'},{startDate:'2026-10-30',endDate:'2026-10-01'},{startDate:'2026-02-30',endDate:'2026-03-01'},{startDate:'2026-10-01\nCLEAR LOG',endDate:'2026-10-01'}])assert.throws(()=>parseHistoryRequest(bad),/rentang/);
});
