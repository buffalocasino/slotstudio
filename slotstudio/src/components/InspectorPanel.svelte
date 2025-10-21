<script lang="ts">
	import { createEventDispatcher } from "svelte";

	export let cols: number = 5;
	export let rows: number = 3;
	export let spinSpeed: number = 0.5;
	export let credits = 5000;
	export let bet = 2.5;
	export let lastWin = 0;
	export let totalSpins = 0;

	const dispatch = createEventDispatcher<{ economyChange: { field: "credits" | "bet"; value: number } }>();

	function handleCreditsChange(event: Event) {
		const value = Number((event.target as HTMLInputElement).value);
		dispatch("economyChange", { field: "credits", value });
	}

	function handleBetChange(event: Event) {
		const value = Number((event.target as HTMLInputElement).value);
		dispatch("economyChange", { field: "bet", value });
	}
</script>

<aside class="inspector">
	<h3>Properties</h3>

	<div class="prop-item">
		<label for="columns-input">Columns:</label>
		<input id="columns-input" type="number" bind:value={cols} min="1" max="8" />
	</div>

	<div class="prop-item">
		<label for="rows-input">Rows:</label>
		<input id="rows-input" type="number" bind:value={rows} min="1" max="6" />
	</div>

	<div class="prop-item">
		<label for="spin-speed-input">Spin Speed:</label>
		<input
			id="spin-speed-input"
			type="range"
			bind:value={spinSpeed}
			min="0.1"
			max="2"
			step="0.1"
		/>
		<span>{spinSpeed.toFixed(1)}x</span>
	</div>

	<hr class="divider" />

	<div class="prop-item">
		<label for="credits-input">Credits:</label>
		<input
			id="credits-input"
			type="number"
			min="0"
			step="1"
			bind:value={credits}
			on:change={handleCreditsChange}
		/>
	</div>

	<div class="prop-item">
		<label for="bet-input">Bet:</label>
		<input
			id="bet-input"
			type="number"
			min="0.1"
			step="0.1"
			bind:value={bet}
			on:change={handleBetChange}
		/>
		<span>{bet.toFixed(2)}</span>
	</div>

	<div class="stats">
		<div>
			<span class="label">Last Win</span>
			<span class="value">{lastWin.toFixed(2)}</span>
		</div>
		<div>
			<span class="label">Spins</span>
			<span class="value">{totalSpins}</span>
		</div>
	</div>
</aside>

<style>
.inspector {
	width: 100%;
	background: #252526;
	border-left: none;
	padding: 0.75rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}
.inspector h3 {
	font-size: 0.9rem;
	color: #999;
	margin-bottom: 0.5rem;
}
.prop-item label {
	display: block;
	font-size: 0.8rem;
	color: #aaa;
	margin-bottom: 0.25rem;
}
.prop-item input[type="number"],
.prop-item input[type="range"] {
	width: 100%;
	background: #333;
	border: 1px solid #444;
	color: #ddd;
	padding: 0.25rem;
	border-radius: 3px;
}
.prop-item span {
	font-size: 0.75rem;
	color: #888;
}
.divider {
	border: none;
	border-top: 1px solid #333;
	margin: 0.5rem 0;
}
.stats {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 0.5rem;
}
.stats .label {
	display: block;
	font-size: 0.7rem;
	text-transform: uppercase;
	letter-spacing: 0.06em;
	color: #777;
}
.stats .value {
	font-size: 0.85rem;
	color: #ddd;
	font-variant-numeric: tabular-nums;
}
</style>
