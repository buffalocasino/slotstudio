<script lang="ts">
import { createEventDispatcher } from "svelte";

type PanelKey = "explorer" | "properties" | "console";
type PanelVisibility = Record<PanelKey, boolean>;

type MenuItem =
	| {
			kind: "command";
			id: string;
			label: string;
			shortcut?: string;
			disabled?: boolean;
	  }
	| {
			kind: "toggle";
			id: string;
			label: string;
			panel: PanelKey;
			checked: boolean;
	  }
	| {
			kind: "radio";
			id: string;
			label: string;
			group: string;
			value: string;
			checked: boolean;
	  }
	| { kind: "separator"; id: string };

type MenuConfig = {
	id: string;
	label: string;
	items: MenuItem[];
};

const dispatch = createEventDispatcher<{
	run: void;
	save: void;
	command: { id: string };
}>();

export let panelVisibility: PanelVisibility = {
	explorer: true,
	properties: true,
	console: true
};
export let spinning = false;
export let activePreset: "5x3" | "5x4" = "5x3";
export let activeTool: "reel" | "payline" | "ui" | "bonus" = "reel";
export let canUndo = false;
export let canRedo = false;

let openMenuId: string | null = null;
let viewMenu: MenuConfig | undefined;
let primaryMenus: MenuConfig[] = [];

function onRun() {
	dispatch("run");
}

function onSave() {
	dispatch("save");
}

function toggleMenu(menuId: string) {
	openMenuId = openMenuId === menuId ? null : menuId;
}

function closeMenus() {
	openMenuId = null;
}

function handleItemSelect(item: MenuItem) {
	if (item.kind === "separator") return;
	if (item.kind === "command" && item.disabled) return;
	dispatch("command", { id: item.id });
	closeMenus();
}

function itemRole(item: MenuItem) {
	if (item.kind === "toggle") return "menuitemcheckbox";
	if (item.kind === "radio") return "menuitemradio";
	return "menuitem";
}

function itemAriaChecked(item: MenuItem) {
	if (item.kind === "toggle" || item.kind === "radio") {
		return item.checked;
	}
	return undefined;
}

$: menus = buildMenus();
$: viewMenu = menus.find((menu) => menu.id === "view");
$: primaryMenus = menus.filter((menu) => menu.id !== "view");

function buildMenus(): MenuConfig[] {
	return [
		{
			id: "file",
			label: "File",
			items: [
				{ kind: "command", id: "file:new-project", label: "New Project", shortcut: "Ctrl+Shift+N" },
				{ kind: "command", id: "file:open", label: "Open…", shortcut: "Ctrl+O" },
				{ kind: "command", id: "file:save", label: "Save", shortcut: "Ctrl+S" },
				{ kind: "command", id: "file:import-assets", label: "Import Assets…" }
			]
		},
		{
			id: "edit",
			label: "Edit",
			items: [
				{ kind: "command", id: "edit:undo", label: "Undo", shortcut: "Ctrl+Z", disabled: !canUndo },
				{ kind: "command", id: "edit:redo", label: "Redo", shortcut: "Ctrl+Shift+Z", disabled: !canRedo },
				{ kind: "separator", id: "edit:sep" },
				{ kind: "command", id: "edit:preferences", label: "Preferences…" }
			]
		},
		{
			id: "view",
			label: "View",
			items: [
				{
					kind: "toggle",
					id: "view:toggle:explorer",
					label: "Project Explorer",
					panel: "explorer",
					checked: panelVisibility.explorer
				},
				{
					kind: "toggle",
					id: "view:toggle:properties",
					label: "Properties Panel",
					panel: "properties",
					checked: panelVisibility.properties
				},
				{
					kind: "toggle",
					id: "view:toggle:console",
					label: "Console",
					panel: "console",
					checked: panelVisibility.console
				},
				{ kind: "separator", id: "view:sep" },
				{
					kind: "radio",
					id: "view:preset:5x3",
					label: "Reel Preset · 5x3",
					group: "preset",
					value: "5x3",
					checked: activePreset === "5x3"
				},
				{
					kind: "radio",
					id: "view:preset:5x4",
					label: "Reel Preset · 5x4",
					group: "preset",
					value: "5x4",
					checked: activePreset === "5x4"
				}
			]
		},
		{
			id: "tools",
			label: "Tools",
			items: [
				{
					kind: "radio",
					id: "tools:reel",
					label: "Reel Tool",
					group: "tool",
					value: "reel",
					checked: activeTool === "reel"
				},
				{
					kind: "radio",
					id: "tools:payline",
					label: "Payline Tool",
					group: "tool",
					value: "payline",
					checked: activeTool === "payline"
				},
				{
					kind: "radio",
					id: "tools:ui",
					label: "UI Tool",
					group: "tool",
					value: "ui",
					checked: activeTool === "ui"
				},
				{
					kind: "radio",
					id: "tools:bonus",
					label: "Bonus Editor",
					group: "tool",
					value: "bonus",
					checked: activeTool === "bonus"
				}
			]
		},
		{
			id: "window",
			label: "Window",
			items: [
				{ kind: "command", id: "window:save-workspace", label: "Save Workspace" },
				{ kind: "command", id: "window:reset-layout", label: "Reset Layout" }
			]
		},
		{
			id: "help",
			label: "Help",
			items: [
				{ kind: "command", id: "help:documentation", label: "Documentation" },
				{ kind: "command", id: "help:tutorials", label: "Tutorials" },
				{ kind: "command", id: "help:about", label: "About Slot Studio" }
			]
		}
	];
}
</script>

