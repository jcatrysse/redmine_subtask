module RedmineSubtask
  class SubtaskListener < Redmine::Hook::Listener

    def controller_issues_new_after_save(context = {})
      issue = context[:issue]
      controller = context[:controller]

      if context[:params][:issue].key?("subtask_child_ids")
        subtasks = context[:params][:issue]['subtask_child_ids']
      else
        subtasks = Subtask.where(:project_id => issue.project_id, :parent => issue.tracker_id, :default => true).pluck(:child)
      end
      return unless subtasks
      createSubtasks(subtasks, issue)
    end

    private
    
    def createSubtasks(subtasks, parent)
      Thread.start do
        subtasks.each do |subtask|
          begin

            child = parent.copy()
            
            child.parent_issue_id=(parent.id)
            child.tracker_id=(subtask)
            child.description=('Cfr. parent ticket')
            child.estimated_hours=(0)
            child.done_ratio = 0
                        
            child.save            
            
            child.relations_from.clear
            child.relations_to.clear
            
            child.save
          rescue => e
            Rails.logger.error e
          end
        end
      end
    end
  end

  class ViewIssuesFormDetailsBottomHook < Redmine::Hook::ViewListener
    render_on(:view_issues_form_details_bottom, :partial => 'issues/select_subtasks', :layout => false)
  end
end
