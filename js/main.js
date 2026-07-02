"use strict";

/* Configuration */
const _DAYS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const _BLOCK_COLORS = [
	"none",
	"cyan",
	"magenta",
	"amber",
	"green",
	"blue",
	"red",
];
const _DEFAULT_DB = {
	version: 1,
	rows: [],
	cells: {},
};

/* Global State */
let db = structuredClone(_DEFAULT_DB);
let _editingCell = { rowId: null, dayIndex: null };
let _selectedColor = "none";
let _pendingDeleteRowId = null;

/* Storage */
function saveToStorage() {
	try {
		localStorage.setItem("db", JSON.stringify(db));
	} catch (e) {
		showToast("Error al guardar", "error");
	}
}

function loadFromStorage() {
	try {
		const raw = localStorage.getItem("db");
		if (!raw) return;
		const parsed = JSON.parse(raw);
		db.version = parsed.version ?? _DEFAULT_DB.version;
		db.rows = Array.isArray(parsed.rows) ? parsed.rows : [];
		db.cells =
			parsed.cells && typeof parsed.cells === "object" ? parsed.cells : {};
	} catch (e) {
		db = structuredClone(_DEFAULT_DB);
	}
}

/* Import / Export */
function exportJSON() {
	const blob = new Blob([JSON.stringify(db, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "greed0_backup.json";
	a.click();
	URL.revokeObjectURL(url);
	showToast("Exportado correctamente", "success");
}

function importJSON(file) {
	if (!file) return;
	const reader = new FileReader();
	reader.onload = (e) => {
		try {
			const parsed = JSON.parse(e.target.result);
			if (!Array.isArray(parsed.rows) || typeof parsed.cells !== "object") {
				showToast("Archivo no válido", "error");
				return;
			}
			db.rows = parsed.rows;
			db.cells = parsed.cells;
			saveToStorage();
			renderRows();
			showToast("Horario importado", "success");
		} catch {
			showToast("Error al leer el archivo", "error");
		}
	};
	reader.readAsText(file);
}

/* Utilities */
function generateId(prefix) {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

function timeToMinutes(t) {
	const [h, m] = t.split(":").map(Number);
	return h * 60 + m;
}

function minutesToTime(mins) {
	const h = String(Math.floor(mins / 60)).padStart(2, "0");
	const m = String(mins % 60).padStart(2, "0");
	return `${h}:${m}`;
}

/* Render */
function highlightCurrentActivity() {
	const now = new Date();
	const jsDay = now.getDay();

	const currentDayIndex = jsDay === 0 ? 6 : jsDay - 1;
	const currentMinutes = now.getHours() * 60 + now.getMinutes();

	const activeRow = db.rows.find((row) => {
		const startMins = timeToMinutes(row.start);
		const endMins = timeToMinutes(row.end);
		return currentMinutes >= startMins && currentMinutes < endMins;
	});

	if (activeRow) {
		const query = `.cell-activity[data-row-id="${activeRow.id}"][data-day-index="${currentDayIndex}"]`;
		const activeCell = document.querySelector(query);

		if (activeCell) {
			activeCell.classList.add("current");
		}
	}
}

function renderRows() {
	const tbody = document.getElementById("schedule-body");
	tbody.innerHTML = "";

	db.rows.forEach((row) => {
		const tr = document.createElement("tr");
		tr.className = "time-row";
		tr.dataset.rowId = row.id;

		const tdTime = document.createElement("td");
		tdTime.className = "cell-time";
		tdTime.innerHTML = `
      <button class="btn-delete-row" data-row-id="${row.id}" title="Eliminar franja">✕</button>
      <div class="cell-time-inner">
        <span>${row.start}</span>
        <span>${row.end}</span>
      </div>`;
		tr.appendChild(tdTime);

		_DAYS.forEach((_, dayIndex) => {
			const key = `${row.id}_${dayIndex}`;
			const cell = db.cells[key] || { text: "", color: "none" };
			const td = document.createElement("td");
			td.className = "cell-activity" + (cell.text ? "" : " is-empty");
			td.dataset.rowId = row.id;
			td.dataset.dayIndex = dayIndex;
			if (cell.color && cell.color !== "none") td.dataset.color = cell.color;
			td.innerHTML = `<div class="cell-activity-inner">${cell.text ? cell.text : ""}</div>`;
			tr.appendChild(td);
		});

		tbody.appendChild(tr);
	});

	tbody.querySelectorAll(".cell-activity").forEach((td) => {
		td.addEventListener("click", () =>
			openCellModal(td.dataset.rowId, Number(td.dataset.dayIndex)),
		);
	});

	tbody.querySelectorAll(".btn-delete-row").forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			confirmDeleteRow(btn.dataset.rowId);
		});
	});

	highlightCurrentActivity();
}

