<script lang="ts">
	import { onMount, onDestroy, tick } from "svelte";
	import { invoke } from "@tauri-apps/api/core";
	import { open as openDialog, save as saveDialog, message, confirm } from "@tauri-apps/plugin-dialog";
	import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
	import { openUrl as openExternal } from "@tauri-apps/plugin-opener";
	import { basename } from "@tauri-apps/api/path";
	import TopBar from "../components/TopBar.svelte";
import SideBar from "../components/SideBar.svelte";
import type { SidebarItem } from "../components/SideBar.svelte";
	import InspectorPanel from "../components/InspectorPanel.svelte";
	import ConsolePanel from "../components/ConsolePanel.svelte";
	import PixiViewer from "../components/PixiViewer.svelte";
	import PreferencesModal from "../components/PreferencesModal.svelte";
	import { doSpin } from "../lib/state/slotStore";

	type PanelKey = "explorer" | "properties" | "console";
	type ToolKey = "reel" | "payline" | "ui" | "bonus";
	type ReelPreset = "5x3" | "5x4";

type ProjectConfig = {
	grid: { cols: number; rows: number };
	spinSpeed: number;
	assets: string[];
	tool: ToolKey;
	gridAssignments?: (string | null)[][];
};

	type HistoryState = {
		cols: number;
		rows: number;
		spinSpeed: number;
	};

	type Preferences = {
		theme: "dark" | "light";
		autoSave: boolean;
		confirmOnOverwrite: boolean;
	};

	const WORKSPACE_STORAGE_KEY = "slotstudio:workspace";
	const PREFERENCES_STORAGE_KEY = "slotstudio:preferences";

	let cols = 5;
	let rows = 3;
	let spinSpeed = 0.5;

const baseSidebarItems: SidebarItem[] = [
	{ id: "assets", label: "🎨 Assets" },
	{ id: "reels", label: "🧩 Reels" },
	{ id: "configs", label: "⚙️ Configs" },
	{ id: "ui", label: "🪄 UI Elements" }
];

let importedAssets: string[] = [];
let sidebarItems: SidebarItem[] = baseSidebarItems;

$: sidebarItems = [
	...baseSidebarItems,
	...importedAssets.map((path, index) => ({
		id: `asset-${index}`,
		label: `🖼️ ${assetLabel(path)}`,
		draggable: true,
		data: { assetPath: path },
		thumbnail: toAssetUrl(path)
	}))
];

function assetLabel(path: string) {
	const segments = path.split(/[/\\]/);
	return segments[segments.length - 1] ?? path;
}

function toProjectAssetPath(path: string) {
	const normalized = path.replace(/\\/g, "/");
	const staticPrefix = "static/";
	const index = normalized.indexOf(staticPrefix);
	if (index !== -1) {
		return normalized.slice(index + staticPrefix.length);
	}
	return normalized.startsWith("/") ? normalized.slice(1) : normalized;
}

function toAssetUrl(path: string) {
	return path.startsWith("/") ? path : `/${path}`;
}

	let activeSidebar = baseSidebarItems[0].id;
	let showExplorer = true;
	let showProperties = true;
	let showConsole = true;
	let isSpinning = false;
let activeTool: ToolKey = "reel";
let activePreset: ReelPreset = "5x3";
let projectFilePath: string | null = null;
let preferences: Preferences = {
	theme: "dark",
	autoSave: false,
	confirmOnOverwrite: true
};
let preferencesOpen = false;

type CellAssignment = string | null;
let cellAssignments: CellAssignment[][] = [];

function createAssignmentGrid(
	targetRows: number,
	targetCols: number,
	previous: CellAssignment[][] = cellAssignments
): CellAssignment[][] {
	return Array.from({ length: targetRows }, (_, row) =>
		Array.from({ length: targetCols }, (_, col) => previous[row]?.[col] ?? null)
	);
}

function setCellAssignment(col: number, row: number, assetPath: string) {
	cellAssignments = cellAssignments.map((rowCells, r) =>
		rowCells.map((value, c) => {
			if (r === row && c === col) return assetPath;
			return value ?? null;
		})
	);
}

function clearAssignments() {
	cellAssignments = createAssignmentGrid(rows, cols, []);
}

