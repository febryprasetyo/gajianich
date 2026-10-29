import test from 'node:test';
import assert from 'node:assert/strict';
import { documentProfileForRender } from '../organizationDocumentProfile.ts';
const profile = {kind:'GA',layoutKey:'cmc-ga-v1',identity:{name:'Arvirotech',logoAssetKey:'/approved/arvirotech.png'}};
test('GA uses its own identity even when sharing a CMC layout',()=>assert.equal(documentProfileForRender({documentProfileSnapshot:profile},'GA').identity.name,'Arvirotech'));
test('submitted legacy and unconfigured MGM do not fall back to CMC',()=>{
 assert.equal(documentProfileForRender({status:'approved_manually',documentProfilePreview:profile},'GA'),null);
 assert.equal(documentProfileForRender({status:'draft'},'GA'),null);
 assert.equal(documentProfileForRender({documentProfileSnapshot:{...profile,layoutKey:'mgm-unknown'}},'GA'),null);
});
test('submitted snapshot wins over current draft preview',()=>assert.equal(documentProfileForRender({status:'draft',documentProfileSnapshot:profile,documentProfilePreview:{...profile,identity:{...profile.identity,name:'Changed'}}},'GA').identity.name,'Arvirotech'));
