class SubtaskSettingsController < ApplicationController
  require 'json'
  before_action :find_project, :authorize, only: [:show, :index, :create, :update, :destroy]

  def show
    @trackers = @project.trackers
    @all_trackers = Tracker.all
    @subtasks = Subtask.where(:project_id => @project.id)

    @custom_fields = @project.rolled_up_custom_fields
    if @custom_fields.empty? or @custom_fields.nil?
      @custom_fields = []
    end

    @templates = Hash.new

    if @subtasks.nil? or @project.enabled_module(:issue_templates).nil?
      return
    else
      @all_trackers.map{|tracker| tracker.id}.each do |child|
        @templates[child] = get_templates(child)
      end
    end
  end
   
  def index
    render :json => Subtask.where(:project_id => @project.id).as_json(:only => [:id, :parent, :child, :auto, :default, :template])
  end

  def create
    subtask = Subtask.new(:project_id => @project.id)
    subtask.parent = params[:parent]
    subtask.child = params[:child]
    subtask.auto = params[:auto]
    subtask.default = params[:default]
    subtask.inheritance = params[:inheritance]
    if subtask.save
      flash[:notice] = l(:notice_successful_create_subtask)
    else
      flash[:error] = l(:notice_fail_create_subtask)
    end
    redirect_back(fallback_location: :back)
  end
  
  def update
    id = params[:subtask_id]
    subtask = Subtask.where(:project_id => @project.id).where(:id => id).first
    subtask.parent = params[:parent]
    subtask.child = params[:child]
    subtask.auto = params[:auto]
    subtask.default = params[:default]
    subtask.inheritance = params[:inheritance]
    subtask.template = params[:template]
    subtask.global = (subtask.template.present? and global_templates(subtask.child).map{|template| template.id}.include? subtask.template)
    subtask.custom_fields = params[:custom_fields].to_json
    if subtask.save
      flash[:notice] = l(:notice_successful_update_subtask)
    else
      flash[:error] = l(:notice_fail_update_subtask)
    end
    redirect_back(fallback_location: :back)
  end
  
  def destroy
    id = params[:subtask_id]
    subtask = Subtask.where(:project_id => @project.id).where(:id => id).first
    if subtask.destroy
      flash[:notice] = l(:notice_successful_delete_subtask)
    else
      flash[:error] = l(:notice_fail_delete_subtask)
    end
    redirect_back(fallback_location: :back)
  end
  
  private
  
  def find_project
    @project = Project.find(params[:project_id])
  end

  def get_templates(trackerId)
    return issue_templates(trackerId)+inherit_templates(trackerId)+global_templates(trackerId)
  end

  def templates_project_setting
    IssueTemplateSetting.find_or_create(@project.id)
  end

  def templates_plugin_setting
    Setting.plugin_redmine_issue_templates
  end

  def apply_all_projects?
    templates_plugin_setting['apply_global_template_to_all_projects'].to_s == 'true'
  end

  def issue_templates(trackerId)
    IssueTemplate.get_templates_for_project_tracker(@project.id, trackerId)
  end

  def inherit_templates(trackerId)
    templates_project_setting.get_inherit_templates(trackerId)
  end

  def global_templates(trackerId)
    return [] if apply_all_projects? && (inherit_templates(trackerId).present? || issue_templates(trackerId).present?)

    project_id = apply_all_projects? ? nil : @project.id
    GlobalIssueTemplate.get_templates_for_project_tracker(project_id, trackerId)
  end
end
