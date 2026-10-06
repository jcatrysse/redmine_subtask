require File.expand_path('../../test_helper', __FILE__)

class SubtaskCreationTest < Redmine::IntegrationTest
  include RedmineSubtaskTestHelper
  fixtures(*RedmineSubtaskTestHelper::FIXTURES)

  def setup
    super
    enable_subtasks(Project.find(1))
  end

  def create_issue(issue_attributes = {})
    post '/projects/ecookbook/issues', :params => {
      :issue => {:tracker_id => 1, :subject => 'Parent with subtasks', :priority_id => 5}.merge(issue_attributes)
    }
    Issue.order(:id).last.root
  end

  def test_new_issue_form_offers_the_rules_of_the_tracker
    rule = create_rule(:default => true)
    log_user('jsmith', 'jsmith')
    get '/projects/ecookbook/issues/new', :params => {:issue => {:tracker_id => 1}}
    assert_response :success
    assert_select '#subtasks_form' do
      assert_select "input[type=checkbox][name='issue[new_subtask_ids][]'][value='#{rule.id}'][checked]"
    end
  end

  def test_new_issue_form_without_permission_hides_the_rules
    create_rule
    Role.find(1).remove_permission!(:enable_auto_create_subtasks)
    log_user('jsmith', 'jsmith')
    get '/projects/ecookbook/issues/new', :params => {:issue => {:tracker_id => 1}}
    assert_response :success
    assert_select '#subtasks_form', 0
  end

  def test_creating_an_issue_creates_the_selected_subtask
    rule = create_rule
    log_user('jsmith', 'jsmith')
    parent = nil
    assert_difference 'Issue.count', 2 do
      parent = create_issue(:new_subtask_ids => ['', rule.id.to_s])
    end
    assert_equal 1, parent.children.count
    child = parent.children.first
    assert_equal 2, child.tracker_id
    assert_equal 'Parent with subtasks', child.subject
    assert_equal User.find(2), child.author
    assert_nil flash[:error]
  end

  def test_creating_an_issue_creates_forced_subtasks_without_selection
    create_rule(:auto => true)
    log_user('jsmith', 'jsmith')
    assert_difference 'Issue.count', 2 do
      create_issue
    end
  end

  def test_creating_an_issue_creates_inherited_forced_subtasks_in_a_subproject
    create_rule(:auto => true, :inheritance => true)
    enable_subtasks(Project.find(3))
    log_user('jsmith', 'jsmith')
    assert_difference 'Issue.count', 2 do
      post '/projects/subproject1/issues', :params => {:issue => {:tracker_id => 1, :subject => 'In subproject'}}
    end
    assert_equal 3, Issue.order(:id).last.project_id
  end

  def test_creating_an_issue_without_selection_creates_no_subtask
    create_rule
    log_user('jsmith', 'jsmith')
    assert_difference 'Issue.count', 1 do
      create_issue(:new_subtask_ids => [''])
    end
  end

  def test_creating_an_issue_ignores_a_rule_of_another_project
    foreign = create_rule(:project_id => 2)
    log_user('jsmith', 'jsmith')
    assert_difference 'Issue.count', 1 do
      create_issue(:new_subtask_ids => [foreign.id.to_s])
    end
  end

  def test_creating_an_issue_ignores_a_rule_for_another_tracker
    other = create_rule(:parent => 3)
    log_user('jsmith', 'jsmith')
    assert_difference 'Issue.count', 1 do
      create_issue(:new_subtask_ids => [other.id.to_s])
    end
  end

  def test_creating_an_issue_ignores_selected_rules_without_permission
    rule = create_rule
    Role.find(1).remove_permission!(:enable_auto_create_subtasks)
    log_user('jsmith', 'jsmith')
    assert_difference 'Issue.count', 1 do
      create_issue(:new_subtask_ids => [rule.id.to_s])
    end
  end

  def test_creating_an_issue_with_the_module_disabled_creates_no_subtask
    create_rule(:auto => true)
    Project.find(1).disable_module!(:subtasks)
    log_user('jsmith', 'jsmith')
    assert_difference 'Issue.count', 1 do
      create_issue
    end
  end

  def test_subtask_copies_the_configured_custom_field_value
    create_rule(:auto => true, :child => 3, :custom_fields => ['2'].to_json)
    log_user('jsmith', 'jsmith')
    parent = create_issue(:custom_field_values => {'2' => 'inherited value', '6' => '1.5'})
    child = parent.children.first.reload
    assert_equal 3, child.tracker_id
    assert_equal 'inherited value', child.custom_field_value(2)
    assert child.custom_field_value(6).blank?
  end

  def test_editing_an_issue_creates_the_selected_subtask
    rule = create_rule
    log_user('jsmith', 'jsmith')
    get '/issues/1/edit'
    assert_response :success
    assert_select "#subtasks_form input[name='issue[new_subtask_ids][]'][value='#{rule.id}']"
    assert_difference 'Issue.count', 1 do
      put '/issues/1', :params => {:issue => {:notes => 'with a subtask', :new_subtask_ids => ['', rule.id.to_s]}}
    end
    assert_redirected_to '/issues/1'
    assert_equal [2], Issue.find(1).children.map(&:tracker_id)
  end

  def test_editing_an_issue_ignores_a_rule_of_another_project
    foreign = create_rule(:project_id => 2)
    log_user('jsmith', 'jsmith')
    assert_no_difference 'Issue.count' do
      put '/issues/1', :params => {:issue => {:notes => 'forged', :new_subtask_ids => [foreign.id.to_s]}}
    end
  end

  def test_editing_an_issue_does_not_create_forced_subtasks_again
    create_rule(:auto => true)
    log_user('jsmith', 'jsmith')
    assert_no_difference 'Issue.count' do
      put '/issues/1', :params => {:issue => {:notes => 'no subtasks'}}
    end
  end

  def test_editing_an_issue_through_the_api_without_issue_params
    create_rule(:auto => true)
    with_settings :rest_api_enabled => '1' do
      assert_no_difference 'Issue.count' do
        put '/issues/1.json', :params => {:notes => 'outside the issue hash'}, :headers => credentials('jsmith')
      end
    end
    assert_response :no_content
  end

  def test_creating_an_issue_through_the_api_creates_forced_subtasks
    create_rule(:auto => true)
    with_settings :rest_api_enabled => '1' do
      assert_difference 'Issue.count', 2 do
        post '/projects/ecookbook/issues.json',
             :params => {:issue => {:tracker_id => 1, :subject => 'API parent'}},
             :headers => credentials('jsmith')
      end
    end
    assert_response :created
  end

  def test_subtask_creation_triggers_the_issue_created_webhook
    skip 'webhooks exist since Redmine 7' unless defined?(Webhook)

    create_rule(:auto => true)
    triggered = []
    Webhook.stubs(:trigger).with {|event, object| triggered << [event, object.id]; true}
    log_user('jsmith', 'jsmith')
    create_issue
    parent = Issue.order(:id).last.root
    child = parent.children.first
    assert_include ['issue.created', parent.id], triggered
    assert_include ['issue.created', child.id], triggered
  end
end