/* Modals Logic */
function openTimeModal() {
	const lastRow = db.rows[db.rows.length - 1];
	const minTime = lastRow ? lastRow.end : "00:00";
	const minMins = timeToMinutes(minTime);

	const hint = document.getElementById("modal-time-hint");
	hint.textContent = lastRow
		? `La franja debe comenzar desde las ${minTime} o después.`
		: "Define el primer intervalo del día.";

	populateTimeSelects(minMins);
	document.getElementById("time-error").style.display = "none";
	openModal("modal-time");
}

function populateTimeSelects(minMins) {
	const startH = document.getElementById("time-start-h");
	const startM = document.getElementById("time-start-m");
	const endH = document.getElementById("time-end-h");
	const endM = document.getElementById("time-end-m");

	const minH = Math.floor(minMins / 60);
	const minM = minMins % 60;

	startH.innerHTML = "";

	for (let h = minH; h <= 23; h++) {
		const opt = document.createElement("option");
		opt.value = h;
		opt.textContent = String(h).padStart(2, "0");
		startH.appendChild(opt);
	}

	const updateStartMinutes = () => {
		const selH = Number(startH.value);
		startM.innerHTML = "";
		const startMin = selH === minH ? Math.ceil(minM / 15) * 15 : 0;

		for (let m = startMin; m < 60; m += 15) {
			const opt = document.createElement("option");
			opt.value = m;
			opt.textContent = String(m).padStart(2, "0");
			startM.appendChild(opt);
		}

		updateEndSelects();
	};

	const updateEndSelects = () => {
		const selStartH = Number(startH.value);
		const selStartM = Number(startM.value) || 0;
		const startTotalMins = selStartH * 60 + selStartM;
		const minEndMins = startTotalMins + 15;
		const minEndH = Math.floor(minEndMins / 60);

		endH.innerHTML = "";
		for (let h = minEndH; h <= 23; h++) {
			const opt = document.createElement("option");
			opt.value = h;
			opt.textContent = String(h).padStart(2, "0");
			endH.appendChild(opt);
		}
		updateEndMinutes();
	};

	const updateEndMinutes = () => {
		const selStartH = Number(startH.value);
		const selStartM = Number(startM.value) || 0;
		const selEndH = Number(endH.value);
		const startTotal = selStartH * 60 + selStartM;

		endM.innerHTML = "";

		for (let m = 0; m < 60; m += 15) {
			const endTotal = selEndH * 60 + m;
			if (endTotal <= startTotal) continue;
			const opt = document.createElement("option");
			opt.value = m;
			opt.textContent = String(m).padStart(2, "0");
			endM.appendChild(opt);
		}
	};

	startH.addEventListener("change", updateStartMinutes);
	startM.addEventListener("change", updateEndSelects);
	endH.addEventListener("change", updateEndMinutes);
	updateStartMinutes();
}

function saveTimeRow() {
	const startH = Number(document.getElementById("time-start-h").value);
	const startM = Number(document.getElementById("time-start-m").value) || 0;
	const endH = Number(document.getElementById("time-end-h").value);
	const endM = Number(document.getElementById("time-end-m").value) || 0;

	const start = minutesToTime(startH * 60 + startM);
	const end = minutesToTime(endH * 60 + endM);
	const startMins = timeToMinutes(start);
	const endMins = timeToMinutes(end);
	const errEl = document.getElementById("time-error");

	if (endMins <= startMins) {
		errEl.textContent = "La hora de fin debe ser posterior a la de inicio.";
		errEl.style.display = "block";
		return;
	}

	if (db.rows.length > 0) {
		const lastEnd = timeToMinutes(db.rows[db.rows.length - 1].end);
		if (startMins < lastEnd) {
			errEl.textContent = `El inicio no puede ser antes de las ${db.rows[db.rows.length - 1].end}.`;
			errEl.style.display = "block";
			return;
		}
	}

	errEl.style.display = "none";
	db.rows.push({ id: generateId("row"), start, end });
	saveToStorage();
	renderRows();
	closeModal("modal-time");
	showToast("Franja añadida", "success");
}

function openCellModal(rowId, dayIndex) {
	_editingCell = { rowId, dayIndex };
	const key = `${rowId}_${dayIndex}`;
	const cell = db.cells[key] || { text: "", color: "none" };
	const row = db.rows.find((r) => r.id === rowId);
	const dayName = _DAYS[dayIndex];

	document.getElementById("modal-cell-title").textContent =
		`${dayName} · ${row.start}–${row.end}`;
	document.getElementById("cell-input-text").value = cell.text || "";
	_selectedColor = cell.color || "none";
	renderColorPicker();
	openModal("modal-cell");
	setTimeout(() => document.getElementById("cell-input-text").focus(), 120);
}

