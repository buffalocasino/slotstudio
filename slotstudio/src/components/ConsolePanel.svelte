<script lang="ts">
	import { afterUpdate, createEventDispatcher } from "svelte";

	const dispatch = createEventDispatcher<{ clear: void }>();

	export let logs: string[] = [];

	let bodyEl: HTMLDivElement;

	afterUpdate(() => {
		if (bodyEl) {
			bodyEl.scrollTop = bodyEl.scrollHeight;
		}
	});

	function clearLogs() {
		dispatch("clear");
	}
</script>

<footer class="console">
	<div class="console-header">
		<span>Console</span>
		<button type="button" on:click={clearLogs}>Clear</button>
	</div>
	<div class="console-body" bind:this={bodyEl}>
		{#each logs as log}
			<div class="log-line">{log}</div>
		{/each}
	</div>
</footer>

<style>
.console {
	background: #1e1e1e;
	border-top: 1px solid #333;
	height: 120px;
	display: flex;
	flex-direction: column;
}
.console-header {
	background: #252526;
	padding: 0.25rem 0.5rem;
	color: #999;
	font-size: 0.8rem;
	border-bottom: 1px solid #333;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
}
.console-header button {
	background: none;
	border: none;
	color: #aaa;
	font-size: 0.75rem;
	cursor: pointer;
	padding: 0.15rem 0.4rem;
	border-radius: 3px;
}
.console-header button:hover {
	background: rgba(255, 255, 255, 0.07);
	color: #fff;
}
.console-body {
	flex: 1;
	font-size: 0.8rem;
	padding: 0.5rem;
	overflow-y: auto;
}
.log-line {
	color: #bbb;
	font-family: monospace;
}
</style>
