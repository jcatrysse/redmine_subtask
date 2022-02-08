class CreateSubtask < ActiveRecord::Migration[5.2]
  def change
    create_table :subtasks do |t|
      t.integer :parent
      t.integer :child
      t.integer :project_id
      t.boolean :default
      t.boolean :auto
    end
  end
end
