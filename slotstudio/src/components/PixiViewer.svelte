<script lang="ts">
import { createEventDispatcher, onDestroy, onMount } from "svelte";
import * as PIXI from "pixi.js";

type OverlayPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center-bottom";

type ViewerOverlay = {
	id: string;
	label: string;
	description?: string;
	position: OverlayPosition;
	variant: string;
	variantLabel?: string;
	variantDescription?: string;
};

export let cols = 5;
export let rows = 3;
export let symbolSize = 150;
export let spinSpeed = 0.4;
export let spinning = false;
export let assignments: (string | null)[][] = [];
export let backgroundStyle: string | null = null;
export let overlays: ViewerOverlay[] = [];
export let nearHitAnimation = "pulse";
export let nearHitLabel = "Near Hit";

const dispatch = createEventDispatcher<{ assign: { col: number; row: number; assetPath: string } }>();

let container: HTMLDivElement;
let app: PIXI.Application | null = null;
let reels: PIXI.Container[] = [];
let symbolsTextures: Record<string, PIXI.Texture> = {};
const assetTextureCache = new Map<string, PIXI.Texture>();
let tickerFn: ((ticker: PIXI.Ticker) => void) | undefined;
let tickerAttached = false;
let wasSpinning = false;
let texturesReady = false;
let currentDimensions = "";
let hoveredCell: { col: number; row: number } | null = null;
let cells: Array<{
	col: number;
	row: number;
	assetPath: string | null;
	assetLabel: string | null;
	assetUrl: string | null;
}> = [];
let overlayEntries: Array<
	ViewerOverlay & { positionClass: string; idClass: string; variantClass: string }
> = [];
let nearHitAnimationClass = "";
let containerBackground = "#1e1e1e";

let viewWidth = cols * symbolSize;
let viewHeight = rows * symbolSize;
let spinVelocity = spinSpeed * 30;

const POSITION_CLASS_MAP: Record<OverlayPosition, string> = {
	"top-left": "pos-top-left",
	"top-right": "pos-top-right",
	"bottom-left": "pos-bottom-left",
	"bottom-right": "pos-bottom-right",
	"center-bottom": "pos-center-bottom"
};

function classFriendly(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "") || "value";
}

function overlayPositionClass(position: OverlayPosition) {
	return POSITION_CLASS_MAP[position] ?? POSITION_CLASS_MAP["bottom-right"];
}

