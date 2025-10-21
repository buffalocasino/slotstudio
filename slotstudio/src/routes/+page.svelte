<script lang="ts">
	import { onMount, onDestroy, tick } from "svelte";
	import { invoke } from "@tauri-apps/api/core";
	import { open as openDialog, save as saveDialog, message, confirm } from "@tauri-apps/plugin-dialog";
	import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
	import { openUrl as openExternal } from "@tauri-apps/plugin-opener";
	import { basename } from "@tauri-apps/api/path";
	import { get } from "svelte/store";
import type { Bonus } from "../lib/engine/types";
import TopBar from "../components/TopBar.svelte";
	import ProjectExplorer from "../components/ProjectExplorer.svelte";
	import InspectorPanel from "../components/InspectorPanel.svelte";
	import ConsolePanel from "../components/ConsolePanel.svelte";
	import PixiViewer from "../components/PixiViewer.svelte";
	import PreferencesModal from "../components/PreferencesModal.svelte";
	import { doSpin, engineRef, setEngineBonuses, setGridSize, setSpeeds } from "../lib/state/slotStore";
	import { FreeSpinsBonus } from "../lib/bonuses/FreeSpinsBonus";
	import { MultiplierBonus } from "../lib/bonuses/MultiplierBonus";

	type PanelKey = "explorer" | "properties" | "console";
	type ToolKey = "reel" | "payline" | "ui" | "bonus";
	type ReelPreset = "5x3" | "5x4";

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

	type LegacyProjectFile = {
		grid: { cols: number; rows: number };
		spinSpeed: number;
		assets: string[];
		tool: ToolKey;
		gridAssignments?: (string | null)[][];
	};

	type OverlayPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center-bottom";

	type UiOverlayState = {
		id: string;
		enabled: boolean;
		position: OverlayPosition;
		variant: string;
	};

	type EconomyState = {
		credits: number;
		bet: number;
		lastWin: number;
		spinCount: number;
	};

	type WorkspaceSnapshot = {
		version: 1;
		project: {
			grid: { cols: number; rows: number };
			spinSpeed: number;
			assignments: (string | null)[][];
			assets: string[];
			activeTool: ToolKey;
			activePreset: ReelPreset;
			ui: {
				backgroundTheme: string;
				overlays: UiOverlayState[];
				nearHitAnimation: string;
			};
			paylines: PaylineDefinition[];
			bonuses: { id: string; enabled: boolean }[];
			economy: EconomyState;
		};
		ui: {
			showExplorer: boolean;
			showProperties: boolean;
			showConsole: boolean;
			activeSidebar: string;
			projectFilePath: string | null;
			logs: string[];
			panelSizes: {
				explorer: number;
				inspector: number;
			};
		};
		preferences: Preferences;
	};

	const WORKSPACE_STORAGE_KEY = "slotstudio:workspace";
	const PREFERENCES_STORAGE_KEY = "slotstudio:preferences";
	const WORKSPACE_FILE_EXTENSION = "slotstudio-workspace.json";
	const MAX_LOG_HISTORY = 200;
	const DEFAULT_EXPLORER_TAB = "assets";
	const EXPLORER_LABELS: Record<string, string> = {
		assets: "🎨 Assets",
		reels: "🧩 Reels",
		configs: "⚙️ Configs",
		ui: "🪄 UI Elements"
	};
	const DEFAULT_GRID = { cols: 5, rows: 3 };
	const DEFAULT_SPIN_SPEED = 0.5;
	const DEFAULT_FALLBACK_ASSIGNMENTS: (string | null)[][] = [];
	const DEFAULT_PREFERENCES: Preferences = {
		theme: "dark",
		autoSave: false,
		confirmOnOverwrite: true
	};
	const DEFAULT_PANEL_SIZES = {
		explorer: 280,
		inspector: 260
	};
	const PANEL_LIMITS = {
		explorer: { min: 200, max: 480 },
		inspector: { min: 200, max: 420 }
	};
	const DEFAULT_ECONOMY: EconomyState = {
		credits: 5000,
		bet: 2.5,
		lastWin: 0,
		spinCount: 0
	};
	const engine = get(engineRef);

	type BackgroundTheme = {
		id: string;
		label: string;
		description: string;
		style: string;
		preview: string;
	};

	type UiOverlayTemplate = {
		id: string;
		label: string;
		description: string;
		defaultEnabled?: boolean;
		defaultPosition: OverlayPosition;
		allowedPositions: OverlayPosition[];
		variants: { id: string; label: string; description?: string }[];
	};

	type NearHitOption = { id: string; label: string; description: string };

