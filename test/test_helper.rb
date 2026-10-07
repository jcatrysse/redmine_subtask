# Load the Redmine helper
require File.expand_path(File.dirname(__FILE__) + '/../../../test/test_helper')

module RedmineSubtaskTestHelper
  # Turns the plugin's module on in the project and gives the Manager role
  # (jsmith in ecookbook) the given plugin permissions.
  def enable_subtasks(project, permissions = [:subtask_settings, :enable_auto_create_subtasks])
    project.enabled_module_names = project.enabled_module_names | ['subtasks']
    role = Role.find(1)
    permissions.each { |permission| role.add_permission!(permission) }
    # with redmine_view_issue_description installed (GEOxyz), the issue page
    # and its edit form need that plugin's permission as well
    role.add_permission!(:view_issue_description) if Redmine::AccessControl.permission(:view_issue_description)
  end

  def create_rule(attributes = {})
    Subtask.create!({:project_id => 1, :parent => 1, :child => 2, :default => false,
                     :auto => false, :inheritance => false}.merge(attributes))
  end
end