function assetLabel(path: string) {
	const segments = path.split(/[/\\]/);
	return segments[segments.length - 1] ?? path;
}

	$: viewWidth = cols * symbolSize;
	$: viewHeight = rows * symbolSize;
	$: spinVelocity = spinSpeed * 30;

	$: if (container) {
		container.style.width = `${viewWidth}px`;
		container.style.height = `${viewHeight}px`;
	}

	$: if (app) {
		app.renderer.resize(viewWidth, viewHeight);
		const canvas = app.canvas;
		canvas.style.width = `${viewWidth}px`;
		canvas.style.height = `${viewHeight}px`;
	}

	onMount(async () => {
		const application = new PIXI.Application();
		await application.init({
			background: "#1e1e1e",
			width: viewWidth,
			height: viewHeight,
			antialias: true
		});
		app = application;
		const canvas = application.canvas;
		canvas.style.position = "absolute";
		canvas.style.top = "0";
		canvas.style.left = "0";
		canvas.style.width = `${viewWidth}px`;
		canvas.style.height = `${viewHeight}px`;
		container.appendChild(canvas);

		try {
			const sheet = await PIXI.Assets.load("/reelicons.json");
			symbolsTextures = sheet.textures;
			texturesReady = true;
		} catch (error) {
			console.error("Failed to load reel textures", error);
		}

		currentDimensions = `${cols}x${rows}`;
		rebuildScene();

		tickerFn = (ticker) => {
			if (!spinning) return;
			const delta = ticker.deltaTime;
			reels.forEach((reel) => {
				reel.y += spinVelocity * delta;
				if (reel.y >= symbolSize) {
					reel.y = 0;
					resetReelSymbols(reel);
				}
			});
		};

		updateTickerState();
	});

	$: if (app && texturesReady) {
		const dims = `${cols}x${rows}`;
		if (dims !== currentDimensions) {
			currentDimensions = dims;
			rebuildScene();
		}
	}

	function rebuildScene() {
		if (!app || !texturesReady) return;
		for (const reel of reels) {
			const children = [...reel.children];
			for (const child of children) {
				reel.removeChild(child);
				(child as PIXI.Sprite).destroy();
			}
			app.stage.removeChild(reel);
			reel.destroy({ children: true });
		}
		reels = [];

		for (let i = 0; i < cols; i += 1) {
			createReel(i);
		}

		refreshAssignments(assignments, cols, rows);
	}

	function randomSymbolTexture() {
		const keys = Object.keys(symbolsTextures);
		if (!keys.length) return PIXI.Texture.WHITE;
		const randKey = keys[Math.floor(Math.random() * keys.length)];
		return symbolsTextures[randKey];
	}

	function assetUrlFromPath(path: string) {
		return path.startsWith("/") ? path : `/${path}`;
	}

	function textureForAssignment(assetPath: string | null) {
		if (!assetPath) {
			return randomSymbolTexture();
		}
		if (!assetTextureCache.has(assetPath)) {
			assetTextureCache.set(assetPath, PIXI.Texture.from(assetUrlFromPath(assetPath)));
		}
		return assetTextureCache.get(assetPath) ?? randomSymbolTexture();
	}

	function createSymbolSprite() {
		const sprite = new PIXI.Sprite(randomSymbolTexture());
		sprite.width = symbolSize - 10;
		sprite.height = symbolSize - 10;
		sprite.x = 5;
		sprite.y = 5;
		return sprite;
	}

	function createReel(xIndex: number) {
		if (!app) return;
		const reel = new PIXI.Container();
		reel.x = xIndex * symbolSize;
		for (let i = 0; i < rows + 1; i += 1) {
			const sym = createSymbolSprite();
			sym.y = i * symbolSize;
			reel.addChild(sym);
		}
		populateReelAssignments(reel, xIndex, assignments, rows);
		reels.push(reel);
		app.stage.addChild(reel);
	}

	function populateReelAssignments(
		reel: PIXI.Container,
		colIndex: number,
		source: (string | null)[][],
		rowCount: number
	) {
		if (!reel.children.length) return;
		const safeRows = Math.max(rowCount, 1);
		for (let i = 0; i < reel.children.length; i += 1) {
			const sprite = reel.children[i] as PIXI.Sprite;
			const rowIndex = i % safeRows;
			const assetPath = source[rowIndex]?.[colIndex] ?? null;
			sprite.texture = textureForAssignment(assetPath);
		}
	}

	function refreshAssignments(
		source: (string | null)[][] = assignments,
		colCount: number = cols,
		rowCount: number = rows
	) {
		if (!texturesReady || !reels.length) return;
		const limit = Math.min(reels.length, colCount);
		for (let col = 0; col < limit; col += 1) {
			populateReelAssignments(reels[col], col, source, rowCount);
		}
	}

	function resetReelSymbols(reel: PIXI.Container) {
		for (const child of reel.children) {
			const sprite = child as PIXI.Sprite;
			sprite.texture = randomSymbolTexture();
		}
	}

	function settleReels() {
		for (const reel of reels) {
			reel.y = 0;
		}
		refreshAssignments(assignments, cols, rows);
	}

	function updateTickerState() {
		if (!app || !tickerFn) return;
		if (spinning) {
			if (!tickerAttached) {
				app.ticker.add(tickerFn);
				tickerAttached = true;
			}
		} else if (tickerAttached || wasSpinning) {
			if (tickerAttached) {
				app.ticker.remove(tickerFn);
				tickerAttached = false;
			}
			settleReels();
		}
		wasSpinning = spinning;
	}

	$: updateTickerState();

	onDestroy(() => {
		if (app) {
			if (tickerFn) {
				app.ticker.remove(tickerFn);
			}
			app.destroy();
			app = null;
		}
		assetTextureCache.clear();
	});

	function parseAssetData(event: DragEvent) {
		const payload = event.dataTransfer?.getData("application/x-slot-asset");
		if (!payload) return null;
		try {
			const parsed = JSON.parse(payload);
			if (parsed && typeof parsed.assetPath === "string") {
				return parsed.assetPath as string;
			}
		} catch (error) {
			console.error("Failed to parse asset payload", error);
		}
		return null;
	}

	function handleDrop(event: DragEvent, col: number, row: number) {
		event.preventDefault();
		const assetPath = parseAssetData(event);
		if (!assetPath) return;
		dispatch("assign", { col, row, assetPath });
		hoveredCell = null;
	}

	function toCellList() {
		const list: typeof cells = [];
		for (let row = 0; row < rows; row += 1) {
			for (let col = 0; col < cols; col += 1) {
				const assetPath = assignments[row]?.[col] ?? null;
				const assetUrl = assetPath ? (assetPath.startsWith("/") ? assetPath : `/${assetPath}`) : null;
				list.push({
					col,
					row,
					assetPath,
					assetLabel: assetPath ? assetLabel(assetPath) : null,
					assetUrl
				});
			}
		}
		return list;
	}

	$: cells = toCellList();

	$: if (texturesReady && !spinning) {
		refreshAssignments(assignments, cols, rows);
	}

	$: containerBackground = backgroundStyle ?? "#1e1e1e";

	$: overlayEntries = (overlays ?? []).map((overlay) => ({
		...overlay,
		positionClass: overlayPositionClass(overlay.position),
		idClass: `overlay-${classFriendly(overlay.id)}`,
		variantClass: `variant-${classFriendly(overlay.variant)}`
	}));

	$: nearHitAnimationClass = classFriendly(nearHitAnimation);