<svelte:window on:click={closeMenus} />

<header class="topbar">
	<div class="topbar-left">
		<div class="menu">
			{#each primaryMenus as menu}
				<div class="menu-item menu-dropdown">
					<button
						type="button"
						aria-haspopup="true"
						aria-expanded={openMenuId === menu.id}
						on:click|stopPropagation={() => toggleMenu(menu.id)}
					>
						{menu.label}
					</button>
					{#if openMenuId === menu.id}
						<div class="dropdown" role="menu" aria-label={`${menu.label} menu`} tabindex="-1">
							{#each menu.items as item (item.id)}
								{#if item.kind === "separator"}
									<div class="dropdown-separator" role="separator"></div>
								{:else}
									<button
										type="button"
										class="dropdown-item"
										class:active={item.kind !== "command" && item.checked}
										role={itemRole(item)}
										aria-checked={itemAriaChecked(item)}
										on:click={() => handleItemSelect(item)}
										disabled={item.kind === "command" && item.disabled}
									>
										<span class="check">
											{item.kind === "toggle" || item.kind === "radio" ? (item.checked ? "✓" : "") : ""}
										</span>
										<span class="label">{item.label}</span>
										{#if item.kind === "command" && item.shortcut}
											<span class="shortcut">{item.shortcut}</span>
										{/if}
									</button>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<div class="title">🎰 Slot Studio</div>

	<div class="topbar-right">
		<div class="actions">
			<button on:click={onRun} disabled={spinning}>▶ Run</button>
			<button on:click={onSave}>💾 Save</button>
		</div>
		{#if viewMenu}
			<div class="menu-item menu-dropdown view-menu">
				<button
					type="button"
					aria-haspopup="true"
					aria-expanded={openMenuId === viewMenu.id}
					on:click|stopPropagation={() => toggleMenu(viewMenu.id)}
				>
					{viewMenu.label} ▾
				</button>
				{#if openMenuId === viewMenu.id}
					<div class="dropdown" role="menu" aria-label={`${viewMenu.label} menu`} tabindex="-1">
						{#each viewMenu.items as item (item.id)}
							{#if item.kind === "separator"}
								<div class="dropdown-separator" role="separator"></div>
							{:else}
								<button
									type="button"
									class="dropdown-item"
									class:active={item.kind !== "command" && item.checked}
									role={itemRole(item)}
									aria-checked={itemAriaChecked(item)}
									on:click={() => handleItemSelect(item)}
									disabled={item.kind === "command" && item.disabled}
								>
									<span class="check">
										{item.kind === "toggle" || item.kind === "radio" ? (item.checked ? "✓" : "") : ""}
									</span>
									<span class="label">{item.label}</span>
									{#if item.kind === "command" && item.shortcut}
										<span class="shortcut">{item.shortcut}</span>
									{/if}
								</button>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</header>

<style>
.topbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	background: #252526;
	padding: 0 1rem;
	height: 36px;
	border-bottom: 1px solid #333;
	user-select: none;
	gap: 1rem;
}
.topbar-left,
.topbar-right {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}
.menu {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}
.menu-item {
	background: none;
	border: none;
	color: #ccc;
	font: inherit;
	cursor: pointer;
	padding: 0.15rem 0.4rem;
	border-radius: 3px;
	position: relative;
}
.menu-item:hover,
.menu-item:focus-visible {
	color: #fff;
	background: rgba(255, 255, 255, 0.08);
}
.menu-dropdown {
	position: relative;
}
.menu-dropdown > button {
	display: flex;
	align-items: center;
	gap: 0.25rem;
}

.title {
	font-weight: 500;
	color: #bbb;
}
.actions button {
	background: #333;
	border: none;
	color: #ddd;
	margin-left: 0.5rem;
	padding: 0.25rem 0.5rem;
	border-radius: 3px;
	cursor: pointer;
}
.actions button:hover {
	background: #444;
}
.actions button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
.actions {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	margin-right: 0.5rem;
}
.view-menu > button {
	padding: 0.15rem 0.6rem;
}

.dropdown {
	position: absolute;
	top: 100%;
	left: 0;
	background: #2d2d2d;
	border: 1px solid #444;
	border-radius: 4px;
	min-width: 180px;
	padding: 0.25rem 0;
	box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
	z-index: 5;
}
.dropdown-item {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	width: 100%;
	background: none;
	border: none;
	color: #ddd;
	font: inherit;
	cursor: pointer;
	padding: 0.35rem 0.75rem;
	text-align: left;
}
.dropdown-item .check {
	display: inline-block;
	width: 1rem;
	color: #66bb6a;
}
.dropdown-item:hover,
.dropdown-item:focus-visible {
	background: rgba(255, 255, 255, 0.1);
}
.dropdown-item.active .check {
	font-weight: bold;
}
.dropdown-item:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}
.dropdown-item:disabled .label,
.dropdown-item:disabled .shortcut {
	color: #aaa;
}
.dropdown-separator {
	height: 1px;
	background: rgba(255, 255, 255, 0.08);
	margin: 0.25rem 0;
}
.dropdown-item .label {
	flex: 1;
}
.dropdown-item .shortcut {
	font-size: 0.7rem;
	color: #999;
}
</style>
