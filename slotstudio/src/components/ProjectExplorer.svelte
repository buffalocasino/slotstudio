<script lang="ts">
	import { createEventDispatcher } from "svelte";

	type ToolKey = "reel" | "payline" | "ui" | "bonus";
	type ReelPreset = "5x3" | "5x4";
	type OverlayPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center-bottom";

	type ExplorerItem = {
		id: string;
		label: string;
	};

	type ThemeOption = {
		id: string;
		label: string;
		description?: string;
		preview: string;
	};

	type NearHitOption = {
		id: string;
		label: string;
		description: string;
	};

	type OverlayVariant = { id: string; label: string; description?: string };

	type OverlaySummary = {
		id: string;
		label: string;
		description: string;
		enabled: boolean;
		position: OverlayPosition;
		variant: string;
		variantLabel: string;
		variantDescription?: string;
		allowedPositions: OverlayPosition[];
		variants: OverlayVariant[];
	};

	const DEFAULT_ITEMS: ExplorerItem[] = [
		{ id: "assets", label: "🎨 Assets" },
		{ id: "reels", label: "🧩 Reels" },
		{ id: "configs", label: "⚙️ Configs" },
		{ id: "ui", label: "🪄 UI Elements" }
	];

	const dispatch = createEventDispatcher<{
		select: { id: string };
		importAssets: void;
		removeAsset: { path: string };
		clearAssignments: void;
		setPreset: { preset: ReelPreset };
		setTool: { tool: ToolKey };
		updateTheme: { id: string };
		updateNearHit: { id: string };
		toggleOverlay: { id: string; enabled: boolean };
		updateOverlayPosition: { id: string; position: OverlayPosition };
		updateOverlayVariant: { id: string; variant: string };
	}>();

	export let items: ExplorerItem[] = DEFAULT_ITEMS;
	export let activeItem: string = items[0]?.id ?? "assets";
	export let assets: string[] = [];
	export let assignments: (string | null)[][] = [];
	export let cols = 5;
	export let rows = 3;
	export let activeTool: ToolKey = "reel";
	export let activePreset: ReelPreset = "5x3";
	export let backgroundTheme = "";
	export let availableThemes: ThemeOption[] = [];
	export let nearHit = "";
	export let nearHitOptions: NearHitOption[] = [];
	export let overlays: OverlaySummary[] = [];

	const tools: { id: ToolKey; label: string }[] = [
		{ id: "reel", label: "Reel Tool" },
		{ id: "payline", label: "Payline Tool" },
		{ id: "ui", label: "UI Tool" },
		{ id: "bonus", label: "Bonus Tool" }
	];
	const presets: { id: ReelPreset; label: string }[] = [
		{ id: "5x3", label: "5×3 Layout" },
		{ id: "5x4", label: "5×4 Layout" }
	];

	function assetLabel(path: string) {
		const segments = path.split(/[/\\]/);
		return segments[segments.length - 1] ?? path;
	}

	function toAssetUrl(path: string) {
		return path.startsWith("/") ? path : `/${path}`;
	}

	function handleSelect(id: string) {
		if (id === activeItem) return;
		dispatch("select", { id });
	}

	function handleAssetDrag(event: DragEvent, path: string) {
		if (!event.dataTransfer) return;
		event.dataTransfer.effectAllowed = "copy";
		event.dataTransfer.setData("application/x-slot-asset", JSON.stringify({ assetPath: path }));
		event.dataTransfer.setData("text/plain", assetLabel(path));
	}

	function summarizeAssignments() {
		const summary: Record<string, { count: number }> = {};
		for (let r = 0; r < rows; r += 1) {
			for (let c = 0; c < cols; c += 1) {
				const value = assignments[r]?.[c];
				if (!value) continue;
				if (!summary[value]) summary[value] = { count: 0 };
				summary[value].count += 1;
			}
		}
		return summary;
	}

	$: assetEntries = assets.map((path) => ({
		path,
		label: assetLabel(path),
		url: toAssetUrl(path)
	}));

	$: assignmentSummary = summarizeAssignments();
	$: filledCellCount = Object.values(assignmentSummary).reduce((acc, item) => acc + item.count, 0);

	$: gridRows = Array.from({ length: rows }, (_, row) =>
		Array.from({ length: cols }, (_, col) => {
			const assetPath = assignments[row]?.[col] ?? null;
			return {
				row,
				col,
				assetPath,
				label: assetPath ? assetLabel(assetPath) : null
			};
		})
	);

	function handleThemeChange(id: string) {
		if (id === backgroundTheme) return;
		dispatch("updateTheme", { id });
	}

	function handleNearHitChange(id: string) {
		if (id === nearHit) return;
		dispatch("updateNearHit", { id });
	}

	function handleOverlayToggle(id: string, enabled: boolean) {
		dispatch("toggleOverlay", { id, enabled });
	}

	function handleOverlayPosition(id: string, position: OverlayPosition) {
		dispatch("updateOverlayPosition", { id, position });
	}

	function handleOverlayVariant(id: string, variant: string) {
		dispatch("updateOverlayVariant", { id, variant });
	}

	$: overlayEnabledCount = overlays.filter((overlay) => overlay.enabled).length;
