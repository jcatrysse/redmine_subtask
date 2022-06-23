class AddCustomFieldsToSubtasks < ActiveRecord::Migration[5.2]
  def change
    add_column :subtasks, :custom_fields, :json
  end
end
