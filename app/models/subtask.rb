class Subtask < ActiveRecord::Base
  unloadable
  belongs_to :project
end