</script>

<div class="explorer">
	<nav class="nav">
		<h3>Project Explorer</h3>
		<ul>
			{#each items as item}
				<li>
					<button
						type="button"
						class:active={item.id === activeItem}
						on:click={() => handleSelect(item.id)}
					>
						{item.label}
					</button>
				</li>
			{/each}
		</ul>
	</nav>

	<section class="content">
		{#if activeItem === "assets"}
			<div class="section-header">
				<h4>Imported Assets</h4>
				<button type="button" on:click={() => dispatch("importAssets")}>Import Assets…</button>
			</div>
			{#if !assetEntries.length}
				<p class="empty">No assets imported yet. Use “Import Assets…” or drop files into the app.</p>
			{:else}
				<ul class="asset-list">
					{#each assetEntries as asset (asset.path)}
						<li>
							<div
								class="asset-entry"
								draggable
								role="button"
								tabindex="0"
								aria-label={`Drag ${asset.label} onto the grid`}
								on:dragstart={(event) => handleAssetDrag(event, asset.path)}
							>
								<div
									class="asset-thumb"
									style={`background-image:url("${asset.url}")`}
								></div>
								<div class="asset-meta">
									<strong>{asset.label}</strong>
									<span>{asset.path}</span>
								</div>
								<button
									type="button"
									class="asset-remove"
									on:click={() => dispatch("removeAsset", { path: asset.path })}
								>
									Remove
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		{:else if activeItem === "reels"}
			<div class="section-header">
				<h4>Reel Assignments</h4>
				<button type="button" on:click={() => dispatch("clearAssignments")}>Clear All</button>
			</div>
			<p class="summary">
				Grid: {cols}×{rows} · Filled cells: {filledCellCount}/{cols * rows}
			</p>
			<div
				class="assignments-grid"
				style={`grid-template-columns: repeat(${cols}, 1fr); grid-template-rows: repeat(${rows}, 1fr);`}
			>
				{#each gridRows as row}
					{#each row as cell (cell.col + cell.row * cols)}
						<div class:occupied={cell.assetPath} class="grid-cell">
							{#if cell.assetPath}
								<span class="primary">{assetLabel(cell.assetPath)}</span>
								<span class="secondary">
									Col {cell.col + 1}, Row {cell.row + 1}
								</span>
							{:else}
								<span class="empty-label">Empty</span>
							{/if}
						</div>
					{/each}
				{/each}
			</div>
			{#if filledCellCount}
				<div class="assignment-breakdown">
					<h5>Usage by Asset</h5>
					<ul>
						{#each Object.entries(assignmentSummary) as [path, info]}
							<li>
								<strong>{assetLabel(path)}</strong> — {info.count} cell{info.count === 1 ? "" : "s"}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{:else if activeItem === "configs"}
			<div class="section-header">
				<h4>Workspace Presets</h4>
			</div>
			<div class="preset-grid">
				{#each presets as preset}
					<button
						type="button"
						class:active={preset.id === activePreset}
						on:click={() => dispatch("setPreset", { preset: preset.id })}
					>
						{preset.label}
					</button>
				{/each}
			</div>
			<div class="section-header">
				<h4>Active Tool</h4>
			</div>
			<div class="tool-grid">
				{#each tools as tool}
					<button
						type="button"
						class:active={tool.id === activeTool}
						on:click={() => dispatch("setTool", { tool: tool.id })}
					>
						{tool.label}
					</button>
				{/each}
			</div>
		{:else}
			<div class="section-header">
				<h4>Theme &amp; Overlays</h4>
				<span class="pill">{overlayEnabledCount} active</span>
			</div>

			<div class="theme-grid">
				{#each availableThemes as theme (theme.id)}
					<button
						type="button"
						class:active={theme.id === backgroundTheme}
						on:click={() => handleThemeChange(theme.id)}
					>
						<span
							class="theme-swatch"
							style={`background:${theme.preview};`}
							aria-hidden="true"
						></span>
						<span class="theme-label">{theme.label}</span>
					</button>
				{/each}
			</div>

			<div class="near-hit-panel">
				<h5>Near-Hit Animation</h5>
				<div class="near-hit-options">
					{#each nearHitOptions as option}
						<button
							type="button"
							class:active={option.id === nearHit}
							on:click={() => handleNearHitChange(option.id)}
						>
							<span class="option-title">{option.label}</span>
							<small>{option.description}</small>
						</button>
					{/each}
				</div>
			</div>

			<div class="overlay-list">
				{#each overlays as overlay (overlay.id)}
					<article class="overlay-card" aria-label={`${overlay.label} overlay`}>
						<header>
							<div class="overlay-title">
								<h5>{overlay.label}</h5>
								<span>{overlay.variantLabel}</span>
							</div>
							<label class="switch">
								<input
									type="checkbox"
									checked={overlay.enabled}
									on:change={(event) =>
										handleOverlayToggle(overlay.id, (event.target as HTMLInputElement).checked)}
								/>
								<span class="slider"></span>
							</label>
						</header>
						{#if overlay.description}
							<p class="overlay-description">{overlay.description}</p>
						{/if}

						<div class="overlay-controls">
							<label>
								<span>Position</span>
								<select
									value={overlay.position}
									on:change={(event) =>
										handleOverlayPosition(
											overlay.id,
											(event.target as HTMLSelectElement).value as OverlayPosition
										)}
								>
									{#each overlay.allowedPositions as position}
										<option value={position}>{position.replace("-", " ")}</option>
									{/each}
								</select>
							</label>
							<label>
								<span>Variant</span>
								<select
									value={overlay.variant}
									on:change={(event) =>
										handleOverlayVariant(overlay.id, (event.target as HTMLSelectElement).value)}
								>
									{#each overlay.variants as variant}
										<option value={variant.id}>{variant.label}</option>
									{/each}
								</select>
							</label>
						</div>
						{#if overlay.variantDescription}
							<p class="variant-hint">{overlay.variantDescription}</p>
						{/if}
					</article>
				{/each}
			</div>
		{/if}
	</section>
</div>

<style>
.explorer {
	display: flex;
	height: 100%;
	background: #252526;
	border-right: none;
}
.nav {
	width: 200px;
	padding: 0.5rem;
	border-right: 1px solid #333;
}
.nav h3 {
	font-size: 0.9rem;
	color: #999;
	margin-bottom: 0.5rem;
}
.nav ul {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}
.nav button {
	width: 100%;
	background: none;
	border: none;
	text-align: left;
	padding: 0.35rem 0.4rem;
	border-radius: 3px;
	color: #ddd;
	cursor: pointer;
	font: inherit;
}
.nav button:hover,
.nav button.active {
	background: #333;
	color: #fff;
}
.content {
	flex: 1;
	padding: 0.75rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	overflow-y: auto;
}
.section-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
}
.section-header h4 {
	margin: 0;
	font-size: 0.9rem;
	color: #bbb;
}
.section-header button {
	background: #3d6af2;
	border: none;
	color: #fff;
	padding: 0.35rem 0.6rem;
	border-radius: 3px;
	cursor: pointer;
	font-size: 0.75rem;
}
.section-header button:hover {
	background: #5079f7;
}
.pill {
	background: rgba(61, 106, 242, 0.2);
	color: #8fa9ff;
	padding: 0.2rem 0.6rem;
	border-radius: 999px;
	font-size: 0.7rem;
	text-transform: uppercase;
	letter-spacing: 0.08em;
}
.theme-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
	gap: 0.6rem;
}
.theme-grid button {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
	align-items: center;
	padding: 0.6rem 0.5rem;
	background: #2d2d2d;
	border: 1px solid #383838;
	border-radius: 8px;
	cursor: pointer;
	color: #ccc;
	font-size: 0.8rem;
}
.theme-grid button.active {
	border-color: #3d6af2;
	box-shadow: 0 0 0 1px rgba(61, 106, 242, 0.35);
	color: #fff;
}
.theme-grid button:hover {
	border-color: #5079f7;
}
.theme-swatch {
	width: 100%;
	height: 54px;
	border-radius: 6px;
	background-size: cover;
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}
.theme-label {
	font-size: 0.75rem;
}
.near-hit-panel {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
	padding: 0.5rem;
	border: 1px solid #333;
	border-radius: 6px;
	background: rgba(0, 0, 0, 0.2);
}
.near-hit-panel h5 {
	margin: 0;
	font-size: 0.8rem;
	color: #bbb;
}
.near-hit-options {
	display: grid;
	gap: 0.35rem;
}
.near-hit-options button {
	padding: 0.45rem 0.6rem;
	border-radius: 4px;
	text-align: left;
	background: #2e2e2e;
	border: 1px solid #3a3a3a;
	color: #ccc;
	font-size: 0.75rem;
	cursor: pointer;
	display: flex;
	flex-direction: column;
	gap: 0.15rem;
}
.near-hit-options button.active {
	border-color: #3d6af2;
	color: #fff;
	background: rgba(61, 106, 242, 0.15);
}
.near-hit-options button:hover {
	border-color: #5079f7;
}
.near-hit-options .option-title {
	font-weight: 600;
}
.near-hit-options small {
	font-size: 0.7rem;
	color: #888;
}
.overlay-list {
	display: grid;
	gap: 0.65rem;
}
.overlay-card {
	border: 1px solid #333;
	border-radius: 8px;
	padding: 0.6rem 0.7rem;
	background: rgba(0, 0, 0, 0.2);
	display: flex;
	flex-direction: column;
	gap: 0.45rem;
}
.overlay-card header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
}
.overlay-title {
	display: flex;
	flex-direction: column;
	gap: 0.15rem;
}
.overlay-title h5 {
	margin: 0;
	font-size: 0.8rem;
	color: #eee;
}
.overlay-title span {
	font-size: 0.7rem;
	color: #8aa2ff;
}
.overlay-description {
	margin: 0;
	font-size: 0.75rem;
	color: #999;
	line-height: 1.4;
}
.overlay-controls {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
	gap: 0.5rem;
}
.overlay-controls label {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	font-size: 0.7rem;
	color: #bbb;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}
.overlay-controls select {
	background: #2e2e2e;
	border: 1px solid #3a3a3a;
	color: #eee;
	border-radius: 4px;
	padding: 0.4rem;
	font-size: 0.8rem;
}
.variant-hint {
	margin: 0;
	font-size: 0.7rem;
	color: #777;
	font-style: italic;
}
.switch {
	position: relative;
	display: inline-flex;
	align-items: center;
	width: 40px;
	height: 22px;
}
.switch input {
	opacity: 0;
	width: 0;
	height: 0;
}
.slider {
	position: absolute;
	cursor: pointer;
	inset: 0;
	background: #3a3a3a;
	border-radius: 999px;
	transition: background 0.2s ease;
}
.slider::before {
	content: "";
	position: absolute;
	height: 16px;
	width: 16px;
	left: 3px;
	top: 3px;
	background: #f5f5f5;
	border-radius: 50%;
	transition: transform 0.2s ease;
}
.switch input:checked + .slider {
	background: #3d6af2;
}
.switch input:checked + .slider::before {
	transform: translateX(18px);
}
.empty {
	font-size: 0.85rem;
	color: #888;
}
.asset-list {
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}
.asset-entry {
	display: grid;
	grid-template-columns: 48px 1fr auto;
	align-items: center;
	gap: 0.75rem;
	background: #2b2b2b;
	border: 1px solid transparent;
	padding: 0.5rem;
	border-radius: 4px;
	cursor: grab;
}
.asset-entry:active {
	cursor: grabbing;
}
.asset-entry:hover {
	border-color: #3d6af2;
}
.asset-thumb {
	width: 48px;
	height: 48px;
	background-size: cover;
	background-position: center;
	border-radius: 3px;
	border: 1px solid #3a3a3a;
}
.asset-meta {
	display: flex;
	flex-direction: column;
	gap: 0.15rem;
}
.asset-meta strong {
	font-size: 0.85rem;
	color: #ddd;
}
.asset-meta span {
	font-size: 0.75rem;
	color: #777;
}
.asset-remove {
	background: none;
	border: 1px solid #444;
	color: #bbb;
	padding: 0.25rem 0.5rem;
	border-radius: 3px;
	cursor: pointer;
	font-size: 0.75rem;
}
.asset-remove:hover {
	border-color: #f25d4d;
	color: #f25d4d;
}
.summary {
	font-size: 0.8rem;
	color: #aaa;
	margin: 0;
}
.assignments-grid {
	display: grid;
	gap: 0.4rem;
}
.grid-cell {
	min-height: 60px;
	border: 1px dashed #3a3a3a;
	border-radius: 4px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	font-size: 0.75rem;
	color: #777;
	padding: 0.35rem;
	background: rgba(0, 0, 0, 0.2);
}
.grid-cell.occupied {
	border-style: solid;
	border-color: #3d6af2;
	color: #ddd;
	background: rgba(61, 106, 242, 0.08);
}
.grid-cell .primary {
	font-weight: 600;
}
.grid-cell .secondary {
	font-size: 0.7rem;
	color: #888;
}
.grid-cell .empty-label {
	font-size: 0.7rem;
	color: #666;
}
.assignment-breakdown h5 {
	margin: 0 0 0.35rem;
	font-size: 0.8rem;
	color: #bbb;
}
.assignment-breakdown ul {
	list-style: none;
	padding: 0;
	margin: 0;
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	font-size: 0.75rem;
	color: #aaa;
}
.preset-grid,
.tool-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
	gap: 0.4rem;
}
.preset-grid button,
.tool-grid button {
	background: #2e2e2e;
	border: 1px solid #3a3a3a;
	color: #ccc;
	padding: 0.4rem 0.5rem;
	border-radius: 3px;
	cursor: pointer;
	font-size: 0.75rem;
	text-align: center;
}
.preset-grid button.active,
.tool-grid button.active {
	border-color: #3d6af2;
	color: #fff;
	background: rgba(61, 106, 242, 0.15);
}
.preset-grid button:hover,
.tool-grid button:hover {
	border-color: #5079f7;
}
</style>
