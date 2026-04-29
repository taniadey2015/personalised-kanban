import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import "./App.css";

type ColumnId = "backlog" | "inProgress" | "review" | "done";
// type FilterColumn = "all" | ColumnId;

type Task = {
  id: string;
  title: string;
  description: string;
  column: ColumnId;
  createdAt: number;
};

const STORAGE_KEY = "kanban-local-board-v1";
const USER_NAME_STORAGE_KEY = "kanban-local-user-name-v1";

const COLUMNS: Array<{
  id: ColumnId;
  label: string;
  emoji: string;
  wipLimit: number | null;
}> = [
  { id: "backlog", label: "Backlog", emoji: "📝", wipLimit: 5 },
  { id: "inProgress", label: "In Progress", emoji: "⚙️", wipLimit: 3 },
  { id: "review", label: "Review", emoji: "🔍", wipLimit: 2 },
  { id: "done", label: "Done", emoji: "✅", wipLimit: null },
];

const DEFAULT_TASKS: Task[] = [
  {
    id: "seed-setup-project-board",
    title: "Set up project board",
    description: "Create initial columns and define task workflow.",
    column: "done",
    createdAt: 1714300000000,
  },
  {
    id: "seed-design-card-styles",
    title: "Design card styles",
    description: "Create readable cards with clear action buttons.",
    column: "inProgress",
    createdAt: 1714303600000,
  },
  {
    id: "seed-add-dnd",
    title: "Add drag and drop",
    description: "Allow tasks to move smoothly between statuses.",
    column: "review",
    createdAt: 1714307200000,
  },
];

const loadInitialTasks = (): Task[] => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_TASKS;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return DEFAULT_TASKS;
    }

    const safeTasks = parsed.filter(
      (item): item is Task =>
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        "title" in item &&
        "description" in item &&
        "column" in item &&
        "createdAt" in item,
    );

    return safeTasks.length > 0 ? safeTasks : DEFAULT_TASKS;
  } catch {
    return DEFAULT_TASKS;
  }
};

const loadInitialUserName = (): string => {
  const raw = localStorage.getItem(USER_NAME_STORAGE_KEY);
  return raw?.trim() ?? "";
};

const createTask = (title: string, description: string): Task => ({
  id: crypto.randomUUID(),
  title,
  description,
  column: "backlog",
  createdAt: Date.now(),
});