function renderColorPicker() {
	const row = document.getElementById("color-picker-row");
	row.innerHTML = "";
	_BLOCK_COLORS.forEach((color) => {
		const sw = document.createElement("div");
		sw.className =
			"color-swatch" + (color === _selectedColor ? " selected" : "");
		sw.dataset.color = color;
		if (color === "none") sw.title = "Sin color";
		row.appendChild(sw);
	});

	row.querySelectorAll(".color-swatch").forEach((sw) => {
		sw.addEventListener("click", () => {
			_selectedColor = sw.dataset.color;
			row
				.querySelectorAll(".color-swatch")
				.forEach((s) => s.classList.remove("selected"));
			sw.classList.add("selected");
		});
	});
}

function saveCellContent() {
	const { rowId, dayIndex } = _editingCell;
	if (rowId === null) return;
	const text = document.getElementById("cell-input-text").value.trim();
	const key = `${rowId}_${dayIndex}`;

	if (!text && (_selectedColor === "none" || !_selectedColor)) {
		delete db.cells[key];
	} else {
		db.cells[key] = { text, color: _selectedColor || "none" };
	}

	saveToStorage();
	renderRows();
	closeModal("modal-cell");
}

function clearCellContent() {
	const { rowId, dayIndex } = _editingCell;
	if (rowId === null) return;
	const key = `${rowId}_${dayIndex}`;
	delete db.cells[key];
	saveToStorage();
	renderRows();
	closeModal("modal-cell");
	showToast("Bloque eliminado", "success");
}

function confirmDeleteRow(rowId) {
	_pendingDeleteRowId = rowId;
	const row = db.rows.find((r) => r.id === rowId);
	document.getElementById("modal-confirm-msg").textContent =
		`¿Eliminar la franja ${row.start}–${row.end}?`;
	openModal("modal-confirm");
}

function deleteRow() {
	if (!_pendingDeleteRowId) return;
	const rowId = _pendingDeleteRowId;
	db.rows = db.rows.filter((r) => r.id !== rowId);
	Object.keys(db.cells).forEach((key) => {
		if (key.startsWith(rowId + "_")) delete db.cells[key];
	});
	saveToStorage();
	renderRows();
	closeModal("modal-confirm");
	showToast("Franja eliminada", "success");
	_pendingDeleteRowId = null;
}

/* System Modals */
function openModal(id) {
	document.getElementById(id).classList.add("active");
	history.pushState({ modal: id }, "");
}

function closeModal(id) {
	document.getElementById(id).classList.remove("active");
}

function closeAllModals() {
	document
		.querySelectorAll(".modal.active")
		.forEach((m) => m.classList.remove("active"));
}

/* Toasts */
function showToast(message, type = "success", duration = 2800) {
	const container = document.getElementById("toast-container");
	const toast = document.createElement("div");
	toast.className = `toast toast-${type}`;
	toast.textContent = message;
	container.appendChild(toast);

	requestAnimationFrame(() => {
		requestAnimationFrame(() => toast.classList.add("toast-visible"));
	});

	setTimeout(() => {
		toast.classList.remove("toast-visible");
		setTimeout(() => toast.remove(), 300);
	}, duration);
}

/* Event Listeners */
document.getElementById("btn-add-row").addEventListener("click", openTimeModal);
document.getElementById("btn-time-save").addEventListener("click", saveTimeRow);
document
	.getElementById("btn-cell-save")
	.addEventListener("click", saveCellContent);
document
	.getElementById("btn-cell-clear")
	.addEventListener("click", clearCellContent);
document.getElementById("btn-confirm-ok").addEventListener("click", deleteRow);
document.getElementById("btn-export").addEventListener("click", exportJSON);
document.getElementById("btn-import").addEventListener("click", () => {
	document.getElementById("file-input").value = "";
	document.getElementById("file-input").click();
});
document.getElementById("file-input").addEventListener("change", (e) => {
	importJSON(e.target.files[0]);
});

document.querySelectorAll(".modal").forEach((modal) => {
	modal.addEventListener("click", (e) => {
		if (e.target === modal) closeAllModals();
	});
});

window.addEventListener("popstate", () => closeAllModals());

document.addEventListener("keydown", (e) => {
	if (e.key === "Escape") closeAllModals();
	if (e.key === "Enter") {
		if (document.getElementById("modal-cell").classList.contains("active"))
			saveCellContent();
	}
});

/* Init */
loadFromStorage();
renderRows();

async function trackProjectActivity(projectName) {
	try {
		const { error } = await _supabase.rpc("increment_visit", {
			name_param: projectName,
		});

		if (error) throw error;
	} catch (err) {
		console.warn("Offline mode");
	}
}

Promise.race([
	Promise.all([trackProjectActivity("Greed0")]),
	new Promise((resolve) => setTimeout(resolve, 3000)),
]);

if ("serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker
			.register("./sw.js")
			.then((registration) => {
				console.log("SW registrado con éxito:", registration.scope);
			})
			.catch((error) => {
				console.log("Fallo al registrar el SW:", error);
			});
	});
}