const BACKGROUND_THEMES: BackgroundTheme[] = [
		{
			id: "midnight-neon",
			label: "Neon Midnight",
			description: "Deep blues with a magenta glow for dramatic reels.",
			style: "radial-gradient(circle at 20% 20%, #3f3d56 0%, #1a1b2e 55%, #0b0c16 100%)",
			preview: "linear-gradient(135deg, #3f3d56 0%, #1a1b2e 70%)"
		},
		{
			id: "sunset-gold",
			label: "Sunset Gold",
			description: "Warm gradient that highlights bonus triggers and jackpots.",
			style: "linear-gradient(160deg, #ff9966 0%, #ff5e62 50%, #2e1a47 100%)",
			preview: "linear-gradient(160deg, #ff9966 0%, #ff5e62 60%)"
		},
		{
			id: "aurora-glow",
			label: "Aurora Glow",
			description: "Cool greens and violets inspired by northern lights.",
			style: "radial-gradient(circle at center, #5ef1d4 0%, #3567d6 45%, #140f3a 100%)",
			preview: "linear-gradient(160deg, #5ef1d4 0%, #3567d6 60%)"
		},
		{
			id: "desert-dusk",
			label: "Desert Dusk",
			description: "Muted desert tones for western themed slots.",
			style: "linear-gradient(140deg, #f2c482 0%, #ce8f5c 50%, #432818 100%)",
			preview: "linear-gradient(140deg, #f2c482 0%, #ce8f5c 60%)"
		}
	];

	const UI_OVERLAY_TEMPLATES: UiOverlayTemplate[] = [
		{
			id: "spin-button",
			label: "Spin Button",
			description: "Primary call-to-action button for spinning the reels.",
			defaultEnabled: true,
			defaultPosition: "bottom-right",
			allowedPositions: ["bottom-left", "bottom-right", "center-bottom"],
			variants: [
				{ id: "classic", label: "Classic" },
				{ id: "halo", label: "Halo Glow" },
				{ id: "capsule", label: "Capsule" }
			]
		},
		{
			id: "auto-play-toggle",
			label: "Auto-Play Toggle",
			description: "Switch for activating automated spins.",
			defaultEnabled: false,
			defaultPosition: "bottom-left",
			allowedPositions: ["bottom-left", "bottom-right"],
			variants: [
				{ id: "switch", label: "Switch" },
				{ id: "pill", label: "Pill" }
			]
		},
		{
			id: "balance-display",
			label: "Balance Panel",
			description: "Displays credits, bet, and win information.",
			defaultEnabled: true,
			defaultPosition: "top-left",
			allowedPositions: ["top-left", "top-right"],
			variants: [
				{ id: "card", label: "Card" },
				{ id: "glass", label: "Glass" }
			]
		},
		{
			id: "loading-screen",
			label: "Loading Overlay",
			description: "Full screen overlay for loading sequences.",
			defaultEnabled: false,
			defaultPosition: "center-bottom",
			allowedPositions: ["center-bottom"],
			variants: [
				{ id: "progress", label: "Progress Bar" },
				{ id: "spinner", label: "Spinner" }
			]
		}
	];

	const NEAR_HIT_OPTIONS: NearHitOption[] = [
		{ id: "pulse", label: "Pulse", description: "Soft glow pulse around near-win symbols." },
		{ id: "spark", label: "Spark Trail", description: "Quick sparkles that travel across the reel window." },
		{ id: "shake", label: "Shake", description: "Tactile shake mimicking cabinet feedback." },
		{ id: "none", label: "No Animation", description: "Disable near-hit animation previews." }
];

	type PaylineDefinition = {
		id: string;
		name: string;
		pattern: number[];
		color: string;
		enabled: boolean;
	};

	type BonusConfig = {
		id: string;
		label: string;
		description: string;
		enabled: boolean;
	};

	type OverlayConfigRow = {
		id: string;
		label: string;
		description: string;
		enabled: boolean;
		position: OverlayPosition;
		variant: string;
		allowedPositions: OverlayPosition[];
		variants: { id: string; label: string; description?: string }[];
	};

	const DEFAULT_BACKGROUND_THEME = BACKGROUND_THEMES[0]?.id ?? "midnight-neon";
	const DEFAULT_BACKGROUND_STYLE = BACKGROUND_THEMES.find((entry) => entry.id === DEFAULT_BACKGROUND_THEME)?.style ?? "#1e1e1e";
	const DEFAULT_NEAR_HIT = NEAR_HIT_OPTIONS[0]?.id ?? "pulse";
	const PAYLINE_COLORS = ["#ff6b6b", "#4caf50", "#42a5f5", "#ffca28", "#ab47bc"];

	type BonusFactory = () => Bonus;

	const BONUS_LIBRARY: Array<BonusConfig & { factory: BonusFactory }> = [
		{
			id: "free-spins",
			label: "Free Spins",
			description: "Awards a batch of free spins when scatter symbols appear.",
			enabled: true,
			factory: () => new FreeSpinsBonus()
		},
		{
			id: "win-multiplier",
			label: "Win Multiplier",
			description: "Increases payouts via a multiplier chain.",
			enabled: true,
			factory: () => new MultiplierBonus()
		}
	];

	let cols = DEFAULT_GRID.cols;
	let rows = DEFAULT_GRID.rows;
	let spinSpeed = DEFAULT_SPIN_SPEED;

let importedAssets: string[] = [];
let backgroundTheme = DEFAULT_BACKGROUND_THEME;
let uiOverlays: UiOverlayState[] = ensureOverlayDefaults();
let nearHitAnimation = DEFAULT_NEAR_HIT;
let nearHitLabel = NEAR_HIT_OPTIONS.find((option) => option.id === nearHitAnimation)?.label ?? "Near Hit";
let paylines: PaylineDefinition[] = createDefaultPaylines(rows, cols);
let bonusConfigs: BonusConfig[] = BONUS_LIBRARY.map(({ id, label, description, enabled }) => ({
	id,
	label,
	description,
	enabled
}));
let overlaySummaries: Array<
	UiOverlayState & {
		label: string;
		description: string;
		variantLabel: string;
		variantDescription?: string;
		allowedPositions: OverlayPosition[];
		variants: { id: string; label: string; description?: string }[];
	}
> = [];
let activeOverlaySummaries: typeof overlaySummaries = [];
let viewerBackgroundStyle = resolveThemeStyle(backgroundTheme);
	let credits = DEFAULT_ECONOMY.credits;
	let betAmount = DEFAULT_ECONOMY.bet;
	let lastWinAmount = DEFAULT_ECONOMY.lastWin;
	let totalSpins = DEFAULT_ECONOMY.spinCount;

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

	function explorerLabel(id: string) {
		return EXPLORER_LABELS[id] ?? id;
	}

	let activeSidebar = DEFAULT_EXPLORER_TAB;
	let showExplorer = true;
	let showProperties = true;
	let showConsole = true;
	let isSpinning = false;
let activeTool: ToolKey = "reel";
	let activePreset: ReelPreset = "5x3";
	let projectFilePath: string | null = null;
	let preferences: Preferences = { ...DEFAULT_PREFERENCES };
	let preferencesOpen = false;
	let explorerWidth = DEFAULT_PANEL_SIZES.explorer;
	let inspectorWidth = DEFAULT_PANEL_SIZES.inspector;

type CellAssignment = string | null;
let cellAssignments: CellAssignment[][] = [];
	let lastAppliedGrid = { ...engine.config.grid };
	let lastAppliedSpinSpeed = engine.config.spinSpeed;