$: {
	const desiredRows = rows;
	const desiredCols = cols;
	if (
		desiredRows > 0 &&
		desiredCols > 0 &&
		(cellAssignments.length !== desiredRows || cellAssignments[0]?.length !== desiredCols)
	) {
		cellAssignments = createAssignmentGrid(desiredRows, desiredCols);
	}
}

	let undoStack: HistoryState[] = [];
	let redoStack: HistoryState[] = [];
	let canUndo = false;
	let canRedo = false;
	let historyReady = false;
	let suspendHistory = false;
	let previousSnapshot: HistoryState;

	function snapshot(): HistoryState {
		return { cols, rows, spinSpeed };
	}

	function statesEqual(a: HistoryState, b: HistoryState) {
		return a.cols === b.cols && a.rows === b.rows && a.spinSpeed === b.spinSpeed;
	}

	function updateUndoRedoState() {
		canUndo = undoStack.length > 0;
		canRedo = redoStack.length > 0;
	}

	function formatLog(message: string) {
		return `[${new Date().toLocaleTimeString()}] ${message}`;
	}

	let logs: string[] = [formatLog("Slot Studio initialized"), formatLog("Ready to roll...")];

	function appendLog(message: string) {
		logs = [...logs, formatLog(message)];
	}

	function determinePreset(currentCols: number, currentRows: number): ReelPreset {
		if (currentCols === 5 && currentRows === 4) return "5x4";
		return "5x3";
	}

	onMount(() => {
		loadWorkspace();
		loadPreferences();
		previousSnapshot = snapshot();
		historyReady = true;
		applyTheme(preferences.theme);
	});

	async function loadWorkspace() {
		try {
			const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
			if (!raw) return;
			const stored = JSON.parse(raw) as {
				showExplorer: boolean;
				showProperties: boolean;
				showConsole: boolean;
				cols: number;
				rows: number;
				spinSpeed: number;
				assets: string[];
				tool: ToolKey;
				projectFilePath?: string | null;
				assignments?: (string | null)[][];
			};
			showExplorer = stored.showExplorer ?? true;
			showProperties = stored.showProperties ?? true;
			showConsole = stored.showConsole ?? true;
			cols = stored.cols ?? cols;
			rows = stored.rows ?? rows;
			spinSpeed = stored.spinSpeed ?? spinSpeed;
			importedAssets = stored.assets ?? [];
			activeTool = stored.tool ?? "reel";
			activePreset = determinePreset(cols, rows);
			projectFilePath = stored.projectFilePath ?? null;
			if (Array.isArray(stored.assignments)) {
				cellAssignments = createAssignmentGrid(rows, cols, stored.assignments as CellAssignment[][]);
			}
			appendLog("Workspace layout restored.");
		} catch (error) {
			console.error(error);
			appendLog("Failed to load workspace settings.");
		}
	}

	function saveWorkspace() {
		const payload = {
			showExplorer,
			showProperties,
			showConsole,
			cols,
			rows,
			spinSpeed,
			assets: importedAssets,
			tool: activeTool,
			projectFilePath,
			assignments: cellAssignments.map((row) => [...row])
		};
		localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(payload));
		appendLog("Workspace saved.");
	}

