import test from 'node:test';
import assert from 'node:assert/strict';
import { documentProfileForRender } from '../organizationDocumentProfile.ts';
const profile = {kind:'LEAVE',layoutKey:'cmc-leave-f4-v1',identity:{name:'Arvirotech',logoAssetKey:'/approved/arvirotech.png'}};
test('leave draft previews server-resolved identity, not hardcoded CMC',()=>assert.equal(documentProfileForRender({status:'DRAFT',documentProfilePreview:profile},'LEAVE').identity.name,'Arvirotech'));
test('leave submitted records require locked snapshots',()=>{
 assert.equal(documentProfileForRender({status:'PENDING',documentProfilePreview:profile},'LEAVE'),null);
 assert.equal(documentProfileForRender({documentProfileSnapshot:{...profile,kind:'GA'}},'LEAVE'),null);
});
