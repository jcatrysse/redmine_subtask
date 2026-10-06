require File.expand_path('../../test_helper', __FILE__)

class SubtaskTest < ActiveSupport::TestCase
  include RedmineSubtaskTestHelper
  fixtures(*RedmineSubtaskTestHelper::FIXTURES)

  # Replace this with your real tests.
  def test_truth
    assert true
  end

  def test_applicable_to_returns_the_rules_of_the_project_for_the_tracker
    rule = create_rule
    create_rule(:parent => 2, :child => 3)
    issue = Issue.new(:project_id => 1, :tracker_id => 1)

    assert_equal [rule], Subtask.applicable_to(issue).to_a
  end

  def test_applicable_to_includes_inherited_rules_of_ancestors_only
    inherited = create_rule(:inheritance => true)
    create_rule(:child => 3, :inheritance => false)
    issue = Issue.new(:project_id => 3, :tracker_id => 1) # subproject1, child of ecookbook

    assert_equal [inherited], Subtask.applicable_to(issue).to_a
  end

  def test_applicable_to_ignores_rules_of_other_projects
    create_rule(:project_id => 2)
    issue = Issue.new(:project_id => 1, :tracker_id => 1)

    assert_empty Subtask.applicable_to(issue).to_a
  end

  def test_applicable_to_ignores_child_trackers_the_project_does_not_use
    project = Project.find(1)
    project.trackers = Tracker.where(:id => [1, 3]).to_a
    create_rule(:child => 2)
    issue = Issue.new(:project => project, :tracker_id => 1)

    assert_empty Subtask.applicable_to(issue).to_a
  end

  def test_applicable_to_without_project_or_tracker_is_empty
    create_rule

    assert_empty Subtask.applicable_to(Issue.new(:tracker_id => 1)).to_a
    assert_empty Subtask.applicable_to(Issue.new(:project_id => 1)).to_a
  end
end
