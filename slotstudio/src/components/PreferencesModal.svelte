<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from "svelte";

	type Preferences = {
		theme: "dark" | "light";
		autoSave: boolean;
		confirmOnOverwrite: boolean;
	};

	export let open = false;
	export let preferences: Preferences;

	const dispatch = createEventDispatcher<{
		update: { preferences: Preferences };
		close: void;
	}>();

	function emitUpdate(updated: Preferences) {
		dispatch("update", { preferences: updated });
	}

	function handleSelectTheme(event: Event) {
		const value = (event.target as HTMLSelectElement).value as Preferences["theme"];
		emitUpdate({ ...preferences, theme: value });
	}

	function handleToggle(key: keyof Preferences, value: boolean) {
		emitUpdate({ ...preferences, [key]: value });
	}

	function close() {
		dispatch("close");
	}

	function handleGlobalKeydown(event: KeyboardEvent) {
		if (event.key === "Escape" && open) {
			close();
		}
	}

	function handleBackdropKeydown(event: KeyboardEvent) {
		if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			close();
		}
	}

	onMount(() => {
		window.addEventListener("keydown", handleGlobalKeydown);
	});

	onDestroy(() => {
		window.removeEventListener("keydown", handleGlobalKeydown);
	});
</script>

{#if open}
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-label="Preferences"
		tabindex="-1"
		on:click={close}
		on:keydown={handleBackdropKeydown}
	>
		<div class="modal" role="document" on:pointerdown|stopPropagation>
			<header>
				<h2>Preferences</h2>
			</header>
			<section>
				<div class="field">
					<label for="theme-select">Theme</label>
					<select id="theme-select" on:change={handleSelectTheme} value={preferences.theme}>
						<option value="dark">Dark</option>
						<option value="light">Light</option>
					</select>
				</div>

				<div class="field toggle">
					<label for="autosave-toggle">
						<input
							id="autosave-toggle"
							type="checkbox"
							checked={preferences.autoSave}
							on:change={(event) => handleToggle("autoSave", (event.target as HTMLInputElement).checked)}
						/>
						<span>Auto-save workspace every minute</span>
					</label>
				</div>

				<div class="field toggle">
					<label for="confirm-toggle">
						<input
							id="confirm-toggle"
							type="checkbox"
							checked={preferences.confirmOnOverwrite}
							on:change={(event) =>
								handleToggle("confirmOnOverwrite", (event.target as HTMLInputElement).checked)}
						/>
						<span>Confirm before overwriting existing files</span>
					</label>
				</div>
			</section>
			<footer>
				<button type="button" on:click={close}>Close</button>
			</footer>
		</div>
	</div>
{/if}

<style>
.modal-backdrop {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.55);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 100;
}
.modal {
	background: #2b2b2b;
	border: 1px solid #444;
	border-radius: 8px;
	width: min(420px, 90vw);
	padding: 1rem 1.25rem;
	color: #ddd;
	box-shadow: 0 18px 36px rgba(0, 0, 0, 0.45);
	display: flex;
	flex-direction: column;
	gap: 1rem;
}
header h2 {
	margin: 0;
	font-size: 1.1rem;
}
section {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}
.field label {
	display: block;
	font-size: 0.85rem;
	margin-bottom: 0.25rem;
	color: #bbb;
}
select {
	width: 100%;
	background: #1e1e1e;
	color: #eee;
	border: 1px solid #555;
	padding: 0.4rem 0.5rem;
	border-radius: 6px;
}
.field.toggle label {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	margin-bottom: 0;
	color: #ddd;
	cursor: pointer;
}
input[type="checkbox"] {
	width: 1rem;
	height: 1rem;
}
footer {
	display: flex;
	justify-content: flex-end;
}
footer button {
	background: #444;
	border: none;
	color: #eee;
	padding: 0.4rem 0.75rem;
	border-radius: 4px;
	cursor: pointer;
}
footer button:hover {
	background: #555;
}
</style>
