<script lang="ts">
  import '../app.css';
</script>

<div class="flex flex-col items-center h-screen mx-auto max-w-4xl">
  <header>
    <h1 class="text-5xl text-gray-900 text-center pt-12 pb-8 sm:pt-24 sm:pb-16">
      <a href="/">速成查字</a>
    </h1>
  </header>

  <main class="container px-4 flex flex-col justify-between flex-1">
    <slot />
  </main>

  <footer class="mt-8 p-4 flex flex-row justify-between w-full">
    <div class="flex-1 w-full">
      <!-- <a class="text-sm opacity-60 cursor-pointer" sveltekit:prefetch href="/about">
        關於速成查字
      </a> -->
    </div>
    <a href="https://github.com/chauchakching/chinese-quick-mapping-svelte">
      <img src="assets/GitHub-Mark-64px.png" alt="github" class="h-8" />
    </a>
  </footer>
</div>
