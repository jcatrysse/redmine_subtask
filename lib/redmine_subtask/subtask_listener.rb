module RedmineSubtask
  module Hooks
    class SubtaskListener < Redmine::Hook::Listener

      def controller_issues_new_after_save(context = {})
        issue = context[:issue]
        controller = context[:controller]

        selected_subtasks = []
        if context[:params][:issue].key?("subtask_child_ids")
          selected_subtasks = context[:params][:issue]['subtask_child_ids']
        end

        auto_subtasks = Subtask.where(:project_id => issue.project_id, :parent => issue.tracker_id, :default => true, :auto => true).pluck(:child)

        subtasks = (selected_subtasks+auto_subtasks).uniq

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
      render_on :view_issues_form_details_bottom,
                :partial => 'issues/select_subtasks'
    end
  end
end