function createAssignmentGrid(
	targetRows: number,
	targetCols: number,
	previous: CellAssignment[][] = cellAssignments
): CellAssignment[][] {
	return Array.from({ length: targetRows }, (_, row) =>
		Array.from({ length: targetCols }, (_, col) => previous[row]?.[col] ?? null)
	);
}

	function clampPanelSize(value: unknown, panel: "explorer" | "inspector") {
		const limits = PANEL_LIMITS[panel];
		const fallback = DEFAULT_PANEL_SIZES[panel];
		const numeric = typeof value === "number" ? value : Number(value);
		if (!Number.isFinite(numeric)) return fallback;
		return Math.min(Math.max(numeric, limits.min), limits.max);
	}

	function normalizeBackgroundTheme(theme: unknown) {
		const candidate = typeof theme === "string" ? theme : DEFAULT_BACKGROUND_THEME;
		return BACKGROUND_THEMES.some((entry) => entry.id === candidate) ? candidate : DEFAULT_BACKGROUND_THEME;
	}

	function normalizeNearHit(option: unknown) {
		const candidate = typeof option === "string" ? option : DEFAULT_NEAR_HIT;
		return NEAR_HIT_OPTIONS.some((entry) => entry.id === candidate) ? candidate : DEFAULT_NEAR_HIT;
	}

	function normalizeBonusStates(source: unknown): BonusConfig[] {
		const list = Array.isArray(source) ? (source as Array<{ id?: string; enabled?: boolean }>) : [];
		return BONUS_LIBRARY.map(({ id, label, description, enabled }) => {
			const match = list.find((entry) => entry?.id === id);
			return {
				id,
				label,
				description,
				enabled: match?.enabled ?? enabled
			};
		});
	}

	function instantiateEnabledBonuses(configs: BonusConfig[]) {
		return configs
			.filter((config) => config.enabled)
			.map((config) => {
				const entry = BONUS_LIBRARY.find((bonus) => bonus.id === config.id);
				return entry?.factory();
			})
			.filter((bonus): bonus is Bonus => Boolean(bonus));
	}

	function resolveOverlayTemplate(id: string) {
		return UI_OVERLAY_TEMPLATES.find((template) => template.id === id);
	}

	function resolveThemeStyle(themeId: string) {
		const theme = BACKGROUND_THEMES.find((entry) => entry.id === themeId);
		return theme?.style ?? DEFAULT_BACKGROUND_STYLE;
	}

	function normalizeEconomy(state?: Partial<EconomyState> | null): EconomyState {
		const credits = Number(state?.credits);
		const bet = Number(state?.bet);
		const lastWin = Number(state?.lastWin);
		const spinCount = Number(state?.spinCount);
		return {
			credits: Number.isFinite(credits) && credits >= 0 ? credits : DEFAULT_ECONOMY.credits,
			bet: Number.isFinite(bet) && bet > 0 ? bet : DEFAULT_ECONOMY.bet,
			lastWin: Number.isFinite(lastWin) && lastWin >= 0 ? lastWin : DEFAULT_ECONOMY.lastWin,
			spinCount: Number.isFinite(spinCount) && spinCount >= 0 ? Math.floor(spinCount) : DEFAULT_ECONOMY.spinCount
		};
	}

	function ensureOverlayDefaults(source: UiOverlayState[] = []): UiOverlayState[] {
		return UI_OVERLAY_TEMPLATES.map((template) => {
			const existing = source.find((entry) => entry.id === template.id);
			const allowedPositions = template.allowedPositions.length ? template.allowedPositions : [template.defaultPosition];
			const variants = template.variants.length
				? template.variants
				: [{ id: "default", label: "Default" }];
			const fallbackVariant = variants[0]?.id ?? "default";
			return {
				id: template.id,
				enabled: existing?.enabled ?? template.defaultEnabled ?? false,
				position: allowedPositions.includes(existing?.position as OverlayPosition)
					? (existing?.position as OverlayPosition)
					: template.defaultPosition,
				variant: variants.some((variant) => variant.id === existing?.variant)
					? (existing?.variant ?? fallbackVariant)
					: fallbackVariant
			};
		});
	}

	function clampPattern(pattern: number[], rows: number, cols: number): number[] {
		const safePattern = pattern.length ? pattern : [0];
		const maxRow = Math.max(rows - 1, 0);
		return Array.from({ length: cols }, (_, index) => {
			const value = safePattern[Math.min(index, safePattern.length - 1)];
			if (!Number.isFinite(value)) return 0;
			return Math.min(Math.max(Math.floor(value), 0), maxRow);
		});
	}

	function createDefaultPaylines(totalRows: number, totalCols: number): PaylineDefinition[] {
		const top = 0;
		const bottom = Math.max(totalRows - 1, 0);
		const middle = Math.min(Math.max(Math.floor(totalRows / 2), 0), bottom);

		const vPattern = Array.from({ length: totalCols }, (_, index) => {
			const progress = totalCols <= 1 ? 0 : index / (totalCols - 1);
			const mirrored = progress <= 0.5 ? progress : 1 - progress;
			const span = Math.max(bottom - top, 0);
			return Math.round(top + mirrored * span);
		});

		const zigzagPattern = Array.from({ length: totalCols }, (_, index) =>
			index % 2 === 0 ? top : bottom
		);

		const presets = [
			{ name: "Center Line", pattern: Array(totalCols).fill(middle) },
			{ name: "Top Line", pattern: Array(totalCols).fill(top) },
			{ name: "Bottom Line", pattern: Array(totalCols).fill(bottom) },
			{ name: "V Pattern", pattern: vPattern },
			{ name: "Zigzag", pattern: zigzagPattern }
		];

		return presets.map((preset, index) => ({
			id: `payline-${index + 1}`,
			name: preset.name,
			pattern: clampPattern(preset.pattern, totalRows, totalCols),
			color: PAYLINE_COLORS[index % PAYLINE_COLORS.length],
			enabled: index === 0
		}));
	}

	function normalizePaylines(definitions: PaylineDefinition[], rows: number, cols: number): PaylineDefinition[] {
		return definitions.map((definition, index) => ({
			...definition,
			id: definition.id ?? `payline-${index + 1}`,
			name: definition.name || `Payline ${index + 1}`,
			pattern: clampPattern(definition.pattern, rows, cols),
			color: definition.color || PAYLINE_COLORS[index % PAYLINE_COLORS.length],
			enabled: definition.enabled ?? true
		}));
	}

	function createBlankPayline(index: number, rows: number, cols: number): PaylineDefinition {
		const centerRow = Math.min(Math.max(Math.floor(rows / 2), 0), Math.max(rows - 1, 0));
		return {
			id: `payline-${Date.now()}-${index}`,
			name: `Payline ${index}`,
			pattern: clampPattern(Array(cols).fill(centerRow), rows, cols),
			color: PAYLINE_COLORS[index % PAYLINE_COLORS.length],
			enabled: true
		};
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

	$: {
		const normalizedCols = Math.max(1, Math.floor(Number(cols) || DEFAULT_GRID.cols));
		const normalizedRows = Math.max(1, Math.floor(Number(rows) || DEFAULT_GRID.rows));
		if (normalizedCols !== cols) cols = normalizedCols;
		if (normalizedRows !== rows) rows = normalizedRows;
		if (normalizedCols !== lastAppliedGrid.cols || normalizedRows !== lastAppliedGrid.rows) {
			setGridSize({ cols: normalizedCols, rows: normalizedRows });
			lastAppliedGrid = { cols: normalizedCols, rows: normalizedRows };
		}
	}

	$: {
		const normalizedSpin = Math.max(0.1, Math.min(2, Number(spinSpeed) || DEFAULT_SPIN_SPEED));
		if (normalizedSpin !== spinSpeed) {
			spinSpeed = normalizedSpin;
		}
		if (Math.abs(normalizedSpin - lastAppliedSpinSpeed) > 0.0001) {
			setSpeeds({ spin: normalizedSpin });
			lastAppliedSpinSpeed = normalizedSpin;
		}
	}

	$: setEngineBonuses(instantiateEnabledBonuses(bonusConfigs));

	$: viewerBackgroundStyle = resolveThemeStyle(backgroundTheme);

	$: overlaySummaries = uiOverlays.map((overlay) => {
		const template = resolveOverlayTemplate(overlay.id);
		const variantMeta = template?.variants.find((variant) => variant.id === overlay.variant);
		return {
			...overlay,
			label: template?.label ?? overlay.id,
			description: template?.description ?? "",
			variantLabel: variantMeta?.label ?? overlay.variant,
			variantDescription: variantMeta?.description
		};
	});

	$: activeOverlaySummaries = overlaySummaries.filter((overlay) => overlay.enabled);

	$: nearHitLabel =
		NEAR_HIT_OPTIONS.find((option) => option.id === nearHitAnimation)?.label ?? "Near Hit";

	$: {
		const normalizedCredits = Math.max(0, Number(credits) || 0);
		if (normalizedCredits !== credits) {
			credits = normalizedCredits;
		}
		const normalizedBet = Math.max(0.1, Number(betAmount) || DEFAULT_ECONOMY.bet);
		if (Math.abs(normalizedBet - betAmount) > 0.0001) {
			betAmount = normalizedBet;
		}
		const normalizedLastWin = Math.max(0, Number(lastWinAmount) || 0);
		if (normalizedLastWin !== lastWinAmount) {
			lastWinAmount = normalizedLastWin;
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

	function makeInitialLogs(): string[] {
		return [formatLog("Slot Studio initialized"), formatLog("Ready to roll...")];
	}

	let logs: string[] = makeInitialLogs();

	function appendLog(message: string) {
		const next = [...logs, formatLog(message)];
		logs = next.slice(-MAX_LOG_HISTORY);
	}

	function determinePreset(currentCols: number, currentRows: number): ReelPreset {
		if (currentCols === 5 && currentRows === 4) return "5x4";
		return "5x3";
	}

	function createWorkspaceSnapshot(options: { includeFilePath?: boolean } = {}): WorkspaceSnapshot {
		const { includeFilePath = true } = options;
		return {
			version: 1,
			project: {
				grid: { cols, rows },
				spinSpeed,
			assignments: cellAssignments.map((row) => [...row]),
			assets: [...importedAssets],
			activeTool,
			activePreset,
			ui: {
				backgroundTheme,
				overlays: uiOverlays.map((overlay) => ({ ...overlay })),
				nearHitAnimation
			},
			paylines: paylines.map((payline) => ({ ...payline })),
			bonuses: bonusConfigs.map(({ id, enabled }) => ({ id, enabled })),
			economy: {
				credits,
				bet: betAmount,
				lastWin: lastWinAmount,
				spinCount: totalSpins
			}
		},
		ui: {
			showExplorer,
			showProperties,
			showConsole,
			activeSidebar,
			projectFilePath: includeFilePath ? projectFilePath : null,
			logs: logs.slice(-MAX_LOG_HISTORY),
			panelSizes: {
				explorer: explorerWidth,
				inspector: inspectorWidth
			}
		},
		preferences: { ...preferences }
	};
	}

	function defaultWorkspaceSnapshot(): WorkspaceSnapshot {
		const baseGrid = { ...DEFAULT_GRID };
		return {
			version: 1,
			project: {
				grid: { ...baseGrid },
				spinSpeed: DEFAULT_SPIN_SPEED,
				assignments: createAssignmentGrid(baseGrid.rows, baseGrid.cols, []),
				assets: [],
				activeTool: "reel",
				activePreset: determinePreset(baseGrid.cols, baseGrid.rows),
				ui: {
					backgroundTheme: DEFAULT_BACKGROUND_THEME,
					overlays: ensureOverlayDefaults(),
					nearHitAnimation: DEFAULT_NEAR_HIT
				},
				paylines: createDefaultPaylines(baseGrid.rows, baseGrid.cols),
				bonuses: BONUS_LIBRARY.map(({ id, enabled }) => ({ id, enabled })),
				economy: { ...DEFAULT_ECONOMY }
			},
			ui: {
				showExplorer: true,
				showProperties: true,
				showConsole: true,
				activeSidebar: DEFAULT_EXPLORER_TAB,
				projectFilePath: null,
				logs: makeInitialLogs(),
				panelSizes: { ...DEFAULT_PANEL_SIZES }
			},
			preferences: { ...DEFAULT_PREFERENCES }
		};
	}

	function normalizeAssignments(
		source: (string | null)[][] | undefined,
		targetRows: number,
		targetCols: number
	): (string | null)[][] {
		return createAssignmentGrid(
			targetRows,
			targetCols,
			Array.isArray(source) ? (source as CellAssignment[][]) : DEFAULT_FALLBACK_ASSIGNMENTS
		);
	}

	function coerceWorkspaceSnapshot(value: unknown): { snapshot: WorkspaceSnapshot; filePath: string | null } | null {
		if (!value || typeof value !== "object") return null;

		if ("version" in (value as Record<string, unknown>)) {
			const incoming = value as WorkspaceSnapshot;
			const gridCols = incoming.project?.grid?.cols ?? DEFAULT_GRID.cols;
			const gridRows = incoming.project?.grid?.rows ?? DEFAULT_GRID.rows;
			const normalizedGrid = {
				cols: typeof gridCols === "number" && gridCols > 0 ? gridCols : DEFAULT_GRID.cols,
				rows: typeof gridRows === "number" && gridRows > 0 ? gridRows : DEFAULT_GRID.rows
			};
			const normalizedOverlays = ensureOverlayDefaults(
				Array.isArray(incoming.project?.ui?.overlays)
					? (incoming.project.ui.overlays as UiOverlayState[])
					: []
			);
			const normalizedPaylines = normalizePaylines(
				Array.isArray(incoming.project?.paylines)
					? (incoming.project.paylines as PaylineDefinition[])
					: createDefaultPaylines(normalizedGrid.rows, normalizedGrid.cols),
				normalizedGrid.rows,
				normalizedGrid.cols
			);
			const normalizedBonuses = normalizeBonusStates(incoming.project?.bonuses);
			return {
				snapshot: {
					version: 1,
					project: {
						grid: normalizedGrid,
						spinSpeed:
							typeof incoming.project?.spinSpeed === "number" ? incoming.project.spinSpeed : DEFAULT_SPIN_SPEED,
						assignments: normalizeAssignments(incoming.project?.assignments, normalizedGrid.rows, normalizedGrid.cols),
						assets: Array.isArray(incoming.project?.assets) ? [...incoming.project.assets] : [],
						activeTool: incoming.project?.activeTool ?? "reel",
						activePreset: incoming.project?.activePreset ?? determinePreset(normalizedGrid.cols, normalizedGrid.rows),
						ui: {
							backgroundTheme: normalizeBackgroundTheme(incoming.project?.ui?.backgroundTheme),
							overlays: normalizedOverlays,
							nearHitAnimation: normalizeNearHit(incoming.project?.ui?.nearHitAnimation)
						},
						paylines: normalizedPaylines,
						bonuses: normalizedBonuses.map(({ id, enabled }) => ({ id, enabled })),
						economy: normalizeEconomy(incoming.project?.economy)
					},
					ui: {
						showExplorer: incoming.ui?.showExplorer ?? true,
						showProperties: incoming.ui?.showProperties ?? true,
						showConsole: incoming.ui?.showConsole ?? true,
						activeSidebar: incoming.ui?.activeSidebar ?? DEFAULT_EXPLORER_TAB,
						projectFilePath: incoming.ui?.projectFilePath ?? null,
						logs: Array.isArray(incoming.ui?.logs) ? [...incoming.ui.logs].slice(-MAX_LOG_HISTORY) : makeInitialLogs(),
						panelSizes: {
							explorer: clampPanelSize(incoming.ui?.panelSizes?.explorer, "explorer"),
							inspector: clampPanelSize(incoming.ui?.panelSizes?.inspector, "inspector")
						}
					},
					preferences: incoming.preferences
						? { ...DEFAULT_PREFERENCES, ...incoming.preferences }
						: { ...DEFAULT_PREFERENCES }
				},
				filePath: incoming.ui?.projectFilePath ?? null
			};
		}

		const legacy = value as Partial<LegacyProjectFile> & {
			showExplorer?: boolean;
			showProperties?: boolean;
			showConsole?: boolean;
			cols?: number;
			rows?: number;
			spinSpeed?: number;
			assets?: string[];
			tool?: ToolKey;
			projectFilePath?: string | null;
			assignments?: (string | null)[][];
			activeSidebar?: string;
			logs?: string[];
		};

		const legacyCols = typeof legacy.cols === "number" ? legacy.cols : legacy.grid?.cols ?? DEFAULT_GRID.cols;
		const legacyRows = typeof legacy.rows === "number" ? legacy.rows : legacy.grid?.rows ?? DEFAULT_GRID.rows;

	const normalizedSnapshot: WorkspaceSnapshot = {
		version: 1,
		project: {
			grid: { cols: legacyCols, rows: legacyRows },
			spinSpeed: typeof legacy.spinSpeed === "number" ? legacy.spinSpeed : DEFAULT_SPIN_SPEED,
			assignments: normalizeAssignments(legacy.assignments, legacyRows, legacyCols),
			assets: Array.isArray(legacy.assets) ? [...legacy.assets] : [],
			activeTool: legacy.tool ?? "reel",
			activePreset: determinePreset(legacyCols, legacyRows),
			ui: {
				backgroundTheme: normalizeBackgroundTheme((legacy as { backgroundTheme?: string }).backgroundTheme),
				overlays: ensureOverlayDefaults(),
				nearHitAnimation: normalizeNearHit((legacy as { nearHitAnimation?: string }).nearHitAnimation)
			},
			paylines: createDefaultPaylines(legacyRows, legacyCols),
			bonuses: normalizeBonusStates((legacy as { bonuses?: { id?: string; enabled?: boolean }[] }).bonuses).map(
				({ id, enabled }) => ({ id, enabled })
			),
			economy: normalizeEconomy((legacy as { economy?: Partial<EconomyState> }).economy)
		},
			ui: {
				showExplorer: legacy.showExplorer ?? true,
				showProperties: legacy.showProperties ?? true,
				showConsole: legacy.showConsole ?? true,
				activeSidebar: legacy.activeSidebar ?? DEFAULT_EXPLORER_TAB,
				projectFilePath: legacy.projectFilePath ?? null,
				logs: Array.isArray(legacy.logs) ? [...legacy.logs].slice(-MAX_LOG_HISTORY) : makeInitialLogs(),
				panelSizes: {
					explorer: clampPanelSize((legacy as { panelSizes?: { explorer?: number } })?.panelSizes?.explorer, "explorer"),
					inspector: clampPanelSize((legacy as { panelSizes?: { inspector?: number } })?.panelSizes?.inspector, "inspector")
				}
			},
			preferences: { ...DEFAULT_PREFERENCES }
		};

		return { snapshot: normalizedSnapshot, filePath: legacy.projectFilePath ?? null };
	}

	function applyWorkspaceSnapshot(
		workspace: WorkspaceSnapshot,
		options: { filePath?: string | null; resetHistory?: boolean } = {}
	) {
		const { filePath = workspace.ui.projectFilePath ?? null, resetHistory = true } = options;
		suspendHistory = true;
		showExplorer = workspace.ui.showExplorer ?? true;
		showProperties = workspace.ui.showProperties ?? true;
		showConsole = workspace.ui.showConsole ?? true;
		activeSidebar = workspace.ui.activeSidebar ?? DEFAULT_EXPLORER_TAB;
		preferences = { ...DEFAULT_PREFERENCES, ...workspace.preferences };
		explorerWidth = clampPanelSize(workspace.ui.panelSizes?.explorer, "explorer");
		inspectorWidth = clampPanelSize(workspace.ui.panelSizes?.inspector, "inspector");

		const nextCols = workspace.project.grid?.cols ?? DEFAULT_GRID.cols;
		const nextRows = workspace.project.grid?.rows ?? DEFAULT_GRID.rows;

		cols = nextCols;
		rows = nextRows;
		spinSpeed = workspace.project.spinSpeed ?? DEFAULT_SPIN_SPEED;
		activeTool = workspace.project.activeTool ?? "reel";
		activePreset = workspace.project.activePreset ?? determinePreset(nextCols, nextRows);
		importedAssets = Array.isArray(workspace.project.assets) ? [...workspace.project.assets] : [];
		cellAssignments = createAssignmentGrid(nextRows, nextCols, workspace.project.assignments);
		backgroundTheme = normalizeBackgroundTheme(workspace.project.ui?.backgroundTheme);
		uiOverlays = ensureOverlayDefaults(workspace.project.ui?.overlays ?? []);
		nearHitAnimation = normalizeNearHit(workspace.project.ui?.nearHitAnimation);
		paylines = normalizePaylines(
			Array.isArray(workspace.project.paylines)
				? workspace.project.paylines
				: createDefaultPaylines(nextRows, nextCols),
			nextRows,
			nextCols
		);
		bonusConfigs = normalizeBonusStates(workspace.project.bonuses);
		setEngineBonuses(instantiateEnabledBonuses(bonusConfigs));
		const economy = normalizeEconomy(workspace.project.economy);
		credits = economy.credits;
		betAmount = economy.bet;
		lastWinAmount = economy.lastWin;
		totalSpins = economy.spinCount;

		logs = workspace.ui.logs?.length ? [...workspace.ui.logs].slice(-MAX_LOG_HISTORY) : makeInitialLogs();
		projectFilePath = filePath;

		if (resetHistory) {
			undoStack = [];
			redoStack = [];
			updateUndoRedoState();
		}
		previousSnapshot = snapshot();
		suspendHistory = false;
	}

	function loadWorkspaceFromStorage() {
		try {
			const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			const normalized = coerceWorkspaceSnapshot(parsed);
			if (!normalized) return;
			applyWorkspaceSnapshot(normalized.snapshot, { filePath: normalized.filePath ?? null });
			appendLog("Workspace layout restored.");
		} catch (error) {
			console.error(error);
			appendLog("Failed to load workspace settings.");
		}
	}

	function saveWorkspace(options: { silent?: boolean } = {}) {
		const { silent = false } = options;
		try {
			const snapshot = createWorkspaceSnapshot();
			localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
			if (!silent) appendLog("Workspace saved.");
		} catch (error) {
			console.error(error);
			if (!silent) appendLog("Failed to save workspace.");
		}
	}

	onMount(() => {
		loadWorkspaceFromStorage();
		loadPreferences();
		previousSnapshot = snapshot();
		historyReady = true;
		applyTheme(preferences.theme);
	});

	function resetWorkspace() {
		applyWorkspaceSnapshot(defaultWorkspaceSnapshot(), { filePath: projectFilePath ?? null });
		appendLog("Workspace layout reset.");
		saveWorkspace({ silent: true });
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
		if (betAmount > credits) {
			appendLog("Spin blocked: insufficient credits.");
			return;
		}
		isSpinning = true;
		const wager = betAmount;
		credits = Math.max(0, credits - wager);
		appendLog(`Executing spin (bet ${wager.toFixed(2)}).`);
		try {
			const result = await doSpin();
			totalSpins += 1;
			const totalWin = result.wins.reduce((acc, win) => acc + win.payout, 0);
			lastWinAmount = totalWin;
			if (totalWin > 0) {
				credits += totalWin;
			}
			if (result.wins.length) {
				appendLog(`Spin complete with ${result.wins.length} win${result.wins.length === 1 ? "" : "s"} totalling ${totalWin.toFixed(2)}.`);
				result.wins.forEach((win, index) => {
					appendLog(`Win ${index + 1}: ${win.cells.length} symbols, payout ${win.payout}.`);
				});
				if (result.cascades > 0) {
					appendLog(`Cascades triggered: ${result.cascades}.`);
				}
			} else {
				appendLog("Spin complete with no wins.");
			}
			appendLog(`Balance: ${credits.toFixed(2)} credits after ${totalSpins} spin${totalSpins === 1 ? "" : "s"}.`);
		} catch (error) {
			const messageText = error instanceof Error ? error.message : "Unknown error";
			appendLog(`Spin failed: ${messageText}`);
			console.error(error);
		} finally {
			isSpinning = false;
			saveWorkspace({ silent: true });
		}
	}

	async function newProject() {
		suspendHistory = true;
		applyWorkspaceSnapshot(defaultWorkspaceSnapshot(), { filePath: null });
		await tick();
		previousSnapshot = snapshot();
		suspendHistory = false;
		appendLog("Created new project template.");
		saveWorkspace({ silent: true });
	}

	async function openProject() {
		try {
			const selection = await openDialog({
				title: "Open Slot Studio Workspace",
				filters: [{ name: "Slot Studio Workspace", extensions: ["json"] }]
			});
			if (!selection || Array.isArray(selection)) return;

			const contents = await readTextFile(selection);
			const parsed = JSON.parse(contents);
			const normalized = coerceWorkspaceSnapshot(parsed);
			if (!normalized) {
				throw new Error("Invalid workspace file format.");
			}

			suspendHistory = true;
			applyWorkspaceSnapshot(normalized.snapshot, { filePath: selection });
			await tick();
			previousSnapshot = snapshot();
			suspendHistory = false;
			appendLog(`Opened workspace: ${await basename(selection)}`);
			saveWorkspace({ silent: true });
		} catch (error) {
			if (error instanceof Error && error.message.includes("Invalid workspace file")) {
				await message(error.message, { title: "Slot Studio", kind: "error" });
			} else if (error) {
				console.error(error);
				appendLog("Workspace open cancelled or failed.");
			}
		}
	}

async function saveProject() {
	try {
		let targetPath = projectFilePath;
		if (!targetPath) {
			targetPath = await saveDialog({
				title: "Save Slot Studio Workspace",
				defaultPath: WORKSPACE_FILE_EXTENSION,
				filters: [{ name: "Slot Studio Workspace", extensions: ["json"] }]
			});
			if (!targetPath) return;
			projectFilePath = targetPath;
		} else if (preferences.confirmOnOverwrite) {
			const confirmed = await confirm("Overwrite existing workspace file?", {
				title: "Confirm Save",
				okLabel: "Overwrite",
				cancelLabel: "Cancel"
			});
			if (!confirmed) {
				appendLog("Save cancelled.");
				return;
			}
		}

		const payload = createWorkspaceSnapshot({ includeFilePath: false });
		await writeTextFile(targetPath, JSON.stringify(payload, null, 2));
		projectFilePath = targetPath;
		appendLog(`Workspace saved to ${await basename(targetPath)}`);
		saveWorkspace({ silent: true });
	} catch (error) {
		if (error) {
			console.error(error);
			appendLog("Failed to save workspace.");
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
			saveWorkspace({ silent: true });
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
		saveWorkspace({ silent: true });
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
		saveWorkspace({ silent: true });
	}

	function setTool(tool: ToolKey) {
		if (tool === activeTool) return;
		activeTool = tool;
		appendLog(`Activated ${toolLabel(tool)}.`);
		saveWorkspace({ silent: true });
	}

	function beginResize(
		event: PointerEvent,
		startValue: number,
		calc: (start: number, delta: number) => number,
		apply: (value: number) => void,
		onEnd?: () => void
	) {
		event.preventDefault();
		const startX = event.clientX;
		let frameRequested = false;
		const body = document.body;
		const previousUserSelect = body.style.userSelect;
		body.style.userSelect = "none";

		const handleMove = (moveEvent: PointerEvent) => {
			if (!frameRequested) {
				frameRequested = true;
				requestAnimationFrame(() => {
					frameRequested = false;
					const delta = moveEvent.clientX - startX;
					apply(calc(startValue, delta));
				});
			}
		};

		const handleUp = () => {
			window.removeEventListener("pointermove", handleMove);
			window.removeEventListener("pointerup", handleUp);
			body.style.userSelect = previousUserSelect;
			onEnd?.();
		};

		window.addEventListener("pointermove", handleMove);
		window.addEventListener("pointerup", handleUp);
	}

	function startExplorerResize(event: PointerEvent) {
		beginResize(
			event,
			explorerWidth,
			(start, delta) => clampPanelSize(start + delta, "explorer"),
			(value) => {
				explorerWidth = value;
			},
			() => saveWorkspace({ silent: true })
		);
	}

	function startInspectorResize(event: PointerEvent) {
		beginResize(
			event,
			inspectorWidth,
			(start, delta) => clampPanelSize(start - delta, "inspector"),
			(value) => {
				inspectorWidth = value;
			},
			() => saveWorkspace({ silent: true })
		);
	}

	function adjustExplorerWidth(delta: number) {
		explorerWidth = clampPanelSize(explorerWidth + delta, "explorer");
		saveWorkspace({ silent: true });
	}

	function adjustInspectorWidth(delta: number) {
		inspectorWidth = clampPanelSize(inspectorWidth + delta, "inspector");
		saveWorkspace({ silent: true });
	}

	function handleExplorerHandleKeydown(event: KeyboardEvent) {
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			adjustExplorerWidth(-10);
		} else if (event.key === "ArrowRight") {
			event.preventDefault();
			adjustExplorerWidth(10);
		}
	}

	function handleInspectorHandleKeydown(event: KeyboardEvent) {
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			adjustInspectorWidth(-10);
		} else if (event.key === "ArrowRight") {
			event.preventDefault();
			adjustInspectorWidth(10);
		}
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

	function handleExplorerSelect(event: CustomEvent<{ id: string }>) {
		const { id } = event.detail;
		if (id === activeSidebar) return;
		activeSidebar = id;
		appendLog(`Selected ${explorerLabel(id)}.`);
		saveWorkspace({ silent: true });
	}

	function removeAsset(path: string) {
		if (!importedAssets.includes(path)) {
			appendLog("Asset removal ignored: asset not found.");
			return;
		}
		const cleared = cellAssignments.reduce(
			(total, row) => total + row.filter((value) => value === path).length,
			0
		);
		importedAssets = importedAssets.filter((asset) => asset !== path);
		cellAssignments = cellAssignments.map((row) =>
			row.map((value) => (value === path ? null : value))
		);
		appendLog(
			cleared
				? `Removed ${assetLabel(path)} and cleared ${cleared} cell${cleared === 1 ? "" : "s"}.`
				: `Removed ${assetLabel(path)}.`
		);
		saveWorkspace({ silent: true });
	}

	function handleExplorerAssetRemove(event: CustomEvent<{ path: string }>) {
		removeAsset(event.detail.path);
	}

	function clearAllAssignments() {
		const cleared = cellAssignments.reduce(
			(total, row) => total + row.filter((value) => value != null).length,
			0
		);
		clearAssignments();
		appendLog(
			cleared
				? `Cleared ${cleared} assigned cell${cleared === 1 ? "" : "s"}.`
				: "Assignments already empty."
		);
		saveWorkspace({ silent: true });
	}

	function handleExplorerClearAssignments() {
		clearAllAssignments();
	}

	function handleExplorerImport() {
		void importAssets();
	}

	function handleExplorerPreset(event: CustomEvent<{ preset: ReelPreset }>) {
		void setPreset(event.detail.preset);
	}

	function handleExplorerTool(event: CustomEvent<{ tool: ToolKey }>) {
		setTool(event.detail.tool);
	}

	function handleExplorerTheme(event: CustomEvent<{ id: string }>) {
		const { id } = event.detail;
		if (id === backgroundTheme) return;
		const theme = BACKGROUND_THEMES.find((entry) => entry.id === id);
		backgroundTheme = id;
		appendLog(`Applied theme: ${theme?.label ?? id}.`);
		saveWorkspace({ silent: true });
	}

	function handleExplorerNearHit(event: CustomEvent<{ id: string }>) {
		const { id } = event.detail;
		if (id === nearHitAnimation) return;
		const option = NEAR_HIT_OPTIONS.find((entry) => entry.id === id);
		nearHitAnimation = id;
		appendLog(`Set near-hit animation to ${option?.label ?? id}.`);
		saveWorkspace({ silent: true });
	}

	function handleExplorerOverlayToggle(event: CustomEvent<{ id: string; enabled: boolean }>) {
		const { id, enabled } = event.detail;
		uiOverlays = uiOverlays.map((overlay) =>
			overlay.id === id ? { ...overlay, enabled } : overlay
		);
		appendLog(`${enabled ? "Enabled" : "Disabled"} overlay: ${id}.`);
		saveWorkspace({ silent: true });
	}

	function handleExplorerOverlayPosition(event: CustomEvent<{ id: string; position: OverlayPosition }>) {
		const { id, position } = event.detail;
		uiOverlays = uiOverlays.map((overlay) =>
			overlay.id === id ? { ...overlay, position } : overlay
		);
		appendLog(`Moved ${id} overlay to ${position.replace("-", " ")}.`);
		saveWorkspace({ silent: true });
	}

	function handleExplorerOverlayVariant(event: CustomEvent<{ id: string; variant: string }>) {
		const { id, variant } = event.detail;
		uiOverlays = uiOverlays.map((overlay) =>
			overlay.id === id ? { ...overlay, variant } : overlay
		);
		appendLog(`Switched ${id} overlay to ${variant} variant.`);
		saveWorkspace({ silent: true });
	}

	function handleEconomyChange(event: CustomEvent<{ field: "credits" | "bet"; value: number }>) {
		const { field, value } = event.detail;
		if (field === "credits") {
			const sanitized = Math.max(0, Number.isFinite(value) ? value : credits);
			credits = sanitized;
			appendLog(`Credits set to ${sanitized.toFixed(2)}.`);
		} else {
			const sanitized = Math.max(0.1, Number.isFinite(value) ? value : betAmount);
			betAmount = sanitized;
			appendLog(`Bet amount set to ${sanitized.toFixed(2)}.`);
		}
		saveWorkspace({ silent: true });
	}

function handleCellAssign(event: CustomEvent<{ col: number; row: number; assetPath: string }>) {
	const { col, row, assetPath } = event.detail;
	if (!cellAssignments[row] || cellAssignments[row][col] === undefined) {
		appendLog("Cell assignment ignored: out of bounds.");
		return;
	}
	setCellAssignment(col, row, assetPath);
	appendLog(`Placed ${assetLabel(assetPath)} at column ${col + 1}, row ${row + 1}.`);
	saveWorkspace({ silent: true });
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
				saveWorkspace({ silent: true });
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
			<div class="side-panel explorer-panel" style={`width:${explorerWidth}px`}>
				<ProjectExplorer
					activeItem={activeSidebar}
					assets={importedAssets}
					assignments={cellAssignments}
					{cols}
					{rows}
					{activeTool}
					{activePreset}
					backgroundTheme={backgroundTheme}
					availableThemes={BACKGROUND_THEMES}
					nearHit={nearHitAnimation}
					nearHitOptions={NEAR_HIT_OPTIONS}
					overlays={overlaySummaries}
					on:select={handleExplorerSelect}
					on:importAssets={handleExplorerImport}
					on:removeAsset={handleExplorerAssetRemove}
					on:clearAssignments={handleExplorerClearAssignments}
					on:setPreset={handleExplorerPreset}
					on:setTool={handleExplorerTool}
					on:updateTheme={handleExplorerTheme}
					on:updateNearHit={handleExplorerNearHit}
					on:toggleOverlay={handleExplorerOverlayToggle}
					on:updateOverlayPosition={handleExplorerOverlayPosition}
					on:updateOverlayVariant={handleExplorerOverlayVariant}
				/>
			</div>
			<button
				type="button"
				class="resize-handle explorer-handle"
				on:pointerdown={startExplorerResize}
				on:keydown={handleExplorerHandleKeydown}
				aria-label="Resize Project Explorer panel"
			></button>
		{/if}

		<section class="canvas">
			<div class="canvas-header">
				Slot Preview
			</div>
			<div class="canvas-body">
				<PixiViewer
					{cols}
					{rows}
					{spinSpeed}
					spinning={isSpinning}
					backgroundStyle={viewerBackgroundStyle}
					overlays={activeOverlaySummaries}
					nearHitAnimation={nearHitAnimation}
					nearHitLabel={nearHitLabel}
					assignments={cellAssignments}
					on:assign={handleCellAssign}
				/>
			</div>
		</section>

		{#if showProperties}
			<button
				type="button"
				class="resize-handle inspector-handle"
				on:pointerdown={startInspectorResize}
				on:keydown={handleInspectorHandleKeydown}
				aria-label="Resize Inspector panel"
			></button>
			<div class="side-panel inspector-panel" style={`width:${inspectorWidth}px`}>
				<InspectorPanel
					bind:cols
					bind:rows
					bind:spinSpeed
					bind:credits
					bind:bet={betAmount}
					lastWin={lastWinAmount}
					totalSpins={totalSpins}
					on:economyChange={handleEconomyChange}
				/>
			</div>
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

.side-panel {
	display: flex;
	flex-direction: column;
	height: 100%;
	background: #1f1f1f;
	overflow: hidden;
}

.explorer-panel {
	border-right: 1px solid #2d2d2d;
}

.inspector-panel {
	border-left: 1px solid #2d2d2d;
}

.resize-handle {
	width: 6px;
	min-width: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: col-resize;
	background: transparent;
	position: relative;
	border: none;
	padding: 0;
}

.resize-handle::after {
	content: "";
	width: 2px;
	height: 40%;
	background: rgba(255, 255, 255, 0.15);
	border-radius: 1px;
}

.resize-handle:hover::after,
.resize-handle:focus-visible::after {
	background: rgba(255, 255, 255, 0.35);
}

.resize-handle:focus-visible {
	outline: 2px solid #3d6af2;
	outline-offset: -2px;
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
