require File.expand_path('../../test_helper', __FILE__)

class SubtaskSettingsControllerTest < Redmine::ControllerTest
  include RedmineSubtaskTestHelper
  tests SubtaskSettingsController

  def setup
    enable_subtasks(Project.find(1))
    @request.session[:user_id] = 2 # jsmith, Manager in ecookbook
  end

  def test_show
    rule = create_rule(:default => true, :custom_fields => ['2'].to_json)
    get :show, :params => {:project_id => 'ecookbook'}
    assert_response :success
    assert_select "form[action='/projects/ecookbook/subtask_settings/#{rule.id}']" do
      assert_select "input[type=hidden][name=parent][value='1']"
      assert_select "input[type=checkbox][name=default][checked]"
      assert_select "select[name='custom_fields[]'] option[value='2'][selected]"
      assert_select "a[data-method=delete][href='/projects/1/subtask_settings/#{rule.id}']"
    end
    assert_select "form[action='/projects/1/subtask_settings/create']"
  end

  def test_show_labels
    create_rule
    get :show, :params => {:project_id => 'ecookbook'}
    assert_select '#main-menu a.subtask-settings', :text => 'Subtasks'
    assert_select 'strong', :text => 'Subtask creation rules:'
    assert_select 'strong', :text => 'Add subtask creation rule:'
    assert_select 'div.box', :text => /When creating a ticket of tracker\s+Bug.*,\s+suggest creation of a subticket of tracker/m
    ['Create subtask by default:', 'Create subtask by force:', 'Apply to descendant projects:',
     'Inherit custom fields:'].each do |label|
      assert_select 'div.box', :text => /#{label}/
    end
  end

  def test_show_uses_an_svg_icon_for_delete
    create_rule
    get :show, :params => {:project_id => 'ecookbook'}
    assert_response :success
    assert_select 'a.icon.icon-del[data-method=delete] svg'
  end

  def test_show_without_permission_is_refused
    Role.find(1).remove_permission!(:subtask_settings)
    get :show, :params => {:project_id => 'ecookbook'}
    assert_response :forbidden
  end

  def test_show_with_the_module_disabled_is_refused
    Project.find(1).disable_module!(:subtasks)
    get :show, :params => {:project_id => 'ecookbook'}
    assert_response :forbidden
  end

  def test_show_for_an_unknown_project_is_not_found
    get :show, :params => {:project_id => 'no-such-project'}
    assert_response :not_found
  end

  def test_index_lists_the_rules_of_the_project
    rule = create_rule
    create_rule(:project_id => 2)
    get :index, :params => {:project_id => 'ecookbook'}
    assert_response :success
    assert_equal [rule.id], response.parsed_body.map {|r| r['id']}
  end

  def test_index_with_the_create_permission_only
    Role.find(1).remove_permission!(:subtask_settings)
    get :index, :params => {:project_id => 'ecookbook'}
    assert_response :success
  end

  def test_create
    assert_difference 'Subtask.count' do
      post :create, :params => {:project_id => 'ecookbook', :parent => '1', :child => '2',
                                :default => 'default', :inheritance => 'inheritance'}
    end
    assert_redirected_to '/projects/ecookbook/subtask_settings/show'
    rule = Subtask.order(:id).last
    assert_equal [1, 1, 2, true, true], [rule.project_id, rule.parent, rule.child, rule.default, rule.inheritance]
    assert_not rule.auto
    assert_equal 'Subtask-config created successfully.', flash[:notice]
  end

  def test_create_without_permission_is_refused
    Role.find(1).remove_permission!(:subtask_settings)
    assert_no_difference 'Subtask.count' do
      post :create, :params => {:project_id => 'ecookbook', :parent => '1', :child => '2'}
    end
    assert_response :forbidden
  end

  def test_update
    rule = create_rule
    put :update, :params => {:project_id => 'ecookbook', :subtask_id => rule.id, :parent => '1', :child => '2',
                             :auto => 'auto', :custom_fields => ['2', '6']}
    assert_redirected_to '/projects/ecookbook/subtask_settings/show'
    rule.reload
    assert rule.auto
    assert_not rule.default
    assert_equal ['2', '6'], JSON.parse(rule.custom_fields)
    assert_equal 'Subtask-config updated successfully.', flash[:notice]
  end

  def test_update_of_a_rule_of_another_project_is_not_found
    rule = create_rule(:project_id => 2)
    put :update, :params => {:project_id => 'ecookbook', :subtask_id => rule.id, :parent => '1', :child => '2', :auto => 'auto'}
    assert_response :not_found
    assert_not rule.reload.auto
  end

  def test_update_of_an_unknown_rule_is_not_found
    put :update, :params => {:project_id => 'ecookbook', :subtask_id => 999, :parent => '1', :child => '2'}
    assert_response :not_found
  end

  def test_destroy
    rule = create_rule
    assert_difference 'Subtask.count', -1 do
      delete :destroy, :params => {:project_id => 'ecookbook', :subtask_id => rule.id}
    end
    assert_redirected_to '/projects/ecookbook/subtask_settings/show'
    assert_equal 'Subtask-config deleted successfully.', flash[:notice]
  end

  def test_destroy_of_a_rule_of_another_project_is_not_found
    rule = create_rule(:project_id => 2)
    assert_no_difference 'Subtask.count' do
      delete :destroy, :params => {:project_id => 'ecookbook', :subtask_id => rule.id}
    end
    assert_response :not_found
  end

  def test_destroy_without_permission_is_refused
    rule = create_rule
    Role.find(1).remove_permission!(:subtask_settings)
    assert_no_difference 'Subtask.count' do
      delete :destroy, :params => {:project_id => 'ecookbook', :subtask_id => rule.id}
    end
    assert_response :forbidden
  end
end