function resetWorkspace() {
	showExplorer = true;
	showProperties = true;
	showConsole = true;
	activeTool = "reel";
	clearAssignments();
	appendLog("Workspace layout reset.");
	saveWorkspace();
}

	function loadPreferences() {
		try {
			const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
			if (!raw) return;
			const stored = JSON.parse(raw) as Preferences;
			preferences = { ...preferences, ...stored };
		} catch (error) {
			console.error(error);
			appendLog("Failed to load preferences.");
		}
	}

	function savePreferences(updated: Preferences) {
		preferences = updated;
		localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
		appendLog("Preferences updated.");
		applyTheme(preferences.theme);
	}

	function applyTheme(theme: "dark" | "light") {
		document.documentElement.dataset.theme = theme;
	}

	async function handleRun() {
		if (isSpinning) return;
		isSpinning = true;
		appendLog("Executing spin...");
		try {
			const result = await doSpin();
			if (result.wins.length) {
				appendLog(`Spin complete with ${result.wins.length} win${result.wins.length === 1 ? "" : "s"}.`);
				result.wins.forEach((win, index) => {
					appendLog(`Win ${index + 1}: ${win.cells.length} symbols, payout ${win.payout}.`);
				});
				if (result.cascades > 0) {
					appendLog(`Cascades triggered: ${result.cascades}.`);
				}
			} else {
				appendLog("Spin complete with no wins.");
			}
		} catch (error) {
			const messageText = error instanceof Error ? error.message : "Unknown error";
			appendLog(`Spin failed: ${messageText}`);
			console.error(error);
		} finally {
			isSpinning = false;
		}
	}

	async function newProject() {
		suspendHistory = true;
		cols = 5;
		rows = 3;
		spinSpeed = 0.5;
		importedAssets = [];
		activeTool = "reel";
		activePreset = "5x3";
		projectFilePath = null;
		undoStack = [];
		redoStack = [];
		updateUndoRedoState();
		logs = [formatLog("Created new project template.")];
		await tick();
		clearAssignments();
		previousSnapshot = snapshot();
		suspendHistory = false;
		saveWorkspace();
}

	async function openProject() {
		try {
			const selection = await openDialog({
				title: "Open Slot Studio Project",
				filters: [{ name: "Slot Studio Project", extensions: ["json"] }]
			});
			if (!selection || Array.isArray(selection)) return;
			const contents = await readTextFile(selection);
			const data = JSON.parse(contents) as ProjectConfig;
			if (!data?.grid || typeof data.spinSpeed !== "number") {
				throw new Error("Invalid project file.");
			}
			suspendHistory = true;
			cols = data.grid.cols;
			rows = data.grid.rows;
			spinSpeed = data.spinSpeed;
			importedAssets = data.assets ?? [];
			activeTool = data.tool ?? "reel";
			activePreset = determinePreset(cols, rows);
			projectFilePath = selection;
			undoStack = [];
			redoStack = [];
			updateUndoRedoState();
			await tick();
			if (Array.isArray(data.gridAssignments)) {
				cellAssignments = createAssignmentGrid(rows, cols, data.gridAssignments as CellAssignment[][]);
			} else {
				clearAssignments();
			}
			previousSnapshot = snapshot();
			suspendHistory = false;
			appendLog(`Opened project: ${await basename(selection)}`);
			saveWorkspace();
		} catch (error) {
			if (error instanceof Error && error.message.includes("Invalid project file")) {
				await message(error.message, { title: "Slot Studio", kind: "error" });
			} else if (error) {
				console.error(error);
				appendLog("Project open cancelled or failed.");
			}
		}
	}

