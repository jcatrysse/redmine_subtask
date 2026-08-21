class Subtask < ActiveRecord::Base
  # PATCHED: removed from ActiveSupport in Rails 5.1
  # unloadable
  belongs_to :project
end
