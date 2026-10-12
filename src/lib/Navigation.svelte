<script lang="ts">
  import { page } from '$app/stores';

  const navItems = [
    { href: '/', label: '查字', icon: '/icons/search.svg' },
    { href: '/typing', label: '練打字', icon: '/icons/fire.svg' },
    { href: '/keys', label: '拆碼', icon: '/icons/keys.svg' }
  ];

  $: currentPath = $page.url.pathname;
</script>

<nav class="flex justify-center border-b border-gray-200 bg-white w-full">
  <div class="flex flex-row w-full max-w-md">
    {#each navItems as { href, label, icon } (href)}
      {@const isActive =
        (href === '/' && currentPath === '/') || (href !== '/' && currentPath.startsWith(href))}
      <a
        {href}
        class={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-1 py-2 text-sm transition-colors duration-200 ${
          isActive
            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
        }`}
        data-sveltekit-prefetch
      >
        {#if icon}
          <img
            src={icon}
            alt=""
            class={`h-4 w-4 transition-all duration-200 ${isActive ? 'opacity-100 scale-110' : 'opacity-70 scale-100'}`}
          />
        {/if}
        <span class="font-medium leading-none">{label}</span>
        {#if href === '/typing'}
          <span class="text-[10px] leading-none font-bold text-white bg-red-500 rounded px-1 py-0.5"
            >NEW</span
          >
        {/if}
      </a>
    {/each}
  </div>
</nav>