async function saveProject() {
	try {
		let targetPath = projectFilePath;
		if (!targetPath) {
			targetPath = await saveDialog({
				title: "Save Slot Studio Project",
				defaultPath: "slotstudio-project.json",
				filters: [{ name: "Slot Studio Project", extensions: ["json"] }]
			});
			if (!targetPath) return;
			projectFilePath = targetPath;
		} else if (preferences.confirmOnOverwrite) {
			const confirmed = await confirm("Overwrite existing project file?", {
				title: "Confirm Save",
				okLabel: "Overwrite",
				cancelLabel: "Cancel"
			});
			if (!confirmed) {
				appendLog("Save cancelled.");
				return;
			}
		}

		const payload: ProjectConfig = {
			grid: { cols, rows },
			spinSpeed,
			assets: importedAssets,
			tool: activeTool,
			gridAssignments: cellAssignments.map((row) => [...row])
		};
		await writeTextFile(targetPath, JSON.stringify(payload, null, 2));
		appendLog(`Project saved to ${await basename(targetPath)}`);
		saveWorkspace();
	} catch (error) {
		if (error) {
			console.error(error);
			appendLog("Failed to save project.");
		}
	}
}

	async function importAssets() {
		try {
			const selection = await openDialog({
				title: "Import Assets",
				filters: [
					{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] },
					{ name: "Sprite Sheets", extensions: ["json"] }
				],
				multiple: true
			});
			if (!selection) return;

			const selectedPaths = Array.isArray(selection) ? selection : [selection];
			if (!selectedPaths.length) return;

			const copied = await invoke<string[]>("import_assets", { paths: selectedPaths });
			importedAssets = [
				...importedAssets,
				...copied.map((path) => toProjectAssetPath(path))
			];
			appendLog(`Imported ${selectedPaths.length} asset${selectedPaths.length === 1 ? "" : "s"}.`);
			saveWorkspace();
		} catch (error) {
			console.error(error);
			appendLog("Asset import failed.");
		}
	}

	async function handleSave() {
		await saveProject();
	}

	async function undo() {
		if (!undoStack.length) return;
		const target = undoStack[undoStack.length - 1];
		const current = snapshot();
		undoStack = undoStack.slice(0, -1);
		redoStack = [...redoStack, current];
		updateUndoRedoState();
		suspendHistory = true;
		cols = target.cols;
		rows = target.rows;
		spinSpeed = target.spinSpeed;
		activePreset = determinePreset(cols, rows);
		await tick();
		previousSnapshot = snapshot();
		suspendHistory = false;
		appendLog("Undid last change.");
	}

	async function redo() {
		if (!redoStack.length) return;
		const target = redoStack[redoStack.length - 1];
		const current = snapshot();
		redoStack = redoStack.slice(0, -1);
		undoStack = [...undoStack, current];
		updateUndoRedoState();
		suspendHistory = true;
		cols = target.cols;
		rows = target.rows;
		spinSpeed = target.spinSpeed;
		activePreset = determinePreset(cols, rows);
		await tick();
		previousSnapshot = snapshot();
		suspendHistory = false;
		appendLog("Redid change.");
	}

	function togglePanel(panel: PanelKey) {
		if (panel === "explorer") {
			showExplorer = !showExplorer;
			appendLog(`${showExplorer ? "Showing" : "Hiding"} Project Explorer panel.`);
		} else if (panel === "properties") {
			showProperties = !showProperties;
			appendLog(`${showProperties ? "Showing" : "Hiding"} Properties panel.`);
		} else if (panel === "console") {
			showConsole = !showConsole;
			appendLog(`${showConsole ? "Showing" : "Hiding"} Console panel.`);
		}
		saveWorkspace();
	}

	async function setPreset(preset: ReelPreset) {
		if (preset === activePreset) return;
		suspendHistory = true;
		cols = 5;
		rows = preset === "5x3" ? 3 : 4;
		activePreset = preset;
		await tick();
		suspendHistory = false;
		appendLog(`Switched to ${preset} preset.`);
		saveWorkspace();
	}

	function setTool(tool: ToolKey) {
		if (tool === activeTool) return;
		activeTool = tool;
		appendLog(`Activated ${toolLabel(tool)}.`);
		saveWorkspace();
	}

	function toolLabel(tool: ToolKey) {
		switch (tool) {
			case "reel":
				return "Reel Tool";
			case "payline":
				return "Payline Tool";
			case "ui":
				return "UI Tool";
			case "bonus":
				return "Bonus Editor";
		}
	}

	async function openDocumentation() {
		const url = "https://slotstudio.local/docs";
		try {
			await openExternal(url);
		} catch {
			window.open(url, "_blank");
		}
		appendLog("Opened Slot Studio documentation.");
	}

	async function openTutorials() {
		const url = "https://slotstudio.local/tutorials";
		try {
			await openExternal(url);
		} catch {
			window.open(url, "_blank");
		}
		appendLog("Opened tutorials hub.");
	}

	async function showAbout() {
		await message("Slot Studio — Build slot experiences visually.\nVersion 0.1.0", {
			title: "About Slot Studio",
			kind: "info"
		});
		appendLog("Displayed About dialog.");
	}

	async function handleCommand(event: CustomEvent<{ id: string }>) {
		const { id } = event.detail;
		switch (id) {
			case "file:new-project":
				await newProject();
				break;
			case "file:open":
				await openProject();
				break;
			case "file:save":
				await saveProject();
				break;
			case "file:import-assets":
				await importAssets();
				break;
			case "edit:undo":
				await undo();
				break;
			case "edit:redo":
				await redo();
				break;
			case "edit:preferences":
				preferencesOpen = true;
				break;
			case "view:toggle:explorer":
				togglePanel("explorer");
				break;
			case "view:toggle:properties":
				togglePanel("properties");
				break;
			case "view:toggle:console":
				togglePanel("console");
				break;
			case "view:preset:5x3":
				await setPreset("5x3");
				break;
			case "view:preset:5x4":
				await setPreset("5x4");
				break;
			case "tools:reel":
				setTool("reel");
				break;
			case "tools:payline":
				setTool("payline");
				break;
			case "tools:ui":
				setTool("ui");
				break;
			case "tools:bonus":
				setTool("bonus");
				break;
			case "window:save-workspace":
				saveWorkspace();
				break;
			case "window:reset-layout":
				resetWorkspace();
				break;
			case "help:documentation":
				await openDocumentation();
				break;
			case "help:tutorials":
				await openTutorials();
				break;
			case "help:about":
				await showAbout();
				break;
			default:
				appendLog(`Unknown command: ${id}`);
		}
	}

