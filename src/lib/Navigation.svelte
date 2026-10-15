<script lang="ts">
  import { page } from '$app/stores';

  const navItems = [
    { href: '/', label: '查字', icon: '/icons/search.svg' },
    { href: '/typing', label: '練打字', icon: '/icons/fire.svg' },
    { href: '/practice', label: '練拆碼', icon: '/icons/keys.svg' }
  ];

  let currentPath = $derived($page.url.pathname);
</script>

<nav
  class="flex w-full justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm sm:rounded-none sm:border-0 sm:border-b sm:shadow-none"
>
  <div class="flex w-full flex-row">
    {#each navItems as { href, label, icon } (href)}
      {@const isActive =
        (href === '/' && currentPath === '/') || (href !== '/' && currentPath.startsWith(href))}
      <a
        {href}
        class={`relative flex flex-1 flex-col items-center justify-center gap-1 whitespace-nowrap px-3 py-2.5 text-sm transition-colors duration-200 ${
          isActive
            ? 'bg-blue-50 text-blue-600 sm:border-b-2 sm:border-blue-600'
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
        {#if href === '/practice'}
          <span
            class="absolute right-1.5 top-1 rounded bg-red-500 px-1 py-0.5 text-[9px] font-bold leading-none text-white"
            >NEW</span
          >
        {/if}
      </a>
    {/each}
  </div>
</nav>
