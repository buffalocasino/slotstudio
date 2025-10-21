<script context="module" lang="ts">
	export type SidebarItem = {
		id: string;
		label: string;
		draggable?: boolean;
		data?: Record<string, unknown>;
		thumbnail?: string | null;
	};
</script>

<script lang="ts">
	import { createEventDispatcher } from "svelte";

	const dispatch = createEventDispatcher<{
		select: { id: string };
	}>();

	const defaultItems: SidebarItem[] = [
		{ id: "assets", label: "🎨 Assets" },
		{ id: "reels", label: "🧩 Reels" },
		{ id: "configs", label: "⚙️ Configs" },
		{ id: "ui", label: "🪄 UI Elements" }
	];

	export let items: SidebarItem[] = defaultItems;
	export let activeItem: string = items[0]?.id ?? "";

	function handleSelect(id: string) {
		dispatch("select", { id });
	}

	function handleDragStart(event: DragEvent, item: SidebarItem) {
		if (!item.draggable || !item.data || !event.dataTransfer) return;
		event.dataTransfer.effectAllowed = "copy";
		event.dataTransfer.setData("application/x-slot-asset", JSON.stringify(item.data));
		event.dataTransfer.setData("text/plain", item.label);
	}
</script>

<aside class="sidebar">
	<h3>Project Explorer</h3>
	<ul>
		{#each items as item}
			<li>
				<button
					type="button"
					class:active={item.id === activeItem}
					aria-pressed={item.id === activeItem}
					draggable={item.draggable ?? false}
					on:click={() => handleSelect(item.id)}
					on:dragstart={(event) => handleDragStart(event, item)}
				>
					{#if item.thumbnail}
						<img
							src={item.thumbnail}
							alt={item.label}
							draggable={item.draggable ?? false}
							on:dragstart={(event) => handleDragStart(event, item)}
						/>
					{/if}
					{item.label}
				</button>
			</li>
		{/each}
	</ul>
</aside>

<style>
.sidebar {
	width: 200px;
	background: #252526;
	padding: 0.5rem;
	border-right: 1px solid #333;
}
.sidebar h3 {
	font-size: 0.9rem;
	margin-bottom: 0.5rem;
	color: #999;
}
.sidebar ul {
	list-style: none;
	padding: 0;
	margin: 0;
}
.sidebar li {
	margin: 0.25rem 0;
}
.sidebar button {
	width: 100%;
	display: block;
	background: none;
	border: none;
	text-align: left;
	padding: 0.35rem 0.4rem;
	border-radius: 3px;
	color: #ddd;
	cursor: pointer;
	font: inherit;
	display: flex;
	align-items: center;
	gap: 0.5rem;
}
.sidebar button img {
	width: 24px;
	height: 24px;
	object-fit: contain;
	border-radius: 3px;
}
.sidebar button:hover,
.sidebar button.active {
	background: #333;
}
.sidebar button.active {
	color: #fff;
	font-weight: 500;
}
</style>
