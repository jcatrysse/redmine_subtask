# Data for this plugin's end-to-end scenarios, run by .codex/start_server.sh
# after the generic seed. Idempotent.
#
# - e2e-sub: public subproject of e2e-project, for rules applied to
#   descendant projects; manager and reporter are members as in e2e-project.
# - two optional string issue custom fields for every project and tracker, one
#   to inherit into subtasks and one not to.
# - with redmine_issue_templates installed: a project template and a global
#   template for the Feature tracker, which number from 1 in separate tables,
#   so their ids coincide the way they do in production.

User.current = User.find_by(login: 'admin')
parent = Project.find_by!(identifier: 'e2e-project')

sub = Project.find_by(identifier: 'e2e-sub') ||
      Project.new(identifier: 'e2e-sub', name: 'E2E subproject', description: 'Subproject, for inherited subtask rules.')
sub.is_public = true
sub.enabled_module_names = parent.enabled_module_names
sub.trackers = Tracker.all
sub.save!
sub.set_parent!(parent) unless sub.parent_id == parent.id

Member.where(project_id: parent.id).find_each do |member|
  next if Member.where(user_id: member.user_id, project_id: sub.id).exists?

  Member.create!(principal: member.principal, project: sub, roles: member.roles.to_a)
end

['E2E inherited field', 'E2E other field'].each do |name|
  next if IssueCustomField.find_by(name: name)

  IssueCustomField.create!(name: name, field_format: 'string', is_for_all: true, is_required: false,
                           tracker_ids: Tracker.pluck(:id), visible: true, editable: true)
end

feature = Tracker.find_by!(name: 'Feature')
if defined?(IssueTemplate)
  admin = User.current
  IssueTemplate.find_by(project_id: parent.id, title: 'E2E project template') ||
    IssueTemplate.create!(project_id: parent.id, tracker_id: feature.id, author_id: admin.id, enabled: true,
                          title: 'E2E project template', description: "Project template text.\n\n* step one\n* step two")
  GlobalIssueTemplate.find_by(title: 'E2E global template') ||
    GlobalIssueTemplate.create!(tracker_id: feature.id, author_id: admin.id, enabled: true, projects: [parent],
                                title: 'E2E global template', description: 'Global template text.')
  puts "Templates: project #{IssueTemplate.where(title: 'E2E project template').pluck(:id).inspect}, " \
       "global #{GlobalIssueTemplate.where(title: 'E2E global template').pluck(:id).inspect}"
end

puts "Plugin seed: #{sub.identifier} under #{parent.identifier}, modules #{sub.enabled_module_names.join(' ')}"
