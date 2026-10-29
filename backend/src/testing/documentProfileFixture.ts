import type { Pool } from 'pg';
export async function createDocumentProfileFixture(pool: Pool, kind: 'GA' | 'LEAVE' = 'GA') {
  const {rows:[group]} = await pool.query("INSERT INTO organization_groups(code,name) VALUES('CMC','CMC') ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name RETURNING id");
  const {rows:[organization]} = await pool.query("INSERT INTO organizations(group_id,code,name) VALUES($1,'fixture-arvirotech','Arvirotech') ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name RETURNING id",[group.id]);
  const {rows:[template]} = await pool.query("INSERT INTO document_template_versions(group_id,kind,version,layout_key,approved_reference,is_active) VALUES($1,$2,1,$3,'test-approved-reference',true) RETURNING id",[group.id,kind,kind === 'GA' ? 'cmc-ga-v1':'cmc-leave-f4-v1']);
  const {rows:[identity]} = await pool.query("INSERT INTO document_identity_versions(group_id,organization_id,version,name,logo_asset_key,approved_reference,is_active) VALUES($1,$2,1,'Arvirotech','/approved/arvirotech.png','test-approved-reference',true) RETURNING id",[group.id,organization.id]);
  await pool.query('INSERT INTO document_profiles(group_id,organization_id,kind,template_version_id,identity_version_id,is_active) VALUES($1,$2,$3,$4,$5,true)',[group.id,organization.id,kind,template.id,identity.id]);
  return {groupId:Number(group.id),organizationId:Number(organization.id),kind,templateVersionId:Number(template.id),identityVersionId:Number(identity.id)};
}
