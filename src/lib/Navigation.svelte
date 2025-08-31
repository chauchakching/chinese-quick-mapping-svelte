<script lang="ts">
  import { page } from '$app/stores';
  
  const navItems = [
    { href: '/', label: '查字', icon: '/icons/search.svg' },
    { href: '/typing', label: '練打字', icon: '/icons/fire.svg' }
  ];
  
  $: currentPath = $page.url.pathname;
</script>

<nav class="flex justify-center border-b border-gray-200 bg-white">
  <div class="flex flex-row max-w-md">
    {#each navItems as { href, label, icon }}
      {@const isActive = (href === '/' && currentPath === '/') || (href !== '/' && currentPath.startsWith(href))}
      <a
        {href}
        class={`flex-1 flex flex-col items-center w-28 px-4 py-3 text-sm transition-colors duration-200 ${
          isActive 
            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' 
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
        }`}
        data-sveltekit-prefetch
      >
        <div class="flex items-center space-x-2">
          {#if icon}
            <img 
              src={icon} 
              alt={label}
              class={`h-4 w-4 transition-all duration-200 ${isActive ? 'opacity-100 scale-110' : 'opacity-70 scale-100'}`}
            />
          {/if}
          <span class="font-medium">{label}</span>
        </div>
      </a>
    {/each}
  </div>
</nav>
