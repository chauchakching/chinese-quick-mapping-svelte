<script lang="ts">
  import '../app.css';
  import Navigation from '$lib/Navigation.svelte';

  interface Props {
    children?: import('svelte').Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="flex flex-col items-center h-screen mx-auto max-w-4xl">
  <header>
    <h1 class="text-5xl text-gray-900 text-center pt-12 pb-6 sm:pt-24 sm:pb-8">速成查字</h1>
    <Navigation />
  </header>

  <main class="container px-4 flex flex-col justify-between flex-1 pt-6">
    {@render children?.()}
  </main>

  <footer class="mt-8 p-4 flex flex-row justify-end w-full">
    <a href="https://github.com/chauchakching/chinese-quick-mapping-svelte">
      <img src="assets/GitHub-Mark-64px.png" alt="github" class="h-8" />
    </a>
  </footer>
</div>
