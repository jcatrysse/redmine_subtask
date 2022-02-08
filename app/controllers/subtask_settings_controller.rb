class SubtaskSettingsController < ApplicationController
  before_action :find_project, :authorize, only: [:show, :index, :create, :update, :destroy]

  def show
    @subtasks = Subtask.where(:project_id => @project.id)
    @trackers = Tracker.all
  end
   
  def index
    render :json => Subtask.where(:project_id => @project.id).as_json(:only => [:id, :parent, :child, :auto, :default])
  end

  def create
    subtask = Subtask.new(:project_id => @project.id)
    subtask.parent = params[:parent]
    subtask.child = params[:child]
    subtask.auto = params[:auto]
    subtask.default = params[:default]
    if subtask.save
      flash[:notice] = l(:notice_successful_create_subtask)
    else
      flash[:error] = l(:notice_fail_create_subtask)
    end
    redirect_to settings_project_path(@project, :tab => 'subtask')
  end
  
  def update
    id = params[:subtask_id]
    subtask = Subtask.where(:project_id => @project.id).where(:id => id).first
    subtask.parent = params[:parent]
    subtask.child = params[:child]
    subtask.auto = params[:auto]
    subtask.default = params[:default]

    if subtask.save
      flash[:notice] = l(:notice_successful_update_subtask)
    else
      flash[:error] = l(:notice_fail_update_subtask)
    end

    redirect_to settings_project_path(@project, :tab => 'subtask')
  end
  
  def destroy
    id = params[:subtask_id]
    subtask = Subtask.where(:project_id => @project.id).where(:id => id).first
    if subtask.destroy
      flash[:notice] = l(:notice_successful_delete_subtask)
    else
      flash[:error] = l(:notice_fail_delete_subtask)
    end
    redirect_to settings_project_path(@project, :tab => 'subtask')
  end
  
  private
  
  def find_project
    @project = Project.find(params[:project_id])
  end
end
