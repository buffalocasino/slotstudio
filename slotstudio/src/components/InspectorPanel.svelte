<script lang="ts">
	export let cols: number = 5;
	export let rows: number = 3;
	export let spinSpeed: number = 0.5;
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
</aside>

<style>
.inspector {
	width: 240px;
	background: #252526;
	border-left: 1px solid #333;
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
</style>
