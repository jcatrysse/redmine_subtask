require File.expand_path('../../test_helper', __FILE__)

# Runs only with redmine_issue_templates installed next to this plugin
# (RMP_EXTRA_PLUGINS, see docs/REDMINE7-MIGRATION.md).
class SubtaskTemplatesTest < Redmine::IntegrationTest
  include RedmineSubtaskTestHelper
  fixtures(*RedmineSubtaskTestHelper::FIXTURES)

  def setup
    super
    skip 'redmine_issue_templates is not installed' unless defined?(IssueTemplate)

    project = Project.find(1)
    enable_subtasks(project)
    project.enable_module!(:issue_templates)
    # distinct ids in both tables, so that the project and the global template
    # cannot be mistaken for each other
    @global_template = GlobalIssueTemplate.create!(:id => 1001, :title => 'Global feature', :description => 'Global template text',
                                                   :tracker_id => 2, :author_id => 1, :enabled => true,
                                                   :projects => [project])
    GlobalIssueTemplate.create!(:id => 1002, :title => 'Other global feature', :description => 'Other',
                                :tracker_id => 2, :author_id => 1, :enabled => true, :projects => [project])
    @project_template = IssueTemplate.create!(:id => 2001, :title => 'Project feature', :description => 'Project template text',
                                              :tracker_id => 2, :author_id => 1, :enabled => true, :project_id => 1)
    log_user('jsmith', 'jsmith')
  end

  def test_settings_page_offers_the_templates_of_the_child_tracker
    rule = create_rule
    get '/projects/ecookbook/subtask_settings/show'
    assert_response :success
    assert_select 'select[name=template]' do
      assert_select 'option', :text => 'Project feature'
      assert_select 'option', :text => 'Global feature'
    end
  end

  def test_choosing_a_project_template
    rule = create_rule
    get '/projects/ecookbook/subtask_settings/show'
    value = css_select('select[name=template] option').detect {|o| o.text == 'Project feature'}['value']
    put "/projects/ecookbook/subtask_settings/#{rule.id}",
        :params => {:parent => '1', :child => '2', :template => value}
    rule.reload
    assert_equal [@project_template.id, false], [rule.template, rule.global]
    follow_redirect!
    assert_select "select[name=template] option[selected]", :text => 'Project feature'
  end

  def test_choosing_a_global_template
    rule = create_rule
    get '/projects/ecookbook/subtask_settings/show'
    value = css_select('select[name=template] option').detect {|o| o.text == 'Global feature'}['value']
    put "/projects/ecookbook/subtask_settings/#{rule.id}",
        :params => {:parent => '1', :child => '2', :template => value}
    rule.reload
    assert_equal [@global_template.id, true], [rule.template, rule.global]
    follow_redirect!
    assert_select "select[name=template] option[selected]", :text => 'Global feature'
  end

  def test_subtask_gets_the_description_of_the_project_template
    create_rule(:auto => true, :template => @project_template.id, :global => false)
    post '/projects/ecookbook/issues', :params => {:issue => {:tracker_id => 1, :subject => 'Parent', :description => 'Parent text'}}
    child = Issue.order(:id).last
    assert_equal 2, child.tracker_id
    assert_equal 'Project template text', child.description
  end

  def test_subtask_gets_the_description_of_the_global_template
    create_rule(:auto => true, :template => @global_template.id, :global => true)
    post '/projects/ecookbook/issues', :params => {:issue => {:tracker_id => 1, :subject => 'Parent', :description => 'Parent text'}}
    assert_equal 'Global template text', Issue.order(:id).last.description
  end

  def test_subtask_without_template_gets_an_empty_description
    create_rule(:auto => true)
    post '/projects/ecookbook/issues', :params => {:issue => {:tracker_id => 1, :subject => 'Parent', :description => 'Parent text'}}
    assert_equal '', Issue.order(:id).last.description.to_s
  end

  def test_subtask_with_a_disabled_template_gets_an_empty_description
    create_rule(:auto => true, :template => @project_template.id, :global => false)
    @project_template.update!(:enabled => false)
    post '/projects/ecookbook/issues', :params => {:issue => {:tracker_id => 1, :subject => 'Parent', :description => 'Parent text'}}
    assert_equal 2, Issue.order(:id).last.tracker_id
    assert_equal '', Issue.order(:id).last.description.to_s
  end

  # Both template tables number from 1, so a project template and a global
  # template often share an id; the choice must still be the one the user made.
  def test_choosing_a_project_template_with_the_id_of_a_global_template
    template = IssueTemplate.create!(:id => 1001, :title => 'Same id as global', :description => 'Same id text',
                                     :tracker_id => 2, :author_id => 1, :enabled => true, :project_id => 1)
    rule = create_rule(:auto => true)
    get '/projects/ecookbook/subtask_settings/show'
    value = css_select('select[name=template] option').detect {|o| o.text == 'Same id as global'}['value']
    put "/projects/ecookbook/subtask_settings/#{rule.id}", :params => {:parent => '1', :child => '2', :auto => 'auto', :template => value}
    rule.reload
    assert_equal [template.id, false], [rule.template, rule.global]
    follow_redirect!
    assert_select "select[name=template] option[selected]", :text => 'Same id as global'

    post '/projects/ecookbook/issues', :params => {:issue => {:tracker_id => 1, :subject => 'Parent'}}
    assert_equal 'Same id text', Issue.order(:id).last.description
  end

  def test_choosing_a_global_template_with_the_id_of_a_project_template
    IssueTemplate.create!(:id => 1001, :title => 'Same id as global', :description => 'Same id text',
                          :tracker_id => 2, :author_id => 1, :enabled => true, :project_id => 1)
    rule = create_rule(:auto => true)
    get '/projects/ecookbook/subtask_settings/show'
    value = css_select('select[name=template] option').detect {|o| o.text == 'Global feature'}['value']
    put "/projects/ecookbook/subtask_settings/#{rule.id}", :params => {:parent => '1', :child => '2', :auto => 'auto', :template => value}
    rule.reload
    assert_equal [@global_template.id, true], [rule.template, rule.global]
    follow_redirect!
    assert_select "select[name=template] option[selected]", :text => 'Global feature'

    post '/projects/ecookbook/issues', :params => {:issue => {:tracker_id => 1, :subject => 'Parent'}}
    assert_equal 'Global template text', Issue.order(:id).last.description
  end
end