</script>

<div
	class="pixi-container"
	bind:this={container}
	style={`background:${containerBackground};width:${viewWidth}px;height:${viewHeight}px;`}
>
	{#if app}
		<div
			class="grid-overlay"
			role="grid"
			aria-label="Slot grid"
			aria-rowcount={rows}
			aria-colcount={cols}
			style={`width:${viewWidth}px;height:${viewHeight}px;grid-template-columns:repeat(${cols}, 1fr);grid-template-rows:repeat(${rows}, 1fr);`}
		>
			{#each cells as cell (cell.col + cell.row * cols)}
				<div
					class="grid-cell"
					class:hovered={hoveredCell && hoveredCell.col === cell.col && hoveredCell.row === cell.row}
					class:filled={cell.assetPath}
					role="gridcell"
					aria-label={`Cell ${cell.col + 1}, ${cell.row + 1}${cell.assetLabel ? ` - ${cell.assetLabel}` : ""}`}
					tabindex="0"
					on:dragenter={(event) => {
						event.preventDefault();
						hoveredCell = { col: cell.col, row: cell.row };
					}}
					on:dragover={(event) => event.preventDefault()}
					on:dragleave={() => {
						if (hoveredCell && hoveredCell.col === cell.col && hoveredCell.row === cell.row) {
							hoveredCell = null;
						}
					}}
					on:drop={(event) => handleDrop(event, cell.col, cell.row)}
					style={cell.assetUrl ? `background-image:url("${cell.assetUrl}");` : ""}
				>
					{#if cell.assetLabel}
						<span class="cell-label">{cell.assetLabel}</span>
					{:else}
						<span class="cell-placeholder">{cell.col + 1}×{cell.row + 1}</span>
					{/if}
				</div>
			{/each}
		</div>

		<div class="ui-layer" aria-hidden="true">
			<div class={`ui-status near-hit ${nearHitAnimationClass}`}>
				<span class="status-title">Near Hit</span>
				<span class="status-value">{nearHitLabel}</span>
			</div>

			{#each overlayEntries as overlay (overlay.id)}
				<div class={`ui-element ${overlay.positionClass} ${overlay.idClass} ${overlay.variantClass}`}>
					{#if overlay.id === "spin-button"}
						<div class="ui-annotation">
							<span class="title">{overlay.label}</span>
							{#if overlay.variantLabel && overlay.variantLabel !== overlay.label}
								<span class="subtitle">{overlay.variantLabel}</span>
							{/if}
						</div>
						<button type="button" class="ui-spin">
							<span>Spin</span>
						</button>
					{:else if overlay.id === "auto-play-toggle"}
						<div class="ui-annotation">
							<span class="title">{overlay.label}</span>
							{#if overlay.variantLabel && overlay.variantLabel !== overlay.label}
								<span class="subtitle">{overlay.variantLabel}</span>
							{/if}
						</div>
						<div class="ui-toggle">
							<span class="toggle-label">Auto</span>
							<button type="button" class="ui-toggle-switch" aria-label="Toggle auto play">
								<span class="switch-knob"></span>
							</button>
						</div>
					{:else if overlay.id === "balance-display"}
						<div class="ui-annotation">
							<span class="title">{overlay.label}</span>
							{#if overlay.variantLabel && overlay.variantLabel !== overlay.label}
								<span class="subtitle">{overlay.variantLabel}</span>
							{/if}
						</div>
						<div class="ui-balance">
							<div class="row">
								<span class="label">Credits</span>
								<span class="value">12,345</span>
							</div>
							<div class="row">
								<span class="label">Bet</span>
								<span class="value">2.50</span>
							</div>
							<div class="row">
								<span class="label">Win</span>
								<span class="value highlight">150.00</span>
							</div>
						</div>
					{:else if overlay.id === "loading-screen"}
						<div class="ui-annotation">
							<span class="title">{overlay.label}</span>
							{#if overlay.variantLabel && overlay.variantLabel !== overlay.label}
								<span class="subtitle">{overlay.variantLabel}</span>
							{/if}
						</div>
						<div class="ui-loading">
							<span class="loading-text">Loading assets…</span>
							<div class="loading-track">
								<div class="loading-progress"></div>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
.pixi-container {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	background: transparent;
}
:global(canvas) {
	border: 1px solid #333;
	border-radius: 4px;
}
.grid-overlay {
	position: absolute;
	top: 0;
	left: 0;
	display: grid;
	gap: 0;
	pointer-events: none;
}
.grid-cell {
	position: relative;
	border: 1px solid rgba(255, 255, 255, 0.08);
	background-color: rgba(0, 0, 0, 0.25);
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	pointer-events: auto;
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
}
.grid-cell.hovered {
	outline: 2px solid #66bb6a;
	outline-offset: -2px;
}
.grid-cell.filled::after {
	content: "";
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.25);
}
.cell-label {
	position: absolute;
	bottom: 6px;
	left: 6px;
	right: 6px;
	font-size: 0.65rem;
	padding: 2px 4px;
	background: rgba(0, 0, 0, 0.6);
	border-radius: 4px;
	color: #f5f5f5;
	text-align: center;
}
.cell-placeholder {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.35);
}

.ui-layer {
	position: absolute;
	inset: 0;
	pointer-events: none;
}
.ui-status {
	position: absolute;
	top: 1rem;
	left: 50%;
	transform: translateX(-50%);
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.35rem 0.75rem;
	border-radius: 999px;
	background: rgba(0, 0, 0, 0.35);
	backdrop-filter: blur(6px);
	color: #f5f5f5;
	font-size: 0.75rem;
	text-transform: uppercase;
	letter-spacing: 0.08em;
}
.ui-status .status-value {
	font-weight: 600;
}
.ui-status.near-hit.pulse {
	box-shadow: 0 0 12px rgba(102, 187, 106, 0.45);
}
.ui-status.near-hit.spark {
	box-shadow: 0 0 14px rgba(255, 215, 64, 0.45);
}
.ui-status.near-hit.shake {
	box-shadow: 0 0 14px rgba(244, 143, 177, 0.45);
}
.ui-status.near-hit.none {
	box-shadow: none;
	opacity: 0.7;
}

.ui-element {
	position: absolute;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.4rem;
	pointer-events: none;
}
.ui-element :is(button, .ui-toggle, .ui-balance, .ui-loading) {
	pointer-events: auto;
}
.ui-annotation {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.15rem;
	font-size: 0.7rem;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: rgba(255, 255, 255, 0.65);
}
.ui-annotation .subtitle {
	font-size: 0.6rem;
	color: rgba(255, 255, 255, 0.45);
}

.pos-top-left {
	top: 1.5rem;
	left: 1.5rem;
}
.pos-top-right {
	top: 1.5rem;
	right: 1.5rem;
}
.pos-bottom-left {
	bottom: 1.5rem;
	left: 1.5rem;
}
.pos-bottom-right {
	bottom: 1.5rem;
	right: 1.5rem;
}
.pos-center-bottom {
	bottom: 1.75rem;
	left: 50%;
	transform: translateX(-50%);
}

.ui-spin {
	position: relative;
	border: none;
	padding: 0.85rem 2.1rem;
	border-radius: 999px;
	font-size: 1.05rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.12em;
	color: #0b0c16;
	background: linear-gradient(135deg, #f9d423 0%, #ff4e50 100%);
	box-shadow: 0 12px 24px rgba(255, 78, 80, 0.35);
	cursor: pointer;
}
.overlay-spin-button.variant-halo .ui-spin::after {
	content: "";
	position: absolute;
	inset: -14px;
	border-radius: 999px;
	background: radial-gradient(circle, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0) 70%);
	filter: blur(4px);
	z-index: -1;
}
.overlay-spin-button.variant-capsule .ui-spin {
	padding-inline: 2.6rem;
	border-radius: 999px;
	background: linear-gradient(135deg, #42e695 0%, #3bb2b8 100%);
	color: #05253a;
}
.overlay-spin-button.variant-classic .ui-spin {
	background: linear-gradient(135deg, #ff8a00 0%, #ff2d55 90%);
}

.ui-toggle {
	display: inline-flex;
	align-items: center;
	gap: 0.65rem;
	padding: 0.5rem 0.75rem;
	border-radius: 999px;
	background: rgba(0, 0, 0, 0.45);
	backdrop-filter: blur(4px);
	color: #f5f5f5;
	font-size: 0.8rem;
}
.ui-toggle-switch {
	position: relative;
	width: 48px;
	height: 26px;
	border-radius: 999px;
	border: none;
	background: linear-gradient(135deg, #4caf50 0%, #81c784 100%);
	cursor: pointer;
}
.ui-toggle-switch .switch-knob {
	position: absolute;
	top: 3px;
	left: 3px;
	width: 20px;
	height: 20px;
	border-radius: 50%;
	background: #fff;
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
	transition: transform 0.2s ease;
	display: block;
}
.overlay-auto-play-toggle.variant-pill .ui-toggle-switch {
	background: linear-gradient(135deg, #5c6bc0 0%, #9fa8da 100%);
}
.overlay-auto-play-toggle.variant-switch .ui-toggle-switch .switch-knob {
	transform: translateX(22px);
}

.ui-balance {
	min-width: 220px;
	padding: 0.75rem 1rem;
	border-radius: 12px;
	background: rgba(12, 14, 26, 0.65);
	backdrop-filter: blur(8px);
	border: 1px solid rgba(255, 255, 255, 0.08);
	display: grid;
	gap: 0.35rem;
}
.ui-balance .row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 0.8rem;
	color: #e0e0e0;
}
.ui-balance .value {
	font-variant-numeric: tabular-nums;
	font-weight: 600;
}
.ui-balance .highlight {
	color: #66bb6a;
}
.overlay-balance-display.variant-glass .ui-balance {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #f5f5f5;
}

.ui-loading {
	width: clamp(260px, 60vw, 420px);
	padding: 0.75rem 1rem;
	border-radius: 10px;
	background: rgba(0, 0, 0, 0.6);
	backdrop-filter: blur(6px);
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}
.loading-text {
	font-size: 0.75rem;
	color: rgba(255, 255, 255, 0.75);
	text-transform: uppercase;
	letter-spacing: 0.12em;
}
.loading-track {
	width: 100%;
	height: 8px;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.15);
	overflow: hidden;
}
.loading-progress {
	width: 60%;
	height: 100%;
	border-radius: 999px;
	background: linear-gradient(90deg, rgba(255, 255, 255, 0.2), #42a5f5, rgba(255, 255, 255, 0.2));
	animation: loadingPulse 1.4s ease-in-out infinite;
}

@keyframes loadingPulse {
	0% {
		transform: translateX(-40%);
	}
	50% {
		transform: translateX(20%);
	}
	100% {
		transform: translateX(-40%);
	}
}
</style>
