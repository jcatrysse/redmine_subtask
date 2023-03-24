require File.dirname(__FILE__) + '/lib/redmine_subtask'

Redmine::Plugin.register :redmine_subtask do
  name 'Redmine Auto-create Sub-tickets plugin'
  author 'rbailleul'
  description 'A Redmine plugin creates sub-tickets upon creating tickets'
  version '0.0.1'
  url 'https://trustteam.be'
  author_url 'http://brandstapel.be'
  project_module :subtasks do
    permission :subtask_settings, {:subtask_settings => [:index, :show, :update, :create, :destroy]}
  end
  menu :project_menu, :subtask_settings, { controller: 'subtask_settings', action: 'show' }, caption: 'Subtasks', before: :settings, param: :project_id
end
