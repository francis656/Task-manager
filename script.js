let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

function saveTasks() { localStorage.setItem('tasks', JSON.stringify(tasks)); }

function addTask() {
  const task = document.getElementById('task').value;
  const date = document.getElementById('date').value;
  if (task && date) {
    tasks.push({ task, date, completed: false });
    saveTasks();
    renderTasks();
  }
}

function toggleComplete(index) {
  tasks[index].completed = !tasks[index].completed;
  saveTasks();
  renderTasks();
}

function deleteTask(index) {
  tasks.splice(index, 1);
  saveTasks();
  renderTasks();
}

function renderTasks() {
  document.getElementById('taskList').innerHTML = tasks.map((t, i) => `
    <li class="task ${t.completed ? 'completed' : ''}">
      ${t.task} - ${t.date}
      <button onclick="toggleComplete(${i})">✓</button>
      <button onclick="deleteTask(${i})">✕</button>
    </li>
  `).join('');
}

renderTasks();
