-- Ensure all employee users have organization group access based on their department mapping
INSERT INTO user_organization_group_access (user_id, group_id, created_at)
SELECT u.id, m.group_id, NOW()
FROM users u
JOIN employees e ON e.id = u.employee_id
JOIN department_organization_mappings m ON m.department_id = e.department_id
WHERE NOT EXISTS (
  SELECT 1 FROM user_organization_group_access a WHERE a.user_id = u.id AND a.group_id = m.group_id
)
ON CONFLICT DO NOTHING;