function App() {
  const [tasks, setTasks] = useState<Task[]>(() => loadInitialTasks());
  const [userName, setUserName] = useState<string>(() => loadInitialUserName());
  const [nameDraft, setNameDraft] = useState<string>(() =>
    loadInitialUserName(),
  );
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  // const [searchQuery, setSearchQuery] = useState("");
  // const [statusFilter, setStatusFilter] = useState<FilterColumn>("all");
  const [boardNotice, setBoardNotice] = useState("");

  // const hasSearchFilter = searchQuery.trim().length > 0;
  // const hasStatusFilter = statusFilter !== "all";
  // const hasActiveFilters = hasSearchFilter || hasStatusFilter;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (userName.trim()) {
      localStorage.setItem(USER_NAME_STORAGE_KEY, userName.trim());
      return;
    }

    localStorage.removeItem(USER_NAME_STORAGE_KEY);
  }, [userName]);

  // const filteredTasks = useMemo(() => {
  //   const normalizedQuery = searchQuery.trim().toLowerCase();
  //
  //   return tasks.filter((task) => {
  //     const matchesStatus =
  //       statusFilter === "all" || task.column === statusFilter;
  //     if (!matchesStatus) {
  //       return false;
  //     }
  //
  //     if (!normalizedQuery) {
  //       return true;
  //     }
  //
  //     return (
  //       task.title.toLowerCase().includes(normalizedQuery) ||
  //       task.description.toLowerCase().includes(normalizedQuery)
  //     );
  //   });
  // }, [tasks, searchQuery, statusFilter]);

  const groupedTasks = useMemo(() => {
    return COLUMNS.reduce<Record<ColumnId, Task[]>>(
      (acc, column) => {
        acc[column.id] = tasks
          .filter((task) => task.column === column.id)
          .sort((a, b) => b.createdAt - a.createdAt);
        return acc;
      },
      {
        backlog: [],
        inProgress: [],
        review: [],
        done: [],
      },
    );
  }, [tasks]);

  const columnCounts = useMemo(() => {
    return COLUMNS.reduce<Record<ColumnId, number>>(
      (acc, column) => {
        acc[column.id] = tasks.filter(
          (task) => task.column === column.id,
        ).length;
        return acc;
      },
      {
        backlog: 0,
        inProgress: 0,
        review: 0,
        done: 0,
      },
    );
  }, [tasks]);

  const columnIndex = (columnId: ColumnId) =>
    COLUMNS.findIndex((column) => column.id === columnId);

  // const columnLabel = (columnId: ColumnId) =>
  //   COLUMNS.find((column) => column.id === columnId)?.label ?? columnId;

  const nextColumnForDirection = (columnId: ColumnId, direction: -1 | 1) => {
    const nextIndex = columnIndex(columnId) + direction;
    if (nextIndex < 0 || nextIndex >= COLUMNS.length) {
      return null;
    }

    return COLUMNS[nextIndex].id;
  };

  const isColumnAtLimit = (columnId: ColumnId, snapshotTasks = tasks) => {
    const column = COLUMNS.find((item) => item.id === columnId);
    if (!column || column.wipLimit === null) {
      return false;
    }

    const count = snapshotTasks.filter(
      (task) => task.column === columnId,
    ).length;
    return count >= column.wipLimit;
  };

  const moveTaskToColumn = (taskId: string, targetColumn: ColumnId) => {
    setTasks((currentTasks) => {
      const targetTask = currentTasks.find((task) => task.id === taskId);
      if (!targetTask || targetTask.column === targetColumn) {
        return currentTasks;
      }

      if (isColumnAtLimit(targetColumn, currentTasks)) {
        const target = COLUMNS.find((column) => column.id === targetColumn);
        setBoardNotice(`WIP limit reached for ${target?.label ?? "column"}.`);
        return currentTasks;
      }

      setBoardNotice("");
      return currentTasks.map((task) =>
        task.id === taskId ? { ...task, column: targetColumn } : task,
      );
    });
  };

  const handleCreateTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = draftTitle.trim();
    if (!title) {
      return;
    }

    if (isColumnAtLimit("backlog")) {
      setBoardNotice(
        "Backlog is at WIP limit. Move or complete existing items.",
      );
      return;
    }

    setTasks((currentTasks) => [
      createTask(title, draftDescription.trim()),
      ...currentTasks,
    ]);
    setBoardNotice("");
    setDraftTitle("");
    setDraftDescription("");
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((currentTasks) =>
      currentTasks.filter((task) => task.id !== taskId),
    );
    if (editingTaskId === taskId) {
      setEditingTaskId(null);
    }
  };

  const openEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description);
  };

  const saveEditedTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTaskId) {
      return;
    }

    const title = editTitle.trim();
    if (!title) {
      return;
    }

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === editingTaskId
          ? {
              ...task,
              title,
              description: editDescription.trim(),
            }
          : task,
      ),
    );
    setBoardNotice("");
    setEditingTaskId(null);
  };

  const moveTaskHorizontally = (task: Task, direction: -1 | 1) => {
    const nextColumn = nextColumnForDirection(task.column, direction);
    if (!nextColumn) {
      return;
    }

    moveTaskToColumn(task.id, nextColumn);
  };

  const handleTaskKeyDown = (event: KeyboardEvent<HTMLElement>, task: Task) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveTaskHorizontally(task, -1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveTaskHorizontally(task, 1);
    }
  };

  // const clearAllFilters = () => {
  //   setSearchQuery("");
  //   setStatusFilter("all");
  // };

  const saveUserName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = nameDraft.trim();
    if (!nextName) {
      return;
    }

    setUserName(nextName);
  };

  return (
    <div className="board-shell">
      {!userName.trim() && (
        <div className="edit-overlay" role="presentation">
          <form className="edit-modal" onSubmit={saveUserName}>
            <h2>What is your name?</h2>
            <label htmlFor="user-name">Name</label>
            <input
              id="user-name"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder="Enter your name"
              maxLength={40}
              autoFocus
            />

            <div className="modal-actions">
              <button type="submit">Save</button>
            </div>
          </form>
        </div>
      )}

      <header className="topbar">
        <div>
          <p className="eyebrow">Kanban Board</p>
          <h1>{userName ? `${userName}'s Work Tracker` : "Work Tracker"}</h1>
          {/* <div className="board-controls" aria-label="Task filters">
            <div className="control-group">
              <label htmlFor="search-tasks">Search</label>
              <input
                id="search-tasks"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search title or details"
              />
            </div>

            <div className="control-group">
              <label htmlFor="filter-status">Status</label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as FilterColumn)
                }
              >
                <option value="all">All columns</option>
                {COLUMNS.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.label}
                  </option>
                ))}
              </select>
            </div>
          </div> */}
        </div>

        <form className="composer" onSubmit={handleCreateTask}>
          <label htmlFor="task-title">Task title</label>
          <input
            id="task-title"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="Ex: Build API integration"
            maxLength={90}
          />

          <label htmlFor="task-description">Details</label>
          <textarea
            id="task-description"
            value={draftDescription}
            onChange={(event) => setDraftDescription(event.target.value)}
            placeholder="Optional notes, acceptance criteria, links..."
            rows={3}
            maxLength={280}
          />

          <button type="submit">Add Task</button>
        </form>
      </header>

      {boardNotice && <p className="board-notice">{boardNotice}</p>}

      {/* {hasActiveFilters && (
        <div className="active-filters" role="status" aria-live="polite">
          <span className="active-filters-label">Active filters</span>

          {hasSearchFilter && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => setSearchQuery("")}
              aria-label={`Clear search filter ${searchQuery.trim()}`}
            >
              Search: "{searchQuery.trim()}" ×
            </button>
          )}

          {hasStatusFilter && (
            <button
              type="button"
              className="filter-chip"
              onClick={() => setStatusFilter("all")}
              aria-label={`Clear status filter ${columnLabel(statusFilter as ColumnId)}`}
            >
              Status: {columnLabel(statusFilter as ColumnId)} ×
            </button>
          )}

          <button
            type="button"
            className="clear-filters"
            onClick={clearAllFilters}
          >
            Clear all
          </button>
        </div>
      )} */}

      <main className="board-grid">
        {COLUMNS.map((column) => (
          <section
            key={column.id}
            className={`column column-${column.id}${
              isColumnAtLimit(column.id) ? " is-full" : ""
            }`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const taskId = event.dataTransfer.getData("text/task-id");
              if (taskId) {
                moveTaskToColumn(taskId, column.id);
              }
            }}
          >
            <header className="column-header">
              <h2>
                {column.emoji} {column.label}
              </h2>
              <span>
                {column.wipLimit === null
                  ? `${columnCounts[column.id]}`
                  : `${columnCounts[column.id]}/${column.wipLimit}`}
              </span>
            </header>

            <div className="column-list">
              {groupedTasks[column.id].length === 0 ? (
                <p className="empty-state">Drop a task here</p>
              ) : (
                groupedTasks[column.id].map((task) => (
                  <article
                    key={task.id}
                    className={`task-card task-card-${task.column}`}
                    tabIndex={0}
                    draggable
                    onKeyDown={(event) => handleTaskKeyDown(event, task)}
                    aria-label="Task card. Use left and right arrow keys to move between columns."
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/task-id", task.id);
                    }}
                  >
                    <h3>{task.title}</h3>
                    {task.description && <p>{task.description}</p>}

                    <div className="task-actions">
                      <button
                        type="button"
                        onClick={() => moveTaskHorizontally(task, -1)}
                        disabled={
                          columnIndex(task.column) === 0 ||
                          (nextColumnForDirection(task.column, -1) !== null &&
                            isColumnAtLimit(
                              nextColumnForDirection(
                                task.column,
                                -1,
                              ) as ColumnId,
                            ))
                        }
                      >
                        Left
                      </button>
                      <button type="button" onClick={() => openEditTask(task)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => moveTaskHorizontally(task, 1)}
                        disabled={
                          columnIndex(task.column) === COLUMNS.length - 1 ||
                          (nextColumnForDirection(task.column, 1) !== null &&
                            isColumnAtLimit(
                              nextColumnForDirection(
                                task.column,
                                1,
                              ) as ColumnId,
                            ))
                        }
                      >
                        Right
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        ))}
      </main>

      {editingTaskId && (
        <div className="edit-overlay" role="presentation">
          <form className="edit-modal" onSubmit={saveEditedTask}>
            <h2>Edit Task</h2>
            <label htmlFor="edit-title">Title</label>
            <input
              id="edit-title"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              maxLength={90}
            />

            <label htmlFor="edit-description">Details</label>
            <textarea
              id="edit-description"
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              rows={4}
              maxLength={280}
            />

            <div className="modal-actions">
              <button type="button" onClick={() => setEditingTaskId(null)}>
                Cancel
              </button>
              <button type="submit">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
