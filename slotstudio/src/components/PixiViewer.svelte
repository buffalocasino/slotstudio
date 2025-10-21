<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from "svelte";
	import * as PIXI from "pixi.js";

	export let cols = 5;
	export let rows = 3;
	export let symbolSize = 150;
	export let spinSpeed = 0.4;
	export let assignments: (string | null)[][] = [];

	const dispatch = createEventDispatcher<{ assign: { col: number; row: number; assetPath: string } }>();

	let container: HTMLDivElement;
	let app: PIXI.Application | null = null;
	let reels: PIXI.Container[] = [];
	let symbolsTextures: Record<string, PIXI.Texture> = {};
	let tickerFn: ((ticker: PIXI.Ticker) => void) | undefined;
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

	let viewWidth = cols * symbolSize;
	let viewHeight = rows * symbolSize;
	let spinVelocity = spinSpeed * 30;

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
			const delta = ticker.deltaTime;
			reels.forEach((reel) => {
				reel.y += spinVelocity * delta;
				if (reel.y >= symbolSize) {
					reel.y = 0;
					resetReelSymbols(reel);
				}
			});
		};

		application.ticker.add(tickerFn);
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
	}

	function randomSymbolTexture() {
		const keys = Object.keys(symbolsTextures);
		if (!keys.length) return PIXI.Texture.WHITE;
		const randKey = keys[Math.floor(Math.random() * keys.length)];
		return symbolsTextures[randKey];
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
		reels.push(reel);
		app.stage.addChild(reel);
	}

	function resetReelSymbols(reel: PIXI.Container) {
		for (const child of reel.children) {
			const sprite = child as PIXI.Sprite;
			sprite.texture = randomSymbolTexture();
		}
	}

	onDestroy(() => {
		if (app) {
			if (tickerFn) {
				app.ticker.remove(tickerFn);
			}
			app.destroy();
			app = null;
		}
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
</script>

<div class="pixi-container" bind:this={container}>
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
	{/if}
</div>

<style>
.pixi-container {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #1e1e1e;
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
</style>