function handleSidebarSelect(event: CustomEvent<{ id: string }>) {
	const { id } = event.detail;
	activeSidebar = id;
	const label = sidebarItems.find((item) => item.id === id)?.label ?? id;
	appendLog(`Selected ${label}.`);
}

function handleCellAssign(event: CustomEvent<{ col: number; row: number; assetPath: string }>) {
	const { col, row, assetPath } = event.detail;
	if (!cellAssignments[row] || cellAssignments[row][col] === undefined) {
		appendLog("Cell assignment ignored: out of bounds.");
		return;
	}
	setCellAssignment(col, row, assetPath);
	appendLog(`Placed ${assetLabel(assetPath)} at column ${col + 1}, row ${row + 1}.`);
	saveWorkspace();
}

function handleConsoleClear() {
	logs = [];
	appendLog("Console cleared.");
}

function handlePreferencesUpdate(event: CustomEvent<{ preferences: Preferences }>) {
	savePreferences(event.detail.preferences);
}

function handlePreferencesClose() {
	preferencesOpen = false;
}

	let autoSaveInterval: number | undefined;

$: if (typeof window !== "undefined") {
	clearInterval(autoSaveInterval);
	if (preferences.autoSave) {
		autoSaveInterval = window.setInterval(() => {
			if (preferences.autoSave) {
				saveWorkspace();
			}
		}, 60_000);
	} else {
		autoSaveInterval = undefined;
	}
}

onDestroy(() => {
	if (typeof window !== "undefined" && autoSaveInterval) {
		clearInterval(autoSaveInterval);
	}
});

	$: if (historyReady && !suspendHistory) {
		const current = snapshot();
		if (!statesEqual(current, previousSnapshot)) {
			undoStack = [...undoStack, previousSnapshot];
			if (undoStack.length > 50) {
				undoStack = undoStack.slice(undoStack.length - 50);
			}
			redoStack = [];
			updateUndoRedoState();
			previousSnapshot = current;
		}
	}

	$: panelVisibility = {
		explorer: showExplorer,
		properties: showProperties,
		console: showConsole
	};
</script>

<div class="ide-layout">
	<TopBar
		{panelVisibility}
		{activePreset}
		{activeTool}
		{canUndo}
		{canRedo}
		spinning={isSpinning}
		on:run={handleRun}
		on:save={handleSave}
		on:command={handleCommand}
	/>

	<div class="main">
		{#if showExplorer}
			<SideBar items={sidebarItems} activeItem={activeSidebar} on:select={handleSidebarSelect} />
		{/if}

		<section class="canvas">
			<div class="canvas-header">
				Slot Preview
			</div>
			<div class="canvas-body">
				<PixiViewer {cols} {rows} {spinSpeed} />
			</div>
		</section>

		{#if showProperties}
			<InspectorPanel bind:cols bind:rows bind:spinSpeed />
		{/if}
	</div>

	{#if showConsole}
		<ConsolePanel {logs} on:clear={handleConsoleClear} />
	{/if}
</div>

<PreferencesModal
	open={preferencesOpen}
	{preferences}
	on:update={handlePreferencesUpdate}
	on:close={handlePreferencesClose}
/>

<style>
.ide-layout {
	display: flex;
	flex-direction: column;
	height: 100vh;
	background-color: #1e1e1e;
	color: #ddd;
	font-family: "Inter", sans-serif;
}

.main {
	display: flex;
	flex: 1;
	overflow: hidden;
}

.canvas {
	flex: 1;
	display: flex;
	flex-direction: column;
	background: #1e1e1e;
}

.canvas-header {
	padding: 0.5rem 1rem;
	border-bottom: 1px solid #333;
	background: #2d2d2d;
	color: #999;
	font-size: 0.9rem;
}

.canvas-body {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
}
</style>
