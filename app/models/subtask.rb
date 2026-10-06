class Subtask < ActiveRecord::Base
  # PATCHED: removed from ActiveSupport in Rails 5.1
  # unloadable
  belongs_to :project

  # The rules that apply to a new or edited issue, the same ones the issue form
  # offers: those of its project and the inherited ones of its ancestors, for
  # its tracker, creating a child of a tracker its project uses.
  def self.applicable_to(issue)
    project = issue.project
    return none if project.nil? || issue.tracker_id.nil?

    rules = where(:parent => issue.tracker_id, :child => project.tracker_ids)
    rules.where(:project_id => project.id).
      or(rules.where(:project_id => project.ancestors.select(:id), :inheritance => true))
  end
end
