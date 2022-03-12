<script lang="ts">
  import '../app.css';
</script>

<div class="flex flex-col h-screen">
  <header>
    <h1 class="text-5xl text-gray-900 text-center pt-12 pb-8 sm:pt-24 sm:pb-16">速成查字</h1>
  </header>

  <main
    class="container mx-auto px-4 flex flex-col justify-between flex-1"
    style="max-width: 60rem;"
  >
    <slot />
  </main>

  <footer class="p-4 flex flex-row items-center">
    <div class="flex-1">
      <a class="text-sm opacity-60 cursor-pointer" sveltekit:prefetch href="/about">
        關於速成查字
      </a>
    </div>
    <a href="https://github.com/chauchakching/chinese-quick-mapping">
      <img src="assets/GitHub-Mark-64px.png" alt="github" class="h-8" />
    </a>
  </footer>
</div>
