module RedmineSubtask
  module Hooks
    class SubtaskListener < Redmine::Hook::Listener

      def controller_issues_new_after_save(context = {})
        issue = context[:issue]
        controller = context[:controller]

        if issue.project.enabled_module(:subtasks).nil?
          return
        else
          selected_subtasks = []
          if context[:params][:issue].key?("new_subtask_ids")
            selected_subtask_ids = context[:params][:issue]['new_subtask_ids'].reject { |id| id.empty? }
            selected_subtasks = selected_subtask_ids.map{|subtask_id| Subtask.where(:id => subtask_id).first}
          end

          auto_subtasks = Subtask.where(:project_id => issue.project_id, :parent => issue.tracker_id, :auto => true)

          project = Project.find(issue.project_id)

          while project.parent_id.present? do
            auto_subtasks += Subtask.where(:project_id =>  project.parent_id, :parent => issue.tracker_id, :auto => true, :inheritance => true)
            project = Project.find(project.parent_id)
          end

          subtasks = (selected_subtasks+auto_subtasks).uniq

          return unless subtasks

          createSubtasks(subtasks, issue)
        end
      end

      def controller_issues_edit_after_save(context = {})
        issue = context[:issue]
        controller = context[:controller]

        if issue.project.enabled_module(:subtasks).nil?
          return
        else
          selected_subtasks = []
          if context[:params][:issue].key?("new_subtask_ids")
            selected_subtask_ids = context[:params][:issue]['new_subtask_ids']
            selected_subtasks = selected_subtask_ids.map{|subtask_id| Subtask.where(:id => subtask_id).first}
          end

          return unless selected_subtasks

          createSubtasks(selected_subtasks, issue)
        end
      end

      private

      def createSubtasks(subtasks, parent)
        subtasks.each do |subtask|
          begin
            child = parent.copy(nil, {:subtasks => false, :link => false})

            child.parent_issue_id=(parent.id)
            child.tracker_id=(subtask.child)
            child.description=('')
            if parent.project.enabled_module(:issue_templates).present? and subtask.template.present?
              if subtask.global
                templates = global_templates(parent.project.id, subtask.child)
              else
                templates = issue_templates(parent.project.id, child.tracker_id)+inherit_templates(parent.project.id, child.tracker_id)
              end
              template = templates.select{|template| template.id == subtask.template}
              if template.present?
                child.description=(template[0].description)
              end
            end

            child.estimated_hours=(0)
            child.done_ratio = 0
            child.reset_custom_values!
            
            custom_field_ids = (subtask.custom_fields.nil? ? [] : JSON.parse(subtask.custom_fields))
            custom_field_ids = (custom_field_ids.blank? ? [] : custom_field_ids)
            parent.custom_field_values.each do |custom_field_value|
              if custom_field_ids.include? custom_field_value.custom_field.id.to_s
                child.custom_field_values << custom_field_value
              end
            end
            child.save_custom_field_values

            child.relations_from.clear
            child.relations_to.clear

            child.save
          rescue => e
            Rails.logger.error e
          end
        end
      end

      private

      def templates_project_setting(projectId)
        IssueTemplateSetting.find_or_create(projectId)
      end

      def templates_plugin_setting
        Setting.plugin_redmine_issue_templates
      end

      def apply_all_projects?
        templates_plugin_setting['apply_global_template_to_all_projects'].to_s == 'true'
      end

      def issue_templates(projectId, trackerId)
        IssueTemplate.get_templates_for_project_tracker(projectId, trackerId)
      end

      def inherit_templates(projectId, trackerId)
        templates_project_setting(projectId).get_inherit_templates(trackerId)
      end

      def global_templates(projectId, trackerId)
        return [] if apply_all_projects? && (inherit_templates(projectId, trackerId).present? || issue_templates(projectId, trackerId).present?)

        project_id = apply_all_projects? ? nil : projectId
        GlobalIssueTemplate.get_templates_for_project_tracker(project_id, trackerId)
      end
    end

    class ViewIssuesFormDetailsBottomHook < Redmine::Hook::ViewListener
      render_on :view_issues_form_details_bottom, partial: 'issues/select_subtasks'
    end
  end
end
