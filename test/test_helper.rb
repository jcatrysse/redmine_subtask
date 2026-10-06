# Load the Redmine helper
require File.expand_path(File.dirname(__FILE__) + '/../../../test/test_helper')

module RedmineSubtaskTestHelper
  # Redmine 7 loads every fixture by itself; Redmine 5.1 needs them listed.
  FIXTURES = [:projects, :users, :email_addresses, :roles, :members, :member_roles,
              :issues, :issue_statuses, :trackers, :projects_trackers, :enabled_modules,
              :enumerations, :workflows, :custom_fields, :custom_values,
              :custom_fields_projects, :custom_fields_trackers, :issue_categories,
              :versions, :journals, :journal_details, :issue_relations, :watchers]

  # Turns the plugin's module on in the project and gives the Manager role
  # (jsmith in ecookbook) the given plugin permissions.
  def enable_subtasks(project, permissions = [:subtask_settings, :enable_auto_create_subtasks])
    project.enabled_module_names = project.enabled_module_names | ['subtasks']
    role = Role.find(1)
    permissions.each { |permission| role.add_permission!(permission) }
  end

  def create_rule(attributes = {})
    Subtask.create!({:project_id => 1, :parent => 1, :child => 2, :default => false,
                     :auto => false, :inheritance => false}.merge(attributes))
  end
end
